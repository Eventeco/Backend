const express = require("express");
const {
	sendResponse,
	sendError,
	s3PutBase64Image,
	s3DeleteImage,
} = require("../helper");
const pool = require("../dbPool");
const { checkAuthenticated, checkIsEventCreator } = require("../middlewares");
const format = require("pg-format");

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

//add new pictures to event
router.post(
	"/",
	[checkAuthenticated, checkIsEventCreator],
	async (req, res) => {
		const { images, eventId } = req.body;
		const checkEventQuery =
			"SELECT * FROM events WHERE id=$1 AND deletedAt IS NULL";
		try {
			const checkEventResult = await pool.query(checkEventQuery, [eventId]);
			if (checkEventResult.rows.length === 0) {
				return sendError(res, 404, "Event not found");
			}
		} catch (e) {
			sendError(res, 400, e.message);
		}
		if (!images || !images.length > 0) {
			return sendError(res, 400, "No images provided");
		}
		const promises = [];
		for (let image of images) {
			try {
				promises.push(s3PutBase64Image(image));
			} catch (e) {
				return sendError(res, 400, e.message);
			}
		}
		const imageKeys = await Promise.all(promises);
		const imageSet = imageKeys.map((key) => [eventId, key]);
		const query = format(
			"INSERT INTO eventPictures (eventId, picturepath) VALUES %L RETURNING *",
			imageSet,
		);
		try {
			const results = await pool.query(query);
			sendResponse(res, 200, results.rows);
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
		const getPathQuery = "SELECT * FROM eventPictures WHERE id=$1";
		const query = "DELETE FROM eventPictures WHERE id=$1";
		try {
			const results = await pool.query(getPathQuery, [id]);
			const path = results.rows[0].picturepath;
			await Promises.all([s3DeleteImage(path), pool.query(query, [id])]);
			sendResponse(res, 200);
		} catch (e) {
			sendError(res, 400, e.message);
		}
	},
);

module.exports = router;
