require("dotenv").config();
const bcrypt = require("bcrypt");
const pool = require("./dbPool");
const s3Client = require("./config/S3");
const {
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const randomstring = require("randomstring");
const format = require("pg-format");

const BUCKET = process.env.AWS_BUCKET_NAME;

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

const isUserDeletedByUsername = async (username) => {
	const user = await getUserByUsername(username);
	return user.deletedat ? true : false;
};

const isUserAdminByUsername = async (username) => {
	const user = await getUserByUsername(username);
	return user.isadmin ? true : false;
};

//put image in bucket
const s3PutBase64Image = async (base64) => {
	const buffer = Buffer.from(base64, "base64");
	const extensions = { "/": "jpg", i: "png", R: "gif", U: "webp" };
	const extension = extensions[base64.charAt(0)];
	const key = `${randomstring.generate()}.${extension}`;
	const uploadParams = {
		Bucket: BUCKET,
		Key: key,
		Body: buffer,
	};
	const command = new PutObjectCommand(uploadParams);
	await s3Client.send(command);
	return key;
};

//get image from s3 bucket
const s3GetImage = async (key) => {
	const getParams = {
		Bucket: BUCKET,
		Key: key,
	};
	const command = new GetObjectCommand(getParams);
	const response = await s3Client.send(command);
	return response;
};

//delete image from s3 bucket
const s3DeleteImage = async (key) => {
	const deleteParams = {
		Bucket: BUCKET,
		Key: key,
	};
	const command = new DeleteObjectCommand(deleteParams);
	const response = await s3Client.send(command);
	return response;
};

const getEvents = (eventIds = []) => {
	if (eventIds.length === 0) {
		return [];
	}
	const query = format(
		`SELECT e.*, json_agg(u) -> 0 AS user,
					COALESCE(json_agg(DISTINCT i) FILTER (WHERE i.id IS NOT NULL), '[]') AS issues,
					COALESCE(json_agg(DISTINCT jsonb_build_object('id', er.id, 'rule', er.rule)) FILTER (WHERE er.id IS NOT NULL), '[]') AS rules,
					COALESCE(json_agg(DISTINCT ep) FILTER (WHERE ep.id IS NOT NULL), '[]') AS pictures,
					COUNT(DISTINCT evp.*) AS participantsCount
					FROM events AS e
					JOIN users AS u ON e.creatorId = u.id AND e.deletedAt IS NULL
					LEFT JOIN eventRules AS er ON er.eventId = e.id
					LEFT JOIN eventParticipants AS evp ON evp.eventId = e.id
					LEFT JOIN eventPictures AS ep ON ep.eventId = e.id
					LEFT JOIN addressedIssues AS a ON a.eventId = e.id
					JOIN issuetypes AS i ON a.issuetypeid = i.id
					WHERE e.id IN (%s)
					GROUP BY e.id
					ORDER BY e.createdAt DESC`,
		eventIds,
	);

	return pool.query(query);
};

const getUsers = (userIds = []) => {
	if (userIds.length === 0) {
		return [];
	}
	const query = format(
		`SELECT u.*,
		COUNT(DISTINCT e.id) AS eventsCount 
		FROM users AS u
		LEFT JOIN events AS e ON e.creatorId = u.id AND e.deletedAt IS NULL
		WHERE u.id IN (%s)
		GROUP BY u.id`,
		userIds,
	);
	return pool.query(query);
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
	isUserDeletedByUsername,
	s3PutBase64Image,
	s3GetImage,
	s3DeleteImage,
	getEvents,
	getUsers,
	isUserAdminByUsername,
};
