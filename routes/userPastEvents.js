const express = require("express");
const pool = require("../dbPool");
const { sendError, sendResponse } = require("../helper");
const { checkAuthenticated } = require("../middlewares");

const router = express.Router();

//get user past participated events
router.get("/participated", checkAuthenticated, async (req, res) => {
	const userId = req.user.id;
	const query = `SELECT e.*, json_agg(u) -> 0 AS user, 
	COALESCE(json_agg(DISTINCT i) FILTER (WHERE i.id IS NOT NULL), '[]') AS issues, 
	COALESCE(json_agg(DISTINCT jsonb_build_object('id', er.id, 'rule', er.rule)) FILTER (WHERE er.id IS NOT NULL), '[]') AS rules,
	COALESCE(json_agg(DISTINCT ep) FILTER (WHERE ep.id IS NOT NULL), '[]') AS pictures 
	FROM events AS e
	JOIN eventParticipants as p ON e.id=p.eventId AND p.userId=$1 AND e.deletedAt IS NULL
	JOIN users AS u ON e.creatorId = u.id AND e.deletedAt IS NULL
	LEFT JOIN eventRules AS er ON er.eventId = e.id
	LEFT JOIN eventPictures AS ep ON ep.eventId = e.id
	LEFT JOIN addressedIssues AS a ON a.eventId = e.id
	JOIN issuetypes AS i ON a.issuetypeid = i.id
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
router.get("/created", checkAuthenticated, async (req, res) => {
	const userId = req.user.id;
	const query = `SELECT e.*, json_agg(u) -> 0 AS user, 
	COALESCE(json_agg(DISTINCT i) FILTER (WHERE i.id IS NOT NULL), '[]') AS issues, 
	COALESCE(json_agg(DISTINCT jsonb_build_object('id', er.id, 'rule', er.rule)) FILTER (WHERE er.id IS NOT NULL), '[]') AS rules,
	COALESCE(json_agg(DISTINCT ep) FILTER (WHERE ep.id IS NOT NULL), '[]') AS pictures 
	FROM events AS e
	JOIN users AS u ON e.creatorId = u.id AND e.deletedAt IS NULL AND e.creatorId=$1
	LEFT JOIN eventRules AS er ON er.eventId = e.id
	LEFT JOIN eventPictures AS ep ON ep.eventId = e.id
	LEFT JOIN addressedIssues AS a ON a.eventId = e.id
	JOIN issuetypes AS i ON a.issuetypeid = i.id
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
