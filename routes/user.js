const express = require("express");
const {
	sendError,
	sendResponse,
	getUserByUsername,
	checkUserHasNotJoinedEventOnSameDay,
} = require("../helper");
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

//check if user has another event on same day
router.get("/check-event/:userId/event/:eventId", async (req, res) => {
	const { userId, eventId } = req.params;
	try {
		const result = await checkUserHasNotJoinedEventOnSameDay(eventId, userId);
		if (result) {
			sendResponse(res, 200);
		} else {
			sendError(res, 400, "You have already joined an event on this day");
		}
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

module.exports = router;
