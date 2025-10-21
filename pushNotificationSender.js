// server/pushNotificationSender.js
// This is a Node.js script to send push notifications using both Expo Push Service and Firebase Cloud Messaging
// Install: npm install expo-server-sdk-node firebase-admin

const { Expo } = require('expo-server-sdk');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let firebaseApp = null;
try {
  // Use the Firebase service account key from environment variable
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  
  if (serviceAccount) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccount)),
      projectId: 'hagz-v5'
    });
    console.log('✅ Firebase Admin SDK initialized successfully');
  } else {
    console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set');
  }
} catch (error) {
  console.warn('⚠️ Firebase Admin SDK not initialized:', error.message);
}

// Create a new Expo SDK client
const expo = new Expo();

/**
 * Send push notifications to multiple users (supports both Expo and Firebase tokens)
 * @param {string[]} tokens - Array of push tokens (Expo or Firebase)
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data to send with notification
 * @returns {Promise<object>} - Result with success/failure counts
 */
async function sendPushNotifications(tokens, title, body, data = {}) {
  console.log(`📤 Sending push notifications to ${tokens.length} devices...`);
  
  // Separate Expo and Firebase tokens
  const expoTokens = [];
  const firebaseTokens = [];
  
  for (const token of tokens) {
    if (Expo.isExpoPushToken(token)) {
      expoTokens.push(token);
    } else if (token && token.length > 50 && !token.startsWith('ExponentPushToken')) {
      // Firebase tokens are typically longer and don't start with ExponentPushToken
      firebaseTokens.push(token);
    } else {
      console.warn(`⚠️ Unknown token format: ${token.substring(0, 20)}...`);
    }
  }
  
  console.log(`🔍 Token breakdown: ${expoTokens.length} Expo tokens, ${firebaseTokens.length} Firebase tokens`);
  
  let totalSuccess = 0;
  let totalFailed = 0;
  
  // Send Expo notifications
  if (expoTokens.length > 0) {
    console.log('📱 Sending Expo notifications...');
    const expoResult = await sendExpoNotifications(expoTokens, title, body, data);
    totalSuccess += expoResult.success;
    totalFailed += expoResult.failed;
  }
  
  // Send Firebase notifications
  if (firebaseTokens.length > 0 && firebaseApp) {
    console.log('🔥 Sending Firebase notifications...');
    const firebaseResult = await sendFirebaseNotifications(firebaseTokens, title, body, data);
    totalSuccess += firebaseResult.success;
    totalFailed += firebaseResult.failed;
  } else if (firebaseTokens.length > 0 && !firebaseApp) {
    console.error('❌ Firebase tokens found but Firebase Admin SDK not initialized');
    totalFailed += firebaseTokens.length;
  }
  
  return {
    success: totalSuccess,
    failed: totalFailed,
    total: tokens.length
  };
}

/**
 * Send notifications via Expo Push Service
 */
async function sendExpoNotifications(tokens, title, body, data = {}) {
  const messages = [];
  
  for (const pushToken of tokens) {
    messages.push({
      to: pushToken,
      sound: 'notification_sound.wav',
      title: title,
      body: body,
      data: data,
      priority: 'high',
      channelId: 'NL', // Use HAGZ notification channel instead of default
    });
  }

  // The Expo push notification service accepts batches of notifications
  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  
  // Send the chunks to the Expo push notification service
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      console.log('📨 Expo chunk sent:', ticketChunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error('❌ Error sending Expo chunk:', error);
    }
  }

  // Count results
  let successCount = 0;
  let failureCount = 0;
  const invalidTokens = [];

  tickets.forEach((ticket, index) => {
    if (ticket.status === 'ok') {
      successCount++;
    } else {
      failureCount++;
      console.error(`❌ Failed to send notification to ${tokens[index]}:`, ticket);
      
      // Collect invalid tokens for cleanup
      if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
        invalidTokens.push(tokens[index]);
      }
    }
  });

  console.log(`✅ Results: ${successCount} success, ${failureCount} failed`);
  
  return {
    success: successCount,
    failed: failureCount,
    total: tokens.length,
    invalidTokens,
    tickets
  };
}

/**
 * Send notifications via Firebase Cloud Messaging
 */
async function sendFirebaseNotifications(tokens, title, body, data = {}) {
  if (!firebaseApp) {
    console.error('❌ Firebase Admin SDK not initialized');
    return { success: 0, failed: tokens.length, total: tokens.length };
  }

  const message = {
    notification: {
      title: title,
      body: body,
    },
    data: {
      ...data,
      // Convert all data values to strings (Firebase requirement)
      ...Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, String(value)])
      )
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'notification_sound.wav',
        channelId: 'NL',
        color: '#4CAF50',
        icon: 'notification_icon'
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'notification_sound.wav',
          badge: 1
        }
      }
    }
  };

  try {
    // Send to multiple tokens
    const response = await admin.messaging().sendMulticast({
      ...message,
      tokens: tokens
    });

    console.log('🔥 Firebase response:', {
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses.map((resp, index) => ({
        token: tokens[index].substring(0, 20) + '...',
        success: resp.success,
        error: resp.error?.message || null
      }))
    });

    return {
      success: response.successCount,
      failed: response.failureCount,
      total: tokens.length,
      responses: response.responses
    };
  } catch (error) {
    console.error('❌ Firebase send error:', error);
    return { success: 0, failed: tokens.length, total: tokens.length, error: error.message };
  }
}

/**
 * Test function to send a notification to a single token
 * Usage: node pushNotificationSender.js test "ExponentPushToken[YOUR_TOKEN_HERE]"
 */
async function testSingleNotification(token) {
  console.log('🧪 Testing single notification...');
  
  const result = await sendPushNotifications(
    [token],
    '🧪 Test Notification',
    'This is a test notification from the server!',
    { 
      screen: 'More',
      test: true,
      timestamp: new Date().toISOString()
    }
  );
  
  console.log('🧪 Test result:', result);
  return result;
}

/**
 * Send broadcast notification to all users (admin function)
 * This would typically be called from your API endpoint
 */
async function sendBroadcastNotification(title, message, userTokens, data = {}) {
  console.log('📢 Sending broadcast notification...');
  
  const result = await sendPushNotifications(
    userTokens,
    title,
    message,
    {
      ...data,
      type: 'broadcast',
      screen: 'More'
    }
  );
  
  return result;
}

// Command line interface for testing
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
📱 Push Notification Sender

Usage:
  node pushNotificationSender.js test <expo-push-token>
  node pushNotificationSender.js broadcast <title> <message> <token1,token2,...>

Examples:
  node pushNotificationSender.js test "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
  node pushNotificationSender.js broadcast "Hello" "Test message" "ExponentPushToken[xxx],ExponentPushToken[yyy]"
    `);
    process.exit(1);
  }
  
  const command = args[0];
  
  if (command === 'test' && args[1]) {
    testSingleNotification(args[1])
      .then(() => process.exit(0))
      .catch(error => {
        console.error('❌ Test failed:', error);
        process.exit(1);
      });
  } else if (command === 'broadcast' && args[1] && args[2] && args[3]) {
    const title = args[1];
    const message = args[2];
    const tokens = args[3].split(',');
    
    sendBroadcastNotification(title, message, tokens)
      .then((result) => {
        console.log('📢 Broadcast result:', result);
        process.exit(0);
      })
      .catch(error => {
        console.error('❌ Broadcast failed:', error);
        process.exit(1);
      });
  } else {
    console.error('❌ Invalid arguments');
    process.exit(1);
  }
}

module.exports = {
  sendPushNotifications,
  testSingleNotification,
  sendBroadcastNotification
};
