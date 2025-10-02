// src/services/notificationDebugger.ts
// Comprehensive notification debugging for AAB builds

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export interface NotificationDebugInfo {
  deviceInfo: {
    isDevice: boolean;
    platform: string;
    appOwnership: string;
    projectId?: string;
    expoConfig?: any;
  };
  permissions: {
    status: string;
    granted: boolean;
  };
  channels: any[];
  tokenInfo: {
    hasToken: boolean;
    token?: string;
    tokenType?: string;
  };
  environment: {
    isExpoGo: boolean;
    isStandalone: boolean;
    isDevelopment: boolean;
  };
}

export class NotificationDebugger {
  static async getDebugInfo(): Promise<NotificationDebugInfo> {
    console.log('🔍 Gathering notification debug information...');
    
    // Device info
    const deviceInfo = {
      isDevice: Device.isDevice,
      platform: Platform.OS,
      appOwnership: Constants.appOwnership,
      projectId: (Constants.expoConfig?.extra as any)?.eas?.projectId,
      expoConfig: Constants.expoConfig?.extra
    };

    // Permissions
    const { status } = await Notifications.getPermissionsAsync();
    const permissions = {
      status,
      granted: status === 'granted'
    };

    // Notification channels (Android only)
    let channels: any[] = [];
    if (Platform.OS === 'android') {
      try {
        channels = await Notifications.getNotificationChannelsAsync();
      } catch (error) {
        console.error('Error getting notification channels:', error);
      }
    }

    // Token info
    let tokenInfo = {
      hasToken: false,
      token: undefined as string | undefined,
      tokenType: undefined as string | undefined
    };

    if (Device.isDevice) {
      try {
        const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId;
        const isExpoGo = Constants.appOwnership === 'expo';
        const isStandalone = Constants.appOwnership === 'standalone';
        
        let tokenResponse;
        if (isStandalone && projectId) {
          tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
          tokenInfo.tokenType = 'standalone-with-project-id';
        } else if (isExpoGo) {
          tokenResponse = await Notifications.getExpoPushTokenAsync();
          tokenInfo.tokenType = 'expo-go';
        } else {
          tokenResponse = await Notifications.getExpoPushTokenAsync();
          tokenInfo.tokenType = 'fallback';
        }
        
        tokenInfo.token = tokenResponse.data;
        tokenInfo.hasToken = !!tokenInfo.token;
      } catch (error) {
        console.error('Error getting token for debug:', error);
        tokenInfo.tokenType = 'error';
      }
    }

    // Environment
    const environment = {
      isExpoGo: Constants.appOwnership === 'expo',
      isStandalone: Constants.appOwnership === 'standalone',
      isDevelopment: __DEV__
    };

    const debugInfo: NotificationDebugInfo = {
      deviceInfo,
      permissions,
      channels,
      tokenInfo,
      environment
    };

    console.log('📊 Notification Debug Info:', JSON.stringify(debugInfo, null, 2));
    return debugInfo;
  }

  static async testLocalNotification(): Promise<boolean> {
    try {
      console.log('🧪 Testing local notification...');
      
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        console.error('❌ Permissions not granted for local notification test');
        return false;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔧 Debug Test',
          body: 'Local notification test for AAB debugging',
          data: { 
            debug: true,
            timestamp: new Date().toISOString(),
            buildType: Constants.appOwnership
          },
          sound: 'notification_sound.wav',
          priority: 'high',
        },
        trigger: null,
      });

      console.log('✅ Local notification test successful:', notificationId);
      return true;
    } catch (error) {
      console.error('❌ Local notification test failed:', error);
      return false;
    }
  }

  static async testNotificationChannel(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.log('⏭️ Skipping channel test (not Android)');
      return true;
    }

    try {
      console.log('🧪 Testing notification channel creation...');
      
      await Notifications.setNotificationChannelAsync('debug-test', {
        name: 'Debug Test Channel',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'notification_sound.wav',
        enableVibrate: true,
        enableLights: true,
      });

      const channels = await Notifications.getNotificationChannelsAsync();
      const debugChannel = channels.find(ch => ch.id === 'debug-test');
      
      if (debugChannel) {
        console.log('✅ Notification channel test successful');
        return true;
      } else {
        console.error('❌ Debug channel not found after creation');
        return false;
      }
    } catch (error) {
      console.error('❌ Notification channel test failed:', error);
      return false;
    }
  }

  static async runFullDiagnostic(): Promise<{
    debugInfo: NotificationDebugInfo;
    localNotificationTest: boolean;
    channelTest: boolean;
    summary: string;
  }> {
    console.log('🚀 Running full notification diagnostic...');
    
    const debugInfo = await this.getDebugInfo();
    const localNotificationTest = await this.testLocalNotification();
    const channelTest = await this.testNotificationChannel();
    
    let summary = 'Notification diagnostic completed:\n';
    summary += `✅ Device: ${debugInfo.deviceInfo.isDevice ? 'Physical' : 'Simulator'}\n`;
    summary += `✅ Permissions: ${debugInfo.permissions.granted ? 'Granted' : 'Denied'}\n`;
    summary += `✅ Token: ${debugInfo.tokenInfo.hasToken ? 'Available' : 'Missing'}\n`;
    summary += `✅ Local Notifications: ${localNotificationTest ? 'Working' : 'Failed'}\n`;
    summary += `✅ Channels: ${channelTest ? 'Working' : 'Failed'}\n`;
    summary += `✅ Environment: ${debugInfo.environment.isExpoGo ? 'Expo Go' : debugInfo.environment.isStandalone ? 'Standalone' : 'Unknown'}\n`;
    
    console.log('📋 Diagnostic Summary:', summary);
    
    return {
      debugInfo,
      localNotificationTest,
      channelTest,
      summary
    };
  }
}

export default NotificationDebugger;

