const express = require("express");
const { sendResponse, sendError } = require("../helper");
const pool = require("../dbPool");
const { checkAuthenticated, checkIsEventCreator } = require("../middlewares");

const router = express.Router();

//get rules by eventId
router.get("/:eventId", checkAuthenticated, async (req, res) => {
	const { eventId } = req.params;
	const query = "SELECT * FROM eventRules WHERE eventId=$1";
	try {
		const results = await pool.query(query, [eventId]);
		if (results.rows.length === 0) {
			return sendError(res, 404, "No rules found");
		}
		sendResponse(res, 200, results.rows);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

//add new rule to event
router.post(
	"/",
	[checkAuthenticated, checkIsEventCreator],
	async (req, res) => {
		const { rule, eventId } = req.body;
		const query =
			"INSERT INTO eventRules (eventId, rule) VALUES ($1, $2) RETURNING *";
		try {
			const results = await pool.query(query, [eventId, rule]);
			sendResponse(res, 200, results.rows[0]);
		} catch (e) {
			sendError(res, 400, e.message);
		}
	},
);

//change rule of event
router.patch(
	"/",
	[checkAuthenticated, checkIsEventCreator],
	async (req, res) => {
		const { rule, ruleId } = req.body;
		const query = "UPDATE eventRules SET rule=$1 WHERE id=$2 RETURNING *";
		try {
			const results = await pool.query(query, [rule, ruleId]);
			sendResponse(res, 200, results.rows[0]);
		} catch (e) {
			sendError(res, 400, e.message);
		}
	},
);

//delete rule from event
router.delete(
	"/:ruleId/event/:eventId",
	[checkAuthenticated, checkIsEventCreator],
	async (req, res) => {
		const { ruleId } = req.params;
		const query = "DELETE FROM eventRules WHERE id=$1";
		try {
			await pool.query(query, [ruleId]);
			sendResponse(res, 200);
		} catch (e) {
			sendError(res, 400, e.message);
		}
	},
);

module.exports = router;
