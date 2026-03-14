//
// NON-TRIVIAL OPERATION #1
//
// API function: GET /external_pets?type=cat&limit=10
//
// Calls The Cat API (https://thecatapi.com) or The Dog API (https://thedogapi.com)
// to fetch adoptable pet data and returns it in a unified JSON format.
//
// This is a non-trivial operation because the server makes a live HTTP request
// to an external third-party API, parses the response, and transforms it into
// our application's unified pet schema before returning it to the client.
//
// Query parameters:
//   limit - number of results to return (default 10, max 25)
//
// Returns:
//   { message: "success", count: N, pets: [...] }
//   Each pet: { external_id, image_url, species, name, breed,
//               description, life_span, temperament, source: "external" }
//

const axios = require('axios');
const fs = require('fs');
const ini = require('ini');
const config = require('./config.js');


exports.get_external_pets = async (request, response) => {
  try {
    console.log("**Call to GET /external_pets...");

    const limit = Math.min(parseInt(request.query.limit) || 10, 25);

    const config_data = fs.readFileSync(config.petrescue_config_filename, 'utf-8');
    const app_config = ini.parse(config_data);

    const apiUrl = `https://api.thecatapi.com/v1/images/search?limit=${limit}&has_breeds=1`;
    const apiKey = app_config.catapi.api_key;

    console.log("calling The Cat API...");

    const apiResponse = await axios.get(apiUrl, {
      headers: { 'x-api-key': apiKey },
      timeout: 10000
    });

    // Transform to our unified pet schema
    const pets = apiResponse.data.map(item => {
      const breed = item.breeds && item.breeds.length > 0 ? item.breeds[0] : null;
      return {
        external_id:     item.id,
        image_url:       item.url,
        species:         'cat',
        name:            breed?.name || 'Adoptable cat',
        breed:           breed?.name || 'Unknown',
        description:     breed?.description || '',
        life_span:       breed?.life_span || '',
        temperament:     breed?.temperament || '',
        weight_kg:       breed?.weight?.metric || '',
        intelligence:    breed?.intelligence || null,
        affection_level: breed?.affection_level || null,
        energy_level:    breed?.energy_level || null,
        source:          'external'
      };
    });

    console.log(`fetched ${pets.length} external pets`);
    console.log("sending response...");

    response.json({
      message: "success",
      count:   pets.length,
      pets:    pets
    });

  } catch (err) {
    console.log("ERROR:");
    console.log(err.message);

    response.status(500).json({
      message: err.message,
      pets:    []
    });
  }
};
