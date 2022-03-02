const { Pool } = require("pg");
const bcrypt = require("bcrypt");

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

const cryptPassword = (password) => {
	return bcrypt.hash(password, 10);
};

const comparePasswords = (password, hashedPassword) => {
	return bcrypt.compare(password, hashedPassword);
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

const getUserByUsername = async (username) => {
	const result = await pool.query("SELECT * FROM users WHERE username = $1", [
		username,
	]);
	return result.rows[0];
};

const getUserById = async (id) => {
	const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
	return result.rows[0];
};

const checkAuthenticated = (req, res, next) => {
	if (req.isAuthenticated()) {
		return next();
	}
	return sendError(res, 401, "unauthenticated");
};

const checkNotAuthenticated = (req, res, next) => {
	if (req.isUnauthenticated()) {
		return next();
	}
	return sendError(res, 400, "authenticated");
};

const getEventCreator = async (eventId, userId) => {
	const query = `SELECT * FROM events WHERE id = $1 AND creatorid = $2`;
	const result = await pool.query(query, [eventId, userId]);
	return result.rows[0];
};

const checkIsEventCreator = async (req, res, next) => {
	const eventId = req.body.eventId || req.params.eventId;
	const userId = req.user.id;
	try {
		const result = await getEventCreator(eventId, userId);
		if (result) {
			return next();
		}
		return sendError(res, 400, "user is not an event creator");
	} catch (e) {
		return sendError(res, 400, e.message);
	}
};

const checkIsNotEventCreator = async (req, res, next) => {
	const eventId = req.body.eventId || req.params.eventId;
	const userId = req.user.id;
	try {
		const result = await getEventCreator(eventId, userId);
		if (!result) {
			return next();
		}
		return sendError(res, 400, "user is an event creator");
	} catch (e) {
		return sendError(res, 400, e.message);
	}
};

module.exports = {
	sendError,
	sendResponse,
	pool,
	cryptPassword,
	comparePasswords,
	getUserByUsername,
	getUserById,
	checkAuthenticated,
	checkNotAuthenticated,
	checkIsEventCreator,
	checkIsNotEventCreator,
};
