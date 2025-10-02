import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { 
  registerForPushNotificationsAsync, 
  sendTestLocalNotification, 
  sendCustomLocalNotification,
  getCurrentPushToken 
} from '../services/pushNotifications';
import NotificationDebugger from '../services/notificationDebugger';
import { matchReminderService } from '../services/matchReminderService';
import { getEndpointUrl, SERVER_CONFIG } from '../config/server';

interface PushNotificationTesterProps {
  onClose?: () => void;
}

interface PermissionInfo {
  granted: boolean;
  status: string;
  isDevice: boolean;
}

interface UserInfo {
  id: string;
  email: string;
}

const PushNotificationTester: React.FC<PushNotificationTesterProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<PermissionInfo | null>(null);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [dbToken, setDbToken] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  
  // Custom notification states
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customTitle, setCustomTitle] = useState('🏈 Game Alert!');
  const [customMessage, setCustomMessage] = useState('Your match starts in 15 minutes!');
  const [customScreen, setCustomScreen] = useState('More');
  const [withSound, setWithSound] = useState(true);

  useEffect(() => {
    loadTestData();
  }, []);

  const loadTestData = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserInfo({ id: user.id, email: user.email || 'Unknown' });
        
        // Get DB token
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('push_token')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          setDbToken(profile.push_token);
        }
      }

      // Get permissions
      const { status } = await Notifications.getPermissionsAsync();
      const isDevice = true; // Assume device for now
      
      setPermissions({
        granted: status === 'granted',
        status: status,
        isDevice: isDevice,
      });

      // Get current push token
      const token = await getCurrentPushToken();
      setPushToken(token);
      
    } catch (error) {
      console.error('Failed to load test data:', error);
      Alert.alert('Error', 'Failed to load test data');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPermissions = async () => {
    try {
      setLoading(true);
      const user = userInfo;
      if (!user) {
        Alert.alert('Error', 'No user logged in');
        return;
      }

      const token = await registerForPushNotificationsAsync(user.id);
      if (token) {
        setPushToken(token);
        setDbToken(token);
        Alert.alert('Success!', 'Push notifications registered successfully');
      } else {
        Alert.alert('Failed', 'Could not register for push notifications');
      }
      
      await loadTestData();
    } catch (error) {
      console.error('Permission request failed:', error);
      Alert.alert('Error', 'Failed to request permissions');
    } finally {
      setLoading(false);
    }
  };

  const handleTestLocalNotification = async () => {
    try {
      const notificationId = await sendTestLocalNotification();
      if (notificationId) {
        Alert.alert('Success!', 'Test notification sent! Check your notification tray.');
      } else {
        Alert.alert('Failed', 'Could not send test notification');
      }
    } catch (error) {
      console.error('Test notification failed:', error);
      Alert.alert('Error', 'Failed to send test notification');
    }
  };


  const handleSendCustomNotification = async () => {
    try {
      console.log('🔍 Sending customnotification to:', getEndpointUrl(SERVER_CONFIG.ENDPOINTS.BROADCAST_NOTIFICATION));
      console.log('🔍 Payload:', {
        title: customTitle,
        message: customMessage,
        data: { screen: customScreen },
        sound: withSound
      });

      // Send to all users via server
      const response = await fetch(getEndpointUrl(SERVER_CONFIG.ENDPOINTS.BROADCAST_NOTIFICATION), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: customTitle,
          message: customMessage,
          data: { screen: customScreen },
          sound: withSound
        })
      });

      console.log('🔍 Server response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('🔍 Server response:', result);
        Alert.alert('Success!', `Custom notification sent to ${result.sentCount} users!`);
      } else {
        const errorText = await response.text();
        console.error('🔍 Server error:', errorText);
        Alert.alert('Failed', `Server error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('Custom notification failed:', error);
      Alert.alert('Error', `Failed to send custom notification: ${error.message}`);
    }
  };

  const handleTestServerNotification = async () => {
    if (pushToken) {
      Alert.alert(
        'Push Token',
        `Token copied to console. Use this with your server or Expo Push Tool:\n\n${pushToken.substring(0, 50)}...`,
        [{ text: 'OK' }]
      );
      console.log('📱 EXPO PUSH TOKEN FOR SERVER TESTING:');
      console.log(pushToken);
    } else {
      Alert.alert('No Token', 'No push token available');
    }
  };

  const handleTestMatchReminder = async () => {
    try {
      Alert.alert(
        'Match Reminder Test',
        'This will check for upcoming matches that need reminders and send test notifications.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Test Now', 
            onPress: async () => {
              console.log('🧪 Testing match reminder service...');
              await matchReminderService.triggerCheck();
              Alert.alert('Test Complete', 'Check console for results. If you have matches in 2 hours, you should receive notifications.');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Match reminder test failed:', error);
      Alert.alert('Test Failed', 'Could not test match reminders');
    }
  };

  const handleMatchReminderStatus = () => {
    const status = matchReminderService.getStatus();
    Alert.alert(
      'Match Reminder Status',
      `Service: ${status.isRunning ? 'Running' : 'Stopped'}\nCheck Interval: ${status.checkInterval / 1000}s\nNext Check: ${status.nextCheck}`,
      [
        { text: 'OK' },
        { 
          text: status.isRunning ? 'Stop Service' : 'Start Service',
          onPress: () => {
            if (status.isRunning) {
              matchReminderService.stop();
              Alert.alert('Stopped', 'Match reminder service stopped');
            } else {
              matchReminderService.start();
              Alert.alert('Started', 'Match reminder service started');
            }
          }
        }
      ]
    );
  };

  const handleTestGameInvitation = async () => {
    try {
      Alert.alert(
        'Game Invitation Test',
        'This will send a test game invitation notification to yourself.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Send Test', 
            onPress: async () => {
              console.log('🧪 Testing game invitation notification...');
              
              // Send a test local notification
              await sendCustomLocalNotification(
                '⚽ Game Invitation',
                'John Doe invited you to join a match at Al Ahly Stadium',
                {
                  screen: 'GameDetails',
                  gameId: 'test-game-123',
                  type: 'game_invitation',
                  pitchName: 'Al Ahly Stadium',
                  inviterName: 'John Doe'
                },
                { sound: true, priority: 'high' }
              );
              
              Alert.alert('Test Complete', 'Game invitation test notification sent! Tap it to test navigation.');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Game invitation test failed:', error);
      Alert.alert('Test Failed', 'Could not test game invitation');
    }
  };

  const handleRunDiagnostic = async () => {
    try {
      setLoading(true);
      console.log('🔧 Running full notification diagnostic...');
      
      const result = await NotificationDebugger.runFullDiagnostic();
      
      Alert.alert(
        'Diagnostic Complete',
        result.summary,
        [
          { text: 'OK' },
          { 
            text: 'View Details', 
            onPress: () => {
              console.log('📊 Full Diagnostic Result:', result);
              Alert.alert('Diagnostic Details', 'Check console for full diagnostic information');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Diagnostic failed:', error);
      Alert.alert('Diagnostic Failed', 'Could not run notification diagnostic');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading test data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <Ionicons name="notifications" size={28} color="#4CAF50" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Push Notification Center</Text>
            <Text style={styles.subtitle}>Test & manage notifications</Text>
          </View>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#b3b3b3" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

      {/* Status Cards */}
      <View style={styles.statusGrid}>
        <View style={[styles.statusCard, permissions?.isDevice ? styles.statusCardSuccess : styles.statusCardError]}>
          <View style={styles.statusCardIcon}>
            <Ionicons 
              name={permissions?.isDevice ? "phone-portrait" : "desktop"} 
              size={24} 
              color={permissions?.isDevice ? "#4CAF50" : "#F44336"} 
            />
          </View>
          <Text style={styles.statusCardTitle}>Device</Text>
          <Text style={styles.statusCardValue}>
            {permissions?.isDevice ? 'Physical' : 'Simulator'}
          </Text>
        </View>

        <View style={[styles.statusCard, permissions?.granted ? styles.statusCardSuccess : styles.statusCardError]}>
          <View style={styles.statusCardIcon}>
            <Ionicons 
              name={permissions?.granted ? "notifications" : "notifications-off"} 
              size={24} 
              color={permissions?.granted ? "#4CAF50" : "#F44336"} 
            />
          </View>
          <Text style={styles.statusCardTitle}>Permissions</Text>
          <Text style={styles.statusCardValue}>
            {permissions?.granted ? 'Granted' : 'Denied'}
          </Text>
        </View>

        <View style={[styles.statusCard, userInfo ? styles.statusCardSuccess : styles.statusCardError]}>
          <View style={styles.statusCardIcon}>
            <Ionicons 
              name={userInfo ? "person" : "person-outline"} 
              size={24} 
              color={userInfo ? "#4CAF50" : "#F44336"} 
            />
          </View>
          <Text style={styles.statusCardTitle}>User</Text>
          <Text style={styles.statusCardValue}>
            {userInfo ? 'Logged In' : 'Not Logged'}
          </Text>
        </View>

        <View style={[styles.statusCard, pushToken === dbToken && pushToken ? styles.statusCardSuccess : styles.statusCardWarning]}>
          <View style={styles.statusCardIcon}>
            <Ionicons 
              name={pushToken === dbToken && pushToken ? "sync" : "sync-outline"} 
              size={24} 
              color={pushToken === dbToken && pushToken ? "#4CAF50" : "#FF9800"} 
            />
          </View>
          <Text style={styles.statusCardTitle}>Sync</Text>
          <Text style={styles.statusCardValue}>
            {pushToken === dbToken && pushToken ? 'Synced' : 'Not Synced'}
          </Text>
        </View>
      </View>

      {/* Token Information */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="key" size={20} color="#4CAF50" />
          <Text style={styles.sectionTitle}>Push Tokens</Text>
        </View>
        
        <View style={styles.tokenCard}>
          <View style={styles.tokenRow}>
            <Text style={styles.tokenLabel}>Current Token</Text>
            <TouchableOpacity 
              style={styles.tokenCopyButton}
              onPress={() => {
                if (pushToken) {
                  console.log('Token copied:', pushToken);
                  Alert.alert('Copied!', 'Token copied to console');
                }
              }}
            >
              <Ionicons name="copy" size={16} color="#4CAF50" />
            </TouchableOpacity>
          </View>
          <Text style={styles.tokenValue}>
            {pushToken ? `${pushToken.substring(0, 40)}...` : 'No token available'}
          </Text>
        </View>

        <View style={styles.tokenCard}>
          <Text style={styles.tokenLabel}>Database Token</Text>
          <Text style={styles.tokenValue}>
            {dbToken ? `${dbToken.substring(0, 40)}...` : 'No token in database'}
          </Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="flash" size={20} color="#4CAF50" />
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        
        <View style={styles.actionGrid}>
          <TouchableOpacity 
            style={[styles.actionCard, !permissions?.granted && styles.actionCardDisabled]} 
            onPress={handleRequestPermissions}
            disabled={loading}
          >
            <View style={styles.actionCardIcon}>
              <Ionicons name="shield-checkmark" size={24} color={permissions?.granted ? "#4CAF50" : "#666"} />
            </View>
            <Text style={styles.actionCardTitle}>Setup</Text>
            <Text style={styles.actionCardSubtitle}>Grant permissions</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionCard, !permissions?.granted && styles.actionCardDisabled]} 
            onPress={handleTestLocalNotification}
            disabled={!permissions?.granted}
          >
            <View style={styles.actionCardIcon}>
              <Ionicons name="notifications" size={24} color={permissions?.granted ? "#2196F3" : "#666"} />
            </View>
            <Text style={styles.actionCardTitle}>Test</Text>
            <Text style={styles.actionCardSubtitle}>Basic notification</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionCard, !permissions?.granted && styles.actionCardDisabled]} 
            onPress={() => setShowCustomForm(!showCustomForm)}
            disabled={!permissions?.granted}
          >
            <View style={styles.actionCardIcon}>
              <Ionicons name="build" size={24} color={permissions?.granted ? "#FF9800" : "#666"} />
            </View>
            <Text style={styles.actionCardTitle}>Custom</Text>
            <Text style={styles.actionCardSubtitle}>Build notification</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionCard, !pushToken && styles.actionCardDisabled]} 
            onPress={handleTestServerNotification}
            disabled={!pushToken}
          >
            <View style={styles.actionCardIcon}>
              <Ionicons name="server" size={24} color={pushToken ? "#9C27B0" : "#666"} />
            </View>
            <Text style={styles.actionCardTitle}>Server</Text>
            <Text style={styles.actionCardSubtitle}>Get token</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard} 
            onPress={handleTestMatchReminder}
          >
            <View style={styles.actionCardIcon}>
              <Ionicons name="football" size={24} color="#E91E63" />
            </View>
            <Text style={styles.actionCardTitle}>Match Test</Text>
            <Text style={styles.actionCardSubtitle}>Test reminders</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard} 
            onPress={handleMatchReminderStatus}
          >
            <View style={styles.actionCardIcon}>
              <Ionicons name="time" size={24} color="#795548" />
            </View>
            <Text style={styles.actionCardTitle}>Service</Text>
            <Text style={styles.actionCardSubtitle}>Reminder status</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard} 
            onPress={handleTestGameInvitation}
          >
            <View style={styles.actionCardIcon}>
              <Ionicons name="mail" size={24} color="#00BCD4" />
            </View>
            <Text style={styles.actionCardTitle}>Invite Test</Text>
            <Text style={styles.actionCardSubtitle}>Game invitations</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard} 
            onPress={handleRunDiagnostic}
          >
            <View style={styles.actionCardIcon}>
              <Ionicons name="bug" size={24} color="#FF5722" />
            </View>
            <Text style={styles.actionCardTitle}>Diagnostic</Text>
            <Text style={styles.actionCardSubtitle}>Full AAB test</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={loadTestData}
          disabled={loading}
        >
          <Ionicons name="refresh" size={20} color="#4CAF50" />
          <Text style={styles.refreshButtonText}>Refresh Status</Text>
        </TouchableOpacity>
      </View>

        {/* Custom Notification Form */}
        {showCustomForm && (
          <View style={styles.customBuilderSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="brush" size={20} color="#FF9800" />
              <Text style={styles.sectionTitle}>Custom Notification Builder</Text>
            </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Title:</Text>
            <TextInput
              style={styles.textInput}
              value={customTitle}
              onChangeText={setCustomTitle}
              placeholder="Enter notification title..."
              placeholderTextColor="#666666"
              maxLength={100}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Message:</Text>
            <TextInput
              style={[styles.textInput, styles.messageInput]}
              value={customMessage}
              onChangeText={setCustomMessage}
              placeholder="Enter notification message..."
              placeholderTextColor="#666666"
              multiline={true}
              numberOfLines={3}
              maxLength={200}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Navigate to Screen:</Text>
            <View style={styles.screenSelector}>
              {['More', 'Home', 'Play', 'Profile'].map((screen) => (
                <TouchableOpacity
                  key={screen}
                  style={[
                    styles.screenOption,
                    customScreen === screen && styles.screenOptionSelected
                  ]}
                  onPress={() => setCustomScreen(screen)}
                >
                  <Text style={[
                    styles.screenOptionText,
                    customScreen === screen && styles.screenOptionTextSelected
                  ]}>
                    {screen}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.switchContainer}>
            <Text style={styles.inputLabel}>Play Sound:</Text>
            <Switch
              value={withSound}
              onValueChange={setWithSound}
              trackColor={{ false: '#ccc', true: '#4CAF50' }}
              thumbColor={withSound ? '#fff' : '#f4f3f4'}
            />
          </View>

          <TouchableOpacity 
            style={[
              styles.primaryButton, 
              (!permissions?.granted || !customTitle.trim() || !customMessage.trim()) && styles.primaryButtonDisabled
            ]} 
            onPress={handleSendCustomNotification}
            disabled={!permissions?.granted || !customTitle.trim() || !customMessage.trim()}
          >
            <Ionicons name="send" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>Send Custom Notification</Text>
          </TouchableOpacity>

          <View style={styles.previewContainer}>
            <Text style={styles.previewLabel}>Preview:</Text>
            <View style={styles.notificationPreview}>
              <Text style={styles.previewTitle}>{customTitle || 'Title'}</Text>
              <Text style={styles.previewMessage}>{customMessage || 'Message'}</Text>
              <Text style={styles.previewMeta}>
                🔊 Sound: {withSound ? 'notification_sound.wav' : 'Silent'} • 📱 Screen: {customScreen}
              </Text>
            </View>
            <Text style={styles.previewNote}>
              💡 Tap the notification when it appears to test navigation to {customScreen} screen
            </Text>
          </View>
        </View>
      )}

      {/* Instructions */}
      <View style={styles.instructionsSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="information-circle" size={20} color="#2196F3" />
          <Text style={styles.sectionTitle}>Testing Guide</Text>
        </View>
        
        <View style={styles.instructionCard}>
          <View style={styles.instructionStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={styles.instructionText}>Use a physical device (not simulator)</Text>
          </View>
          
          <View style={styles.instructionStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={styles.instructionText}>Build with EAS and install APK</Text>
          </View>
          
          <View style={styles.instructionStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={styles.instructionText}>Grant notification permissions</Text>
          </View>
          
          <View style={styles.instructionStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <Text style={styles.instructionText}>Test local notifications first</Text>
          </View>
          
          <View style={styles.instructionStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>5</Text>
            </View>
            <Text style={styles.instructionText}>Tap notifications to test navigation</Text>
          </View>
        </View>
      </View>
    </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    backgroundColor: '#1e1e1e',
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#b3b3b3',
    fontWeight: '500',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  
  // Status Cards
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statusCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
  },
  statusCardSuccess: {
    borderColor: 'rgba(76, 175, 80, 0.3)',
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
  },
  statusCardError: {
    borderColor: 'rgba(244, 67, 54, 0.3)',
    backgroundColor: 'rgba(244, 67, 54, 0.05)',
  },
  statusCardWarning: {
    borderColor: 'rgba(255, 152, 0, 0.3)',
    backgroundColor: 'rgba(255, 152, 0, 0.05)',
  },
  statusCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  statusCardValue: {
    fontSize: 12,
    color: '#b3b3b3',
    fontWeight: '500',
  },
  
  // Sections
  section: {
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#333333',
  },
  customBuilderSection: {
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
    borderColor: 'rgba(255, 152, 0, 0.3)',
  },
  instructionsSection: {
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
    borderColor: 'rgba(33, 150, 243, 0.3)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 8,
  },
  
  // Token Cards
  tokenCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#404040',
  },
  tokenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tokenLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  tokenCopyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenValue: {
    fontSize: 12,
    color: '#b3b3b3',
    fontFamily: 'monospace',
    backgroundColor: '#333333',
    padding: 12,
    borderRadius: 8,
  },
  
  // Action Grid
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  actionCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#404040',
  },
  actionCardDisabled: {
    opacity: 0.5,
  },
  actionCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  actionCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  actionCardSubtitle: {
    fontSize: 12,
    color: '#b3b3b3',
    textAlign: 'center',
  },
  
  // Buttons
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  refreshButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9C27B0',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#9C27B0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonDisabled: {
    backgroundColor: '#666666',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  
  // Form Inputs
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#2a2a2a',
    borderWidth: 2,
    borderColor: '#404040',
    borderRadius: 12,
    padding: 16,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  messageInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  
  // Screen Selector
  screenSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  screenOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    borderWidth: 2,
    borderColor: '#404040',
  },
  screenOptionSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  screenOptionText: {
    color: '#b3b3b3',
    fontSize: 14,
    fontWeight: '600',
  },
  screenOptionTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#404040',
  },
  
  // Preview
  previewContainer: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#404040',
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  notificationPreview: {
    backgroundColor: '#1e1e1e',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  previewMessage: {
    fontSize: 14,
    color: '#b3b3b3',
    lineHeight: 20,
    marginBottom: 10,
  },
  previewMeta: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '500',
  },
  previewNote: {
    fontSize: 12,
    color: '#b3b3b3',
    fontStyle: 'italic',
    marginTop: 12,
    textAlign: 'center',
    padding: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderRadius: 8,
  },
  
  // Instructions
  instructionCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#b3b3b3',
    fontWeight: '500',
    lineHeight: 20,
  },
  
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
  },
});

export default PushNotificationTester;