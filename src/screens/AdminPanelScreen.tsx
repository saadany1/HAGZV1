import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { supabase, auth, db } from '../lib/supabase';

type AdminPanelNavigationProp = StackNavigationProp<RootStackParamList, 'AdminPanel'>;

interface AdminStats {
  totalUsers: number;
  totalTeams: number;
  totalMatches: number;
  activeTokens: number;
}

interface User {
  id: string;
  username: string;
  email: string;
  push_token: string | null;
  created_at: string;
}

interface NotificationTemplate {
  id: string;
  title: string;
  message: string;
  category: string;
}

const AdminPanelScreen: React.FC = () => {
  const navigation = useNavigation<AdminPanelNavigationProp>();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalTeams: 0,
    totalMatches: 0,
    activeTokens: 0,
  });
  
  // Notification states
  const [testMessage, setTestMessage] = useState('Test notification from admin panel');
  const [testTitle, setTestTitle] = useState('Admin Test');
  const [notificationData, setNotificationData] = useState('');
  
  // User selection states
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  
  // Notification templates
  const [templates] = useState<NotificationTemplate[]>([
    { id: '1', title: '🎉 New Match Available!', message: 'Check out the latest matches in your area!', category: 'Match' },
    { id: '2', title: '⚽ Game Reminder', message: 'Your match is starting in 30 minutes!', category: 'Reminder' },
    { id: '3', title: '🏆 Tournament Update', message: 'New tournament has been announced!', category: 'Tournament' },
    { id: '4', title: '📢 App Update', message: 'New features and improvements are now available!', category: 'Update' },
    { id: '5', title: '🔔 Team Invitation', message: 'You have been invited to join a team!', category: 'Team' },
    { id: '6', title: '⚽ Game Invitation', message: 'You have been invited to join a football match!', category: 'Game Invite' },
  ]);
  
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);

  useEffect(() => {
    loadAdminStats();
    loadUsers();
  }, []);

  const loadAdminStats = async () => {
    setLoading(true);
    try {
      // Get real stats from Supabase
      const { count: totalUsers } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });

      const { count: activeTokens } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .not('push_token', 'is', null);

      // Mock data for teams and matches (you can replace with real queries)
      setStats({
        totalUsers: totalUsers || 0,
        totalTeams: 45, // Replace with real query
        totalMatches: 89, // Replace with real query
        activeTokens: activeTokens || 0,
      });
    } catch (error) {
      console.error('Error loading admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data: usersData, error } = await supabase
        .from('user_profiles')
        .select('id, username, email, push_token, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error loading users:', error);
        return;
      }

      setUsers(usersData || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const sendBroadcastNotification = async () => {
    if (!testTitle.trim() || !testMessage.trim()) {
      Alert.alert('Error', 'Please enter both title and message');
      return;
    }

    setLoading(true);
    try {
      const serverUrl = 'https://web-production-397d5.up.railway.app'; // Use the correct server URL
      
      const response = await fetch(`${serverUrl}/send-broadcast-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: testTitle.trim(),
          message: testMessage.trim(),
          data: notificationData ? JSON.parse(notificationData) : {},
          sound: true,
        }),
      });

      const result = await response.json();

      if (result.success) {
        Alert.alert(
          'Success',
          `Notification sent to ${result.sentCount} devices!\nFailed: ${result.failedCount}`
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to send notification');
      }
    } catch (error) {
      console.error('Error sending broadcast notification:', error);
      Alert.alert('Error', 'Failed to send notification. Check server connection.');
    } finally {
      setLoading(false);
    }
  };

  const sendUserNotification = async () => {
    if (!selectedUser) {
      Alert.alert('Error', 'Please select a user');
      return;
    }

    if (!testTitle.trim() || !testMessage.trim()) {
      Alert.alert('Error', 'Please enter both title and message');
      return;
    }

    setLoading(true);
    try {
      const serverUrl = 'https://web-production-397d5.up.railway.app'; // Use the correct server URL
      
      const response = await fetch(`${serverUrl}/send-user-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          title: testTitle.trim(),
          message: testMessage.trim(),
          data: notificationData ? JSON.parse(notificationData) : {},
        }),
      });

      const result = await response.json();

      if (result.success) {
        Alert.alert(
          'Success',
          `Notification sent to ${selectedUser.username || selectedUser.email}!`
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to send notification');
      }
    } catch (error) {
      console.error('Error sending user notification:', error);
      Alert.alert('Error', 'Failed to send notification. Check server connection.');
    } finally {
      setLoading(false);
    }
  };

  const useTemplate = (template: NotificationTemplate) => {
    setTestTitle(template.title);
    setTestMessage(template.message);
    setSelectedTemplate(template);
  };

  const clearAllNotifications = async () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear all notifications? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('notifications')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');

              if (error) {
                Alert.alert('Error', 'Failed to clear notifications');
                return;
              }

              Alert.alert('Success', 'All notifications cleared');
              loadAdminStats();
            } catch (error) {
              Alert.alert('Error', 'Failed to clear notifications');
            }
          }
        }
      ]
    );
  };

  return (
    <LinearGradient colors={['#1a1a1a', '#2d2d2d']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Panel</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Stats Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalUsers}</Text>
              <Text style={styles.statLabel}>Total Users</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalTeams}</Text>
              <Text style={styles.statLabel}>Total Teams</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalMatches}</Text>
              <Text style={styles.statLabel}>Total Matches</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.activeTokens}</Text>
              <Text style={styles.statLabel}>Active Tokens</Text>
            </View>
          </View>
        </View>

        {/* Notification Templates Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Quick Templates</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateContainer}>
            {templates.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={[
                  styles.templateCard,
                  selectedTemplate?.id === template.id && styles.selectedTemplate
                ]}
                onPress={() => useTemplate(template)}
              >
                <Text style={styles.templateCategory}>{template.category}</Text>
                <Text style={styles.templateTitle}>{template.title}</Text>
                <Text style={styles.templateMessage} numberOfLines={2}>{template.message}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Push Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📱 Push Notifications</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Notification Title</Text>
            <TextInput
              style={styles.textInput}
              value={testTitle}
              onChangeText={setTestTitle}
              placeholder="Enter notification title"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Notification Message</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={testMessage}
              onChangeText={setTestMessage}
              placeholder="Enter notification message"
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Additional Data (JSON - Optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={notificationData}
              onChangeText={setNotificationData}
              placeholder='{"screen": "More", "action": "open"}'
              placeholderTextColor="#666"
              multiline
              numberOfLines={2}
            />
          </View>

          <TouchableOpacity
            style={[styles.actionButton, loading && styles.buttonDisabled]}
            onPress={sendBroadcastNotification}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="megaphone" size={20} color="#fff" />
                <Text style={styles.buttonText}>Send to All Users</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => setShowUserModal(true)}
            disabled={loading}
          >
            <Ionicons name="person" size={20} color="#fff" />
            <Text style={styles.buttonText}>
              {selectedUser ? `Send to ${selectedUser.username || selectedUser.email}` : 'Select User to Send'}
            </Text>
          </TouchableOpacity>

          {selectedUser && (
            <TouchableOpacity
              style={[styles.actionButton, styles.infoButton]}
              onPress={sendUserNotification}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Send to Selected User</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔧 Admin Actions</Text>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.infoButton]}
            onPress={loadAdminStats}
          >
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.buttonText}>Refresh Stats</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.dangerButton]}
            onPress={clearAllNotifications}
          >
            <Ionicons name="trash" size={20} color="#fff" />
            <Text style={styles.buttonText}>Clear All Notifications</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* User Selection Modal */}
      <Modal
        visible={showUserModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUserModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select User</Text>
              <TouchableOpacity
                onPress={() => setShowUserModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={users}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.userItem,
                    selectedUser?.id === item.id && styles.selectedUserItem
                  ]}
                  onPress={() => {
                    setSelectedUser(item);
                    setShowUserModal(false);
                  }}
                >
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.username || item.email}</Text>
                    <Text style={styles.userEmail}>{item.email}</Text>
                    <Text style={styles.userToken}>
                      {item.push_token ? '✅ Has Push Token' : '❌ No Push Token'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              style={styles.userList}
            />
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    width: '48%',
    marginBottom: 10,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  statLabel: {
    fontSize: 12,
    color: '#ccc',
    marginTop: 5,
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 5,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  actionButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  secondaryButton: {
    backgroundColor: '#f44336',
  },
  infoButton: {
    backgroundColor: '#2196F3',
  },
  buttonDisabled: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  dangerButton: {
    backgroundColor: '#f44336',
  },
  templateContainer: {
    marginBottom: 10,
  },
  templateCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    marginRight: 10,
    width: 200,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedTemplate: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  templateCategory: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  templateTitle: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  templateMessage: {
    fontSize: 12,
    color: '#ccc',
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#2d2d2d',
    borderRadius: 15,
    width: '90%',
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 5,
  },
  userList: {
    maxHeight: 400,
  },
  userItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedUserItem: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 5,
  },
  userToken: {
    fontSize: 12,
    color: '#4CAF50',
  },
});

export default AdminPanelScreen;
