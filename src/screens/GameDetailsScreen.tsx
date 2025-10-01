import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  Dimensions,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { supabase, db } from '../lib/supabase';

const { width, height } = Dimensions.get('window');

interface Game {
  id: string;
  title: string;
  type: string;
  description?: string;
  date: string;
  time: string;
  location: string;
  maxPlayers: number;
  price?: string;
  is_public?: boolean;
}

interface GameMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  status: string;
  user_profiles: {
    full_name: string;
    username: string;
    avatar_url?: string;
  };
}

type GameDetailsScreenRouteProp = RouteProp<RootStackParamList, 'GameDetails'>;
type GameDetailsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'GameDetails'>;

const GameDetailsScreen: React.FC = () => {
  const navigation = useNavigation<GameDetailsScreenNavigationProp>();
  const route = useRoute<GameDetailsScreenRouteProp>();
  const { gameId } = route.params;

  const [game, setGame] = useState<Game | null>(null);
  const [members, setMembers] = useState<GameMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUserInGame, setIsUserInGame] = useState(false);
  const [isUserCreator, setIsUserCreator] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviting, setInviting] = useState(false);
  const [showInviteSuccessModal, setShowInviteSuccessModal] = useState(false);
  const [inviteError, setInviteError] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Array<{id: string, username: string, full_name: string, email: string}>>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (gameId) {
      loadGameDetails();
    }
  }, [gameId]);

  const loadGameDetails = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load game details
      const { data: booking } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', gameId)
        .single();

      if (booking) {
        const gameData: Game = {
          id: booking.id,
          title: booking.pitch_name || 'Football Match',
          type: 'match',
          description: booking.description,
          date: booking.date,
          time: booking.time,
          location: booking.pitch_location || 'Unknown Location',
          maxPlayers: booking.max_players || 8,
          price: booking.price,
          is_public: booking.is_public,
        };
        setGame(gameData);

        // Check if user is the creator
        const isCreator = booking.created_by === user.id;
        setIsUserCreator(isCreator);

        // Check if user is already in the game
        const { data: userInGame } = await db.isUserInGame(gameId, user.id);
        setIsUserInGame(userInGame);

        // Load game members
        const { data: gameMembers } = await db.getGameMembers(gameId);
        if (gameMembers) {
          const transformedMembers = gameMembers.map((member: any) => ({
            ...member,
            user_profiles: Array.isArray(member.user_profiles) 
              ? member.user_profiles[0] || { full_name: 'Unknown' }
              : member.user_profiles
          }));
          setMembers(transformedMembers);
        }
      }
    } catch (error) {
      console.error('Error loading game details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGame = async () => {
    if (!game) return;

    setJoining(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await db.joinGame(game.id, user.id, 'player');
      
      if (error) {
        console.error('Error joining game:', error);
        return;
      }

      setIsUserInGame(true);
      await loadGameDetails();
    } catch (error) {
      console.error('Error joining game:', error);
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveGame = async () => {
    if (!game) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await db.leaveGame(game.id, user.id);
      setIsUserInGame(false);
      await loadGameDetails();
    } catch (error) {
      console.error('Error leaving game:', error);
    }
  };

  const handleInviteUser = () => {
    setInviteError('');
    setInviteUsername('');
    setSearchResults([]);
    setShowInviteModal(true);
  };

  const searchUsers = async (query: string) => {
    setInviteUsername(query);
    setInviteError('');
    
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Search for users
      const { data: users } = await supabase
        .from('user_profiles')
        .select('id, username, full_name, email')
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
        .neq('id', user.id) // Exclude current user
        .limit(5);

      if (users) {
        // Filter out users already in the game
        const filteredUsers = [];
        for (const foundUser of users) {
          const { data: existingMember } = await supabase
            .from('game_members')
            .select('id')
            .eq('game_id', game?.id)
            .eq('user_id', foundUser.id)
            .eq('status', 'joined')
            .single();

          if (!existingMember) {
            filteredUsers.push(foundUser);
          }
        }
        setSearchResults(filteredUsers);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectUser = (selectedUser: {id: string, username: string, full_name: string, email: string}) => {
    setInviteUsername(selectedUser.username || selectedUser.full_name || selectedUser.email);
    setSearchResults([]);
    handleSendInvitation(selectedUser);
  };

  const handleSendInvitation = async (targetUser?: {id: string, username: string, full_name: string, email: string}) => {
    if (!game || !targetUser) {
      setInviteError('Please select a user to invite.');
      return;
    }

    setInviting(true);
    setInviteError('');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setInviteError('You must be logged in to invite players.');
        return;
      }

      // Check if there's already a pending invitation for this user
      const { data: existingInvite } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', targetUser.id)
        .eq('game_id', game.id)
        .eq('type', 'game_invitation')
        .eq('status', 'pending')
        .single();

      if (existingInvite) {
        setInviteError('An invitation is already pending for this player.');
        return;
      }

      // Create notification in database
      const { error: notificationError } = await db.createNotification({
        user_id: targetUser.id,
        type: 'game_invitation',
        title: 'Game Invitation',
        message: `${user.user_metadata?.full_name || user.email || 'Someone'} invited you to join "${game.title}" on ${game.date} at ${game.time}`,
        game_id: game.id,
        invited_by: user.id,
        status: 'pending'
      });

      if (notificationError) {
        console.error('Notification creation error:', notificationError);
        setInviteError('Failed to send invite. Please try again.');
        return;
      }

      // Push notification will be sent automatically via createNotification

      setShowInviteModal(false);
      setInviteUsername('');
      setSearchResults([]);
      setShowInviteSuccessModal(true);
    } catch (error) {
      console.error('Error sending invitation:', error);
      setInviteError('Unexpected error. Please try again.');
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvite = () => {
    setShowInviteModal(false);
    setInviteUsername('');
    setSearchResults([]);
    setInviteError('');
  };

  const handleInviteSuccessClose = () => {
    setShowInviteSuccessModal(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeString: string) => {
    return timeString;
  };

  const getGameTypeColor = (type: string) => {
    switch (type) {
      case 'league': return '#4CAF50';
      case 'tournament': return '#FF9800';
      case 'friendly': return '#2196F3';
      default: return '#4CAF50';
    }
  };

  if (loading) {
    return (
      <ImageBackground source={require('../../assets/hage.jpeg')} style={styles.container}>
        <View style={styles.backgroundOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Loading game details...</Text>
          </View>
        </View>
      </ImageBackground>
    );
  }

  if (!game) {
    return (
      <ImageBackground source={require('../../assets/hage.jpeg')} style={styles.container}>
        <View style={styles.backgroundOverlay}>
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#ff6b6b" />
            <Text style={styles.errorTitle}>Game Not Found</Text>
            <Text style={styles.errorMessage}>The game you're looking for doesn't exist or has been removed.</Text>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    );
  }

  const handleOpenChat = () => {
    if (!game) return;
    navigation.navigate('Chat', {
      booking: {
        id: game.id,
        pitch_name: game.title,
        pitch_location: game.location,
        date: game.date,
        time: game.time,
        price: game.price || '',
        status: 'scheduled',
        max_players: game.maxPlayers,
        current_players: members.length,
      }
    } as any);
  };

  return (
    <ImageBackground source={require('../../assets/hage.jpeg')} style={styles.container}>
      <View style={styles.backgroundOverlay}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Game Details</Text>
            {isUserInGame ? (
              <TouchableOpacity 
                style={styles.chatButton}
                onPress={handleOpenChat}
              >
                <Ionicons name="chatbubbles-outline" size={22} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={styles.headerSpacer} />
            )}
          </View>

          {/* Game Info Card */}
          <View style={styles.gameCard}>
            <View style={styles.gameHeader}>
              <Text style={styles.gameTitle}>{game.title}</Text>
              <View style={[styles.gameTypeBadge, { backgroundColor: getGameTypeColor(game.type) }]}>
                <Text style={styles.gameTypeText}>{game.type.toUpperCase()}</Text>
              </View>
            </View>

            {game.description && (
              <Text style={styles.gameDescription}>{game.description}</Text>
            )}

            <View style={styles.gameDetails}>
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Ionicons name="calendar" size={20} color="rgba(255, 255, 255, 0.7)" />
                </View>
                <Text style={styles.detailText}>{formatDate(game.date)}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Ionicons name="time" size={20} color="rgba(255, 255, 255, 0.7)" />
                </View>
                <Text style={styles.detailText}>{formatTime(game.time)}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Ionicons name="location" size={20} color="rgba(255, 255, 255, 0.7)" />
                </View>
                <Text style={styles.detailText}>{game.location}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Ionicons name="people" size={20} color="rgba(255, 255, 255, 0.7)" />
                </View>
                <Text style={styles.detailText}>
                  {members.length} / {game.maxPlayers} players
                </Text>
              </View>

              {game.price && (
                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Ionicons name="card" size={20} color="rgba(255, 255, 255, 0.7)" />
                  </View>
                  <Text style={styles.detailText}>{game.price}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Players Section */}
          <View style={styles.playersCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="people" size={20} color="rgba(255, 255, 255, 0.8)" />
              <Text style={styles.sectionTitle}>Players ({members.length})</Text>
            </View>

            {members.length > 0 ? (
              <View style={styles.playersList}>
                {members.map((member, index) => (
                  <View key={member.id} style={styles.playerItem}>
                    <View style={styles.playerAvatar}>
                      <Text style={styles.playerInitial}>
                        {member.user_profiles.full_name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.playerInfo}>
                      <Text style={styles.playerName}>{member.user_profiles.full_name}</Text>
                      <Text style={styles.playerRole}>{member.role}</Text>
                    </View>
                    {member.role === 'organizer' && (
                      <View style={styles.organizerBadge}>
                        <Ionicons name="star" size={16} color="#FFD700" />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.noPlayers}>
                <Ionicons name="person-add" size={32} color="rgba(255, 255, 255, 0.3)" />
                <Text style={styles.noPlayersText}>No players yet</Text>
                <Text style={styles.noPlayersSubtext}>Be the first to join this game!</Text>
              </View>
            )}
          </View>

          {/* Action Button */}
          <View style={styles.actionSection}>
            {isUserCreator ? (
              <View style={styles.creatorActions}>
                <TouchableOpacity
                  style={styles.inviteButton}
                  onPress={handleInviteUser}
                >
                  <Ionicons name="person-add-outline" size={20} color="rgba(255, 255, 255, 0.8)" />
                  <Text style={styles.inviteButtonText}>Invite Players</Text>
                </TouchableOpacity>
                <View style={styles.creatorButton}>
                  <Ionicons name="person" size={20} color="#4CAF50" />
                  <Text style={styles.creatorButtonText}>Your Game</Text>
                </View>
              </View>
            ) : isUserInGame ? (
              game?.is_public ? (
                <View style={styles.creatorActions}>
                  <TouchableOpacity
                    style={styles.inviteButton}
                    onPress={handleInviteUser}
                  >
                    <Ionicons name="person-add" size={20} color="#fff" />
                    <Text style={styles.inviteButtonText}>Invite Players</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.leaveButton}
                    onPress={handleLeaveGame}
                    disabled={joining}
                  >
                    <Ionicons name="exit-outline" size={20} color="rgba(255, 255, 255, 0.8)" />
                    <Text style={styles.leaveButtonText}>Leave Game</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.leaveButton}
                  onPress={handleLeaveGame}
                  disabled={joining}
                >
                  <Ionicons name="exit-outline" size={20} color="rgba(255, 255, 255, 0.8)" />
                  <Text style={styles.leaveButtonText}>Leave Game</Text>
                </TouchableOpacity>
              )
            ) : (
              <TouchableOpacity
                style={[
                  styles.joinButton,
                  (members.length >= game.maxPlayers) && styles.joinButtonDisabled
                ]}
                onPress={handleJoinGame}
                disabled={joining || members.length >= game.maxPlayers}
              >
                {joining ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="add" size={20} color="#fff" />
                )}
                <Text style={styles.joinButtonText}>
                  {members.length >= game.maxPlayers ? 'Game Full' : 'Join Game'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Invite User Modal */}
      <Modal
        visible={showInviteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelInvite}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.inviteModal}>
            <View style={styles.inviteModalHeader}>
              <Text style={styles.inviteModalTitle}>Invite Player</Text>
              <TouchableOpacity onPress={handleCancelInvite}>
                <Ionicons name="close" size={24} color="rgba(255, 255, 255, 0.6)" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.inviteModalMessage}>
              Type to search and select a player to invite.
            </Text>
            
            <View style={styles.inviteInputContainer}>
              <TextInput
                style={styles.inviteInput}
                placeholder="Type to search players..."
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={inviteUsername}
                onChangeText={searchUsers}
                autoCapitalize="none"
                autoCorrect={false}
              />
              
              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <View style={styles.searchResultsContainer}>
                  {searchResults.map((user) => (
                    <TouchableOpacity
                      key={user.id}
                      style={styles.searchResultItem}
                      onPress={() => handleSelectUser(user)}
                    >
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>
                          @{user.username || user.full_name || 'Unknown'}
                        </Text>
                      </View>
                      <Ionicons name="add-circle" size={20} color="#4CAF50" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              {searching && (
                <View style={styles.searchingContainer}>
                  <ActivityIndicator size="small" color="#4CAF50" />
                  <Text style={styles.searchingText}>Searching...</Text>
                </View>
              )}
              
              {!!inviteError && (
                <Text style={styles.inviteErrorText}>{inviteError}</Text>
              )}
            </View>
            
            <View style={styles.inviteModalButtons}>
              <TouchableOpacity
                style={styles.inviteCancelButton}
                onPress={handleCancelInvite}
              >
                <Text style={styles.inviteCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Invite Success Modal */}
      <Modal
        visible={showInviteSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleInviteSuccessClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
            </View>
            <Text style={styles.successTitle}>Invitation Sent! 🎉</Text>
            <Text style={styles.successMessage}>
              Your invitation has been sent successfully. The player will receive a notification and can accept or decline the invitation.
            </Text>
            <TouchableOpacity 
              style={styles.successButton}
              onPress={handleInviteSuccessClose}
            >
              <Text style={styles.successButtonText}>Great!</Text>
            </TouchableOpacity>
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
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  chatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  gameTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    marginRight: 12,
  },
  gameTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  gameTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  gameDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 24,
    marginBottom: 20,
  },
  gameDetails: {
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    flex: 1,
  },
  playersCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  playersList: {
    gap: 12,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  playerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playerInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 2,
  },
  playerRole: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'capitalize',
  },
  organizerBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPlayers: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noPlayersText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 12,
    marginBottom: 4,
  },
  noPlayersSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  actionSection: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  joinButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  joinButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  leaveButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  leaveButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '600',
  },
  creatorButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  creatorButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
  },
  // Invite functionality styles
  creatorActions: {
    gap: 12,
  },
  inviteButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  inviteButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  inviteModal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inviteModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  inviteModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  inviteModalMessage: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 20,
    lineHeight: 20,
  },
  inviteInputContainer: {
    marginBottom: 24,
  },
  inviteInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  inviteErrorText: {
    marginTop: 8,
    color: '#ff6b6b',
    fontSize: 13,
  },
  searchResultsContainer: {
    marginTop: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  searchingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  inviteModalButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  inviteCancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  inviteCancelButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '500',
  },
  inviteSendButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  inviteSendButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  inviteSendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Success modal styles
  successModal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    maxWidth: 280,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  successIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    alignSelf: 'center',
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
  },
  successMessage: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  successButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  successButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default GameDetailsScreen;