import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { fcmPushNotificationService } from '../services/fcmPushNotificationService';

export const FCMTestComponent: React.FC = () => {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    // Setup FCM listeners
    const unsubscribe = fcmPushNotificationService.setupNotificationListeners();
    const unsubscribeTokenRefresh = fcmPushNotificationService.setupTokenRefreshListener();

    return () => {
      unsubscribe();
      unsubscribeTokenRefresh();
    };
  }, []);

  const handleRegisterFCM = async () => {
    setIsRegistering(true);
    try {
      const result = await fcmPushNotificationService.registerForPushNotifications();
      
      if (result.success && result.token) {
        setFcmToken(result.token);
        Alert.alert(
          'FCM Registration Success! 🔥',
          `Token: ${result.token.substring(0, 30)}...`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('FCM Registration Failed', result.error || 'Unknown error');
      }
    } catch (error) {
      Alert.alert('FCM Registration Error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSendTestNotification = async () => {
    try {
      await fcmPushNotificationService.sendLocalTestNotification();
      Alert.alert('Test Notification Sent', 'Check your notification panel!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FCM Push Notifications Test</Text>
      
      <TouchableOpacity 
        style={[styles.button, isRegistering && styles.buttonDisabled]} 
        onPress={handleRegisterFCM}
        disabled={isRegistering}
      >
        <Text style={styles.buttonText}>
          {isRegistering ? 'Registering...' : 'Register for FCM'}
        </Text>
      </TouchableOpacity>

      {fcmToken && (
        <View style={styles.tokenContainer}>
          <Text style={styles.tokenLabel}>FCM Token:</Text>
          <Text style={styles.tokenText}>{fcmToken.substring(0, 50)}...</Text>
        </View>
      )}

      <TouchableOpacity 
        style={styles.button} 
        onPress={handleSendTestNotification}
      >
        <Text style={styles.buttonText}>Send Test Notification</Text>
      </TouchableOpacity>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>FCM Setup Checklist:</Text>
        <Text style={styles.infoText}>✅ Firebase dependencies installed</Text>
        <Text style={styles.infoText}>✅ Android permissions added</Text>
        <Text style={styles.infoText}>✅ google-services.json configured</Text>
        <Text style={styles.infoText}>✅ FCM service implemented</Text>
        <Text style={styles.infoText}>⚠️ Need to build AAB and test on device</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#cccccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tokenContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  tokenLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  tokenText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  infoContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
});

export default FCMTestComponent;
