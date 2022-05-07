const { sendError, getEventCreator } = require("./helper");

const checkAdmin = (req, res, next) => {
	if (req.isAuthenticated() && req.user.isadmin) {
		return next();
	}
	return sendError(res, 401, "unauthenticated or not admin");
};

const checkAuthenticated = (req, res, next) => {
	if (req.isAuthenticated()) {
		return next();
	}
	return sendError(res, 401, "unauthenticated");
};

const checkNotAuthenticated = (req, res, next) => {
	if (req.isUnauthenticated()) {
		return next();
	}
	return sendError(res, 400, "authenticated");
};

const checkIsEventCreator = async (req, res, next) => {
	if (req.user.isadmin) return next();
	const eventId = req.body.eventId || req.params.eventId;
	if (!eventId) {
		return sendError(res, 400, "eventId is required");
	}
	const userId = req.user.id;
	try {
		const result = await getEventCreator(eventId, userId);
		if (result) {
			return next();
		}
		return sendError(res, 400, "user is not an event creator");
	} catch (e) {
		return sendError(res, 400, e.message);
	}
};

const checkIsNotEventCreator = async (req, res, next) => {
	if (req.user.isadmin) return next();
	const eventId = req.body.eventId || req.params.eventId;
	if (!eventId) {
		return sendError(res, 400, "eventId is required");
	}
	const userId = req.user.id;
	try {
		const result = await getEventCreator(eventId, userId);
		if (!result) {
			return next();
		}
		return sendError(res, 400, "user is an event creator");
	} catch (e) {
		return sendError(res, 400, e.message);
	}
};

module.exports = {
	checkAuthenticated,
	checkNotAuthenticated,
	checkIsEventCreator,
	checkIsNotEventCreator,
	checkAdmin,
};
