//
// NON-TRIVIAL OPERATION #3
//
// API function: POST /apply/:petid
//
// Submits an adoption application for a pet. This endpoint is non-trivial
// because it:
//   (a) Validates the petid exists in the database
//   (b) Inserts the application record into MySQL
//   (c) Sends an automated confirmation email to the applicant via Amazon SES
//
// URL parameter:
//   petid - ID of the pet to apply for
//
// Request body (JSON):
//   {
//     applicant_name:  string  (required)
//     applicant_email: string  (required)
//     message:         string  (optional — "why do you want to adopt this pet?")
//   }
//
// Returns:
//   { message: "success", appid: N, petid: N, email_sent: true }
//

const { SendEmailCommand } = require('@aws-sdk/client-ses');
const { get_dbConn, get_ses, get_sender_email } = require('./helper.js');

const pRetry = (...args) => import('p-retry').then(({ default: pRetry }) => pRetry(...args));


exports.post_apply = async (request, response) => {
  try {
    console.log("**Call to POST /apply/:petid...");

    const petid = parseInt(request.params.petid);
    const { applicant_name, applicant_email, message } = request.body;

    if (!applicant_name || !applicant_email) {
      return response.status(400).json({
        message: "applicant_name and applicant_email are required"
      });
    }

    // ── Step 1: Verify pet exists and get its name ────────────────────────────
    console.log("verifying pet exists...");

    let petRow;
    await pRetry(async () => {
      let dbConn;
      try {
        dbConn = await get_dbConn();
        const [rows] = await dbConn.execute(
          'SELECT petid, name, species, breed FROM pets WHERE petid = ?',
          [petid]
        );
        if (!rows || rows.length === 0) {
          petRow = null;
        } else {
          petRow = rows[0];
        }
      } finally {
        try { if (dbConn) await dbConn.end(); } catch (_) {}
      }
    }, { retries: 2 });

    if (!petRow) {
      return response.status(400).json({ message: "no such petid" });
    }

    // ── Step 2: Insert adoption application into MySQL ────────────────────────
    console.log("inserting application into database...");

    let appid;
    await pRetry(async () => {
      let dbConn;
      try {
        dbConn = await get_dbConn();
        await dbConn.beginTransaction();

        const [result] = await dbConn.execute(
          `INSERT INTO applications (petid, applicant_name, applicant_email, message)
           VALUES (?, ?, ?, ?)`,
          [petid, applicant_name, applicant_email, message || null]
        );

        appid = result.insertId;
        await dbConn.commit();
      } catch (err) {
        try { await dbConn.rollback(); } catch (_) {}
        throw err;
      } finally {
        try { if (dbConn) await dbConn.end(); } catch (_) {}
      }
    }, { retries: 2 });

    // ── Step 3: SES — send confirmation email to applicant ────────────────────
    console.log(`sending confirmation email to ${applicant_email}...`);

    const ses         = get_ses();
    const senderEmail = get_sender_email();

    const emailCmd = new SendEmailCommand({
      Source: senderEmail,
      Destination: { ToAddresses: [applicant_email] },
      Message: {
        Subject: {
          Data:    `Your adoption application for ${petRow.name} has been received!`,
          Charset: 'UTF-8'
        },
        Body: {
          Text: {
            Data: [
              `Hi ${applicant_name},`,
              ``,
              `Thank you for submitting an adoption application! We have received your`,
              `request and will be in touch soon.`,
              ``,
              `Application details:`,
              `  Application ID:  ${appid}`,
              `  Pet name:        ${petRow.name}`,
              `  Species:         ${petRow.species}`,
              `  Breed:           ${petRow.breed || 'Unknown'}`,
              ``,
              message ? `Your message: "${message}"\n` : '',
              `We review all applications carefully to ensure every pet finds the`,
              `perfect home. We'll follow up within 3-5 business days.`,
              ``,
              `With gratitude,`,
              `— The Pet Rescue Team`
            ].join('\n'),
            Charset: 'UTF-8'
          }
        }
      }
    });

    await ses.send(emailCmd);
    console.log("confirmation email sent");

    console.log("sending response...");

    response.json({
      message:    "success",
      appid:      appid,
      petid:      petid,
      email_sent: true
    });

  } catch (err) {
    console.log("ERROR:");
    console.log(err.message);

    response.status(500).json({
      message: err.message
    });
  }
};
