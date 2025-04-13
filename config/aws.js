// config/aws.js
const AWS = require('aws-sdk');
const dotenv = require('dotenv');

dotenv.config();

// Configure AWS SDK with credentials and region
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

// Create and export AWS service clients
const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();
const sns = new AWS.SNS();
const lambda = new AWS.Lambda();
const cloudFront = new AWS.CloudFront();
const es = new AWS.ES();

module.exports = {
  AWS,
  s3,
  dynamoDB,
  cognito,
  sns,
  lambda,
  cloudFront,
  es
};