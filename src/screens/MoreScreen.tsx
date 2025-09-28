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
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RootStackParamList, TabParamList } from '../navigation/AppNavigator';
import { supabase } from '../lib/supabase';

interface Notification {
  id: string;
  type: 'game_invitation';
  title: string;
  message: string;
  game_id: string;
  game_title: string;
  game_date: string;
  game_time: string;
  game_location: string;
  invited_by: string;
  invited_by_name: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

type MoreScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'More'>,
  StackNavigationProp<RootStackParamList>
>;

const MoreScreen: React.FC = () => {
  const navigation = useNavigation<MoreScreenNavigationProp>();
  const [showSignOutModal, setShowSignOutModal] = React.useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingNotification, setProcessingNotification] = useState<string | null>(null);
  const [expandedNotifications, setExpandedNotifications] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get notifications for the current user
      const { data: notificationsData, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading notifications:', error);
        return;
      }

      if (!notificationsData || notificationsData.length === 0) {
        setNotifications([]);
        return;
      }

      // Get unique game IDs and user IDs
      const gameIds = [...new Set(notificationsData.map((n: any) => n.game_id))];
      const userIds = [...new Set(notificationsData.map((n: any) => n.invited_by))];

      // Fetch game details
      const { data: gamesData } = await supabase
        .from('bookings')
        .select('id, pitch_name, date, time, pitch_location')
        .in('id', gameIds);

      // Fetch user profiles
      const { data: usersData } = await supabase
        .from('user_profiles')
        .select('id, full_name, username')
        .in('id', userIds);

      // Transform the data to match our interface
      const transformedNotifications: Notification[] = notificationsData.map((notification: any) => {
        const game = gamesData?.find((g: any) => g.id === notification.game_id);
        const inviter = usersData?.find((u: any) => u.id === notification.invited_by);
        
        return {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          game_id: notification.game_id,
          game_title: game?.pitch_name || 'Unknown Game',
          game_date: game?.date || '',
          game_time: game?.time || '',
          game_location: game?.pitch_location || '',
          invited_by: notification.invited_by,
          invited_by_name: inviter?.full_name || inviter?.username || 'Unknown',
          status: notification.status,
          created_at: notification.created_at,
        };
      });

      setNotifications(transformedNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoadingNotifications(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleAcceptInvitation = async (notificationId: string, gameId: string) => {
    setProcessingNotification(notificationId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Add user to the game
      const { error: joinError } = await supabase
        .from('game_members')
        .insert({
          game_id: gameId,
          user_id: user.id,
          role: 'player',
          status: 'joined'
        });

      if (joinError) {
        console.error('Error joining game:', joinError);
        return;
      }

      // Update notification status
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ status: 'accepted' })
        .eq('id', notificationId);

      if (updateError) {
        console.error('Error updating notification:', updateError);
        return;
      }

      // Refresh notifications
      await loadNotifications();
    } catch (error) {
      console.error('Error accepting invitation:', error);
    } finally {
      setProcessingNotification(null);
    }
  };

  const handleDeclineInvitation = async (notificationId: string) => {
    setProcessingNotification(notificationId);
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ status: 'declined' })
        .eq('id', notificationId);

      if (error) {
        console.error('Error declining invitation:', error);
        return;
      }

      // Refresh notifications
      await loadNotifications();
    } catch (error) {
      console.error('Error declining invitation:', error);
    } finally {
      setProcessingNotification(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FFA726';
      case 'accepted': return '#4CAF50';
      case 'declined': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'accepted': return 'Accepted';
      case 'declined': return 'Declined';
      default: return 'Unknown';
    }
  };

  const handleSignOut = () => {
    setShowSignOutModal(true);
  };

  const handleConfirmSignOut = () => {
    setShowSignOutModal(false);
    navigation.navigate('Landing');
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
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Notifications</Text>
              <TouchableOpacity 
                style={styles.refreshButton}
                onPress={handleRefresh}
                disabled={refreshing}
              >
                <Ionicons 
                  name="refresh" 
                  size={20} 
                  color={refreshing ? "rgba(255, 255, 255, 0.3)" : "#fff"} 
                />
              </TouchableOpacity>
            </View>
            
            {loadingNotifications ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#4CAF50" />
                <Text style={styles.loadingText}>Loading notifications...</Text>
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="notifications-outline" size={32} color="rgba(255, 255, 255, 0.3)" />
                <Text style={styles.emptyTitle}>No Notifications</Text>
                <Text style={styles.emptyText}>
                  You'll receive notifications when someone invites you to a game.
                </Text>
              </View>
            ) : (
              <ScrollView 
                style={styles.notificationsScrollView}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor="#4CAF50"
                    colors={["#4CAF50"]}
                  />
                }
              >
                {notifications.map((notification) => {
                  const isExpanded = expandedNotifications.has(notification.id);
                  
                  return (
                  <TouchableOpacity 
                    key={notification.id} 
                    style={[styles.notificationCard, isExpanded && styles.notificationCardExpanded]}
                    onPress={() => {
                      const newExpanded = new Set(expandedNotifications);
                      if (isExpanded) {
                        newExpanded.delete(notification.id);
                      } else {
                        newExpanded.add(notification.id);
                      }
                      setExpandedNotifications(newExpanded);
                    }}
                  >
                    <View style={styles.notificationHeader}>
                      <View style={styles.notificationInfo}>
                        <Text style={styles.notificationTitle} numberOfLines={isExpanded ? undefined : 1} ellipsizeMode="tail">{notification.title}</Text>
                        {isExpanded && (
                          <Text style={styles.notificationMessage}>{notification.message}</Text>
                        )}
                      </View>
                      <View style={styles.notificationHeaderRight}>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(notification.status) }]}>
                          <Text style={styles.statusText}>{getStatusText(notification.status)}</Text>
                        </View>
                        <Ionicons 
                          name={isExpanded ? "chevron-up" : "chevron-down"} 
                          size={16} 
                          color="rgba(255, 255, 255, 0.6)" 
                          style={styles.expandIcon}
                        />
                      </View>
                    </View>

                    {isExpanded && (
                    <View style={styles.gameInfo}>
                      <View style={styles.gameDetail}>
                        <Ionicons name="location" size={14} color="rgba(255, 255, 255, 0.6)" />
                        <Text style={styles.gameDetailText}>{notification.game_title}</Text>
                      </View>
                      <View style={styles.gameDetail}>
                        <Ionicons name="calendar" size={14} color="rgba(255, 255, 255, 0.6)" />
                        <Text style={styles.gameDetailText}>
                          {formatDate(notification.game_date)} at {notification.game_time}
                        </Text>
                      </View>
                      <View style={styles.gameDetail}>
                        <Ionicons name="person" size={14} color="rgba(255, 255, 255, 0.6)" />
                        <Text style={styles.gameDetailText}>Invited by {notification.invited_by_name}</Text>
                      </View>
                    </View>
                    )}

                    {isExpanded && notification.status === 'pending' && (
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          style={styles.declineButton}
                          onPress={() => handleDeclineInvitation(notification.id)}
                          disabled={processingNotification === notification.id}
                        >
                          {processingNotification === notification.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="close" size={14} color="rgba(255, 255, 255, 0.8)" />
                              <Text style={styles.declineButtonText}>Decline</Text>
                            </>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.acceptButton}
                          onPress={() => handleAcceptInvitation(notification.id, notification.game_id)}
                          disabled={processingNotification === notification.id}
                        >
                          {processingNotification === notification.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="checkmark" size={14} color="rgba(255, 255, 255, 0.8)" />
                              <Text style={styles.acceptButtonText}>Accept</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  refreshButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 18,
  },
  notificationsScrollView: {
    maxHeight: 500,
  },
  notificationCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  notificationCardExpanded: {
    padding: 16,
    marginBottom: 12,
    borderColor: 'rgba(76, 175, 80, 0.3)',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  notificationHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expandIcon: {
    marginTop: 2,
  },
  notificationInfo: {
    flex: 1,
    marginRight: 12,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 16,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  gameInfo: {
    marginBottom: 12,
  },
  gameDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  gameDetailText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginLeft: 6,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  declineButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  declineButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  acceptButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default MoreScreen;




