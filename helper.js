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

const getEvent = async (eventId) => {
	const query = `SELECT * FROM events WHERE id = $1`;
	const result = await pool.query(query, [eventId]);
	return result.rows[0];
};

const getUserJoinedPendingEvents = async (userId) => {
	const query = `SELECT e.* 
		FROM events AS e 
		JOIN eventparticipants AS ep 
		ON e.id = ep.eventid AND ep.userid = $1 AND ep.didattend IS NULL`;

	const result = await pool.query(query, [userId]);
	return result.rows;
};

const getDate = (date) => {
	return new Date(date).toISOString().split("T")[0];
};

const checkUserHasNotJoinedEventOnSameDay = async (eventId, userId) => {
	const userEvents = await getUserJoinedPendingEvents(userId);
	if (userEvents.length === 0) {
		return true;
	}
	const eventToJoin = await getEvent(eventId);
	const eventToJoinDate = getDate(eventToJoin.starttime);

	for (let currEvent of userEvents) {
		if (getDate(currEvent.starttime) === eventToJoinDate) {
			return false;
		}
	}

	return true;
};

const verifyUserPassword = async (userId, password) => {
	const user = await getUserById(userId);
	return await comparePasswords(password, user.password);
};

module.exports = {
	sendError,
	sendResponse,
	cryptPassword,
	comparePasswords,
	getUserByUsername,
	getUserById,
	getEventCreator,
	checkUserHasNotJoinedEventOnSameDay,
	verifyUserPassword,
};
