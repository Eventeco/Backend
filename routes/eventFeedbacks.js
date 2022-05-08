const express = require("express");
const { sendError, sendResponse } = require("../helper");
const pool = require("../dbPool");
const {
	checkAuthenticated,
	checkIsNotEventCreator,
} = require("../middlewares");

const router = express.Router();

// get feedbacks of an event
router.get("/:id", checkAuthenticated, async (req, res) => {
	const { id } = req.params;
	const query = `SELECT f.rating, f.comments,
    json_agg(u) -> 0 AS user 
    FROM eventfeedbackresponses AS f
	JOIN users AS u ON u.id = f.userId AND u.deletedAt IS NULL
    WHERE f.eventId = $1
	GROUP BY f.eventId, f.userId
	ORDER BY f.rating DESC`;
	const values = [id];
	try {
		const result = await pool.query(query, values);
		if (result.rows.length === 0) {
			return sendResponse(res, 200, []);
		}
		return sendResponse(res, 200, result.rows);
	} catch (e) {
		return sendError(res, 400, e.message);
	}
});

// post feedback
router.post(
	"/",
	[checkAuthenticated, checkIsNotEventCreator],
	async (req, res) => {
		const { eventId, rating, comments } = req.body;
		const userId = req.user.id;

		if (rating < 1 || rating > 5) {
			return sendResponse(res, 400, "Rating must be between 1 and 5");
		}

		const query = `INSERT INTO eventfeedbackresponses (userId, eventId, rating, comments) VALUES ($1, $2, $3, $4)`;
		const values = [userId, eventId, rating, comments];
		try {
			await pool.query(query, values);
			return sendResponse(res, 201);
		} catch (e) {
			return sendError(res, 400, e.message);
		}
	},
);

// patch feedback
router.patch(
	"/",
	[checkAuthenticated, checkIsNotEventCreator],
	async (req, res) => {
		const { eventId, newRating, newComments } = req.body;
		const userId = req.user.id;
		const query = `UPDATE eventfeedbackresponses SET rating = $1, comments = $2 WHERE eventId = $3 AND userId = $4 RETURNING *`;
		const values = [newRating, newComments, eventId, userId];
		try {
			const result = await pool.query(query, values);
			if (result.rows.length === 0) {
				return sendResponse(res, 404, "feedback not found");
			}
			return sendResponse(res, 200, "feedback updated");
		} catch (e) {
			return sendError(res, 400, e.message);
		}
	},
);

//delete feedback
router.delete("/:eventId", checkAuthenticated, async (req, res) => {
	const { eventId } = req.params;
	const userId = req.user.id;
	const query = `DELETE FROM eventfeedbackresponses WHERE eventId = $1 AND userId = $2 RETURNING *`;
	const values = [eventId, userId];
	try {
		const result = await pool.query(query, values);
		if (result.rows.length === 0) {
			return sendError(res, 404, "feedback not found");
		}
		return sendResponse(res, 204);
	} catch (e) {
		return sendError(res, 400, e.message);
	}
});

module.exports = router;
