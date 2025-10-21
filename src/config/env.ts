// Environment Configuration
// Replace these values with your actual Supabase credentials

export const ENV = {
  SUPABASE_URL: 'https://wlzuzohbuonvfnembyyl.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsenV6b2hidW9udmZuZW1ieXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0Nzk3NDYsImV4cCI6MjA3MjA1NTc0Nn0.-dKTkyudknPxKfYALxzjREa1JSxDiusKKPmWAkKWkoU',
  
  // App Configuration
  APP_NAME: 'Hagz',
  APP_VERSION: '1.0.0',
  
  // Feature Flags
  ENABLE_SOCIAL_LOGIN: false,
  ENABLE_EMAIL_VERIFICATION: true,
  ENABLE_SUPABASE: true, // Enable Supabase now that we have credentials
  
  // API Endpoints (if needed)
  API_BASE_URL: 'https://web-production-397d5.up.railway.app',
};

// Debug: Log the API URL on startup
console.log('🔧 ENV.API_BASE_URL configured as:', ENV.API_BASE_URL);

// Validation
export const validateEnv = () => {
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  
  for (const key of required) {
    if (!ENV[key as keyof typeof ENV] || ENV[key as keyof typeof ENV] === `YOUR_${key}_HERE`) {
      console.warn(`⚠️  Missing or default value for ${key}. Please update your environment configuration.`);
    }
  }
};
