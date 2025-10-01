import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, TabParamList } from '../navigation/AppNavigator';
import { supabase, auth, db } from '../lib/supabase';
import { useAppData } from '../context/AppDataContext';

interface Pitch {
  id: string;
  name: string;
  location: string;
  price: string;
}

interface BookingMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
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

type PlayScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Play'>,
  StackNavigationProp<RootStackParamList>
>;

const PlayScreen: React.FC = () => {
  const navigation = useNavigation<PlayScreenNavigationProp>();
  
  // Use global app data for public games
  const { 
    publicGames, 
    userJoinedGames, 
    userCreatedGames,
    refreshPublicGames 
  } = useAppData();
  
  const [currentStep, setCurrentStep] = useState<'main' | 'details' | 'summary'>('main');
  const [selectedPitch] = useState<Pitch>({
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Central Football Arena',
    location: 'Downtown District',
    price: '$25/hour'
  });
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<number | null>(null);
  const [availableSlots, setAvailableSlots] = useState<number[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [members, setMembers] = useState<BookingMember[]>([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [joiningGame, setJoiningGame] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showJoinSuccessModal, setShowJoinSuccessModal] = useState(false);
  const [showBookingSuccessModal, setShowBookingSuccessModal] = useState(false);
  const [bookingDetails, setBookingDetails] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [gameToCancel, setGameToCancel] = useState<string | null>(null);
  const [cancelingGame, setCancelingGame] = useState<string | null>(null);
  // Invite-by-username states
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteSearchResults, setInviteSearchResults] = useState<Array<{ id: string; username: string; full_name: string }>>([]);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [invitedUsers, setInvitedUsers] = useState<Array<{ id: string; username: string; full_name: string }>>([]);

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
  };

  const handleBookingSuccessClose = async () => {
    setShowBookingSuccessModal(false);
    setBookingDetails('');
    setCurrentStep('main');
    setSelectedDate('');
    setSelectedTimeSlot(null);
    setMembers([]);
    setAvailableSlots([]);
    setInvitedUsers([]);
    
    try {
      // Refresh public games to show the new match and update user's created/joined status
      await refreshPublicGames();
      console.log('Successfully refreshed games after booking creation');
    } catch (error) {
      console.error('Error refreshing games after booking:', error);
    }
  };

  const handleCancelGame = (gameId: string) => {
    setGameToCancel(gameId);
    setShowCancelModal(true);
  };

  const handleConfirmCancelGame = async () => {
    if (!gameToCancel) return;

    setCancelingGame(gameToCancel);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showError('Please log in to cancel the game');
        return;
      }

      // Delete the game and all its members
      const { error: deleteMembersError } = await supabase
        .from('game_members')
        .delete()
        .eq('game_id', gameToCancel);

      if (deleteMembersError) {
        console.error('Error deleting game members:', deleteMembersError);
        showError('Failed to cancel the game. Please try again.');
        return;
      }

      const { error: deleteGameError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', gameToCancel)
        .eq('created_by', user.id); // Ensure only the creator can delete

      if (deleteGameError) {
        console.error('Error deleting game:', deleteGameError);
        showError('Failed to cancel the game. Please try again.');
        return;
      }

      // Refresh the games list
      await refreshPublicGames();

      setShowCancelModal(false);
      setGameToCancel(null);
    } catch (error) {
      console.error('Error canceling game:', error);
      showError('Failed to cancel the game. Please try again.');
    } finally {
      setCancelingGame(null);
    }
  };

  const handleCancelCancelGame = () => {
    setShowCancelModal(false);
    setGameToCancel(null);
  };


  // Helper functions for date and time (same as MatchmakingScreen)
  const getCurrentMonthDates = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const firstDay = new Date(currentYear, currentMonth, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay() + 1); // Start from Monday
    
    const dates = [];
    const currentDate = new Date(startDate);
    
    // Generate 42 days (6 weeks) to fill the calendar
    for (let i = 0; i < 42; i++) {
      const dateString = currentDate.toISOString().split('T')[0];
      const isCurrentMonth = currentDate.getMonth() === currentMonth;
      const isToday = dateString === today.toISOString().split('T')[0];
      const isPast = currentDate < today;
      
      dates.push({
        day: currentDate.getDate(),
        dateString,
        isCurrentMonth,
        isToday,
        isPast
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  };

  const getTimeSlots = () => {
    return [
      { value: 18, label: '6:00 PM', period: 'Evening' },
      { value: 19, label: '7:00 PM', period: 'Evening' },
      { value: 20, label: '8:00 PM', period: 'Evening' },
      { value: 21, label: '9:00 PM', period: 'Night' },
      { value: 22, label: '10:00 PM', period: 'Night' },
      { value: 23, label: '11:00 PM', period: 'Night' },
      { value: 24, label: '12:00 AM', period: 'Late Night' },
      { value: 25, label: '1:00 AM', period: 'Late Night' },
      { value: 26, label: '2:00 AM', period: 'Late Night' },
    ];
  };

  const getDateDisplayText = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Load available time slots for selected date
  const loadAvailableSlots = async (date: string) => {
    setLoadingSlots(true);
    try {
      console.log('Loading available slots for date:', date);
      const { data, error } = await db.getAvailableTimeSlots(date);
      if (error) {
        console.error('Error loading available slots:', error);
        // Fallback to all slots if error
        setAvailableSlots([18, 19, 20, 21, 22, 23, 24, 25, 26]);
      } else {
        console.log('Available slots data:', data);
        const slots = data?.available_slots || [18, 19, 20, 21, 22, 23, 24, 25, 26];
        console.log('Setting available slots:', slots);
        setAvailableSlots(slots);
      }
    } catch (error) {
      console.error('Exception loading available slots:', error);
      setAvailableSlots([18, 19, 20, 21, 22, 23, 24, 25, 26]);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Public games loading state (data comes from global context)
  const [loadingPublicGames, setLoadingPublicGames] = useState(false);

  // No need to load public games - they're already loaded globally!
  useEffect(() => {
    // Public games are already available from global context
    console.log('✅ PlayScreen: Public games already loaded from global context!', publicGames.length);
  }, [publicGames]);


  // Load available slots when date changes
  useEffect(() => {
    if (selectedDate) {
      loadAvailableSlots(selectedDate);
    } else {
      // Initialize with all slots available if no date selected
      setAvailableSlots([18, 19, 20, 21, 22, 23, 24, 25, 26]);
    }
  }, [selectedDate]);

  const handleCreateMatch = () => {
    setCurrentStep('details');
    setSelectedDate('');
    setSelectedTimeSlot(null);
    // Initialize with all slots available when creating a match
    setAvailableSlots([18, 19, 20, 21, 22, 23, 24, 25, 26]);
  };

  // Load public games from database
  const loadPublicGames = async () => {
    setLoadingPublicGames(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get all public bookings
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          id,
          pitch_name,
          pitch_location,
          date,
          time,
          price,
          created_by,
          max_players,
          is_public
        `)
        .eq('is_public', true)
        .gte('date', new Date().toISOString().split('T')[0]) // Only future dates
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (error) {
        console.error('Error loading public games:', error);
        return;
      }

      // Get member counts for each booking
        const gamesWithMembers = await Promise.all(
          (bookings || []).map(async (booking: any) => {
          const { data: members } = await supabase
            .from('game_members')
            .select('id, user_id')
            .eq('game_id', booking.id)
            .eq('status', 'joined');

          // Ensure the creator is counted as a player
          let memberCount = members?.length || 0;
          
          // Check if the creator is in the game_members table
          if (booking.created_by) {
            const creatorInMembers = members?.some((member: any) => member.user_id === booking.created_by);
            if (!creatorInMembers) {
              // Creator is not in the game_members table, add them
              try {
                const { error: addCreatorError } = await supabase
                  .from('game_members')
                  .insert({
                    game_id: booking.id,
                    user_id: booking.created_by,
                    role: 'organizer',
                    status: 'joined'
                  });
                
                if (!addCreatorError) {
                  memberCount += 1; // Add creator to count
                }
              } catch (e) {
                console.error('Error adding creator to game_members:', e);
              }
            }
          }
          const maxPlayers = booking.max_players || 8;

          // Get creator's name
          let creatorName = 'Unknown';
          if (booking.created_by) {
            try {
              const { data: profile } = await supabase
                .from('user_profiles')
                .select('full_name, username')
                .eq('id', booking.created_by)
                .single();
              
              creatorName = profile?.username || profile?.full_name || 'Unknown';
            } catch (e) {
              console.error('Error fetching creator profile:', e);
            }
          }

          return {
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
          };
        })
      );

      setPublicGames(gamesWithMembers);
    } catch (error) {
      console.error('Error loading public games:', error);
    } finally {
      setLoadingPublicGames(false);
    }
  };



  const handleConfirmBooking = () => {
    setCurrentStep('summary');
  };

  const handleJoinGame = async (gameId: string) => {
    setJoiningGame(gameId);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showError('Please log in to join a game');
        return;
      }

      // Join the game using the database
      const { data, error } = await db.joinGame(gameId, user.id, 'player');
      
      if (error) {
        showError(error.message || 'Failed to join the game. Please try again.');
        return;
      }

      // Refresh public games to get updated member count and user's game status
      await refreshPublicGames();

      // Show success message
      setShowJoinSuccessModal(true);
    } catch (error) {
      console.error('Error joining game:', error);
      showError('Failed to join the game. Please try again.');
    } finally {
      setJoiningGame(null);
    }
  };

  const canJoinGame = (game: PublicGame) => {
    // Check if game is open and has space
    if (game.status !== 'open' || game.players >= game.maxPlayers) {
      return false;
    }
    
    // Check if user has already joined this game
    if (userJoinedGames.has(game.id)) {
      return false;
    }
    
    // Check if user created this game
    if (userCreatedGames.has(game.id)) {
      return false;
    }
    
    return true;
  };

  const getGameStatusText = (game: PublicGame) => {
    if (game.status === 'full') return 'Full';
    if (game.players >= game.maxPlayers - 2) return 'Almost Full';
    return 'Open';
  };

  const getGameStatusColor = (game: PublicGame) => {
    if (game.status === 'full') return '#ff6b6b';
    if (game.players >= game.maxPlayers - 2) return '#ffa726';
    return '#4CAF50';
  };

  const getJoinButtonText = (game: PublicGame) => {
    if (game.status === 'full' || game.players >= game.maxPlayers) {
      return 'Game Full';
    }
    if (userJoinedGames.has(game.id)) {
      return 'Already Joined';
    }
    if (userCreatedGames.has(game.id)) {
      return 'Your Game';
    }
    return 'Join Game';
  };

  const handleFinalConfirm = async () => {
    if (!selectedDate || selectedTimeSlot === null) {
      showError('Please complete all booking details');
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showError('Please log in to create a booking');
        return;
      }

      // Get the time label for display
      const selectedTimeLabel = getTimeSlots().find(slot => slot.value === selectedTimeSlot)?.label || 'Unknown';

      // First, check if the time slot is already booked
      const { data: availabilityData, error: availabilityError } = await db.checkPitchAvailability(selectedDate, selectedTimeSlot);
      
      if (availabilityError) {
        console.error('Error checking availability:', availabilityError);
        showError('Failed to check pitch availability. Please try again.');
        return;
      }

      if (!availabilityData?.available) {
        showError('This time slot is already booked. Please select another time or date.');
        return;
      }

      // Create booking data
      const bookingData = {
        pitch_id: selectedPitch.id,
        pitch_name: selectedPitch.name,
        pitch_location: selectedPitch.location,
        date: selectedDate,
        time: selectedTimeLabel,
        booking_date: selectedDate, // For pitch booking system
        time_slot: selectedTimeSlot, // For pitch booking system
        price: selectedPitch.price,
        created_by: user.id,
        max_players: 8, // Default max players
        is_public: isPublic,
        status: 'confirmed',
        created_at: new Date().toISOString(),
      };

      console.log('Creating booking with data:', bookingData);

      const { data: newBooking, error } = await supabase
        .from('bookings')
        .insert([bookingData])
        .select()
        .single();

      if (error) {
        console.error('Error creating booking:', error);
        showError('Failed to create booking. Please try again.');
        return;
      }

      if (!newBooking) {
        showError('Failed to create booking. Please try again.');
        return;
      }

      console.log('Booking created successfully:', newBooking.id);

      // Add to centralized pitch booking system
      if (newBooking) {
        const { error: pitchBookingError } = await db.addPitchBooking(
          selectedDate,
          selectedTimeSlot,
          'booking',
          newBooking.id,
          selectedPitch.id
        );

        if (pitchBookingError) {
          console.error('Error adding pitch booking:', pitchBookingError);
          console.error('Booking ID that failed:', newBooking.id);
          // Clean up the booking if pitch booking fails
          const { error: cleanupError } = await supabase.from('bookings').delete().eq('id', newBooking.id);
          if (cleanupError) {
            console.error('Error cleaning up failed booking:', cleanupError);
          }
          showError('Failed to reserve the pitch. Please try again.');
          return;
        } else {
          console.log('Pitch booking added successfully');
        }
      }

      // Add the creator as the first member
      if (newBooking) {
        const { error: memberError } = await supabase
          .from('game_members')
          .insert({
            game_id: newBooking.id,
            user_id: user.id,
            role: 'organizer',
            status: 'joined'
          });

        if (memberError) {
          console.error('Error adding creator to game:', memberError);
          console.error('Booking ID that failed member creation:', newBooking.id);
          // Clean up both booking and pitch booking if member creation fails
          const { error: pitchCleanupError } = await db.removePitchBooking('booking', newBooking.id);
          if (pitchCleanupError) {
            console.error('Error cleaning up pitch booking:', pitchCleanupError);
          }
          const { error: bookingCleanupError } = await supabase.from('bookings').delete().eq('id', newBooking.id);
          if (bookingCleanupError) {
            console.error('Error cleaning up booking:', bookingCleanupError);
          }
          showError('Failed to create booking. Please try again.');
          return;
        } else {
          console.log('Creator added to game successfully');
        }
      }

      // The newly created game will be reflected when we refresh the public games
      console.log('Booking created with ID:', newBooking.id);

      // Send invitations to selected users (if any)
      if (newBooking && invitedUsers.length > 0) {
        const gameTitle = selectedPitch.name || 'Football Match';
        const gameDate = selectedDate;
        const gameTime = selectedTimeLabel;
        const senderName = user.user_metadata?.full_name || user.email || 'Someone';

        for (const target of invitedUsers) {
          // Create database notification (push notification will be sent automatically)
          const { error: notificationError } = await db.createNotification({
            user_id: target.id,
            type: 'game_invitation',
            title: 'Game Invitation',
            message: `${senderName} invited you to join "${gameTitle}" on ${gameDate} at ${gameTime}`,
            game_id: newBooking.id,
            invited_by: user.id,
            status: 'pending',
          });
          if (notificationError) {
            console.error('Error sending invite to', target.username, notificationError);
          }
        }
      }

      // Set success message and show modal
      setBookingDetails(`Your ${isPublic ? 'public' : 'private'} match at ${selectedPitch.name} on ${getDateDisplayText(selectedDate)} at ${selectedTimeLabel} has been booked successfully.`);
      
      console.log('Booking process completed successfully');
      setShowBookingSuccessModal(true);
    } catch (error) {
      console.error('Error creating booking:', error);
      showError('Failed to create booking. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const addMember = () => {
    if (!newMemberName.trim() || !newMemberEmail.trim()) {
      showError('Name and email are required');
      return;
    }

    const newMember: BookingMember = {
      id: Date.now().toString(),
      name: newMemberName.trim(),
      email: newMemberEmail.trim(),
      phone: newMemberPhone.trim() || undefined,
    };

    setMembers([...members, newMember]);
    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberPhone('');
    setShowMemberModal(false);
  };

  const removeMember = (memberId: string) => {
    setMembers(members.filter(member => member.id !== memberId));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Username search for invite
  const searchInviteUsers = async (query: string) => {
    setInviteUsername(query);
    setInviteError('');
    if (query.trim().length < 2) {
      setInviteSearchResults([]);
      return;
    }
    setInviteSearching(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, full_name')
        .ilike('username', `%${query.trim()}%`)
        .limit(5);
      if (!error) {
        setInviteSearchResults(data || []);
      } else {
        setInviteSearchResults([]);
      }
    } catch (e) {
      setInviteSearchResults([]);
    } finally {
      setInviteSearching(false);
    }
  };

  const addInviteUser = (user: { id: string; username: string; full_name: string }) => {
    if (invitedUsers.find(u => u.id === user.id)) return;
    setInvitedUsers(prev => [...prev, user]);
    setInviteUsername('');
    setInviteSearchResults([]);
  };

  const removeInviteUser = (userId: string) => {
    setInvitedUsers(prev => prev.filter(u => u.id !== userId));
  };

  if (currentStep === 'main') {
    return (
      <ImageBackground source={require('../../assets/hage.jpeg')} style={styles.container}>
        <View style={styles.backgroundOverlay}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loadingPublicGames}
              onRefresh={refreshPublicGames}
              tintColor="#4CAF50"
              colors={["#4CAF50"]}
            />
          }
        >
          <View style={styles.content}>
            {/* Compact Header */}
            <View style={styles.headerSection}>
              <View style={styles.headerText}>
                <Text style={styles.title}>Play</Text>
                <Text style={styles.subtitle}>Create your perfect match</Text>
              </View>
              
              <TouchableOpacity style={styles.createButton} onPress={handleCreateMatch}>
                <Ionicons name="add-circle" size={32} color="#4CAF50" />
                <View style={styles.createButtonText}>
                  <Text style={styles.buttonText}>Create Match</Text>
                  <Text style={styles.buttonSubtext}>Select pitch, time & date</Text>
                </View>
              </TouchableOpacity>
            </View>


            {isPublic && (
              <View style={styles.publicGamesSection}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Public Games</Text>
                    <Text style={styles.sectionSubtitle}>Join other players' matches</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.refreshButton}
                    onPress={refreshPublicGames}
                    disabled={loadingPublicGames}
                  >
                    <Ionicons 
                      name="refresh" 
                      size={20} 
                      color={loadingPublicGames ? "rgba(255, 255, 255, 0.3)" : "#fff"} 
                    />
                  </TouchableOpacity>
                </View>
                
                {loadingPublicGames ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text style={styles.loadingText}>Loading public games...</Text>
                  </View>
                ) : (
                  publicGames.map((game) => (
                  <View key={game.id} style={styles.publicGameCard}>
                    <View style={styles.gameHeader}>
                      <View style={styles.gameMainInfo}>
                        <Text style={styles.gamePitch}>{game.pitch}</Text>
                        <View style={styles.gameStatus}>
                          <View style={[styles.statusDot, { backgroundColor: getGameStatusColor(game) }]} />
                          <Text style={[styles.statusText, { color: getGameStatusColor(game) }]}>
                            {getGameStatusText(game)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.gamePlayers}>
                        <Ionicons name="people" size={16} color="#4CAF50" />
                        <Text style={styles.playersText}>{game.players}/{game.maxPlayers}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.gameDetails}>
                      <View style={styles.gameDetail}>
                        <Ionicons name="calendar" size={14} color="rgba(255, 255, 255, 0.6)" />
                        <Text style={styles.gameDetailText}>{formatDate(game.date)}</Text>
                      </View>
                      <View style={styles.gameDetail}>
                        <Ionicons name="time" size={14} color="rgba(255, 255, 255, 0.6)" />
                        <Text style={styles.gameDetailText}>{game.time}</Text>
                      </View>
                    </View>

                    <View style={styles.gameFooter}>
                      <View style={styles.gameCreator}>
                        <Ionicons name="person" size={14} color="rgba(255, 255, 255, 0.6)" />
                        <Text style={styles.creatorText}>by {game.createdBy}</Text>
                      </View>
                      <Text style={styles.gamePrice}>{game.price}</Text>
                    </View>
                    
                    <View style={styles.gameActions}>
                      <TouchableOpacity 
                        style={styles.moreInfoButton}
                        onPress={() => {
                          navigation.navigate('GameDetails', { gameId: game.id });
                        }}
                      >
                        <Ionicons name="information-circle" size={16} color="rgba(255, 255, 255, 0.8)" />
                        <Text style={styles.moreInfoText}>More Info</Text>
                      </TouchableOpacity>
                      
                      {userCreatedGames.has(game.id) ? (
                        // Show cancel button for game owner
                        <TouchableOpacity 
                          style={styles.cancelButton}
                          onPress={() => handleCancelGame(game.id)}
                          disabled={cancelingGame === game.id}
                        >
                          {cancelingGame === game.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="close-circle" size={16} color="rgba(255, 255, 255, 0.8)" />
                              <Text style={styles.cancelButtonText}>Cancel</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      ) : (
                        // Show join button for other users
                        <TouchableOpacity 
                          style={[
                            styles.joinButton, 
                            !canJoinGame(game) && styles.joinButtonDisabled
                          ]}
                          onPress={() => canJoinGame(game) && handleJoinGame(game.id)}
                          disabled={!canJoinGame(game) || joiningGame === game.id}
                        >
                          {joiningGame === game.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.joinButtonText}>
                              {getJoinButtonText(game)}
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
                )}

                {publicGames.length === 0 && (
                  <View style={styles.noGamesCard}>
                    <Ionicons name="football" size={48} color="rgba(255, 255, 255, 0.3)" />
                    <Text style={styles.noGamesText}>No public games available</Text>
                    <Text style={styles.noGamesSubtext}>Be the first to create a match!</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
        </View>

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
                <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
              </View>
              <Text style={styles.successTitle}>Game Joined! 🎉</Text>
              <Text style={styles.successMessage}>
                You have successfully joined this match. The organizer will contact you with further details.
              </Text>
              <TouchableOpacity 
                style={styles.successButton}
                onPress={handleJoinSuccessClose}
              >
                <Text style={styles.successButtonText}>Great!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Booking Success Modal */}
        <Modal
          visible={showBookingSuccessModal}
          transparent={true}
          animationType="fade"
          onRequestClose={handleBookingSuccessClose}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.successModal}>
              <View style={styles.successIconContainer}>
                <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
              </View>
              <Text style={styles.successTitle}>Booking Confirmed! 🎉</Text>
              <Text style={styles.successMessage}>
                {bookingDetails}
              </Text>
              <TouchableOpacity 
                style={styles.successButton}
                onPress={handleBookingSuccessClose}
              >
                <Text style={styles.successButtonText}>Great!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Cancel Game Confirmation Modal */}
        <Modal
          visible={showCancelModal}
          transparent={true}
          animationType="fade"
          onRequestClose={handleCancelCancelGame}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.successModal}>
              <View style={styles.successIconContainer}>
                <Ionicons name="warning" size={32} color="#ff6b6b" />
              </View>
              <Text style={styles.successTitle}>Cancel Game</Text>
              <Text style={styles.successMessage}>
                Are you sure you want to cancel this game? This action cannot be undone and will remove all players from the game.
              </Text>
              <View style={styles.confirmationButtons}>
                <TouchableOpacity 
                  style={styles.confirmationButtonSecondary}
                  onPress={handleCancelCancelGame}
                >
                  <Text style={styles.confirmationButtonTextSecondary}>No, Keep Game</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.confirmationButtonDanger}
                  onPress={handleConfirmCancelGame}
                  disabled={cancelingGame !== null}
                >
                  {cancelingGame ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.confirmationButtonTextPrimary}>Yes, Cancel</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </ImageBackground>
    );
  }

  if (currentStep === 'details') {
    return (
      <ImageBackground source={require('../../assets/hage.jpeg')} style={styles.container}>
        <View style={styles.backgroundOverlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => setCurrentStep('main')}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>Match Details</Text>
            <Text style={styles.subtitle}>Choose pitch, date and time</Text>
          </View>

          <StepIndicator currentStepIndex={0} />

          <ScrollView showsVerticalScrollIndicator={false}>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Match Visibility</Text>
              <View style={styles.visibilityToggle}>
                <TouchableOpacity 
                  style={[styles.toggleButton, isPublic && styles.toggleButtonActive]}
                  onPress={() => setIsPublic(true)}
                >
                  <Ionicons name="globe" size={16} color={isPublic ? "#fff" : "rgba(255, 255, 255, 0.6)"} />
                  <Text style={[styles.toggleText, isPublic && styles.toggleTextActive]}>Public</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.toggleButton, !isPublic && styles.toggleButtonActive]}
                  onPress={() => setIsPublic(false)}
                >
                  <Ionicons name="lock-closed" size={16} color={!isPublic ? "#fff" : "rgba(255, 255, 255, 0.6)"} />
                  <Text style={[styles.toggleText, !isPublic && styles.toggleTextActive]}>Private</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.visibilityInfo}>
                {isPublic ? 'Other players can see and join your match' : 'Only invited players can join your match'}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Date</Text>
              <View style={styles.calendarWrapper}>
                <View style={styles.calendarHeader}>
                  <Text style={styles.calendarMonthTitle}>
                    {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </Text>
                </View>
                
                <View style={styles.calendarWeekdays}>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                    <Text key={day} style={styles.calendarWeekday}>{day}</Text>
                  ))}
                </View>
                
                <View style={styles.calendarGrid}>
                  {getCurrentMonthDates().map((dateObj) => (
                    <TouchableOpacity
                      key={dateObj.dateString}
                      style={[
                        styles.calendarDay,
                        !dateObj.isCurrentMonth && styles.calendarDayOtherMonth,
                        dateObj.isPast && styles.calendarDayPast,
                        selectedDate === dateObj.dateString && styles.selectedCalendarDay,
                        dateObj.isToday && styles.todayCalendarDay
                      ]}
                      onPress={() => {
                        if (!dateObj.isPast) {
                          setSelectedDate(dateObj.dateString);
                          setSelectedTimeSlot(null); // Reset time slot when date changes
                          loadAvailableSlots(dateObj.dateString); // Load available slots for this date
                        }
                      }}
                      disabled={dateObj.isPast}
                    >
                      <Text style={[
                        styles.calendarDayNumber,
                        !dateObj.isCurrentMonth && styles.calendarDayNumberOtherMonth,
                        dateObj.isPast && styles.calendarDayNumberPast,
                        selectedDate === dateObj.dateString && styles.selectedCalendarDayNumber,
                        dateObj.isToday && styles.todayCalendarDayNumber
                      ]}>
                        {dateObj.day}
                      </Text>
                      {dateObj.isToday && (
                        <View style={styles.todayIndicator} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Time Slot</Text>
              {loadingSlots && (
                <View style={styles.loadingSlotsContainer}>
                  <ActivityIndicator size="small" color="#4CAF50" />
                  <Text style={styles.loadingSlotsText}>Loading available slots...</Text>
                </View>
              )}
              
              <View style={styles.timeSlotsContainer}>
                {/* Evening Slots */}
                <View style={styles.timePeriodSection}>
                  <View style={styles.timePeriodHeader}>
                    <Ionicons name="sunny" size={16} color="#FF9800" />
                    <Text style={styles.timePeriodTitle}>Evening</Text>
                  </View>
                  <View style={styles.timeGrid}>
                    {getTimeSlots().filter(slot => slot.period === 'Evening').map((slot) => {
                      const isAvailable = availableSlots.includes(slot.value);
                      const isSelected = selectedTimeSlot === slot.value;
                      
                      return (
                        <TouchableOpacity
                          key={slot.value}
                          style={[
                            styles.timeOption,
                            isSelected && styles.selectedOption,
                            !isAvailable && styles.unavailableOption
                          ]}
                          onPress={() => isAvailable && setSelectedTimeSlot(slot.value)}
                          disabled={!isAvailable}
                        >
                          <Text style={[
                            styles.optionText,
                            isSelected && styles.selectedOptionText,
                            !isAvailable && styles.unavailableOptionText
                          ]}>
                            {slot.label}
                          </Text>
                          {!isAvailable && (
                            <Ionicons name="close-circle" size={16} color="#f44336" />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Night Slots */}
                <View style={styles.timePeriodSection}>
                  <View style={styles.timePeriodHeader}>
                    <Ionicons name="moon" size={16} color="#4A90E2" />
                    <Text style={styles.timePeriodTitle}>Night</Text>
                  </View>
                  <View style={styles.timeGrid}>
                    {getTimeSlots().filter(slot => slot.period === 'Night').map((slot) => {
                      const isAvailable = availableSlots.includes(slot.value);
                      const isSelected = selectedTimeSlot === slot.value;
                      
                      return (
                        <TouchableOpacity
                          key={slot.value}
                          style={[
                            styles.timeOption,
                            isSelected && styles.selectedOption,
                            !isAvailable && styles.unavailableOption
                          ]}
                          onPress={() => isAvailable && setSelectedTimeSlot(slot.value)}
                          disabled={!isAvailable}
                        >
                          <Text style={[
                            styles.optionText,
                            isSelected && styles.selectedOptionText,
                            !isAvailable && styles.unavailableOptionText
                          ]}>
                            {slot.label}
                          </Text>
                          {!isAvailable && (
                            <Ionicons name="close-circle" size={16} color="#f44336" />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Late Night Slots */}
                <View style={styles.timePeriodSection}>
                  <View style={styles.timePeriodHeader}>
                    <Ionicons name="star" size={16} color="#9B59B6" />
                    <Text style={styles.timePeriodTitle}>Late Night</Text>
                  </View>
                  <View style={styles.timeGrid}>
                    {getTimeSlots().filter(slot => slot.period === 'Late Night').map((slot) => {
                      const isAvailable = availableSlots.includes(slot.value);
                      const isSelected = selectedTimeSlot === slot.value;
                      
                      return (
                        <TouchableOpacity
                          key={slot.value}
                          style={[
                            styles.timeOption,
                            isSelected && styles.selectedOption,
                            !isAvailable && styles.unavailableOption
                          ]}
                          onPress={() => isAvailable && setSelectedTimeSlot(slot.value)}
                          disabled={!isAvailable}
                        >
                          <Text style={[
                            styles.optionText,
                            isSelected && styles.selectedOptionText,
                            !isAvailable && styles.unavailableOptionText
                          ]}>
                            {slot.label}
                          </Text>
                          {!isAvailable && (
                            <Ionicons name="close-circle" size={16} color="#f44336" />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>

            {selectedDate && selectedTimeSlot !== null && (
              <GradientButton
                title="Continue to Confirm"
                onPress={() => setCurrentStep('summary')}
              />
            )}
          </ScrollView>


        </View>
        </View>
      </ImageBackground>
    );
  }

  /* booking step removed in refactor */

  if (currentStep === 'summary') {
    return (
      <ImageBackground source={require('../../assets/hage.jpeg')} style={styles.container}>
        <View style={styles.backgroundOverlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => setCurrentStep('details')}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>Confirm Booking</Text>
          </View>

          <StepIndicator currentStepIndex={1} />

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Match Details</Text>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Pitch:</Text>
                <Text style={styles.summaryValue}>{selectedPitch?.name}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Date:</Text>
                <Text style={styles.summaryValue}>{formatDate(selectedDate)}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Time:</Text>
                <Text style={styles.summaryValue}>
                  {selectedTimeSlot !== null ? getTimeSlots().find(slot => slot.value === selectedTimeSlot)?.label : 'Not selected'}
                </Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Price:</Text>
                <Text style={styles.summaryValue}>{selectedPitch?.price}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Visibility:</Text>
                <Text style={styles.summaryValue}>{isPublic ? 'Public' : 'Private'}</Text>
              </View>
            </View>

            <View style={styles.membersCard}>
              <View style={styles.membersHeader}>
                <Text style={styles.membersTitle}>Invite Players</Text>
                <TouchableOpacity 
                  style={styles.addMemberButton}
                  onPress={() => { setInviteError(''); setShowMemberModal(true); }}
                >
                  <Ionicons name="person-add" size={20} color="#4CAF50" />
                  <Text style={styles.addMemberText}>Invite Player</Text>
                </TouchableOpacity>
              </View>

              {invitedUsers.length === 0 ? (
                <Text style={styles.noMembersText}>No invites added yet</Text>
              ) : (
                <View style={styles.membersList}>
                  {invitedUsers.map((user) => (
                    <View key={user.id} style={styles.memberItem}>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{user.full_name || user.username}</Text>
                        <Text style={styles.memberEmail}>@{user.username}</Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.removeMemberButton}
                        onPress={() => removeInviteUser(user.id)}
                      >
                        <Ionicons name="close-circle" size={20} color="#ff6b6b" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <GradientButton
              title={isLoading ? 'Creating Booking...' : 'Confirm & Pay'}
              onPress={handleFinalConfirm}
              disabled={isLoading}
              loading={isLoading}
            />
          </ScrollView>

          <Modal
            visible={showMemberModal}
            transparent={true}
            animationType="slide"
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Invite Player</Text>
                  <TouchableOpacity onPress={() => setShowMemberModal(false)}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.memberForm}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Search Username</Text>
                    <TextInput
                      style={styles.textInput}
                      value={inviteUsername}
                      onChangeText={searchInviteUsers}
                      placeholder="Enter username"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {!!inviteError && (
                      <Text style={styles.inviteErrorText}>{inviteError}</Text>
                    )}
                  </View>

                  {inviteSearching ? (
                    <ActivityIndicator size="small" color="#fff" />)
                  : (
                    <View>
                      {inviteSearchResults.map(user => (
                        <TouchableOpacity key={user.id} style={styles.listItemRow} onPress={() => addInviteUser(user)}>
                          <Text style={styles.listItemText}>@{user.username}</Text>
                        </TouchableOpacity>
                      ))}
                      {inviteSearchResults.length === 0 && inviteUsername.trim().length >= 2 && (
                        <Text style={styles.noMembersText}>No users found</Text>
                      )}
                    </View>
                  )}

                  {invitedUsers.length > 0 && (
                    <View style={styles.invitedChipsWrap}>
                      {invitedUsers.map(user => (
                        <View key={user.id} style={styles.invitedChip}>
                          <Text style={styles.invitedChipText}>@{user.username}</Text>
                          <TouchableOpacity onPress={() => removeInviteUser(user.id)}>
                            <Ionicons name="close" size={12} color="rgba(255,255,255,0.8)" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  <TouchableOpacity style={styles.addMemberSubmitButton} onPress={() => setShowMemberModal(false)}>
                    <Text style={styles.addMemberSubmitText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Booking Success Modal (also render in summary step) */}
          <Modal
            visible={showBookingSuccessModal}
            transparent={true}
            animationType="fade"
            onRequestClose={handleBookingSuccessClose}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.successModal}>
                <View style={styles.successIconContainer}>
                  <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
                </View>
                <Text style={styles.successTitle}>Booking Confirmed! 🎉</Text>
                <Text style={styles.successMessage}>
                  {bookingDetails}
                </Text>
                <TouchableOpacity 
                  style={styles.successButton}
                  onPress={handleBookingSuccessClose}
                >
                  <Text style={styles.successButtonText}>Great!</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
        </View>
      </ImageBackground>
    );
  }

  return null;
};

// Step indicator for the create-match flow
const StepIndicator: React.FC<{ currentStepIndex: 0 | 1 }> = ({ currentStepIndex }) => {
  const steps = ['Details', 'Confirm'];
  return (
    <View style={styles.stepContainer}>
      {steps.map((label, index) => (
        <View key={label} style={styles.stepItem}>
          <View style={[styles.stepCircle, index <= currentStepIndex && styles.stepCircleActive]}>
            <Text style={[styles.stepNumber, index <= currentStepIndex && styles.stepNumberActive]}>
              {index + 1}
            </Text>
          </View>
          <Text style={[styles.stepLabel, index <= currentStepIndex && styles.stepLabelActive]}>{label}</Text>
          {index < steps.length - 1 && (
            <View style={[styles.stepConnector, index < currentStepIndex && styles.stepConnectorActive]} />
          )}
        </View>
      ))}
    </View>
  );
};

// Unified gradient button
const GradientButton: React.FC<{ title: string; onPress: () => void; disabled?: boolean; loading?: boolean }> = ({ title, onPress, disabled, loading }) => {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} disabled={disabled} style={disabled ? styles.gradientButtonDisabledWrap : undefined}>
      <LinearGradient colors={["#43A047", "#66BB6A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradientButton}>
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.gradientButtonText}>{title}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  headerSection: {
    marginBottom: 20,
  },
  headerText: {
    marginBottom: 16,
  },
  header: {
    marginBottom: 20,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderStyle: 'dashed',
  },
  createButtonText: {
    marginLeft: 16,
    flex: 1,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  buttonSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  infoCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 12,
    lineHeight: 18,
  },
  publicGamesSection: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  refreshButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
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
  publicGameCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  gameMainInfo: {
    flex: 1,
  },
  gamePitch: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  gameStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  gamePlayers: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playersText: {
    fontSize: 14,
    color: '#4CAF50',
    marginLeft: 6,
    fontWeight: '600',
  },
  gameDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  gameDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gameDetailText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginLeft: 6,
  },
  gameFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  gameActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  moreInfoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    gap: 6,
  },
  moreInfoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  gameCreator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginLeft: 4,
  },
  gamePrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  joinButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  joinButtonDisabled: {
    backgroundColor: 'rgba(76, 175, 80, 0.5)',
    opacity: 0.7,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    gap: 6,
  },
  cancelButtonText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  noGamesCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  noGamesText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  noGamesSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
  pitchGridContainer: {
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  pitchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: 15,
  },
  pitchCardGradient: {
    borderRadius: 18,
    padding: 1.5,
    width: '45%',
  },
  pitchCardInner: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  pitchIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  pitchName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
  },
  pitchLocation: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.65)',
    marginBottom: 10,
    textAlign: 'center',
  },
  pitchFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pitchPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#66BB6A',
    textAlign: 'center',
  },
  section: {
    marginBottom: 30,
  },
  visibilityToggle: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  toggleButtonActive: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    marginLeft: 6,
  },
  toggleTextActive: {
    color: '#4CAF50',
  },
  visibilityInfo: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  dateButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  dateButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
    textAlign: 'center',
  },
  selectorButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectorButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
    textAlign: 'left',
  },
  listItemRow: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listItemRowSelected: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderColor: '#4CAF50',
  },
  listItemText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '600',
  },
  listItemTextSelected: {
    color: '#fff',
  },
  dateOptionsList: {
    paddingVertical: 6,
  },
  timeList: {
    paddingVertical: 6,
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 20,
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  gradientButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  gradientButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  gradientButtonDisabledWrap: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 18,
    textAlign: 'center',
  },
  successButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
  },
  successButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  confirmationButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  confirmationButtonSecondary: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  confirmationButtonDanger: {
    flex: 1,
    backgroundColor: '#F44336',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  confirmationButtonTextSecondary: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  confirmationButtonTextPrimary: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 20,
    width: '80%',
    maxWidth: 350,
  },
  bottomSheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '70%'
  },
  bottomSheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 12,
  },
  chipRow: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)'
  },
  chipSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  chipText: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#fff',
  },
  pitchListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 10,
  },
  pitchListItemSelected: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderColor: '#4CAF50',
  },
  pitchThumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: 12,
  },
  pitchThumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  pitchListTextWrap: {
    flex: 1,
  },
  pitchListTitle: {
    color: '#fff',
    fontWeight: '700',
  },
  pitchListSubtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    marginTop: 2,
  },
  pitchListRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pitchListPrice: {
    color: '#66BB6A',
    fontWeight: '700',
    marginLeft: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  dateOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  dateOption: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    padding: 16,
    width: '25%',
    alignItems: 'center',
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  dateOptionSelected: {
    backgroundColor: '#4CAF50',
  },
  dateOptionDay: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  dateOptionNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  summaryCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  summaryValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  membersCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  membersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  membersTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addMemberText: {
    fontSize: 14,
    color: '#4CAF50',
    marginLeft: 6,
    fontWeight: '500',
  },
  noMembersText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  membersList: {
    gap: 12,
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
  memberEmail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 2,
  },
  memberPhone: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  removeMemberButton: {
    padding: 4,
  },
  finalConfirmButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  finalConfirmButtonDisabled: {
    backgroundColor: 'rgba(76, 175, 80, 0.5)',
  },
  finalConfirmButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  stepCircleActive: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  stepNumber: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '700',
    fontSize: 12,
  },
  stepNumberActive: {
    color: '#4CAF50',
  },
  stepLabel: {
    marginTop: 6,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  stepLabelActive: {
    color: '#fff',
    fontWeight: '600',
  },
  stepConnector: {
    position: 'absolute',
    top: 14,
    right: - (100 / 4),
    width: '50%',
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  stepConnectorActive: {
    backgroundColor: '#4CAF50',
  },
  memberForm: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  addMemberSubmitButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  addMemberSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Calendar Styles (from MatchmakingScreen)
  calendarWrapper: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
  },
  calendarHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarMonthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  calendarWeekdays: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  calendarWeekday: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
    width: 32,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  calendarDay: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  calendarDayOtherMonth: {
    opacity: 0.3,
  },
  calendarDayPast: {
    opacity: 0.4,
  },
  selectedCalendarDay: {
    backgroundColor: '#4CAF50',
    transform: [{ scale: 1.1 }],
  },
  todayCalendarDay: {
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  calendarDayNumber: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  calendarDayNumberOtherMonth: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  calendarDayNumberPast: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
  selectedCalendarDayNumber: {
    color: '#fff',
    fontWeight: '700',
  },
  todayCalendarDayNumber: {
    color: '#FF9800',
    fontWeight: '700',
  },
  todayIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF9800',
  },
  // Time Period Styles
  timeSlotsContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  timePeriodSection: {
    marginBottom: 20,
  },
  timePeriodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  timePeriodTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minWidth: 80,
    alignItems: 'center',
  },
  selectedOption: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  optionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedOptionText: {
    color: '#fff',
    fontWeight: '600',
  },
  unavailableOption: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderColor: 'rgba(244, 67, 54, 0.3)',
    opacity: 0.6,
  },
  unavailableOptionText: {
    color: 'rgba(255, 255, 255, 0.5)',
    textDecorationLine: 'line-through',
  },
  loadingSlotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  loadingSlotsText: {
    color: '#4CAF50',
    fontSize: 14,
    marginLeft: 8,
  },
  inviteErrorText: {
    color: '#ff6b6b',
    fontSize: 12,
    marginTop: 6,
  },
  invitedChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  invitedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)'
  },
  invitedChipText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default PlayScreen;


