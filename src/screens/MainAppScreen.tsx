import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ImageBackground,
  Modal,
  Image,
  ActivityIndicator,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { TabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { auth, db, supabase } from '../lib/supabase';
import { useAppData } from '../context/AppDataContext';
import VideoPlayer from '../components/VideoPlayer';
import GlareHover from './GlareHover';
import HourglassLoader from '../components/HourglassLoader';
import MatchLoop from '../components/MatchLoop';

const { width, height } = Dimensions.get('window');

type MainAppNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Home'>,
  StackNavigationProp<RootStackParamList>
>;

interface UserProfile {
  username: string;
  xp: number;
  level: number;
  division: number;
  avatar_url?: string;
  stats: {
    matches_played: number;
    wins: number;
    draws: number;
    losses: number;
    mvps: number;
    goals?: number;
    assists?: number;
  };
}

interface UpcomingGame {
  id: string;
  opponent: string;
  date: string;
  time: string;
  location: string;
  type: 'friendly' | 'league' | 'tournament';
}

interface UpcomingBooking {
  id: string;
  pitch_name: string;
  pitch_location: string;
  date: string;
  time: string;
  price: string;
  status: string;
  max_players: number;
  current_players: number;
}

interface Match {
  id: string;
  match_type?: 'friendly' | 'ranked';
  match_date: string;
  time_slot: string;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  team1?: {
    id: string;
    name: string;
    logo_url?: string;
  };
  team2?: {
    id: string;
    name: string;
    logo_url?: string;
  };
  team1_score?: number;
  team2_score?: number;
  division?: number;
  pitch_id?: string;
  pitch_name?: string;
  pitch_location?: string;
  winner_id?: string;
  match_duration?: number;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  updated_at?: string;
}


interface Tournament {
  id: string;
  name: string;
  startDate: string;
  prize: string;
  participants: number;
  maxParticipants: number;
}

const MainAppScreen: React.FC = React.memo(() => {
  const navigation = useNavigation<MainAppNavigationProp>();
  
  // Use global app data instead of local state
  const { 
    userProfile, 
    teamName, 
    teamDivision,
    isDataReady,
    refreshUserData 
  } = useAppData();
  
  const [teamStats, setTeamStats] = useState<{wins: number, draws: number, losses: number}>({wins: 0, draws: 0, losses: 0});
  const [showMenu, setShowMenu] = useState(false);
  const [showDivisionRulesModal, setShowDivisionRulesModal] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [upcomingBookings, setUpcomingBookings] = useState<UpcomingBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // Mock data - in real app, this would come from your backend
  const upcomingGames: UpcomingGame[] = [
    {
      id: '1',
      opponent: 'FC Thunder',
      date: 'Tomorrow',
      time: '7:00 PM',
      location: 'Central Stadium',
      type: 'league',
    },
    {
      id: '2',
      opponent: 'City United',
      date: 'Saturday',
      time: '3:00 PM',
      location: 'Sports Complex',
      type: 'friendly',
    },
  ];


  const tournaments: Tournament[] = useMemo(() => [
    {
      id: '1',
      name: 'Summer Championship',
      startDate: 'Next Week',
      prize: '$5,000',
      participants: 24,
      maxParticipants: 32,
    },
    {
      id: '2',
      name: 'City Cup',
      startDate: 'In 2 weeks',
      prize: '$2,500',
      participants: 16,
      maxParticipants: 16,
    },
  ], []);

  useEffect(() => {
    // Only load additional data that's not in global context
    loadTeamStats();
    loadUpcomingBookings();
    loadUpcomingMatches();
  }, []);

  // Minimal focus effect - global data is already loaded
  useFocusEffect(
    React.useCallback(() => {
      // Only refresh additional data on focus
      loadTeamStats();
      loadUpcomingBookings();
      loadUpcomingMatches();
    }, [])
  );

  // Load team stats (not in global context yet)
  const loadTeamStats = async () => {
    try {
      const currentUser = await auth.getCurrentUser();
      if (currentUser) {
        const { data: teamData, error: teamError } = await supabase
          .from('team_members')
          .select(`
            teams (
              wins,
              draws,
              losses
            )
          `)
          .eq('user_id', currentUser.id)
          .eq('status', 'active')
          .single();
        
        if (!teamError && teamData?.teams) {
          const team = teamData.teams as any;
          setTeamStats({
            wins: team.wins || 0,
            draws: team.draws || 0,
            losses: team.losses || 0
          });
        } else {
          setTeamStats({wins: 0, draws: 0, losses: 0});
        }
      }
    } catch (error) {
      console.error('Error loading team stats:', error);
      setTeamStats({wins: 0, draws: 0, losses: 0});
    }
  };


  const loadUpcomingBookings = async () => {
    try {
      setLoadingBookings(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user found');
        return;
      }

      // Try the RPC function first (if it exists)
      const { data: bookings, error: rpcError } = await supabase
        .rpc('get_user_upcoming_bookings', {
          user_id_param: user.id
        });

      if (!rpcError && bookings) {
        // RPC function worked
        const futureBookings = bookings.map((booking: any) => ({
          id: booking.id,
          pitch_name: booking.pitch_name,
          pitch_location: booking.pitch_location,
          date: booking.date,
          time: booking.time,
          price: booking.price,
          status: booking.status,
          max_players: booking.max_players || 8,
          current_players: booking.member_count || 0,
        }));
        setUpcomingBookings(futureBookings);
        return;
      }

      console.log('RPC function not available, trying direct query...');

      // Fallback: Direct query approach
      // Step 1: Get user's game_ids from game_members table
      const { data: userGameMemberships, error: membershipError } = await supabase
        .from('game_members')
        .select('game_id')
        .eq('user_id', user.id)
        .eq('status', 'joined');

      if (membershipError) {
        console.error('Error fetching user game memberships:', membershipError);
        // If this fails due to RLS, show empty state
        setUpcomingBookings([]);
        return;
      }

      if (!userGameMemberships || userGameMemberships.length === 0) {
        setUpcomingBookings([]);
        return;
      }

      // Step 2: Get booking details for these games
      const gameIds = userGameMemberships.map((membership: any) => membership.game_id);
      const { data: bookingsData, error: bookingsDataError } = await supabase
        .from('bookings')
        .select('id, pitch_name, pitch_location, date, time, price, status, max_players, created_at')
        .in('id', gameIds)
        .gte('date', new Date().toISOString().split('T')[0]) // Only future dates
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (bookingsDataError) {
        console.error('Error fetching bookings:', bookingsDataError);
        setUpcomingBookings([]);
        return;
      }

      if (!bookingsData || bookingsData.length === 0) {
        setUpcomingBookings([]);
        return;
      }

      // Step 3: Get member counts for each booking (optimized with Promise.all)
      const memberCountPromises = bookingsData.map(booking => 
        supabase
          .from('game_members')
          .select('*', { count: 'exact', head: true })
          .eq('game_id', booking.id)
          .eq('status', 'joined')
      );

      const memberCounts = await Promise.all(memberCountPromises);
      
      const futureBookings = bookingsData.map((booking, index) => ({
        id: booking.id,
        pitch_name: booking.pitch_name,
        pitch_location: booking.pitch_location,
        date: booking.date,
        time: booking.time,
        price: booking.price,
        status: booking.status,
        max_players: booking.max_players || 12,
        current_players: memberCounts[index]?.count || 0,
      }));

      setUpcomingBookings(futureBookings);
    } catch (error) {
      console.error('Error loading upcoming bookings:', error);
      setUpcomingBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  };

  const loadUpcomingMatches = async () => {
    try {
      setLoadingMatches(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's team
      const { data: teamMembership } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .single();

      if (!teamMembership) {
        console.log('User is not in a team');
        setUpcomingMatches([]);
        return;
      }

      // Get upcoming matches for the user's team
      const { data: matches, error } = await supabase
        .from('matches')
        .select(`
          *,
          team1:teams!ranked_matches_team1_id_fkey(id, name, logo_url),
          team2:teams!ranked_matches_team2_id_fkey(id, name, logo_url)
        `)
        .or(`team1_id.eq.${teamMembership.team_id},team2_id.eq.${teamMembership.team_id}`)
        .eq('status', 'scheduled')
        .gte('match_date', new Date().toISOString().split('T')[0])
        .order('match_date', { ascending: true })
        .order('time_slot', { ascending: true })
        .limit(3);

      if (error) {
        console.error('Error loading matches:', error);
        setUpcomingMatches([]);
        return;
      }

      console.log('Loaded matches:', matches);
      setUpcomingMatches(matches || []);
    } catch (error) {
      console.error('Error loading matches:', error);
      setUpcomingMatches([]);
    } finally {
      setLoadingMatches(false);
    }
  };



  // Division rules based on division.md
  const getDivisionRules = (division: number) => {
    const rules = {
      5: {
        matches: 5,
        promotionZone: 7,
        relegationZone: null, // No relegation from Division 5
        titleZone: 12,
        maxPoints: 15 // 5 matches * 3 points per win
      },
      4: {
        matches: 5,
        promotionZone: 9,
        relegationZone: 4,
        titleZone: 13,
        maxPoints: 15
      },
      3: {
        matches: 5,
        promotionZone: 10,
        relegationZone: 5,
        titleZone: 13,
        maxPoints: 15
      },
      2: {
        matches: 5,
        promotionZone: 11,
        relegationZone: 6,
        titleZone: 15,
        maxPoints: 15
      },
      1: {
        matches: 5,
        promotionZone: null, // No promotion from Division 1
        relegationZone: 5,
        titleZone: 15,
        maxPoints: 15
      }
    };
    return rules[division as keyof typeof rules] || rules[5];
  };

  // Calculate division status and progress
  const getDivisionStatus = (division: number, wins: number = 0, draws: number = 0, losses: number = 0) => {
    const rules = getDivisionRules(division);
    const totalPoints = (wins * 3) + (draws * 1) + (losses * 0);
    const matchesPlayed = wins + draws + losses;
    
    let status = 'Stay Zone';
    let message = '';
    let progress = 0;

    // Check for title zone
    if (totalPoints >= rules.titleZone) {
      status = 'Title Zone';
      message = `🏆 Division ${division} Champions!`;
      progress = 100;
    }
    // Check for promotion zone
    else if (rules.promotionZone && totalPoints >= rules.promotionZone) {
      status = 'Promotion Zone';
      message = `⬆️ Promoted to Division ${division - 1}!`;
      progress = 0; // Reset progress bar when promoted
    }
    // Check for relegation zone
    else if (rules.relegationZone && totalPoints <= rules.relegationZone) {
      status = 'Relegation Zone';
      message = `⬇️ Relegated to Division ${division + 1}`;
      progress = 0;
    }
    // Stay zone
    else {
      status = 'Stay Zone';
      const pointsNeededForPromotion = rules.promotionZone ? rules.promotionZone - totalPoints : 0;
      const pointsNeededForRelegation = rules.relegationZone ? totalPoints - rules.relegationZone : 0;
      
      if (rules.promotionZone) {
        message = `${pointsNeededForPromotion} pts to promotion`;
        progress = Math.min(90, (totalPoints / rules.promotionZone) * 90);
      } else {
        message = `${pointsNeededForRelegation} pts above relegation`;
        progress = Math.max(10, (totalPoints / rules.maxPoints) * 90);
      }
    }

    return {
      status,
      message,
      progress,
      totalPoints,
      matchesPlayed,
      maxMatches: rules.matches,
      rules
    };
  };

  const renderHotSection = () => (
    <View style={styles.hotSection}>
      <VideoPlayer
        videoSource={require('../../assets/homevideo.mp4')}
        thumbnailSource={require('../../assets/hage.jpeg')}
        title="Early Stage of Football Industry"
        date="June, 29"
        style={styles.hotCard}
      />
    </View>
  );

  const renderTournamentsAndHighlights = () => (
    <View style={styles.section}>
      <View style={styles.exploreContainer}>
        {/* Tournaments Container */}
        <GlareHover
          glareColor="#ffffff"
          glareOpacity={0.5}
          glareAngle={-30}
          glareSize={300}
          transitionDuration={600}
          playOnce={false}
          onPress={() => navigation.navigate('Tournaments')}
        >
          <View style={styles.exploreCard}>
            <View style={styles.exploreCardContent}>
              <View style={styles.tournamentLogo}>
                <View style={styles.tournamentLogoInner}>
                  <Text style={styles.tournamentLogoText}>HAGZ</Text>
                  <Text style={styles.tournamentLogoSubtext}>TOURNAMENTS</Text>
                </View>
              </View>
            </View>
          </View>
        </GlareHover>

        {/* Highlights Container */}
        <GlareHover
          glareColor="#ffffff"
          glareOpacity={0.5}
          glareAngle={-30}
          glareSize={300}
          transitionDuration={600}
          playOnce={false}
          onPress={() => navigation.navigate('Highlights')}
        >
          <View style={styles.exploreCard}>
            <View style={styles.exploreCardContent}>
              <View style={styles.highlightsLogo}>
                <View style={styles.highlightsLogoInner}>
                  <Ionicons name="play-circle" size={32} color="#fff" />
                  <Text style={styles.highlightsLogoText}>HIGHLIGHTS</Text>
                </View>
              </View>
            </View>
          </View>
        </GlareHover>
      </View>
    </View>
  );

  const handleMatchPress = (item: any) => {
    // If this is a friendly booking (from bookings table), open Game Details
    if (item?.type === 'booking' || (item?.date && item?.time)) {
      navigation.navigate('GameDetails', { gameId: item.id });
      return;
    }
    // Otherwise default to ranked match details
    navigation.navigate('MatchDetail', { match: item });
  };

  const renderUpcomingMatches = () => {
    const allMatches = [
      ...upcomingMatches.map(match => ({ ...match, type: 'match' as const })),
      ...upcomingBookings.map(booking => ({ ...booking, type: 'booking' as const }))
    ].sort((a, b) => {
      const aTime = a.type === 'match' ? new Date(`${a.match_date} ${a.time_slot}`).getTime() : new Date(`${a.date} ${a.time}`).getTime();
      const bTime = b.type === 'match' ? new Date(`${b.match_date} ${b.time_slot}`).getTime() : new Date(`${b.date} ${b.time}`).getTime();
      return aTime - bTime;
    });

    return (
      <View style={styles.section}>
        <View style={styles.matchContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>UPCOMING MATCHES</Text>
          </View>
          
          {(loadingBookings || loadingMatches) ? (
            <HourglassLoader 
              size={30}
              color="#4CAF50"
              text="Loading matches..."
              containerStyle={styles.loadingContainer}
            />
          ) : allMatches.length > 0 ? (
            <MatchLoop
              matches={allMatches.map((item) => ({
                id: item.id,
                type: item.type,
                title: item.type === 'match' 
                  ? `${item.team1?.name || 'TBD'} vs ${item.team2?.name || 'TBD'}`
                  : item.pitch_name || 'Friendly Match',
                subtitle: item.type === 'match'
                  ? `Division ${item.division || 'N/A'}`
                  : item.pitch_location || 'Location TBD',
                time: item.type === 'match' 
                  ? (item.time_slot ? `${item.time_slot}:00` : 'TBD')
                  : item.time || 'TBD',
                date: item.type === 'match'
                  ? new Date(item.match_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })
                  : new Date(item.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    }),
                badge: item.type === 'match' ? 'RANKED' : 'FRIENDLY',
                badgeColor: item.type === 'match' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(33, 150, 243, 0.2)',
                onPress: () => handleMatchPress(item),
              }))}
              speed={40}
              direction="left"
              gap={20}
              pauseOnHover={false}
              scaleOnHover={false}
              fadeOut={false}
              containerHeight={160}
            />
          ) : (
            <View style={styles.noMatchesContainer}>
              <Text style={styles.noMatchesText}>No upcoming matches</Text>
              <TouchableOpacity 
                style={styles.findMatchButton}
                onPress={() => navigation.navigate('Play')}
              >
                <Text style={styles.findMatchButtonText}>Find a Match</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderUserProfile = () => (
    <View style={styles.profileSection}>
      <View style={styles.profileHeader}>
        <View style={styles.profileInfo}>
          <Text style={styles.username}>{userProfile?.username || 'Player'}</Text>
          <View style={styles.levelContainer}>
            <Text style={styles.levelText}>Level {userProfile?.level || 1}</Text>
          </View>
        </View>

      </View>
      
      <View style={styles.xpContainer}>
        <View style={styles.xpBar}>
          <View style={[styles.xpFill, { width: `${(userProfile?.xp || 0) % 100}%` }]} />
        </View>
        <Text style={styles.xpText}>{userProfile?.xp || 0} XP</Text>
      </View>
    </View>
  );

  const renderUpcomingGames = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Upcoming Games</Text>
      </View>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gamesContainer}>
        {upcomingGames.map((game) => (
          <TouchableOpacity key={game.id} style={styles.gameCard}>
            <View style={styles.gameHeader}>
              <View style={[
                styles.gameTypeBadge,
                { backgroundColor: game.type === 'league' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.1)' }
              ]}>
                <Text style={styles.gameTypeText}>{game.type.toUpperCase()}</Text>
              </View>
            </View>
            
            <Text style={styles.gameOpponent}>vs {game.opponent}</Text>
            <Text style={styles.gameDate}>{game.date}</Text>
            <Text style={styles.gameTime}>{game.time}</Text>
            <Text style={styles.gameLocation}>{game.location}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderUserStats = () => (
    <View style={styles.section}>
      <View style={styles.statsContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Stats</Text>
          <TouchableOpacity onPress={refreshUserData} style={styles.refreshButton}>
            <Ionicons name="refresh" size={16} color="rgba(255, 255, 255, 0.6)" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{userProfile?.stats.matches_played || 0}</Text>
            <Text style={styles.statLabel}>Matches</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{userProfile?.stats.wins || 0}</Text>
            <Text style={styles.statLabel}>Wins</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{userProfile?.stats.draws || 0}</Text>
            <Text style={styles.statLabel}>Draws</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{userProfile?.stats.losses || 0}</Text>
            <Text style={styles.statLabel}>Losses</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{userProfile?.stats.mvps || 0}</Text>
            <Text style={styles.statLabel}>MVPs</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{userProfile?.stats.goals || 0}</Text>
            <Text style={styles.statLabel}>Goals</Text>
          </View>
        </View>
        
        {/* Win Rate Display */}
        <View style={styles.winRateContainer}>
          <Text style={styles.winRateLabel}>Win Rate</Text>
          <View style={styles.winRateBar}>
            <View 
              style={[
                styles.winRateFill, 
                { 
                  width: `${userProfile?.stats.matches_played && userProfile?.stats.matches_played > 0 
                    ? (userProfile.stats.wins / userProfile.stats.matches_played) * 100 
                    : 0}%` 
                }
              ]} 
            />
          </View>
          <Text style={styles.winRateText}>
            {userProfile?.stats.matches_played && userProfile?.stats.matches_played > 0 
              ? `${Math.round((userProfile.stats.wins / userProfile.stats.matches_played) * 100)}%`
              : '0%'}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderDivisionProgression = () => {
    const currentDivision = teamDivision;
    const divisionStatus = getDivisionStatus(currentDivision, teamStats.wins, teamStats.draws, teamStats.losses);
    
    // Determine the display division number based on status
    let displayDivision = currentDivision;
    if (divisionStatus.status === 'Promotion Zone') {
      displayDivision = currentDivision - 1; // Show the division they're promoted to
    } else if (divisionStatus.status === 'Relegation Zone') {
      displayDivision = currentDivision + 1; // Show the division they're relegated to
    }
    
    return (
      <View style={styles.section}>
        <GlareHover
          glareColor="#ffffff"
          glareOpacity={0.3}
          glareAngle={-30}
          glareSize={300}
          transitionDuration={800}
          playOnce={false}
        >
          <View style={styles.divisionContainer}>
            <View style={styles.divisionHeader}>
              <View style={styles.divisionTitleSection}>
                <View style={styles.divisionBadge}>
                  <Text style={styles.divisionNumber}>{displayDivision}</Text>
                </View>
                <View style={styles.divisionInfo}>
                  <Text style={styles.divisionLabel}>Division</Text>
                  <Text style={styles.divisionSubtitle}>
                    {divisionStatus.status}
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.infoButton}
                onPress={() => setShowDivisionRulesModal(true)}
              >
                <Ionicons name="information-circle-outline" size={18} color="rgba(255, 255, 255, 0.5)" />
              </TouchableOpacity>
            </View>

            {/* Division Progress Bar */}
            <View style={styles.divisionProgressContainer}>
              <View style={styles.divisionProgressBar}>
                <View style={styles.divisionProgressTrack}>
                  <View 
                    style={[
                      styles.divisionProgressFill,
                      { 
                        width: `${divisionStatus.progress}%`,
                      }
                    ]} 
                  />
                </View>
                <View style={styles.divisionMarkers}>
                  {[5, 4, 3, 2, 1].map((div) => (
                    <View 
                      key={div} 
                      style={[
                        styles.divisionMarker,
                        { 
                          backgroundColor: div <= currentDivision 
                            ? 'rgba(255, 255, 255, 0.8)' 
                            : 'rgba(255, 255, 255, 0.15)' 
                        }
                      ]}
                    />
                  ))}
                </View>
              </View>
              <Text style={styles.divisionProgressText}>
                {divisionStatus.totalPoints} / {divisionStatus.rules?.maxPoints || 15} pts
              </Text>
            </View>

            {/* Division Status Message */}
            <Text style={styles.divisionMessage}>
              {divisionStatus.message}
            </Text>
          </View>
        </GlareHover>
      </View>
    );
  };


  const renderTournaments = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Upcoming Tournaments</Text>
      </View>
      
      {tournaments.map((tournament) => (
        <TouchableOpacity key={tournament.id} style={styles.tournamentCard}>
          <View style={styles.tournamentHeader}>
            <Text style={styles.tournamentName}>{tournament.name}</Text>
            <View style={styles.tournamentPrize}>
              <Text style={styles.prizeText}>{tournament.prize}</Text>
            </View>
          </View>
          
          <View style={styles.tournamentDetails}>
            <View style={styles.tournamentInfo}>
              <Text style={styles.tournamentDate}>{tournament.startDate}</Text>
            </View>
            
            <View style={styles.tournamentParticipants}>
              <Text style={styles.participantsText}>
                {tournament.participants}/{tournament.maxParticipants} players
              </Text>
            </View>
          </View>
          
          <View style={styles.tournamentProgress}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${(tournament.participants / tournament.maxParticipants) * 100}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {Math.round((tournament.participants / tournament.maxParticipants) * 100)}% full
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Loading is now handled by the splash screen in AppNavigator

  return (
    <ImageBackground source={require('../../assets/hage.jpeg')} style={styles.container}>
      <View style={styles.backgroundOverlay}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <LinearGradient
              colors={['rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.3)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerContainer}
            >
              <View style={styles.headerLeft}>
                <View style={styles.headerAvatar}>
                  {userProfile?.avatar_url && userProfile.avatar_url.trim() !== '' ? (
                    <Image 
                      source={{ uri: userProfile.avatar_url }} 
                      style={styles.headerAvatarImage}
                      onError={() => {
                        console.log('Header avatar load error');
                        // Remove failed image from cache
                        setImageErrors(prev => new Set(prev).add(userProfile.avatar_url || ''));
                      }}
                      // Optimize image loading
                      resizeMode="cover"
                      loadingIndicatorSource={require('../../assets/icon.png')}
                    />
                  ) : (
                    <View style={styles.headerAvatarPlaceholder}>
                      <Ionicons name="person" size={20} color="rgba(255, 255, 255, 0.7)" />
                    </View>
                  )}
                </View>
                <View style={styles.headerCenter}>
                  <Text style={styles.headerUsername} numberOfLines={1} ellipsizeMode="tail">{userProfile?.username || 'Player'}</Text>
                  <Text style={styles.headerTeam} numberOfLines={1} ellipsizeMode="tail">{teamName ? teamName : 'No team yet'}</Text>
                </View>
              </View>
              <View style={styles.headerXp}>
                <Text style={styles.headerXpLabel}>{(userProfile?.xp || 0)} XP</Text>
                <View style={styles.headerXpBar}>
                  <View style={[styles.headerXpFill, { width: `${(userProfile?.xp || 0) % 100}%` }]} />
                </View>
              </View>
            </LinearGradient>
          </View>
          {renderHotSection()}
          {renderTournamentsAndHighlights()}
          {renderDivisionProgression()}
          {renderUpcomingMatches()}
          {renderUserStats()}
        </ScrollView>
        
        {/* Navigation Menu Modal */}
        <Modal
          visible={showMenu}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowMenu(false)}
        >
          <TouchableOpacity 
            style={styles.menuModalOverlay}
            activeOpacity={1}
            onPress={() => setShowMenu(false)}
          >
            <View style={styles.menuContainer}>
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  // Navigate to Home
                }}
              >
                <Ionicons name="home" size={24} color="#fff" />
                <Text style={styles.menuText}>Home</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  // Navigate to Play
                }}
              >
                <Ionicons name="football" size={24} color="#fff" />
                <Text style={styles.menuText}>Play</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  // Navigate to My Team
                }}
              >
                <Ionicons name="people" size={24} color="#fff" />
                <Text style={styles.menuText}>My Team</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  // Navigate to Leaderboards
                }}
              >
                <Ionicons name="trophy" size={24} color="#fff" />
                <Text style={styles.menuText}>Leaderboards</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  // Navigate to More
                }}
              >
                <Ionicons name="menu" size={24} color="#fff" />
                <Text style={styles.menuText}>More</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Division Rules Modal */}
        <Modal
          visible={showDivisionRulesModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowDivisionRulesModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Division Rules</Text>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setShowDivisionRulesModal(false)}
                >
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={styles.rulesSectionTitle}>Points System</Text>
                <View style={styles.rulesCard}>
                  <Text style={styles.ruleText}>• Win = 3 points</Text>
                  <Text style={styles.ruleText}>• Draw = 1 point</Text>
                  <Text style={styles.ruleText}>• Loss = 0 points</Text>
                </View>

                <Text style={styles.rulesSectionTitle}>Division Structure</Text>
                <Text style={styles.rulesDescription}>
                  Each team plays 5 matches per run in their division. Each division has different zones:
                </Text>

                <View style={styles.divisionRulesContainer}>
                  {/* Division 5 */}
                  <View style={styles.divisionRuleCard}>
                    <Text style={styles.divisionTitle}>Division 5</Text>
                    <Text style={styles.modalDivisionSubtitle}>Starting Division</Text>
                    <View style={styles.ruleItem}>
                      <Text style={styles.ruleLabel}>Promotion Zone:</Text>
                      <Text style={styles.ruleValue}>7 pts → Division 4</Text>
                    </View>
                    <View style={styles.ruleItem}>
                      <Text style={styles.ruleLabel}>Title Zone:</Text>
                      <Text style={styles.ruleValue}>12 pts</Text>
                    </View>
                    <View style={styles.ruleItem}>
                      <Text style={styles.ruleLabel}>Relegation:</Text>
                      <Text style={styles.ruleValue}>None (lowest division)</Text>
                    </View>
                  </View>

                  {/* Division 4 */}
                  <View style={styles.divisionRuleCard}>
                    <Text style={styles.divisionTitle}>Division 4</Text>
                    <View style={styles.ruleItem}>
                      <Text style={styles.ruleLabel}>Promotion Zone:</Text>
                      <Text style={styles.ruleValue}>9 pts → Division 3</Text>
                    </View>
                    <View style={styles.ruleItem}>
                      <Text style={styles.ruleLabel}>Title Zone:</Text>
                      <Text style={styles.ruleValue}>13 pts</Text>
                    </View>
                    <View style={styles.ruleItem}>
                      <Text style={styles.ruleLabel}>Relegation Zone:</Text>
                      <Text style={styles.ruleValue}>≤ 4 pts → Division 5</Text>
                    </View>
                  </View>

                  {/* Division 3 */}
                  <View style={styles.divisionRuleCard}>
                    <Text style={styles.divisionTitle}>Division 3</Text>
                    <View style={styles.ruleItem}>
                      <Text style={styles.ruleLabel}>Promotion Zone:</Text>
                      <Text style={styles.ruleValue}>10 pts → Division 2</Text>
                    </View>
                    <View style={styles.ruleItem}>
                      <Text style={styles.ruleLabel}>Title Zone:</Text>
                      <Text style={styles.ruleValue}>13 pts</Text>
                    </View>
                    <View style={styles.ruleItem}>
                      <Text style={styles.ruleLabel}>Relegation Zone:</Text>
                      <Text style={styles.ruleValue}>≤ 5 pts → Division 4</Text>
                    </View>
                  </View>

                  {/* Division 2 */}
                  <View style={styles.divisionRuleCard}>
                    <Text style={styles.divisionTitle}>Division 2</Text>
                    <View style={styles.ruleItem}>
                      <Text style={styles.ruleLabel}>Promotion Zone:</Text>
                      <Text style={styles.ruleValue}>11 pts → Division 1</Text>
                    </View>
                    <View style={styles.ruleItem}>
                      <Text style={styles.ruleLabel}>Title Zone:</Text>
                      <Text style={styles.ruleValue}>15 pts</Text>
                    </View>
                    <View style={styles.ruleItem}>
                      <Text style={styles.ruleLabel}>Relegation Zone:</Text>
                      <Text style={styles.ruleValue}>≤ 6 pts → Division 3</Text>
                    </View>
                  </View>

                  {/* Division 1 */}
                  <View style={styles.divisionRuleCard}>
                    <Text style={styles.divisionTitle}>Division 1</Text>
                    <Text style={styles.modalDivisionSubtitle}>Elite Division</Text>
                    <View style={styles.ruleItem}>
                      <Text style={styles.ruleLabel}>Promotion Zone:</Text>
                      <Text style={styles.ruleValue}>None (top division)</Text>
                    </View>
                    <View style={styles.ruleItem}>
                      <Text style={styles.ruleLabel}>Title Zone:</Text>
                      <Text style={styles.ruleValue}>15 pts</Text>
                    </View>
                    <View style={styles.ruleItem}>
                      <Text style={styles.ruleLabel}>Relegation Zone:</Text>
                      <Text style={styles.ruleValue}>≤ 5 pts → Division 2</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.rulesSectionTitle}>Difficulty Scaling</Text>
                <View style={styles.rulesCard}>
                  <Text style={styles.ruleText}>• Division 5: Forgiving, no relegation</Text>
                  <Text style={styles.ruleText}>• Division 4: First risk of relegation, promotion requires more wins</Text>
                  <Text style={styles.ruleText}>• Division 3: Higher consistency needed, balanced promotion/relegation</Text>
                  <Text style={styles.ruleText}>• Division 2: Strict requirements to reach Division 1, harsh relegation</Text>
                  <Text style={styles.ruleText}>• Division 1: Ultimate challenge, only survival and title matter</Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </ImageBackground>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  backgroundOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 16,
    backgroundColor: 'transparent',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 88,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerAvatarImage: {
    width: '100%',
    height: '100%',
  },
  headerAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  headerUsername: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  headerTeam: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  headerXp: {
    minWidth: 80,
    alignItems: 'flex-end',
  },
  headerXpBar: {
    width: 80,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    marginTop: 4,
  },
  headerXpFill: {
    height: '100%',
    backgroundColor: '#ffffff',
  },
  headerXpLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
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
  // Profile Section
  profileSection: {
    marginBottom: 30,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileInfo: {
    flex: 1,
  },
  username: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  levelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    fontWeight: '500',
  },
  signOutButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  xpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  xpBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 3,
  },
  xpText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
    minWidth: 60,
  },
  // Section Styles
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  // Games Section
  gamesContainer: {
    marginHorizontal: -10,
  },
  gameCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 10,
    minWidth: 160,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  gameHeader: {
    marginBottom: 12,
  },
  gameTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  gameTypeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  gameOpponent: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  gameDate: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 2,
  },
  gameTime: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 2,
  },
  gameLocation: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  // Stats Section
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    minWidth: (width - 80) / 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  // Division Section - Simplified
  divisionContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  divisionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  divisionTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  divisionBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  divisionNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  divisionInfo: {
    flex: 1,
  },
  divisionLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    marginBottom: 2,
  },
  divisionSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  divisionProgressContainer: {
    marginBottom: 12,
  },
  divisionProgressBar: {
    position: 'relative',
    marginBottom: 8,
  },
  divisionProgressTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  divisionProgressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  divisionMarkers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  divisionMarker: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  divisionProgressText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontWeight: '500',
  },
  divisionMessage: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  // Explore Section - Tournaments and Highlights
  exploreContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  exploreCard: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 16,
    padding: 26,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 182,
  },
  exploreCardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tournamentLogo: {
    alignItems: 'center',
  },
  tournamentLogoInner: {
    alignItems: 'center',
  },
  tournamentLogoText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4CAF50',
    marginBottom: 4,
  },
  tournamentLogoSubtext: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 1,
  },
  highlightsLogo: {
    alignItems: 'center',
  },
  highlightsLogoInner: {
    alignItems: 'center',
  },
  highlightsLogoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginTop: 8,
    letterSpacing: 1,
  },
  // Players Section - Redesigned
  playersContainer: {
    gap: 12,
  },
  playerCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  playerHeader: {
    marginRight: 16,
    alignItems: 'center',
  },
  playerRank: {
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 8,
  },
  rankNumber: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  playerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  playerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerAvatarText: {
    fontSize: 20,
  },
  avatarText: {
    fontSize: 20,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  playerPosition: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  playerStats: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  // Tournaments Section
  tournamentCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  tournamentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tournamentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  tournamentPrize: {
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  prizeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tournamentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tournamentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tournamentDate: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  tournamentParticipants: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantsText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  tournamentProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
  progressText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    minWidth: 50,
  },
  // Hot Section
  hotSection: {
    marginBottom: 8,
  },
  hotCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  hotImage: {
    height: 200,
    justifyContent: 'flex-end',
  },
  hotImageStyle: {
    borderRadius: 16,
  },
  hotOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  videoInfo: {
    flex: 1,
  },
  hotTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  hotDate: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  videoLabel: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Rising Stars
  seeAllText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  playerImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  playerImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  playerImagePlaceholderText: {
    fontSize: 48,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  playerDetails: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    alignItems: 'center',
  },
  playerTeam: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  hexagonContainer: {
    alignItems: 'center',
  },
  hexagon: {
    width: 90,
    height: 90,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  hexagonText: {
    fontSize: 32,
  },
  playerClub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 4,
  },
  playerPoints: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.3)',
  },
  topPlayerHexagon: {
    borderColor: '#ffd700',
    borderWidth: 4,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  crownIcon: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#ffd700',
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  crownText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  refreshButton: {
    padding: 4,
  },
  winRateContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  winRateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  winRateBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  winRateFill: {
    height: '100%',
    backgroundColor: '#059669',
    borderRadius: 3,
  },
  winRateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  // Match Scores
  matchesContainer: {
    gap: 12,
  },
  minimalMatchCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  matchTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  matchTypeText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divisionText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '500',
  },
  minimalMatchTime: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  matchContent: {
    marginBottom: 12,
  },
  teamMatchup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamInfo: {
    flex: 1,
    alignItems: 'center',
  },
  minimalTeamName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  vsText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: 'bold',
    marginHorizontal: 16,
  },
  minimalBookingInfo: {
    alignItems: 'center',
  },
  bookingTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  bookingLocation: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginBottom: 4,
  },
  minimalBookingPlayers: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  minimalMatchDate: {
    alignItems: 'center',
  },
  dateText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '500',
  },
  noMatchesContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noMatchesText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    marginBottom: 16,
  },
  findMatchButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  findMatchButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  // Horizontal match cards
  horizontalMatchesContainer: {
    paddingHorizontal: 16,
    gap: 16,
  },
  horizontalMatchCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    width: 280,
    minHeight: 140,
  },
  matchCardHeader: {
    marginBottom: 12,
  },
  matchCardContent: {
    flex: 1,
    marginBottom: 12,
  },
  matchCardFooter: {
    alignItems: 'center',
  },
  matchDateTime: {
    alignItems: 'center',
  },
  horizontalTeamMatchup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  horizontalTeamInfo: {
    flex: 1,
    alignItems: 'center',
  },
  horizontalTeamName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  horizontalVsText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: 'bold',
    marginHorizontal: 12,
  },
  horizontalBookingInfo: {
    alignItems: 'center',
  },
  horizontalBookingTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  horizontalBookingLocation: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  horizontalBookingPlayers: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    textAlign: 'center',
  },
  horizontalDateText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '500',
  },
  horizontalTimeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  matchContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  statsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
  },
  matchCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  leagueName: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  matchTeams: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  teamContainer: {
    flex: 1,
    alignItems: 'center',
  },
  teamName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  scoreContainer: {
    alignItems: 'center',
    flex: 2,
  },
  score: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
    letterSpacing: 1,
  },
  matchStatus: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchDate: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  detailsButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  detailsText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  // Menu Modal
  menuModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-start',
  },
  menuContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 20,
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 16,
  },
  // Upcoming Bookings Styles
  noBookingsContainer: {
    alignItems: 'center',
    padding: 20,
  },
  noBookingsText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
  },
  createBookingButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createBookingButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bookingDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  bookingPlayers: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
  bookingPrice: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  matchLocation: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    fontWeight: '400',
    marginTop: 2,
  },
  // Improved booking card styles
  bookingHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bookingInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  matchTime: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  rulesSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
    marginTop: 8,
  },
  rulesDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 16,
    lineHeight: 20,
  },
  rulesCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  ruleText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  divisionRulesContainer: {
    marginBottom: 20,
  },
  divisionRuleCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  divisionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  modalDivisionSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  ruleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ruleLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    flex: 1,
  },
  ruleValue: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '600',
    textAlign: 'right',
  },
});

export default MainAppScreen;
