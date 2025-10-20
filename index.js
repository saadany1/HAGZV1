// Express server for push notifications - HagzApp V5
const express = require('express');
const cors = require('cors');
const { sendPushNotifications, sendBroadcastNotification } = require('./pushNotificationSender');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://wlzuzohbuonvfnembyyl.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Environment variables check:', {
  supabaseUrl: supabaseUrl,
  supabaseKeyPresent: !!supabaseServiceKey,
  supabaseKeyLength: supabaseServiceKey ? supabaseServiceKey.length : 0
});

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

let supabase;
try {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
  console.log('✅ Supabase client created successfully');
} catch (error) {
  console.error('❌ Failed to create Supabase client:', error);
  process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Send broadcast notification to all users
app.post('/send-broadcast-notification', async (req, res) => {
  try {
    console.log('📨 Received broadcast notification request');
    const { title, message, data = {}, sound = true } = req.body;

    if (!title || !message) {
      console.log('❌ Missing title or message');
      return res.status(400).json({ error: 'Title and message are required' });
    }

    console.log('🔍 Fetching users with push tokens...');
    // Get all users with push tokens
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select('push_token')
      .not('push_token', 'is', null);

    if (error) {
      console.error('❌ Error fetching users:', error);
      return res.status(500).json({ error: 'Failed to fetch users', details: error.message });
    }

    console.log(`📊 Found ${users ? users.length : 0} users with push tokens`);

    if (!users || users.length === 0) {
      console.log('⚠️ No users with push tokens found');
      return res.status(404).json({ error: 'No users with push tokens found' });
    }

    const tokens = users.map(user => user.push_token).filter(token => token);
    console.log(`📱 Processing ${tokens.length} valid tokens`);

    // Send notifications
    const result = await sendBroadcastNotification(title, message, tokens, data);

    console.log('✅ Broadcast notification completed:', result);
    res.json({
      success: true,
      sentCount: result.success,
      failedCount: result.failed,
      totalTokens: tokens.length
    });

  } catch (error) {
    console.error('❌ Broadcast notification error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Send notification to specific user
app.post('/send-user-notification', async (req, res) => {
  try {
    const { userId, title, message, data = {} } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get user's push token
    const { data: user, error } = await supabase
      .from('user_profiles')
      .select('push_token')
      .eq('id', userId)
      .single();

    if (error || !user || !user.push_token) {
      return res.status(404).json({ error: 'User not found or no push token' });
    }

    // Send notification
    const result = await sendPushNotifications([user.push_token], title, message, data);

    res.json({
      success: true,
      sentCount: result.success,
      failedCount: result.failed
    });

  } catch (error) {
    console.error('User notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Validate environment before starting
console.log('🔍 Environment check:', {
  port: PORT,
  supabaseUrl: supabaseUrl,
  supabaseKeyPresent: !!supabaseServiceKey,
  nodeEnv: process.env.NODE_ENV
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error', details: error.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 HagzApp V5 Push notification server running on port ${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/health`);
  console.log(`🔑 Supabase connection: ${supabaseUrl}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;
