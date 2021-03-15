const moment = require("moment");
const requestPromise = require("request-promise");
const NodeGeocoder = require("node-geocoder");
const csv = require("csvtojson");
const _ = require("underscore");

const constants = require("./constants");

const getAllIssueAttributesModule = require("./getAllIssueAttributes");

var geocoder = NodeGeocoder({
  provider: "google",
  httpAdapter: "https",
  apiKey: process.env.GOOGLE_GEOCODER_API_KEY,
  formatter: null,
});

exports.handler = (req, res, cityServiceRequestCategories, cityModels) => {
  var cachedCity = null;
  if (req.method === "GET") {
    if (req.query.lat && req.query.long && req.query.client_address) {
      var categoriesToSend;

      findCityBasedOnLatAndLon(req.query.lat, req.query.long)
        .then((city) => {
          cachedCity = city;
          return getAllIssueCategories(
            cachedCity,
            cityServiceRequestCategories,
            cityModels
          );
        })
        .then((categories) => {
          categoriesToSend = categories;
          /** Check if user is in Ottawa.
					If yes, return all
					If no, only return those that are not present in ottOnlySRs.csv
				*/
          return checkIfUserInOttawa(req.query.client_address);
        })
        .then((isInOttawa) => {
          if (!isInOttawa) {
            return removeOttOnlySRs(categoriesToSend);
          }

          return categoriesToSend;
        })
        .then((filteredCategories) => {
          res
            .status(200)
            .send(
              JSON.stringify({
                city: cachedCity,
                categories: filteredCategories,
              })
            );
          return;
        })
        .catch((err) => {
          const errString = err
            .toString()
            .replace(/Error:/g, "")
            .trim();
          res.status(500).send({ Error: errString });
        });
    } else {
      res.status(405).send({ Error: "Method not allowed" });
    }
  } else {
    res.status(405).send({ Error: "Method not allowed" });
  }
};

//Using the geocoder npm module
//Grabs the city/municipality off Google
//One day we will have a db with shapes for
// each city
function findCityBasedOnLatAndLon(lat, long) {
  return new Promise((resolve, reject) => {
    geocoder
      .reverse({ lat: lat, lon: long })
      .then(function (res) {
        if (res[0].city !== undefined) {
          const city = res[0].city.toLowerCase();

          if (getAllIssueAttributesModule.checkIfCityIsAccepted(city)) {
            resolve(city);
            return;
          } else {
            reject(new Error("City is not yet supported by Neappoli"));
            return;
          }
        } else {
          reject(new Error("No city with those coordinates can be found"));
          return;
        }
      })
      .catch(function (err) {
        reject(new Error(err));
      });
  });
}

function getAllIssueCategories(city, cityServiceRequestCategories, cityModels) {
  var cachedCategories = null;
  return new Promise((resolve, reject) => {
    cityServiceRequestCategories
      .child(city)
      .once("value")
      .then((snapshot) => {
        if (snapshot.exists() && !moment().isAfter(snapshot.val().updateTime)) {
          cachedCategories = snapshot.val().categories;
          resolve(cachedCategories);
          return;
        }
        return getAllIssueCategoriesFromUrl(city, cityModels);
      })
      .then((categories) => {
        cachedCategories = categories;
        return cacheCategoriesForCity(
          city,
          cachedCategories,
          cityServiceRequestCategories
        );
      })
      .then(() => {
        resolve(cachedCategories);
        return;
      })
      .catch((err) => {
        reject(new Error(err));
        return;
      });
  });
}

function getAllIssueCategoriesFromUrl(city, cityModels) {
  return new Promise((resolve, reject) => {
    var categoryObject = {};
    cityModels
      .child(city)
      .once("value")
      .then((snapshot) => {
        if (snapshot.exists()) {
          return snapshot.val();
        } else {
          reject(new Error("City not found in Neappoli"));
          return;
        }
      })
      .then((cityModel) => {
        categoryObject = cityModel["categoryAttributes"];
        return requestPromise({
          method: "GET",
          uri: cityModel["getCategoriesExtension"],
          json: true,
        });
      })
      .then((serviceRequests) => {
        var serviceCategories = {};
        var categoryGroups = [];
        for (var serviceRequestIndex in serviceRequests) {
          if (
            typeof serviceRequests[serviceRequestIndex].group !== "undefined"
          ) {
            const serviceRequest = serviceRequests[serviceRequestIndex];
            const categoryGroup = serviceRequest[categoryObject["group"]];
            // Make sure category group is not empty string
            if (categoryGroup === "") continue;

            if (!(categoryGroup in serviceCategories)) {
              serviceCategories[categoryGroup] = [];
              categoryGroups.push(categoryGroup);
            }
            serviceCategories[categoryGroup].push({
              metadata: serviceRequest[categoryObject["metadata"]],
              type: serviceRequest[categoryObject["type"]],
              serviceCode: serviceRequest[categoryObject["service_code"]],
              serviceName: serviceRequest[categoryObject["service_name"]],
              description: serviceRequest[categoryObject["description"]],
              keywords: serviceRequest[categoryObject["keywords"]].split(","),
            });
          } else {
            reject(new Error("No group attribute in serviceRequest"));
            return;
          }
        }

        const categories = {
          categoryObject: serviceCategories,
          categoryGroups: categoryGroups,
        };
        resolve(categories);
        return;
      })
      .catch((err) => {
        reject(new Error(err));
        return;
      });
  });
}

//Stores the categories for a given city in
//the firebase db
function cacheCategoriesForCity(
  city,
  categories,
  cityServiceRequestCategories
) {
  return new Promise((resolve, reject) => {
    //creating new instance in the db
    var cityFirebaseAddress = cityServiceRequestCategories.child(city);

    cityFirebaseAddress
      .set({
        updateTime: moment(moment().add(2, "hours")).format(),
        categories: categories,
      })
      .then(() => {
        resolve();
        return;
      })
      .catch((err) => {
        reject(new Error(err));
        return;
      });
  });
}

/** Given an address, checks if user is in Ottawa by calling the
	city's address ID service.
*/
function checkIfUserInOttawa(addressString) {
  // client_address_id_req is present
  return requestPromise({
    method: "GET",
    //that is the address of the pin
    uri: constants.ottawaAddressToIdEndpoint + addressString,
  })
    .then((response) => {
      const parsedResponse = JSON.parse(response);

      // If the following check passes, then it means there are candidates,
      // therefore address is in Ott.
      if (typeof parsedResponse["candidates"][0] !== "undefined") {
        return true;
      } else {
        return false;
      }
    })
    .catch((err) => {
      throw err;
    });
}

/** The following function removes the SRs that are not available for a person
	residing in Quebec. It filters the SRs from the oCategories object by removing
	all SRs from it that are present in the file ../ottOnlySRs.csv

	oCategories is in the following format:
	{
		categoryGroups: [String],
		categoryObject: {
			String: [
				{
					description: 'String',
					keywords: ['keyword', 'keyword'],
					metadata: true,
					serviceCode: '2030714-1',
					serviceName: 'Stoop and Scoop Violation',
					type: 'realtime'
				},
				{SR},
				...
			],
			String: ...
		}
	}
*/
async function removeOttOnlySRs(oCategories) {
  var categoriesNamesToRemove = [];
  var ottSrIds = [];

  // Load CSV
  const loadedCsv = await csv({ noheader: true }).fromFile("ottOnlySRs.csv");
  _.each(loadedCsv, (srId) => {
    ottSrIds.push(srId.field1);
  });

  oCategories.categoryGroups.forEach((categoryName) => {
    oCategories.categoryObject[categoryName] = _.filter(
      oCategories.categoryObject[categoryName],
      (sr) => {
        return !ottSrIds.includes(sr.serviceCode);
      }
    );

    if (oCategories.categoryObject[categoryName].length === 0) {
      categoriesNamesToRemove.push(categoryName);
    }
  });

  oCategories.categoryGroup = _.filter(oCategories.categoryGroup, (catName) => {
    return !categoriesNamesToRemove.includes(catName);
  });

  categoriesNamesToRemove.forEach((catName) => {
    delete oCategories.categoryObject[catName];
  });

  return oCategories;
}
