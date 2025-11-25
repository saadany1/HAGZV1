import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { RootStackParamList, TabParamList } from '../navigation/AppNavigator';
import { supabase } from '../lib/supabase';
import { useAppData } from '../context/AppDataContext';
import MatchmakingComponent from '../components/MatchmakingComponent';
import HourglassLoader from '../components/HourglassLoader';


interface PlayerPosition {
  id: string;
  x: number;
  y: number;
  number: number;
  username: string;
}

interface Team {
  id: string;
  name: string;
  description: string;
  is_public: boolean;
  created_by: string;
  created_at: string;
  member_count: number;
  wins: number;
  losses: number;
  draws: number;
  division: number;
}

interface PublicTeam {
  id: string;
  name: string;
  description: string;
  member_count: number;
  max_members: number;
  created_at: string;
  is_public: boolean;
}

interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  email: string;
}

type MyTeamNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'MyTeam'>,
  StackNavigationProp<RootStackParamList>
>;

const MyTeamScreen: React.FC = () => {
  const navigation = useNavigation<MyTeamNavigationProp>();
  
  // Use global app data for team information
  const { 
    userTeam, 
    publicTeams,
    isDataReady,
    refreshTeamData 
  } = useAppData();

  // Helper function to truncate long descriptions
  const truncateDescription = (description: string, maxLength: number = 80): string => {
    if (!description) return '';
    if (description.length <= maxLength) return description;
    return description.substring(0, maxLength).trim() + '...';
  };
  
  const [currentView, setCurrentView] = useState<'loading' | 'noTeam' | 'hasTeam'>('loading');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showJoinTeamModal, setShowJoinTeamModal] = useState(false);
  const [showDivisionRulesModal, setShowDivisionRulesModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [joiningTeam, setJoiningTeam] = useState<string | null>(null);
  const [showFormation, setShowFormation] = useState(false);
  const [showLeaveSuccessModal, setShowLeaveSuccessModal] = useState(false);
  const [showDeleteSuccessModal, setShowDeleteSuccessModal] = useState(false);
  const [showLeaveTeamModal, setShowLeaveTeamModal] = useState(false);
  const [showDeleteTeamModal, setShowDeleteTeamModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showJoinSuccessModal, setShowJoinSuccessModal] = useState(false);
  const [joinedTeamName, setJoinedTeamName] = useState('');
  
  // Form states
  const [inviteUsername, setInviteUsername] = useState('');
  const [invitedUsers, setInvitedUsers] = useState<UserProfile[]>([]);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Formation state
  const [players, setPlayers] = useState<PlayerPosition[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [draggingPlayer, setDraggingPlayer] = useState<string | null>(null);
  const [pitchLayout, setPitchLayout] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    // Team data is already loaded globally, just set the correct view
    if (isDataReady) {
      if (userTeam) {
        setCurrentView('hasTeam');
      } else {
        setCurrentView('noTeam');
      }
      setShowContent(true);
      setIsInitialLoad(false);
      setIsInitializing(false);
      console.log('✅ MyTeamScreen: Team data already loaded from global context!');
    }
  }, [isDataReady, userTeam]);

  // Handle navigation parameters
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Only check if content is already shown to avoid interfering with initial load
      if (showContent) {
        // Check if we should show formation (coming from team creation)
        const state = navigation.getState();
        const tabState = state.routes.find((r: any) => r.name === 'MainTabs')?.state;
        const myTeamRoute = tabState?.routes?.find((r: any) => r.name === 'MyTeam');
        const myTeamParams = (myTeamRoute?.params || {}) as TabParamList['MyTeam'];
        if (myTeamParams?.showFormation) {
          setShowFormation(true);
          // Clear the parameter
          navigation.setParams({ showFormation: undefined } as TabParamList['MyTeam']);
        }
      }
    });

    return unsubscribe;
  }, [navigation, showContent]);

  // Initialize formation when team changes
  useEffect(() => {
    if (userTeam) {
      initializeFormation();
    }
  }, [userTeam]);

  // Auto-scroll to formation when showFormation is true
  useEffect(() => {
    if (showFormation && userTeam && currentView === 'hasTeam') {
      // Small delay to ensure the view is rendered
      setTimeout(() => {
        setShowFormation(false); // Reset the flag
        // You could add scroll logic here if needed
      }, 500);
    }
  }, [showFormation, userTeam, currentView]);

  const initializeFormation = async () => {
    try {
      // First get team members
      const { data: members, error: membersError } = await supabase
        .from('team_members')
        .select('id, user_id, role, status')
        .eq('team_id', userTeam?.id)
        .eq('status', 'active');

      if (membersError) {
        console.error('Error fetching team members:', membersError);
        throw membersError;
      }

      if (!members || members.length === 0) {
        console.log('No team members found');
        setTeamMembers([]);
        setPlayers([{ id: '1', x: 0.5, y: 0.9, number: 1, username: 'Player 1' }]);
        return;
      }

      // Then get user profiles for each member
      const userIds = members.map((member: any) => member.user_id);
      const { data: userProfiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, username, full_name')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching user profiles:', profilesError);
        throw profilesError;
      }

      // Combine the data
      const membersWithProfiles = members.map((member: any) => {
        const profile = userProfiles?.find((p: any) => p.id === member.user_id);
        return {
          ...member,
          user_profiles: profile ? [profile] : []
        };
      });

      console.log('Team members with profiles:', membersWithProfiles);
      setTeamMembers(membersWithProfiles);
      
      const teamSize = Math.min(membersWithProfiles.length, 5); // Max 5 players
      console.log('Creating formation for team size:', teamSize);
      
      // Create default positions based on team size
      const defaultPositions: PlayerPosition[] = [];
      for (let i = 0; i < teamSize; i++) {
        let x, y;
        const member = membersWithProfiles[i];
        const username = member.user_profiles?.[0]?.username || `Player ${i + 1}`;
        
        switch (i) {
          case 0: // Goalkeeper
            x = 0.5; y = 0.85;
            break;
          case 1: // Left back
            x = 0.25; y = 0.7;
            break;
          case 2: // Right back
            x = 0.75; y = 0.7;
            break;
          case 3: // Central midfielder
            x = 0.5; y = 0.5;
            break;
          case 4: // Striker
            x = 0.5; y = 0.15;
            break;
          default:
            x = 0.5; y = 0.5;
        }
        
        defaultPositions.push({ 
          id: member.id, 
          x, 
          y, 
          number: i + 1,
          username
        });
      }
      
      console.log('Created player positions:', defaultPositions);
      setPlayers(defaultPositions);
    } catch (error) {
      console.error('Error initializing formation:', error);
      // Fallback to 1 player if error
      setPlayers([{ id: '1', x: 0.5, y: 0.9, number: 1, username: 'Player 1' }]);
      setTeamMembers([]);
    }
  };



  const onPlayerGestureEvent = (playerId: string) => (event: any) => {
    if (draggingPlayer === playerId) {
      const { absoluteX, absoluteY } = event.nativeEvent;
      
      // Get the current player position
      const currentPlayer = players.find(p => p.id === playerId);
      if (!currentPlayer) return;
      
      // Calculate position relative to the pitch container
      // Center the player circle under the finger by accounting for the circle's radius
      const playerRadius = 30; // Half of the 60px player circle width
      
      // Adjust the touch position so the center of the circle goes under the finger
      const adjustedX = absoluteX - playerRadius;
      const adjustedY = absoluteY - playerRadius;
      
      const relativeX = (adjustedX - pitchLayout.x) / pitchLayout.width;
      const relativeY = (adjustedY - pitchLayout.y) / pitchLayout.height;
      
      // Constrain to pitch boundaries, accounting for the circle size
      const minBoundary = playerRadius / pitchLayout.width; // Minimum safe distance from edge
      const maxBoundary = 1 - minBoundary; // Maximum safe distance from edge
      
      const constrainedX = Math.max(minBoundary, Math.min(maxBoundary, relativeX));
      const constrainedY = Math.max(minBoundary, Math.min(maxBoundary, relativeY));
      
      // Update player position
      setPlayers(prev => prev.map(player => {
        if (player.id === playerId) {
          return {
            ...player,
            x: constrainedX,
            y: constrainedY
          };
        }
        return player;
      }));
    }
  };

  const onPlayerHandlerStateChange = (playerId: string) => (event: any) => {
    if (event.nativeEvent.state === State.BEGAN) {
      setDraggingPlayer(playerId);
    } else if (event.nativeEvent.state === State.END) {
      setDraggingPlayer(null);
    }
  };

  // Helper function to get division color
  const getDivisionColor = (division: number): string => {
    switch (division) {
      case 1: return '#FFD700'; // Gold for Division 1
      case 2: return '#C0C0C0'; // Silver for Division 2
      case 3: return '#CD7F32'; // Bronze for Division 3
      case 4: return '#4CAF50'; // Green for Division 4
      case 5: return '#2196F3'; // Blue for Division 5
      default: return '#9E9E9E'; // Gray for unknown
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
  const getDivisionStatus = (team: Team | null) => {
    if (!team) return { status: 'No Team', progress: 0, message: 'Join a team to see division status' };

    const rules = getDivisionRules(team.division);
    const totalPoints = (team.wins * 3) + (team.draws * 1) + (team.losses * 0);
    const matchesPlayed = team.wins + team.draws + team.losses;
    
    let status = 'Stay Zone';
    let message = '';
    let progress = 0;

    // Check for title zone
    if (totalPoints >= rules.titleZone) {
      status = 'Title Zone';
      message = `🏆 Division ${team.division} Champions!`;
      progress = 100;
    }
    // Check for promotion zone
    else if (rules.promotionZone && totalPoints >= rules.promotionZone) {
      status = 'Promotion Zone';
      message = `⬆️ Promoted to Division ${team.division - 1}!`;
      progress = 0; // Reset progress bar when promoted
    }
    // Check for relegation zone
    else if (rules.relegationZone && totalPoints <= rules.relegationZone) {
      status = 'Relegation Zone';
      message = `⬇️ Relegated to Division ${team.division + 1}`;
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



  // Safe function to update current view only during initialization
  const safeSetCurrentView = (view: 'loading' | 'noTeam' | 'hasTeam') => {
    if (isInitializing || !showContent) {
      setCurrentView(view);
    }
  };

  // Clear all team-related data
  const clearTeamData = async (updateView: boolean = true) => {
    console.log('Clearing all team data');
    await refreshTeamData(); // This will update the global context
    if (updateView) {
      safeSetCurrentView('noTeam');
    }
    setPlayers([]);
    setTeamMembers([]);
  };



  // Quick team check for initial load to prevent flashing
  const quickTeamCheck = async (): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      
      // Quick check if user has any active team membership
      const { data: membership, error } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle(); // Use maybeSingle() instead of single() to avoid errors when no records exist
      
      if (error) {
        console.error('Quick team check error:', error);
        return false;
      }
      
      return !!membership?.team_id;
    } catch (error) {
      console.error('Quick team check exception:', error);
      return false;
    }
  };

  const checkUserTeam = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      console.log('Checking user team for user:', user?.id, 'Current user ID:', currentUserId);
      
      // Debug: Check all team_members records for this user
      if (user) {
        const { data: allMemberships, error: allMembershipsError } = await supabase
          .from('team_members')
          .select('*')
          .eq('user_id', user.id);
        
        console.log('All team memberships for user:', allMemberships);
        if (allMembershipsError) {
          console.error('Error fetching all memberships:', allMembershipsError);
        }
      }
      
      // Check if user has changed
      if (user && user.id !== currentUserId) {
        console.log('User changed from', currentUserId, 'to', user.id, '- clearing team data');
        // User has changed, clear all previous data (but don't update view yet)
        await clearTeamData(false);
        setCurrentUserId(user.id);
      } else if (!user) {
        console.log('No user logged in - clearing team data');
        // No user logged in, clear data and set view
        await clearTeamData(true);
        setCurrentUserId(null);
        return;
      }
      
      if (user) {
        const { data: teamMember, error } = await supabase
          .from('team_members')
          .select(`
            team_id,
            role,
            teams (
              id,
              name,
              description,
              is_public,
              created_by,
              created_at,
              max_members,
              wins,
              losses,
              draws,
              division
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();
        
        if (teamMember && !error && teamMember.teams) {
          const team = teamMember.teams as any;
          // Get member count
          const { count: memberCount } = await supabase
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', team.id)
            .eq('status', 'active');
          
          // Verify this team belongs to the current user
          if (teamMember.team_id && teamMember.team_id === team.id) {
            // Team data will be handled by the global context
            console.log('User is verified as member of team:', team.name);
            safeSetCurrentView('hasTeam');
          } else {
            // Team doesn't belong to current user, clear data
            await clearTeamData(false); // Don't update view here
            safeSetCurrentView('noTeam');
          }
        } else {
          // No team found
          safeSetCurrentView('noTeam');
        }
      } else {
        safeSetCurrentView('noTeam');
      }
    } catch (error) {
      console.error('Error checking user team:', error);
      safeSetCurrentView('noTeam');
    }
  };


  const searchUsers = async (username: string) => {
    if (username.length < 3) return;
    
    setIsSearching(true);
    try {
      const { data: users, error } = await supabase
        .from('user_profiles')
        .select('id, username, full_name, email')
        .ilike('username', `%${username}%`)
        .limit(5);
      
      if (error) {
        console.error('User search error:', error);
        // Don't show error to user, just log it
        setSearchResults([]);
      } else if (users) {
        setSearchResults(users);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const inviteUser = (user: UserProfile) => {
    if (!invitedUsers.find(u => u.id === user.id)) {
      setInvitedUsers([...invitedUsers, user]);
      setInviteUsername('');
      setSearchResults([]);
    }
  };

  const removeInvitedUser = (userId: string) => {
    setInvitedUsers(invitedUsers.filter(u => u.id !== userId));
  };


  const leaveTeam = async () => {
    if (!userTeam) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Check if user is the team captain
        const { data: memberData } = await supabase
          .from('team_members')
          .select('role')
          .eq('team_id', userTeam.id)
          .eq('user_id', user.id)
          .single();
        
        if (memberData?.role === 'captain') {
          // Check if captain is the only member
          const { count: memberCount } = await supabase
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', userTeam.id)
            .eq('status', 'active');
          
          if (memberCount === 1) {
            // Captain is the only member, show team deletion warning
            setShowDeleteTeamModal(true);
          } else {
            // Captain has other members, show regular leave modal
            setShowLeaveTeamModal(true);
          }
        } else {
          // Not captain, show regular leave modal
          setShowLeaveTeamModal(true);
        }
      }
    } catch (error) {
      console.error('Error checking team membership:', error);
      showError('Failed to check team status');
    }
  };

  const handleConfirmLeaveTeam = async () => {
    if (!userTeam) return;
    setShowLeaveTeamModal(false);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showError('You must be logged in');
        return;
      }

      // Optimistic update - immediately update UI
      const wasTeamDeleted = userTeam.created_by === user.id;
      setCurrentView('noTeam');
      
      if (wasTeamDeleted) {
        setShowDeleteSuccessModal(true);
      } else {
        setShowLeaveSuccessModal(true);
      }

      // Perform database operation in background
      let error = null;
      
      if (wasTeamDeleted) {
        // If creator, delete the entire team
        const { error: teamError } = await supabase
          .from('teams')
          .delete()
          .eq('id', userTeam.id);
        error = teamError;
      } else {
        // If not creator, just remove from team
        const { error: memberError } = await supabase
          .from('team_members')
          .delete()
          .eq('team_id', userTeam.id)
          .eq('user_id', user.id);
        error = memberError;
      }

      if (error) {
        // Revert optimistic update on error
        console.error('Error leaving team:', error);
        setShowLeaveSuccessModal(false);
        setShowDeleteSuccessModal(false);
        setCurrentView('hasTeam');
        showError('Failed to leave team. Please try again.');
        return;
      }

      // Success - refresh data in background
      console.log('Successfully left team:', userTeam.name);
      refreshTeamData(); // Don't await - let it run in background
      
    } catch (error) {
      console.error('Unexpected error leaving team:', error);
      setShowLeaveSuccessModal(false);
      setShowDeleteSuccessModal(false);
      setCurrentView('hasTeam');
      showError('An unexpected error occurred');
    }
  };

  const handleCancelLeaveTeam = () => {
    setShowLeaveTeamModal(false);
  };

  const handleCancelDeleteTeam = () => {
    setShowDeleteTeamModal(false);
  };

  const handleConfirmDeleteTeam = async () => {
    if (!userTeam) return;
    setShowDeleteTeamModal(false);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Delete the entire team
        const { error: teamError } = await supabase
          .from('teams')
          .delete()
          .eq('id', userTeam.id);
        
        if (!teamError) {
          await refreshTeamData(); // Refresh the global context
          setCurrentView('noTeam');
          setShowDeleteSuccessModal(true);
        } else {
          showError('Failed to delete team');
        }
      }
    } catch (error) {
      console.error('Error deleting team:', error);
      showError('Failed to delete team');
    }
  };

  const refreshData = async () => {
    await checkUserTeam();
    await refreshTeamData();
  };

  const handleLeaveSuccessClose = () => {
    setShowLeaveSuccessModal(false);
  };

  const handleDeleteSuccessClose = () => {
    setShowDeleteSuccessModal(false);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setShowErrorModal(true);
  };

  const handleErrorClose = () => {
    setShowErrorModal(false);
    setErrorMessage('');
  };

  const handleJoinSuccessClose = () => {
    setShowJoinSuccessModal(false);
    setJoinedTeamName('');
  };

  // Debug function to clean up orphaned team memberships
  const cleanupOrphanedMemberships = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('Cleaning up orphaned memberships for user:', user.id);
      
      // Get all team memberships for this user
      const { data: memberships, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Error fetching memberships for cleanup:', error);
        return;
      }
      
      if (!memberships || memberships.length === 0) {
        console.log('No memberships found for cleanup');
        return;
      }
      
      console.log('Found memberships:', memberships);
      
      // Check which teams still exist
      const teamIds = memberships.map((m: any) => m.team_id);
      const { data: existingTeams, error: teamsError } = await supabase
        .from('teams')
        .select('id')
        .in('id', teamIds);
      
      if (teamsError) {
        console.error('Error checking existing teams:', teamsError);
        return;
      }
      
      const existingTeamIds = existingTeams?.map((t: any) => t.id) || [];
      const orphanedMemberships = memberships.filter((m: any) => !existingTeamIds.includes(m.team_id));
      
      if (orphanedMemberships.length > 0) {
        console.log('Found orphaned memberships:', orphanedMemberships);
        
        // Delete orphaned memberships
        const { error: deleteError } = await supabase
          .from('team_members')
          .delete()
          .in('id', orphanedMemberships.map((m: any) => m.id));
        
        if (deleteError) {
          console.error('Error deleting orphaned memberships:', deleteError);
        } else {
          console.log('Successfully cleaned up orphaned memberships');
        }
      }
      
      // Check for multiple active memberships (should only have one)
      const activeMemberships = memberships.filter((m: any) => m.status === 'active');
      if (activeMemberships.length > 1) {
        console.log('Found multiple active memberships:', activeMemberships);
        
        // Keep only the most recent one
        const sortedMemberships = activeMemberships.sort((a: any, b: any) => 
          new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
        );
        
        const toDeactivate = sortedMemberships.slice(1);
        console.log('Deactivating old memberships:', toDeactivate);
        
        const { error: updateError } = await supabase
          .from('team_members')
          .update({ status: 'inactive' })
          .in('id', toDeactivate.map((m: any) => m.id));
        
        if (updateError) {
          console.error('Error deactivating old memberships:', updateError);
        } else {
          console.log('Successfully deactivated old memberships');
        }
      }
      
    } catch (error) {
      console.error('Error in cleanup function:', error);
    }
  };

  // Optimized refresh function
  const refreshAllData = useCallback(async () => {
    console.log('Optimized data refresh');
    // Just refresh the global context - it handles everything
    await refreshTeamData();
  }, [refreshTeamData]);

  // Optimized join team function with optimistic updates
  const handleJoinTeam = async (teamId: string) => {
    setJoiningTeam(teamId);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showError('You must be logged in to join a team');
        return;
      }

      // Find the team from local data for optimistic update
      const team = publicTeams.find(t => t.id === teamId);
      if (!team) {
        showError('Team not found. Please refresh and try again.');
        return;
      }

      // Quick local validation
      if (team.member_count >= team.max_members) {
        showError('This team is full. Please try another team.');
        return;
      }

      // Optimistic update - immediately show success
      setJoinedTeamName(team.name);
      setJoiningTeam(null);
      setShowJoinSuccessModal(true);

      // Perform database operation in background
      const { error } = await supabase
        .from('team_members')
        .insert({
          team_id: teamId,
          user_id: user.id,
          role: 'member',
          status: 'active',
        });

      if (error) {
        // Revert optimistic update on error
        console.error('Join team error:', error);
        setShowJoinSuccessModal(false);
        
        if (error.code === '23505') { // Unique constraint violation
          showError('You are already a member of this team');
        } else if (error.message.includes('full')) {
          showError('This team is full. Please try another team.');
        } else {
          showError('Failed to join team. Please try again.');
        }
        return;
      }

      // Success - refresh data in background
      console.log('Successfully joined team:', team.name);
      refreshTeamData(); // Don't await - let it run in background
      
    } catch (error) {
      console.error('Unexpected error joining team:', error);
      setShowJoinSuccessModal(false);
      showError('An unexpected error occurred');
    } finally {
      setJoiningTeam(null);
    }
  };



  if (!showContent) {
    return (
      <ImageBackground source={require('../../assets/hage.jpeg')} style={styles.container}>
        <View style={styles.backgroundOverlay}>
          <HourglassLoader 
            size={50}
            color="#4CAF50"
            text="Loading..."
            containerStyle={styles.loadingContainer}
          />
        </View>
      </ImageBackground>
    );
  }

  if (currentView === 'noTeam') {
    return (
      <ImageBackground source={require('../../assets/hage.jpeg')} style={styles.container}>
        <View style={styles.backgroundOverlay}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                  <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>My Team</Text>
              <Text style={styles.subtitle}>Create your team to start playing</Text>
            </View>
          </View>
        </View>

          {/* Large Create Team button */}
          <TouchableOpacity 
            style={styles.bigCreateButton}
            onPress={() => navigation.navigate('CreateTeam')}
          >
            <Ionicons name="add-circle" size={32} color="#4CAF50" />
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text style={styles.bigCreateButtonTitle}>Create Team</Text>
              <Text style={styles.bigCreateButtonSubtitle}>Set a name, invite friends and get started</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.8)" />
          </TouchableOpacity>

          <View style={styles.publicTeamsSection}>
            <Text style={styles.sectionTitle}>Public Teams</Text>
            <Text style={styles.sectionSubtitle}>Join these available teams</Text>
            {publicTeams.map((team) => (
              <View key={team.id} style={styles.teamCard}>
                <View style={styles.teamHeader}>
                  <View style={styles.teamAvatar}>
                    <Text style={styles.teamInitial}>
                      {team.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.teamInfo}>
                    <Text style={styles.teamName}>{team.name}</Text>
                    <Text style={styles.teamDescription}>
                      {truncateDescription(team.description, 80)}
                    </Text>
                    <Text style={styles.teamStatsText}>
                      {team.member_count}/{team.max_members} members
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[
                    styles.joinButton,
                    joiningTeam === team.id && styles.joiningButton
                  ]}
                  onPress={() => handleJoinTeam(team.id)}
                  disabled={joiningTeam === team.id}
                >
                  {joiningTeam === team.id ? (
                    <ActivityIndicator size="small" color="#fff" style={styles.buttonIcon} />
                  ) : (
                    <Ionicons name="add" size={16} color="#fff" style={styles.buttonIcon} />
                  )}
                  <Text style={styles.joinButtonText}>
                    {joiningTeam === team.id ? 'Joining...' : 'Join Team'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>
        </View>
      </ImageBackground>
    );
  }

  // Has Team View
  return (
    <ImageBackground source={require('../../assets/hage.jpeg')} style={styles.container}>
      <View style={styles.backgroundOverlay}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >



        <View style={styles.section}>
          <View style={styles.teamHeader}>
            <View style={styles.teamHeaderLeft}>
              <View style={styles.teamAvatar}>
                <Text style={styles.teamInitial}>
                  {userTeam?.name.charAt(0).toUpperCase() || 'T'}
                </Text>
              </View>
              <View style={styles.teamInfo}>
                <Text style={styles.teamName}>{userTeam?.name || 'Team Name'}</Text>
                <Text style={styles.teamDivision}>
                  {userTeam?.is_public ? 'Public Team' : 'Private Team'}
                </Text>
                <Text style={styles.teamStatsText}>
                  {userTeam?.member_count || 0} players
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity 
                style={styles.iconButton}
                onPress={() => navigation.navigate('TeamChat', { teamId: userTeam?.id || '', teamName: userTeam?.name || 'Team' })}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="rgba(255, 255, 255, 0.7)" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.settingsButton}
                onPress={() => navigation.navigate('TeamSettings', { teamId: userTeam?.id || '' })}
              >
                <Ionicons name="settings-outline" size={24} color="rgba(255, 255, 255, 0.7)" />
              </TouchableOpacity>
            </View>
          </View>
          
          <Text style={styles.sectionTitle}>Team Formation</Text>
          
          {/* Division Progress Bar */}
          <View style={styles.divisionContainer}>
            <View style={styles.divisionHeader}>
              <View style={styles.divisionTitleSection}>
                <View style={styles.divisionBadge}>
                  <Text style={styles.divisionNumber}>
                    {(() => {
                      const currentDivision = userTeam?.division || 5;
                      const divisionStatus = getDivisionStatus(userTeam);
                      
                      // Determine the display division number based on status
                      let displayDivision = currentDivision;
                      if (divisionStatus.status === 'Promotion Zone') {
                        displayDivision = currentDivision - 1; // Show the division they're promoted to
                      } else if (divisionStatus.status === 'Relegation Zone') {
                        displayDivision = currentDivision + 1; // Show the division they're relegated to
                      }
                      
                      return displayDivision;
                    })()}
                  </Text>
                </View>
                <View style={styles.divisionInfo}>
                  <Text style={styles.divisionLabel}>Division</Text>
                  <Text style={styles.divisionSubtitle}>
                    {getDivisionStatus(userTeam).status}
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
                        width: `${getDivisionStatus(userTeam).progress}%`,
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
                          backgroundColor: div <= (userTeam?.division || 5) 
                            ? 'rgba(255, 255, 255, 0.8)' 
                            : 'rgba(255, 255, 255, 0.15)' 
                        }
                      ]}
                    />
                  ))}
                </View>
              </View>
              <Text style={styles.divisionProgressText}>
                {getDivisionStatus(userTeam).totalPoints} / {getDivisionStatus(userTeam).rules?.maxPoints || 15} pts
              </Text>
            </View>

            {/* Division Status Message */}
            <Text style={styles.divisionMessage}>
              {getDivisionStatus(userTeam).message}
            </Text>
          </View>
          
          <Text style={styles.sectionSubtitle}>Drag player circles to adjust positions - Centered under finger (Max 5 players)</Text>
          
          {/* Pitch Container */}
          <View
            style={styles.pitchContainer}
            onLayout={(event) => {
              const { width, height, x, y } = event.nativeEvent.layout;
              setPitchLayout({ width, height, x, y });
            }}
          >
            <Image
              source={require('../../assets/pitch.png')}
              style={styles.pitchImage}
              resizeMode="cover"
            />
            
            {/* Team name overlay */}
            <View style={styles.teamNameOverlay}>
              <Text style={styles.teamNameOverlayText}>{userTeam?.name || 'Team'}</Text>
            </View>
            
            {/* Formation indicator */}
            <View style={styles.formationIndicator}>
              <Text style={styles.formationIndicatorText}>
                {players.length > 0 ? `${players.length}-${Math.max(0, players.length - 1)}-1` : 'Formation'}
              </Text>
            </View>
            
            {/* Player count indicator */}
            <View style={styles.playerCountIndicator}>
              <Text style={styles.playerCountIndicatorText}>
                {players.length}/5 Players
              </Text>
            </View>
            
            {/* Players */}
            {players.map((player) => (
              <PanGestureHandler
                key={player.id}
                onGestureEvent={onPlayerGestureEvent(player.id)}
                onHandlerStateChange={onPlayerHandlerStateChange(player.id)}
              >
                <View
                  style={[
                    styles.playerHead,
                    draggingPlayer === player.id && styles.playerHeadDragging,
                    {
                      left: `${player.x * 100}%`,
                      top: `${player.y * 100}%`,
                      transform: [
                        { translateX: -30 }, // Center the circle (half of width)
                        { translateY: -30 }  // Center the circle (half of height)
                      ]
                    }
                  ]}
                >
                  <Text style={styles.playerNumber}>{player.number}</Text>
                  <Text style={styles.playerName}>{player.username}</Text>
                </View>
              </PanGestureHandler>
            ))}
            
          </View>
        </View>

         <View style={styles.section}>
           <View style={styles.sectionContent}>
             <Text style={styles.sectionTitle}>Team Members</Text>
             <Text style={styles.sectionSubtitle}>{teamMembers.length} players in squad</Text>
             
             <View style={styles.membersList}>
               {teamMembers.map((member, index) => (
                 <View key={member.id} style={styles.memberCard}>
                   <View style={styles.memberAvatar}>
                     <Text style={styles.memberInitial}>
                       {member.user_profiles?.[0]?.username?.charAt(0).toUpperCase() || 'P'}
                     </Text>
                   </View>
                   <View style={styles.memberInfo}>
                     <Text style={styles.memberName}>{member.user_profiles?.[0]?.full_name || 'Player'}</Text>
                     <Text style={styles.memberUsername}>@{member.user_profiles?.[0]?.username || `player${index + 1}`}</Text>
                     <View style={styles.memberRoleContainer}>
                       <Ionicons 
                         name={member.role === 'captain' ? "star" : "person"} 
                         size={12} 
                         color={member.role === 'captain' ? "#FFD700" : "#4CAF50"} 
                       />
                       <Text style={[
                         styles.memberRole,
                         { color: member.role === 'captain' ? "#FFD700" : "#4CAF50" }
                       ]}>
                         {member.role === 'captain' ? 'Team Captain' : 'Player'}
                       </Text>
                     </View>
                   </View>
                   <View style={styles.memberNumber}>
                     <Text style={styles.memberNumberText}>{index + 1}</Text>
                   </View>
                 </View>
               ))}
             </View>
           </View>
         </View>

         <View style={styles.section}>
           <View style={styles.sectionContent}>
             <Text style={styles.sectionTitle}>Team Stats</Text>
             <Text style={styles.sectionSubtitle}>Performance overview</Text>
             
             <View style={styles.statsGrid}>
               {/* Top Row: Players and Wins */}
               <View style={styles.statRow}>
                 <View style={styles.statCard}>
                   <Text style={styles.statValue}>{teamMembers.length}</Text>
                   <Text style={styles.statLabel}>Players</Text>
                 </View>
                 <View style={styles.statCard}>
                   <Text style={styles.statValue}>{userTeam?.wins || 0}</Text>
                   <Text style={styles.statLabel}>Wins</Text>
                 </View>
               </View>
               
               {/* Bottom Row: Losses and Draws */}
               <View style={styles.statRow}>
                 <View style={styles.statCard}>
                   <Text style={styles.statValue}>{userTeam?.losses || 0}</Text>
                   <Text style={styles.statLabel}>Losses</Text>
                 </View>
                 <View style={styles.statCard}>
                   <Text style={styles.statValue}>{userTeam?.draws || 0}</Text>
                   <Text style={styles.statLabel}>Draws</Text>
                 </View>
               </View>
             </View>
             
             {/* Win Rate Display */}
             <View style={styles.winRateContainer}>
               <Text style={styles.winRateLabel}>Team Win Rate</Text>
               <View style={styles.winRateBar}>
                 <View 
                   style={[
                     styles.winRateFill, 
                     { 
                       width: `${userTeam && (userTeam.wins + userTeam.losses + userTeam.draws) > 0 
                         ? (userTeam.wins / (userTeam.wins + userTeam.losses + userTeam.draws)) * 100 
                         : 0}%` 
                     }
                   ]} 
                 />
               </View>
               <Text style={styles.winRateText}>
                 {userTeam && (userTeam.wins + userTeam.losses + userTeam.draws) > 0 
                   ? `${Math.round((userTeam.wins / (userTeam.wins + userTeam.losses + userTeam.draws)) * 100)}%`
                   : '0%'}
               </Text>
             </View>
           </View>
         </View>

         {/* Matchmaking Section */}
         {userTeam && (
           <View style={styles.section}>
             <MatchmakingComponent
               teamId={userTeam.id}
               teamName={userTeam.name}
               division={userTeam.division}
               userTeam={userTeam}
               navigation={navigation}
               onMatchFound={(matchData) => {
                 console.log('Match found:', matchData);
                 // You can add navigation logic here
               }}
             />
           </View>
         )}

         <View style={styles.section}>
          <TouchableOpacity style={styles.leaveTeamButton} onPress={leaveTeam}>
            <Ionicons name="exit-outline" size={20} color="rgba(255, 255, 255, 0.8)" style={styles.buttonIcon} />
            <Text style={styles.leaveTeamButtonText}>Leave Team</Text>
          </TouchableOpacity>
         </View>

        


        
              
              

      </ScrollView>

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

      {/* Leave Team Success Modal */}
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
            <Text style={styles.successTitle}>Team Left</Text>
            <Text style={styles.successMessage}>
              You have successfully left the team.
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

      {/* Delete Team Success Modal */}
      <Modal
        visible={showDeleteSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleDeleteSuccessClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconContainer}>
              <Ionicons name="trash" size={32} color="rgba(255, 255, 255, 0.9)" />
            </View>
            <Text style={styles.successTitle}>Team Deleted</Text>
            <Text style={styles.successMessage}>
              The team has been successfully deleted.
            </Text>
            <TouchableOpacity 
              style={styles.successButton}
              onPress={handleDeleteSuccessClose}
            >
              <Text style={styles.successButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Leave Team Confirmation Modal */}
      <Modal
        visible={showLeaveTeamModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelLeaveTeam}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModal}>
            <View style={styles.confirmationIconContainer}>
              <Ionicons name="exit" size={32} color="rgba(255, 255, 255, 0.9)" />
            </View>
            <Text style={styles.confirmationTitle}>Leave Team</Text>
            <Text style={styles.confirmationMessage}>
              Are you sure you want to leave {userTeam?.name}?
            </Text>
            <View style={styles.confirmationButtons}>
              <TouchableOpacity 
                style={styles.confirmationButtonSecondary}
                onPress={handleCancelLeaveTeam}
              >
                <Text style={styles.confirmationButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.confirmationButtonDanger}
                onPress={handleConfirmLeaveTeam}
              >
                <Text style={styles.confirmationButtonTextPrimary}>Leave</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Team Warning Modal */}
      <Modal
        visible={showDeleteTeamModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelDeleteTeam}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModal}>
            <View style={styles.confirmationIconContainer}>
              <Ionicons name="warning" size={32} color="#ff6b6b" />
            </View>
            <Text style={styles.confirmationTitle}>Delete Team</Text>
            <Text style={styles.confirmationMessage}>
              You are the only member of {userTeam?.name}. If you leave, the team will be permanently deleted and cannot be recovered.
            </Text>
            <View style={styles.confirmationButtons}>
              <TouchableOpacity 
                style={styles.confirmationButtonSecondary}
                onPress={handleCancelDeleteTeam}
              >
                <Text style={styles.confirmationButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.confirmationButtonDanger}
                onPress={handleConfirmDeleteTeam}
              >
                <Text style={styles.confirmationButtonTextPrimary}>Delete Team</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        visible={showErrorModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleErrorClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconContainer}>
              <Ionicons name="close-circle" size={32} color="#ff6b6b" />
            </View>
            <Text style={styles.successTitle}>Error</Text>
            <Text style={styles.successMessage}>
              {errorMessage}
            </Text>
            <TouchableOpacity 
              style={styles.successButton}
              onPress={handleErrorClose}
            >
              <Text style={styles.successButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Join Team Success Modal */}
      <Modal
        visible={showJoinSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleJoinSuccessClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
            </View>
            <Text style={styles.successTitle}>Success!</Text>
            <Text style={styles.successMessage}>
              Successfully joined {joinedTeamName}!
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 30,
  },
  header: {
    marginBottom: 30,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
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
  noTeamCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 24,
  },
  noTeamIcon: {
    marginBottom: 16,
  },
  noTeamTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  noTeamSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 20,
  },
  optionsSection: {
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  publicTeamsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 16,
  },
  teamCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  teamHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginLeft: 8,
  },
  teamAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  teamInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  teamInfo: {
    flex: 1,
    paddingRight: 12,
  },
  teamName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  teamDivision: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  teamDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
    lineHeight: 20,
    flexWrap: 'wrap',
  },
  teamStatsText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  divisionContainer: {
    marginTop: 16,
    marginBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
   joinButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joiningButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.7)',
    opacity: 0.8,
  },
  joinButtonDisabled: {
    backgroundColor: 'rgba(76, 175, 80, 0.5)',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  modalScroll: {
    padding: 20,
  },
  publicTeamsList: {
    padding: 20,
  },
  modalTeamCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 12,
  },
  modalTeamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTeamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalTeamDivision: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  modalTeamDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 10,
  },
  modalTeamStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTeamStatsText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  modalJoinButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalJoinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#4CAF50',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  toggleDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 16,
  },
  searchContainer: {
    position: 'relative',
  },
  searchInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingRight: 40,
  },
  searchSpinner: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  searchResults: {
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchResult: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchResultText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  searchResultName: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  invitedUsers: {
    marginTop: 12,
  },
  invitedUsersTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 8,
  },
  invitedUser: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
  },
  invitedUserText: {
    color: '#fff',
    fontSize: 14,
  },
  removeUserButton: {
    padding: 4,
  },
  createButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  createButtonDisabled: {
    backgroundColor: 'rgba(76, 175, 80, 0.5)',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
     section: {
     marginBottom: 30,
   },
   sectionHeader: {
     marginBottom: 16,
   },
   sectionContent: {
     backgroundColor: 'rgba(0, 0, 0, 0.9)',
     borderRadius: 16,
     padding: 20,
     borderWidth: 1,
     borderColor: 'rgba(255, 255, 255, 0.1)',
   },

  teamStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  activityCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
        activitySubtitle: {
     fontSize: 14,
     color: 'rgba(255, 255, 255, 0.5)',
   },
   
   debugText: {
     color: '#FFD700',
     fontSize: 12,
     textAlign: 'center',
     marginBottom: 10,
     fontStyle: 'italic',
   },

















   
   memberCard: {
     backgroundColor: 'rgba(0, 0, 0, 0.9)',
     borderRadius: 12,
     padding: 16,
     flexDirection: 'row',
     alignItems: 'center',
     borderWidth: 1,
     borderColor: 'rgba(255, 255, 255, 0.1)',
     marginBottom: 12,
   },
   memberAvatar: {
     width: 48,
     height: 48,
     borderRadius: 24,
     backgroundColor: 'rgba(76, 175, 80, 0.2)',
     justifyContent: 'center',
     alignItems: 'center',
     marginRight: 16,
     borderWidth: 2,
     borderColor: 'rgba(76, 175, 80, 0.3)',
   },
   memberInitial: {
     fontSize: 20,
     fontWeight: 'bold',
     color: '#4CAF50',
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
   memberUsername: {
     fontSize: 14,
     color: 'rgba(255, 255, 255, 0.7)',
     marginBottom: 4,
   },
   memberRoleContainer: {
     flexDirection: 'row',
     alignItems: 'center',
   },
   memberRole: {
     fontSize: 12,
     fontWeight: '500',
     marginLeft: 4,
   },
   memberNumber: {
     width: 32,
     height: 32,
     borderRadius: 16,
     backgroundColor: 'rgba(255, 255, 255, 0.1)',
     justifyContent: 'center',
     alignItems: 'center',
     borderWidth: 1,
     borderColor: 'rgba(255, 255, 255, 0.2)',
   },
   memberNumberText: {
     fontSize: 14,
     fontWeight: 'bold',
     color: '#fff',
   },
   
   // Stats grid styles
   statsGrid: {
     marginTop: 8,
     marginBottom: 16,
   },
   statRow: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     marginBottom: 8,
   },
   statCard: {
     flex: 1,
     backgroundColor: 'rgba(255, 255, 255, 0.03)',
     borderRadius: 12,
     padding: 16,
     alignItems: 'center',
     borderWidth: 1,
     borderColor: 'rgba(255, 255, 255, 0.08)',
     minHeight: 70,
     justifyContent: 'center',
     marginHorizontal: 4,
   },
   winRateContainer: {
     marginTop: 4,
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
     fontSize: 16,
     fontWeight: '700',
     color: '#059669',
     textAlign: 'center',
   },
  leaveTeamButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  leaveTeamButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
   buttonIcon: {
     marginRight: 8,
   },
   pitchContainer: {
     position: 'relative',
     width: '100%',
     height: 300,
     marginBottom: 20,
     borderRadius: 12,
     overflow: 'hidden',
   },
   pitchImage: {
     width: '100%',
     height: '100%',
   },
   teamNameOverlay: {
     position: 'absolute',
     top: 10,
     left: 10,
     backgroundColor: 'rgba(0, 0, 0, 0.7)',
     paddingHorizontal: 12,
     paddingVertical: 6,
     borderRadius: 16,
   },
   teamNameOverlayText: {
     color: '#fff',
     fontSize: 14,
     fontWeight: '600',
   },
   formationIndicator: {
     position: 'absolute',
     top: 10,
     right: 10,
     backgroundColor: 'rgba(0, 0, 0, 0.7)',
     paddingHorizontal: 12,
     paddingVertical: 6,
     borderRadius: 16,
   },
   formationIndicatorText: {
     color: '#fff',
     fontSize: 12,
     fontWeight: '500',
   },
   playerCountIndicator: {
     position: 'absolute',
     bottom: 10,
     left: 10,
     backgroundColor: 'rgba(0, 0, 0, 0.7)',
     paddingHorizontal: 12,
     paddingVertical: 6,
     borderRadius: 16,
   },
   playerCountIndicatorText: {
     color: '#fff',
     fontSize: 12,
     fontWeight: '500',
   },
   playerHead: {
     position: 'absolute',
     width: 60,
     height: 60,
     borderRadius: 30,
     backgroundColor: '#000000',
     justifyContent: 'center',
     alignItems: 'center',
     borderWidth: 3,
     borderColor: '#fff',
     shadowColor: '#000',
     shadowOffset: { width: 0, height: 4 },
     shadowOpacity: 0.3,
     shadowRadius: 8,
     elevation: 8,
   },
   playerHeadDragging: {
     shadowOpacity: 0.6,
     shadowRadius: 12,
     elevation: 12,
     transform: [{ scale: 1.1 }],
   },
   playerNumber: {
     fontSize: 16,
     fontWeight: 'bold',
     color: '#fff',
     marginBottom: 2,
   },
   playerName: {
     fontSize: 10,
     color: '#fff',
     textAlign: 'center',
   },
   membersList: {
     marginTop: 16,
   },
   statValue: {
     fontSize: 28,
     fontWeight: '700',
     color: '#fff',
     marginBottom: 6,
   },
   statLabel: {
     fontSize: 12,
     color: 'rgba(255, 255, 255, 0.6)',
     textTransform: 'uppercase',
     fontWeight: '500',
     letterSpacing: 0.5,
   },
   // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
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
  // Confirmation Modal Styles
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
  confirmationButtonDanger: {
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
  // Debug styles - remove in production
  debugSection: {
    marginBottom: 20,
    alignItems: 'center',
  },
  debugButton: {
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 0, 0.5)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 8,
    fontWeight: '500',
  },
  bigCreateButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderStyle: 'dashed',
    marginBottom: 24,
  },
  bigCreateButtonTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  bigCreateButtonSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

export default MyTeamScreen;



