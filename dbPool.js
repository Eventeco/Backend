const { Pool } = require("pg");

const pool = new Pool({
	user: "hccefepojnhevc",
	host: "ec2-3-223-72-172.compute-1.amazonaws.com",
	database: "d68r71pptpoun0",
	password: "63c90506bdd2b27b82dbdd7280fc37046e64010d6ff96042a12f2c90020b455c",
	port: 5432,
	ssl: {
		rejectUnauthorized: false,
	},
});

module.exports = pool;
