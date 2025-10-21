import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { supabase } from './src/lib/supabase';
import { registerForPushAndSaveToken } from './src/services/notifications';

export default function App() {
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    // App initialization
    console.log('App initialized');

    // Attempt registration on startup if user exists
    supabase.auth.getUser().then(async ({ data }) => {
      if (data?.user) {
        await registerForPushAndSaveToken();
      }
    });

    // Also listen for auth state changes to register when user logs in
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await registerForPushAndSaveToken();
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);


  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer ref={navigationRef}>
        <AppNavigator />
      </NavigationContainer>
    </>
  );
}
