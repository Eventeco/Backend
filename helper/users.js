const format = require("pg-format");
const pool = require("../dbPool");

const getUsers = (userIds = []) => {
	if (userIds.length === 0) {
		return [];
	}
	const query = format(
		`SELECT u.*,
		COUNT(DISTINCT e.id) AS eventsCount,
		ROUND(AVG(r.rating),2) AS averageRating
		FROM users AS u
		LEFT JOIN events AS e ON e.creatorId = u.id AND e.deletedAt IS NULL
		LEFT JOIN userratings AS r ON r.ratedUser = u.id
		WHERE u.id IN (%s)
		GROUP BY u.id`,
		userIds,
	);
	return pool.query(query);
};

const verifyUserPassword = async (userId, password) => {
	const user = await getUserById(userId);
	return await comparePasswords(password, user.password);
};

const doesUserExistByUsername = async (username) => {
	const user = await getUserByUsername(username);
	return user ? true : false;
};

const doesUserExistById = async (id) => {
	const user = await getUserById(id);
	return user ? true : false;
};

const isUserDeletedByUsername = async (username) => {
	const user = await getUserByUsername(username);
	return user.deletedat ? true : false;
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

const isUserDeletedById = async (id) => {
	const user = await getUserById(id);
	return user.deletedat ? true : false;
};

const isUserAdminByUsername = async (username) => {
	const user = await getUserByUsername(username);
	return user.isadmin ? true : false;
};

const getEventCreator = async (eventId, userId) => {
	const query = `SELECT * FROM events WHERE id = $1 AND creatorid = $2`;
	const result = await pool.query(query, [eventId, userId]);
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

module.exports = {
	getUsers,
	verifyUserPassword,
	doesUserExistByUsername,
	doesUserExistById,
	isUserDeletedByUsername,
	getUserByUsername,
	getUserById,
	isUserDeletedById,
	isUserAdminByUsername,
	getEventCreator,
	checkUserHasNotJoinedEventOnSameDay,
};
