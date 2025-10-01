const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withGoogleServices = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const googleServicesJson = process.env.GOOGLE_SERVICES_JSON;
      
      if (googleServicesJson) {
        const filePath = path.join(config.modRequest.platformProjectRoot, 'app', 'google-services.json');
        
        // Ensure the directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        // Write the google-services.json file
        fs.writeFileSync(filePath, googleServicesJson);
        console.log('✅ Successfully wrote google-services.json from environment variable');
      } else {
        console.warn('⚠️ GOOGLE_SERVICES_JSON environment variable not found');
      }
      
      return config;
    },
  ]);
};

module.exports = withGoogleServices;
