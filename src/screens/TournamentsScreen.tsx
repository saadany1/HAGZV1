import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ImageBackground,
  Modal,
  Alert,
  RefreshControl,
  Animated,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import HourglassLoader from '../components/HourglassLoader';
import TournamentBracket from '../components/TournamentBracket';

const { width } = Dimensions.get('window');

interface Tournament {
  id: string;
  name: string;
  description: string;
  entry_fee: number;
  max_teams: number;
  current_teams: number;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  tournament_type: 'single_elimination' | 'double_elimination' | 'round_robin';
  registration_start: string;
  registration_end: string;
  tournament_start: string | null;
  tournament_end: string | null;
  is_featured: boolean;
  is_public: boolean;
  min_team_size: number;
  max_team_size: number;
  winner_team_id: string | null;
  runner_up_team_id: string | null;
  prize_pool: number;
  prize_distribution: any;
  rules: any;
  restrictions: any;
  // Joined data
  winner_team?: {
    name: string;
    logo_url?: string;
  };
  runner_up_team?: {
    name: string;
    logo_url?: string;
  };
}

interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const TournamentsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'ongoing' | 'previous'>('upcoming');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userTeam, setUserTeam] = useState<any>(null);
  const [isTeamCaptain, setIsTeamCaptain] = useState(false);
  const [tournamentMatches, setTournamentMatches] = useState<any[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [showBracketModal, setShowBracketModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [registeredTeams, setRegisteredTeams] = useState<any[]>([]);
  const [isTeamRegistered, setIsTeamRegistered] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  useEffect(() => {
    loadTournaments();
    loadUserTeam();
    
    // Animate content on load
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);


  const loadUserTeam = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Get user's team and check if they're a captain
        const { data: teamMembership } = await supabase
          .from('team_members')
          .select(`
            *,
            teams(*)
          `)
          .eq('user_id', user.id)
          .eq('role', 'captain')
          .single();
        
        if (teamMembership) {
          setUserTeam(teamMembership.teams);
          setIsTeamCaptain(true);
        } else {
          // Check if user is in any team (not captain)
          const { data: regularMembership } = await supabase
            .from('team_members')
            .select(`
              *,
              teams(*)
            `)
            .eq('user_id', user.id)
            .single();
          
          if (regularMembership) {
            setUserTeam(regularMembership.teams);
            setIsTeamCaptain(false);
          }
        }
      }
    } catch (error) {
      console.error('Error loading user team:', error);
    }
  };

  const loadTournaments = async () => {
    try {
      setIsLoading(true);
      
      // Load all tournaments
      const { data: allTournaments } = await supabase
        .from('tournaments')
        .select(`
          *,
          winner_team:teams!tournaments_winner_team_id_fkey(name, logo_url),
          runner_up_team:teams!tournaments_runner_up_team_id_fkey(name, logo_url)
        `)
        .eq('is_public', true)
        .order('tournament_start', { ascending: true });

      setTournaments(allTournaments || []);
    } catch (error) {
      console.error('Error loading tournaments:', error);
      Alert.alert('Error', 'Failed to load tournaments');
    } finally {
      setIsLoading(false);
    }
  };


  const loadTournamentMatches = async (tournamentId: string) => {
    try {
      const { data: matches } = await supabase
        .from('tournament_matches')
        .select(`
          *,
          team1:teams!tournament_matches_team1_id_fkey(id, name, logo_url),
          team2:teams!tournament_matches_team2_id_fkey(id, name, logo_url),
          winner_team:teams!tournament_matches_winner_team_id_fkey(id, name, logo_url)
        `)
        .eq('tournament_id', tournamentId)
        .order('round_number', { ascending: true })
        .order('match_number', { ascending: true });

      setTournamentMatches(matches || []);
    } catch (error) {
      console.error('Error loading tournament matches:', error);
    }
  };

  const loadRegisteredTeams = async (tournamentId: string) => {
    try {
      const { data: teams } = await supabase
        .from('tournament_participants')
        .select(`
          *,
          teams(id, name, logo_url)
        `)
        .eq('tournament_id', tournamentId)
        .order('registered_at', { ascending: true });

      setRegisteredTeams(teams || []);

      // Check if user's team is already registered
      if (userTeam) {
        const isRegistered = teams?.some(participant => participant.team_id === userTeam.id);
        setIsTeamRegistered(isRegistered || false);
      }
    } catch (error) {
      console.error('Error loading registered teams:', error);
    }
  };

  const handleViewBracket = (tournament: Tournament) => {
    setSelectedTournament(tournament);
    loadTournamentMatches(tournament.id);
    setShowBracketModal(true);
  };

  const handleTournamentPress = (tournament: Tournament) => {
    setSelectedTournament(tournament);
    loadRegisteredTeams(tournament.id);
    setShowDetailModal(true);
  };

  const handleRegister = async (tournamentId: string) => {
    if (!userTeam) {
      Alert.alert('Error', 'You must be in a team to register for tournaments');
      return;
    }

    if (!isTeamCaptain) {
      Alert.alert('Error', 'Only team captains can register for tournaments');
      return;
    }

    try {
      console.log('Registering team:', userTeam.id, 'for tournament:', tournamentId);
      
      const { error } = await supabase.rpc('register_team_for_tournament', {
        p_tournament_id: tournamentId,
        p_team_id: userTeam.id
      });

      if (error) {
        console.error('Registration error:', error);
        Alert.alert('Registration Failed', error.message);
      } else {
        Alert.alert('Success', 'Team registered successfully!');
        loadTournaments(); // Refresh data
        loadUserTeam(); // Refresh team data
        // Refresh registered teams for the current tournament
        if (selectedTournament) {
          loadRegisteredTeams(selectedTournament.id);
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Error', 'Failed to register for tournament');
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadTournaments();
    setIsRefreshing(false);
  };

  const getFilteredTournaments = () => {
    switch (activeTab) {
      case 'upcoming':
        return tournaments.filter(t => t.status === 'upcoming');
      case 'ongoing':
        return tournaments.filter(t => t.status === 'ongoing');
      case 'previous':
        return tournaments.filter(t => t.status === 'completed');
      default:
        return [];
    }
  };

  const renderTabButton = (tab: 'upcoming' | 'ongoing' | 'previous', label: string) => (
    <TouchableOpacity
      style={[styles.tabChip, activeTab === tab && styles.tabChipActive]}
      onPress={() => setActiveTab(tab)}
    >
      <Ionicons
        name={tab === 'upcoming' ? 'time' : tab === 'ongoing' ? 'play' : 'trophy'}
        size={14}
        color={activeTab === tab ? '#fff' : 'rgba(255, 255, 255, 0.75)'}
      />
      <Text style={[styles.tabChipText, activeTab === tab && styles.tabChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );


  const renderTournamentCard = (tournament: Tournament) => {
    const getStatusColor = () => {
      return 'rgba(255, 255, 255, 0.6)';
    };

    const getStatusIcon = () => {
      switch (tournament.status) {
        case 'upcoming': return 'time-outline';
        case 'ongoing': return 'play-circle-outline';
        case 'completed': return 'checkmark-circle-outline';
        default: return 'help-circle-outline';
      }
    };

    return (
      <TouchableOpacity 
        key={tournament.id} 
        style={styles.tournamentCard}
        onPress={() => handleTournamentPress(tournament)}
      >
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.03)']}
          style={styles.tournamentCardGradient}
        >
          <View style={styles.tournamentHeader}>
            <View style={styles.tournamentTitleContainer}>
              <Text style={styles.tournamentName}>{tournament.name}</Text>
              <Text style={styles.tournamentDescription} numberOfLines={2}>
                {tournament.description}
              </Text>
            </View>
            <View style={[styles.tournamentBadge, { backgroundColor: 'rgba(255, 255, 255, 0.12)', borderColor: 'rgba(76, 175, 80, 0.25)', borderWidth: 1 }] }>
              <Ionicons name={getStatusIcon() as any} size={12} color="rgba(255,255,255,0.9)" />
              <Text style={[styles.tournamentBadgeText, { color: 'rgba(255,255,255,0.95)' }]}>{tournament.status.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.tournamentStats}>
            <View style={styles.tournamentStatItem}>
              <View style={styles.tournamentStatIcon}>
                <Ionicons name="cash-outline" size={16} color="rgba(255, 255, 255, 0.7)" />
              </View>
              <Text style={styles.tournamentStatText}>${tournament.entry_fee}</Text>
            </View>
            <View style={styles.tournamentStatItem}>
              <View style={styles.tournamentStatIcon}>
                <Ionicons name="people-outline" size={16} color="rgba(255, 255, 255, 0.7)" />
              </View>
              <Text style={styles.tournamentStatText}>
                {tournament.current_teams}/{tournament.max_teams}
              </Text>
            </View>
            <View style={styles.tournamentStatItem}>
              <View style={styles.tournamentStatIcon}>
                <Ionicons name="trophy-outline" size={16} color="rgba(255, 255, 255, 0.7)" />
              </View>
              <Text style={styles.tournamentStatText}>${tournament.prize_pool}</Text>
            </View>
          </View>

          {tournament.status === 'completed' && tournament.winner_team && (
            <View style={styles.winnerSection}>
              <View style={styles.winnerIcon}>
                <Ionicons name="medal-outline" size={16} color="rgba(255, 255, 255, 0.8)" />
              </View>
              <View style={styles.winnerInfo}>
                <Text style={styles.winnerLabel}>Champion</Text>
                <Text style={styles.winnerName}>{tournament.winner_team.name}</Text>
              </View>
            </View>
          )}

          <View style={styles.tournamentActions}>
            {tournament.status === 'ongoing' && (
              <TouchableOpacity 
                style={styles.viewBracketButton}
                onPress={() => handleViewBracket(tournament)}
              >
                <View style={styles.viewBracketButtonGradient}>
                  <Ionicons name="list-outline" size={16} color="#fff" />
                  <Text style={styles.viewBracketButtonText}>View Bracket</Text>
                </View>
              </TouchableOpacity>
            )}

            {tournament.status === 'completed' && (
              <TouchableOpacity 
                style={styles.viewResultsButton}
                onPress={() => handleViewBracket(tournament)}
              >
                <View style={styles.viewResultsButtonGradient}>
                  <Ionicons name="trophy-outline" size={16} color="#fff" />
                  <Text style={styles.viewResultsButtonText}>View Results</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <HourglassLoader size={40} />
        <Text style={styles.loadingText}>Loading tournaments...</Text>
      </View>
    );
  }

  return (
    <ImageBackground
      source={require('../../assets/hage.jpeg')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>HAGS Tournaments</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {renderTabButton('upcoming', 'Upcoming')}
          {renderTabButton('ongoing', 'Ongoing')}
          {renderTabButton('previous', 'Previous')}
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.scrollContent}
        >
          {/* Tournament List */}
          <View style={styles.tournamentsSection}>
            <Text style={styles.sectionTitle}>
              {activeTab === 'upcoming' && 'Upcoming Tournaments'}
              {activeTab === 'ongoing' && 'Ongoing Tournaments'}
              {activeTab === 'previous' && 'Previous Tournaments'}
            </Text>
            
            {getFilteredTournaments().length > 0 ? (
              <View style={styles.tournamentsGrid}>
                {getFilteredTournaments().map(tournament => renderTournamentCard(tournament))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="trophy-outline" size={60} color="rgba(255, 255, 255, 0.3)" />
                <Text style={styles.emptyTitle}>No Tournaments Found</Text>
                <Text style={styles.emptyDescription}>
                  {activeTab === 'upcoming' && 'Check back later for upcoming tournaments!'}
                  {activeTab === 'ongoing' && 'No tournaments are currently running.'}
                  {activeTab === 'previous' && 'No completed tournaments yet.'}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Tournament Detail Modal */}
        <Modal
          visible={showDetailModal}
          animationType="slide"
          presentationStyle="fullScreen"
          statusBarTranslucent
        >
          <View style={styles.detailModal}>
            <View style={styles.detailHeader}>
              <TouchableOpacity
                style={styles.closeDetailButton}
                onPress={() => setShowDetailModal(false)}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.detailTitle} numberOfLines={1}>
                {selectedTournament?.name}
              </Text>
              <View style={styles.headerSpacer} />
            </View>
            
            {selectedTournament && (
              <ScrollView style={styles.detailContent} showsVerticalScrollIndicator={false}>
                <View style={styles.detailCard}>
                  <Text style={styles.detailDescription}>{selectedTournament.description}</Text>
                  
                  <View style={styles.detailStats}>
                    <View style={styles.detailStatRow}>
                      <View style={styles.detailStatItem}>
                        <Ionicons name="cash-outline" size={20} color="rgba(255, 255, 255, 0.8)" />
                        <Text style={styles.detailStatLabel}>Entry Fee</Text>
                        <Text style={styles.detailStatValue}>${selectedTournament.entry_fee}</Text>
                      </View>
                      <View style={styles.detailStatItem}>
                        <Ionicons name="trophy-outline" size={20} color="rgba(255, 255, 255, 0.8)" />
                        <Text style={styles.detailStatLabel}>Prize Pool</Text>
                        <Text style={styles.detailStatValue}>${selectedTournament.prize_pool}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.detailStatRow}>
                      <View style={styles.detailStatItem}>
                        <Ionicons name="people-outline" size={20} color="rgba(255, 255, 255, 0.8)" />
                        <Text style={styles.detailStatLabel}>Teams</Text>
                        <Text style={styles.detailStatValue}>{selectedTournament.current_teams}/{selectedTournament.max_teams}</Text>
                      </View>
                      <View style={styles.detailStatItem}>
                        <Ionicons name="calendar-outline" size={20} color="rgba(255, 255, 255, 0.8)" />
                        <Text style={styles.detailStatLabel}>Type</Text>
                        <Text style={styles.detailStatValue}>{selectedTournament.tournament_type.replace('_', ' ')}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.detailDates}>
                    <View style={styles.detailDateItem}>
                      <Text style={styles.detailDateLabel}>Registration Ends</Text>
                      <Text style={styles.detailDateValue}>
                        {new Date(selectedTournament.registration_end).toLocaleDateString()}
                      </Text>
                    </View>
                    {selectedTournament.tournament_start && (
                      <View style={styles.detailDateItem}>
                        <Text style={styles.detailDateLabel}>Tournament Starts</Text>
                        <Text style={styles.detailDateValue}>
                          {new Date(selectedTournament.tournament_start).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Registered Teams Section */}
                  <View style={styles.registeredTeamsSection}>
                    <Text style={styles.registeredTeamsTitle}>Registered Teams ({registeredTeams.length})</Text>
                    {registeredTeams.length > 0 ? (
                      <View style={styles.registeredTeamsList}>
                        {registeredTeams.map((participant, index) => (
                          <View key={participant.id} style={styles.registeredTeamItem}>
                            <View style={styles.teamRank}>
                              <Text style={styles.teamRankText}>#{index + 1}</Text>
                            </View>
                            <View style={styles.teamLogoContainer}>
                              {participant.teams.logo_url ? (
                                <Image 
                                  source={{ uri: participant.teams.logo_url }} 
                                  style={styles.teamLogo}
                                  resizeMode="contain"
                                />
                              ) : (
                                <View style={styles.teamLogoPlaceholder}>
                                  <Ionicons name="people" size={20} color="rgba(255, 255, 255, 0.6)" />
                                </View>
                              )}
                            </View>
                            <View style={styles.teamInfo}>
                              <Text style={styles.teamName}>{participant.teams.name}</Text>
                              <Text style={styles.teamRegisteredDate}>
                                Registered {new Date(participant.registered_at).toLocaleDateString()}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.noTeamsContainer}>
                        <Ionicons name="people-outline" size={40} color="rgba(255, 255, 255, 0.3)" />
                        <Text style={styles.noTeamsText}>No teams registered yet</Text>
                      </View>
                    )}
                  </View>

                  {selectedTournament.status === 'upcoming' && isTeamCaptain && !isTeamRegistered && (
                    <TouchableOpacity
                      style={styles.detailRegisterButton}
                      onPress={() => {
                        setShowDetailModal(false);
                        handleRegister(selectedTournament.id);
                      }}
                    >
                      <View style={styles.detailRegisterButtonGradient}>
                        <Ionicons name="add-circle-outline" size={20} color="#fff" />
                        <Text style={styles.detailRegisterButtonText}>Register Team</Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {selectedTournament.status === 'upcoming' && isTeamCaptain && isTeamRegistered && (
                    <View style={styles.detailAlreadyRegistered}>
                      <Ionicons name="checkmark-circle" size={20} color="rgba(76, 175, 80, 0.8)" />
                      <Text style={styles.detailAlreadyRegisteredText}>Team Already Registered</Text>
                    </View>
                  )}

                  {selectedTournament.status === 'upcoming' && !isTeamCaptain && userTeam && (
                    <View style={styles.detailCannotRegister}>
                      <Ionicons name="lock-closed-outline" size={20} color="rgba(255, 255, 255, 0.5)" />
                      <Text style={styles.detailCannotRegisterText}>Only captains can register</Text>
                    </View>
                  )}

                  {selectedTournament.status === 'upcoming' && !userTeam && (
                    <View style={styles.detailCannotRegister}>
                      <Ionicons name="people-outline" size={20} color="rgba(255, 255, 255, 0.5)" />
                      <Text style={styles.detailCannotRegisterText}>Join a team to register</Text>
                    </View>
                  )}

                  {selectedTournament.status === 'ongoing' && (
                    <TouchableOpacity
                      style={styles.detailViewBracketButton}
                      onPress={() => {
                        setShowDetailModal(false);
                        handleViewBracket(selectedTournament);
                      }}
                    >
                      <View style={styles.detailViewBracketButtonGradient}>
                        <Ionicons name="list-outline" size={20} color="#fff" />
                        <Text style={styles.detailViewBracketButtonText}>View Bracket</Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {selectedTournament.status === 'completed' && (
                    <TouchableOpacity
                      style={styles.detailViewResultsButton}
                      onPress={() => {
                        setShowDetailModal(false);
                        handleViewBracket(selectedTournament);
                      }}
                    >
                      <View style={styles.detailViewResultsButtonGradient}>
                        <Ionicons name="trophy-outline" size={20} color="#fff" />
                        <Text style={styles.detailViewResultsButtonText}>View Results</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </Modal>

        {/* Bracket Modal */}
        <Modal
          visible={showBracketModal}
          animationType="slide"
          presentationStyle="fullScreen"
          statusBarTranslucent
        >
          <View style={styles.bracketModal}>
            <View style={styles.bracketHeader}>
              <TouchableOpacity
                style={styles.closeBracketButton}
                onPress={() => setShowBracketModal(false)}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.bracketTitle} numberOfLines={1}>
                {selectedTournament?.name} - Bracket
              </Text>
              <View style={styles.headerSpacer} />
            </View>
            
            {selectedTournament && (
              <TournamentBracket
                tournamentId={selectedTournament.id}
                matches={tournamentMatches}
              />
            )}
          </View>
        </Modal>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)'
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'transparent',
    gap: 8,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)'
  },
  tabChipActive: {
    backgroundColor: 'rgba(76, 175, 80, 0.18)',
    borderColor: 'rgba(76, 175, 80, 0.35)'
  },
  tabChipText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tabChipTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  featuredSection: {
    marginBottom: 40,
  },
  featuredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  featuredBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)'
  },
  featuredBadgeText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: 'bold',
  },
  featuredCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  featuredCardContent: {
    padding: 20,
  },
  featuredTitleContainer: {
    marginBottom: 20,
  },
  featuredTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  featuredDescription: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 22,
  },
  featuredStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  featuredStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  featuredStatIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  featuredStatContent: {
    alignItems: 'center',
  },
  featuredStatValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  featuredStatLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    fontWeight: '500',
  },
  countdownSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  countdownLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  countdownGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countdownItem: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 60,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  countdownNumber: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  countdownUnit: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  countdownSeparator: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 20,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  registerButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  registerButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tournamentsSection: {
    marginBottom: 40,
  },
  tournamentsGrid: {
    gap: 20,
  },
  tournamentCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 4,
  },
  tournamentCardGradient: {
    padding: 16,
  },
  tournamentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  tournamentTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  tournamentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
  },
  tournamentDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 18,
  },
  tournamentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  tournamentBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tournamentStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  tournamentStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  tournamentStatIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.2)'
  },
  tournamentStatText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  winnerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  winnerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.2)'
  },
  winnerInfo: {
    flex: 1,
  },
  winnerLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  winnerName: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tournamentActions: {
    marginTop: 4,
  },
  joinButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  joinButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  viewBracketButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  viewBracketButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  viewBracketButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  viewResultsButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  viewResultsButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  viewResultsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  cannotRegisterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  cannotRegisterText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 12,
  },
  emptyDescription: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  bracketModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.98)',
  },
  bracketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
  },
  closeBracketButton: {
    padding: 8,
    marginRight: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  bracketTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  detailModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  closeDetailButton: {
    padding: 8,
    marginRight: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  detailTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  detailContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  detailCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailDescription: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  detailStats: {
    marginBottom: 24,
  },
  detailStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailStatItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailStatLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  detailStatValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  detailDates: {
    marginBottom: 24,
  },
  detailDateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailDateLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  detailDateValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  detailRegisterButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  detailRegisterButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  detailRegisterButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  detailCannotRegister: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    marginTop: 8,
  },
  detailCannotRegisterText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
    fontWeight: '500',
  },
  detailAlreadyRegistered: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
    borderRadius: 12,
    marginTop: 8,
  },
  detailAlreadyRegisteredText: {
    color: 'rgba(76, 175, 80, 0.9)',
    fontSize: 16,
    fontWeight: '600',
  },
  detailViewBracketButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  detailViewBracketButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  detailViewBracketButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  detailViewResultsButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  detailViewResultsButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  detailViewResultsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  registeredTeamsSection: {
    marginBottom: 24,
  },
  registeredTeamsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  registeredTeamsList: {
    gap: 12,
  },
  registeredTeamItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  teamRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.2)'
  },
  teamRankText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: 'bold',
  },
  teamLogoContainer: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  teamLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  teamLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.2)'
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  teamRegisteredDate: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  noTeamsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noTeamsText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    marginTop: 12,
  },
});

export default TournamentsScreen;
