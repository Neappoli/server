const _ = require('lodash');
const blogDataModule = require('./blogData');

// This is mostly from https://hackernoon.com/firebase-to-the-rescue-dynamic-routing-via-hosting-functions-integration-aef888ddf311
exports.handler = async (req, res, path, allReqsRef) => {
	// Returns what comes after the first slash. Ex: blog/asdf will return asdf
	function getAfterSlash(string) {
		return string.indexOf('/') === -1
			? ''
			: string.substring(string.indexOf('/') + 1);
	}

	const pinId = getAfterSlash(path)
	if (!pinId) {
		res.status(404).send('Error 404: Page not found')
		return;
	}

	let htmlString = await getDashboardHtml(getAfterSlash(pinId), allReqsRef);

	res.send(htmlString);
};

// Path would be either just 'dashboard' or 'dashboard/id'
async function getDashboardHtml(pinId, allReqsRef) {
	if (!pinId) return '';

	let hasImg = false;

	let title, description, imgUrl;
	const snap = await allReqsRef.child(pinId).once('value');
	const sr = snap.val();
	if (!sr) return '';

	title = sr.serviceName;
	description = sr.description;
	imgUrl = sr.photoURL;
	hasImg = imgUrl ? true : false;

	let meta = [
		{ name: 'description', content: description },
		{ property: 'og:title', content: title },
		{ property: 'og:description', content: description },
		{ property: 'og:site_name', content: 'www.neappoli.com/dashboard' },
		{ name: 'twitter:title', content: title },
		{ name: 'twitter:description', content: description }
	];

	if (imgUrl) {
		meta.push({ property: 'og:image', content: imgUrl });
		meta.push({ property: 'og:image:alt', content: description });
		meta.push({ name: 'twitter:image', content: imgUrl });
		meta.push({ name: 'twitter:image:alt', content: description });
	}

	const head = {
		title: title,
		meta: meta
	};

	return getHtmlWithInjections(head, 'srId=' + pinId, hasImg);
}

/*
	head must contain the following schema:
{
    title: title,
		 description: description,
    meta: [
      // This may not be a valid combination of tags for the services you need to support;
      // they're only shown here as an example.
      { property: 'og:title', content: title },
      { property: 'og:description', content: post.description },
      { property: 'og:image', content: post.imageURL },
      { property: 'twitter:title', content: title },
      { property: 'twitter:description', content: post.description },
      { property: 'twitter:image', content: post.imageURL }
    ],
    link: [
      { rel: 'icon', 'href': 'https://www.neappoli.com/favicon.png' },
    ],
 }
 */
function getHtmlWithInjections(head, path, alreadyHasImg = false) {

	// Creates tags based on the above header const.
	var string = '<!DOCTYPE html><head>';
	Object.keys(head).forEach(key => {
		if (typeof head[key] === 'string')
			string += '<' + key + '>' + head[key] + '</' + key + '>';
		else if (Array.isArray(head[key])) {
			for (const obj of head[key]) {
				string += '<' + key;
				Object.keys(obj).forEach(key2 => {
					string += ' ' + key2 + '="' + obj[key2] + '"';
				});
				string += '>';
			}
		}
	});

	string += '<meta property="fb:app_id" content="216245242332948" />';
	if (!alreadyHasImg) {
		string += '<meta property="og:image" content="https://www.neappoli.com/ogImage.jpg" />';
		string += '<meta property="og:image:alt" content="You shouldn\'t have to call to report a city issue. Use Neappoli instead." />';
		string += '<meta name="twitter:image" content="https://www.neappoli.com/ogImage.jpg" />';
		string += '<meta name="twitter:image:alt" content="Submit any 311 related issues in Ottawa. Neappoli is a mobile app that allows you to report city issues in a few taps. Try it today!" />';
	}
	string += '<meta property="fb:admins" content="1052857808196407" />';

	// Twitter
	string += '<meta name="twitter:card" content="summary_large_image" />';
	string += '<meta name="twitter:site" content="@neappoli" />';

	string += '</head><body>';
	string += '<script>window.location="https://www.neappoli.com/dashboard/?' + path + '";</script>';
	string += '</body></html>';

	return string;
}