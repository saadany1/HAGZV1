// src/services/pushNotifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Configure how notifications are presented when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync(userId?: string) {
  try {
    if (!Device.isDevice) {
      console.warn('Must use physical device for push notifications');
      return null;
    }

    // 1) Request permission (both iOS and Android permissions handled here)
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Notification permissions not granted');
      return null;
    }

    // 2) Get Expo push token (this token is what Expo Push Service expects)
    // Use projectId from app.json extra.eas.projectId if available
    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId;
    console.log('Project ID for push token:', projectId);
    
    let tokenResponse;
    try {
      tokenResponse = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
    } catch (error) {
      console.error('Error getting Expo push token:', error);
      // Fallback: try without projectId
      tokenResponse = await Notifications.getExpoPushTokenAsync();
    }
    const token = tokenResponse.data;
    console.log('Expo push token:', token);

    // 3) Persist token in Supabase user_profiles.push_token
    if (userId && token) {
      const { error } = await supabase
        .from('user_profiles')
        .update({ push_token: token })
        .eq('id', userId);

      if (error) {
        console.error('Failed to save push token to supabase:', error.message);
      } else {
        console.log('✅ Push token saved to database');
      }
    }

    // 4) Create Android channel (important for Android behavior)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return token;
  } catch (err) {
    console.error('registerForPushNotificationsAsync error:', err);
    return null;
  }
}

export function listenForForegroundNotifications(onNotificationReceived: (n: Notifications.Notification) => void) {
  return Notifications.addNotificationReceivedListener(notification => {
    console.log('📱 Foreground notification received:', notification);
    onNotificationReceived(notification);
  });
}

export function listenForNotificationResponses(onResponse: (r: Notifications.NotificationResponse) => void) {
  return Notifications.addNotificationResponseReceivedListener(response => {
    console.log('📱 Notification response:', response);
    onResponse(response);
  });
}

// Test function to send a local notification
export async function sendTestLocalNotification() {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🧪 Test Notification',
        body: 'This is a test notification to verify the system works!',
        data: { screen: 'More', test: true },
        sound: 'notification_sound.wav',
      },
      trigger: null, // Show immediately
    });
    console.log('✅ Test local notification sent:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('❌ Error sending test notification:', error);
    return null;
  }
}

// Send custom local notification with user-defined parameters
export async function sendCustomLocalNotification(
  title: string,
  body: string,
  data?: any,
  options?: {
    sound?: boolean;
    priority?: 'min' | 'low' | 'default' | 'high' | 'max';
    vibrate?: boolean;
  }
) {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          ...data,
          customTest: true,
          timestamp: new Date().toISOString(),
        },
        sound: options?.sound !== false ? 'notification_sound.wav' : undefined,
        priority: options?.priority || 'high',
        vibrate: options?.vibrate !== false ? [0, 250, 250, 250] : undefined,
      },
      trigger: null, // Show immediately
    });
    console.log('✅ Custom local notification sent:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('❌ Error sending custom notification:', error);
    return null;
  }
}

// Get current push token for testing
export async function getCurrentPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      return null;
    }

    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId;
    console.log('Project ID for push token:', projectId);
    
    let tokenResponse;
    try {
      tokenResponse = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
    } catch (error) {
      console.error('Error getting Expo push token:', error);
      // Fallback: try without projectId
      tokenResponse = await Notifications.getExpoPushTokenAsync();
    }
    return tokenResponse.data;
  } catch (error) {
    console.error('Error getting current push token:', error);
    return null;
  }
}

// Check if notifications are enabled
export async function checkNotificationPermissions() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return {
      granted: status === 'granted',
      status,
      isDevice: Device.isDevice,
    };
  } catch (error) {
    console.error('Error checking notification permissions:', error);
    return {
      granted: false,
      status: 'error',
      isDevice: Device.isDevice,
    };
  }
}
