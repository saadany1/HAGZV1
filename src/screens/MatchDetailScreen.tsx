import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MatchDetailScreenProps {
  route: {
    params: {
      match: any;
    };
  };
  navigation: any;
}

const MatchDetailScreen: React.FC<MatchDetailScreenProps> = ({ route, navigation }) => {
  const { match } = route.params;

  const renderMatchDetails = () => {
    if (match?.type === 'match') {
      return (
        <View style={styles.detailsContainer}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎮 Match Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Type:</Text>
              <Text style={styles.infoValue}>Ranked Match</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Division:</Text>
              <Text style={styles.infoValue}>Division {match?.division || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status:</Text>
              <Text style={styles.infoValue}>{match?.status || 'Scheduled'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Duration:</Text>
              <Text style={styles.infoValue}>{match?.match_duration ? `${match.match_duration} minutes` : '90 minutes'}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚽ Teams</Text>
            <View style={styles.teamsContainer}>
              <View style={styles.teamContainer}>
                <Text style={styles.teamName}>{match?.team1?.name || 'TBD'}</Text>
                <Text style={styles.teamScore}>{match?.team1_score || 0}</Text>
              </View>
              <Text style={styles.vsText}>VS</Text>
              <View style={styles.teamContainer}>
                <Text style={styles.teamName}>{match?.team2?.name || 'TBD'}</Text>
                <Text style={styles.teamScore}>{match?.team2_score || 0}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📅 Schedule</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date:</Text>
              <Text style={styles.infoValue}>
                {match?.match_date ? new Date(match.match_date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : 'N/A'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Time:</Text>
              <Text style={styles.infoValue}>
                {match?.time_slot ? `${match.time_slot}:00` : 'N/A'}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📍 Location</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Pitch:</Text>
              <Text style={styles.infoValue}>{match?.pitch_name || 'TBD'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Address:</Text>
              <Text style={styles.infoValue}>{match?.pitch_location || 'TBD'}</Text>
            </View>
            {match?.pitch_id && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Pitch ID:</Text>
                <Text style={styles.infoValue}>{match.pitch_id}</Text>
              </View>
            )}
          </View>
        </View>
      );
    } else {
      return (
        <View style={styles.detailsContainer}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎮 Booking Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Type:</Text>
              <Text style={styles.infoValue}>Friendly Match</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status:</Text>
              <Text style={styles.infoValue}>{match?.status || 'Scheduled'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Booking ID:</Text>
              <Text style={styles.infoValue}>{match?.id || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📍 Location</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Pitch:</Text>
              <Text style={styles.infoValue}>{match?.pitch_name || 'TBD'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Address:</Text>
              <Text style={styles.infoValue}>{match?.pitch_location || 'TBD'}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📅 Schedule</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date:</Text>
              <Text style={styles.infoValue}>
                {match?.date ? new Date(match.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : 'N/A'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Time:</Text>
              <Text style={styles.infoValue}>{match?.time || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👥 Players & Cost</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Current Players:</Text>
              <Text style={styles.infoValue}>{match?.current_players || 0}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Maximum Players:</Text>
              <Text style={styles.infoValue}>{match?.max_players || 0}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Price per Player:</Text>
              <Text style={styles.infoValue}>{match?.price || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Spots Available:</Text>
              <Text style={styles.infoValue}>
                {match?.max_players && match?.current_players 
                  ? match.max_players - match.current_players 
                  : 'N/A'}
              </Text>
            </View>
          </View>
        </View>
      );
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/hage.jpeg')}
      style={styles.container}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {match?.type === 'match' ? 'Match Details' : 'Booking Details'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderMatchDetails()}
      </ScrollView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  detailsContainer: {
    paddingBottom: 30,
  },
  section: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    fontWeight: '500',
  },
  infoValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 10,
  },
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  teamContainer: {
    flex: 1,
    alignItems: 'center',
  },
  teamName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  teamScore: {
    color: '#4CAF50',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  vsText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 20,
  },
});

export default MatchDetailScreen;



