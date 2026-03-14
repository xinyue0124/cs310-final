//
// API function: GET /image/:petid
//
// Downloads a pet's photo from S3 and returns it as a base64-encoded string.
// The S3 key is looked up from the pets table in MySQL.
//
// URL parameter:
//   petid - the pet's ID in the database
//
// Returns:
//   { message: "success", petid: N, data: "<base64 string>" }
//

const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { get_dbConn, get_bucket, get_bucket_name } = require('./helper.js');

const pRetry = (...args) => import('p-retry').then(({ default: pRetry }) => pRetry(...args));


exports.get_image = async (request, response) => {
  const petid = parseInt(request.params.petid);

  try {
    console.log("**Call to GET /image/:petid...");

    // Look up the S3 key for this pet
    let photoKey;
    await pRetry(async () => {
      let dbConn;
      try {
        dbConn = await get_dbConn();
        const [rows] = await dbConn.execute(
          'SELECT photo_key FROM pets WHERE petid = ?',
          [petid]
        );
        if (!rows || rows.length === 0) {
          photoKey = null;
        } else {
          photoKey = rows[0].photo_key;
        }
      } finally {
        try { if (dbConn) await dbConn.end(); } catch (_) {}
      }
    }, { retries: 2 });

    if (!photoKey) {
      return response.status(400).json({ message: "no such petid", petid: -1 });
    }

    // Fetch from S3
    const bucket = get_bucket();
    const getCmd = new GetObjectCommand({
      Bucket: get_bucket_name(),
      Key:    photoKey
    });
    const s3Result  = await bucket.send(getCmd);
    const imageData = await s3Result.Body.transformToString('base64');

    console.log("sending response...");

    response.json({
      message: "success",
      petid:   petid,
      data:    imageData
    });

  } catch (err) {
    console.log("ERROR:", err.message);
    response.status(500).json({ message: err.message, petid: -1 });
  }
};
