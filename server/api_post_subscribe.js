//
// API function: POST /subscribe
//
// Adds an email address to the subscribers table so that the user
// receives a notification email whenever a new pet is listed for adoption.
//
// Request body (JSON):
//   { email: string }
//
// Returns:
//   { message: "success", subid: N }
//

const { get_dbConn } = require('./helper.js');

const pRetry = (...args) => import('p-retry').then(({ default: pRetry }) => pRetry(...args));


exports.post_subscribe = async (request, response) => {
  try {
    console.log("**Call to POST /subscribe...");

    const { email } = request.body;

    if (!email) {
      return response.status(400).json({ message: "email is required" });
    }

    let subid;
    await pRetry(async () => {
      let dbConn;
      try {
        dbConn = await get_dbConn();
        await dbConn.beginTransaction();

        const [result] = await dbConn.execute(
          'INSERT INTO subscribers (email) VALUES (?)',
          [email]
        );

        subid = result.insertId;
        await dbConn.commit();
      } catch (err) {
        try { await dbConn.rollback(); } catch (_) {}
        // Duplicate email: treat as success (already subscribed)
        if (err.code === 'ER_DUP_ENTRY') {
          subid = -1;
          return;
        }
        throw err;
      } finally {
        try { if (dbConn) await dbConn.end(); } catch (_) {}
      }
    }, { retries: 2 });

    console.log("sending response...");

    if (subid === -1) {
      return response.json({ message: "already subscribed", subid: -1 });
    }

    response.json({ message: "success", subid: subid });

  } catch (err) {
    console.log("ERROR:", err.message);
    response.status(500).json({ message: err.message });
  }
};
