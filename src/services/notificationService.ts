import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface NotificationData {
  title: string;
  body: string;
  data?: any;
  sound?: string;
}

export class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Schedule a local notification
   */
  async scheduleNotification(
    notification: NotificationData,
    trigger?: Notifications.NotificationTriggerInput
  ): Promise<string> {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          sound: notification.sound || 'notification_sound.wav',
        },
        trigger: trigger || null, // null means show immediately
      });

      console.log('✅ Local notification scheduled:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      throw error;
    }
  }

  /**
   * Schedule a notification with delay
   */
  async scheduleDelayedNotification(
    notification: NotificationData,
    delaySeconds: number
  ): Promise<string> {
    return this.scheduleNotification(notification, { seconds: delaySeconds });
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log('✅ Notification cancelled:', notificationId);
    } catch (error) {
      console.error('Error cancelling notification:', error);
      throw error;
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('✅ All notifications cancelled');
    } catch (error) {
      console.error('Error cancelling all notifications:', error);
      throw error;
    }
  }

  /**
   * Dismiss all displayed notifications
   */
  async dismissAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
      console.log('✅ All notifications dismissed');
    } catch (error) {
      console.error('Error dismissing all notifications:', error);
      throw error;
    }
  }

  /**
   * Get all scheduled notifications
   */
  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      return notifications;
    } catch (error) {
      console.error('Error getting scheduled notifications:', error);
      return [];
    }
  }

  /**
   * Create notification channel for Android
   */
  async createNotificationChannel(
    channelId: string,
    channelName: string,
    importance: Notifications.AndroidImportance = Notifications.AndroidImportance.DEFAULT
  ): Promise<void> {
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync(channelId, {
          name: channelName,
          importance,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#4CAF50',
          sound: 'notification_sound.wav',
          enableVibrate: true,
          enableLights: true,
          showBadge: true,
        });
        console.log('✅ Android notification channel created:', channelId);
      } catch (error) {
        console.error('Error creating notification channel:', error);
        throw error;
      }
    }
  }

  /**
   * Setup notification listeners
   */
  setupNotificationListeners(): () => void {
    // Handle notifications received while app is running
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('📱 Notification received:', notification);
    });

    // Handle notification taps
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('📱 Notification tapped:', response);
      
      const data = response.notification.request.content.data;
      
      // Handle different notification types
      if (data?.type === 'game_reminder') {
        console.log('Navigate to game:', data.game_id);
      } else if (data?.type === 'match_update') {
        console.log('Navigate to match:', data.match_id);
      } else if (data?.type === 'team_message') {
        console.log('Navigate to team chat:', data.team_id);
      }
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }

  /**
   * Send a test notification
   */
  async sendTestNotification(): Promise<void> {
    await this.scheduleNotification({
      title: "Test Notification 📱",
      body: "This is a test notification from HagzApp!",
      data: { type: 'test' },
    });
  }

  /**
   * Send game reminder notification
   */
  async sendGameReminder(gameTitle: string, gameTime: string, gameId: string): Promise<void> {
    await this.scheduleNotification({
      title: "Game Reminder ⚽",
      body: `Your game "${gameTitle}" starts at ${gameTime}`,
      data: { 
        type: 'game_reminder', 
        game_id: gameId 
      },
    });
  }

  /**
   * Send match found notification
   */
  async sendMatchFoundNotification(opponentTeam: string, matchTime: string, matchId: string): Promise<void> {
    await this.scheduleNotification({
      title: "Match Found! 🔥",
      body: `You have a match against ${opponentTeam} at ${matchTime}`,
      data: { 
        type: 'match_update', 
        match_id: matchId 
      },
    });
  }

  /**
   * Send team message notification
   */
  async sendTeamMessageNotification(teamName: string, senderName: string, message: string, teamId: string): Promise<void> {
    await this.scheduleNotification({
      title: `${teamName} - New Message`,
      body: `${senderName}: ${message.length > 50 ? message.substring(0, 50) + '...' : message}`,
      data: { 
        type: 'team_message', 
        team_id: teamId 
      },
    });
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();

export default notificationService;

