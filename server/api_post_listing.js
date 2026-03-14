//
// NON-TRIVIAL OPERATION #2
//
// API function: POST /listing
//
// Adds a new custom rescue pet listing. This endpoint performs three steps
// that make it non-trivial:
//   (a) Uploads the pet photo to S3
//   (b) Calls AWS Rekognition to automatically detect and tag the animal
//       species (cat, dog, etc.) from the uploaded photo
//   (c) Emails all current subscribers via Amazon SES to notify them of
//       the new pet listing
//
// Request body (JSON):
//   {
//     name:        string  (pet's name, required)
//     breed:       string  (optional; Rekognition can help confirm)
//     age_years:   float   (optional)
//     description: string  (optional)
//     data:        string  (base64-encoded JPEG/PNG photo, required)
//   }
//
// Returns:
//   { message: "success", petid: N, species: "cat"|"dog"|"animal",
//     rekognition_labels: [...], subscribers_emailed: N }
//

const { v4: uuidv4 } = require('uuid');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { DetectLabelsCommand } = require('@aws-sdk/client-rekognition');
const { SendEmailCommand } = require('@aws-sdk/client-ses');
const { get_dbConn, get_bucket, get_bucket_name,
        get_rekognition, get_ses, get_sender_email } = require('./helper.js');

const pRetry = (...args) => import('p-retry').then(({ default: pRetry }) => pRetry(...args));


exports.post_listing = async (request, response) => {
  try {
    console.log("**Call to POST /listing...");

    const { name, breed, age_years, description, data } = request.body;

    if (!name || !data) {
      return response.status(400).json({
        message: "name and data (base64 photo) are required"
      });
    }

    // ── Step 1: Upload photo to S3 ────────────────────────────────────────────
    const imageBuffer = Buffer.from(data, 'base64');
    const bucketKey   = uuidv4() + '.jpg';
    const bucket      = get_bucket();
    const bucketName  = get_bucket_name();

    console.log("uploading photo to S3...");

    const putCmd = new PutObjectCommand({
      Bucket:      bucketName,
      Key:         bucketKey,
      Body:        imageBuffer,
      ContentType: 'image/jpeg'
    });
    await bucket.send(putCmd);

    // ── Step 2: Rekognition — auto-detect animal species ──────────────────────
    console.log("calling Rekognition to detect species...");

    const rekognition = get_rekognition();
    const detectCmd   = new DetectLabelsCommand({
      Image: { S3Object: { Bucket: bucketName, Name: bucketKey } },
      MinConfidence: 60
    });
    const rekResult = await rekognition.send(detectCmd);

    const labels = rekResult.Labels || [];

    // Determine species from Rekognition labels (highest-confidence animal type wins)
    const SPECIES_LABELS = ['Cat', 'Dog', 'Bird', 'Rabbit', 'Hamster', 'Guinea Pig'];
    let detectedSpecies = 'animal';
    let topConfidence   = 0;
    const topLabels     = [];

    for (const label of labels) {
      topLabels.push({ name: label.Name, confidence: parseFloat(label.Confidence.toFixed(1)) });
      if (SPECIES_LABELS.includes(label.Name) && label.Confidence > topConfidence) {
        detectedSpecies = label.Name.toLowerCase();
        topConfidence   = label.Confidence;
      }
    }

    console.log(`Rekognition detected species: ${detectedSpecies} (confidence: ${topConfidence.toFixed(1)}%)`);

    // ── Step 3: Insert pet into MySQL ─────────────────────────────────────────
    console.log("inserting pet into database...");

    let petid;
    await pRetry(async () => {
      let dbConn;
      try {
        dbConn = await get_dbConn();
        await dbConn.beginTransaction();

        const [result] = await dbConn.execute(
          `INSERT INTO pets (name, species, breed, age_years, description, photo_key, source)
           VALUES (?, ?, ?, ?, ?, ?, 'rescue')`,
          [
            name,
            detectedSpecies,
            breed    || null,
            age_years != null ? parseFloat(age_years) : null,
            description || null,
            bucketKey
          ]
        );

        petid = result.insertId;
        await dbConn.commit();
      } catch (err) {
        try { await dbConn.rollback(); } catch (_) {}
        throw err;
      } finally {
        try { if (dbConn) await dbConn.end(); } catch (_) {}
      }
    }, { retries: 2 });

    // ── Step 4: SES — email all subscribers about new pet ─────────────────────
    console.log("fetching subscribers for email notification...");

    let subscriberEmails = [];
    await pRetry(async () => {
      let dbConn;
      try {
        dbConn = await get_dbConn();
        const [rows] = await dbConn.execute('SELECT email FROM subscribers');
        subscriberEmails = rows.map(r => r.email);
      } finally {
        try { if (dbConn) await dbConn.end(); } catch (_) {}
      }
    }, { retries: 2 });

    let subscribersEmailed = 0;
    if (subscriberEmails.length > 0) {
      console.log(`sending new-pet alert emails to ${subscriberEmails.length} subscriber(s)...`);

      const ses         = get_ses();
      const senderEmail = get_sender_email();

      // SES allows max 50 recipients per call; for a small rescue this is fine
      const emailCmd = new SendEmailCommand({
        Source: senderEmail,
        Destination: { ToAddresses: subscriberEmails },
        Message: {
          Subject: {
            Data:    `🐾 New pet available for adoption: ${name}!`,
            Charset: 'UTF-8'
          },
          Body: {
            Text: {
              Data: [
                `Hi there!`,
                ``,
                `A new pet has just been listed for adoption on our rescue platform.`,
                ``,
                `Name:        ${name}`,
                `Species:     ${detectedSpecies}`,
                `Breed:       ${breed || 'Unknown'}`,
                `Age:         ${age_years != null ? age_years + ' years' : 'Unknown'}`,
                `Description: ${description || 'No description provided.'}`,
                ``,
                `Visit our site to meet ${name} and submit an adoption application!`,
                ``,
                `— The Pet Rescue Team`
              ].join('\n'),
              Charset: 'UTF-8'
            }
          }
        }
      });

      await ses.send(emailCmd);
      subscribersEmailed = subscriberEmails.length;
      console.log("subscriber emails sent successfully");
    }

    console.log("sending response...");

    response.json({
      message:              "success",
      petid:                petid,
      species:              detectedSpecies,
      rekognition_labels:   topLabels.slice(0, 10),
      subscribers_emailed:  subscribersEmailed
    });

  } catch (err) {
    console.log("ERROR:");
    console.log(err.message);

    response.status(500).json({
      message: err.message
    });
  }
};
