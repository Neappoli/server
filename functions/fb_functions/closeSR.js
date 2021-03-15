const helpersModule = require('./helpers');
const constants = require('./constants');

exports.handler = (req, res, openReqsRef, closedReqsRef, allReqsRef, usersRef, admin) => {
	if (req.method !== 'GET') {
		res.status(400).send('This endpoint only supports GET requests.');
		return;
	}

	const secret = req.query.secret;
	if (!secret) {
		res.status(400).send('What is the Secret?');
		return;
	} else if (secret !== constants.CLOSE_SR_SECRET) {
		res.status(400).send('You do not know the Secret. Contact the admins.');
		return;
	}

	const uuid = req.query.uuid;
	if (!uuid) {
		res.status(400).send('You must pass the \'uuid\' as a parameter.');
		return;
	}

	// Check if uuid exists in closed
	openReqsRef.once('value', snapshot => {
		if (snapshot.hasChild(uuid)) {
			// Request found
			helpersModule.moveDbChild(openReqsRef.child(uuid), closedReqsRef.child(uuid));
			helpersModule.updateSRStatusAndDate(uuid, 'closed', allReqsRef)

			// Send request to user
			allReqsRef.child(uuid).once('value', requestSnapshot => {
				const fullSR = requestSnapshot.val();
				if (!fullSR) {
					res.status(500).send('Could not find full SR in database with uuid ' + uuid);
					return;
				}

				const userId = fullSR.submittedBy;
				if (!userId) {
					res.status(500).send('Could not find \'submittedBy\' in SR with uuid ' + uuid);
					return;
				}

				helpersModule.sendMessageToUser(userId, fullSR.serviceName, usersRef, admin);
				res.status(200).send('Issue successfully closed.');
			});
		} else {
			res.status(404).send('SR with uuid ' + uuid + ' could not be found in the open requests node.');
		}
	});
}