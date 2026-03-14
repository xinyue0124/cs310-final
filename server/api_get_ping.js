//
// API function: GET /ping
//
// Health check — returns (M, N) where:
//   M = number of pet photos in S3 bucket
//   N = number of pets in the database
//
// Runs both queries concurrently via Promise.all (same pattern as Project 02).
//

const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { get_dbConn, get_bucket, get_bucket_name } = require('./helper.js');

const pRetry = (...args) => import('p-retry').then(({ default: pRetry }) => pRetry(...args));


exports.get_ping = async (request, response) => {

  async function get_M() {
    const bucket = get_bucket();
    const cmd    = new ListObjectsV2Command({ Bucket: get_bucket_name() });
    return bucket.send(cmd);
  }

  async function get_N() {
    let dbConn;
    try {
      dbConn = await get_dbConn();
      return dbConn.execute('SELECT COUNT(petid) AS num_pets FROM pets');
    } finally {
      try { if (dbConn) await dbConn.end(); } catch (_) {}
    }
  }

  try {
    console.log("**Call to GET /ping...");

    const [s3Result, dbResult] = await Promise.all([
      get_M(),
      pRetry(() => get_N(), { retries: 2 })
    ]);

    const M      = parseInt(s3Result['KeyCount']);
    const [rows] = dbResult;
    const N      = rows[0]['num_pets'];

    console.log(`M: ${M}, N: ${N}`);
    console.log("sending response...");

    response.json({ message: "success", M, N });

  } catch (err) {
    console.log("ERROR:", err.message);
    response.status(500).json({ message: err.message, M: -1, N: -1 });
  }
};
