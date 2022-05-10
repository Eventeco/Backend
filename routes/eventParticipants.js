const express = require("express");
const { sendResponse, sendError } = require("../helper");
const pool = require("../dbPool");
const {
	checkIsEventCreator,
	checkIsNotEventCreator,
	checkAuthenticated,
} = require("../middlewares");

const router = express.Router();

//get all participants by event id
router.get(
	"/:eventId",
	[checkAuthenticated, checkIsEventCreator],
	async (req, res) => {
		const { eventId } = req.params;
		const query = `SELECT u.* FROM eventparticipants AS ep JOIN users AS u ON u.id = ep.userid AND ep.eventId = $1`;
		try {
			const result = await pool.query(query, [eventId]);
			sendResponse(res, 200, result.rows);
		} catch (e) {
			sendError(res, 400, e.message);
		}
	},
);

//get count of participants by event id
router.get("/count/:eventId", checkAuthenticated, async (req, res) => {
	const { eventId } = req.params;
	const query = `SELECT COUNT(*) AS count FROM eventparticipants WHERE eventid = $1`;
	try {
		const result = await pool.query(query, [eventId]);
		sendResponse(res, 200, result.rows[0]);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

router.get("/isParticipant/:eventId", checkAuthenticated, async (req, res) => {
	const { eventId } = req.params;
	const userId = req.user.id;
	const query = `SELECT * FROM eventparticipants WHERE eventid = $1 AND userid = $2`;
	try {
		const result = await pool.query(query, [eventId, userId]);
		if (result.rows.length > 0) {
			sendResponse(res, 200, true);
		} else {
			sendResponse(res, 200, false);
		}
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

//add participant to event by eventId and userId
router.post(
	"/",
	[checkAuthenticated, checkIsNotEventCreator],
	async (req, res) => {
		const { eventId } = req.body;
		const userId = req.user.id;
		const getMaxParticipantQuery = `SELECT maxparticipants FROM events WHERE id = $1`;
		const getCurrentParticipantsQuery = `SELECT COUNT(*) AS count FROM eventparticipants WHERE eventid = $1`;
		const query = `INSERT INTO eventparticipants (eventid, userId) VALUES ($1, $2)`;
		try {
			const maxparticipantsPromise = pool.query(getMaxParticipantQuery, [eventId]);
			const currentParticipantsPromise = pool.query(getCurrentParticipantsQuery, [
				eventId,
			]);
			const queriesPromises = [maxparticipantsPromise, currentParticipantsPromise];
			const results = await Promise.all(queriesPromises);
			const maxParticipants = +results[0].rows[0].maxparticipants;
			const currentParticipants = +results[1].rows[0].count;
			if (!maxParticipants || currentParticipants < maxParticipants) {
				await pool.query(query, [eventId, userId]);
				return sendResponse(res, 201);
			} else {
				return sendError(res, 400, "Max participants reached");
			}
		} catch (e) {
			sendError(res, 400, e.message);
		}
	},
);

//change didAttend status
router.patch(
	"/didAttend",
	[checkAuthenticated, checkIsEventCreator],
	async (req, res) => {
		const { eventId, userId, didAttend } = req.body;
		const query = `UPDATE eventparticipants SET didattend = $1 WHERE eventid = $2 AND userid = $3 RETURNING *`;
		try {
			const result = await pool.query(query, [didAttend, eventId, userId]);
			if (result.rows.length == 0) {
				return sendError(res, 400, "user is not a participant");
			}
			sendResponse(res, 200, result.rows[0]);
		} catch (e) {
			sendError(res, 400, e.message);
		}
	},
);

//delete participant from event by eventId and userId
router.delete("/:eventId", checkAuthenticated, async (req, res) => {
	const { eventId } = req.params;
	const userId = req.user.id;
	const query = `DELETE FROM eventparticipants WHERE eventid = $1 AND userId = $2`;
	try {
		const result = await pool.query(query, [eventId, userId]);
		if (result.rowCount == 0) {
			return sendError(res, 400, "user is not a participant");
		}
		sendResponse(res, 200);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

module.exports = router;
