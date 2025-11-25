import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { auth, db } from '../lib/supabase';

const AuthStatus: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const currentUser = await auth.getCurrentUser();
      setUser(currentUser);

      if (currentUser) {
        // Check if user profile exists
        const { data: profileData } = await db.getUserProfile(currentUser.id);
        setProfile(profileData);
      }
    } catch (error) {
      console.error('Auth status check error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Checking authentication...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Authentication Status</Text>
      
      {user ? (
        <View style={styles.userInfo}>
          <Text style={styles.text}>✅ User: {user.email}</Text>
          <Text style={styles.text}>ID: {user.id}</Text>
          
          {profile ? (
            <View style={styles.profileInfo}>
              <Text style={styles.text}>✅ Profile: {profile.full_name}</Text>
              <Text style={styles.text}>Created: {new Date(profile.created_at).toLocaleDateString()}</Text>
            </View>
          ) : (
            <Text style={styles.warning}>⚠️ No profile found</Text>
          )}
        </View>
      ) : (
        <Text style={styles.text}>❌ Not authenticated</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    margin: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  userInfo: {
    marginTop: 8,
  },
  profileInfo: {
    marginTop: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(0, 212, 255, 0.5)',
  },
  warning: {
    fontSize: 14,
    color: '#ffa500',
    marginTop: 8,
  },
});

export default AuthStatus;

