const express = require("express");
const validator = require("email-validator");
const {
	sendError,
	sendResponse,
	pool,
	cryptPassword,
	checkNotAuthenticated,
	checkAuthenticated,
} = require("../helper");
const passport = require("passport");

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
		body: { username, email, password },
	} = req;
	if (!validator.validate(email)) {
		sendError(res, 400, "Invalid Email Address");
		return;
	}
	try {
		const hashedPassword = await cryptPassword(password);
		const result = await pool.query(
			"INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *",
			[username, email, hashedPassword],
		);
		sendResponse(res, 201, { user: result.rows[0] });
	} catch (e) {
		console.log(e);
		sendError(res, 400, "some error occured");
	}
});

router.delete("/logout", checkAuthenticated, (req, res) => {
	req.logOut();
	sendResponse(res, 204);
});

module.exports = router;
