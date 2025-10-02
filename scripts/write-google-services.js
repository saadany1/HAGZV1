const fs = require('fs');
const path = require('path');

// This script writes the google-services.json file from the environment variable
// during the EAS build process

const googleServicesJson = process.env.GOOGLE_SERVICES_JSON;

if (!googleServicesJson) {
  console.error('GOOGLE_SERVICES_JSON environment variable is not set');
  process.exit(1);
}

try {
  // Write the file to the project root
  const filePath = path.join(__dirname, '..', 'google-services.json');
  fs.writeFileSync(filePath, googleServicesJson);
  console.log('✅ Successfully wrote google-services.json from environment variable');
} catch (error) {
  console.error('❌ Failed to write google-services.json:', error.message);
  process.exit(1);
}





