import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Animated,
} from 'react-native';
import { ImageBackground } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import TextType from './TextType';

type LandingNavigationProp = StackNavigationProp<RootStackParamList, 'Landing'>;

const { width } = Dimensions.get('window');

const LandingPage: React.FC = () => {
  const navigation = useNavigation<LandingNavigationProp>();
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Start animations on mount
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for the title
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    return () => {
      pulseAnimation.stop();
    };
  }, []);

  return (
    <TouchableOpacity 
      style={styles.container}
      activeOpacity={1}
      onPress={() => navigation.navigate('MiniOnboarding', { step: 1 })}
    >
      <ImageBackground
        source={require('../../assets/hage.jpeg')}
        style={styles.backgroundImage}
      >
        <View style={styles.overlay}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
          
          <Animated.View 
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim },
                  { scale: scaleAnim }
                ]
              }
            ]}
          >
            <Animated.View 
              style={[
                styles.titleContainer,
                { transform: [{ scale: pulseAnim }] }
              ]}
            >
              <Text style={styles.title}>HAGZ</Text>
              <View style={styles.titleUnderline} />
            </Animated.View>
            
            <View style={styles.quoteContainer}>
              <TextType 
                text={[
                  "Where Football Meets Community",
                  "Your Ultimate Football Experience",
                  "Join the Game, Join the Family"
                ]}
                typingSpeed={75}
                pauseDuration={1500}
                showCursor={true}
                cursorCharacter="|"
                style={styles.quote}
              />
            </View>
            
            <Animated.View 
              style={[
                styles.tapHint,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              <Text style={styles.tapText}>Tap anywhere to continue</Text>
            </Animated.View>
          </Animated.View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 72,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 4 },
    textShadowRadius: 8,
    marginBottom: 8,
  },
  titleUnderline: {
    width: 120,
    height: 4,
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
  quoteContainer: {
    marginBottom: 80,
    minHeight: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quote: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    fontStyle: 'italic',
    fontWeight: '300',
    lineHeight: 28,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  tapHint: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
  },
  tapText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '400',
    letterSpacing: 1,
  },
});

export default LandingPage;
