//
// Pet Rescue web service — Node.js / Express
// CS 310 Final Project, Winter 2026
//
// Architecture mirrors Project 02 (PhotoApp). Each API function lives
// in its own JS file for readability.
//
// Three non-trivial operations:
//   (1) GET /external_pets  — fetches live data from The Cat API / The Dog API
//   (2) POST /listing       — upload photo → S3 → Rekognition auto-tags species
//                             → inserts into DB → emails all subscribers via SES
//   (3) POST /apply/:petid  — adoption application → inserts into DB
//                             → sends SES confirmation email to applicant
//

const path = require('path');
const express = require('express');
const app = express();
const config = require('./config.js');

app.use(express.json({ strict: false, limit: "50mb" }));
app.use(express.static(path.join(__dirname, 'public')));

var startTime;

app.listen(config.web_service_port, () => {
  startTime = Date.now();
  console.log(`**Pet Rescue web service running on port ${config.web_service_port}...`);
  process.env.AWS_SHARED_CREDENTIALS_FILE = path.resolve(__dirname, config.petrescue_config_filename);
});

app.get('/', (request, response) => {
  try {
    let uptime = Math.round((Date.now() - startTime) / 1000);
    response.json({ "status": "running", "uptime_in_secs": uptime });
  } catch (err) {
    response.status(500).json({ "status": err.message });
  }
});


// ─── Health check ────────────────────────────────────────────────────────────
// GET /ping → S3 item count + DB pet count
let get_ping_file = require('./api_get_ping.js');
app.get('/ping', get_ping_file.get_ping);

// ─── Pets from local DB (trivial) ────────────────────────────────────────────
// GET /pets → all rescue-added pets
let get_pets_file = require('./api_get_pets.js');
app.get('/pets', get_pets_file.get_pets);

// ─── NON-TRIVIAL #1: External pet data ───────────────────────────────────────
// GET /external_pets?limit=10 → calls The Cat API
let get_external_pets_file = require('./api_get_external_pets.js');
app.get('/external_pets', get_external_pets_file.get_external_pets);

// ─── NON-TRIVIAL #2: Upload rescue pet listing ───────────────────────────────
// POST /listing → upload photo → S3 → Rekognition species tag → DB → SES emails
let post_listing_file = require('./api_post_listing.js');
app.post('/listing', post_listing_file.post_listing);

// ─── Retrieve pet photo from S3 (trivial) ────────────────────────────────────
// GET /image/:petid → returns base64-encoded photo
let get_image_file = require('./api_get_image.js');
app.get('/image/:petid', get_image_file.get_image);

// ─── Email subscribe (trivial) ───────────────────────────────────────────────
// POST /subscribe → adds email to subscribers table
let post_subscribe_file = require('./api_post_subscribe.js');
app.post('/subscribe', post_subscribe_file.post_subscribe);

// ─── NON-TRIVIAL #3a: Submit adoption application for rescue pet ──────────────
// POST /apply/:petid → insert application → SES confirmation email
let post_apply_file = require('./api_post_apply.js');
app.post('/apply/:petid', post_apply_file.post_apply);

// ─── NON-TRIVIAL #3b: Basket checkout for external catalog animals ────────────
// POST /checkout → SES confirmation email listing all basket animals
let post_checkout_file = require('./api_post_checkout.js');
app.post('/checkout', post_checkout_file.post_checkout);
