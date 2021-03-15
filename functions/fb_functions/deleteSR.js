const constants = require('./constants');

exports.handler = (req, res, allReqsRef, openReqsRef, closedReqsRef, usersRef) => {
	if (req.method !== 'DELETE') {
		res.status(400).send('This endpoint only supports DELETE requests.');
		return;
	}

	const secret = req.query.secret;
	if (!secret) {
		res.status(400).send('What is the Secret?');
		return;
	} else if (secret !== constants.DELETE_SR_SECRET) {
		res.status(400).send('You do not know the Secret, young Padawan. Contact the Masters.');
		return;
	}

	const uuid = req.query.uuid;
	if (!uuid) {
		res.status(400).send('You must pass the \'uuid\' as a parameter.');
		return;
	}

	// Get owner of this SR to remove its reference
	allReqsRef.once('value', snapshot => {
		if (!snapshot.hasChild(uuid)) {
			console.log('Cannot find SR in all SRs!');
			return;
		}

		// Get SR details
		return allReqsRef.child(uuid).once('value', snapshot => {
			const userID = snapshot.val().submittedBy;

			// Look if user exists
			return usersRef.once('value', snapshot => {

				if (!snapshot.hasChild(userID)) {
					console.log('User with ID '+userID+' was not found. Could not delete its SR reference.');
					return;
				}

				// Delete reference to SR id from the user
				// Super hacky, but seems to be the only way
				deleteArrayItem(usersRef.child(userID), uuid);
			});
		});
	})
	.then(() => {
		// Remove from allSRs
		return removeFromRef(allReqsRef, uuid, 'all SRs');
	})
	.then(() => {
		// Remove from open SRs
		return removeFromRef(openReqsRef, uuid, 'open SRs');
	})
	.then(() => {
		// Remove from closed SRs
		return removeFromRef(closedReqsRef, uuid, 'closed SRs');
	})
	.then(() => {
		res.status(200).send('Successfully deleted SR from Open, Closed, All SR and reference from its author.');
		return;
	})
	.catch(error => {
		console.error('Error in deleteSR: '+error);
	});
}

function removeFromRef(dbRef, uuid, refDescription) {
	return dbRef.once('value', snapshot => {
		if (!snapshot.hasChild(uuid)) {
			return;
		}

		// uuid exists
		return dbRef.child(uuid).remove()
		.then(() => {
			console.log('Remove from '+refDescription+' succeeded!');
			return null;
		})
		.catch(error => {
			console.log('Remove from '+refDescription+' failed: '+error.message);
		});
	});
}

// Hacky way to delete an item from an fb database array
// Based on https://stackoverflow.com/a/49893535
function deleteArrayItem(userDBRef, uuid) {
    var query = userDBRef.child('serviceRequests').orderByKey();

    query.once('value', snapshot => {
		snapshot.forEach(function(childSnapshot) {
			var pkey = childSnapshot.key; 
			var chval = childSnapshot.val();

			//check if remove this child
			if (chval === uuid){
				userDBRef.child("serviceRequests/"+pkey).remove();
				console.log('Deleted reference of SR with uuid '+uuid+' from its author');
				return true;
			}
		});
    });
}