import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { registerForPushNotificationsAsync, listenForNotificationResponses } from './src/services/pushNotifications';
import { matchReminderService } from './src/services/matchReminderService';
import { supabase } from './src/lib/supabase';

export default function App() {
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    // Initialize push notifications
    const initializePushNotifications = async () => {
      try {
        // Get current user session
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        if (userId) {
          // Register for push notifications
          await registerForPushNotificationsAsync(userId);
        }

        // Listen for notification responses (when user taps notification)
        const responseListener = listenForNotificationResponses((response) => {
          console.log('📱 Notification tapped:', response);
          handleNotificationNavigation(response.notification.request.content.data);
        });

        // Check for notification that opened the app (when app was closed)
        const checkInitialNotification = async () => {
          const lastResponse = await Notifications.getLastNotificationResponseAsync();
          if (lastResponse) {
            console.log('📱 App opened from notification:', lastResponse);
            // Delay navigation to ensure navigation is ready
            setTimeout(() => {
              handleNotificationNavigation(lastResponse.notification.request.content.data);
            }, 2000);
          }
        };

        checkInitialNotification();

        return () => {
          responseListener.remove();
        };
      } catch (error) {
        console.log('📱 Push notification initialization failed:', error);
      }
    };

    initializePushNotifications();

    // Listen for auth state changes to register push tokens
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.id) {
        console.log('📱 User signed in, registering for push notifications');
        await registerForPushNotificationsAsync(session.user.id);
        
        // Start match reminder service when user signs in
        console.log('📅 Starting match reminder service');
        matchReminderService.start();
      } else if (event === 'SIGNED_OUT') {
        console.log('📅 User signed out, stopping match reminder service');
        matchReminderService.stop();
      }
    });

    return () => {
      subscription.unsubscribe();
      matchReminderService.stop();
    };
  }, []);

  const handleNotificationNavigation = (data: any) => {
    if (!navigationRef.current || !data) {
      console.log('📱 Navigation not ready or no data');
      return;
    }

    console.log('📱 Handling navigation for data:', data);

    try {
      const screen = data.screen;
      
      if (screen === 'More') {
        navigationRef.current.navigate('More');
      } else if (screen === 'Home') {
        navigationRef.current.navigate('Home');
      } else if (screen === 'Play') {
        navigationRef.current.navigate('Play');
      } else if (screen === 'Profile') {
        navigationRef.current.navigate('Profile');
      } else if (screen === 'GameDetails' && data.gameId) {
        navigationRef.current.navigate('GameDetails', { id: data.gameId });
      } else if (screen === 'TeamChat' && data.teamId) {
        navigationRef.current.navigate('TeamChat', { id: data.teamId });
      } else {
        // Default navigation
        navigationRef.current.navigate('More');
      }
      
      console.log('✅ Navigation completed to:', screen);
    } catch (error) {
      console.error('❌ Navigation error:', error);
      // Fallback navigation
      try {
        navigationRef.current.navigate('More');
      } catch (fallbackError) {
        console.error('❌ Fallback navigation failed:', fallbackError);
      }
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer ref={navigationRef}>
        <AppNavigator />
      </NavigationContainer>
    </>
  );
}
