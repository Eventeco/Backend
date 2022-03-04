const express = require("express");
const { sendResponse, sendError } = require("../helper");
const pool = require("../dbPool");
const { checkAuthenticated, checkIsEventCreator } = require("../middlewares");

const router = express.Router();

//get pictures by eventId
router.get("/:eventId", checkAuthenticated, async (req, res) => {
	const { eventId } = req.params;
	const query = "SELECT id, picturepath FROM eventPictures WHERE eventId=$1";
	try {
		const results = await pool.query(query, [eventId]);
		if (results.rows.length === 0) {
			return sendError(res, 404, "No pictures found");
		}
		sendResponse(res, 200, results.rows);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

//add new picture to event
router.post(
	"/",
	[checkAuthenticated, checkIsEventCreator],
	async (req, res) => {
		const { picturePath, eventId } = req.body;
		if (!picturePath) {
			return sendError(res, 400, "No picture path provided");
		}
		const query =
			"INSERT INTO eventPictures (eventId, picturePath) VALUES ($1, $2) RETURNING *";
		try {
			const results = await pool.query(query, [eventId, picturePath]);
			sendResponse(res, 200, results.rows[0]);
		} catch (e) {
			sendError(res, 400, e.message);
		}
	},
);

//delete picture from event
router.delete(
	"/:id/event/:eventId",
	[checkAuthenticated, checkIsEventCreator],
	async (req, res) => {
		const { id } = req.params;
		const query = "DELETE FROM eventPictures WHERE id=$1";
		try {
			await pool.query(query, [id]);
			sendResponse(res, 200);
		} catch (e) {
			sendError(res, 400, e.message);
		}
	},
);

module.exports = router;
