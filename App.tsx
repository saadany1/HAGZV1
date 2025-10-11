import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    // App initialization
    console.log('App initialized');
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
