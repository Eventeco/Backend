const express = require("express");
const { s3GetImage, sendError } = require("../helper");
const { checkAuthenticated } = require("../middlewares");

const router = express.Router();

//get picture by key
router.get("/getImage/:key", checkAuthenticated, async (req, res) => {
	const { key } = req.params;
	try {
		const response = await s3GetImage(key);
		response.Body.pipe(res);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

module.exports = router;
