// Express server for push notifications
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { sendPushNotifications, sendBroadcastNotification } = require('./pushNotificationSender');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://wlzuzohbuonvfnembyyl.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('⚠️ Server will start but push notifications will not work');
  // Don't exit - let the server start for health checks
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    
    if (!supabaseServiceKey) {
      console.error('❌ SUPABASE_SERVICE_ROLE_KEY not configured');
      return res.status(500).json({ error: 'Push notifications not configured' });
    }
    
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

// Send game invitation notification
app.post('/send-game-invitation', async (req, res) => {
  try {
    console.log('🎮 Received game invitation request');
    console.log('📥 Request body:', req.body);
    
    if (!supabaseServiceKey) {
      console.error('❌ SUPABASE_SERVICE_ROLE_KEY not configured');
      return res.status(500).json({ error: 'Push notifications not configured' });
    }
    
    const { userId, title, message, data = {} } = req.body;

    if (!userId || !title || !message) {
      console.log('❌ Missing required fields:', { userId: !!userId, title: !!title, message: !!message });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`🔍 Looking up user ${userId} for push token...`);
    
    // Get user's push token
    const { data: user, error } = await supabase
      .from('user_profiles')
      .select('push_token, username, email')
      .eq('id', userId)
      .single();

    if (error || !user) {
      console.error('❌ User not found:', error);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`👤 Found user: ${user.email}, has push token: ${!!user.push_token}`);

    if (!user.push_token) {
      console.log(`ℹ️ No push token for user ${user.email}, skipping push notification`);
      return res.json({
        success: true,
        sentCount: 0,
        failedCount: 0,
        message: 'No push token available'
      });
    }

    console.log(`📱 Sending push notification to ${user.email} with token: ${user.push_token.substring(0, 20)}...`);

    // Send notification
    const result = await sendPushNotifications([user.push_token], title, message, data);

    console.log(`✅ Game invitation notification sent to ${user.email}:`, result);
    res.json({
      success: true,
      sentCount: result.success,
      failedCount: result.failed,
      totalTokens: 1
    });

  } catch (error) {
    console.error('❌ Game invitation error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Send notification to specific user
app.post('/send-user-notification', async (req, res) => {
  try {
    if (!supabaseServiceKey) {
      console.error('❌ SUPABASE_SERVICE_ROLE_KEY not configured');
      return res.status(500).json({ error: 'Push notifications not configured' });
    }
    
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Push notification server running on port ${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/health`);
  console.log(`🔑 Supabase connection: ${supabaseUrl}`);
});

module.exports = app;
