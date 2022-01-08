const express = require("express");
const validator = require("email-validator");
const {
	sendError,
	sendResponse,
	pool,
	getUserByUsername,
	checkAuthenticated,
} = require("../helper");

const router = express.Router();

//get user by username
router.get("/:username", checkAuthenticated, async (req, res) => {
	const username = req.params.username;
	try {
		const result = await getUserByUsername(username);
		sendResponse(res, 200, result);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

module.exports = router;
