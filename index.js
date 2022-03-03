const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { getUserByUsername, getUserById } = require("./helper");
const initializePassport = require("./passport-config");
const session = require("express-session");
const passport = require("passport");

const authenticationRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const eventRoutes = require("./routes/events");
const addressedIssuesRoutes = require("./routes/addressedIssues");
const eventParticipantsRoutes = require("./routes/eventParticipants");
const userPastEventsRoutes = require("./routes/userPastEvents");

const PORT = process.env.PORT || "8080";

const app = express();

initializePassport(getUserByUsername, getUserById);

//Middlewares
app.use(cors({ origin: true }));
app.use(express.json());
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

app.listen(PORT, () => {
	console.log(`server started on port ${PORT}`);
});
