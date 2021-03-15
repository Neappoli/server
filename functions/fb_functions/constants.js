const functions = require("firebase-functions");

exports.acceptedCities = ["ottawa", "toronto"]; // remove this as well, check db instead

exports.ottawaAddressToIdEndpoint =
  "https://city-of-ottawa-dev.apigee.net/gis/v1/findAddressCandidates?outFields=User_fld&f=json&SingleLine=";

exports.serviceRequestImagesPath = "images/serviceRequestPictures/";

exports.TIME_FORMAT = "YYYY-MM-DDTHH:mm:ssZ";

const neappoliApiConfig = functions.config().neappoli_api;

exports.CLOSE_SR_SECRET =
  neappoliApiConfig === undefined ? "" : neappoliApiConfig.close_sr_secret;
exports.DELETE_SR_SECRET =
  neappoliApiConfig === undefined ? "" : neappoliApiConfig.delete_sr_secret;
exports.GET_SR_BY_ID_SECRET =
  neappoliApiConfig === undefined ? "" : neappoliApiConfig.get_sr_by_id_secret;

const mailjetConfig = functions.config().mailjet;

exports.MAILJET_PUBLIC_KEY =
  mailjetConfig === undefined ? "" : mailjetConfig.public_key;
exports.MAILJET_PRIVATE_KEY =
  mailjetConfig === undefined ? "" : mailjetConfig.private_key;

// Environment variables contain:
// {
// 	neappoli_api: {
// 		close_sr_secret: AAA,
// 		delete_sr_secret: BBB,
// 		get_sr_by_id_secret: CCC
// 	},
// 	mailjet: {
// 		public_key: XXX,
// 		private_key: YYY
// 	}
// }

// To set an environment variable, run this in the console:
// firebase functions:config:set neappoli_api.close_sr_secret="XXX" neappoli_api.delete_sr_secret="YYY" [etc]

// To fetch an env variable, just do:
// const functions = require('firebase-functions');
// functions.config().neappoli_api.close_sr_secret

// More info on that at https://firebase.google.com/docs/functions/config-env

exports.IS_DEV = process.env.IS_DEV ? process.env.IS_DEV : false;
exports.IS_LOCAL = process.env.IS_LOCAL ? process.env.IS_LOCAL : false;
