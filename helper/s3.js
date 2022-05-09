require("dotenv").config();
const s3Client = require("../config/S3");
const {
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const randomstring = require("randomstring");

const BUCKET = process.env.AWS_BUCKET_NAME;

//put image in bucket
const s3PutBase64Image = async (base64) => {
	const buffer = Buffer.from(base64, "base64");
	const extensions = { "/": "jpg", i: "png", R: "gif", U: "webp" };
	const extension = extensions[base64.charAt(0)];
	const key = `${randomstring.generate()}.${extension}`;
	const uploadParams = {
		Bucket: BUCKET,
		Key: key,
		Body: buffer,
	};
	const command = new PutObjectCommand(uploadParams);
	await s3Client.send(command);
	return key;
};

//get image from s3 bucket
const s3GetImage = async (key) => {
	const getParams = {
		Bucket: BUCKET,
		Key: key,
	};
	const command = new GetObjectCommand(getParams);
	const response = await s3Client.send(command);
	return response;
};

//delete image from s3 bucket
const s3DeleteImage = async (key) => {
	const deleteParams = {
		Bucket: BUCKET,
		Key: key,
	};
	const command = new DeleteObjectCommand(deleteParams);
	const response = await s3Client.send(command);
	return response;
};

module.exports = {
	s3PutBase64Image,
	s3GetImage,
	s3DeleteImage,
};
