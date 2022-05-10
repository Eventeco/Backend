const express = require("express");
const pool = require("../dbPool");
const { sendError, sendResponse, getEvents } = require("../helper");
const { checkAuthenticated } = require("../middlewares");

const router = express.Router();

//get user past participated events
router.get("/participated", checkAuthenticated, async (req, res) => {
	const userId = req.user.id;
	const query = `SELECT e.id 
	FROM events AS e 
	JOIN eventParticipants as p 
	ON e.id=p.eventId AND p.userId=$1
	WHERE e.deletedAt IS NULL`;

	try {
		const results = await pool.query(query, [userId]);
		const eventIds = results.rows.map((row) => row.id);
		const eventsResult = await getEvents(eventIds);
		sendResponse(res, 200, eventsResult.rows);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

//get user past created events
router.get("/created", checkAuthenticated, async (req, res) => {
	const userId = req.user.id;

	const updatedQuery = `SELECT e.id
	FROM events AS e
	JOIN users AS u ON e.creatorId = u.id AND e.deletedAt IS NULL
	WHERE e.creatorId=$1 AND e.deletedAt IS NULL`;

	try {
		const results = await pool.query(updatedQuery, [userId]);
		const eventIds = results.rows.map((row) => row.id);
		const eventResults = await getEvents(eventIds);
		sendResponse(res, 200, eventResults.rows);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

module.exports = router;
