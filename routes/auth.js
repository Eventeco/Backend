const express = require("express");
const validator = require("email-validator");
const { sendError, sendResponse, cryptPassword } = require("../helper");
const passport = require("passport");
const pool = require("../dbPool");
const { checkNotAuthenticated, checkAuthenticated } = require("../middlewares");

const router = express.Router();

router.post("/login", checkNotAuthenticated, function (req, res, next) {
	passport.authenticate("local", function (err, user, info) {
		if (err) return sendError(res, 500);
		if (!user) return sendError(res, 400, info.message);
		req.logIn(user, function (err) {
			if (err) return next(err);
			return sendResponse(res, 201, user);
		});
	})(req, res, next);
});

router.post("/register", checkNotAuthenticated, async (req, res) => {
	const {
		body: { name, username, email, password },
	} = req;
	if (!validator.validate(email)) {
		sendError(res, 400, "Invalid Email Address");
		return;
	}
	try {
		const hashedPassword = await cryptPassword(password);
		const result = await pool.query(
			"INSERT INTO users (firstname, username, email, password) VALUES ($1, $2, $3, $4) RETURNING *",
			[name, username, email, hashedPassword],
		);
		sendResponse(res, 201, { user: result.rows[0] });
	} catch (e) {
		sendError(res, 400, e.detail);
	}
});

router.delete("/logout", checkAuthenticated, (req, res) => {
	req.logOut();
	sendResponse(res, 200);
});

router.get("/login-status", (req, res) => {
	if (req.isAuthenticated()) {
		sendResponse(res, 200, req.user);
	} else {
		sendError(res, 400);
	}
});

module.exports = router;
