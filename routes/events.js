const express = require("express");
const {
	checkAuthenticated,
	pool,
	sendResponse,
	sendError,
} = require("../helper");

const router = express.Router();

//get all events
router.get("/", async (_, res) => {
	try {
		const result = await pool.query(
			`SELECT e.*, json_agg(u) -> 0 AS user, json_agg(i) AS issues 
			FROM events AS e 
			JOIN users AS u ON e.creatorId = u.id 
			JOIN addressedIssues AS a ON a.eventId = e.id 
			JOIN issuetypes AS i ON a.issuetypeid = i.id 
			GROUP BY e.id`,
		);
		sendResponse(res, 200, result.rows);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

module.exports = router;
