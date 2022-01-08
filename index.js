const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { sendResponse } = require("./helper");

const PORT = process.env.PORT || "8080";

const app = express();

//Middlewares
app.use(cors({ origin: true }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (_, res) => {
  sendResponse(res, 200, "Hello World");
});

app.listen(PORT, () => {
  console.log(`server started on port ${PORT}`);
});
