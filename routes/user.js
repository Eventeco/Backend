const express = require("express");
const validator = require("email-validator");
const { sendError, sendResponse, pool, cryptPassword } = require("../helper");

const router = express.Router();

router.get("/", (req, res) => {
	pool.query("SELECT NOW()", (err, res) => {
		console.log(err, res);
	});
});

module.exports = router;
