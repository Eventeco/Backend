const express = require("express");
const passport = require("passport");
const pool = require("../dbPool");
const {
	sendResponse,
	sendError,
	getUsers,
	isUserDeletedByUsername,
	isUserAdminByUsername,
} = require("../helper");
const { checkAdmin, checkNotAuthenticated } = require("../middlewares");

const router = express.Router();

router.get("/allCounts", checkAdmin, async (_, res) => {
	const query = `SELECT 
                    (SELECT COUNT(*) FROM users WHERE deletedAt IS NULL) AS usersCount,
                    (SELECT COUNT(*) FROM events WHERE deletedAt IS NULL) AS eventsCount,
                    (SELECT COUNT(*) FROM events WHERE deletedAt IS NULL AND events.endtime > NOW()) AS upcomingEventsCount,
                    (SELECT COUNT(*) FROM events WHERE deletedAt IS NULL AND events.endtime < NOW()) AS pastEventsCount`;

	try {
		const result = await pool.query(query);
		sendResponse(res, 200, result.rows[0]);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

router.get("/activeUsers", async (_, res) => {
	const query = `SELECT * FROM users WHERE deletedAt IS NULL AND isAdmin = false`;
	try {
		const result = await pool.query(query);
		const ids = result.rows.map((user) => user.id);
		const userResult = await getUsers(ids);
		sendResponse(res, 200, userResult.rows);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

router.post("/login", checkNotAuthenticated, async (req, res, next) => {
	const isUserDeleted = await isUserDeletedByUsername(req.body.username);
	if (isUserDeleted) {
		return sendError(res, 400, "User is deleted");
	}
	const isUserAdmin = await isUserAdminByUsername(req.body.username);
	if (!isUserAdmin) {
		return sendError(res, 400, "User is not an admin");
	}
	passport.authenticate("local", function (err, user, info) {
		if (err) return sendError(res, 500);
		if (!user) return sendError(res, 400, info.message);
		req.logIn(user, function (err) {
			if (err) return next(err);
			return sendResponse(res, 201, user);
		});
	})(req, res, next);
});

module.exports = router;
