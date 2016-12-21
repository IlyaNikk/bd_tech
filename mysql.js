'use strict';

let mysql = require('promise-mysql');
let connection;

exports.getConnection = function () {
	return new Promise(function (resolve, reject) {
		if (connection) {
			resolve(connection);
		} else {
			mysql
				.createConnection({
					host: 'localhost',
					user: 'root',
					password: 'Computer1',
					database: 'forum',
					waitForConnections: true
				})
				.then(conn => {
					connection = conn;
					resolve(conn);
				})
				.catch(reject);
		}
	});
};
