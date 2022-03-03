const express = require("express");
const { sendResponse, sendError } = require("../helper");
const pool = require("../dbPool");
const { checkAuthenticated, checkIsEventCreator } = require("../middlewares");

const router = express.Router();

//get by eventId
router.get("/:id", checkAuthenticated, async (req, res) => {
	const { id } = req.params;
	try {
		const results = await pool.query(
			"SELECT i.* FROM addressedIssues as a JOIN issueTypes as i ON a.eventId=$1 and a.issueTypeId=i.id",
			[id],
		);
		sendResponse(res, 200, results.rows);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

//add new addressed issue to event
router.post(
	"/:issueId/event/:eventId",
	[checkAuthenticated, checkIsEventCreator],
	async (req, res) => {
		const { issueId, eventId } = req.params;
		const query =
			"INSERT INTO addressedIssues (eventId, issueTypeId) VALUES ($1, $2) RETURNING *";
		try {
			const results = await pool.query(query, [eventId, issueId]);
			sendResponse(res, 200, results.rows[0]);
		} catch (e) {
			sendError(res, 400, e.message);
		}
	},
);

//delete addressed issue from event
router.delete(
	"/:issueId/event/:eventId",
	[checkAuthenticated, checkIsEventCreator],
	async (req, res) => {
		const { issueId, eventId } = req.params;
		const query =
			"DELETE FROM addressedIssues WHERE eventId=$1 AND issueTypeId=$2";
		try {
			const results = await pool.query(query, [eventId, issueId]);
			sendResponse(res, 200);
		} catch (e) {
			sendError(res, 400, e.message);
		}
	},
);

module.exports = router;
