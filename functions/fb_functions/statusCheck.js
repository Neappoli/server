const requestPromise = require('request-promise');
const Q = require('q');
const moment = require('moment');

const constants = require('./constants');
const helpersModule = require('./helpers');
const emailModule = require('./emails');

exports.handler = (req, res, openReqsRef, closedReqsRef, allReqsRef, cityModels, usersRef, admin) => {
	var openReqsDict = {}

	// Get all the open requests
	getOpenRequests(openReqsRef)
		.then(openReqsFromDb => {
			return getFullSRFromOpenReqs(openReqsFromDb, allReqsRef)
		})
		.then(fullOpenRqsResult => {
			openReqsDict = fullOpenRqsResult.dict
			return getClosedCityReqIDsFromOpenReqs(fullOpenRqsResult, cityModels)
		})
		.then(closedCityReqIDs => {
			if (closedCityReqIDs.length !== 0) {
				console.log('Recently closed requests:', closedCityReqIDs);
			}
			var foundError = false

			// move service request to closed
			closedCityReqIDs.forEach(closedSrId => {
				console.log('closedSrId', closedSrId)
				console.log('openReqsDict', openReqsDict)
				var fullClosedRequest = openReqsDict[closedSrId]
				var uuid = fullClosedRequest.uuid
				var userID = fullClosedRequest.serviceRequest.submittedBy

				console.log('uuid:', uuid)
				helpersModule.updateSRStatusAndDate(uuid, 'closed', allReqsRef)
					.then(successMsg => {
						helpersModule.moveDbChild(openReqsRef.child(uuid), closedReqsRef.child(uuid));

						// Check if user wants push notifications
						helpersModule.getUserObject(usersRef, userID)
							.then(user => {
								if (user === null) {
									throw Error('Tried to send a message to user ' + userID + ' but could not find user.');
								}

								// If user.profile.hasPushNotifications is undefined, it means the profile is old
								// and simply doesn't have the "hasPushNotifications" property. In that case, we still
								// send a message to them.
								if (typeof user.profile.hasPushNotifications === 'undefined' || user.profile.hasPushNotifications === true) {
									helpersModule.sendMessageToUser(userID, fullClosedRequest.serviceRequest.serviceName, usersRef, admin);
								}

								// If user.hasEmailNotifications is true, send email notification
								if (user.profile.hasEmailNotifications !== false) {
									emailModule.sendClosedSREmail({
										description: fullClosedRequest.serviceRequest.description,
										srId: fullClosedRequest.serviceRequest.serviceRequestID,
										date_open: moment(fullClosedRequest.serviceRequest.dateOpen).format('MMMM Do YYYY, h:mm a'),
										date_close: moment(fullClosedRequest.serviceRequest.dateClosed).format('MMMM Do YYYY, h:mm a'),
										addressLine: fullClosedRequest.serviceRequest.addressLine,
										photoURL: fullClosedRequest.serviceRequest.photoURL === null ? '' : fullClosedRequest.serviceRequest.photoURL,
										userEmail: user.profile.email
									});
								}

								return;
							})
							.catch(error => {
								console.error(error);
							});

						return true
					})
					.catch(error => {
						console.error(error)
						foundError = true
					})
			})

			if (foundError) {
				throw new Error('One or more errors occured when handling issues to close.')
			}

			res.status(200).send('success!')
			return
		})
		.catch(error => {
			console.error('Caught error', error)
			res.status(500).send('An error has occured. Check the logs for detail.')
		});
}

function getOpenRequests(openReqsRef) {
	var deferred = Q.defer()

	openReqsRef.once('value', openReqsSnap => {
		deferred.resolve(openReqsSnap.val())
	})

	return deferred.promise
}

function getFullSRFromOpenReqs(openReqsFromDb, allReqsRef) {
	var deferred = Q.defer()
	var openReqsDict = {}
	var openReqIDs = []
	var nrChildrenQueried = 0

	for (const openReqKey in openReqsFromDb) {
		if (!(openReqKey in openReqsFromDb)) continue;

		allReqsRef.child(openReqKey).once('value', openReqSnap => {
			// console.log('got child:', openReqKey)
			const fullOpenReq = openReqSnap.val()
			if (fullOpenReq) {
				// console.log('child:', openReqKey, 'snap:', fullOpenReq)
				// console.log('fullOpenReq:', fullOpenReq)
				var srID = fullOpenReq.serviceRequestID
				openReqsDict[srID] = {
					uuid: openReqKey,
					serviceRequest: fullOpenReq
				}
				openReqIDs.push(srID)
			}

			nrChildrenQueried++

			if (nrChildrenQueried === Object.keys(openReqsFromDb).length) {
				deferred.resolve({ dict: openReqsDict, ids: openReqIDs })
			}
		}, error => {
			console.log('error for child:', openReqKey, error)
		})
	}

	return deferred.promise
}

function getClosedCityReqIDsFromOpenReqs(openReqsDict, cityModels) {
	var deferred = Q.defer()

	var openRqsDict = openReqsDict.dict
	var openReqIDs = openReqsDict.ids
	var closedReqsIDs = []

	for (var i = 0, p = Promise.resolve(i); i < constants.acceptedCities.length - 1; i++) {
		p = p.then((i) => new Promise((resolve, reject) => {
			//TODO: Change to constants.acceptedCities.length when Toronto is fully setup
			cityModels.child(constants.acceptedCities[i])
				.once('value')
				.then(snapshot => {
					if (snapshot.exists()) {
						return snapshot.val();
					}
					else {
						reject(new Error("City not found in Neappoli"));
						return;
					}
				})
				.then(cityModel => {
					// Check new status by querying the city
					return requestPromise({
						method: 'GET',
						uri: (constants.IS_DEV ? cityModel['postServiceRequestExtensionDev'] : cityModel['postServiceRequestExtensionProd']),
						qs: {
							service_request_id: openReqIDs.join(',')
						},
						json: true
					})
				})
				.then(cityServiceRequests => {

					cityServiceRequests.forEach(cityServiceRequest => {
						if (cityServiceRequest.status.toLowerCase() === 'closed') {
							var srID = cityServiceRequest.service_request_id
							console.log('Service request id: ' + srID + ' was open and now is closed!')
							closedReqsIDs.push(srID)
						}
					})

					if (i === constants.acceptedCities.length - 2) {
						//TODO: make sure that Toronto service Requests are also closed when Toronto is fully setup
						deferred.resolve(closedReqsIDs)
						return true;
					}
					else {
						resolve(++i);
						return;
					}
				})
				.catch(err => {
					deferred.reject('Error while getting statusses of open requests from the cities ' + err);
					return;
				})
		}));
	}
	return deferred.promise
}