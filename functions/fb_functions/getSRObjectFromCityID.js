const constants = require("./constants");
const bluebird = require("bluebird");

exports.handler = (req, res, allReqsRef, usersRef) => {
  if (req.method !== "GET") {
    res.status(400).send("This endpoint only supports GET requests");
    return;
  }

  const secret = req.query.secret;
  if (!secret) {
    res.status(400).send("What is the secret?");
    return;
  } else if (secret !== constants.NEAPPOLI_API_KEY) {
    res
      .status(400)
      .send("You do not know the Secret, young Padawan. Contact the Masters");
    return;
  }

  const cityIDsToQuery = req.query.requestIds;
  if (!cityIDsToQuery) {
    res
      .status(400)
      .send("You must pass an array of 'requestIds' as a parameter.");
    return;
  } else if (!Array.isArray(cityIDsToQuery)) {
    res.status(400).send("The parameter 'requestIds' must be an array.");
    return;
  }

  // Find all the SR objects
  getSRObjectsOfIds(cityIDsToQuery, allReqsRef)
    .then((srArray) => {
      return bluebird.Promise.map(srArray, (sr) => {
        return usersRef
          .child(sr.submittedBy)
          .once("value")
          .then((snapshot) => {
            if (typeof snapshot.val().profile === "undefined") {
              console.log(snapshot.val());
              throw Error("Erroneous SR with uuid " + sr.key);
            }

            const userId = snapshot.key;
            sr.submittedBy = {
              userId: userId,
              email: snapshot.val().profile.email,
            };

            return sr;
          });
      });
    })
    .then((srsWithUserInfo) => {
      const result = {
        serviceRequests: srsWithUserInfo,
      };

      res.status(200).send(result);
      return;
    })
    .catch((error) => {
      res.status(500).send("Error: " + error);
    });
};

function getSRObjectsOfIds(cityIDsToQuery, allReqsRef) {
  return allReqsRef
    .once("value")
    .then((snapshot) => {
      var serviceRequests = [];

      snapshot.forEach((childSnapshot) => {
        var sr = childSnapshot.val();
        if (cityIDsToQuery.includes(sr.serviceRequestID)) {
          sr.key = childSnapshot.key;
          serviceRequests.push(sr);
        }
      });

      return Promise.all(serviceRequests);
    })
    .catch((error) => {
      console.error("Error in getSRObjectsOfIds(): " + error);
    });
}
