//
// App-wide config parameters for Pet Rescue web service.
// AWS credentials and API keys live in petrescue-config.ini (not in code).
//

const config = {
  petrescue_config_filename: "petrescue-config.ini",
  petrescue_s3_profile: "s3readwrite",
  web_service_port: 8080,
  response_page_size: 20
};

module.exports = config;
