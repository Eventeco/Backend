const express = require("express");
const { sendResponse, sendError } = require("../helper");
const pool = require("../dbPool");

const router = express.Router();

//get by eventId
router.get("/:id", async (req, res) => {
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

//TODO:
//add addressed issue to event
//delete addressed issue from event

module.exports = router;
