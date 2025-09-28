import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db, auth, supabase } from '../lib/supabase';
import { PerformanceMonitor } from '../utils/performance';

// Types for our global app data
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
    goals: number;
    assists: number;
  };
}

interface PublicGame {
  id: string;
  pitch: string;
  date: string;
  time: string;
  players: number;
  maxPlayers: number;
  createdBy: string;
  status: 'open' | 'full';
  price: string;
  location: string;
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

interface Highlight {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  user_id: string;
  team_id?: string;
  game_date: string;
  views: number;
  likes: number;
  user_profiles?: {
    username: string;
    full_name: string;
    avatar_url?: string;
  };
  teams?: {
    name: string;
    logo_url?: string;
  };
}

interface AppDataContextType {
  // Loading states
  isInitialLoading: boolean;
  isDataReady: boolean;
  
  // User data
  userProfile: UserProfile | null;
  teamName: string | null;
  teamDivision: number;
  userTeam: Team | null;
  
  // Play screen data
  publicGames: PublicGame[];
  userJoinedGames: Set<string>;
  userCreatedGames: Set<string>;
  
  // Team screen data
  publicTeams: any[];
  
  // Highlights data
  highlights: Highlight[];
  
  // Leaderboards data
  topPlayers: any[];
  topTeams: any[];
  
  // Refresh functions
  refreshUserData: () => Promise<void>;
  refreshPublicGames: () => Promise<void>;
  refreshTeamData: () => Promise<void>;
  refreshHighlights: () => Promise<void>;
  refreshLeaderboards: () => Promise<void>;
  refreshAllData: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

interface AppDataProviderProps {
  children: ReactNode;
}

export const AppDataProvider: React.FC<AppDataProviderProps> = ({ children }) => {
  // Loading states
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isDataReady, setIsDataReady] = useState(false);
  
  // User data
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [teamDivision, setTeamDivision] = useState<number>(5);
  const [userTeam, setUserTeam] = useState<Team | null>(null);
  
  // Play screen data
  const [publicGames, setPublicGames] = useState<PublicGame[]>([]);
  const [userJoinedGames, setUserJoinedGames] = useState<Set<string>>(new Set());
  const [userCreatedGames, setUserCreatedGames] = useState<Set<string>>(new Set());
  
  // Team screen data
  const [publicTeams, setPublicTeams] = useState<any[]>([]);
  
  // Highlights data
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  
  // Leaderboards data
  const [topPlayers, setTopPlayers] = useState<any[]>([]);
  const [topTeams, setTopTeams] = useState<any[]>([]);

  // Initialize all app data when user is authenticated
  useEffect(() => {
    const initializeAppData = async () => {
      try {
        PerformanceMonitor.startTimer('appDataInit');
        setIsInitialLoading(true);
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsInitialLoading(false);
          return;
        }

        console.log('🚀 Starting global app data preload...');
        
        // Initialize push notifications for authenticated user
        try {
          const { notificationService } = await import('../services/notificationService');
          const pushToken = await notificationService.registerForPushNotifications();
          console.log('📱 Push notification registration result:', pushToken ? 'Success' : 'Failed/Skipped');
        } catch (error) {
          console.error('📱 Push notification registration error:', error);
        }
        
        // Load all data in parallel for maximum speed
        await Promise.all([
          refreshUserData(),
          refreshPublicGames(),
          refreshTeamData(),
          refreshHighlights(),
          refreshLeaderboards(),
        ]);
        
        setIsDataReady(true);
        PerformanceMonitor.endTimer('appDataInit');
        console.log('✅ Global app data preload complete!');
        
      } catch (error) {
        console.error('❌ Error initializing app data:', error);
      } finally {
        setIsInitialLoading(false);
      }
    };

    initializeAppData();

    // Listen for auth changes to reload data
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Register for push notifications on sign in
        try {
          const { notificationService } = await import('../services/notificationService');
          await notificationService.registerForPushNotifications();
        } catch (error) {
          console.error('📱 Push notification registration on sign in failed:', error);
        }
        await initializeAppData();
      } else if (event === 'SIGNED_OUT') {
        // Clear all data
        setUserProfile(null);
        setTeamName(null);
        setUserTeam(null);
        setPublicGames([]);
        setPublicTeams([]);
        setHighlights([]);
        setTopPlayers([]);
        setTopTeams([]);
        setIsDataReady(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshUserData = async () => {
    try {
      PerformanceMonitor.startTimer('refreshUserData');
      
      const currentUser = await auth.getCurrentUser();
      if (!currentUser) return;

      // Load user profile
      const { data: profile } = await db.getUserProfile(currentUser.id);
      if (profile) {
        setUserProfile({
          username: profile.username || profile.full_name || 'Player',
          xp: profile.xp || 0,
          level: profile.level || 1,
          division: profile.division || 5,
          avatar_url: profile.avatar_url || profile.profile_picture,
          stats: {
            matches_played: profile.matches_played || 0,
            wins: profile.wins || 0,
            draws: profile.draws || 0,
            losses: profile.losses || 0,
            mvps: profile.mvps || 0,
            goals: profile.goals || 0,
            assists: profile.assists || 0,
          },
        });
      }

      // Load user's team
      const { teams } = await db.getUserTeams(currentUser.id);
      if (teams && teams.length > 0) {
        setTeamName(teams[0]);
      } else {
        setTeamName(null);
      }

      // Load team division
      const { division } = await db.getUserTeamDivision(currentUser.id);
      setTeamDivision(division);

      PerformanceMonitor.endTimer('refreshUserData');
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  const refreshPublicGames = async () => {
    try {
      PerformanceMonitor.startTimer('refreshPublicGames');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load public games
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('is_public', true)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .limit(20);

      if (bookings) {
        const games: PublicGame[] = [];
        const joinedGameIds = new Set<string>();
        const createdGameIds = new Set<string>();

        for (const booking of bookings) {
          // Get member count
          const { data: members } = await supabase
            .from('game_members')
            .select('user_id')
            .eq('game_id', booking.id)
            .eq('status', 'joined');

          let memberCount = members?.length || 0;
          
          // Check if creator is in members
          if (booking.created_by) {
            const creatorInMembers = members?.some((member: any) => member.user_id === booking.created_by);
            if (!creatorInMembers) {
              memberCount += 1;
            }
            
            // Track if user created this game
            if (booking.created_by === user.id) {
              createdGameIds.add(booking.id);
            }
          }

          // Check if user joined this game
          const userInGame = members?.some((member: any) => member.user_id === user.id);
          if (userInGame) {
            joinedGameIds.add(booking.id);
          }

          // Get creator's name
          let creatorName = 'Unknown';
          if (booking.created_by) {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('full_name, username')
              .eq('id', booking.created_by)
              .single();
            
            creatorName = profile?.username || profile?.full_name || 'Unknown';
          }

          const maxPlayers = booking.max_players || 8;
          games.push({
            id: booking.id,
            pitch: booking.pitch_name,
            date: booking.date,
            time: booking.time,
            players: memberCount,
            maxPlayers: maxPlayers,
            createdBy: creatorName,
            status: (memberCount >= maxPlayers ? 'full' : 'open') as 'open' | 'full',
            price: booking.price,
            location: booking.pitch_location,
          });
        }

        setPublicGames(games);
        setUserJoinedGames(joinedGameIds);
        setUserCreatedGames(createdGameIds);
      }

      PerformanceMonitor.endTimer('refreshPublicGames');
    } catch (error) {
      console.error('Error refreshing public games:', error);
    }
  };

  const refreshTeamData = async () => {
    try {
      PerformanceMonitor.startTimer('refreshTeamData');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load user's team details
      const { data: teamMember } = await supabase
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

      if (teamMember && teamMember.teams) {
        const team = teamMember.teams as any;
        const { count: memberCount } = await supabase
          .from('team_members')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', team.id)
          .eq('status', 'active');

        setUserTeam({
          id: team.id,
          name: team.name,
          description: team.description,
          is_public: team.is_public,
          created_by: team.created_by,
          created_at: team.created_at,
          member_count: memberCount || 0,
          wins: team.wins || 0,
          losses: team.losses || 0,
          draws: team.draws || 0,
          division: team.division || 5
        });
      }

      // Load public teams
      const { data: teams } = await supabase
        .from('teams')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (teams) {
        const teamsWithMemberCount = await Promise.all(
          teams.map(async (team: any) => {
            const { count } = await supabase
              .from('team_members')
              .select('*', { count: 'exact', head: true })
              .eq('team_id', team.id)
              .eq('status', 'active');

            return {
              id: team.id,
              name: team.name,
              description: team.description,
              member_count: count || 0,
              max_members: team.max_members || 11,
              created_at: team.created_at,
              is_public: team.is_public,
            };
          })
        );

        setPublicTeams(teamsWithMemberCount);
      }

      PerformanceMonitor.endTimer('refreshTeamData');
    } catch (error) {
      console.error('Error refreshing team data:', error);
    }
  };

  const refreshHighlights = async () => {
    try {
      PerformanceMonitor.startTimer('refreshHighlights');
      
      // Load highlights
      const { data: highlights } = await supabase
        .from('highlights')
        .select('*')
        .order('priority', { ascending: false })
        .order('game_date', { ascending: false })
        .limit(15);

      if (highlights && highlights.length > 0) {
        // Load user profiles and teams separately
        const userIds = [...new Set(highlights.map((h: any) => h.user_id).filter(Boolean))];
        const teamIds = [...new Set(highlights.map((h: any) => h.team_id).filter(Boolean))];
        
        const [userProfilesResult, teamsResult] = await Promise.all([
          userIds.length > 0 ? supabase
            .from('user_profiles')
            .select('id, username, full_name, avatar_url')
            .in('id', userIds) : Promise.resolve({ data: [] }),
          teamIds.length > 0 ? supabase
            .from('teams')
            .select('id, name, logo_url')
            .in('id', teamIds) : Promise.resolve({ data: [] })
        ]);
        
        const profileMap = (userProfilesResult.data || []).reduce((acc: any, profile: any) => {
          acc[profile.id] = profile;
          return acc;
        }, {});
        
        const teamMap = (teamsResult.data || []).reduce((acc: any, team: any) => {
          acc[team.id] = team;
          return acc;
        }, {});
        
        // Attach user and team data
        highlights.forEach((highlight: any) => {
          highlight.user_profiles = profileMap[highlight.user_id] || null;
          highlight.teams = teamMap[highlight.team_id] || null;
        });

        setHighlights(highlights);
      }

      PerformanceMonitor.endTimer('refreshHighlights');
    } catch (error) {
      console.error('Error refreshing highlights:', error);
    }
  };

  const refreshLeaderboards = async () => {
    try {
      PerformanceMonitor.startTimer('refreshLeaderboards');
      
      // Load top players and teams in parallel
      const [playersResult, teamsResult] = await Promise.all([
        db.getTopPlayers(10),
        db.getTopTeams(10)
      ]);

      setTopPlayers(playersResult.data || []);
      setTopTeams(teamsResult.data || []);

      PerformanceMonitor.endTimer('refreshLeaderboards');
    } catch (error) {
      console.error('Error refreshing leaderboards:', error);
    }
  };

  const refreshAllData = async () => {
    setIsInitialLoading(true);
    try {
      await Promise.all([
        refreshUserData(),
        refreshPublicGames(),
        refreshTeamData(),
        refreshHighlights(),
        refreshLeaderboards(),
      ]);
    } finally {
      setIsInitialLoading(false);
    }
  };

  const contextValue: AppDataContextType = {
    // Loading states
    isInitialLoading,
    isDataReady,
    
    // User data
    userProfile,
    teamName,
    teamDivision,
    userTeam,
    
    // Play screen data
    publicGames,
    userJoinedGames,
    userCreatedGames,
    
    // Team screen data
    publicTeams,
    
    // Highlights data
    highlights,
    
    // Leaderboards data
    topPlayers,
    topTeams,
    
    // Refresh functions
    refreshUserData,
    refreshPublicGames,
    refreshTeamData,
    refreshHighlights,
    refreshLeaderboards,
    refreshAllData,
  };

  return (
    <AppDataContext.Provider value={contextValue}>
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = (): AppDataContextType => {
  const context = useContext(AppDataContext);
  if (context === undefined) {
    console.error('useAppData must be used within an AppDataProvider');
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
};
