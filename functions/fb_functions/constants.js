const functions = require("firebase-functions");

exports.acceptedCities = ["ottawa", "toronto"]; // remove this as well, check db instead

exports.ottawaAddressToIdEndpoint =
  "https://city-of-ottawa-dev.apigee.net/gis/v1/findAddressCandidates?outFields=User_fld&f=json&SingleLine=";

exports.serviceRequestImagesPath = "images/serviceRequestPictures/";

exports.TIME_FORMAT = "YYYY-MM-DDTHH:mm:ssZ";

const neappoliApiConfig = functions.config().neappoli_api;

exports.NEAPPOLI_API_KEY = process.env.NEAPPOLI_API_KEY
  ? process.env.NEAPPOLI_API_KEY
  : neappoliApiConfig.neappoli_api_key;

const mailjetConfig = functions.config().mailjet;

exports.MAILJET_PUBLIC_KEY =
  mailjetConfig === undefined ? "" : mailjetConfig.public_key;
exports.MAILJET_PRIVATE_KEY =
  mailjetConfig === undefined ? "" : mailjetConfig.private_key;

// Environment variables contain:
// {
// 	neappoli_api: {
// 		neappoli_api_key: AAA,
// 	},
// 	mailjet: {
// 		public_key: XXX,
// 		private_key: YYY
// 	}
// }

// To set an environment variable, run this in the console:
// firebase functions:config:set neappoli_api.neappoli_api_key="XXX" [etc]

// To fetch an env variable, just do:
// const functions = require('firebase-functions');
// functions.config().neappoli_api.neappoli_api_key

// More info on that at https://firebase.google.com/docs/functions/config-env

exports.IS_DEV = process.env.IS_DEV ? process.env.IS_DEV : false;
exports.IS_LOCAL = process.env.IS_LOCAL ? process.env.IS_LOCAL : false;
