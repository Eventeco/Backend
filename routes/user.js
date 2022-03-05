const express = require("express");
const format = require("pg-format");
const pool = require("../dbPool");
const {
	sendError,
	sendResponse,
	getUserByUsername,
	checkUserHasNotJoinedEventOnSameDay,
	getUserById,
	cryptPassword,
	verifyUserPassword,
} = require("../helper");
const { checkAuthenticated } = require("../middlewares");

const router = express.Router();

//get user by username
router.get("/uname/:username", async (req, res) => {
	const username = req.params.username;
	try {
		const result = await getUserByUsername(username);
		if (result.deletedat) {
			return sendError(res, 404, "User is deleted");
		}
		sendResponse(res, 200, result);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

//get user by id
router.get("/:userId", async (req, res) => {
	const userId = req.params.userId;
	try {
		const result = await getUserById(userId);
		if (result.deletedat) {
			return sendError(res, 404, "User is deleted");
		}
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

//change user password
router.patch("/change-password", checkAuthenticated, async (req, res) => {
	const { userId, oldPassword, newPassword } = req.body;
	if (!newPassword) {
		return sendError(res, 400, "No new password provided");
	}
	if (!oldPassword) {
		return sendError(res, 400, "No old password provided");
	}
	const isOldPasswordCorrect = await verifyUserPassword(userId, oldPassword);
	console.log(isOldPasswordCorrect);
	if (!isOldPasswordCorrect) {
		return sendError(res, 400, "The old password is incorrect");
	}
	const hashedPassword = await cryptPassword(newPassword);
	const query = "UPDATE users SET password=$1 WHERE id=$2 RETURNING *";
	try {
		await pool.query(query, [hashedPassword, userId]);
		sendResponse(res, 200, "Password changed successfully");
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

//change user details
router.patch("/", checkAuthenticated, async (req, res) => {
	const { userId, password, ...dataToChange } = req.body;

	const sets = Object.entries(dataToChange).map(([key, value]) =>
		format("%s = %L", key, value),
	);
	const query = format(
		"UPDATE users SET %s, updatedAt = NOW() WHERE id = %s AND deletedAt IS NULL RETURNING *",
		sets.join(", "),
		userId,
	);

	try {
		const result = await pool.query(query);
		if (result.rowCount === 0) {
			return sendError(res, 404, "User not found or deleted");
		}
		sendResponse(res, 200, result.rows[0]);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

//delete user
router.delete("/:userId", checkAuthenticated, async (req, res) => {
	const { userId } = req.params;
	const query =
		"UPDATE users SET deletedAt=NOW() WHERE id=$1 AND deletedAt IS NULL";
	try {
		await pool.query(query, [userId]);
		sendResponse(res, 200);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

module.exports = router;
