import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type MiniOnboardingNavigationProp = StackNavigationProp<RootStackParamList, 'MiniOnboarding'>;

const { width, height } = Dimensions.get('window');

interface MiniOnboardingScreenProps {
  route: {
    params: {
      step: number;
    };
  };
}

const MiniOnboardingScreen: React.FC<MiniOnboardingScreenProps> = ({ route }) => {
  const navigation = useNavigation<MiniOnboardingNavigationProp>();
  const { step } = route.params;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const iconAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const descAnim = useRef(new Animated.Value(0)).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Reset all animations
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    scaleAnim.setValue(0.8);
    iconAnim.setValue(0);
    titleAnim.setValue(0);
    descAnim.setValue(0);
    buttonAnim.setValue(0);
    progressAnim.setValue(0);

    // Staggered animations for smooth entrance
    Animated.sequence([
      // Initial fade in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      // Icon animation
      Animated.spring(iconAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
      // Title animation
      Animated.spring(titleAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
      // Description animation
      Animated.spring(descAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
      // Progress and button animation
      Animated.parallel([
        Animated.spring(progressAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(buttonAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [step]);

  const onboardingData = [
    {
      icon: 'people',
      title: 'Connect with Players',
      description: 'Find and connect with football players in your area. Build your team and join the community.',
      color: '#4CAF50',
    },
    {
      icon: 'football',
      title: 'Play & Compete',
      description: 'Join matches, tournaments, and leagues. Experience the thrill of competitive football.',
      color: '#2196F3',
    },
    {
      icon: 'trophy',
      title: 'Track Your Progress',
      description: 'Monitor your performance, improve your skills, and climb the leaderboards.',
      color: '#FF9800',
    },
  ];

  const currentData = onboardingData[step - 1];

  const handleNext = () => {
    if (step < 3) {
      navigation.navigate('MiniOnboarding', { step: step + 1 });
    } else {
      navigation.navigate('AuthPrompt');
    }
  };

  const handleSkip = () => {
    navigation.navigate('AuthPrompt');
  };

  return (
    <ImageBackground
      source={require('../../assets/hage.jpeg')}
      style={styles.container}
    >
      <View style={styles.overlay}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        
        {/* Skip Button */}
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        {/* Content */}
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
          {/* Icon */}
          <Animated.View 
            style={[
              styles.iconContainer,
              { 
                backgroundColor: currentData.color + '20',
                transform: [
                  {
                    scale: iconAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    }),
                  },
                  {
                    rotate: iconAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['180deg', '0deg'],
                    }),
                  },
                ],
                opacity: iconAnim,
              }
            ]}
          >
            <Ionicons name={currentData.icon as any} size={60} color={currentData.color} />
          </Animated.View>

          {/* Title */}
          <Animated.Text 
            style={[
              styles.title,
              {
                opacity: titleAnim,
                transform: [
                  {
                    translateY: titleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  },
                ],
              }
            ]}
          >
            {currentData.title}
          </Animated.Text>

          {/* Description */}
          <Animated.Text 
            style={[
              styles.description,
              {
                opacity: descAnim,
                transform: [
                  {
                    translateY: descAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              }
            ]}
          >
            {currentData.description}
          </Animated.Text>
        </Animated.View>

        {/* Bottom Section */}
        <Animated.View 
          style={[
            styles.bottomSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Progress Dots */}
          <Animated.View 
            style={[
              styles.progressContainer,
              {
                opacity: progressAnim,
                transform: [
                  {
                    scale: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
              }
            ]}
          >
            {[1, 2, 3].map((dot) => (
              <Animated.View
                key={dot}
                style={[
                  styles.progressDot,
                  dot === step && styles.activeDot,
                  dot < step && styles.completedDot,
                  {
                    transform: [
                      {
                        scale: dot === step ? progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 1.2],
                        }) : 1,
                      },
                    ],
                  }
                ]}
              />
            ))}
          </Animated.View>

          {/* Next Button */}
          <Animated.View
            style={{
              opacity: buttonAnim,
              transform: [
                {
                  translateY: buttonAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                },
                {
                  scale: buttonAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
              ],
            }}
          >
            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>
                {step === 3 ? 'Get Started' : 'Next'}
              </Text>
              <Ionicons 
                name={step === 3 ? 'checkmark' : 'arrow-forward'} 
                size={20} 
                color="#fff" 
              />
            </TouchableOpacity>
          </Animated.View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  skipButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  skipText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 34,
  },
  description: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  bottomSection: {
    alignItems: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    marginBottom: 40,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  activeDot: {
    backgroundColor: '#4CAF50',
    width: 24,
  },
  completedDot: {
    backgroundColor: '#4CAF50',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    shadowColor: '#4CAF50',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
});

export default MiniOnboardingScreen;
