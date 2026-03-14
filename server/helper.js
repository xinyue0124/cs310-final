//
// Pet Rescue helper functions — creates AWS and DB connections from config.
//
// Based on Project 02 helper.js; adds SES support for email notifications.
//

const fs = require('fs');
const ini = require('ini');
const config = require('./config.js');
const mysql2 = require('mysql2/promise');
const { RekognitionClient } = require('@aws-sdk/client-rekognition');
const { S3Client } = require('@aws-sdk/client-s3');
const { SESClient } = require('@aws-sdk/client-ses');
const { fromIni } = require('@aws-sdk/credential-providers');


/**
 * async get_dbConn
 *
 * @description Opens connection to MySQL RDS. Must be closed with .end() when done.
 * @returns {Promise<Connection>}
 */
async function get_dbConn() {
  const config_data = fs.readFileSync(config.petrescue_config_filename, 'utf-8');
  const app_config = ini.parse(config_data);
  const { endpoint, port_number, user_name, user_pwd, db_name } = app_config.rds;

  let dbConn = mysql2.createConnection({
    host: endpoint,
    port: port_number,
    user: user_name,
    password: user_pwd,
    database: db_name,
    multipleStatements: true
  });

  return dbConn;
}


/**
 * sync get_bucket
 *
 * @description Returns an S3Client configured from the ini file.
 * @returns {S3Client}
 */
function get_bucket() {
  const config_data = fs.readFileSync(config.petrescue_config_filename, 'utf-8');
  const app_config = ini.parse(config_data);

  return new S3Client({
    region: app_config.s3.region_name,
    maxAttempts: 3,
    defaultsMode: "standard",
    credentials: fromIni({ profile: config.petrescue_s3_profile })
  });
}


/**
 * sync get_bucket_name
 *
 * @description Returns the S3 bucket name from the ini file.
 * @returns {string}
 */
function get_bucket_name() {
  const config_data = fs.readFileSync(config.petrescue_config_filename, 'utf-8');
  const app_config = ini.parse(config_data);
  return app_config.s3.bucket_name;
}


/**
 * sync get_rekognition
 *
 * @description Returns a RekognitionClient configured from the ini file.
 * @returns {RekognitionClient}
 */
function get_rekognition() {
  const config_data = fs.readFileSync(config.petrescue_config_filename, 'utf-8');
  const app_config = ini.parse(config_data);

  return new RekognitionClient({
    region: app_config.s3.region_name,
    maxAttempts: 3,
    defaultsMode: "standard",
    credentials: fromIni({ profile: config.petrescue_s3_profile })
  });
}


/**
 * sync get_ses
 *
 * @description Returns an SESClient for sending notification emails.
 * The sender email must be verified in the AWS SES console.
 * @returns {SESClient}
 */
function get_ses() {
  const config_data = fs.readFileSync(config.petrescue_config_filename, 'utf-8');
  const app_config = ini.parse(config_data);

  return new SESClient({
    region: app_config.ses.region_name,
    maxAttempts: 3,
    defaultsMode: "standard",
    credentials: fromIni({ profile: config.petrescue_s3_profile })
  });
}


/**
 * sync get_sender_email
 *
 * @description Returns the verified SES sender email address from config.
 * @returns {string}
 */
function get_sender_email() {
  const config_data = fs.readFileSync(config.petrescue_config_filename, 'utf-8');
  const app_config = ini.parse(config_data);
  return app_config.ses.sender_email;
}


module.exports = {
  get_dbConn,
  get_bucket,
  get_bucket_name,
  get_rekognition,
  get_ses,
  get_sender_email
};
