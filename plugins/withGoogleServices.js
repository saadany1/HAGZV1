const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withGoogleServices = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const googleServicesJson = process.env.GOOGLE_SERVICES_JSON;
      
      if (googleServicesJson) {
        // Write to project root first
        const projectRootPath = path.join(config.modRequest.projectRoot, 'google-services.json');
        fs.writeFileSync(projectRootPath, googleServicesJson);
        console.log('✅ Successfully wrote google-services.json to project root from environment variable');
        
        // Also write to android app directory
        const androidAppPath = path.join(config.modRequest.platformProjectRoot, 'app', 'google-services.json');
        
        // Ensure the directory exists
        const dir = path.dirname(androidAppPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        // Write the google-services.json file
        fs.writeFileSync(androidAppPath, googleServicesJson);
        console.log('✅ Successfully wrote google-services.json to android app directory from environment variable');
      } else {
        console.warn('⚠️ GOOGLE_SERVICES_JSON environment variable not found');
      }
      
      return config;
    },
  ]);
};

module.exports = withGoogleServices;
