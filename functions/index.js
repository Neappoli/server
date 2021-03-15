const functions = require("firebase-functions");
const admin = require("firebase-admin");
const constants = require("./fb_functions/constants");
require("dotenv").config();

if (constants.IS_LOCAL) {
  if (constants.IS_DEV) {
    // Dev
    const serviceAccount = require("./firebase-service-account-DEV.json");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.DEV_DB_URL,
    });
  } else {
    // Prod
    const serviceAccount = require("./firebase-service-account-PROD.json");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.PROD_DB_URL,
    });
  }
} else {
  // Loads from env variable on the server
  admin.initializeApp();
}

const ref = admin.database().ref();

const openReqsRef = ref.child("serviceRequests/open");
const closedReqsRef = ref.child("serviceRequests/closed");
const allReqsRef = ref.child("serviceRequests/requests");
const cityServiceRequestCategories = ref.child("cityServiceRequestCategories");
const cityModels = ref.child("cities");
const usersRef = ref.child("users");
const kitchStats = ref.child("stats").child("kitchissippi");

const submitIssueModule = require("./fb_functions/submitIssue");
const getAllIssueCategoriesModule = require("./fb_functions/getAllIssueCategories");
const getAllIssueAttributesModule = require("./fb_functions/getAllIssueAttributes");
const statusCheckModule = require("./fb_functions/statusCheck");
const closeSRModule = require("./fb_functions/closeSR");
const emailModule = require("./fb_functions/emails");
const deleteSRModule = require("./fb_functions/deleteSR");
const getSRObjectFromCityIDModule = require("./fb_functions/getSRObjectFromCityID");
const webRequests = require("./fb_functions/webRequests");
const metasInjectionModule = require("./fb_functions/metasInjection");

// Disable expired cert error on dev
// if (constants.IS_DEV) {
// 	process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
// }

// Used by the web interface

exports.getAllOpenSRs = functions.https.onRequest((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  webRequests.getAllOpenSRs(req, res, openReqsRef, allReqsRef);
});

exports.getSr = functions.https.onRequest((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  webRequests.getSr(req, res, allReqsRef);
});

exports.getStats = functions.https.onRequest((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  webRequests.getStats(req, res, openReqsRef, closedReqsRef, usersRef);
});

exports.metasInjection = functions.https.onRequest((req, res) => {
  // if given "/dashboard", path will be "dashboard"
  const path = req.path.substring(1);
  metasInjectionModule.handler(req, res, path, allReqsRef);
});

// Transactional emails / NEWSLETTER

exports.mailchimpUpdateSubscription = functions.https.onRequest((req, res) => {
  emailModule.mailchimpUpdateSubscription(req, res, usersRef);
});

exports.sendWelcomeEmail = functions.auth.user().onCreate((user) => {
  // Returns true if email has been sent
  return emailModule.sendWelcomeEmail(user);
});

// Used by the APP

exports.submitIssue = functions.https.onRequest((req, res) => {
  submitIssueModule.handler(
    req,
    res,
    admin,
    cityModels,
    allReqsRef,
    usersRef,
    openReqsRef,
    kitchStats
  );
});

exports.getAllIssueCategories = functions.https.onRequest((req, res) => {
  getAllIssueCategoriesModule.handler(
    req,
    res,
    cityServiceRequestCategories,
    cityModels
  );
});

exports.getIssueAttributes = functions.https.onRequest((req, res) => {
  getAllIssueAttributesModule.handler(req, res, cityModels);
});

exports.statusCheck = functions.https.onRequest((req, res) => {
  statusCheckModule.handler(
    req,
    res,
    openReqsRef,
    closedReqsRef,
    allReqsRef,
    cityModels,
    usersRef,
    admin
  );
});

// Used for DEVELOPMENT

// Used for development purposes to close an issue. Pass the UUID in the URL
exports.closeSR = functions.https.onRequest((req, res) => {
  closeSRModule.handler(
    req,
    res,
    openReqsRef,
    closedReqsRef,
    allReqsRef,
    usersRef,
    admin
  );
});

exports.deleteSR = functions.https.onRequest((req, res) => {
  deleteSRModule.handler(
    req,
    res,
    allReqsRef,
    openReqsRef,
    closedReqsRef,
    usersRef
  );
});

exports.getSRObjectFromCityID = functions.https.onRequest((req, res) => {
  getSRObjectFromCityIDModule.handler(req, res, allReqsRef, usersRef);
});
