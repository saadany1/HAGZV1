import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Animated,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { db, supabase } from '../lib/supabase';
import HourglassLoader from './HourglassLoader';

interface MatchmakingComponentProps {
  teamId: string;
  teamName: string;
  division: number;
  userTeam?: any;
  onMatchFound?: (matchData: any) => void;
  navigation?: any;
}

interface MatchmakingStatus {
  in_queue: boolean;
  queue_position?: number;
  queue_count?: number;
  queue_info?: {
    preferred_date: string;
    preferred_time_slot: number;
  };
  active_match?: {
    match_id: string;
    team1_id: string;
    team2_id: string;
    division: number;
    status: string;
    match_date?: string;
    match_time_slot?: number;
    cancellation_status?: boolean;
    created_at: string;
  };
}

const MatchmakingComponent: React.FC<MatchmakingComponentProps> = ({
  teamId,
  teamName,
  division,
  userTeam,
  onMatchFound,
  navigation,
}) => {
  const [isSearching, setIsSearching] = useState(false);
  const [matchmakingStatus, setMatchmakingStatus] = useState<MatchmakingStatus | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [currentMatch, setCurrentMatch] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchStartTime, setSearchStartTime] = useState<Date | null>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [searchDuration, setSearchDuration] = useState(0);
  const [opponentTeam, setOpponentTeam] = useState<any>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSearchTimeoutModal, setShowSearchTimeoutModal] = useState(false);
  const [showCancelSuccessModal, setShowCancelSuccessModal] = useState(false);
  const [showMatchStartedModal, setShowMatchStartedModal] = useState(false);
  const [showMatchCanceledModal, setShowMatchCanceledModal] = useState(false);
  const [showCancelMatchModal, setShowCancelMatchModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isCaptain, setIsCaptain] = useState<boolean>(false);
  const [showCaptainInfoModal, setShowCaptainInfoModal] = useState(false);
  
  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Helper functions
  const getTimeSlots = () => {
    return [
      { value: 18, label: '6:00 PM', period: 'Evening' },
      { value: 19, label: '7:00 PM', period: 'Evening' },
      { value: 20, label: '8:00 PM', period: 'Evening' },
      { value: 21, label: '9:00 PM', period: 'Evening' },
      { value: 22, label: '10:00 PM', period: 'Night' },
      { value: 23, label: '11:00 PM', period: 'Night' },
      { value: 24, label: '12:00 AM', period: 'Late Night' },
      { value: 25, label: '1:00 AM', period: 'Late Night' },
      { value: 26, label: '2:00 AM', period: 'Late Night' },
    ];
  };

  const getDateDisplayText = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    if (dateString === today.toISOString().split('T')[0]) return 'Today';
    if (dateString === tomorrow.toISOString().split('T')[0]) return 'Tomorrow';
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  useEffect(() => {
    checkMatchmakingStatus();
    // Load user role
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: membership } = await supabase
            .from('team_members')
            .select('role')
            .eq('team_id', teamId)
            .eq('user_id', user.id)
            .eq('status', 'active')
            .single();
          setIsCaptain(membership?.role === 'captain');
        }
      } catch (e) {
        setIsCaptain(false);
      }
    })();
    
    // Set up real-time subscription for matches
    const subscription = supabase
      .channel('matches')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
          filter: `or(team1_id.eq.${teamId},team2_id.eq.${teamId})`,
        },
        (payload) => {
          handleMatchFound(payload.new);
        }
      )
      .subscribe();

    // Set up periodic status check every 5 seconds
    const statusInterval = setInterval(() => {
      checkMatchmakingStatus();
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearInterval(statusInterval);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [teamId]);

  // Refresh status when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      checkMatchmakingStatus();
    }, [teamId])
  );

  // Update search duration every second
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (searchStartTime && isSearching) {
      interval = setInterval(() => {
        const now = new Date();
        const duration = Math.floor((now.getTime() - searchStartTime.getTime()) / 1000);
        setSearchDuration(duration);
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [searchStartTime, isSearching]);

  // Animation effects
  useEffect(() => {
    if (isSearching) {
      // Start pulsing animation
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      
      // Start rotating animation for search icon
      const rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      );

      pulseAnimation.start();
      rotateAnimation.start();

      return () => {
        pulseAnimation.stop();
        rotateAnimation.stop();
      };
    } else {
      // Reset animations
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
    }
  }, [isSearching]);

  // Modal entrance animation
  useEffect(() => {
    if (showMatchModal) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [showMatchModal]);

  const checkMatchmakingStatus = async () => {
    try {
      const { data, error } = await db.getMatchmakingStatus(teamId);
      if (error) {
        console.error('Error checking matchmaking status:', error);
        return;
      }
      
      setMatchmakingStatus(data);
      
      // If there's an active match, fetch opponent details
      if (data?.active_match) {
        const opponentTeamId = data.active_match.team1_id === teamId ? data.active_match.team2_id : data.active_match.team1_id;
        
        if (opponentTeamId && !opponentTeam) {
          try {
            const { data: opponentData, error: opponentError } = await db.getTeamDetails(opponentTeamId);
            if (!opponentError && opponentData) {
              setOpponentTeam(opponentData);
            }
          } catch (error) {
            console.error('Error loading existing opponent:', error);
          }
        }
      }
    } catch (error) {
      console.error('Exception checking matchmaking status:', error);
    }
  };

  const refreshStatus = async () => {
    setIsRefreshing(true);
    await checkMatchmakingStatus();
    setIsRefreshing(false);
  };

  const handleMatchFound = async (matchData: any) => {
    
    setCurrentMatch(matchData);
    setIsSearching(false);
    setMatchmakingStatus({
      in_queue: false,
      active_match: matchData,
    });
    
    // Fetch opponent team details
    const opponentTeamId = matchData.team1_id === teamId ? matchData.team2_id : matchData.team1_id;
    
    if (opponentTeamId) {
      try {
        const { data: opponentData, error } = await db.getTeamDetails(opponentTeamId);
        
        if (!error && opponentData) {
          setOpponentTeam(opponentData);
        } else {
          console.error('Error fetching opponent team:', error);
        }
      } catch (error) {
        console.error('Exception fetching opponent team:', error);
      }
    }
    
    setShowMatchModal(true);
    
    if (onMatchFound) {
      onMatchFound(matchData);
    }
  };


  const handleSearchTimeout = async () => {
    setShowSearchTimeoutModal(true);
  };

  const handleContinueSearch = () => {
    setShowSearchTimeoutModal(false);
    // Reset timeout for another 5 minutes
    const timeout = setTimeout(() => {
      handleSearchTimeout();
    }, 5 * 60 * 1000);
    setTimeoutId(timeout);
  };

  const handleCancelSearch = () => {
    setShowSearchTimeoutModal(false);
    cancelMatchmaking();
  };

  const cancelMatchmaking = async () => {
    setIsLoading(true);
    
    // Clear timeout if exists
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    
    try {
      const { data, error } = await db.cancelMatchmaking(teamId);
      
      if (error) {
        console.error('Cancel matchmaking error:', error);
        showError('Failed to cancel matchmaking. Please try again.');
        return;
      }

      if (data?.success) {
        setIsSearching(false);
        setSearchStartTime(null);
        setSearchDuration(0);
        // Refresh status from database instead of just clearing local state
        await checkMatchmakingStatus();
        setShowCancelSuccessModal(true);
      } else {
        showError(data?.error || 'Failed to cancel matchmaking');
      }
    } catch (error) {
      console.error('Exception cancelling matchmaking:', error);
      showError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const startMatch = async () => {
    if (!currentMatch) return;

    setIsLoading(true);
    
    try {
      const { data, error } = await db.startMatch(currentMatch.match_id);
      
      if (error) {
        console.error('Start match error:', error);
        showError('Failed to start match. Please try again.');
        return;
      }

      if (data?.success) {
        setShowMatchModal(false);
        setShowMatchStartedModal(true);
        // You can navigate to the game screen here
      } else {
        showError(data?.error || 'Failed to start match');
      }
    } catch (error) {
      console.error('Exception starting match:', error);
      showError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelMatch = async () => {
    if (!matchmakingStatus?.active_match) return;

    setShowCancelMatchModal(true);
  };

  const handleConfirmCancelMatch = async () => {
    setShowCancelMatchModal(false);
    setIsCanceling(true);
    try {
      const { data, error } = await db.cancelMatch(
        matchmakingStatus.active_match?.match_id || '',
        teamId
      );
      
      if (error) {
        console.error('Cancel match error:', error);
        showError('Failed to cancel match');
        return;
      }

      if (data?.success) {
        setShowMatchCanceledModal(true);
        // Clear the match and allow finding a new one
        setMatchmakingStatus({ in_queue: false, active_match: undefined });
        setCurrentMatch(null);
        setOpponentTeam(null);
        setShowMatchModal(false);
      } else {
        showError(data?.error || 'Failed to cancel match');
      }
    } catch (error) {
      console.error('Cancel match exception:', error);
      showError('An unexpected error occurred');
    } finally {
      setIsCanceling(false);
    }
  };

  const handleCancelCancelMatch = () => {
    setShowCancelMatchModal(false);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setShowErrorModal(true);
  };

  const handleErrorClose = () => {
    setShowErrorModal(false);
    setErrorMessage('');
  };

  const renderMatchmakingButton = () => {
    const rotateInterpolate = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    if (isLoading) {
      return (
        <TouchableOpacity style={styles.button} disabled>
          <HourglassLoader size={20} color="#4CAF50" />
          <Text style={styles.buttonText}>Loading...</Text>
        </TouchableOpacity>
      );
    }

    if (matchmakingStatus?.active_match) {
      return (
        <TouchableOpacity 
          style={[styles.button, styles.buttonSuccess]}
          onPress={() => setShowMatchModal(true)}
        >
          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
          <Text style={[styles.buttonText, styles.buttonTextSuccess]}>Match Found</Text>
        </TouchableOpacity>
      );
    }

    if (isSearching || matchmakingStatus?.in_queue) {
      return (
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity 
            style={[styles.button, styles.buttonSearching]}
            onPress={cancelMatchmaking}
          >
            <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
              <Ionicons name="search" size={20} color="#FF9800" />
            </Animated.View>
            <Text style={[styles.buttonText, styles.buttonTextSearching]}>
              {matchmakingStatus?.queue_position 
                ? `Searching (${matchmakingStatus.queue_position}/${matchmakingStatus.queue_count})`
                : 'Searching...'
              }
            </Text>
          </TouchableOpacity>
        </Animated.View>
      );
    }

    return (
      <TouchableOpacity 
        style={styles.button}
        onPress={() => {
          if (navigation && navigation.navigate) {
            navigation.navigate('Matchmaking', {
              teamId,
              teamName,
              division,
            });
          } else {
            console.warn('Navigation not available');
          }
        }}
      >
        <Ionicons name="search" size={20} color="#4CAF50" />
        <Text style={styles.buttonText}>Find Match</Text>
      </TouchableOpacity>
    );
  };

  const renderMatchmakingContent = () => {
    
    // Show match found state
    if (matchmakingStatus?.active_match) {
      // Check if match is canceled
      if (matchmakingStatus.active_match.cancellation_status) {
        return (
          <View style={styles.canceledMatchContainer}>
            <View style={styles.canceledMatchHeader}>
              <Ionicons name="close-circle" size={24} color="#f44336" />
              <Text style={styles.canceledMatchTitle}>Match Canceled</Text>
            </View>
            
            <Text style={styles.canceledMatchDescription}>
              This match has been canceled. You can find a new match below.
            </Text>

            <TouchableOpacity 
              style={styles.findNewMatchButton}
              onPress={() => {
                if (navigation && navigation.navigate) {
                  navigation.navigate('Matchmaking', {
                    teamId,
                    teamName,
                    division,
                  });
                } else {
                  console.warn('Navigation not available');
                }
              }}
            >
              <Ionicons name="search" size={20} color="#fff" />
              <Text style={styles.findNewMatchButtonText}>Find New Match</Text>
            </TouchableOpacity>
          </View>
        );
      }

      return (
        <View style={styles.matchFoundContainer}>
          <View style={styles.matchFoundHeader}>
            <View style={styles.matchStatusIndicator} />
            <Text style={styles.matchFoundTitle}>Match Found</Text>
          </View>
          
          <View style={styles.matchDetails}>
            <Text style={styles.matchDivision}>Division {division}</Text>
            {matchmakingStatus.active_match.match_date && matchmakingStatus.active_match.match_time_slot && (
              <Text style={styles.matchDateTime}>
                {getDateDisplayText(matchmakingStatus.active_match?.match_date)} at {getTimeSlots().find(slot => slot.value === matchmakingStatus.active_match?.match_time_slot)?.label}
              </Text>
            )}
          </View>

          <View style={styles.matchTeams}>
            <View style={styles.matchTeam}>
              <Text style={styles.matchTeamName} numberOfLines={1} ellipsizeMode="tail">
                {teamName}
              </Text>
            </View>

            <View style={styles.vsContainer}>
              <Text style={styles.matchVs}>vs</Text>
            </View>

            <View style={styles.matchTeam}>
              <Text style={styles.matchTeamName} numberOfLines={1} ellipsizeMode="tail">
                {opponentTeam?.name || 'Loading...'}
              </Text>
              {!opponentTeam && (
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={() => {
                    if (matchmakingStatus.active_match) {
                      const opponentTeamId = matchmakingStatus.active_match.team1_id === teamId ? matchmakingStatus.active_match.team2_id : matchmakingStatus.active_match.team1_id;
                      if (opponentTeamId) {
                        db.getTeamDetails(opponentTeamId).then(({ data, error }) => {
                          if (!error && data) {
                            setOpponentTeam(data);
                          }
                        });
                      }
                    }
                  }}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.matchActions}>
            <TouchableOpacity 
              style={[styles.matchActionButton, styles.startMatchButton]}
              onPress={() => setShowMatchModal(true)}
            >
              <Text style={styles.matchActionButtonText}>View Details</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.matchActionButton, styles.cancelMatchButton]}
              onPress={cancelMatch}
              disabled={isCanceling}
            >
              {isCanceling ? (
                <HourglassLoader size={16} color="#666" />
              ) : (
                <Text style={styles.cancelButtonText}>Cancel</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Show searching state
    if (isSearching || matchmakingStatus?.in_queue) {
      return (
        <View style={styles.searchingContainer}>
          <View style={styles.searchingHeader}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Ionicons name="search" size={24} color="#FF9800" />
            </Animated.View>
            <Text style={styles.searchingTitle}>Searching for Match</Text>
          </View>
          
          <View style={styles.searchingDetails}>
            <Text style={styles.searchingDivision}>Division {division}</Text>
            {matchmakingStatus?.queue_info && (
              <Text style={styles.searchingDateTime}>
                {getDateDisplayText(matchmakingStatus.queue_info?.preferred_date)} at {getTimeSlots().find(slot => slot.value === matchmakingStatus.queue_info?.preferred_time_slot)?.label}
              </Text>
            )}
          </View>

          <View style={styles.searchingStatus}>
            <Text style={styles.searchingStatusText}>
              {matchmakingStatus?.queue_position 
                ? `Position ${matchmakingStatus.queue_position} of ${matchmakingStatus.queue_count} in queue`
                : 'Looking for opponents...'
              }
            </Text>
            {searchDuration > 0 && (
              <Text style={styles.searchingTime}>
                Searching for {Math.floor(searchDuration / 60)}:{(searchDuration % 60).toString().padStart(2, '0')}
              </Text>
            )}
          </View>

          <TouchableOpacity 
            style={styles.cancelSearchButton}
            onPress={cancelMatchmaking}
          >
            <Ionicons name="close" size={18} color="#fff" />
            <Text style={styles.cancelSearchButtonText}>Cancel Search</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Show default find match state
    return (
      <View style={styles.defaultContainer}>
        <View style={styles.defaultHeader}>
          <Ionicons name="search" size={24} color="#4CAF50" />
          <Text style={styles.defaultTitle}>Ready to Play?</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={refreshStatus}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <HourglassLoader size={16} color="#4CAF50" />
            ) : (
              <Ionicons name="refresh" size={20} color="#4CAF50" />
            )}
          </TouchableOpacity>
        </View>
        
        <Text style={styles.defaultDescription}>
          Find opponents in Division {division} and start your match
        </Text>

        {!isCaptain && (
          <Text style={styles.captainOnlyNote}>Only the team captain can start matchmaking.</Text>
        )}

        <TouchableOpacity 
          style={[styles.findMatchButton, !isCaptain && styles.findMatchButtonDisabled]}
          onPress={() => {
            if (!isCaptain) {
              setShowCaptainInfoModal(true);
              return;
            }
            if (navigation && navigation.navigate) {
              navigation.navigate('Matchmaking', {
                teamId,
                teamName,
                division,
              });
            } else {
              console.warn('Navigation not available');
            }
          }}
          disabled={false}
        >
          <Ionicons name="search" size={20} color="#fff" />
          <Text style={styles.findMatchButtonText}>Find Match</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderMatchmakingContent()}

      {/* Match Found Modal */}
      <Modal
        visible={showMatchModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMatchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
            </View>
            <Text style={styles.successTitle}>Match Found!</Text>
            <Text style={styles.successMessage}>
              {currentMatch?.match_date && currentMatch?.match_time_slot ? (
                `Your match is scheduled for ${getDateDisplayText(currentMatch.match_date)} at ${getTimeSlots().find(slot => slot.value === currentMatch.match_time_slot)?.label}`
              ) : (
                'A match has been found for your team!'
              )}
            </Text>
            <View style={styles.confirmationButtons}>
              <TouchableOpacity 
                style={styles.confirmationButtonSecondary}
                onPress={() => setShowMatchModal(false)}
              >
                <Text style={styles.confirmationButtonTextSecondary}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.confirmationButtonPrimary}
                onPress={startMatch}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmationButtonTextPrimary}>Start Match</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Search Timeout Modal */}
      <Modal
        visible={showSearchTimeoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelSearch}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModal}>
            <View style={styles.confirmationIconContainer}>
              <Ionicons name="time" size={32} color="rgba(255, 255, 255, 0.9)" />
            </View>
            <Text style={styles.confirmationTitle}>Search Timeout</Text>
            <Text style={styles.confirmationMessage}>
              No match found after 5 minutes. Would you like to continue searching or cancel?
            </Text>
            <View style={styles.confirmationButtons}>
              <TouchableOpacity 
                style={styles.confirmationButtonSecondary}
                onPress={handleCancelSearch}
              >
                <Text style={styles.confirmationButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.confirmationButtonPrimary}
                onPress={handleContinueSearch}
              >
                <Text style={styles.confirmationButtonTextPrimary}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel Matchmaking Success Modal */}
      <Modal
        visible={showCancelSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCancelSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark" size={32} color="rgba(255, 255, 255, 0.9)" />
            </View>
            <Text style={styles.successTitle}>Search Cancelled</Text>
            <Text style={styles.successMessage}>
              Matchmaking cancelled successfully.
            </Text>
            <TouchableOpacity 
              style={styles.successButton}
              onPress={() => setShowCancelSuccessModal(false)}
            >
              <Text style={styles.successButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Match Started Success Modal */}
      <Modal
        visible={showMatchStartedModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMatchStartedModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark" size={32} color="rgba(255, 255, 255, 0.9)" />
            </View>
            <Text style={styles.successTitle}>Match Started!</Text>
            <Text style={styles.successMessage}>
              Good luck to both teams!
            </Text>
            <TouchableOpacity 
              style={styles.successButton}
              onPress={() => setShowMatchStartedModal(false)}
            >
              <Text style={styles.successButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Match Canceled Success Modal */}
      <Modal
        visible={showMatchCanceledModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMatchCanceledModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark" size={32} color="rgba(255, 255, 255, 0.9)" />
            </View>
            <Text style={styles.successTitle}>Match Canceled</Text>
            <Text style={styles.successMessage}>
              Match canceled successfully.
            </Text>
            <TouchableOpacity 
              style={styles.successButton}
              onPress={() => setShowMatchCanceledModal(false)}
            >
              <Text style={styles.successButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Cancel Match Confirmation Modal */}
      <Modal
        visible={showCancelMatchModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelCancelMatch}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModal}>
            <View style={styles.confirmationIconContainer}>
              <Ionicons name="warning" size={32} color="rgba(255, 255, 255, 0.9)" />
            </View>
            <Text style={styles.confirmationTitle}>Cancel Match</Text>
            <Text style={styles.confirmationMessage}>
              Are you sure you want to cancel this match? This action cannot be undone.
            </Text>
            <View style={styles.confirmationButtons}>
              <TouchableOpacity 
                style={styles.confirmationButtonSecondary}
                onPress={handleCancelCancelMatch}
              >
                <Text style={styles.confirmationButtonTextSecondary}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.confirmationButtonDanger}
                onPress={handleConfirmCancelMatch}
              >
                <Text style={styles.confirmationButtonTextPrimary}>Yes, Cancel</Text>
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

      {/* Captain Only Info Modal */}
      <Modal
        visible={showCaptainInfoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCaptainInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModal}>
            <View style={styles.confirmationIconContainer}>
              <Ionicons name="information-circle" size={32} color="rgba(255, 255, 255, 0.9)" />
            </View>
            <Text style={styles.confirmationTitle}>Captain Required</Text>
            <Text style={styles.confirmationMessage}>
              You must be the team captain to start matchmaking. Please contact your captain to begin a search.
            </Text>
            <TouchableOpacity 
              style={styles.successButton}
              onPress={() => setShowCaptainInfoModal(false)}
            >
              <Text style={styles.successButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  division: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 12,
  },
  buttonSuccess: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderColor: '#4CAF50',
  },
  buttonSearching: {
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    borderColor: '#FF9800',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  buttonTextSuccess: {
    color: '#4CAF50',
  },
  buttonTextSearching: {
    color: '#FF9800',
  },
  queueInfo: {
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.2)',
  },
  queueText: {
    color: '#FF9800',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  queueDetails: {
    color: '#4CAF50',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500',
  },
  queuePosition: {
    color: 'rgba(255, 152, 0, 0.8)',
    fontSize: 12,
    marginBottom: 4,
  },
  searchTime: {
    color: '#FF9800',
    fontSize: 14,
    fontWeight: '600',
  },
  matchInfo: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.2)',
    marginTop: 12,
  },
  matchInfoTitle: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  matchTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  matchTeam: {
    flex: 1,
    alignItems: 'center',
  },
  matchTeamName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  matchTeamLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  matchVs: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 16,
  },
  viewMatchButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
    alignItems: 'center',
  },
  viewMatchButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#ccc',
    fontSize: 11,
    fontWeight: '500',
  },
  // Enhanced Matchmaking States
  matchFoundContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  matchFoundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  matchStatusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 12,
  },
  matchFoundTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  matchDetails: {
    marginBottom: 20,
  },
  matchDivision: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  matchDateTime: {
    color: '#999',
    fontSize: 13,
    fontWeight: '500',
  },
  matchActions: {
    flexDirection: 'row',
    gap: 12,
  },
  matchActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  startMatchButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelMatchButton: {
    backgroundColor: 'transparent',
  },
  matchActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  cancelButtonText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  // Searching State
  searchingContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  searchingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchingTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 8,
  },
  searchingDetails: {
    marginBottom: 16,
  },
  searchingDivision: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  searchingDateTime: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '500',
  },
  searchingStatus: {
    marginBottom: 20,
  },
  searchingStatusText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  searchingTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  cancelSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    alignSelf: 'center',
  },
  cancelSearchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  // Default State
  defaultContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  defaultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  defaultTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 8,
    flex: 1,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  defaultDescription: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  findMatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 8,
  },
  findMatchButtonDisabled: {
    backgroundColor: 'rgba(76, 175, 80, 0.5)',
  },
  findMatchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  captainOnlyNote: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
  },
  // Canceled Match State
  canceledMatchContainer: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.3)',
    alignItems: 'center',
  },
  canceledMatchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  canceledMatchTitle: {
    color: '#f44336',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  canceledMatchDescription: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  findNewMatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  findNewMatchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Date and Time Selection Modal Styles
  dateTimeModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  dateTimeScrollView: {
    maxHeight: 400,
  },
  selectionSection: {
    marginBottom: 24,
  },
  selectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  dateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minWidth: 80,
    alignItems: 'center',
  },
  timeOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    fontSize: 12,
    fontWeight: '500',
  },
  selectedOptionText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
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
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  teamCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
  },
  teamLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
  },
  teamStats: {
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 2,
  },
  vsContainer: {
    paddingHorizontal: 16,
  },
  vsText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  matchStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  statusText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 6,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  startButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 6,
  },
  // Modal Styles
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
    alignItems: 'center',
    width: '100%',
    maxWidth: 280,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
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
  successIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
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
  successTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
  },
  confirmationTitle: {
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
  confirmationMessage: {
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
  confirmationButtonPrimary: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
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
});

export default MatchmakingComponent;
