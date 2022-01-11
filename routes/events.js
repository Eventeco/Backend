const express = require("express");
const {
	checkAuthenticated,
	pool,
	sendResponse,
	sendError,
} = require("../helper");

const router = express.Router();

//get all events
router.get("/", checkAuthenticated, async (_, res) => {
	try {
		const result = await pool.query("SELECT * FROM events");
		sendResponse(res, 200, result.rows);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

module.exports = router;
