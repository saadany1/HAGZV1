import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';

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

interface BookingDetailsRouteParams {
  booking: UpcomingBooking;
}

const BookingDetailsScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { booking } = route.params as BookingDetailsRouteParams;

  return (
    <ImageBackground source={require('../../assets/hage.jpeg')} style={styles.container}>
      <View style={styles.backgroundOverlay}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Match Details</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Main Card */}
          <View style={styles.mainCard}>
            <View style={styles.pitchHeader}>
              <Text style={styles.pitchName}>{booking.pitch_name}</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{booking.status}</Text>
              </View>
            </View>
            
            <View style={styles.dateTimeSection}>
              <View style={styles.dateContainer}>
                <Ionicons name="calendar" size={24} color="#4CAF50" />
                <View style={styles.dateInfo}>
                  <Text style={styles.dateLabel}>Date</Text>
                  <Text style={styles.dateValue}>
                    {new Date(booking.date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                </View>
              </View>
              
              <View style={styles.timeContainer}>
                <Ionicons name="time" size={24} color="#4CAF50" />
                <View style={styles.timeInfo}>
                  <Text style={styles.timeLabel}>Time</Text>
                  <Text style={styles.timeValue}>{booking.time}</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.locationSection}>
              <Ionicons name="location" size={24} color="#4CAF50" />
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>Location</Text>
                <Text style={styles.locationValue}>{booking.pitch_location}</Text>
              </View>
            </View>
          </View>

          {/* Details Cards */}
          <View style={styles.detailsSection}>
            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <Ionicons name="people" size={24} color="#4CAF50" />
                <Text style={styles.detailTitle}>Players</Text>
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.playerCount}>
                  {booking.current_players}/{booking.max_players}
                </Text>
                <Text style={styles.playerLabel}>players joined</Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${(booking.current_players / booking.max_players) * 100}%` }
                    ]} 
                  />
                </View>
              </View>
            </View>

            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <Ionicons name="card" size={24} color="#4CAF50" />
                <Text style={styles.detailTitle}>Pricing</Text>
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.priceValue}>{booking.price}</Text>
                <Text style={styles.priceLabel}>per hour</Text>
              </View>
            </View>

            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <Ionicons name="information-circle" size={24} color="#4CAF50" />
                <Text style={styles.detailTitle}>Match Info</Text>
              </View>
              <View style={styles.detailContent}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Status:</Text>
                  <Text style={styles.infoValue}>{booking.status}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Match ID:</Text>
                  <Text style={styles.infoValue}>{booking.id.slice(0, 8)}...</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsSection}>
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={() => navigation.navigate('Chat', { booking })}
            >
              <Ionicons name="chatbubbles" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Chat with Players</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.secondaryButton}>
              <Ionicons name="share" size={20} color="#4CAF50" />
              <Text style={styles.secondaryButtonText}>Share Match</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  mainCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pitchHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  pitchName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dateTimeSection: {
    marginBottom: 20,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateInfo: {
    marginLeft: 16,
    flex: 1,
  },
  timeInfo: {
    marginLeft: 16,
    flex: 1,
  },
  dateLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  timeLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  timeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  locationSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationInfo: {
    marginLeft: 16,
    flex: 1,
  },
  locationLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  locationValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  detailsSection: {
    marginBottom: 20,
  },
  detailCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 12,
  },
  detailContent: {
    paddingLeft: 36,
  },
  playerCount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4CAF50',
    marginBottom: 4,
  },
  playerLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4CAF50',
    marginBottom: 4,
  },
  priceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  actionsSection: {
    paddingBottom: 40,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default BookingDetailsScreen;
