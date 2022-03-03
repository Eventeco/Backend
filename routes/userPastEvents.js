const express = require("express");
const pool = require("../dbPool");
const { sendError, sendResponse } = require("../helper");
const { checkAuthenticated } = require("../middlewares");

const router = express.Router();

//get user past participated events
router.get("/participated/:userId", checkAuthenticated, async (req, res) => {
	const { userId } = req.params;
	const query = `SELECT e.*, json_agg(u) -> 0 AS user, json_agg(i) AS issues 
                    FROM events as e 
                    JOIN eventParticipants as p ON e.id=p.eventId AND p.userId=$1 AND e.deletedAt IS NULL
                    JOIN users as u ON e.creatorId=u.id
                    JOIN addressedIssues as a ON a.eventId=e.id
                    JOIN issuetypes as i ON a.issuetypeid=i.id
                    GROUP BY e.id
                    ORDER BY e.createdAt DESC`;
	try {
		const results = await pool.query(query, [userId]);
		sendResponse(res, 200, results.rows);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

//get user past created events
router.get("/created/:userId", checkAuthenticated, async (req, res) => {
	const { userId } = req.params;
	const query = `SELECT e.*, json_agg(u) -> 0 AS user, json_agg(i) AS issues
                    FROM events as e
                    JOIN users as u ON e.creatorId=u.id AND e.creatorId=$1 AND e.deletedAt IS NULL
                    JOIN addressedIssues as a ON a.eventId=e.id
                    JOIN issuetypes as i ON a.issuetypeid=i.id
                    GROUP BY e.id
                    ORDER BY e.createdAt DESC`;
	try {
		const results = await pool.query(query, [userId]);
		sendResponse(res, 200, results.rows);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

module.exports = router;
