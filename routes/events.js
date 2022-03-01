const express = require("express");
const {
	checkAuthenticated,
	pool,
	sendResponse,
	sendError,
} = require("../helper");
var format = require("pg-format");

const router = express.Router();

//get all events
// filter events by name, description, type, isDonationEnabled
router.get("/", async (req, res) => {
	const { name, description, type, isDonationEnabled, issues } = req.query;
	const nameQuery = name ? format(` AND e.name ILIKE '%%%s%%'`, name) : "";
	const descriptionQuery = description
		? format(` AND e.description ILIKE '%%%s%%'`, description)
		: "";
	const typeQuery = type ? format(` AND e.type = %L`, type) : "";
	const isDonationEnabledQuery =
		isDonationEnabled === "true" ? ` AND e.isDonationEnabled = true` : "";

	const issuesFilteringQuery = issues
		? format(
				`WHERE EXISTS (SELECT id FROM issuetypes WHERE id in (%s) )`,
				issues.split(",").map(Number),
		  )
		: "";
	const eventsFilteringQuery = `${nameQuery}${descriptionQuery}${typeQuery}${isDonationEnabledQuery}`;

	const query = `SELECT e.*, json_agg(u) -> 0 AS user, json_agg(i) AS issues
	FROM events AS e
	JOIN users AS u ON e.creatorId = u.id AND e.deletedAt IS NULL ${eventsFilteringQuery}
	JOIN addressedIssues AS a ON a.eventId = e.id
	JOIN issuetypes AS i ON a.issuetypeid = i.id
	${issuesFilteringQuery}
	GROUP BY e.id
	ORDER BY e.createdAt DESC`;

	try {
		const result = await pool.query(query);
		sendResponse(res, 200, result.rows);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

//get suggested events based on event issues
router.get("/suggested/:id", checkAuthenticated, async (req, res) => {
	const { id } = req.params;
	try {
		const result = await pool.query(
			`SELECT e.*, json_agg(u) -> 0 AS user, json_agg(i) AS issues 
			FROM events AS e
			JOIN users AS u ON e.creatorId = u.id AND e.id != $1 AND e.deletedAt IS NULL
			JOIN addressedIssues AS a ON a.eventId = e.id 
			JOIN issuetypes AS i ON a.issuetypeid = i.id AND i.id IN (
				SELECT i.id 
				FROM addressedIssues AS a 
				JOIN issuetypes AS i 
				ON a.issuetypeid = i.id 
				WHERE a.eventId = $1)
			GROUP BY e.id
			ORDER BY e.createdAt DESC`,
			[id],
		);
		sendResponse(res, 200, result.rows);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

//post an event
router.post("/", checkAuthenticated, async (req, res) => {
	const { issueIds, ...eventData } = req.body;
	if (issueIds && issueIds.length === 0) {
		sendError(res, 400, "Please select atleast one issue");
		return;
	}
	const cols = Object.keys(eventData);
	const values = Object.values(eventData);
	const eventQuery = format(
		"INSERT INTO events (%s) VALUES (%L) RETURNING *",
		cols,
		values,
	);
	try {
		const eventResult = await pool.query(eventQuery);
		const event = eventResult.rows[0];
		const eventId = event.id;
		const addressedIssuesArray = issueIds.map((issueId) => [eventId, issueId]);
		const addressedIssuesQuery = format(
			"INSERT INTO addressedIssues VALUES %L RETURNING *",
			addressedIssuesArray,
		);
		const addressedIssuesResult = await pool.query(addressedIssuesQuery);
		sendResponse(res, 201, {
			...event,
			addressedIssues: addressedIssuesResult.rows,
		});
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

//edit an event
router.patch("/:id", checkAuthenticated, async (req, res) => {
	const {
		body,
		params: { id },
	} = req;
	const sets = Object.entries(body).map(([key, value]) =>
		format("%s = %L", key, value),
	);

	const query = format(
		"UPDATE events SET %s, updatedAt = NOW() WHERE id = %s RETURNING *",
		sets.join(", "),
		id,
	);
	try {
		const result = await pool.query(query);
		sendResponse(res, 201, result.rows[0]);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

//delete an event
router.delete("/:id", async (req, res) => {
	const { id } = req.params;
	const query = `UPDATE events SET deletedAt = NOW() WHERE id = $1 AND deletedAt IS NULL`;
	try {
		await pool.query(query, [id]);
		sendResponse(res, 200);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

module.exports = router;

// todo:
// event geolocation filter with coordinates and radius
