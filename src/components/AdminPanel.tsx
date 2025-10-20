import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Switch
} from 'react-native';
import { supabase } from '../lib/supabase';
// Push notification features removed

interface AdminStats {
  totalUsers: number;
  usersWithTokens: number;
  totalNotifications: number;
}

export const AdminPanel: React.FC = () => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [data, setData] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    usersWithTokens: 0,
    totalNotifications: 0
  });
  const [selectedUserId, setSelectedUserId] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
    loadUsers();
  }, []);

  const loadStats = async () => {
    try {
      // Get total users
      const { count: totalUsers } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });

      // Get users with push tokens
      const { count: usersWithTokens } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .not('push_token', 'is', null);

      // Get total notifications
      const { count: totalNotifications } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalUsers: totalUsers || 0,
        usersWithTokens: usersWithTokens || 0,
        totalNotifications: totalNotifications || 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const { data: users, error } = await supabase
        .from('user_profiles')
        .select('id, username, email, push_token')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error loading users:', error);
        return;
      }

      setAllUsers(users || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const sendNotificationToAllUsers = async () => {
    Alert.alert('Info', 'Push notifications have been removed in this build.');
  };

  const sendNotificationToUser = async () => {
    if (!selectedUserId || !title.trim() || !body.trim()) {
      Alert.alert('Error', 'Please select a user and enter title/body');
      return;
    }

    setIsLoading(true);
    try {
      Alert.alert('Info', 'Push notifications have been removed in this build.');
    } catch (error) {
      console.error('Error sending notification to user:', error);
      Alert.alert('Error', 'Failed to send notification');
    } finally {
      setIsLoading(false);
    }
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
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

              if (error) {
                Alert.alert('Error', 'Failed to clear notifications');
                return;
              }

              Alert.alert('Success', 'All notifications cleared');
              loadStats();
            } catch (error) {
              Alert.alert('Error', 'Failed to clear notifications');
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Admin Panel</Text>
      
      {/* Stats */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>Statistics</Text>
        <View style={styles.statsRow}>
          <Text style={styles.statText}>Total Users: {stats.totalUsers}</Text>
          <Text style={styles.statText}>With Tokens: {stats.usersWithTokens}</Text>
        </View>
        <Text style={styles.statText}>Total Notifications: {stats.totalNotifications}</Text>
      </View>

      {/* Notification Form */}
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>Send Notification</Text>
        
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Notification Title"
        />
        
        <TextInput
          style={[styles.input, styles.textArea]}
          value={body}
          onChangeText={setBody}
          placeholder="Notification Body"
          multiline
          numberOfLines={3}
        />
        
        <TextInput
          style={[styles.input, styles.textArea]}
          value={data}
          onChangeText={setData}
          placeholder="Data (JSON format, optional)"
          multiline
          numberOfLines={2}
        />

        {/* Push notification controls removed */}

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={sendNotificationToAllUsers}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send to All Users</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Send to Specific User */}
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>Send to Specific User</Text>
        
        <Text style={styles.label}>Select User:</Text>
        <ScrollView style={styles.userList} horizontal>
          {allUsers.map((user) => (
            <TouchableOpacity
              key={user.id}
              style={[
                styles.userItem,
                selectedUserId === user.id && styles.selectedUserItem
              ]}
              onPress={() => setSelectedUserId(user.id)}
            >
              <Text style={styles.userText}>{user.username || user.email}</Text>
              <Text style={styles.userSubtext}>
                {user.push_token ? 'Has Token' : 'No Token'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={sendNotificationToUser}
          disabled={isLoading || !selectedUserId}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send to Selected User</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Admin Actions */}
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>Admin Actions</Text>
        
        <TouchableOpacity
          style={[styles.button, styles.dangerButton]}
          onPress={clearAllNotifications}
        >
          <Text style={styles.buttonText}>Clear All Notifications</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.infoButton]}
          onPress={loadStats}
        >
          <Text style={styles.buttonText}>Refresh Stats</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  statsContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  statText: {
    fontSize: 14,
    color: '#666',
  },
  formContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  userList: {
    marginBottom: 15,
  },
  userItem: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    marginRight: 10,
    borderRadius: 5,
    minWidth: 120,
  },
  selectedUserItem: {
    backgroundColor: '#4CAF50',
  },
  userText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  userSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  button: {
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
  },
  secondaryButton: {
    backgroundColor: '#2196F3',
  },
  dangerButton: {
    backgroundColor: '#f44336',
  },
  infoButton: {
    backgroundColor: '#ff9800',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AdminPanel;
