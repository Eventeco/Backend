const { Pool, Client } = require("pg");

const sendError = (res, status, message) => {
	res.status(status).send({ success: false, message: message });
};

const sendResponse = (res, status, data = null) => {
	if (status == 204) {
		res.status(status).send();
		return;
	}
	let responseObject = { success: true };
	if (data) {
		responseObject = { ...responseObject, data };
	}
	res.status(status).send(responseObject);
};

const cryptPassword = function (password, callback) {
	bcrypt.genSalt(10, function (err, salt) {
		if (err) return callback(err);

		bcrypt.hash(password, salt, function (err, hash) {
			return callback(err, hash);
		});
	});
};

const comparePassword = function (plainPass, hashword, callback) {
	bcrypt.compare(plainPass, hashword, function (err, isPasswordMatch) {
		return err == null ? callback(null, isPasswordMatch) : callback(err);
	});
};

const pool = new Pool({
	user: "hccefepojnhevc",
	host: "ec2-3-223-72-172.compute-1.amazonaws.com",
	database: "d68r71pptpoun0",
	password: "63c90506bdd2b27b82dbdd7280fc37046e64010d6ff96042a12f2c90020b455c",
	port: 5432,
	ssl: {
		rejectUnauthorized: false,
	},
});

module.exports = {
	sendError,
	sendResponse,
	pool,
	cryptPassword,
	comparePassword,
};
