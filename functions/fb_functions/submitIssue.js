const { v4: uuidv4 } = require("uuid");
const requestPromise = require("request-promise");
const Q = require("q");
const Busboy = require("busboy");
const fs = require("fs");
const path = require("path");
const os = require("os");
const moment = require("moment");
const turf = require("@turf/turf");
const { GeoFire } = require("geofire");
const _ = require("lodash");

const helpers = require("./helpers");
const constants = require("./constants");
const emailModule = require("./emails");

const wardsGeoJson = require("../wardsGeo.json");
const getAllIssueAttributesModule = require("./getAllIssueAttributes");

exports.handler = async (
  req,
  res,
  admin,
  cityModels,
  allReqsRef,
  usersRef,
  openReqsRef,
  kitchStats
) => {
  const serviceRequestPicturesBucket = admin
    .storage()
    .bucket(
      constants.IS_DEV
        ? process.env.DEV_STORAGE_BUCKET
        : process.env.PROD_STORAGE_BUCKET
    );
  var geofireRef = new GeoFire(openReqsRef);

  var localParams,
    cityResponseObject = null;

  if (req.method === "POST") {
    try {
      const parameters = await handleFormUpload(
        req,
        serviceRequestPicturesBucket,
        cityModels
      );
      localParams = parameters;

      // Make sure that the issue is in Ottawa
      if (
        !coordsInOttawa(
          parseFloat(localParams.lat),
          parseFloat(localParams.long)
        )
      ) {
        throw Error(
          "We currently support only service requests that are in Ottawa"
        );
      }

      //this is for Ottawa, not sure if this is abstract enough
      const paramString = createPostRequestBody(localParams);

      const cityResponse = await submitIssueToCity(
        paramString,
        localParams.city,
        cityModels
      );
      cityResponseObject = cityResponse;

      const uuid = await uploadIssueToFirebaseDatabase(
        localParams,
        cityResponseObject,
        allReqsRef,
        usersRef,
        geofireRef
      );

      // Append uuid to the response
      cityResponseObject["uuid"] = uuid;

      console.log("✅✅✅ SERVICE REQUEST SUBMITTED ✅✅✅");
      console.log(
        "Issue with ID " +
          cityResponseObject["service_request_id"] +
          " and UUID " +
          uuid +
          " was successfully submitted to the city of " +
          localParams.city
      );

      // Check if issue was submitted in a sponsored Ward
      const oCouncillor = await getCouncillorForSR(
        parseFloat(localParams.lat),
        parseFloat(localParams.long)
      );

      if (typeof oCouncillor !== "undefined" && oCouncillor) {
        // Issue was in a sponsored Ward. Append it to the request
        cityResponseObject["councillor"] = oCouncillor;

        // Add entry in db if issue was in Jeff Leiper's ward
        kitchStats.push({
          srID: cityResponseObject.service_request_id,
          uuid: cityResponseObject.uuid,
          timestamp: moment().format(constants.TIME_FORMAT),
        });
      }

      res.status(200).send(cityResponseObject);

      // Return confirmation email if required
      const srDetails = {
        userId: localParams.user_id,
        userEmail: localParams.email,
        srId: cityResponseObject["service_request_id"],
        addressLine:
          localParams.address_string === null ? "" : localParams.address_string,
        photoURL: localParams.media_url || "",
        description: localParams.description,
        date_time: moment().format("MMMM Do YYYY, h:mm a"),
      };
      sendConfirmationEmailIfNeeded(srDetails, usersRef);

      return;
    } catch (err) {
      console.error("Error received:" + err);
      const errString = err
        .toString()
        .replace(/Error:/g, "")
        .trim();
      res.status(500).send({ Error: errString });
    }
  } else {
    //If someone tries to send a request that is not a POST, deny it
    res.status(405).send({ Error: "Method not allowed" });
  }
};

function handleFormUpload(req, serviceRequestPicturesBucket, cityModels) {
  return new Promise((resolve, reject) => {
    const busboy = new Busboy({ headers: req.headers });
    //Where all the files will be saved during the request
    //Will keep here if we decide to integrate multiple photo upload
    const uploads = {};
    const parameters = {};

    //This creates a listener for every file present in req.rawBody
    busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
      console.log(
        `File [${fieldname}] filename: ${filename}, encoding: ${encoding}, mimetype: ${mimetype}` +
          " uploaded"
      );

      if (mimetype.includes("image") || mimetype.includes("text")) {
        const uuid = uuidv4();
        var newFileName = constants.serviceRequestImagesPath + uuid + ".png";

        //Creating a temporary drectory to store the picture
        const filepath = path.join(os.tmpdir(), uuid + ".png");

        const options = {
          destination: newFileName,
          uploadType: "media",
          metadata: {
            contentType: "image/png",
            metadata: {
              firebaseStorageDownloadTokens: uuid,
            },
          },
        };

        //Storing it to uploads
        uploads[fieldname] = {
          file: filepath,
          options: options,
        };

        //Writting the file to the temporary directory created above
        file.pipe(fs.createWriteStream(filepath));
      } else {
        reject(new Error("Upload type not supported"));
        return;
      }
    });

    busboy.on(
      "field",
      function (
        fieldname,
        val,
        fieldnameTruncated,
        valTruncated,
        encoding,
        mimetype
      ) {
        parameters[fieldname] = val.replace(/[“”’]/g, "'");
      }
    );

    busboy.on("finish", function () {
      //Uploading the picture to firebase storage
      return checkAndMutateSubmissionParams(parameters, cityModels)
        .then(() => {
          if (uploads["image"]) {
            return serviceRequestPicturesBucket.upload(
              uploads["image"].file,
              uploads["image"].options,
              (err, newFile) => {
                const uuid = uuidv4();
                parameters.media_url =
                  "https://firebasestorage.googleapis.com/v0/b/" +
                  serviceRequestPicturesBucket.name +
                  "/o/" +
                  encodeURIComponent(newFile.name) +
                  "?alt=media&token=" +
                  uuid;
                if (!err) {
                  //figure out how to get file url
                  //Deleting the sym links from memory
                  for (const name in uploads) {
                    const upload = uploads[name];
                    const file = upload.file;
                    fs.unlinkSync(file);
                  }
                  resolve(parameters);
                  return;
                } else {
                  reject(new Error(err));
                  return;
                }
              }
            );
          } else {
            //parameters.media_url = '';
            resolve(parameters);
            return;
          }
        })
        .catch((err) => {
          reject(new Error(err));
          return;
        });
    });

    // if(constants.IS_LOCAL) {
    // 	req.pipe(busboy);
    // }

    // else {
    busboy.end(req.rawBody);
    // }
  });
}

function createPostRequestBody(params) {
  const paramsClone = _.cloneDeep(params);

  paramsClone.api_key = constants.IS_DEV
    ? "upxH1uGMCboY3qrXKGRmKWdYaxhaGiDr"
    : "rjzbT1lOnKM6haBAwGgKQunJhLKxTO5O"; // TODO make this more secure

  if (paramsClone.city.toLowerCase() === "ottawa") {
    // Remove address string since we're using lat an lon
    delete paramsClone["address_string"];

    const attributes = paramsClone.attributes;
    var paramString = "";

    delete paramsClone["attributes"];

    for (attribute in attributes) {
      const key = "attribute[" + attribute + "]";
      paramsClone[key] = attributes[attribute];
    }

    var counterForStringParams = 0;
    for (key in paramsClone) {
      counterForStringParams === 0
        ? (paramString += key + "=" + paramsClone[key])
        : (paramString += "&" + key + "=" + paramsClone[key]);
      counterForStringParams++;
    }

    return paramString;
  }

  return paramsClone;
}

function submitIssueToCity(paramsString, city, cityModels) {
  const headers = {
    "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
  };
  var model = {};
  return new Promise((resolve, reject) => {
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
        const prodOrDev = constants.IS_DEV ? "Dev" : "Prod";
        const urlString = "postServiceRequestExtension" + prodOrDev;
        model = cityModel;
        console.log("POST to city URL:" + cityModel[urlString]);

        return requestPromise({
          method: "POST",
          uri: cityModel[urlString],
          body: paramsString,
          headers: headers,
        });
      })
      .then((response) => {
        if (JSON.parse(response).token) {
          const token = JSON.parse(response).token;
          const tokenExtension = model["tokenExtension"].replace(
            "[tokenId]",
            token
          );
          return requestPromise({
            method: "GET",
            uri: tokenExtension,
          })
            .then((responseFromTokenRequest) => {
              responseFromTokenRequest = JSON.parse(responseFromTokenRequest);
              if (responseFromTokenRequest.length > 0) {
                var responseObject = {};
                for (var i = 0; i < responseFromTokenRequest.length; i++) {
                  var currentObject = responseFromTokenRequest[i];

                  if (typeof currentObject === "object") {
                    for (var key in currentObject) {
                      responseObject[key] = currentObject[key];
                    }
                  }
                }
                resolve(currentObject);
                return;
              } else {
                resolve({});
                return;
              }
            })
            .catch((err) => {
              reject(new Error(err));
              return;
            });
        } else {
          response = JSON.parse(response);
          if (response.length > 0) {
            var responseObject = {};
            for (var i = 0; i < response.length; i++) {
              var currentObject = response[i];

              if (typeof currentObject === "object") {
                for (var key in currentObject) {
                  responseObject[key] = currentObject[key];
                }
              }
            }
            resolve(currentObject);
            return;
          } else {
            resolve({});
            return;
          }
        }
      })
      .catch((err) => {
        var errMsg = "";
        if (
          err.statusCode === 400 &&
          typeof err.message !== "undefined" &&
          err.message
        ) {
          errMsg = err.message.substring(
            err.message.indexOf("[") + 1,
            err.message.lastIndexOf("]")
          );
          try {
            var json = JSON.parse(JSON.parse('"' + errMsg + '"'));
            errMsg = json.description;
          } catch (err) {
            console.error(
              "Could not parse json message: " + '"' + errMsg + '"'
            );
            console.error("error: " + err);
          }
        }
        console.log("POST request failed: " + errMsg);
        reject(new Error(errMsg));
        return;
      });
  });
}

// Returns uuid of the uploaded issue
function uploadIssueToFirebaseDatabase(
  params,
  cityResponse,
  allReqsRef,
  usersRef,
  geofireRef
) {
  return new Promise((resolve, reject) => {
    const service_request_id = cityResponse["service_request_id"]; //might fail for other cities
    const service_notice = cityResponse["service_notice"]
      ? cityResponse["service_notice"]
      : ""; //checking if even there

    // const newIssue  = allReqsRef.push();
    // //Grabbing the unique key generated by the push
    // const newIssueKey = newIssue.key;

    const uuid = uuidv4().toUpperCase();

    var issueFirebaseAddress = allReqsRef.child(uuid);

    //Pushing the new issue to firebase
    issueFirebaseAddress.set({
      addressLine: params.address_string,
      category: params.category,
      city: params.city.toLowerCase(),
      dateClosed: "",
      dateOpen: moment().format(constants.TIME_FORMAT),
      description: params.description,
      lat: parseFloat(params.lat),
      lon: parseFloat(params.long),
      photoURL: params.media_url || "",
      serviceCode: params.service_code,
      serviceName: params.service_name,
      serviceNotice: service_notice,
      serviceRequestID: service_request_id,
      status: "open",
      submittedBy: params.user_id,
    });

    //Pushing the correct relationship to the user list
    var userServiceRequests = usersRef.child(
      params.user_id + "/serviceRequests"
    );
    var newServiceRequestChild = userServiceRequests.push();
    newServiceRequestChild.set(uuid);

    //Pushing the new issue to geofire
    geofireRef
      .set(uuid, [parseFloat(params.lat), parseFloat(params.long)])
      .then(() => {
        resolve(uuid);
        return;
      })
      .catch((err) => {
        reject(new Error(err));
        return;
      });
  });
}

async function checkAndMutateSubmissionParams(params, cityModels) {
  //Required default parameters
  const requiredDefaultParams = [
    "user_id",
    "service_name",
    "service_code",
    //'address_string', not needed since we're always providing lat and long
    "first_name",
    "last_name",
    "client_address", // Will be deleted from the original params later below
    "lat",
    "long",
    "email",
    "phone",
    "description",
    "category",
    "city",
  ];

  for (let index = 0; index < requiredDefaultParams.length; index++) {
    const extractedParam = params[requiredDefaultParams[index]];
    if (typeof extractedParam === "undefined") {
      throw new Error(
        "There is no " +
          requiredDefaultParams[index] +
          " attached to this request"
      );
    }
  }

  const city = params.city.toLowerCase();
  params.city = city;
  if (!helpers.checkIfCityIsAccepted(city)) {
    throw new Error("City is not yet supported by Neappoli");
  }

  if (
    typeof params.attributes !== "undefined" &&
    typeof JSON.parse(params.attributes) === "object"
  ) {
    // Attributes are parsed, meaning they are not a native Object.
    //We have to convert it to a native Object
    params["attributes"] = JSON.parse(params["attributes"]);
  } else {
    throw new Error("There is no attributes array attached to this request");
  }

  try {
    //Grabbing all the required attributes to check
    //If they are present
    const attributes = await getAllIssueAttributesModule.getAllAttributesForIssue(
      params.service_code,
      city,
      cityModels
    );

    var mandatoryParams = [];
    for (let index = 0; index < attributes.length; index++) {
      if (attributes[index].required && attributes[index].variable) {
        mandatoryParams.push(attributes[index]);
      }
    }

    const objectFromParamsAttribute = params.attributes;
    for (var i = 0; i < mandatoryParams.length; i++) {
      if (!(mandatoryParams[i].code in objectFromParamsAttribute)) {
        throw new Error("Missing: " + mandatoryParams[i].code);
      }

      if (
        mandatoryParams[i].datatype === "singlevaluelist" ||
        mandatoryParams[i].datatype === "multivaluelist"
      ) {
        var valuesKeys = {};
        for (
          var valueIndex = 0;
          valueIndex < mandatoryParams[i].values.length;
          valueIndex++
        ) {
          valuesKeys[mandatoryParams[i].values[valueIndex].key] = true;
        }
        if (!(params.attributes[mandatoryParams[i].code] in valuesKeys)) {
          throw new Error(
            "Invalid value received for: " + mandatoryParams[i].code
          );
        }
      }
    }

    //Checking if the city is Ottawa, since they sometimes require an address ID
    if (city === "ottawa") {
      try {
        await replaceAddressStringsToId(params, mandatoryParams);
        // We finished with the client address. Remove it from params
        delete params["client_address"];

        /**
         * TODO check if address_id_req is present. If it is, need to convert it from
         * address_string
         */

        return;
      } catch (e) {
        throw new Error(e);
      }
    }
  } catch (err) {
    console.error("For debug purposes:");
    console.error(params.attributes);
    throw new Error(err);
  }
  // log the user input
}

function replaceAddressStringsToId(params, mandatoryParams) {
  return new Promise((resolveGlobal, rejectGlobal) => {
    /**
			If client_address_info_req is present, it doesn't matter because 
			it ussually comes with either client_address_id_req or client_address_string_req
			which are handled below:
				- client_address_id_req is handled by passing the id itself
				- client_address_string_req should already be appended to the request, by th app

			UPDATE: We only need to pass either client_address_id_req or client_address_string_req
			We don't need to pass both. In that case we won't bother with the address ID because we 
			know that the addresses are not inputted manually: they're returned by APIs.
		*/

    // Find if mandatory params has client_address_string_req and/or  client_address_id_req
    var hasClientAddrIdReq = false;
    var hasClientAddrStrReq = false;

    for (var i = 0; i < mandatoryParams.length; i++) {
      if (mandatoryParams[i].code === "client_address_id_req") {
        hasClientAddrIdReq = true;
      } else if (mandatoryParams[i].code === "client_address_string_req") {
        hasClientAddrStrReq = true;
      }
    }

    // If client_address_string_req is required, make sure it is already passed
    if (hasClientAddrStrReq) {
      const clientAddr = params["attributes"].client_address_string_req;
      // Make sure that clientAddr is not null
      if (clientAddr === null || clientAddr === "") {
        // clientAddr is null
        rejectGlobal(new Error("client_address_string_req was not passed."));
        return;
      }
    }

    if (hasClientAddrIdReq) {
      // client_address_id_req is present
      requestPromise({
        method: "GET",
        //that is the address of the pin
        uri: constants.ottawaAddressToIdEndpoint + params["client_address"],
      })
        .then((response) => {
          const parsedResponse = JSON.parse(response);

          if (typeof parsedResponse["candidates"][0] !== "undefined") {
            // Sort array by scores in descending order
            parsedResponse["candidates"] = sortCandidates(
              parsedResponse["candidates"]
            );

            var found = false;
            for (var j = 0; j < parsedResponse["candidates"].length; j++) {
              const addressCandidate = parsedResponse["candidates"][j];
              if (addressCandidate.score >= 60) {
                params["attributes"].client_address_id_req =
                  addressCandidate.attributes.User_fld;
                found = true;
                break;
              }
            }

            if (found) {
              resolveGlobal();
            } else {
              rejectGlobal(
                new Error(
                  "The address " + params["client_address"] + " is not valid!"
                )
              );
              return;
            }
          } else {
            // There were no items in parsedResponse['candidates']
            rejectGlobal(
              new Error(
                'The address "' +
                  params["client_address"] +
                  '" is not supported for this request. Please try again with a different address or ask for help via email by pressing the "Send feedback" button below.'
              )
            );
            return;
          }
          return;
        })
        .catch((err) => {
          rejectGlobal(new Error(err));
          return;
        });
    } else {
      // client_address_id_req is not present
      resolveGlobal();
    }
  });
}

// Sorts the candidates array in descending order given by the city of ottawa address to ID API
function sortCandidates(candidatesArray) {
  return candidatesArray.sort((a, b) => {
    return b.score - a.score;
  });
}

// Returns a Councillor object in case the lat and lon are in a sponsored ward
// The object is in the form of
// {
//     "name": "First Last",
//     "twitter_handle": "@gtupak",
//     "ward": "Kitchissippi"
// }
function getCouncillorForSR(lat, lon) {
  const point = turf.point([lon, lat]);

  const feature = getGeoFeatureFromCoords(lat, lon);

  if (feature !== null && feature.properties.WARD_NUM === "15") {
    console.log("Reported SR is in Kitchissippi! " + lat + ", " + lon);
    return {
      name: "Jeff Leiper",
      link: constants.IS_DEV
        ? "http://kitchissippiward.ca/"
        : "http://bit.ly/kitchissippi_ward",
      ward: "Kitchissippi",
      photoURL:
        "https://pbs.twimg.com/profile_images/991987088873566209/Zw-pWHwg_400x400.jpg",
    };
  }

  return false;
}

// Returns true if the coords are in ottawa, false otherwise
function coordsInOttawa(lat, lon) {
  const point = turf.point([lon, lat]);

  const feature = getGeoFeatureFromCoords(lat, lon);

  if (feature !== null) {
    return true;
  }

  return false;
}

// Returns the geojson feature from coords, or null if not in Ottawa
function getGeoFeatureFromCoords(lat, lon) {
  const point = turf.point([lon, lat]);

  for (var i = 0; i < wardsGeoJson.features.length; i++) {
    const feature = wardsGeoJson.features[i];
    const polygon = turf.polygon(feature.geometry.coordinates);

    if (turf.booleanPointInPolygon(point, polygon)) {
      return feature;
    }
  }

  return;
}

// The `srDetails` object looks like this:
// {
// 	userId: localParams.user_id,
// 	userEmail: localParams.email,
// 	srId: cityResponseObject['service_request_id'],
// 	addressLine: localParams.address_string,
// 	photoURL: localParams.media_url,
// 	description: localParams.description,
// 	date_time: timeOfSubmission
// }
function sendConfirmationEmailIfNeeded(srDetails, usersRef) {
  // Make sure that user wants to get notified by email
  helpers
    .getUserObject(usersRef, srDetails.userId)
    .then((oUser) => {
      if (oUser === null) {
        console.error(
          "Could not send the confirmation email to user " +
            srDetails.userId +
            ". User could not be found."
        );
        return;
      }

      if (!oUser.profile) {
        throw new Error("User has no profile");
      }

      if (oUser.profile.hasEmailNotifications === false) {
        console.log(
          "User " +
            srDetails.userId +
            " does not want to be notified when a new request is submitted, so will not send one to them."
        );
        return;
      } else {
        emailModule.sendConfirmationEmail(srDetails);
        return;
      }
    })
    .catch((err) => {
      console.error(err);
    });
}
