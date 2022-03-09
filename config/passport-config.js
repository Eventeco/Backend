const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const { comparePasswords } = require("../helper");

const initialize = (getUserByUsername, getUserById) => {
	const authenticateUser = async (username, password, done) => {
		const user = await getUserByUsername(username);
		if (user == null) {
			return done(null, false, { message: "user does not exist" });
		}
		try {
			const matchPasswords = await comparePasswords(password, user.password);
			if (matchPasswords) {
				return done(null, user);
			} else {
				return done(null, false, { message: "Password incorrect" });
			}
		} catch (e) {
			return done(e);
		}
	};

	passport.use(new LocalStrategy(authenticateUser));
	passport.serializeUser((user, done) => done(null, user.id));
	passport.deserializeUser(async (id, done) => {
		try {
			const user = await getUserById(id);
			return done(null, user);
		} catch (e) {
			return done(e);
		}
	});
};

module.exports = initialize;
