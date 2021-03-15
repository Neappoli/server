const Q = require('q');
const constants = require('./constants');
const moment = require('moment');

exports.moveDbChild = (oldRef, newRef) => {
	oldRef.once('value', snap => {
		newRef.set(snap.val(), error => {
			if (!error) { oldRef.remove(); }
			else if (typeof (console) !== 'undefined' && console.error) { console.error(error); }
		});
	});
}

exports.objectToFormattedString = (obj) => {
	let res = '';
	try {
		for (const key of Object.keys(obj)) {
			res += key + ':' + obj[key];
			res += '\n';
		}
	} catch (e) {
		console.error(e);
	}
	return res;
}

exports.sendMessageToUser = (userID, serviceName, usersRef, admin) => {
	usersRef.child(userID).once('value', snap => {
		var regTok = snap.val().profile.registrationToken
		var msg = {
			token: regTok,
			notification: {
				title: 'One of your submitted issues has been closed!',
				body: serviceName
			}
		}

		console.log('sending to', regTok)

		// admin.messaging().sendToDevice(regTok, msg)
		admin.messaging().send(msg)
			.then(response => {
				console.log('Successfully sent message', response)
				return true;
			})
			.catch(error => {
				console.error('Error sending message:', error)
			})
	})
}

exports.updateSRStatusAndDate = (uuid, status, allReqsRef) => {
	var deferred = Q.defer()

	var srNode = allReqsRef.child(uuid)
	if (srNode === undefined) {
		deferred.reject('Unable to find service request with UUID ' + uuid)
	}

	srNode.child('status').set(status, (error) => {
		if (error) {
			deferred.reject(new Error('Error raised when trying to set status of uuid ' + uuid + ': ' + error))
		} else {
			srNode.child('dateClosed').set(moment().format(constants.TIME_FORMAT), error => {
				if (error) {
					deferred.reject(new Error('Error raised when trying to set the closed date of SR uuid: ' + uuid + ': ' + error))
				} else {
					deferred.resolve('Success setting status and closed date of ' + uuid + ' to ' + status)
				}
			})
		}
	})

	return deferred.promise
}

exports.copyDbRecord = (oldRef, newRef) => {
	oldRef.once('value', snap => {
		newRef.set(snap.val(), error => {
			if (error && typeof (console) !== 'undefined' && console.error) { console.error(error); }
		});
	});
}

// Returns a promise that will contain the user object from the DB,
// or null if it doesn't exist
exports.getUserObject = (usersRef, uid) => {
	return usersRef.child(uid).once('value').then(snapshot => {
		if (snapshot.exists()) {
			return snapshot.val();
		}
		return null;
	});
}

exports.checkIfCityIsAccepted = (city) => {
	for (var index = 0; index < constants.acceptedCities.length; index++) {
		if (city.toLowerCase() === constants.acceptedCities[index]) {
			return true
		}
	}
	return false;
}