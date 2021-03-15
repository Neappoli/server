exports.getUrlFromTitle = (title) => title.replace(/[',?]/g, '').split(' ').join('-');

exports.blogData = [
	{
		title: 'How to Quickly Report a Pothole and Other 311 Incidents in Ottawa',
		description: `Reporting a pothole or any other kind of 311 incident in Ottawa is a breeze with Neappoli. Not only can you report potholes, but also other 311 incidents like garbage collection, when someone parks in a bike lane, bad street lighting, and much much more`,
		category: 'tutorial',
		imageUrl: 'https://www.neappoli.com/static/media/howtoHeaderImg.128691cc.png',
		imageAlt: 'Report potholes with Neappoli'
	},
	{
		title: 'Ottawa Councillor Jeff Leiper Encourages Innovation in Community',
		description: 'Jeff Leiper sponsors Neappoli',
		category: 'news',
		imageUrl: 'https://www.neappoli.com/static/media/kitchissippiImg.0ec8fc63.png',
		imageAlt: 'Councillor Jeff Leiper Sponsors Neappoli'
	}, {
		title: 'Open Data Opens Doors for App Developers',
		description: 'Open Data at the City of Ottawa.',
		category: 'tech',
		imageUrl: 'https://www.neappoli.com/static/media/openDataImg.8f430b95.jpeg',
		imageAlt: 'Ottawa has greatly expanded their open data catalogue over the years.'
	}, {
		title: 'Flutter, A Good Choice for App Development?',
		description: 'Flutter, a fairly new hybrid app development framework, is adopted by Neappoli.',
		category: 'tech',
		imageUrl: 'https://www.neappoli.com/static/media/flutterImg.94b8139a.png',
		imageAlt: 'Flutter'
	}
];
