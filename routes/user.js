const express = require("express");
const { sendError, sendResponse, getUserByUsername } = require("../helper");
const { checkAuthenticated } = require("../middlewares");

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
