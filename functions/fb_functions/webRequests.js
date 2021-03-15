var _ = require('lodash');

exports.getAllOpenSRs = (req, res, openReqsRef, allReqsRef) => {
	// Get all open reqs
	openReqsRef.once('value', snap => {
		const srIds = Object.keys(snap.val());

		allReqsRef.once('value', snap => {
			const allSrs = snap.val();
			const onlyOpenSrs = _.pick(allSrs, srIds);
			
			const resultArr = _.values(_.mapValues(onlyOpenSrs, (sr, key) => {
				sr.id = key; 
				return sr; 
			}));
			res.send(resultArr);
			console.log(`Returned ${resultArr.length} SRs.`);
		});
	});
};

exports.getSr = (req, res, allReqsRef) => {
	if (!req.query.id) {
		res.status(400).send({ error: 'The request id is missing' });
		return;
	}

	const id = req.query.id;
	allReqsRef.child(id).once('value', snap => {
		const sr = snap.val();

		if (!sr) {
			res.status(400).send({ error: 'Could not find SR with the given id.' });
			return;
		}

		res.send({ ...sr, id });
	});
};

exports.getStats = (req, res, openReqsRef, closedReqsRef, usersRef) => {
	let result = {};

	// Get nr of open requests
	openReqsRef.once('value')
	.then(snap => {
		result.currentlyOpen = snap.numChildren();
		return closedReqsRef.once('value');
	})
	.then(snap => {
		result.currentlyClosed = snap.numChildren();
		return usersRef.once('value');
	})
	.then(snap => {
		result.accsOpen = snap.numChildren();
		res.send(result);
		return;
	})
	.catch(err => {
		res.status(500).send({error: err});
	});
}