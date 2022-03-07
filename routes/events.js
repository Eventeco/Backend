const express = require("express");
const { sendResponse, sendError } = require("../helper");
const format = require("pg-format");
const pool = require("../dbPool");
const { checkAuthenticated, checkIsEventCreator } = require("../middlewares");

const router = express.Router();

//get all events and filter events by name, description, type, isDonationEnabled
router.get("/", checkAuthenticated, async (req, res) => {
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
				` WHERE EXISTS (SELECT id FROM issuetypes WHERE id in (%s) )`,
				issues.split(",").map(Number),
		  )
		: "";
	const eventsFilteringQuery = `${nameQuery}${descriptionQuery}${typeQuery}${isDonationEnabledQuery}`;

	const query = `SELECT e.*, json_agg(u) -> 0 AS user, 
					COALESCE(json_agg(DISTINCT i) FILTER (WHERE i.id IS NOT NULL), '[]') AS issues, 
					COALESCE(json_agg(DISTINCT jsonb_build_object('id', er.id, 'rule', er.rule)) FILTER (WHERE er.id IS NOT NULL), '[]') AS rules
					FROM events AS e
					JOIN users AS u ON e.creatorId = u.id AND e.deletedAt IS NULL ${eventsFilteringQuery}
					LEFT JOIN eventRules AS er ON er.eventId = e.id
					LEFT JOIN addressedIssues AS a ON a.eventId = e.id
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
	const query = `SELECT e.*, json_agg(u) -> 0 AS user, 
					COALESCE(json_agg(DISTINCT i) FILTER (WHERE i.id IS NOT NULL), '[]') AS issues, 
					COALESCE(json_agg(DISTINCT jsonb_build_object('id', er.id, 'rule', er.rule)) FILTER (WHERE er.id IS NOT NULL), '[]') AS rules
					FROM events AS e
					JOIN users AS u ON e.creatorId = u.id AND e.id != $1 AND e.deletedAt IS NULL
					LEFT JOIN eventRules AS er ON er.eventId = e.id
					LEFT JOIN addressedIssues AS a ON a.eventId = e.id 
					JOIN issuetypes AS i ON a.issuetypeid = i.id WHERE EXISTS (
						SELECT i.id 
						FROM addressedIssues AS a 
						JOIN issuetypes AS i 
						ON a.issuetypeid = i.id 
						WHERE a.eventId = $1)
					GROUP BY e.id
					ORDER BY e.createdAt DESC`;
	try {
		const result = await pool.query(query, [id]);
		sendResponse(res, 200, result.rows);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

//get event by id
router.get("/:id", checkAuthenticated, async (req, res) => {
	const { id } = req.params;
	const query = `SELECT e.*, json_agg(u) -> 0 AS user,
					COALESCE(json_agg(DISTINCT i) FILTER (WHERE i.id IS NOT NULL), '[]') AS issues,
					COALESCE(json_agg(DISTINCT jsonb_build_object('id', er.id, 'rule', er.rule)) FILTER (WHERE er.id IS NOT NULL), '[]') AS rules
					FROM events AS e
					JOIN users AS u ON e.creatorId = u.id AND e.id = $1 AND e.deletedAt IS NULL
					LEFT JOIN eventRules AS er ON er.eventId = e.id
					LEFT JOIN addressedIssues AS a ON a.eventId = e.id
					JOIN issuetypes AS i ON a.issuetypeid = i.id
					GROUP BY e.id
					ORDER BY e.createdAt DESC`;
	try {
		const result = await pool.query(query, [id]);
		sendResponse(res, 200, result.rows);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

//create an event
router.post("/", checkAuthenticated, async (req, res) => {
	const { issueIds, rules, ...eventData } = req.body;
	if (issueIds) {
		if (issueIds.length === 0) {
			return sendError(res, 400, "Please select atleast one issue");
		} else if (issueIds.length > 3) {
			return sendError(res, 400, "Please select only a maximum of 3 issues");
		}
	}
	if (rules && rules.length === 0) {
		return sendError(res, 400, "Please add atleast one rule");
	}
	eventData.creatorId = req.user.id;
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
		const eventRulesArray = rules.map((rule) => [eventId, rule]);

		const addressedIssuesQuery = format(
			"INSERT INTO addressedIssues VALUES %L RETURNING *",
			addressedIssuesArray,
		);
		const eventRulesQuery = format(
			"INSERT INTO eventRules (eventid, rule) VALUES %L RETURNING *",
			eventRulesArray,
		);

		const addressedIssuesPromise = pool.query(addressedIssuesQuery);
		const eventRulesPromise = pool.query(eventRulesQuery);

		const result = await Promise.all([addressedIssuesPromise, eventRulesPromise]);

		const addressedIssuesResult = result[0].rows;
		const eventRulesResult = result[1].rows;

		sendResponse(res, 201, {
			...event,
			addressedIssues: addressedIssuesResult,
			eventRules: eventRulesResult,
		});
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

//edit an event
router.patch(
	"/",
	[checkAuthenticated, checkIsEventCreator],
	async (req, res) => {
		const { eventId, ...eventData } = req.body;
		delete eventData.creatorId;
		if (!eventId) {
			return sendError(res, 400, "Please provide an event id");
		}
		const sets = Object.entries(eventData).map(([key, value]) =>
			format("%s = %L", key, value),
		);

		const query = format(
			"UPDATE events SET %s, updatedAt = NOW() WHERE id = %s RETURNING *",
			sets.join(", "),
			eventId,
		);
		try {
			const result = await pool.query(query);
			sendResponse(res, 200, result.rows[0]);
		} catch (e) {
			sendError(res, 400, e.message);
		}
	},
);

//delete an event
router.delete(
	"/:eventId",
	[checkAuthenticated, checkIsEventCreator],
	async (req, res) => {
		const { eventId } = req.params;
		const query = `UPDATE events SET deletedAt = NOW() WHERE id = $1 AND deletedAt IS NULL`;
		try {
			await pool.query(query, [eventId]);
			sendResponse(res, 200);
		} catch (e) {
			sendError(res, 400, e.message);
		}
	},
);

module.exports = router;

// todo:
// event geolocation filter with coordinates and radius
