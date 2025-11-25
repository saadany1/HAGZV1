import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, db } from '../lib/supabase';

const { width, height } = Dimensions.get('window');

interface Game {
  id: string;
  title: string;
  type: 'friendly' | 'league' | 'tournament';
  date: string;
  time: string;
  location: string;
  maxPlayers: number;
  description?: string;
  organizer: string;
}

interface GameMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  user_profiles: {
    full_name: string;
    username?: string;
    avatar_url?: string;
  };
}

interface GameDetailsModalProps {
  visible: boolean;
  game: Game | null;
  onClose: () => void;
  onJoinGame: (gameId: string) => void;
  onLeaveGame: (gameId: string) => void;
}

const GameDetailsModal: React.FC<GameDetailsModalProps> = ({
  visible,
  game,
  onClose,
  onJoinGame,
  onLeaveGame,
}) => {
  const [members, setMembers] = useState<GameMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [isUserInGame, setIsUserInGame] = useState(false);
  const [isUserCreator, setIsUserCreator] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showJoinSuccessModal, setShowJoinSuccessModal] = useState(false);
  const [showLeaveSuccessModal, setShowLeaveSuccessModal] = useState(false);

  useEffect(() => {
    if (visible && game) {
      loadGameDetails();
    }
  }, [visible, game]);

  const loadGameDetails = async () => {
    if (!game) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is already in the game
      const { data: userInGame } = await db.isUserInGame(game.id, user.id);
      setIsUserInGame(userInGame);

      // Check if user is the creator of the game
      const { data: booking } = await supabase
        .from('bookings')
        .select('created_by')
        .eq('id', game.id)
        .single();
      
      setIsUserCreator(booking?.created_by === user.id);

      // Load game members
      const { data: gameMembers } = await db.getGameMembers(game.id);
      if (gameMembers) {
        // Transform the data to match the expected interface
        const transformedMembers = gameMembers.map((member: any) => ({
          ...member,
          user_profiles: Array.isArray(member.user_profiles) 
            ? member.user_profiles[0] || { full_name: 'Unknown' }
            : member.user_profiles
        }));
        setMembers(transformedMembers);
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

      await onJoinGame(game.id);
      setIsUserInGame(true);
      
      // Reload members to show the new member
      await loadGameDetails();
      
      setShowJoinSuccessModal(true);
    } catch (error) {
      console.error('Error joining game:', error);
      Alert.alert('Error', 'Failed to join the game. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveGame = async () => {
    if (!game) return;

    Alert.alert(
      'Leave Game',
      'Are you sure you want to leave this game?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              await onLeaveGame(game.id);
              setIsUserInGame(false);
              
              // Reload members
              await loadGameDetails();
              
              setShowLeaveSuccessModal(true);
            } catch (error) {
              console.error('Error leaving game:', error);
              Alert.alert('Error', 'Failed to leave the game. Please try again.');
            }
          },
        },
      ]
    );
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

  const handleJoinSuccessClose = () => {
    setShowJoinSuccessModal(false);
  };

  const handleLeaveSuccessClose = () => {
    setShowLeaveSuccessModal(false);
  };

  const getGameTypeColor = (type: string) => {
    switch (type) {
      case 'league': return '#4CAF50';
      case 'tournament': return '#FF9800';
      case 'friendly': return '#2196F3';
      default: return '#999999';
    }
  };

  if (!game) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Game Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Game Info */}
            <View style={styles.gameInfoSection}>
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
                  <Ionicons name="calendar" size={20} color="rgba(255, 255, 255, 0.7)" />
                  <Text style={styles.detailText}>{formatDate(game.date)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="time" size={20} color="rgba(255, 255, 255, 0.7)" />
                  <Text style={styles.detailText}>{formatTime(game.time)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="location" size={20} color="rgba(255, 255, 255, 0.7)" />
                  <Text style={styles.detailText}>{game.location}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="people" size={20} color="rgba(255, 255, 255, 0.7)" />
                  <Text style={styles.detailText}>
                    {members.length} / {game.maxPlayers} players
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="person" size={20} color="rgba(255, 255, 255, 0.7)" />
                  <Text style={styles.detailText}>Organized by {game.organizer}</Text>
                </View>
              </View>
            </View>

            {/* Members Section */}
            <View style={styles.membersSection}>
              <Text style={styles.sectionTitle}>Players ({members.length})</Text>
              
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#4CAF50" />
                  <Text style={styles.loadingText}>Loading players...</Text>
                </View>
              ) : (
                <View style={styles.membersList}>
                  {members.map((member) => (
                    <View key={member.id} style={styles.memberItem}>
                      <View style={styles.memberAvatar}>
                        <Text style={styles.avatarText}>
                          {member.user_profiles.full_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>
                          {member.user_profiles.full_name}
                        </Text>
                        <Text style={styles.memberRole}>
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </Text>
                      </View>
                      <View style={styles.memberStatus}>
                        <View style={styles.joinedDot} />
                        <Text style={styles.joinedText}>Joined</Text>
                      </View>
                    </View>
                  ))}
                  
                  {members.length === 0 && (
                    <View style={styles.noMembers}>
                      <Text style={styles.noMembersText}>No players yet</Text>
                      <Text style={styles.noMembersSubtext}>Be the first to join!</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {isUserInGame ? (
              <TouchableOpacity
                style={styles.leaveButton}
                onPress={handleLeaveGame}
                disabled={joining}
              >
                <Ionicons name="exit" size={20} color="#fff" />
                <Text style={styles.leaveButtonText}>Leave Game</Text>
              </TouchableOpacity>
            ) : isUserCreator ? (
              <View style={styles.creatorButton}>
                <Ionicons name="person" size={20} color="#4CAF50" />
                <Text style={styles.creatorButtonText}>Your Game</Text>
              </View>
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
        </View>
      </View>

      {/* Join Game Success Modal */}
      <Modal
        visible={showJoinSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleJoinSuccessClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark" size={32} color="rgba(255, 255, 255, 0.9)" />
            </View>
            <Text style={styles.successTitle}>Game Joined</Text>
            <Text style={styles.successMessage}>
              You have successfully joined the game.
            </Text>
            <TouchableOpacity 
              style={styles.successButton}
              onPress={handleJoinSuccessClose}
            >
              <Text style={styles.successButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Leave Game Success Modal */}
      <Modal
        visible={showLeaveSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleLeaveSuccessClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark" size={32} color="rgba(255, 255, 255, 0.9)" />
            </View>
            <Text style={styles.successTitle}>Game Left</Text>
            <Text style={styles.successMessage}>
              You have successfully left the game.
            </Text>
            <TouchableOpacity 
              style={styles.successButton}
              onPress={handleLeaveSuccessClose}
            >
              <Text style={styles.successButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    paddingHorizontal: 20,
  },
  gameInfoSection: {
    paddingVertical: 20,
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  gameTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    flex: 1,
  },
  gameTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  gameTypeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
  },
  gameDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 20,
    lineHeight: 22,
  },
  gameDetails: {
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 12,
    fontWeight: '500',
  },
  membersSection: {
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 12,
  },
  membersList: {
    gap: 12,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  memberStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  joinedText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  noMembers: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noMembersText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  noMembersSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  actionButtons: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
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
    fontWeight: '700',
  },
  leaveButton: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  leaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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
    fontWeight: '700',
  },
  // Success Modal Styles
  successModal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    width: '100%',
    maxWidth: 280,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  successIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
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
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  successButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  successButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
});

export default GameDetailsModal;

