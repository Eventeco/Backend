const express = require("express");
const { sendResponse, sendError } = require("../helper");
const pool = require("../dbPool");
const { checkAuthenticated } = require("../middlewares");

const router = express.Router();

//get all issue types
router.get("/", checkAuthenticated, async (_, res) => {
	const query = "SELECT * FROM issuetypes";
	try {
		const results = await pool.query(query);
		sendResponse(res, 200, results.rows);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

module.exports = router;
