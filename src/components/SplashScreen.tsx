import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  StatusBar,
} from 'react-native';
import { ImageBackground } from 'react-native';

interface SplashScreenProps {
  onTransitionStart?: () => void;
  isDataLoading?: boolean;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onTransitionStart, isDataLoading = true }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const hasStartedExit = useRef(false);

  useEffect(() => {
    // Entrance animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    // Trigger exit animation when data loading is complete
    if (!isDataLoading && !hasStartedExit.current) {
      hasStartedExit.current = true;
      
      onTransitionStart?.(); // Notify parent that transition is starting
      
      // Cool exit animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isDataLoading, onTransitionStart]);

  return (
    <ImageBackground 
      source={require('../../assets/hage.jpeg')} 
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.content,
            { 
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <Text style={styles.appTitle}>HAGZ</Text>
        </Animated.View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: 72,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 4 },
    textShadowRadius: 8,
  },
});

export default SplashScreen;
