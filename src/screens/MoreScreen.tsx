import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ImageBackground,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RootStackParamList, TabParamList } from '../navigation/AppNavigator';
import { supabase } from '../lib/supabase';
import PushNotificationTester from '../components/PushNotificationTester';
import { gameInvitationService } from '../services/gameInvitationService';

type MoreScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'More'>,
  StackNavigationProp<RootStackParamList>
>;

const MoreScreen: React.FC = () => {
  const navigation = useNavigation<MoreScreenNavigationProp>();
  const [showSignOutModal, setShowSignOutModal] = React.useState(false);
  const [showPushTester, setShowPushTester] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  useEffect(() => {
    checkAdminStatus();
    loadNotifications();
  }, []);

  // Refresh notifications when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadNotifications();
    });
    return unsubscribe;
  }, [navigation]);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email === 'adelsaadany1@gmail.com') {
        setIsAdmin(true);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const loadNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userNotifications, error } = await supabase
        .from('notifications')
        .select(`
          *,
          game:bookings(
            id,
            pitch_name,
            pitch_location,
            date,
            time,
            max_players
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error loading notifications:', error);
        return;
      }

      // Get inviter details for each notification
      const notificationsWithInviter = await Promise.all(
        (userNotifications || []).map(async (notification) => {
          if (notification.invited_by) {
            const { data: inviter } = await supabase
              .from('user_profiles')
              .select('id, full_name, username')
              .eq('id', notification.invited_by)
              .single();
            
            return { ...notification, inviter };
          }
          return notification;
        })
      );

      setNotifications(notificationsWithInviter);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleAcceptInvitation = async (notification: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Join the game
      const { error: joinError } = await supabase
        .from('booking_members')
        .insert({
          booking_id: notification.game_id,
          user_id: user.id,
          role: 'player',
          status: 'confirmed',
          joined_at: new Date().toISOString()
        });

      if (joinError) {
        console.error('Error joining game:', joinError);
        Alert.alert('Error', 'Failed to join the game. Please try again.');
        return;
      }

      // Update notification status
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ status: 'accepted' })
        .eq('id', notification.id);

      if (updateError) {
        console.error('Error updating notification:', updateError);
      }

      // Refresh notifications
      await loadNotifications();
      
      Alert.alert('Success!', 'You have joined the game successfully!');
      
      // Navigate to game details
      navigation.navigate('GameDetails', { gameId: notification.game_id });
    } catch (error) {
      console.error('Error accepting invitation:', error);
      Alert.alert('Error', 'Failed to accept invitation. Please try again.');
    }
  };

  const handleRejectInvitation = async (notification: any) => {
    try {
      // Update notification status
      const { error } = await supabase
        .from('notifications')
        .update({ status: 'rejected' })
        .eq('id', notification.id);

      if (error) {
        console.error('Error updating notification:', error);
        Alert.alert('Error', 'Failed to reject invitation. Please try again.');
        return;
      }

      // Refresh notifications
      await loadNotifications();
      
      Alert.alert('Invitation Rejected', 'You have declined the game invitation.');
    } catch (error) {
      console.error('Error rejecting invitation:', error);
      Alert.alert('Error', 'Failed to reject invitation. Please try again.');
    }
  };

  const handleSignOut = () => {
    setShowSignOutModal(true);
  };

  const handleConfirmSignOut = async () => {
    setShowSignOutModal(false);
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();
      console.log('✅ User signed out successfully');
      // Navigation will be handled automatically by the auth state change
    } catch (error) {
      console.error('❌ Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  const handleCancelSignOut = () => {
    setShowSignOutModal(false);
  };

  const menuItems = [
    {
      icon: 'person',
      title: 'Profile',
      subtitle: 'Edit your profile and settings',
      onPress: () => navigation.navigate('Profile' as any),
    },
    {
      icon: 'help-circle',
      title: 'Help & Support',
      subtitle: 'Get help and contact support',
      onPress: () => navigation.navigate('HelpSupport'),
    },
    {
      icon: 'document-text',
      title: 'Terms & Privacy',
      subtitle: 'Read our terms and privacy policy',
      onPress: () => navigation.navigate('TermsPrivacy'),
    },
    {
      icon: 'information-circle',
      title: 'About',
      subtitle: 'App version and information',
      onPress: () => navigation.navigate('About'),
    },
  ];

  return (
    <ImageBackground
      source={require('../../assets/hage.jpeg')}
      style={styles.container}
    >
      <View style={styles.backgroundOverlay}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>More</Text>
            <Text style={styles.subtitle}>Settings and additional options</Text>
          </View>

          {/* Notifications Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔔 Notifications</Text>
            
            {loadingNotifications ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading notifications...</Text>
              </View>
            ) : notifications.length > 0 ? (
              notifications.map((notification) => {
                const getStatusColor = (status: string) => {
                  switch (status) {
                    case 'pending': return '#FF9800';
                    case 'accepted': return '#4CAF50';
                    case 'rejected': return '#f44336';
                    default: return 'rgba(255, 255, 255, 0.5)';
                  }
                };

                const getStatusIcon = (status: string) => {
                  switch (status) {
                    case 'pending': return 'time';
                    case 'accepted': return 'checkmark-circle';
                    case 'rejected': return 'close-circle';
                    default: return 'notifications';
                  }
                };

                const getStatusText = (status: string) => {
                  switch (status) {
                    case 'pending': return 'Pending';
                    case 'accepted': return 'Accepted';
                    case 'rejected': return 'Declined';
                    default: return 'Unknown';
                  }
                };

                return (
                  <View key={notification.id} style={[
                    styles.notificationItem,
                    notification.status !== 'pending' && styles.notificationItemInactive
                  ]}>
                    <View style={styles.notificationContent}>
                      <View style={styles.notificationHeader}>
                        <Ionicons 
                          name={notification.type === 'game_invitation' ? 'football' : 'notifications'} 
                          size={20} 
                          color="#4CAF50" 
                        />
                        <Text style={styles.notificationTitle}>{notification.title}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(notification.status) }]}>
                          <Ionicons 
                            name={getStatusIcon(notification.status) as any} 
                            size={12} 
                            color="#fff" 
                          />
                          <Text style={styles.statusText}>{getStatusText(notification.status)}</Text>
                        </View>
                      </View>
                      <Text style={styles.notificationMessage}>{notification.message}</Text>
                      {notification.game && (
                        <View style={styles.gameInfo}>
                          <Text style={styles.gameName}>{notification.game.pitch_name}</Text>
                          <Text style={styles.gameDetails}>
                            {new Date(notification.game.date).toLocaleDateString()} at {notification.game.time}
                          </Text>
                          <Text style={styles.gameLocation}>{notification.game.pitch_location}</Text>
                        </View>
                      )}
                      {notification.inviter && (
                        <View style={styles.inviterInfo}>
                          <Text style={styles.inviterText}>
                            Invited by: {notification.inviter.full_name || notification.inviter.username || 'Unknown'}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.notificationTime}>
                        {new Date(notification.created_at).toLocaleString()}
                      </Text>
                      {notification.type === 'game_invitation' && notification.status === 'pending' && (
                        <View style={styles.invitationActions}>
                          <TouchableOpacity
                            style={styles.acceptButton}
                            onPress={() => handleAcceptInvitation(notification)}
                          >
                            <Ionicons name="checkmark" size={16} color="#fff" />
                            <Text style={styles.acceptButtonText}>Accept</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.rejectButton}
                            onPress={() => handleRejectInvitation(notification)}
                          >
                            <Ionicons name="close" size={16} color="#fff" />
                            <Text style={styles.rejectButtonText}>Decline</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyNotifications}>
                <Ionicons name="notifications-outline" size={32} color="rgba(255, 255, 255, 0.3)" />
                <Text style={styles.emptyText}>No notifications</Text>
                <Text style={styles.emptySubtext}>You're all caught up!</Text>
              </View>
            )}
          </View>

          {/* Admin/Developer Section */}
          {isAdmin && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🔧 Developer Tools</Text>
              
              <TouchableOpacity 
                style={styles.adminButton} 
                onPress={() => setShowPushTester(true)}
              >
                <View style={styles.menuIcon}>
                  <Ionicons name="notifications" size={24} color="#fff" />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>Push Notification Tester</Text>
                  <Text style={styles.menuSubtitle}>Test push notification functionality</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.5)" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            
            {menuItems.slice(0, 3).map((item, index) => (
              <TouchableOpacity key={index} style={styles.menuItem} onPress={item.onPress}>
                <View style={styles.menuIcon}>
                  <Ionicons name={item.icon as any} size={24} color="#fff" />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.5)" />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support</Text>
            
            {menuItems.slice(3, 5).map((item, index) => (
              <TouchableOpacity key={index} style={styles.menuItem} onPress={item.onPress}>
                <View style={styles.menuIcon}>
                  <Ionicons name={item.icon as any} size={24} color="#fff" />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.5)" />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>App</Text>
            
            {menuItems.slice(5).map((item, index) => (
              <TouchableOpacity key={index} style={styles.menuItem} onPress={item.onPress}>
                <View style={styles.menuIcon}>
                  <Ionicons name={item.icon as any} size={24} color="#fff" />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.5)" />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <View style={styles.signOutIcon}>
                <Ionicons name="log-out-outline" size={24} color="#ef4444" />
              </View>
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.versionText}>Hagz v1.0.0</Text>
            <Text style={styles.copyrightText}>© 2024 Hagz. All rights reserved.</Text>
          </View>
        </ScrollView>
      </View>

      {/* Sign Out Confirmation Modal */}
      <Modal
        visible={showSignOutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelSignOut}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModal}>
            <View style={styles.confirmationIconContainer}>
              <Ionicons name="log-out" size={32} color="rgba(255, 255, 255, 0.9)" />
            </View>
            <Text style={styles.confirmationTitle}>Sign Out</Text>
            <Text style={styles.confirmationMessage}>
              Are you sure you want to sign out?
            </Text>
            <View style={styles.confirmationButtons}>
              <TouchableOpacity 
                style={styles.confirmationButtonSecondary}
                onPress={handleCancelSignOut}
              >
                <Text style={styles.confirmationButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.confirmationButtonPrimary}
                onPress={handleConfirmSignOut}
              >
                <Text style={styles.confirmationButtonTextPrimary}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Push Notification Tester Modal */}
      <Modal
        visible={showPushTester}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPushTester(false)}
      >
        <PushNotificationTester onClose={() => setShowPushTester(false)} />
      </Modal>

    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 30,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  menuItem: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  signOutButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  signOutIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  versionText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 8,
  },
  copyrightText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.3)',
  },
  // Admin button styles
  adminButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  // Confirmation Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  confirmationModal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    width: '100%',
    maxWidth: 280,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  confirmationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
  },
  confirmationMessage: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  confirmationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmationButtonSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    flex: 1,
  },
  confirmationButtonPrimary: {
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    flex: 1,
  },
  confirmationButtonTextSecondary: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  confirmationButtonTextPrimary: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  // Notification styles
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  notificationItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  notificationContent: {
    padding: 16,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
    flex: 1,
  },
  notificationMessage: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
    marginBottom: 12,
  },
  gameInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  gameName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 4,
  },
  gameDetails: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 2,
  },
  gameLocation: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  rejectButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyNotifications: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  // Additional notification styles
  notificationItemInactive: {
    opacity: 0.7,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  inviterInfo: {
    marginTop: 8,
    marginBottom: 4,
  },
  inviterText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontStyle: 'italic',
  },
  notificationTime: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 4,
  },
});

export default MoreScreen;