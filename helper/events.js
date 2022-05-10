const { insideCircle, distanceTo } = require("geolocation-utils");
const format = require("pg-format");
const pool = require("../dbPool");

const eventsFilteringStatus = {
	ALL: "all",
	COMPLETED: "completed",
	UPCOMING: "upcoming",
};

const getEvent = async (eventId) => {
	const query = `SELECT * FROM events WHERE id = $1`;
	const result = await pool.query(query, [eventId]);
	return result.rows[0];
};

const getEvents = (eventIds = []) => {
	if (eventIds.length === 0) {
		return [];
	}
	const query = format(
		`SELECT e.*, json_agg(u) -> 0 AS user,
					COALESCE(json_agg(DISTINCT i) FILTER (WHERE i.id IS NOT NULL), '[]') AS issues,
					COALESCE(json_agg(DISTINCT jsonb_build_object('id', er.id, 'rule', er.rule)) FILTER (WHERE er.id IS NOT NULL), '[]') AS rules,
					COALESCE(json_agg(DISTINCT ep) FILTER (WHERE ep.id IS NOT NULL), '[]') AS pictures,
					COUNT(DISTINCT evp.*) AS participantsCount,
					ROUND(AVG(f.rating), 2) AS averageRating
					FROM events AS e
					JOIN users AS u ON e.creatorId = u.id AND e.deletedAt IS NULL
					LEFT JOIN eventRules AS er ON er.eventId = e.id
					LEFT JOIN eventParticipants AS evp ON evp.eventId = e.id
					LEFT JOIN eventPictures AS ep ON ep.eventId = e.id
					LEFT JOIN addressedIssues AS a ON a.eventId = e.id
					LEFT JOIN eventfeedbackresponses AS f ON f.eventId = e.id
					JOIN issuetypes AS i ON a.issuetypeid = i.id
					WHERE e.id IN (%s)
					GROUP BY e.id
					ORDER BY e.createdAt DESC`,
		eventIds,
	);

	return pool.query(query);
};

const filterQueries = ({
	name,
	description,
	type,
	isDonationEnabled,
	issues,
	status,
}) => {
	const nameQuery = name ? format(` AND e.name ILIKE '%%%s%%'`, name) : "";
	const descriptionQuery = description
		? format(` AND e.description ILIKE '%%%s%%'`, description)
		: "";
	const typeQuery = type ? format(` AND e.type = %L`, type) : "";
	const isDonationEnabledQuery =
		isDonationEnabled === "true" ? ` AND e.isDonationEnabled = true` : "";
	let statusQuery = "";
	if (status === eventsFilteringStatus.COMPLETED) {
		statusQuery = ` AND e.endtime < NOW()`;
	} else if (status === eventsFilteringStatus.UPCOMING) {
		statusQuery = ` AND e.starttime > NOW()`;
	}

	const issuesFilteringQuery = issues
		? format(
				`WHERE a.issuetypeid IN (%s)`,
				issues.length > 0 ? issues.split(",").map(Number) : +issues,
		  )
		: "";
	const eventsFilteringQuery = `${nameQuery}${descriptionQuery}${typeQuery}${isDonationEnabledQuery}${statusQuery}`;

	return { issuesFilteringQuery, eventsFilteringQuery };
};

const eventsInLocation = (events, { latitude, longitude, radius }) => {
	return events.filter((row) => {
		const eventLocation = { lat: +row.latitude, lon: +row.longitude };
		const center = { lat: +latitude, lon: +longitude };
		if (insideCircle(eventLocation, center, +radius)) {
			return row;
		}
	});
};

const sortEventsByUserLocation = (userLocation, events) => {
	return events.sort((a, b) => {
		const aDistance = distanceTo(
			{ lat: +a.latitude, lon: +a.longitude },
			userLocation,
		);
		const bDistance = distanceTo(
			{ lat: +b.latitude, lon: +b.longitude },
			userLocation,
		);
		return aDistance - bDistance;
	});
};

module.exports = {
	eventsFilteringStatus,
	getEvent,
	getEvents,
	filterQueries,
	eventsInLocation,
	sortEventsByUserLocation,
};
