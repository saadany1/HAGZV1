import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  Alert,
  TextInput,
  Switch,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { supabase } from '../lib/supabase';

type TeamSettingsNavigationProp = StackNavigationProp<RootStackParamList, 'TeamSettings'>;

interface Team {
  id: string;
  name: string;
  description?: string;
  is_public: boolean;
  division: number;
  member_count: number;
  captain_id: string;
  created_at: string;
}

interface TeamMember {
  id: string;
  user_id: string;
  team_id: string;
  role: string;
  joined_at: string;
  user_profiles: {
    id: string;
    username: string;
    full_name: string;
    email: string;
  }[];
}

const TeamSettingsScreen: React.FC = () => {
  const navigation = useNavigation<TeamSettingsNavigationProp>();
  const route = useRoute();
  const { teamId } = route.params as { teamId: string };
  
  const [team, setTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCaptainModal, setShowCaptainModal] = useState(false);
  
  // Form states
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [newCaptainId, setNewCaptainId] = useState<string>('');

  useEffect(() => {
    loadTeamData();
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const loadTeamData = async () => {
    try {
      // Load team data
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      if (teamError) {
        console.error('Error loading team:', teamError);
        Alert.alert('Error', 'Failed to load team data');
        return;
      }

      setTeam(teamData);
      setTeamName(teamData.name);
      setTeamDescription(teamData.description || '');
      setIsPublic(teamData.is_public);

      // Load team members
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId);

      if (membersError) {
        console.error('Error loading team members:', membersError);
        Alert.alert('Error', 'Failed to load team members');
        return;
      }

      // Load user profiles for each team member
      if (membersData && membersData.length > 0) {
        const userIds = membersData.map(member => member.user_id);
        
        const { data: profilesData, error: profilesError } = await supabase
          .from('user_profiles')
          .select('id, username, full_name, email')
          .in('id', userIds);

        if (profilesError) {
          console.error('Error loading user profiles:', profilesError);
          Alert.alert('Error', 'Failed to load user profiles');
          return;
        }

        // Combine team members with their profiles
        const membersWithProfiles = membersData.map(member => ({
          ...member,
          user_profiles: profilesData?.filter(profile => profile.id === member.user_id) || []
        }));

        setTeamMembers(membersWithProfiles);
      } else {
        setTeamMembers([]);
      }
    } catch (error) {
      console.error('Error loading team:', error);
      Alert.alert('Error', 'Failed to load team data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!team) return;

    try {
      console.log('Saving team changes:', {
        teamId,
        teamName,
        teamDescription,
        isPublic
      });

      const { error } = await supabase
        .from('teams')
        .update({
          name: teamName,
          description: teamDescription,
          is_public: isPublic,
        })
        .eq('id', teamId);

      if (error) {
        console.error('Error updating team:', error);
        Alert.alert('Error', `Failed to update team settings: ${error.message}`);
        return;
      }

      console.log('Team updated successfully');
      Alert.alert('Success', 'Team settings updated successfully!');
      setIsEditing(false);
      loadTeamData(); // Refresh data
    } catch (error) {
      console.error('Error updating team:', error);
      Alert.alert('Error', 'Failed to update team settings');
    }
  };

  const handleAssignCaptain = async () => {
    if (!team || !newCaptainId) return;

    try {
      // Update the team's captain_id
      const { error: teamError } = await supabase
        .from('teams')
        .update({ captain_id: newCaptainId })
        .eq('id', teamId);

      if (teamError) {
        console.error('Error updating team captain:', teamError);
        Alert.alert('Error', 'Failed to assign new captain');
        return;
      }

      // Update the old captain's role to 'player'
      const { error: oldCaptainError } = await supabase
        .from('team_members')
        .update({ role: 'player' })
        .eq('team_id', teamId)
        .eq('user_id', team.captain_id);

      if (oldCaptainError) {
        console.error('Error updating old captain role:', oldCaptainError);
      }

      // Update the new captain's role to 'captain'
      const { error: newCaptainError } = await supabase
        .from('team_members')
        .update({ role: 'captain' })
        .eq('team_id', teamId)
        .eq('user_id', newCaptainId);

      if (newCaptainError) {
        console.error('Error updating new captain role:', newCaptainError);
        Alert.alert('Error', 'Failed to assign new captain');
        return;
      }

      Alert.alert('Success', 'Captain assigned successfully!', [
        {
          text: 'OK',
          onPress: () => {
            setShowCaptainModal(false);
            loadTeamData(); // Refresh data
          },
        },
      ]);
    } catch (error) {
      console.error('Error assigning captain:', error);
      Alert.alert('Error', 'Failed to assign new captain');
    }
  };

  const handleDeleteTeam = async () => {
    if (!team) return;

    try {
      // First, remove all team members
      const { error: membersError } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId);

      if (membersError) {
        console.error('Error removing team members:', membersError);
      }

      // Then delete the team
      const { error: teamError } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (teamError) {
        console.error('Error deleting team:', teamError);
        Alert.alert('Error', 'Failed to delete team');
        return;
      }

      Alert.alert('Success', 'Team deleted successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Error deleting team:', error);
      Alert.alert('Error', 'Failed to delete team');
    }
  };

  const isCaptain = team && currentUserId && team.captain_id === currentUserId;
  
  // Debug logging
  console.log('Team Settings Debug:', {
    team: team?.name,
    captainId: team?.captain_id,
    currentUserId,
    isCaptain
  });

  if (isLoading) {
    return (
      <ImageBackground source={require('../../assets/hage.jpeg')} style={styles.container}>
        <View style={styles.backgroundOverlay}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </View>
      </ImageBackground>
    );
  }

  if (!team) {
    return (
      <ImageBackground source={require('../../assets/hage.jpeg')} style={styles.container}>
        <View style={styles.backgroundOverlay}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Team not found</Text>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={require('../../assets/hage.jpeg')} style={styles.container}>
      <View style={styles.backgroundOverlay}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Team Settings</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Team Info Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Team Information</Text>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
                  if (isEditing) {
                    handleSaveChanges();
                  } else {
                    setIsEditing(true);
                  }
                }}
              >
                <Ionicons 
                  name={isEditing ? "checkmark" : "pencil"} 
                  size={20} 
                  color={isEditing ? "#4CAF50" : "#fff"} 
                />
                <Text style={[styles.editButtonText, isEditing && styles.editButtonTextActive]}>
                  {isEditing ? 'Save' : 'Edit'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.teamCard}>
              <View style={styles.teamAvatar}>
                <Text style={styles.teamInitial}>
                  {team.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.teamInfo}>
                <Text style={styles.teamName}>{team.name}</Text>
                <View style={styles.teamMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="trophy" size={14} color="rgba(255, 255, 255, 0.6)" />
                    <Text style={styles.metaText}>Division {team.division}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="people" size={14} color="rgba(255, 255, 255, 0.6)" />
                    <Text style={styles.metaText}>{team.member_count} members</Text>
                  </View>
                </View>
                <View style={styles.teamTypeBadge}>
                  <Ionicons 
                    name={team.is_public ? "globe" : "lock-closed"} 
                    size={12} 
                    color="rgba(255, 255, 255, 0.6)" 
                  />
                  <Text style={styles.teamType}>
                    {team.is_public ? 'Public Team' : 'Private Team'}
                  </Text>
                </View>
              </View>
            </View>

            {isEditing && (
              <View style={styles.editForm}>
                <View style={styles.formHeader}>
                  <Ionicons name="create-outline" size={20} color="rgba(255, 255, 255, 0.7)" />
                  <Text style={styles.formTitle}>Edit Team Details</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Team Name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={teamName}
                    onChangeText={setTeamName}
                    placeholder="Enter team name"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Description</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={teamDescription}
                    onChangeText={setTeamDescription}
                    placeholder="Enter team description"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.switchGroup}>
                  <View style={styles.switchLabel}>
                    <Text style={styles.switchLabelText}>Public Team</Text>
                    <Text style={styles.switchDescription}>
                      Allow other players to find and join your team
                    </Text>
                  </View>
                  <View style={styles.switchContainer}>
                    <Switch
                      value={isPublic}
                      onValueChange={setIsPublic}
                      trackColor={{ false: 'rgba(255, 255, 255, 0.1)', true: 'rgba(255, 255, 255, 0.3)' }}
                      thumbColor={isPublic ? '#fff' : 'rgba(255, 255, 255, 0.7)'}
                    />
                    <Text style={styles.switchStatus}>
                      {isPublic ? 'Public' : 'Private'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Team Members Section */}
          {teamMembers.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleContainer}>
                  <Ionicons name="people" size={20} color="rgba(255, 255, 255, 0.7)" />
                  <Text style={styles.sectionTitle}>Team Members</Text>
                </View>
                <TouchableOpacity
                  style={styles.assignCaptainButton}
                  onPress={() => setShowCaptainModal(true)}
                >
                  <Ionicons name="star" size={16} color="rgba(255, 255, 255, 0.7)" />
                  <Text style={styles.assignCaptainText}>Assign Captain</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.membersList}>
                {teamMembers.map((member) => {
                  const profile = member.user_profiles?.[0];
                  return (
                    <View key={member.id} style={[
                      styles.memberCard,
                      member.role === 'captain' && styles.captainCard
                    ]}>
                      <View style={[
                        styles.memberAvatar,
                        member.role === 'captain' && styles.captainAvatar
                      ]}>
                        <Text style={[
                          styles.memberInitial,
                          member.role === 'captain' && styles.captainInitial
                        ]}>
                          {profile?.username?.charAt(0).toUpperCase() || 'P'}
                        </Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>
                          {profile?.full_name || 'Player'}
                        </Text>
                        <Text style={styles.memberUsername}>
                          @{profile?.username || 'player'}
                        </Text>
                      </View>
                      <View style={[
                        styles.memberRole,
                        member.role === 'captain' && styles.captainRole
                      ]}>
                        <Ionicons 
                          name={member.role === 'captain' ? "star" : "person"} 
                          size={16} 
                          color={member.role === 'captain' ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.6)"} 
                        />
                        <Text style={[
                          styles.memberRoleText,
                          { color: member.role === 'captain' ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.6)" }
                        ]}>
                          {member.role === 'captain' ? 'Captain' : 'Player'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}


          {/* Danger Zone */}
          {isCaptain && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Danger Zone</Text>
              <View style={styles.dangerCard}>
                <View style={styles.dangerInfo}>
                  <Text style={styles.dangerTitle}>Delete Team</Text>
                  <Text style={styles.dangerDescription}>
                    Permanently delete this team and remove all members. This action cannot be undone.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => setShowDeleteModal(true)}
                >
                  <Ionicons name="trash" size={20} color="#fff" />
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Captain Assignment Modal */}
        <Modal
          visible={showCaptainModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCaptainModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Ionicons name="people" size={32} color="#4CAF50" />
                <Text style={styles.modalTitle}>Assign New Captain</Text>
              </View>
              <Text style={styles.modalMessage}>
                Select a team member to become the new captain. You will become a regular player.
              </Text>
              
              <ScrollView style={styles.memberSelectionList} showsVerticalScrollIndicator={false}>
                {teamMembers
                  .filter(member => member.user_id !== team?.captain_id)
                  .map((member) => {
                    const profile = member.user_profiles?.[0];
                    return (
                      <TouchableOpacity
                        key={member.id}
                        style={[
                          styles.memberSelectionItem,
                          newCaptainId === member.user_id && styles.memberSelectionItemSelected
                        ]}
                        onPress={() => setNewCaptainId(member.user_id)}
                      >
                        <View style={styles.memberSelectionAvatar}>
                          <Text style={styles.memberSelectionInitial}>
                            {profile?.username?.charAt(0).toUpperCase() || 'P'}
                          </Text>
                        </View>
                        <View style={styles.memberSelectionInfo}>
                          <Text style={styles.memberSelectionName}>
                            {profile?.full_name || 'Player'}
                          </Text>
                          <Text style={styles.memberSelectionUsername}>
                            @{profile?.username || 'player'}
                          </Text>
                        </View>
                        {newCaptainId === member.user_id && (
                          <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowCaptainModal(false);
                    setNewCaptainId('');
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalConfirmButton,
                    !newCaptainId && styles.modalConfirmButtonDisabled
                  ]}
                  onPress={handleAssignCaptain}
                  disabled={!newCaptainId}
                >
                  <Text style={styles.modalConfirmText}>Assign Captain</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          visible={showDeleteModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeleteModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Ionicons name="warning" size={32} color="#FF6B6B" />
                <Text style={styles.modalTitle}>Delete Team</Text>
              </View>
              <Text style={styles.modalMessage}>
                Are you sure you want to delete "{team.name}"? This action cannot be undone and will remove all team members.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowDeleteModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalDeleteButton}
                  onPress={handleDeleteTeam}
                >
                  <Text style={styles.modalDeleteText}>Delete Team</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 4,
  },
  editButtonTextActive: {
    color: '#4CAF50',
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  teamAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  teamInitial: {
    fontSize: 24,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.95)',
    marginBottom: 4,
  },
  teamDetails: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 2,
  },
  teamType: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '400',
  },
  teamMeta: {
    flexDirection: 'row',
    marginVertical: 6,
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    marginLeft: 6,
    fontWeight: '400',
  },
  teamTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  editForm: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 20,
    marginTop: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  switchGroup: {
    marginBottom: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  switchStatus: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  switchLabel: {
    flex: 1,
    marginRight: 16,
  },
  switchLabelText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  dangerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  dangerInfo: {
    flex: 1,
    marginRight: 16,
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginBottom: 4,
  },
  dangerDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 16,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalDeleteButton: {
    flex: 1,
    backgroundColor: '#FF6B6B',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalDeleteText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Captain Assignment Styles
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assignCaptainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  assignCaptainText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  membersList: {
    marginTop: 10,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  captainCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  captainAvatar: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  memberInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  captainInitial: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  memberUsername: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  memberRole: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  captainRole: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  memberRoleText: {
    fontSize: 12,
    fontWeight: '400',
    marginLeft: 4,
  },
  // Modal Member Selection Styles
  memberSelectionList: {
    maxHeight: 200,
    marginVertical: 16,
  },
  memberSelectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  memberSelectionItemSelected: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderColor: '#4CAF50',
  },
  memberSelectionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberSelectionInitial: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  memberSelectionInfo: {
    flex: 1,
  },
  memberSelectionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  memberSelectionUsername: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalConfirmButtonDisabled: {
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    marginBottom: 20,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
});

export default TeamSettingsScreen;
