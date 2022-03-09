const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { getUserByUsername, getUserById } = require("./helper");
const initializePassport = require("./config/passport-config");
const session = require("express-session");
const passport = require("passport");

const authenticationRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const eventRoutes = require("./routes/events");
const addressedIssuesRoutes = require("./routes/addressedIssues");
const eventParticipantsRoutes = require("./routes/eventParticipants");
const userPastEventsRoutes = require("./routes/userPastEvents");
const issueTypesRoutes = require("./routes/issueTypes");
const eventRules = require("./routes/eventRules");
const eventPictures = require("./routes/eventPictures");

const PORT = process.env.PORT || "8080";

const app = express();

initializePassport(getUserByUsername, getUserById);

//Middlewares
app.use(cors({ origin: true }));
app.use(express.json({ limit: "50mb" }));
app.use(morgan("dev"));
app.use(
	session({
		secret: "HFY12YJyHAh78BzFAkRd9nMTRW0ZUEFm",
		resave: false,
		saveUninitialized: false,
	}),
);
app.use(passport.initialize());
app.use(passport.session());

//Routes
app.use("", authenticationRoutes);
app.use("/user", userRoutes);
app.use("/events", eventRoutes);
app.use("/addressedIssues", addressedIssuesRoutes);
app.use("/eventParticipants", eventParticipantsRoutes);
app.use("/userPastEvents", userPastEventsRoutes);
app.use("/issueTypes", issueTypesRoutes);
app.use("/eventRules", eventRules);
app.use("/eventPictures", eventPictures);

app.listen(PORT, () => {
	console.log(`server started on port ${PORT}`);
});
