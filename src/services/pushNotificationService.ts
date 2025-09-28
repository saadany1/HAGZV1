import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
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

export class PushNotificationService {
  private static instance: PushNotificationService;
  private currentToken: string | null = null;
  private isRegistering = false;

  private constructor() {}

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Request notification permissions and register for push notifications
   */
  async registerForPushNotifications(): Promise<{ success: boolean; token?: string; error?: string }> {
    if (this.isRegistering) {
      console.log('Push notification registration already in progress');
      return { success: false, error: 'Registration already in progress' };
    }

    this.isRegistering = true;

    try {
      console.log('Starting push notification registration...');

      // Check if running on physical device
      if (!Device.isDevice) {
        console.log('Push notifications only work on physical devices');
        return { success: false, error: 'Push notifications only work on physical devices' };
      }

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        console.log('Requesting notification permissions...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permissions denied');
        return { success: false, error: 'Notification permissions denied' };
      }

      console.log('Notification permissions granted');

      // Create notification channel for Android
      if (Platform.OS === 'android') {
        await this.createNotificationChannel();
      }

      // Get the Expo push token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.error('EAS project ID not found in app config');
        return { success: false, error: 'EAS project ID not configured' };
      }

      console.log('Getting Expo push token with project ID:', projectId);
      console.log('Platform:', Platform.OS);
      console.log('Device info:', {
        isDevice: Device.isDevice,
        deviceName: Device.deviceName,
        osVersion: Device.osVersion
      });

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData.data;

      console.log('✅ Expo push token obtained:', token);
      console.log('Token type:', token.startsWith('ExponentPushToken') ? 'Expo Push Token' : 'Unknown token type');
      this.currentToken = token;

      // Save token to database
      const saveResult = await this.savePushToken(token);
      if (!saveResult.success) {
        console.error('Failed to save push token:', saveResult.error);
        return { success: false, error: saveResult.error };
      }

      console.log('✅ Push token saved to database');
      return { success: true, token };

    } catch (error) {
      console.error('Push notification registration error:', error);
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
   * Save push token to Supabase database
   */
  private async savePushToken(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const deviceId = await this.getDeviceId();
      const platform = Platform.OS;

      console.log('Saving push token to database...', {
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
        console.error('Database error saving push token:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Push token saved with ID:', data);
      return { success: true };

    } catch (error) {
      console.error('Exception saving push token:', error);
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
   * Get current push token
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
   * Setup notification listeners
   */
  setupNotificationListeners() {
    // Handle notifications received while app is running
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('📱 Notification received:', notification);
      // You can add custom handling here
    });

    // Handle notification taps
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('📱 Notification tapped:', response);
      
      const data = response.notification.request.content.data;
      
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
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }

  /**
   * Send a local test notification
   */
  async sendLocalTestNotification(): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Test Notification 📱",
          body: "This is a test notification from HagzApp!",
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
}

// Export singleton instance
export const pushNotificationService = PushNotificationService.getInstance();

// Admin-only functions for sending push notifications
export class AdminPushService {
  /**
   * Send push notification to specific users (admin only)
   */
  static async sendPushNotification(
    tokens: string[],
    title: string,
    body: string,
    data?: any
  ): Promise<{ success: boolean; results?: any[]; error?: string }> {
    try {
      const messages = tokens.map(token => ({
        to: token,
        sound: 'default',
        title,
        body,
        data: data || {},
        channelId: 'default',
      }));

      console.log('Sending push notifications to', tokens.length, 'devices');

      // Send to Expo's push notification service
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Push notification API error:', errorText);
        return { success: false, error: `API error: ${response.status}` };
      }

      const results = await response.json();
      console.log('✅ Push notifications sent:', results);

      return { success: true, results };

    } catch (error) {
      console.error('Error sending push notifications:', error);
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
   * Send test notification to all users or specific user (admin only)
   */
  static async sendTestNotification(
    targetUserId?: string,
    title: string = 'Test Notification',
    body: string = 'This is a test notification from HagzApp admin panel.'
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

      const sendResult = await this.sendPushNotification(tokens, title, body, {
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

export default pushNotificationService;
