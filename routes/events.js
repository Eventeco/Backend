const express = require("express");
const {
	sendResponse,
	sendError,
	getEvents,
	s3PutBase64Image,
	s3DeleteImage,
	filterQueries,
	eventsInLocation,
	eventsFilteringStatus,
	isDifferent,
	findDifference,
} = require("../helper");
const format = require("pg-format");
const pool = require("../dbPool");
const { checkAuthenticated, checkIsEventCreator } = require("../middlewares");

const router = express.Router();

//get all events and filter events by name, description, type, isDonationEnabled, radius, lat, lng
router.get("/", checkAuthenticated, async (req, res) => {
	const {
		name,
		description,
		type,
		isDonationEnabled,
		issues,
		latitude,
		longitude,
		radius,
		status = eventsFilteringStatus.ALL,
	} = req.query;

	if ((latitude || longitude || radius) && !(latitude && longitude && radius)) {
		return sendError(res, 400, "location and radius must be provided together");
	}

	const allStatuses = [
		eventsFilteringStatus.ALL,
		eventsFilteringStatus.COMPLETED,
		eventsFilteringStatus.UPCOMING,
	];
	if (status && !allStatuses.includes(status)) {
		return sendError(
			res,
			400,
			"status must be one of: " + allStatuses.join(", "),
		);
	}

	const { issuesFilteringQuery, eventsFilteringQuery } = filterQueries({
		name,
		description,
		type,
		isDonationEnabled,
		issues,
		status,
	});

	const query = `SELECT DISTINCT(e.id), e.latitude, e.longitude
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
		let selectedEvents = result.rows;
		if (latitude && longitude && radius) {
			selectedEvents = eventsInLocation(result.rows, {
				latitude,
				longitude,
				radius,
			});
			if (selectedEvents.length === 0) {
				return sendResponse(res, 200, []);
			}
		}
		const ids = selectedEvents.map((row) => row.id);
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
					JOIN users AS u ON e.creatorId = u.id AND e.deletedAt IS NULL AND e.id != $1 AND e.starttime > NOW()
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
		sendResponse(res, 200, result.rows[0]);
	} catch (e) {
		sendError(res, 400, e.message);
	}
});

//create an event
router.post("/", async (req, res) => {
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
	eventData.creatorId = 25;
	if (coverImage) {
		const key = await s3PutBase64Image(coverImage);
		eventData.picturepath = key;
	}
	const cols = Object.keys(eventData);
	const values = Object.values(eventData);
	const eventQuery = format(
		"INSERT INTO events (%s) VALUES (%L) RETURNING *",
		cols,
		values,
	);
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
		participantscount: 0,
	});
});

//edit an event
router.patch(
	"/",
	[checkAuthenticated, checkIsEventCreator],
	async (req, res) => {
		const { eventId, issueIds, images, rules, coverPhoto, ...eventData } =
			req.body;
		delete eventData.creatorId;
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

		const getInformationQuery = `SELECT e.picturepath AS current_cover,
		COALESCE(json_agg(DISTINCT i.id) FILTER (WHERE i.id IS NOT NULL), '[]') AS current_issues,
		COALESCE(json_agg(DISTINCT er.rule) FILTER (WHERE er.id IS NOT NULL), '[]') AS current_rules,
		COALESCE(json_agg(DISTINCT ep.picturepath) FILTER (WHERE ep.id IS NOT NULL), '[]') AS current_pictures
		FROM events e
		LEFT JOIN addressedIssues a ON e.id = a.eventid
		LEFT JOIN issuetypes i ON a.issuetypeid = i.id
		LEFT JOIN eventRules er ON e.id = er.eventid
		LEFT JOIN eventPictures ep ON e.id = ep.eventid
		WHERE e.id = $1
		GROUP BY e.picturepath`;

		try {
			await pool.query(query);
			const informationResult = await pool.query(getInformationQuery, [eventId]);
			const information = informationResult.rows[0];
			const { current_cover, current_issues, current_rules, current_pictures } =
				information;

			if (coverPhoto) {
				const imagePromise = [];
				imagePromise.push(s3PutBase64Image(coverPhoto));
				imagePromise.push(s3DeleteImage(current_cover));
				const imageKey = await Promise.all(imagePromise);
				const updateCoverQuery = "UPDATE events SET picturepath = $2 WHERE id = $1";
				await pool.query(updateCoverQuery, [eventId, imageKey[0]]);
			}
			if (isDifferent(current_issues, issueIds)) {
				const addressedIssuesDeleteQuery =
					"DELETE FROM addressedIssues WHERE eventid = $1";
				const addressedIssuesInsertQuery = format(
					"INSERT INTO addressedIssues (eventid, issuetypeid) VALUES %L RETURNING *",
					issueIds.map((issueId) => [eventId, issueId]),
				);
				await pool.query(addressedIssuesDeleteQuery, [eventId]);
				await pool.query(addressedIssuesInsertQuery);
			}

			if (isDifferent(current_rules, rules)) {
				const eventRulesDeleteQuery = "DELETE FROM eventRules WHERE eventid = $1";
				const eventRulesInsertQuery = format(
					"INSERT INTO eventRules (eventid, rule) VALUES %L RETURNING *",
					rules.map((rule) => [eventId, rule]),
				);
				await pool.query(eventRulesDeleteQuery, [eventId]);
				await pool.query(eventRulesInsertQuery);
			}

			if (isDifferent(current_pictures, images)) {
				const addedImages = findDifference(images, current_pictures);
				if (addedImages.length > 0) {
					const imagePromises = [];
					addedImages.forEach((image) => {
						imagePromises.push(s3PutBase64Image(image));
					});
					const imageKeys = await Promise.all(imagePromises);
					const imageKeysArray = imageKeys.map((key) => [eventId, key]);
					const eventPicturesInsertQuery = format(
						"INSERT INTO eventPictures (eventid, picturepath) VALUES %L RETURNING *",
						imageKeysArray,
					);
					await pool.query(eventPicturesInsertQuery);
				}
				const removedImages = findDifference(current_pictures, images);
				if (removedImages.length > 0) {
					const eventPicturesDeleteQuery = format(
						"DELETE FROM eventPictures WHERE eventid = %s AND picturepath IN (%L)",
						eventId,
						removedImages,
					);
					const imagePromises = [];
					removedImages.forEach((image) => {
						imagePromises.push(s3DeleteImage(image));
					});
					await Promise.all(imagePromises);
					await pool.query(eventPicturesDeleteQuery);
				}
			}
			const eventResult = await getEvents([eventId]);
			const event = eventResult.rows[0];
			sendResponse(res, 200, event);
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
