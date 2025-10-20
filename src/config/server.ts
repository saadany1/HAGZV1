// Server configuration for push notifications
export const SERVER_CONFIG = {
  // Update this URL to your actual server URL
  BASE_URL: 'https://web-production-2936d.up.railway.app', // Working server
  
  // Local development URL (for testing)
  LOCAL_URL: 'http://localhost:3000',
  
  // Endpoints
  ENDPOINTS: {
    BROADCAST_NOTIFICATION: '/send-broadcast-notification',
    GAME_INVITATION: '/send-game-invitation',
    USER_NOTIFICATION: '/send-user-notification',
    HEALTH: '/health'
  }
};

// Get the appropriate server URL based on environment
export const getServerUrl = () => {
  // Always use the deployed server for now
  return SERVER_CONFIG.BASE_URL;
};

// Helper function to build full endpoint URLs
export const getEndpointUrl = (endpoint: string) => {
  return `${getServerUrl()}${endpoint}`;
};
