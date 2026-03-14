//
// API function: GET /pets
//
// Returns all rescue-added pet listings from the database (source = 'rescue').
// Sorted by most recently added first.
//
// Returns:
//   { message: "success", count: N, pets: [...] }
//

const { get_dbConn } = require('./helper.js');

const pRetry = (...args) => import('p-retry').then(({ default: pRetry }) => pRetry(...args));


exports.get_pets = async (request, response) => {
  try {
    console.log("**Call to GET /pets...");

    let pets;
    await pRetry(async () => {
      let dbConn;
      try {
        dbConn = await get_dbConn();
        const [rows] = await dbConn.execute(
          `SELECT petid, name, species, breed, age_years, description, photo_key,
                  source, created_at
           FROM pets
           ORDER BY created_at DESC`
        );
        pets = rows;
      } finally {
        try { if (dbConn) await dbConn.end(); } catch (_) {}
      }
    }, { retries: 2 });

    console.log(`found ${pets.length} pets`);
    console.log("sending response...");

    response.json({
      message: "success",
      count:   pets.length,
      pets:    pets
    });

  } catch (err) {
    console.log("ERROR:", err.message);
    response.status(500).json({ message: err.message, pets: [] });
  }
};
