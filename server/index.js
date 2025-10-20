// Express server for push notifications
const express = require('express');
const cors = require('cors');
// Push notification features removed
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://wlzuzohbuonvfnembyyl.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Broadcast endpoint removed
app.post('/send-broadcast-notification', (_req, res) => {
  return res.status(410).json({ error: 'Push notifications have been removed' });
});

// Game invitation endpoint removed
app.post('/send-game-invitation', (_req, res) => {
  return res.status(410).json({ error: 'Push notifications have been removed' });
});

// User notification endpoint removed
app.post('/send-user-notification', (_req, res) => {
  return res.status(410).json({ error: 'Push notifications have been removed' });
});

// Validate environment before starting
console.log('🔍 Environment check:', {
  port: PORT,
  supabaseUrl: supabaseUrl,
  supabaseKeyPresent: !!supabaseServiceKey,
  nodeEnv: process.env.NODE_ENV
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Push notification server running on port ${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/health`);
  console.log(`🔑 Supabase connection: ${supabaseUrl}`);
});

module.exports = app;
