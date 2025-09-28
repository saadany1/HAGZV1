import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface PushToken {
  id: string;
  token: string;
  device_id?: string;
  platform?: string;
  created_at: string;
  last_used_at: string;
}

export class FCMPushNotificationService {
  private static instance: FCMPushNotificationService;
  private currentToken: string | null = null;
  private isRegistering = false;

  private constructor() {}

  static getInstance(): FCMPushNotificationService {
    if (!FCMPushNotificationService.instance) {
      FCMPushNotificationService.instance = new FCMPushNotificationService();
    }
    return FCMPushNotificationService.instance;
  }

  /**
   * Request notification permissions and register for FCM push notifications
   */
  async registerForPushNotifications(): Promise<{ success: boolean; token?: string; error?: string }> {
    if (this.isRegistering) {
      console.log('FCM push notification registration already in progress');
      return { success: false, error: 'Registration already in progress' };
    }

    this.isRegistering = true;

    try {
      console.log('Starting FCM push notification registration...');

      // Check if running on physical device
      if (!Device.isDevice) {
        console.log('Push notifications only work on physical devices');
        return { success: false, error: 'Push notifications only work on physical devices' };
      }

      // Register device for remote messages
      await messaging().registerDeviceForRemoteMessages();
      console.log('✅ Device registered for remote messages');

      // Request permissions (required for iOS, optional for Android 13+)
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('FCM notification permissions denied');
        return { success: false, error: 'FCM notification permissions denied' };
      }

      console.log('✅ FCM notification permissions granted');

      // Create notification channel for Android
      if (Platform.OS === 'android') {
        await this.createNotificationChannel();
      }

      // Get the FCM token
      const token = await messaging().getToken();
      console.log('🔥 FCM Token:', token);
      console.log('Token type:', token.startsWith('f') ? 'FCM Token' : 'Unknown token type');
      this.currentToken = token;

      // Save token to database
      const saveResult = await this.savePushToken(token);
      if (!saveResult.success) {
        console.error('Failed to save FCM push token:', saveResult.error);
        return { success: false, error: saveResult.error };
      }

      console.log('✅ FCM push token saved to database');
      return { success: true, token };

    } catch (error) {
      console.error('FCM push notification registration error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    } finally {
      this.isRegistering = false;
    }
  }

  /**
   * Create notification channel for Android
   */
  private async createNotificationChannel(): Promise<void> {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'HagzApp Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4CAF50',
        sound: 'notification_sound.wav',
        enableVibrate: true,
        enableLights: true,
        showBadge: true,
      });
      console.log('✅ Android notification channel created');
    } catch (error) {
      console.error('Failed to create notification channel:', error);
    }
  }

  /**
   * Save FCM push token to Supabase database
   */
  private async savePushToken(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const deviceId = await this.getDeviceId();
      const platform = Platform.OS;

      console.log('Saving FCM push token to database...', {
        userId: user.id,
        deviceId,
        platform,
        tokenPreview: token.substring(0, 20) + '...'
      });

      const { data, error } = await supabase.rpc('upsert_push_token', {
        p_user_id: user.id,
        p_token: token,
        p_device_id: deviceId,
        p_platform: platform
      });

      if (error) {
        console.error('Database error saving FCM push token:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ FCM push token saved with ID:', data);
      return { success: true };

    } catch (error) {
      console.error('Exception saving FCM push token:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get a unique device identifier
   */
  private async getDeviceId(): Promise<string> {
    try {
      // Use a combination of device info to create a unique ID
      const deviceName = Device.deviceName || 'unknown';
      const osVersion = Device.osVersion || 'unknown';
      const platform = Platform.OS;
      
      // Create a simple hash-like identifier
      const deviceString = `${platform}-${deviceName}-${osVersion}`;
      return deviceString.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
    } catch (error) {
      console.error('Error getting device ID:', error);
      return `${Platform.OS}-${Date.now()}`;
    }
  }

  /**
   * Get current FCM push token
   */
  getCurrentToken(): string | null {
    return this.currentToken;
  }

  /**
   * Get user's push tokens from database
   */
  async getUserPushTokens(): Promise<{ success: boolean; tokens?: PushToken[]; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const { data, error } = await supabase.rpc('get_user_push_tokens', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Error fetching user push tokens:', error);
        return { success: false, error: error.message };
      }

      return { success: true, tokens: data || [] };

    } catch (error) {
      console.error('Exception fetching user push tokens:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Remove a push token from database
   */
  async removePushToken(tokenId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('push_tokens')
        .update({ is_active: false })
        .eq('id', tokenId);

      if (error) {
        console.error('Error removing push token:', error);
        return { success: false, error: error.message };
      }

      return { success: true };

    } catch (error) {
      console.error('Exception removing push token:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Setup FCM notification listeners
   */
  setupNotificationListeners() {
    // Handle background messages
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('📱 FCM Message handled in the background!', remoteMessage);
    });

    // Handle foreground messages
    const unsubscribeForeground = messaging().onMessage(async remoteMessage => {
      console.log('📱 FCM Message received in foreground!', remoteMessage);
      
      // Show local notification when app is in foreground
      if (remoteMessage.notification) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: remoteMessage.notification.title || 'New Message',
            body: remoteMessage.notification.body || '',
            data: remoteMessage.data || {},
            sound: 'notification_sound.wav',
          },
          trigger: null, // Show immediately
        });
      }
    });

    // Handle notification taps (when app is opened from notification)
    const unsubscribeNotificationOpen = messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('📱 FCM Notification caused app to open from background state:', remoteMessage);
      this.handleNotificationTap(remoteMessage.data);
    });

    // Check if app was opened from a notification (when app was completely closed)
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('📱 FCM Notification caused app to open from quit state:', remoteMessage);
          this.handleNotificationTap(remoteMessage.data);
        }
      });

    // Handle Expo notification taps (for local notifications)
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('📱 Local notification tapped:', response);
      const data = response.notification.request.content.data;
      this.handleNotificationTap(data);
    });

    return () => {
      unsubscribeForeground();
      unsubscribeNotificationOpen();
      Notifications.removeNotificationSubscription(responseListener);
    };
  }

  /**
   * Handle notification tap navigation
   */
  private handleNotificationTap(data: any) {
    // Handle different notification types
    if (data?.type === 'team_chat_message') {
      // Navigate to team chat
      console.log('Navigate to team chat:', data.team_id);
    } else if (data?.type === 'match_found') {
      // Navigate to match details
      console.log('Navigate to match:', data.match_id);
    } else if (data?.type === 'game_invitation') {
      // Navigate to game details
      console.log('Navigate to game:', data.game_id);
    }
  }

  /**
   * Send a local test notification
   */
  async sendLocalTestNotification(): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "FCM Test Notification 🔥",
          body: "This is a test notification from HagzApp using FCM!",
          data: { type: 'test' },
          sound: 'notification_sound.wav',
        },
        trigger: { seconds: 1 },
      });
      console.log('✅ Local test notification scheduled');
    } catch (error) {
      console.error('Error sending local test notification:', error);
    }
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
      console.log('✅ All notifications cleared');
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }

  /**
   * Handle token refresh
   */
  setupTokenRefreshListener() {
    const unsubscribe = messaging().onTokenRefresh(token => {
      console.log('🔄 FCM Token refreshed:', token);
      this.currentToken = token;
      this.savePushToken(token);
    });

    return unsubscribe;
  }
}

// Export singleton instance
export const fcmPushNotificationService = FCMPushNotificationService.getInstance();

// Admin-only functions for sending FCM push notifications
export class AdminFCMService {
  /**
   * Send FCM push notification to specific tokens (admin only)
   */
  static async sendFCMNotification(
    tokens: string[],
    title: string,
    body: string,
    data?: any
  ): Promise<{ success: boolean; results?: any[]; error?: string }> {
    try {
      // Note: For production, you should use Firebase Admin SDK on your backend
      // This is a simplified example for testing
      console.log('Sending FCM notifications to', tokens.length, 'devices');
      console.log('Title:', title);
      console.log('Body:', body);
      console.log('Data:', data);

      // In a real implementation, you would send this to your backend
      // which would use Firebase Admin SDK to send the notifications
      console.log('⚠️ FCM notifications should be sent from backend using Firebase Admin SDK');
      
      return { success: true, results: [] };

    } catch (error) {
      console.error('Error sending FCM notifications:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get all active push tokens (admin only)
   */
  static async getAllActivePushTokens(): Promise<{ success: boolean; tokens?: any[]; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('get_all_active_push_tokens');

      if (error) {
        console.error('Error fetching all push tokens:', error);
        return { success: false, error: error.message };
      }

      return { success: true, tokens: data || [] };

    } catch (error) {
      console.error('Exception fetching all push tokens:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Send test FCM notification to all users or specific user (admin only)
   */
  static async sendTestNotification(
    targetUserId?: string,
    title: string = 'FCM Test Notification',
    body: string = 'This is a test FCM notification from HagzApp admin panel.'
  ): Promise<{ success: boolean; sentCount?: number; error?: string }> {
    try {
      // Get tokens from database
      const { data, error } = await supabase.rpc('send_test_notification', {
        p_target_user_id: targetUserId || null,
        p_title: title,
        p_body: body,
        p_data: { type: 'admin_test', timestamp: new Date().toISOString() }
      });

      if (error) {
        console.error('Error preparing test notification:', error);
        return { success: false, error: error.message };
      }

      if (!data || data.length === 0) {
        return { success: false, error: 'No active push tokens found' };
      }

      // Extract tokens and send notifications
      const tokens = data.map((item: any) => item.token).filter(Boolean);
      
      if (tokens.length === 0) {
        return { success: false, error: 'No valid tokens found' };
      }

      const sendResult = await this.sendFCMNotification(tokens, title, body, {
        type: 'admin_test',
        timestamp: new Date().toISOString()
      });

      if (!sendResult.success) {
        return { success: false, error: sendResult.error };
      }

      return { success: true, sentCount: tokens.length };

    } catch (error) {
      console.error('Exception sending test notification:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

export default fcmPushNotificationService;
