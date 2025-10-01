const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withGoogleServices = (config) => {
  // Write the file immediately when the plugin is loaded
  const googleServicesJson = process.env.GOOGLE_SERVICES_JSON;
  
  if (googleServicesJson && googleServicesJson !== '$GOOGLE_SERVICES_JSON') {
    try {
      // Write to project root
      const projectRootPath = path.join(process.cwd(), 'google-services.json');
      fs.writeFileSync(projectRootPath, googleServicesJson);
      console.log('✅ Successfully wrote google-services.json to project root from environment variable');
    } catch (error) {
      console.error('❌ Failed to write google-services.json:', error.message);
    }
  } else {
    console.warn('⚠️ GOOGLE_SERVICES_JSON environment variable not found or contains placeholder');
  }

  return withDangerousMod(config, [
    'android',
    async (config) => {
      const googleServicesJson = process.env.GOOGLE_SERVICES_JSON;
      
      if (googleServicesJson) {
        // Also write to android app directory during the build
        const androidAppPath = path.join(config.modRequest.platformProjectRoot, 'app', 'google-services.json');
        
        // Ensure the directory exists
        const dir = path.dirname(androidAppPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        // Write the google-services.json file
        fs.writeFileSync(androidAppPath, googleServicesJson);
        console.log('✅ Successfully wrote google-services.json to android app directory from environment variable');
      }
      
      return config;
    },
  ]);
};

module.exports = withGoogleServices;
