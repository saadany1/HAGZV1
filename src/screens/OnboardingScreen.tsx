import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
} from 'react-native';
import { ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { supabase, db } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';

const { width, height } = Dimensions.get('window');

type OnboardingNavigationProp = StackNavigationProp<RootStackParamList, 'Onboarding'>;

interface OnboardingData {
  username: string;
  age: string;
  height: string;
  preferredFoot: string;
  country: string;
  skillLevel: string;
  position: string;
  experience: string;
  goals: string;
  profilePhoto: string | null;
}

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'success' | 'error' | 'info';
}

const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
  type = 'info'
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getIconAndColor = () => {
    switch (type) {
      case 'success':
        return { icon: 'checkmark-circle', color: '#10b981' };
      case 'error':
        return { icon: 'close-circle', color: '#ef4444' };
      default:
        return { icon: 'information-circle', color: '#3b82f6' };
    }
  };

  const { icon, color } = getIconAndColor();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
    >
      <Animated.View style={[styles.alertOverlay, { opacity: opacityAnim }]}>
        <Animated.View 
          style={[
            styles.alertContainer,
            {
              transform: [{ scale: scaleAnim }],
            }
          ]}
        >
          <View style={[styles.alertIcon, { backgroundColor: color + '20' }]}>
            <Ionicons name={icon as any} size={32} color={color} />
          </View>
          
          <Text style={styles.alertTitle}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
          
          <View style={styles.alertButtons}>
            {onCancel && (
              <TouchableOpacity 
                style={[styles.alertButton, styles.alertButtonSecondary]} 
                onPress={onCancel}
              >
                <Text style={styles.alertButtonTextSecondary}>{cancelText}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[styles.alertButton, styles.alertButtonPrimary, { backgroundColor: color }]} 
              onPress={onConfirm}
            >
              <Text style={styles.alertButtonTextPrimary}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingNavigationProp>();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    username: '',
    age: '',
    height: '',
    preferredFoot: '',
    country: '',
    skillLevel: '',
    position: '',
    experience: '',
    goals: '',
    profilePhoto: null,
  });
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'success' | 'error' | 'info';
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const inputAnim = useRef(new Animated.Value(0)).current;
  const focusAnim = useRef(new Animated.Value(0)).current;

  const steps = [
    {
      title: 'Choose Your Username',
      subtitle: 'This will be your display name in the app',
      type: 'input',
      field: 'username',
      placeholder: 'Enter username',
      validation: (value: string) => value.length >= 3,
      errorMessage: 'Username must be at least 3 characters',
      icon: 'person-circle',
    },
    {
      title: 'How Old Are You?',
      subtitle: 'This helps us match you with similar players',
      type: 'input',
      field: 'age',
      placeholder: 'Enter your age',
      validation: (value: string) => {
        if (!value || value.trim() === '') return false;
        const age = parseInt(value);
        return !isNaN(age) && age >= 13 && age <= 100;
      },
      errorMessage: 'Please enter a valid age (13-100)',
      icon: 'calendar',
    },
    {
      title: 'Your Height',
      subtitle: 'What\'s your height in cm?',
      type: 'input',
      field: 'height',
      placeholder: 'e.g., 175',
      validation: (value: string) => {
        if (!value || value.trim() === '') return false;
        const height = parseInt(value);
        return !isNaN(height) && height >= 120 && height <= 220;
      },
      errorMessage: 'Please enter a valid height (120-220 cm)',
      icon: 'resize',
    },
    {
      title: 'Preferred Foot',
      subtitle: 'Which foot do you prefer to use?',
      type: 'selection',
      field: 'preferredFoot',
      icon: 'football',
      options: [
        { label: 'Right', value: 'right', icon: 'football', color: '#6b7280' },
        { label: 'Left', value: 'left', icon: 'football', color: '#6b7280' },
        { label: 'Both', value: 'both', icon: 'swap-horizontal', color: '#6b7280' },
      ],
    },
    {
      title: 'Your Country',
      subtitle: 'Where are you from?',
      type: 'input',
      field: 'country',
      placeholder: 'Enter your country',
      validation: (value: string) => value.length >= 2,
      errorMessage: 'Please enter your country',
      icon: 'globe',
    },
    {
      title: 'What\'s Your Skill Level?',
      subtitle: 'Be honest - this helps with fair matchmaking',
      type: 'selection',
      field: 'skillLevel',
      icon: 'star',
      options: [
        { label: 'Beginner', value: 'beginner', icon: 'star-outline', color: '#6b7280' },
        { label: 'Intermediate', value: 'intermediate', icon: 'star', color: '#6b7280' },
        { label: 'Advanced', value: 'advanced', icon: 'star-half', color: '#6b7280' },
        { label: 'Professional', value: 'professional', icon: 'trophy', color: '#6b7280' },
      ],
    },
    {
      title: 'Preferred Position',
      subtitle: 'What position do you usually play?',
      type: 'selection',
      field: 'position',
      icon: 'football',
      options: [
        { label: 'Goalkeeper', value: 'goalkeeper', icon: 'shield', color: '#6b7280' },
        { label: 'Defender', value: 'defender', icon: 'shield-checkmark', color: '#6b7280' },
        { label: 'Midfielder', value: 'midfielder', icon: 'football', color: '#6b7280' },
        { label: 'Forward', value: 'forward', icon: 'flash', color: '#6b7280' },
        { label: 'Flexible', value: 'flexible', icon: 'swap-horizontal', color: '#6b7280' },
      ],
    },
    {
      title: 'Years of Experience',
      subtitle: 'How long have you been playing football?',
      type: 'selection',
      field: 'experience',
      icon: 'time',
      options: [
        { label: 'Less than 1 year', value: '0-1', icon: 'time-outline', color: '#6b7280' },
        { label: '1-3 years', value: '1-3', icon: 'time', color: '#6b7280' },
        { label: '3-5 years', value: '3-5', icon: 'time', color: '#6b7280' },
        { label: '5-10 years', value: '5-10', icon: 'time', color: '#6b7280' },
        { label: '10+ years', value: '10+', icon: 'time', color: '#6b7280' },
      ],
    },
    {
      title: 'What Are Your Goals?',
      subtitle: 'What do you want to achieve?',
      type: 'selection',
      field: 'goals',
      icon: 'target',
      options: [
        { label: 'Have Fun', value: 'fun', icon: 'happy', color: '#6b7280' },
        { label: 'Improve Skills', value: 'improve', icon: 'trending-up', color: '#6b7280' },
        { label: 'Stay Fit', value: 'fitness', icon: 'fitness', color: '#6b7280' },
        { label: 'Compete', value: 'compete', icon: 'trophy', color: '#6b7280' },
        { label: 'Make Friends', value: 'social', icon: 'people', color: '#6b7280' },
      ],
    },
    {
      title: 'Profile Photo',
      subtitle: 'Add a photo to your profile (optional)',
      type: 'photo',
      field: 'profilePhoto',
      icon: 'camera',
    },
  ];

  const currentStepData = steps[currentStep];

  React.useEffect(() => {
    // Check user session on component mount (non-blocking)
    const checkUserSession = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        console.warn('Proceeding with onboarding without active session.');
        return;
      }
      console.log('User session verified on onboarding start:', user.id);
    };
    
    checkUserSession();
  }, []);

  React.useEffect(() => {
    // Animate input field entrance
    Animated.spring(inputAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
      delay: 300,
    }).start();
  }, [currentStep]);

  const handleInputChange = (value: string) => {
    setData(prev => ({ ...prev, [currentStepData.field]: value }));
  };

  const handleSelection = (value: string) => {
    setData(prev => ({ ...prev, [currentStepData.field]: value }));
  };

  const pickImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showCustomAlert('Permission Required', 'Please grant camera roll permissions to upload a photo.', 'error');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setData(prev => ({ ...prev, profilePhoto: result.assets[0].uri }));
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showCustomAlert('Error', 'Failed to pick image. Please try again.', 'error');
    }
  };

  const takePhoto = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showCustomAlert('Permission Required', 'Please grant camera permissions to take a photo.', 'error');
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setData(prev => ({ ...prev, profilePhoto: result.assets[0].uri }));
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      showCustomAlert('Error', 'Failed to take photo. Please try again.', 'error');
    }
  };

  const removePhoto = () => {
    setData(prev => ({ ...prev, profilePhoto: null }));
  };

  const validateCurrentStep = () => {
    if (currentStepData.type === 'input') {
      const fieldValue = data[currentStepData.field as keyof OnboardingData] as string;
      return currentStepData.validation ? currentStepData.validation(fieldValue) : true;
    }
    if (currentStepData.type === 'photo') {
      // Photo step is always valid since it's optional
      return true;
    }
    const fieldValue = data[currentStepData.field as keyof OnboardingData] as string;
    return fieldValue !== '';
  };

  const showCustomAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info', onConfirm?: () => void) => {
    setCustomAlert({
      visible: true,
      title,
      message,
      type,
      onConfirm: onConfirm || (() => setCustomAlert(prev => ({ ...prev, visible: false }))),
    });
  };

  const handleNext = () => {
    if (!validateCurrentStep()) {
      showCustomAlert('Validation Error', currentStepData.errorMessage || 'Please fill in this field', 'error');
      return;
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    try {
      console.log('Saving onboarding data:', data);
      
      // Get current user with retry logic
      let user = null;
      let userError = null;
      
      // Try to get user session, with retry if needed
      for (let attempt = 0; attempt < 3; attempt++) {
        const result = await supabase.auth.getUser();
        user = result.data.user;
        userError = result.error;
        
        if (user && !userError) {
          break; // Success
        }
        
        if (attempt < 2) {
          console.log(`Session check attempt ${attempt + 1} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (userError || !user) {
        console.error('User auth error after retries:', userError);
        showCustomAlert(
          'Session Expired', 
          'Your session has expired. Please sign in again to complete your profile setup.', 
          'error',
          () => {
            // Clear any stored data and navigate to login
            setData({
              username: '',
              age: '',
              height: '',
              preferredFoot: '',
              country: '',
              skillLevel: '',
              position: '',
              experience: '',
              goals: '',
              profilePhoto: null,
            });
            navigation.navigate('Login');
          }
        );
        return;
      }
      
      console.log('User session verified:', user.id);

      // First check if profile exists, if not create it
      const { data: existingProfile } = await db.getUserProfile(user.id);
      
      if (!existingProfile) {
        // Profile doesn't exist, create it first
        const { error: createError } = await db.forceCreateProfile(user.id, user.email || '', user.email || '');
        if (createError) {
          console.error('Failed to create profile:', createError);
          showCustomAlert('Error', 'Failed to create user profile. Please try again.', 'error');
          return;
        }
      }

      // Save onboarding data to user profile
      const { error } = await db.updateUserProfile(user.id, {
        username: data.username,
        age: parseInt(data.age),
        height: parseInt(data.height),
        preferred_foot: data.preferredFoot,
        country: data.country,
        skill_level: data.skillLevel,
        position: data.position,
        experience: data.experience,
        goals: data.goals,
        avatar_url: data.profilePhoto,
        onboarding_completed: true,
      });

      if (error) {
        console.error('Failed to save onboarding data:', error);
        showCustomAlert('Error', 'Failed to save your profile. Please try again.', 'error');
        return;
      }

      console.log('Onboarding data saved successfully');
      
      showCustomAlert(
        'Welcome to Hagz! 🎉',
        'Your profile has been set up successfully. You\'re all ready to start playing!',
        'success',
                        () => navigation.navigate('MainTabs')
      );
    } catch (error) {
      console.error('Onboarding completion error:', error);
      showCustomAlert('Error', 'Failed to save your profile. Please try again.', 'error');
    }
  };

  const handleCompleteOnboarding = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Save minimal data locally if needed (skipped here), and ask user to sign in
        showCustomAlert(
          'Sign in required',
          'Please sign in to save your profile. Your onboarding selections are kept on this device.',
          'error',
          () => navigation.navigate('Login')
        );
        return;
      }

      const { error } = await supabase.from('user_profiles').upsert({
        id: user.id,
        username: data.username,
        age: data.age,
        height: data.height,
        preferred_foot: data.preferredFoot,
        country: data.country,
        skill_level: data.skillLevel,
        position: data.position,
        experience: data.experience,
        goals: data.goals,
        avatar_url: data.profilePhoto,
        onboarding_completed: true,
      });

      if (error) {
        console.error('Failed to save onboarding data:', error);
        showCustomAlert('Error', 'Failed to save your profile. Please try again.', 'error');
        return;
      }

      console.log('Onboarding data saved successfully');
      showCustomAlert(
        'Welcome to Hagz! 🎉',
        'Your profile has been set up successfully. You\'re all ready to start playing!',
        'success',
        () => navigation.navigate('MainTabs')
      );
    } catch (error) {
      console.error('Onboarding completion error:', error);
      showCustomAlert('Error', 'Failed to save your profile. Please try again.', 'error');
    }
  };

  const renderInputStep = () => (
    <Animated.View 
      style={[
        styles.inputContainer,
        {
          transform: [
            { translateY: inputAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [50, 0],
            })},
            { scale: inputAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.9, 1],
            })}
          ],
          opacity: inputAnim,
        }
      ]}
    >
      <View style={styles.inputCard}>
        <View style={styles.inputHeader}>
          <View style={styles.inputIconContainer}>
            <Ionicons name={currentStepData.icon as any} size={24} color="#00d4ff" />
          </View>
          <Text style={styles.inputLabel}>
            {currentStepData.field === 'username'
              ? 'Username'
              : currentStepData.field === 'age'
              ? 'Age'
              : currentStepData.field === 'height'
              ? 'Height (cm)'
              : currentStepData.field === 'country'
              ? 'Country'
              : 'Input'}
          </Text>
        </View>
        
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            placeholder={currentStepData.placeholder || ''}
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
            value={data[currentStepData.field as keyof OnboardingData] as string}
            onChangeText={handleInputChange}
            autoFocus
            keyboardType={currentStepData.field === 'age' || currentStepData.field === 'height' ? 'numeric' : 'default'}
            maxLength={currentStepData.field === 'age' ? 3 : currentStepData.field === 'height' ? 3 : 50}
            onFocus={() => {
              Animated.spring(focusAnim, {
                toValue: 1,
                useNativeDriver: false,
              }).start();
            }}
            onBlur={() => {
              Animated.spring(focusAnim, {
                toValue: 0,
                useNativeDriver: false,
              }).start();
            }}
          />
          {data[currentStepData.field as keyof OnboardingData] && (
            <View style={styles.inputCheckmark}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
            </View>
          )}
        </View>
        
        {currentStepData.field === 'username' && (
          <View style={styles.inputHintContainer}>
            <Ionicons name="information-circle-outline" size={16} color="rgba(255, 255, 255, 0.6)" />
            <Text style={styles.inputHint}>
              Choose a unique username (3+ characters, letters and numbers only)
            </Text>
          </View>
        )}
        
        {currentStepData.field === 'age' && (
          <View style={styles.inputHintContainer}>
            <Ionicons name="information-circle-outline" size={16} color="rgba(255, 255, 255, 0.6)" />
            <Text style={styles.inputHint}>
              Enter your age (13-100 years old)
            </Text>
          </View>
        )}
        
        {currentStepData.field === 'height' && (
          <View style={styles.inputHintContainer}>
            <Ionicons name="information-circle-outline" size={16} color="rgba(255, 255, 255, 0.6)" />
            <Text style={styles.inputHint}>
              Enter your height in centimeters (120-220 cm)
            </Text>
          </View>
        )}
        
        {currentStepData.field === 'country' && (
          <View style={styles.inputHintContainer}>
            <Ionicons name="information-circle-outline" size={16} color="rgba(255, 255, 255, 0.6)" />
            <Text style={styles.inputHint}>
              Enter your country name
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );

  const renderSelectionStep = () => (
    <View style={styles.optionsContainer}>
      {currentStepData.options?.map((option, index) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.optionButton,
            data[currentStepData.field as keyof OnboardingData] === option.value && styles.selectedOption,
          ]}
          onPress={() => handleSelection(option.value)}
        >
          <View style={[
            styles.optionIconContainer,
            { backgroundColor: (option.color || '#00d4ff') + '20' },
            data[currentStepData.field as keyof OnboardingData] === option.value && { backgroundColor: (option.color || '#00d4ff') + '30' }
          ]}>
            <Ionicons
              name={option.icon as any}
              size={20}
              color={data[currentStepData.field as keyof OnboardingData] === option.value ? (option.color || '#00d4ff') : '#fff'}
            />
          </View>
          <View style={styles.optionContent}>
            <Text style={[
              styles.optionText,
              data[currentStepData.field as keyof OnboardingData] === option.value && styles.selectedOptionText,
            ]}>
              {option.label}
            </Text>
          </View>
          {data[currentStepData.field as keyof OnboardingData] === option.value && (
            <View style={styles.checkmarkContainer}>
              <Ionicons name="checkmark-circle" size={18} color={option.color || '#00d4ff'} />
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderPhotoStep = () => (
    <Animated.View 
      style={[
        styles.photoContainer,
        {
          transform: [
            { translateY: inputAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [50, 0],
            })},
            { scale: inputAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.9, 1],
            })}
          ],
          opacity: inputAnim,
        }
      ]}
    >
      {data.profilePhoto ? (
        <View style={styles.photoPreviewContainer}>
          <Image 
            source={{ uri: data.profilePhoto }} 
            style={styles.photoPreview}
            resizeMode="cover"
          />
          <TouchableOpacity style={styles.removePhotoButton} onPress={removePhoto}>
            <Ionicons name="close-circle" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.photoPlaceholder}>
          <Ionicons name="camera" size={48} color="rgba(255, 255, 255, 0.4)" />
          <Text style={styles.photoPlaceholderText}>No photo selected</Text>
        </View>
      )}
      
      <View style={styles.photoActions}>
        <TouchableOpacity style={styles.photoActionButton} onPress={pickImage}>
          <Ionicons name="image" size={20} color="#fff" />
          <Text style={styles.photoActionText}>Choose from Gallery</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.photoActionButton} onPress={takePhoto}>
          <Ionicons name="camera" size={20} color="#fff" />
          <Text style={styles.photoActionText}>Take Photo</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.photoHintContainer}>
        <Ionicons name="information-circle-outline" size={16} color="rgba(255, 255, 255, 0.6)" />
        <Text style={styles.photoHint}>
          Adding a photo is optional. You can skip this step if you prefer.
        </Text>
      </View>
    </Animated.View>
  );

  return (
    <ImageBackground
      source={require('../../assets/hage.jpeg')}
      style={styles.container}
    >
      <View style={styles.backgroundOverlay}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header with Step Icon */}
            <View style={styles.headerContainer}>
              <View style={styles.stepIconContainer}>
                <Ionicons name={currentStepData.icon as any} size={24} color="#00d4ff" />
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${((currentStep + 1) / steps.length) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {currentStep + 1} of {steps.length}
              </Text>
            </View>

            {/* Step Content */}
            <View style={styles.contentContainer}>
              <Text style={styles.title}>{currentStepData.title}</Text>
              <Text style={styles.subtitle}>{currentStepData.subtitle}</Text>

              {currentStepData.type === 'input' ? renderInputStep() : 
               currentStepData.type === 'photo' ? renderPhotoStep() : 
               renderSelectionStep()}
            </View>

            {/* Navigation Buttons */}
            <View style={styles.navigationContainer}>
              {currentStep > 0 && (
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                  <Ionicons name="arrow-back" size={16} color="#fff" />
                  <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.nextButton,
                  !validateCurrentStep() && styles.nextButtonDisabled,
                ]}
                onPress={handleNext}
                disabled={!validateCurrentStep()}
              >
                <Text style={styles.nextButtonText}>
                  {currentStep === steps.length - 1 ? 'Complete' : 'Next'}
                </Text>
                <Ionicons
                  name={currentStep === steps.length - 1 ? 'checkmark' : 'arrow-forward'}
                  size={16}
                  color="#fff"
                />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Custom Alert */}
        <CustomAlert
          visible={customAlert.visible}
          title={customAlert.title}
          message={customAlert.message}
          onConfirm={customAlert.onConfirm}
          onCancel={customAlert.onCancel}
          confirmText={customAlert.confirmText}
          cancelText={customAlert.cancelText}
          type={customAlert.type}
        />
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 30,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  stepIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 25,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 2,
  },
  progressText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 15,
  },
  inputCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  inputIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  inputLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 56,
  },
  textInput: {
    flex: 1,
    fontSize: 18,
    color: '#fff',
    fontWeight: '500',
    minHeight: 24,
  },
  inputCheckmark: {
    marginLeft: 12,
  },
  inputHintContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  inputHint: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  optionsContainer: {
    width: '100%',
    gap: 10,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    minHeight: 60,
  },
  selectedOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
  },
  optionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
  },
  optionText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  selectedOptionText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '700',
  },
  checkmarkContainer: {
    marginLeft: 8,
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 25,
    paddingHorizontal: 5,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    minWidth: 120,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  nextButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 6,
  },
  // Custom Alert Styles
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  alertContainer: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  alertIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  alertMessage: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  alertButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  alertButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  alertButtonPrimary: {
    backgroundColor: '#00d4ff',
  },
  alertButtonSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  alertButtonTextPrimary: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  alertButtonTextSecondary: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  // Photo step styles
  photoContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  photoPreviewContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  photoPreview: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
  },
  photoPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  photoPlaceholderText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  photoActions: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  photoActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  photoActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  photoHintContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 4,
  },
  photoHint: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
    textAlign: 'center',
  },
});

export default OnboardingScreen;
