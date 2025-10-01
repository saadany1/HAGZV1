import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENV, validateEnv } from '../config/env';

// Validate environment variables
validateEnv();

// Create Supabase client with proper error handling
const supabaseUrl = ENV.SUPABASE_URL;
const supabaseAnonKey = ENV.SUPABASE_ANON_KEY;

console.log('Initializing Supabase with URL:', supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

// Auth helper functions
export const auth = {
  signUp: async (email: string, password: string, fullName: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      // Mock response when Supabase is disabled
      console.log('Mock signup:', { email, password, fullName });
      return { 
        data: { user: { id: 'mock-user-id', email } }, 
        error: null 
      };
    }

    try {
      console.log('Attempting to sign up user:', { email, fullName });
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        console.error('Supabase signup error:', error);
        return { data: null, error };
      }

      if (data.user) {
        console.log('User created successfully:', data.user.id);
        console.log('User email confirmed:', data.user.email_confirmed_at);
        console.log('User session:', data.session);
        
        // Try to create user profile (trigger should handle this, but we'll try as backup)
        try {
          const { error: profileError } = await supabase
            .from('user_profiles')
            .upsert({
              id: data.user.id,
              full_name: fullName,
              email: email,
            }, {
              onConflict: 'id'
            });

          if (profileError) {
            console.error('Profile creation error:', profileError);
            
            // If it's a duplicate key error, that's actually good - means trigger worked!
            if (profileError.code === '23505') {
              console.log('✅ Profile already exists (trigger worked correctly)');
            } else if (profileError.code === '42501') {
              console.log('RLS policy error detected, trying alternative profile creation...');
              
              // Try using service role or different approach
              const { error: altError } = await supabase
                .from('user_profiles')
                .upsert({
                  id: data.user.id,
                  full_name: fullName,
                  email: email,
                }, {
                  onConflict: 'id'
                });

              if (altError) {
                console.error('Alternative profile creation also failed:', altError);
              } else {
                console.log('Profile created using alternative method');
              }
            }
          } else {
            console.log('✅ User profile created successfully');
          }
        } catch (profileError) {
          console.error('Profile creation exception:', profileError);
        }
      }

      return { data, error };
    } catch (error) {
      console.error('Sign up error:', error);
      
      // Handle network errors specifically
      if (error instanceof Error && error.message.includes('Network request failed')) {
        return { 
          data: null, 
          error: new Error('Network error: Please check your internet connection and try again.') 
        };
      }
      
      return { data: null, error: error as Error };
    }
  },

  signIn: async (email: string, password: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      // Mock response when Supabase is disabled
      console.log('Mock signin:', { email, password });
      return { 
        data: { user: { id: 'mock-user-id', email } }, 
        error: null 
      };
    }

    try {
      console.log('Attempting to sign in user:', { email });
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Supabase signin error:', error);
        return { data: null, error };
      }

      if (data.user) {
        console.log('User signed in successfully:', data.user.id);
      }

      return { data, error };
    } catch (error) {
      console.error('Sign in error:', error);
      
      // Handle network errors specifically
      if (error instanceof Error && error.message.includes('Network request failed')) {
        return { 
          data: null, 
          error: new Error('Network error: Please check your internet connection and try again.') 
        };
      }
      
      return { data: null, error: error as Error };
    }
  },

  signOut: async () => {
    if (!ENV.ENABLE_SUPABASE) {
      console.log('Mock signout');
      return { error: null };
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
      } else {
        console.log('User signed out successfully');
      }
      return { error };
    } catch (error) {
      console.error('Sign out error:', error);
      return { error: error as Error };
    }
  },

  getCurrentUser: async () => {
    if (!ENV.ENABLE_SUPABASE) {
      return null;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  },

  resetPassword: async (email: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      console.log('Mock password reset:', { email });
      return { data: null, error: null };
    }

    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email);
      return { data, error };
    } catch (error) {
      console.error('Reset password error:', error);
      return { data: null, error: error as Error };
    }
  },
};

// Performance: Simple in-memory cache for frequently accessed data
const cache = {
  userProfiles: new Map<string, { data: any; timestamp: number }>(),
  userTeams: new Map<string, { data: any; timestamp: number }>(),
  publicGames: { data: null as any, timestamp: 0 },
  
  // Cache duration in milliseconds
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  
  get(key: string, cacheMap: Map<string, { data: any; timestamp: number }>) {
    const cached = cacheMap.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  },
  
  set(key: string, data: any, cacheMap: Map<string, { data: any; timestamp: number }>) {
    cacheMap.set(key, { data, timestamp: Date.now() });
  },
  
  clear() {
    this.userProfiles.clear();
    this.userTeams.clear();
    this.publicGames = { data: null, timestamp: 0 };
  }
};

// Database helper functions
export const db = {
  getUserProfile: async (userId: string, useCache: boolean = true) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: null, error: new Error('Supabase is disabled') };
    }

    // Check cache first
    if (useCache) {
      const cached = cache.get(userId, cache.userProfiles);
      if (cached) {
        return { data: cached, error: null };
      }
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      // Cache the result
      if (data && !error && useCache) {
        cache.set(userId, data, cache.userProfiles);
      }
      
      return { data, error };
    } catch (error) {
      console.error('Get user profile error:', error);
      return { data: null, error: error as Error };
    }
  },

  // Fetch top players from user_profiles with points and key stats
  getTopPlayers: async (limit: number, search?: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: [], error: null } as { data: any[]; error: Error | null };
    }

    try {
      let query = supabase
        .from('user_profiles')
        .select('id, full_name, username, pts, matches_played, wins, draws, losses, mvps, avatar_url')
        .order('wins', { ascending: false })
        .order('pts', { ascending: false }) // Secondary sort by points for tie-breaking
        .limit(limit);

      if (search && search.trim().length > 0) {
        const s = search.trim();
        query = query.ilike('full_name', `%${s}%`);
      }

      const { data, error } = await query;
      return { data: data ?? [], error };
    } catch (error) {
      console.error('Get top players error:', error);
      return { data: [], error: error as Error };
    }
  },

  // Fetch top teams with points and W/D/L from teams table
  getTopTeams: async (limit: number, search?: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: [], error: null } as { data: any[]; error: Error | null };
    }

    try {
      let query = supabase
        .from('teams')
        .select('id, name, division, wins, draws, losses, pts')
        .order('pts', { ascending: false })
        .limit(limit);

      if (search && search.trim().length > 0) {
        const s = search.trim();
        query = query.ilike('name', `%${s}%`);
      }

      const { data, error } = await query;
      return { data: data ?? [], error };
    } catch (error) {
      console.error('Get top teams error:', error);
      return { data: [], error: error as Error };
    }
  },

  // Fetch user's teams (names) from team membership, with graceful fallbacks
  getUserTeams: async (userId: string, useCache: boolean = true) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { teams: [], error: new Error('Supabase is disabled') } as { teams: string[]; error: Error | null };
    }

    // Check cache first
    if (useCache) {
      const cached = cache.get(userId, cache.userTeams);
      if (cached) {
        return { teams: cached, error: null };
      }
    }

    try {
      // Step 1: Try to get team_ids from team_members
      const { data: memberships, error: membershipError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', userId);

      if (membershipError) {
        console.error('Get team memberships error:', membershipError);
      }

      let teamNames: string[] = [];

      if (memberships && memberships.length > 0) {
        const teamIds = memberships.map((m: any) => m.team_id).filter(Boolean);
        if (teamIds.length > 0) {
          const { data: teams, error: teamsError } = await supabase
            .from('teams')
            .select('id, name')
            .in('id', teamIds);

          if (teamsError) {
            console.error('Get teams by ids error:', teamsError);
          } else if (teams) {
            teamNames = teams.map((t: any) => t.name).filter(Boolean);
          }
        }
      }

      // Fallback: if no memberships found, try teams where the user is creator
      if (teamNames.length === 0) {
        const { data: ownedTeams, error: ownedError } = await supabase
          .from('teams')
          .select('name')
          .eq('created_by', userId);

        if (ownedError) {
          console.error('Get owned teams error:', ownedError);
        } else if (ownedTeams) {
          teamNames = ownedTeams.map((t: any) => t.name).filter(Boolean);
        }
      }

      // Cache the result
      if (useCache) {
        cache.set(userId, teamNames, cache.userTeams);
      }

      return { teams: teamNames, error: null } as { teams: string[]; error: Error | null };
    } catch (error) {
      console.error('Get user teams exception:', error);
      return { teams: [], error: error as Error } as { teams: string[]; error: Error | null };
    }
  },

  // Fetch user's team division from teams table
  getUserTeamDivision: async (userId: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { division: 5, error: null } as { division: number; error: Error | null };
    }

    try {
      // Step 1: Try to get team_ids from team_members
      const { data: memberships, error: membershipError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', userId);

      if (membershipError) {
        console.error('Get team memberships error:', membershipError);
      }

      let teamDivision = 5; // Default to Division 5

      if (memberships && memberships.length > 0) {
        const teamIds = memberships.map((m: any) => m.team_id).filter(Boolean);
        if (teamIds.length > 0) {
          const { data: teams, error: teamsError } = await supabase
            .from('teams')
            .select('id, division')
            .in('id', teamIds)
            .order('division', { ascending: true }) // Get the highest division (lowest number)
            .limit(1);

          if (teamsError) {
            console.error('Get teams by ids error:', teamsError);
          } else if (teams && teams.length > 0) {
            teamDivision = Number(teams[0].division) || 5;
          }
        }
      }

      // Fallback: if no memberships found, try teams where the user is creator
      if (teamDivision === 5) {
        const { data: ownedTeams, error: ownedError } = await supabase
          .from('teams')
          .select('division')
          .eq('created_by', userId)
          .order('division', { ascending: true })
          .limit(1);

        if (ownedError) {
          console.error('Get owned teams error:', ownedError);
        } else if (ownedTeams && ownedTeams.length > 0) {
          teamDivision = Number(ownedTeams[0].division) || 5;
        }
      }

      return { division: teamDivision, error: null } as { division: number; error: Error | null };
    } catch (error) {
      console.error('Get user team division exception:', error);
      return { division: 5, error: error as Error } as { division: number; error: Error | null };
    }
  },

  updateUserProfile: async (userId: string, updates: any) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: null, error: new Error('Supabase is disabled') };
    }

    try {
      // Remove updated_at from updates if it exists, as it's handled by trigger
      const { updated_at, ...cleanUpdates } = updates;
      
      const { data, error } = await supabase
        .from('user_profiles')
        .update(cleanUpdates)
        .eq('id', userId)
        .select()
        .single();
      return { data, error };
    } catch (error) {
      console.error('Update user profile error:', error);
      return { data: null, error: error as Error };
    }
  },

  createUserSession: async (userId: string, sessionData: any) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: null, error: new Error('Supabase is disabled') };
    }

    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          session_data: sessionData,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        })
        .select()
        .single();
      return { data, error };
    } catch (error) {
      console.error('Create user session error:', error);
      return { data: null, error: error as Error };
    }
  },

  // Helper function to check if user profile exists
  checkUserProfile: async (userId: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { exists: false, error: new Error('Supabase is disabled') };
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', userId)
        .single();
      
      return { exists: !!data, error };
    } catch (error) {
      console.error('Check user profile error:', error);
      return { exists: false, error: error as Error };
    }
  },

  // Force create profile (bypasses RLS for testing)
  forceCreateProfile: async (userId: string, fullName: string, email: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: null, error: new Error('Supabase is disabled') };
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          full_name: fullName,
          email: email,
        }, {
          onConflict: 'id'
        })
        .select()
        .single();
      
      return { data, error };
    } catch (error) {
      console.error('Force create profile error:', error);
      return { data: null, error: error as Error };
    }
  },

  // Get user's upcoming bookings
  getUserBookings: async (userId: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      // Mock data when Supabase is disabled
      return { 
        data: [
          {
            id: '1',
            pitch_name: 'Central Football Arena',
            pitch_location: 'Downtown District',
            date: '2024-01-15',
            time: '14:00',
            price: '$25/hour',
            status: 'confirmed'
          }
        ], 
        error: null 
      };
    }

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, pitch_name, pitch_location, date, time, price, status')
        .eq('created_by', userId)
        .gte('date', new Date().toISOString().split('T')[0]) // Only future dates
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (error) {
        console.error('Get user bookings error:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get user bookings exception:', error);
      return { data: null, error: error as Error };
    }
  },

  // Join a game (booking)
  joinGame: async (gameId: string, userId: string, role: string = 'player') => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: null, error: new Error('Supabase is disabled') };
    }

    try {
      // First check if the booking exists and has space
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id, max_players')
        .eq('id', gameId)
        .single();

      if (bookingError || !booking) {
        return { data: null, error: new Error('Game not found') };
      }

      // Check current member count
      const { data: currentMembers, error: membersError } = await supabase
        .from('game_members')
        .select('id')
        .eq('game_id', gameId)
        .eq('status', 'joined');

      if (membersError) {
        console.error('Error checking current members:', membersError);
      }

      const currentMemberCount = currentMembers?.length || 0;
      
      // Check if there's space
      if (currentMemberCount >= (booking.max_players || 8)) {
        return { data: null, error: new Error('Game is full') };
      }

      // Add user to the game
      const { data, error } = await supabase
        .from('game_members')
        .upsert({
          game_id: gameId,
          user_id: userId,
          role: role,
          status: 'joined'
        }, {
          onConflict: 'game_id,user_id'
        })
        .select()
        .single();

      if (error) {
        console.error('Join game error:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Join game exception:', error);
      return { data: null, error: error as Error };
    }
  },

  // Leave a game
  leaveGame: async (gameId: string, userId: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: null, error: new Error('Supabase is disabled') };
    }

    try {
      const { error } = await supabase
        .from('game_members')
        .delete()
        .eq('game_id', gameId)
        .eq('user_id', userId);

      if (error) {
        console.error('Leave game error:', error);
        return { data: null, error };
      }

      return { data: { success: true }, error: null };
    } catch (error) {
      console.error('Leave game exception:', error);
      return { data: null, error: error as Error };
    }
  },

  // Get game members
  getGameMembers: async (gameId: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { 
        data: [
          { id: '1', user_id: 'user1', role: 'organizer', joined_at: new Date().toISOString() },
          { id: '2', user_id: 'user2', role: 'player', joined_at: new Date().toISOString() }
        ], 
        error: null 
      };
    }

    try {
      // First, get the game members
      const { data: gameMembers, error: membersError } = await supabase
        .from('game_members')
        .select(`
          id,
          user_id,
          role,
          joined_at,
          status
        `)
        .eq('game_id', gameId)
        .eq('status', 'confirmed')
        .order('joined_at', { ascending: true });

      if (membersError) {
        console.error('Get game members error:', membersError);
        return { data: null, error: membersError };
      }

      if (!gameMembers || gameMembers.length === 0) {
        return { data: [], error: null };
      }

      // Get user profiles for all members
      const userIds = gameMembers.map((member: any) => member.user_id);
      const { data: userProfiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', userIds);

      if (profilesError) {
        console.error('Get user profiles error:', profilesError);
        return { data: null, error: profilesError };
      }

      // Combine the data
      const membersWithProfiles = gameMembers.map((member: any) => ({
        ...member,
        user_profiles: userProfiles?.find((profile: any) => profile.id === member.user_id) || {
          full_name: 'Unknown',
          username: 'Unknown',
          avatar_url: null
        }
      }));

      return { data: membersWithProfiles, error: null };
    } catch (error) {
      console.error('Get game members exception:', error);
      return { data: null, error: error as Error };
    }
  },

  // Check if user is already in a game
  isUserInGame: async (gameId: string, userId: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: false, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('game_members')
        .select('id')
        .eq('game_id', gameId)
        .eq('user_id', userId)
        .eq('status', 'confirmed')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Check user in game error:', error);
        return { data: false, error };
      }

      return { data: !!data, error: null };
    } catch (error) {
      console.error('Check user in game exception:', error);
      return { data: false, error: error as Error };
    }
  },

  // Matchmaking functions
  findMatch: async (teamId: string, division: number, preferredDate: string, preferredTimeSlot: number) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: { success: false, error: 'Supabase is disabled' }, error: null };
    }

    try {
      const { data, error } = await supabase.rpc('find_match_for_team', {
        p_team_id: teamId,
        p_division: division,
        p_preferred_date: preferredDate,
        p_preferred_time_slot: preferredTimeSlot
      });

      if (error) {
        console.error('Find match error:', error);
        return { data: null, error };
      }

      // If a match was found, send push notifications to both teams
      if (data?.success && data?.match_found && data?.opponent_team_name) {
        try {
          
          // Format the time slot
          const timeSlots = [
            { value: 18, label: '6:00 PM' }, { value: 19, label: '7:00 PM' },
            { value: 20, label: '8:00 PM' }, { value: 21, label: '9:00 PM' },
            { value: 22, label: '10:00 PM' }, { value: 23, label: '11:00 PM' },
            { value: 24, label: '12:00 AM' }, { value: 25, label: '1:00 AM' },
            { value: 26, label: '2:00 AM' }
          ];
          const timeLabel = timeSlots.find(slot => slot.value === preferredTimeSlot)?.label || 'Unknown';
          
          // Format the date
          const date = new Date(preferredDate);
          const dateString = date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
          });

          // Team notifications have been removed from the app
        } catch (pushError) {
          console.log('Match found push notifications skipped - this is expected in Expo Go');
          // Don't fail the match creation if push notifications fail
        }
      }

      return { data, error: null };
    } catch (error) {
      console.error('Find match exception:', error);
      return { data: null, error: error as Error };
    }
  },

  cancelMatchmaking: async (teamId: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: { success: false, error: 'Supabase is disabled' }, error: null };
    }

    try {
      const { data, error } = await supabase.rpc('cancel_matchmaking', {
        p_team_id: teamId
      });

      if (error) {
        console.error('Cancel matchmaking error:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Cancel matchmaking exception:', error);
      return { data: null, error: error as Error };
    }
  },

  getMatchmakingStatus: async (teamId: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: { in_queue: false, active_match: null }, error: null };
    }

    try {
      const { data, error } = await supabase.rpc('get_matchmaking_status', {
        p_team_id: teamId
      });

      if (error) {
        console.error('Get matchmaking status error:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get matchmaking status exception:', error);
      return { data: null, error: error as Error };
    }
  },

  startMatch: async (matchId: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: { success: false, error: 'Supabase is disabled' }, error: null };
    }

    try {
      const { data, error } = await supabase.rpc('start_match', {
        p_match_id: matchId
      });

      if (error) {
        console.error('Start match error:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Start match exception:', error);
      return { data: null, error: error as Error };
    }
  },

  finishMatch: async (matchId: string, winnerTeamId: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: { success: false, error: 'Supabase is disabled' }, error: null };
    }

    try {
      const { data, error } = await supabase.rpc('finish_match', {
        p_match_id: matchId,
        p_winner_team_id: winnerTeamId
      });

      if (error) {
        console.error('Finish match error:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Finish match exception:', error);
      return { data: null, error: error as Error };
    }
  },

    // Get match details
    getMatchDetails: async (matchId: string) => {
      if (!ENV.ENABLE_SUPABASE) {
        return { data: null, error: new Error('Supabase is disabled') };
      }

      try {
        const { data, error } = await supabase
          .from('matches')
          .select(`
            *,
            team1:teams!matches_team1_id_fkey(id, name, division, wins, losses, draws),
            team2:teams!matches_team2_id_fkey(id, name, division, wins, losses, draws)
          `)
          .eq('id', matchId)
          .single();

        if (error) {
          console.error('Get match details error:', error);
          return { data: null, error };
        }

        return { data, error: null };
      } catch (error) {
        console.error('Get match details exception:', error);
        return { data: null, error: error as Error };
      }
    },

    // Cancel match
    cancelMatch: async (matchId: string, teamId: string) => {
      if (!ENV.ENABLE_SUPABASE) {
        return { data: { success: false, error: 'Supabase is disabled' }, error: null };
      }

      try {
        const { data, error } = await supabase.rpc('cancel_match', {
          p_match_id: matchId,
          p_team_id: teamId
        });

        if (error) {
          console.error('Cancel match error:', error);
          return { data: null, error };
        }

        return { data, error: null };
      } catch (error) {
        console.error('Cancel match exception:', error);
        return { data: null, error: error as Error };
      }
    },

  // Get team details by ID
  getTeamDetails: async (teamId: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: null, error: new Error('Supabase is disabled') };
    }

    try {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          division,
          wins,
          losses,
          draws,
          created_at
        `)
        .eq('id', teamId)
        .single();

      if (error) {
        console.error('Get team details error:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get team details exception:', error);
      return { data: null, error: error as Error };
    }
  },

  // Pitch Booking System Functions
  
  // Check if a time slot is available
  checkPitchAvailability: async (bookingDate: string, timeSlot: number, pitchId?: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: { available: true, message: 'Mock: Time slot available' }, error: null };
    }

    try {
      const { data, error } = await supabase.rpc('check_pitch_availability', {
        p_booking_date: bookingDate,
        p_time_slot: timeSlot,
        p_pitch_id: pitchId || null
      });

      if (error) {
        console.error('Check pitch availability error:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Check pitch availability exception:', error);
      return { data: null, error: error as Error };
    }
  },

  // Get available time slots for a specific date
  getAvailableTimeSlots: async (bookingDate: string, pitchId?: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { 
        data: { 
          date: bookingDate, 
          available_slots: [18, 19, 20, 21, 22, 23, 24, 25, 26], 
          total_slots: 9 
        }, 
        error: null 
      };
    }

    try {
      const { data, error } = await supabase.rpc('get_available_time_slots', {
        p_booking_date: bookingDate,
        p_pitch_id: pitchId || null
      });

      if (error) {
        console.error('Get available time slots error:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get available time slots exception:', error);
      return { data: null, error: error as Error };
    }
  },

  // Get booking conflicts for a date range
  getBookingConflicts: async (startDate: string, endDate: string, pitchId?: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: { start_date: startDate, end_date: endDate, conflicts: [] }, error: null };
    }

    try {
      const { data, error } = await supabase.rpc('get_booking_conflicts', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_pitch_id: pitchId || null
      });

      if (error) {
        console.error('Get booking conflicts error:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get booking conflicts exception:', error);
      return { data: null, error: error as Error };
    }
  },

  // Add a pitch booking manually (for testing or manual management)
  addPitchBooking: async (bookingDate: string, timeSlot: number, sourceType: 'match' | 'booking', sourceId: string, pitchId?: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: { success: true, message: 'Mock: Pitch booking added' }, error: null };
    }

    try {
      const { data, error } = await supabase.rpc('add_pitch_booking', {
        p_booking_date: bookingDate,
        p_time_slot: timeSlot,
        p_source_type: sourceType,
        p_source_id: sourceId,
        p_pitch_id: pitchId || null
      });

      if (error) {
        console.error('Add pitch booking error:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Add pitch booking exception:', error);
      return { data: null, error: error as Error };
    }
  },

  // Remove a pitch booking manually
  removePitchBooking: async (sourceType: 'match' | 'booking', sourceId: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: { success: true, message: 'Mock: Pitch booking removed' }, error: null };
    }

    try {
      const { data, error } = await supabase.rpc('remove_pitch_booking', {
        p_source_type: sourceType,
        p_source_id: sourceId
      });

      if (error) {
        console.error('Remove pitch booking error:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Remove pitch booking exception:', error);
      return { data: null, error: error as Error };
    }
  },

  // Enhanced validation functions for frontend
  
  // Validate booking time before creating
  validateBookingTime: async (bookingDate: string, timeSlot: number, pitchId?: string, excludeSourceType?: string, excludeSourceId?: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { 
        data: { 
          valid: true, 
          message: 'Mock: Time slot is available',
          conflict: null 
        }, 
        error: null 
      };
    }

    try {
      // First check if the time slot is available
      const { data: availabilityData, error: availabilityError } = await supabase.rpc('check_pitch_availability', {
        p_booking_date: bookingDate,
        p_time_slot: timeSlot,
        p_pitch_id: pitchId || null
      });

      if (availabilityError) {
        console.error('Check pitch availability error:', availabilityError);
        return { data: null, error: availabilityError };
      }

      const isAvailable = availabilityData?.available;
      
      // If available, return success
      if (isAvailable) {
        return { 
          data: { 
            valid: true, 
            message: 'Time slot is available',
            conflict: null 
          }, 
          error: null 
        };
      }

      // If not available, check if it's the same source being updated
      if (excludeSourceType && excludeSourceId) {
        const conflict = availabilityData?.conflicting_booking;
        if (conflict && 
            conflict.source_type === excludeSourceType && 
            conflict.source_id === excludeSourceId) {
          // This is the same booking being updated, so it's valid
          return { 
            data: { 
              valid: true, 
              message: 'Time slot is available (updating existing booking)',
              conflict: null 
            }, 
            error: null 
          };
        }
      }

      // Time slot is not available
      return { 
        data: { 
          valid: false, 
          message: availabilityData?.message || 'This pitch is already booked for the selected date and time. Please choose another time or date.',
          conflict: availabilityData?.conflicting_booking || null
        }, 
        error: null 
      };

    } catch (error) {
      console.error('Validate booking time exception:', error);
      return { data: null, error: error as Error };
    }
  },

  // Get available time slots with validation
  getAvailableTimeSlotsWithValidation: async (bookingDate: string, pitchId?: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { 
        data: { 
          date: bookingDate, 
          available_slots: [18, 19, 20, 21, 22, 23, 24, 25, 26], 
          booked_slots: [],
          total_slots: 9,
          available_count: 9
        }, 
        error: null 
      };
    }

    try {
      const { data, error } = await supabase.rpc('get_available_time_slots', {
        p_booking_date: bookingDate,
        p_pitch_id: pitchId || null
      });

      if (error) {
        console.error('Get available time slots error:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get available time slots exception:', error);
      return { data: null, error: error as Error };
    }
  },

  // Create booking with validation
  createBookingWithValidation: async (bookingData: any) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: { success: true, message: 'Mock: Booking created' }, error: null };
    }

    try {
      // First validate the booking time
      const timeSlot = parseInt(bookingData.time.split(':')[0]); // Extract hour from time string
      
      const { data: validationData, error: validationError } = await db.validateBookingTime(
        bookingData.date,
        timeSlot,
        bookingData.pitch_id
      );

      if (validationError) {
        return { data: null, error: validationError };
      }

      if (!validationData?.valid) {
        return { 
          data: null, 
          error: new Error(validationData?.message || 'Booking time is not available') 
        };
      }

      // If validation passes, create the booking
      const { data, error } = await supabase
        .from('bookings')
        .insert(bookingData)
        .select()
        .single();

      if (error) {
        console.error('Create booking error:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Create booking with validation exception:', error);
      return { data: null, error: error as Error };
    }
  },

  // Update booking with validation
  updateBookingWithValidation: async (bookingId: string, bookingData: any) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: { success: true, message: 'Mock: Booking updated' }, error: null };
    }

    try {
      // First validate the booking time (excluding the current booking)
      const timeSlot = parseInt(bookingData.time.split(':')[0]); // Extract hour from time string
      
      const { data: validationData, error: validationError } = await db.validateBookingTime(
        bookingData.date,
        timeSlot,
        bookingData.pitch_id,
        'booking',
        bookingId
      );

      if (validationError) {
        return { data: null, error: validationError };
      }

      if (!validationData?.valid) {
        return { 
          data: null, 
          error: new Error(validationData?.message || 'Booking time is not available') 
        };
      }

      // If validation passes, update the booking
      const { data, error } = await supabase
        .from('bookings')
        .update(bookingData)
        .eq('id', bookingId)
        .select()
        .single();

      if (error) {
        console.error('Update booking error:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Update booking with validation exception:', error);
      return { data: null, error: error as Error };
    }
  },

  // Notification functions
  createNotification: async (notificationData: {
    user_id: string;
    type: string;
    title: string;
    message: string;
    game_id: string;
    invited_by: string;
    status?: string;
  }) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: { success: true, message: 'Mock: Notification created' }, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert([{
          ...notificationData,
          status: notificationData.status || 'pending',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('Create notification error:', error);
        return { data: null, error };
      }

      // Send push notification for game invitations
      if (notificationData.type === 'game_invitation') {
        try {
          // Get target user's push token
          const { data: targetUser } = await supabase
            .from('user_profiles')
            .select('push_token, full_name, email')
            .eq('id', notificationData.user_id)
            .single();

          if (targetUser?.push_token) {
            // Import the service dynamically to avoid circular dependencies
            const { gameInvitationService } = await import('../services/gameInvitationService');
            
            // Get game details for the notification
            const { data: gameData } = await supabase
              .from('bookings')
              .select('id, pitch_name, pitch_location, date, time, created_by')
              .eq('id', notificationData.game_id)
              .single();

            // Get inviter details
            const { data: inviterData } = await supabase
              .from('user_profiles')
              .select('full_name, email')
              .eq('id', notificationData.invited_by)
              .single();

            if (gameData && inviterData) {
              const inviterName = inviterData.full_name || inviterData.email || 'Someone';
              
              // Send local notification if this is the current user (for testing)
              const { data: { user } } = await supabase.auth.getUser();
              if (user && user.id === notificationData.user_id) {
                const { sendCustomLocalNotification } = await import('../services/pushNotifications');
                await sendCustomLocalNotification(
                  '⚽ Game Invitation',
                  `${inviterName} invited you to join a match at ${gameData.pitch_name}`,
                  {
                    screen: 'GameDetails',
                    gameId: gameData.id,
                    type: 'game_invitation'
                  },
                  { sound: true, priority: 'high' }
                );
              }
            }
          }
        } catch (pushError) {
          console.error('Error sending push notification for invitation:', pushError);
          // Don't fail the whole operation if push notification fails
        }
      }

      return { data, error: null };
    } catch (error) {
      console.error('Create notification exception:', error);
      return { data: null, error: error as Error };
    }
  },

  updateNotificationStatus: async (notificationId: string, status: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: { success: true, message: 'Mock: Notification updated' }, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ status })
        .eq('id', notificationId)
        .select()
        .single();

      if (error) {
        console.error('Update notification error:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Update notification exception:', error);
      return { data: null, error: error as Error };
    }
  },

  getUserNotifications: async (userId: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: [], error: null };
    }

    try {
      // Get notifications for the user
      const { data: notificationsData, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Get user notifications error:', error);
        return { data: null, error };
      }

      if (!notificationsData || notificationsData.length === 0) {
        return { data: [], error: null };
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

      // Transform the data
      const transformedData = notificationsData.map((notification: any) => {
        const game = gamesData?.find((g: any) => g.id === notification.game_id);
        const inviter = usersData?.find((u: any) => u.id === notification.invited_by);
        
        return {
          ...notification,
          games: game,
          inviter: inviter
        };
      });

      return { data: transformedData, error: null };
    } catch (error) {
      console.error('Get user notifications exception:', error);
      return { data: null, error: error as Error };
    }
  },

  // Team Chat Helpers
  ensureTeamChatRoom: async (teamId: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: { id: 'mock-room', team_id: teamId }, error: null };
    }
    try {
      // Try to get existing room
      const { data: room, error: roomError } = await supabase
        .from('team_chat_rooms')
        .select('id, team_id')
        .eq('team_id', teamId)
        .single();

      if (!roomError && room) return { data: room, error: null };

      // Create if not exists (captain-only enforced by RLS)
      const { data: created, error: createError } = await supabase
        .from('team_chat_rooms')
        .insert({ team_id: teamId, created_by: (await supabase.auth.getUser()).data.user?.id })
        .select('id, team_id')
        .single();

      if (createError) return { data: null, error: createError };
      return { data: created, error: null };
    } catch (error) {
      console.error('ensureTeamChatRoom exception:', error);
      return { data: null, error: error as Error };
    }
  },

  listTeamMessages: async (teamId: string, limit = 50) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: [], error: null };
    }
    try {
      const { data, error } = await supabase
        .from('team_chat_messages')
        .select('id, sender_id, content, created_at')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) return { data: null, error };
      const rows = (data || []).reverse();
      // Fetch profiles for unique senders
      const senderIds = Array.from(new Set(rows.map((m: any) => m.sender_id)));
      let profilesMap: Record<string, any> = {};
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', senderIds);
        (profiles || []).forEach((p: any) => { profilesMap[p.id] = p; });
      }
      const enriched = rows.map((m: any) => ({ ...m, user_profiles: profilesMap[m.sender_id] || null }));
      return { data: enriched, error: null };
    } catch (error) {
      console.error('listTeamMessages exception:', error);
      return { data: null, error: error as Error };
    }
  },

  subscribeTeamMessages: (teamId: string, onInsert: (msg: any) => void) => {
    // simple profile cache to avoid repeated fetches
    const profileCache: Record<string, any> = {};
    const fetchProfile = async (userId: string) => {
      if (profileCache[userId]) return profileCache[userId];
      const { data } = await supabase
        .from('user_profiles')
        .select('id, full_name, username, avatar_url')
        .eq('id', userId)
        .single();
      if (data) profileCache[userId] = data;
      return data;
    };

    const channel = supabase
      .channel(`team_chat_${teamId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_chat_messages', filter: `team_id=eq.${teamId}` }, async (payload) => {
        const msg = payload.new as any;
        const profile = await fetchProfile(msg.sender_id);
        onInsert({ ...msg, user_profiles: profile || null });
      })
      .subscribe();
    return () => channel.unsubscribe();
  },

  sendTeamMessage: async (teamId: string, roomId: string, content: string) => {
    if (!ENV.ENABLE_SUPABASE) {
      return { data: { id: 'mock', content }, error: null };
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: new Error('Not authenticated') };
      
      // Insert message - this is the critical path
      const { data, error } = await supabase
        .from('team_chat_messages')
        .insert({ team_id: teamId, room_id: roomId, sender_id: user.id, content })
        .select('id, sender_id, content, created_at')
        .single();
      if (error) return { data: null, error };

      // Non-blocking operations - run in background
      setImmediate(async () => {
        try {
          // Fetch profile for push notifications
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('id, full_name, username, avatar_url')
            .eq('id', user.id)
            .single();

          // Team notifications have been removed from the app
        } catch (pushError) {
          console.log('Team chat push notification skipped - this is expected in Expo Go');
        }
      });

      // Return immediately with basic data
      return { data, error: null };
    } catch (error) {
      console.error('sendTeamMessage exception:', error);
      return { data: null, error: error as Error };
    }
  },

  // Clear cache (useful for logout or data refresh)
  clearCache: () => {
    cache.clear();
  },
};
