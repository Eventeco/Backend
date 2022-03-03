const bcrypt = require("bcrypt");
const pool = require("./dbPool");

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

const getEventCreator = async (eventId, userId) => {
	const query = `SELECT * FROM events WHERE id = $1 AND creatorid = $2`;
	const result = await pool.query(query, [eventId, userId]);
	return result.rows[0];
};

module.exports = {
	sendError,
	sendResponse,
	cryptPassword,
	comparePasswords,
	getUserByUsername,
	getUserById,
	getEventCreator,
};
