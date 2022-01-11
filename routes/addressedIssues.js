const express = require("express");
const {
	checkAuthenticated,
	pool,
	sendResponse,
	sendError,
} = require("../helper");

const router = express.Router();

//get by eventId
router.get("/:id", async (req, res) => {
	const { id } = req.params;
	try {
		const results = await pool.query(
			"SELECT i.name FROM addressedIssues as a JOIN issueTypes as i ON a.eventId=$1 and a.issueTypeId=i.id",
			[id],
		);
		sendResponse(
			res,
			200,
			results.rows.map((item) => item.name),
		);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

module.exports = router;
