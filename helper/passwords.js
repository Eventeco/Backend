const bcrypt = require("bcrypt");

const cryptPassword = (password) => {
	return bcrypt.hash(password, 10);
};

const comparePasswords = (password, hashedPassword) => {
	return bcrypt.compare(password, hashedPassword);
};

module.exports = {
	cryptPassword,
	comparePasswords,
};
