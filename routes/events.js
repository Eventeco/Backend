const express = require("express");
const {
	sendResponse,
	sendError,
	getEvents,
	s3PutBase64Image,
	s3DeleteImage,
} = require("../helper");
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
				`WHERE a.issuetypeid IN (%s)`,
				issues.length > 0 ? issues.split(",").map(Number) : +issues,
		  )
		: "";
	const eventsFilteringQuery = `${nameQuery}${descriptionQuery}${typeQuery}${isDonationEnabledQuery}`;

	const query = `SELECT e.id
					FROM events AS e
					JOIN users AS u ON e.creatorId = u.id AND e.deletedAt IS NULL ${eventsFilteringQuery}
					LEFT JOIN addressedIssues AS a ON a.eventId = e.id
					JOIN issuetypes AS i ON a.issuetypeid = i.id
					${issuesFilteringQuery}`;

	try {
		const result = await pool.query(query);
		if (result.rowCount === 0) {
			return sendResponse(res, 200, []);
		}
		const ids = result.rows.map((row) => row.id);
		const eventsResponse = await getEvents(ids);
		sendResponse(res, 200, eventsResponse.rows);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

//get suggested events based on event issues
router.get("/suggested/:id", checkAuthenticated, async (req, res) => {
	const { id } = req.params;

	const query = `SELECT DISTINCT e.id
					FROM events AS e
					JOIN users AS u ON e.creatorId = u.id AND e.deletedAt IS NULL AND e.id != $1
					LEFT JOIN addressedIssues AS a ON a.eventId = e.id
					JOIN issuetypes AS i ON a.issuetypeid = i.id AND i.id IN (
						SELECT issuetypeid FROM addressedIssues WHERE eventId = $1
					)`;

	try {
		const result = await pool.query(query, [id]);
		if (result.rowCount === 0) {
			return sendResponse(res, 200, []);
		}
		const ids = result.rows.map((row) => row.id);
		const eventsResponse = await getEvents(ids);
		sendResponse(res, 200, eventsResponse.rows);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

//get event by id
router.get("/:id", checkAuthenticated, async (req, res) => {
	const { id } = req.params;
	try {
		const result = await getEvents(id);
		sendResponse(res, 200, result.rows);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

//create an event
router.post("/", checkAuthenticated, async (req, res) => {
	const { issueIds, rules, coverImage, images, ...eventData } = req.body;
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
	if (coverImage) {
		try {
			const key = await s3PutBase64Image(coverImage);
			eventData.picturepath = key;
		} catch (e) {
			return sendError(res, 400, e.message);
		}
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
		const eventRulesArray = rules.map((rule) => [eventId, rule]);

		const addressedIssuesQuery = format(
			"INSERT INTO addressedIssues VALUES %L",
			addressedIssuesArray,
		);
		const eventRulesQuery = format(
			"INSERT INTO eventRules (eventid, rule) VALUES %L RETURNING *",
			eventRulesArray,
		);
		const issueTypesQuery = format(
			"SELECT * FROM issuetypes WHERE id IN (%L)",
			issueIds,
		);

		const promises = [];

		promises.push(pool.query(issueTypesQuery));
		promises.push(pool.query(eventRulesQuery));

		if (images && images.length > 0) {
			const imagePromises = [];
			images.forEach((image) => {
				imagePromises.push(s3PutBase64Image(image));
			});
			const imageKeys = await Promise.all(imagePromises);

			const imageKeysArray = imageKeys.map((key) => [eventId, key]);
			const eventPicturesQuery = format(
				"INSERT INTO eventPictures (eventid, picturepath) VALUES %L RETURNING *",
				imageKeysArray,
			);
			promises.push(pool.query(eventPicturesQuery));
		}

		promises.push(pool.query(addressedIssuesQuery));

		const result = await Promise.all(promises);

		const issueTypesResult = result[0].rows;
		const eventRulesResult = result[1].rows;
		const eventPicturesResult = result[2] ? result[2].rows : [];

		sendResponse(res, 201, {
			...event,
			issues: issueTypesResult,
			rules: eventRulesResult,
			pictures: eventPicturesResult,
			user: req.user,
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
		delete eventData.picturepath;
		delete eventData.deletedAt;
		delete eventData.createdAt;
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
		const getEventPicturepathQuery =
			"SELECT picturepath from events where id = $1";
		const getEventPicturesQuery =
			"SELECT picturepath from eventpictures where eventid = $1";
		const deleteQuery = `UPDATE events SET deletedAt = NOW(), picturepath = NULL WHERE id = $1 AND deletedAt IS NULL`;

		const deleteEventPicturesQuery =
			"DELETE FROM eventPictures WHERE eventid = $1";
		const deleteEventRulesQuery = "DELETE FROM eventRules WHERE eventid = $1";
		const deleteAddressedIssuesQuery =
			"DELETE FROM addressedIssues WHERE eventid = $1";
		const deleteEventParticipantsQuery = `DELETE FROM eventParticipants WHERE eventid = $1`;

		try {
			const getEventPicturepathResult = await pool.query(
				getEventPicturepathQuery,
				[eventId],
			);
			const getEventPicturesResult = await pool.query(getEventPicturesQuery, [
				eventId,
			]);

			const pictures = [];
			const picturepath = getEventPicturepathResult.rows[0].picturepath;
			if (picturepath) {
				pictures.push(picturepath);
			}

			const eventPictures = getEventPicturesResult.rows.map(
				(picture) => picture.picturepath,
			);
			if (eventPictures.length > 0) {
				pictures.push(...eventPictures);
			}

			const promises = [];
			for (let picture of pictures) {
				promises.push(s3DeleteImage(picture));
			}

			promises.push(pool.query(deleteEventPicturesQuery, [eventId]));
			promises.push(pool.query(deleteEventRulesQuery, [eventId]));
			promises.push(pool.query(deleteAddressedIssuesQuery, [eventId]));
			promises.push(pool.query(deleteEventParticipantsQuery, [eventId]));
			promises.push(pool.query(deleteQuery, [eventId]));

			await Promise.all(promises);
			sendResponse(res, 200);
		} catch (e) {
			sendError(res, 400, e.message);
		}
	},
);

module.exports = router;

// todo:
// event geolocation filter with coordinates and radius
