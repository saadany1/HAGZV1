import React, { useEffect, useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Easing, View, ActivityIndicator, Text, Animated } from 'react-native';

import LandingPage from '../screens/LandingPage';
import MiniOnboardingScreen from '../screens/MiniOnboardingScreen';
import AuthPromptScreen from '../screens/AuthPromptScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import MainAppScreen from '../screens/MainAppScreen';
import GameDetailsScreen from '../screens/GameDetailsScreen';
import BookingDetailsScreen from '../screens/BookingDetailsScreen';
import ChatScreen from '../screens/ChatScreen';

// Placeholder screens for tabs
import PlayScreen from '../screens/PlayScreen';
import MyTeamScreen from '../screens/MyTeamScreen';
import LeaderboardsScreen from '../screens/LeaderboardsScreen';
import MoreScreen from '../screens/MoreScreen';
import SplashScreen from '../components/SplashScreen';
import AppLoader from '../components/AppLoader';
import { supabase, db } from '../lib/supabase';
import { AppDataProvider } from '../context/AppDataContext';

// More screen subscreens
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';
import TermsPrivacyScreen from '../screens/TermsPrivacyScreen';
import TermsScreen from '../screens/TermsScreen';
import AboutScreen from '../screens/AboutScreen';
import MatchmakingScreen from '../screens/MatchmakingScreen';
import HighlightsScreen from '../screens/HighlightsScreen';
import TournamentsScreen from '../screens/TournamentsScreen';
import MatchDetailScreen from '../screens/MatchDetailScreen';
import TeamSettingsScreen from '../screens/TeamSettingsScreen';
import CreateTeamScreen from '../screens/CreateTeamScreen';
import TeamChatScreen from '../screens/TeamChatScreen';

export type RootStackParamList = {
  Landing: undefined;
  MiniOnboarding: { step: number };
  AuthPrompt: undefined;
  Login: undefined;
  SignUp: undefined;
  Onboarding: undefined;
  MainTabs: undefined;
  GameDetails: { gameId: string };
  BookingDetails: { booking: any };
  Chat: { booking: any };
  Profile: { userId?: string };
  Settings: undefined;
  HelpSupport: undefined;
  TermsPrivacy: undefined;
  Terms: undefined;
  About: undefined;
  Matchmaking: { teamId: string; teamName: string; division: number };
  Highlights: undefined;
  Tournaments: undefined;
  MatchDetail: { match: any };
  TeamSettings: { teamId: string };
  CreateTeam: undefined;
  TeamChat: { teamId: string; teamName: string };
};

export type TabParamList = {
  Home: undefined;
  Play: undefined;
  MyTeam: { showFormation?: boolean };
  Leaderboards: undefined;
  More: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// Optimized screen options for better performance
const optimizedScreenOptions = {
  headerShown: false,
  cardStyleInterpolator: ({ current, layouts }: any) => ({
    cardStyle: {
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [0, 1],
            outputRange: [layouts.screen.width, 0],
          }),
        },
      ],
    },
  }),
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: 200, // Faster transitions
        easing: Easing.out(Easing.poly(4)),
      },
    },
    close: {
      animation: 'timing',
      config: {
        duration: 150, // Even faster close
        easing: Easing.in(Easing.poly(4)),
      },
    },
  },
};

// We'll use the SplashScreen component instead of a basic loading screen

// Smooth transition configuration for More page subscreens
const smoothTransitionOptions = {
  cardStyleInterpolator: ({ current, layouts }: any) => {
    return {
      cardStyle: {
        transform: [
          {
            translateX: current.progress.interpolate({
              inputRange: [0, 1],
              outputRange: [layouts.screen.width * 0.3, 0],
            }),
          },
          {
            scale: current.progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.9, 1],
            }),
          },
        ],
        opacity: current.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
        }),
      },
    };
  },
  transitionSpec: {
    open: {
      animation: 'timing' as const,
      config: {
        duration: 350,
        easing: Easing.out(Easing.cubic),
      },
    },
    close: {
      animation: 'timing' as const,
      config: {
        duration: 300,
        easing: Easing.in(Easing.cubic),
      },
    },
  },
};

const TabNavigator: React.FC = () => {
  const [hasPendingNotifications, setHasPendingNotifications] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let intervalId: any;

    const loadPending = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (isMounted) setHasPendingNotifications(false);
          return;
        }
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'pending');
        if (!error && isMounted) {
          setHasPendingNotifications((count || 0) > 0);
        }
      } catch (e) {
        // ignore
      }
    };

    loadPending();
    intervalId = setInterval(loadPending, 30000);

    const { data: authSub } = supabase.auth.onAuthStateChange(() => {
      loadPending();
    });

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
      authSub?.subscription?.unsubscribe?.();
    };
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: any }) => ({
        tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Play') {
            iconName = focused ? 'football' : 'football-outline';
          } else if (route.name === 'MyTeam') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Leaderboards') {
            iconName = focused ? 'trophy' : 'trophy-outline';
          } else if (route.name === 'More') {
            iconName = focused ? 'menu' : 'menu-outline';
          } else {
            iconName = 'home-outline';
          }

          const icon = <Ionicons name={iconName} size={size} color={color} />;

          if (route.name === 'More') {
            return (
              <View style={{ width: size, height: size }}>
                {icon}
                {hasPendingNotifications && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: '#4CAF50',
                      borderWidth: 1,
                      borderColor: 'rgba(0,0,0,0.6)'
                    }}
                  />
                )}
              </View>
            );
          }

          return icon;
        },
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.6)',
        tabBarStyle: {
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          borderTopColor: 'rgba(255, 255, 255, 0.1)',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerShown: false,
        tabBarShowLabel: false,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={MainAppScreen}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen 
        name="Play" 
        component={PlayScreen}
        options={{
          tabBarLabel: 'Play',
        }}
      />
      <Tab.Screen 
        name="MyTeam" 
        component={MyTeamScreen}
        options={{
          tabBarLabel: 'My Team',
        }}
      />
      <Tab.Screen 
        name="Leaderboards" 
        component={LeaderboardsScreen}
        options={{
          tabBarLabel: 'Leaderboards',
        }}
      />
      <Tab.Screen 
        name="More" 
        component={MoreScreen}
        options={{
          tabBarLabel: 'More',
        }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isInitialCheckComplete, setIsInitialCheckComplete] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const initializeAuth = async () => {
      try {
        // Add minimum splash screen time for better UX
        const [authResult] = await Promise.all([
          checkAuthState(),
          new Promise(resolve => setTimeout(resolve, 2000)) // Minimum 2 seconds for splash
        ]);
        
        if (isMounted) {
          setIsInitialCheckComplete(true);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (isMounted) {
          setIsInitialCheckComplete(true);
          setIsLoading(false);
        }
      }
    };

    initializeAuth();
    
    // Listen for auth changes (only after initial check)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Only process auth changes after initial check is complete
      if (!isInitialCheckComplete) {
        console.log('Ignoring auth change during initial load:', event);
        return;
      }

      console.log('Auth state changed:', event, session?.user?.id);
      
      if (event === 'SIGNED_IN' && session?.user) {
        // Don't show loading for subsequent auth changes
        setUser(session.user);
        await checkOnboardingStatus(session.user.id);
      } else       if (event === 'SIGNED_OUT') {
        setUser(null);
        setHasCompletedOnboarding(false);
        // Clear cache on logout for better performance and privacy
        db.clearCache();
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [isInitialCheckComplete]);

  const checkAuthState = async () => {
    try {
      console.log('Checking initial auth state...');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session check error:', error);
        setUser(null);
        setHasCompletedOnboarding(false);
        return;
      }

      if (session?.user) {
        console.log('Found existing session for user:', session.user.id);
        setUser(session.user);
        await checkOnboardingStatus(session.user.id);
        console.log('Initial auth check completed - user authenticated');
      } else {
        console.log('No existing session found');
        setUser(null);
        setHasCompletedOnboarding(false);
      }
    } catch (error) {
      console.error('Auth state check error:', error);
      setUser(null);
      setHasCompletedOnboarding(false);
    } finally {
      setIsLoading(false);
    }
  };

  const checkOnboardingStatus = async (userId: string) => {
    try {
      console.log('Checking onboarding status for user:', userId);
      const { data: profile, error } = await db.getUserProfile(userId);
      
      if (error) {
        console.error('Error fetching user profile:', error);
        setHasCompletedOnboarding(false);
        return;
      }

      if (!profile) {
        console.log('No profile found for user, onboarding needed');
        setHasCompletedOnboarding(false);
        return;
      }

      const onboardingCompleted = profile.onboarding_completed === true;
      console.log('Profile found:', {
        userId: profile.id,
        username: profile.username,
        onboarding_completed: profile.onboarding_completed,
        created_at: profile.created_at
      });
      console.log('Setting onboarding completed to:', onboardingCompleted);
      
      setHasCompletedOnboarding(onboardingCompleted);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setHasCompletedOnboarding(false);
    }
  };

  const getInitialRouteName = () => {
    console.log('Determining initial route:', {
      hasUser: !!user,
      userId: user?.id,
      hasCompletedOnboarding,
      isLoading
    });

    if (!user) {
      console.log('No user found, going to Landing');
      return 'Landing';
    }
    
    if (!hasCompletedOnboarding) {
      console.log('User found but onboarding not completed, going to Onboarding');
      return 'Onboarding';
    }
    
    console.log('User found and onboarding completed, going to MainTabs');
    return 'MainTabs';
  };


  // Render different navigators based on auth state
  const renderNavigator = () => {
    console.log('Rendering navigator with state:', {
      hasUser: !!user,
      userId: user?.id,
      hasCompletedOnboarding,
      isLoading,
      isInitialCheckComplete
    });

    if (!user) {
      console.log('Rendering auth flow navigator');
      // User not authenticated - show auth flow
      return (
        <Stack.Navigator
          initialRouteName="Landing"
          screenOptions={optimizedScreenOptions}
        >
          <Stack.Screen name="Landing" component={LandingPage} />
          <Stack.Screen name="MiniOnboarding" component={MiniOnboardingScreen} />
          <Stack.Screen name="AuthPrompt" component={AuthPromptScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
        </Stack.Navigator>
      );
    }

    if (!hasCompletedOnboarding) {
      console.log('Rendering onboarding navigator');
      // User authenticated but needs onboarding
      return (
        <Stack.Navigator
          initialRouteName="Onboarding"
          screenOptions={optimizedScreenOptions}
        >
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        </Stack.Navigator>
      );
    }

    console.log('Rendering main app navigator');
    // User authenticated and onboarding completed - show main app
    return (
      <Stack.Navigator
        initialRouteName="MainTabs"
        screenOptions={{
          headerShown: false,
          cardStyleInterpolator: ({ current, layouts }: { current: any; layouts: any }) => {
            return {
              cardStyle: {
                transform: [
                  {
                    scale: current.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.95, 1],
                    }),
                  },
                ],
                opacity: current.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
              },
            };
          },
          transitionSpec: {
            open: {
              animation: 'timing',
              config: {
                duration: 300,
                easing: Easing.out(Easing.cubic),
              },
            },
            close: {
              animation: 'timing',
              config: {
                duration: 250,
                easing: Easing.in(Easing.cubic),
              },
            },
          },
        }}
      >
        <Stack.Screen name="MainTabs" component={TabNavigator} />
        <Stack.Screen 
          name="Matchmaking" 
          component={MatchmakingScreen}
          options={{
            headerShown: false,
            ...smoothTransitionOptions,
          }}
        />
        <Stack.Screen 
          name="GameDetails" 
          component={GameDetailsScreen}
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="BookingDetails" 
          component={BookingDetailsScreen}
          options={{
            headerShown: false,
            ...smoothTransitionOptions,
          }}
        />
        <Stack.Screen 
          name="Chat" 
          component={ChatScreen}
          options={{
            headerShown: false,
            ...smoothTransitionOptions,
          }}
        />
        <Stack.Screen 
          name="Profile" 
          component={ProfileScreen}
          options={{
            headerShown: false,
            ...smoothTransitionOptions,
          }}
        />
        <Stack.Screen 
          name="Settings" 
          component={SettingsScreen}
          options={{
            headerShown: false,
            ...smoothTransitionOptions,
          }}
        />
        <Stack.Screen 
          name="HelpSupport" 
          component={HelpSupportScreen}
          options={{
            headerShown: false,
            ...smoothTransitionOptions,
          }}
        />
        <Stack.Screen 
          name="TermsPrivacy" 
          component={TermsPrivacyScreen}
          options={{
            headerShown: false,
            ...smoothTransitionOptions,
          }}
        />
        <Stack.Screen 
          name="Terms" 
          component={TermsScreen}
          options={{
            headerShown: false,
            ...smoothTransitionOptions,
          }}
        />
        <Stack.Screen 
          name="About" 
          component={AboutScreen}
          options={{
            headerShown: false,
            ...smoothTransitionOptions,
          }}
        />
        <Stack.Screen 
          name="Highlights" 
          component={HighlightsScreen}
          options={{
            headerShown: false,
            ...smoothTransitionOptions,
          }}
        />
        <Stack.Screen 
          name="Tournaments" 
          component={TournamentsScreen}
          options={{
            headerShown: false,
            ...smoothTransitionOptions,
          }}
        />
        <Stack.Screen 
          name="MatchDetail" 
          component={MatchDetailScreen}
          options={{
            headerShown: false,
            ...smoothTransitionOptions,
          }}
        />
        <Stack.Screen 
          name="TeamSettings" 
          component={TeamSettingsScreen}
          options={{
            headerShown: false,
            ...smoothTransitionOptions,
          }}
        />
        <Stack.Screen 
          name="CreateTeam" 
          component={CreateTeamScreen}
          options={{
            headerShown: false,
            ...smoothTransitionOptions,
          }}
        />
        <Stack.Screen 
          name="TeamChat" 
          component={TeamChatScreen}
          options={{
            headerShown: false,
            ...smoothTransitionOptions,
          }}
        />
      </Stack.Navigator>
    );
  };

  return (
    <AppDataProvider>
      <AppLoader>
        {renderNavigator()}
      </AppLoader>
    </AppDataProvider>
  );
};

export default AppNavigator;
