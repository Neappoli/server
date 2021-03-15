const requestPromise = require('request-promise');

const constants = require('./constants');

// Needed in submitIssue.js
exports.getAllAttributesForIssue = (serviceId, city, cityModels) => {
	return getAllAttributesForIssue(serviceId, city, cityModels);
}

exports.checkIfCityIsAccepted = (city) => {
	return checkIfCityIsAccepted(city);
}

exports.handler = (req, res, cityModels) => {
	if (req.method === 'GET') {
		if (req.query.serviceId && req.query.city) {
			if (checkIfCityIsAccepted(req.query.city)) {
				getAllAttributesForIssue(req.query.serviceId, req.query.city.toLowerCase(), cityModels)
					.then(attributes => {
						res.status(200).send(JSON.stringify(attributes));
						return;
					})
					.catch((err) => {
						const errString = err.toString().replace(/Error:/g, "").trim();
						res.status(500).send({ 'Error': errString });
					})
			} else {
				res.status(501).send({ 'Error': "City not supported by Neappoli" })
			}
		} else {
			res.status(405).send({ 'Error': "Invalid parameters" })
		}
	} else {
		res.status(405).send({ 'Error': 'Method not allowed' })
	}
}

//Will be much more usefull once we have a db with all of our cities in it
//Now we just have an array
function checkIfCityIsAccepted(city) {
	for (var index = 0; index < constants.acceptedCities.length; index++) {
		if (city.toLowerCase() === constants.acceptedCities[index]) {
			return true
		}
	}
	return false;
}

async function getAllAttributesForIssue(serviceId, city, cityModels) {
	var attributeObject = {};

	try {
		const snapshot = await cityModels.child(city).once('value');
		if (!snapshot.exists()) {
			throw new Error("City not found in Neappoli");
		}

		const cityModel = await snapshot.val();

		attributeObject = cityModel['serviceAttributes'];
		const attributeUrl = cityModel['getAttributesExtension'].replace("[serviceRequestID]", serviceId);

		const serviceAttributes = await requestPromise({
			method: 'GET',
			uri: attributeUrl,
			json: true
		});

		if (typeof serviceAttributes.attributes === 'undefined') {
			throw new Error("Attributes are not available for this service request");
		}

		var attributes = [];
		for (serviceAttributeIndex in serviceAttributes.attributes) {
			const serviceAttribute = serviceAttributes.attributes[serviceAttributeIndex];
			if (serviceAttribute.required) {
				var tmpAttributeObject = {};

				tmpAttributeObject['variable'] = serviceAttribute[attributeObject['variable']];
				tmpAttributeObject['code'] = serviceAttribute[attributeObject['code']];
				tmpAttributeObject['datatype'] = serviceAttribute[attributeObject['datatype']];
				tmpAttributeObject['required'] = serviceAttribute[attributeObject['required']];
				tmpAttributeObject['datatypeDescription'] = serviceAttribute[attributeObject['datatype_description']];
				tmpAttributeObject['order'] = serviceAttribute[attributeObject['order']];
				tmpAttributeObject['description'] = serviceAttribute[attributeObject['description']];
				tmpAttributeObject['values'] = serviceAttribute[attributeObject['values']];

				attributes.push(tmpAttributeObject);
			}
		}

		return attributes;

	} catch (err) {
		throw new Error(err);
	}
}