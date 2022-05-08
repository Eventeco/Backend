const express = require("express");
const {
	sendError,
	sendResponse,
	isUserDeletedById,
	doesUserExistById,
} = require("../helper");
const pool = require("../dbPool");
const { checkAuthenticated } = require("../middlewares");

const router = express.Router();

// get ratings of a user
router.get("/:id", checkAuthenticated, async (req, res) => {
	const { id } = req.params;
	const query = `SELECT r.rating, r.reason,
    json_agg(u) -> 0 AS ratedBy 
    FROM userratings AS r
    JOIN users AS u ON u.id = r.ratedBy AND u.deletedAt IS NULL
    WHERE r.ratedUser = $1
    GROUP BY r.ratedUser, r.ratedBy
	ORDER BY r.rating DESC`;
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

// post rating
router.post("/", checkAuthenticated, async (req, res) => {
	const { ratedUserId, rating, reason } = req.body;
	const ratedById = req.user.id;
	if (ratedById === ratedUserId) {
		return sendError(res, 400, "You can't rate yourself!");
	}
	if (rating < 1 || rating > 5) {
		return sendResponse(res, 400, "Rating must be between 1 and 5");
	}

	const doesUserExist = await doesUserExistById(ratedUserId);
	if (!doesUserExist) return sendError(res, 400, "User does not exist");

	const isRatedUserDeleted = await isUserDeletedById(ratedUserId);
	if (isRatedUserDeleted)
		return sendResponse(res, 400, "User to rate is deleted");

	const query = `INSERT INTO userratings (ratedUser, rating, ratedBy, reason) VALUES ($1, $2, $3, $4) RETURNING *`;
	const values = [ratedUserId, rating, ratedById, reason];
	try {
		await pool.query(query, values);
		return sendResponse(res, 201);
	} catch (e) {
		return sendError(res, 400, e.message);
	}
});

// patch rating
router.patch("/", checkAuthenticated, async (req, res) => {
	const { ratedUserId, newRating, newReason } = req.body;
	const ratedById = req.user.id;
	const query = `UPDATE userratings SET rating = $1, reason = $2 WHERE ratedUser = $3 AND ratedBy = $4 RETURNING *`;
	const values = [newRating, newReason, ratedUserId, ratedById];
	try {
		const result = await pool.query(query, values);
		if (result.rows.length === 0) {
			return sendResponse(res, 404, "Rating not found");
		}
		return sendResponse(res, 200, "Rating updated");
	} catch (e) {
		return sendError(res, 400, e.message);
	}
});

//delete rating
router.delete("/:ratedUserId", checkAuthenticated, async (req, res) => {
	const { ratedUserId } = req.params;
	const ratedById = req.user.id;
	const query = `DELETE FROM userratings WHERE ratedUser = $1 AND ratedBy = $2`;
	const values = [ratedUserId, ratedById];
	try {
		const result = await pool.query(query, values);
		if (result.rows.length === 0) {
			return sendError(res, 404, "Rating not found");
		}
		return sendResponse(res, 204);
	} catch (e) {
		return sendError(res, 400, e.message);
	}
});

module.exports = router;
