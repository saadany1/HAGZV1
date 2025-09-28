import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../lib/supabase';

interface MatchmakingScreenProps {
  navigation: any;
  route: {
    params: {
      teamId: string;
      teamName: string;
      division: number;
    };
  };
}

const MatchmakingScreen: React.FC<MatchmakingScreenProps> = ({ navigation, route }) => {
  const { teamId, teamName, division } = route.params;
  
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<number[]>([18, 19, 20, 21, 22, 23, 24, 25, 26]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [showQueuedModal, setShowQueuedModal] = useState(false);
  const [showFoundModal, setShowFoundModal] = useState(false);
  const [queuedText, setQueuedText] = useState('');
  const [foundText, setFoundText] = useState('');

  // Load available time slots for selected date
  const loadAvailableSlots = async (date: string) => {
    setLoadingSlots(true);
    try {
      const { data, error } = await db.getAvailableTimeSlots(date);
      if (error) {
        console.error('Error loading available slots:', error);
        // Fallback to all slots if error
        setAvailableSlots([18, 19, 20, 21, 22, 23, 24, 25, 26]);
      } else {
        setAvailableSlots(data?.available_slots || [18, 19, 20, 21, 22, 23, 24, 25, 26]);
      }
    } catch (error) {
      console.error('Exception loading available slots:', error);
      setAvailableSlots([18, 19, 20, 21, 22, 23, 24, 25, 26]);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Helper functions for date and time
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
        dateString,
        day: currentDate.getDate(),
        month: currentDate.getMonth(),
        year: currentDate.getFullYear(),
        isCurrentMonth,
        isToday,
        isPast,
        weekday: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
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

  const findMatch = async () => {
    if (!teamId) {
      Alert.alert('Error', 'Team ID is required');
      return;
    }

    if (!selectedDate || selectedTimeSlot === null) {
      Alert.alert('Error', 'Please select a date and time slot');
      return;
    }

    setIsLoading(true);

    try {
      // First, check if the pitch is available
      const { data: availabilityData, error: availabilityError } = await db.checkPitchAvailability(
        selectedDate, 
        selectedTimeSlot
      );

      if (availabilityError) {
        console.error('Check pitch availability error:', availabilityError);
        Alert.alert('Error', 'Failed to check pitch availability. Please try again.');
        setIsLoading(false);
        return;
      }

      if (!availabilityData?.available) {
        Alert.alert(
          'Pitch Already Booked',
          availabilityData?.error || 'This time slot is already booked. Please select another time or date.',
          [
            {
              text: 'OK',
              style: 'default'
            }
          ]
        );
        setIsLoading(false);
        return;
      }

      // If pitch is available, proceed with matchmaking
      const { data, error } = await db.findMatch(teamId, division, selectedDate, selectedTimeSlot);
      
      if (error) {
        console.error('Find match error:', error);
        Alert.alert('Error', 'Failed to start matchmaking. Please try again.');
        setIsLoading(false);
        return;
      }

      if (data?.success) {
        if (data.match_found) {
          // Match found immediately - styled modal
          setFoundText(`Great! A match has been found for ${getDateDisplayText(selectedDate)} at ${getTimeSlots().find(slot => slot.value === selectedTimeSlot)?.label}.`);
          setShowFoundModal(true);
        } else {
          // Added to queue - styled modal
          setQueuedText(`Your team has been added to the matchmaking queue for ${getDateDisplayText(selectedDate)} at ${getTimeSlots().find(slot => slot.value === selectedTimeSlot)?.label}. You will be notified when a match is found.`);
          setShowQueuedModal(true);
        }
      } else {
        Alert.alert('Error', data?.error || 'Failed to start matchmaking');
      }
    } catch (error) {
      console.error('Exception finding match:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Match</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Team Info */}
        <View style={styles.teamInfo}>
          <Text style={styles.teamName}>{teamName}</Text>
          <Text style={styles.teamDivision}>Division {division}</Text>
        </View>

        {/* Date Selection */}
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

        {/* Time Selection */}
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

        {/* Selected Info */}
        {selectedDate && selectedTimeSlot && (
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedInfoTitle}>Selected Match Time</Text>
            <Text style={styles.selectedInfoText}>
              {getDateDisplayText(selectedDate)} at {getTimeSlots().find(slot => slot.value === selectedTimeSlot)?.label}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[
            styles.startSearchButton,
            (!selectedDate || selectedTimeSlot === null) && styles.disabledButton
          ]}
          onPress={findMatch}
          disabled={!selectedDate || selectedTimeSlot === null || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="search" size={20} color="#fff" />
              <Text style={styles.startSearchButtonText}>Start Search</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Queued Modal */}
      {showQueuedModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons name="time" size={20} color="#4CAF50" />
            </View>
            <Text style={styles.modalTitle}>Searching for Match</Text>
            <Text style={styles.modalText}>{queuedText}</Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setShowQueuedModal(false)}>
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Found Modal */}
      {showFoundModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            </View>
            <Text style={styles.modalTitle}>Match Found!</Text>
            <Text style={styles.modalText}>{foundText}</Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setShowFoundModal(false)}>
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  teamInfo: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 24,
  },
  teamName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  teamDivision: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '500',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  // Calendar Styles
  calendarWrapper: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  calendarHeader: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  calendarMonthTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  calendarWeekdays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  calendarWeekday: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '600',
    width: 36,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  calendarDay: {
    width: 36,
    height: 36,
    backgroundColor: 'transparent',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
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
  selectedInfo: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  selectedInfoTitle: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  selectedInfoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  bottomContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  startSearchButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  startSearchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal styles (match app styling)
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  modalCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  modalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  modalButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)'
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
});

export default MatchmakingScreen;
