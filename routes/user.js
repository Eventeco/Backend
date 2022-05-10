const express = require("express");
const format = require("pg-format");
const pool = require("../dbPool");
const {
	sendError,
	sendResponse,
	checkUserHasNotJoinedEventOnSameDay,
	cryptPassword,
	verifyUserPassword,
	s3PutBase64Image,
	s3DeleteImage,
	getUsers,
} = require("../helper");
const { checkAuthenticated } = require("../middlewares");

const router = express.Router();

//get user by username
router.get("/uname/:username", async (req, res) => {
	const username = req.params.username;
	try {
		const query = "SELECT * FROM users WHERE username = $1 AND isadmin = false";
		const result = await pool.query(query, [username]);
		if (result.rows.length === 0) {
			return sendError(res, 404, "User not found");
		}
		const userResult = await getUsers([result.rows[0].id]);
		const user = userResult.rows[0];
		if (user.deletedat) {
			return sendError(res, 400, "User is deleted");
		}
		sendResponse(res, 200, user);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

//get user by id
router.get("/:userId", async (req, res) => {
	const userId = req.params.userId;
	try {
		const userResult = await getUsers([userId]);
		if (userResult.rows.length === 0) {
			return sendError(res, 404, "User not found");
		}
		const user = userResult.rows[0];
		if (user.deletedat) {
			return sendError(res, 400, "User is deleted");
		}
		sendResponse(res, 200, userResult.rows[0]);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

//check if user has another event on same day
router.get("/check-event/:eventId", checkAuthenticated, async (req, res) => {
	const { eventId } = req.params;
	const userId = req.user.id;
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
	const { oldPassword, newPassword } = req.body;
	const userId = req.user.id;
	if (!newPassword) {
		return sendError(res, 400, "No new password provided");
	}
	if (!oldPassword) {
		return sendError(res, 400, "No old password provided");
	}
	const isOldPasswordCorrect = await verifyUserPassword(userId, oldPassword);
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
	const { password, base64, ...dataToChange } = req.body;
	const userId = req.user.id;

	delete dataToChange.password;
	delete dataToChange.isadmin;
	delete dataToChange.deletedAt;
	delete dataToChange.createdAt;

	try {
		if (base64) {
			const getCurrentPicQuery = "SELECT profilepicpath FROM users WHERE id=$1";
			const result = await pool.query(getCurrentPicQuery, [userId]);
			const currentPicPath = result.rows[0].profilepicpath;
			const promises = [s3PutBase64Image(base64)];
			if (currentPicPath) {
				promises.push(s3DeleteImage(currentPicPath));
			}
			const results = await Promise.all(promises);
			const newPicPath = results[0];
			dataToChange.profilepicpath = newPicPath;
		}

		const sets = Object.entries(dataToChange).map(([key, value]) =>
			format("%s = %L", key, value),
		);
		const query = format(
			"UPDATE users SET %s, updatedAt = NOW() WHERE id = %s AND deletedAt IS NULL RETURNING *",
			sets.join(", "),
			userId,
		);

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
router.delete("/", checkAuthenticated, async (req, res) => {
	const userId = req.user.id;
	const query =
		"UPDATE users SET deletedAt=NOW() WHERE id=$1 AND deletedAt IS NULL";
	try {
		await pool.query(query, [userId]);
		req.logOut();
		sendResponse(res, 200);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

module.exports = router;
