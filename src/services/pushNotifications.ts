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
    console.log('🔍 Starting push notification registration...');
    console.log('Device info:', {
      isDevice: Device.isDevice,
      platform: Platform.OS,
      appOwnership: Constants.appOwnership,
      projectId: (Constants.expoConfig?.extra as any)?.eas?.projectId,
      expoConfig: Constants.expoConfig?.extra
    });

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

    console.log('✅ Notification permissions granted');

    // 2) Get Expo push token (this token is what Expo Push Service expects)
    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId;
    const isExpoGo = Constants.appOwnership === 'expo';
    const isStandalone = Constants.appOwnership === 'standalone';
    
    console.log('Environment detection:', {
      projectId,
      isExpoGo,
      isStandalone,
      appOwnership: Constants.appOwnership
    });
    
    let tokenResponse;
    try {
      if (isStandalone && projectId) {
        // For standalone builds, use the project ID
        console.log('📱 Using project ID for standalone build:', projectId);
        tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
      } else if (isExpoGo) {
        // For Expo Go, use the default method
        console.log('📱 Using default method for Expo Go');
        tokenResponse = await Notifications.getExpoPushTokenAsync();
      } else {
        // Fallback for standalone without project ID
        console.log('📱 Using fallback method (no project ID)');
        tokenResponse = await Notifications.getExpoPushTokenAsync();
      }
    } catch (error) {
      console.error('Error getting Expo push token:', error);
      // Final fallback
      console.log('📱 Using final fallback method');
      tokenResponse = await Notifications.getExpoPushTokenAsync();
    }
    
    const token = tokenResponse.data;
    console.log('✅ Expo push token generated:', token);

    // 3) Persist token in Supabase user_profiles.push_token
    if (userId && token) {
      console.log('💾 Saving push token to database for user:', userId);
      const { error } = await supabase
        .from('user_profiles')
        .update({ push_token: token })
        .eq('id', userId);

      if (error) {
        console.error('❌ Failed to save push token to supabase:', error.message);
      } else {
        console.log('✅ Push token saved to database successfully');
      }
    } else {
      console.warn('⚠️ No userId or token provided, skipping database save');
    }

    // 4) Create Android channel (important for Android behavior)
    if (Platform.OS === 'android') {
      console.log('📱 Creating Android notification channel...');
      try {
        await Notifications.setNotificationChannelAsync('NL', {
          name: 'HAGZ Notifications',
          description: 'Notifications for HAGZ football matches and invitations',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'notification_sound.wav',
          enableVibrate: true,
          enableLights: true,
          showBadge: true,
        });
        console.log('✅ Android notification channel created');
      } catch (error) {
        console.error('❌ Failed to create Android notification channel:', error);
      }
    }

    console.log('🎉 Push notification registration completed successfully');
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
    console.log('🧪 Sending test local notification...');
    
    // Check permissions first
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.error('❌ Notification permissions not granted');
      return null;
    }
    
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🧪 AAB Test Notification',
        body: 'This is a test notification to verify the system works in AAB build!',
        data: { 
          screen: 'More', 
          test: true,
          timestamp: new Date().toISOString(),
          buildType: Constants.appOwnership
        },
        sound: 'notification_sound.wav',
        priority: 'high',
      },
      trigger: null, // Show immediately
    });
    console.log('✅ Test local notification sent successfully:', notificationId);
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
    console.log('🔍 Getting current push token...');
    
    if (!Device.isDevice) {
      console.warn('Not a physical device, cannot get push token');
      return null;
    }

    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId;
    const isExpoGo = Constants.appOwnership === 'expo';
    const isStandalone = Constants.appOwnership === 'standalone';
    
    console.log('Environment for token:', {
      projectId,
      isExpoGo,
      isStandalone,
      appOwnership: Constants.appOwnership
    });
    
    let tokenResponse;
    try {
      if (isStandalone && projectId) {
        console.log('📱 Getting token with project ID for standalone build');
        tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
      } else if (isExpoGo) {
        console.log('📱 Getting token for Expo Go');
        tokenResponse = await Notifications.getExpoPushTokenAsync();
      } else {
        console.log('📱 Getting token with fallback method');
        tokenResponse = await Notifications.getExpoPushTokenAsync();
      }
    } catch (error) {
      console.error('Error getting Expo push token:', error);
      // Final fallback
      console.log('📱 Using final fallback for token');
      tokenResponse = await Notifications.getExpoPushTokenAsync();
    }
    
    const token = tokenResponse.data;
    console.log('✅ Current push token retrieved:', token);
    return token;
  } catch (error) {
    console.error('❌ Error getting current push token:', error);
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
