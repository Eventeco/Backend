const { S3Client, S3 } = require("@aws-sdk/client-s3");

const s3Client = new S3Client();

module.exports = s3Client;
