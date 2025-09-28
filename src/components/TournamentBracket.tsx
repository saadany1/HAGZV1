import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface Match {
  id: string;
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
  team1_score: number;
  team2_score: number;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  scheduled_time?: string;
  round_number: number;
  match_number: number;
}

interface TournamentBracketProps {
  tournamentId: string;
  matches: Match[];
  onMatchPress?: (match: Match) => void;
}

const TournamentBracket: React.FC<TournamentBracketProps> = ({
  tournamentId,
  matches,
  onMatchPress,
}) => {
  const getRounds = () => {
    const rounds: { [key: number]: Match[] } = {};
    matches.forEach(match => {
      if (!rounds[match.round_number]) {
        rounds[match.round_number] = [];
      }
      rounds[match.round_number].push(match);
    });
    return rounds;
  };

  const getRoundName = (roundNumber: number, totalRounds: number) => {
    if (roundNumber === 1) return 'First Round';
    if (roundNumber === totalRounds) return 'Final';
    if (roundNumber === totalRounds - 1) return 'Semi-Final';
    if (roundNumber === totalRounds - 2) return 'Quarter-Final';
    return `Round ${roundNumber}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return '#FF4444';
      case 'completed':
        return '#4CAF50';
      case 'scheduled':
        return 'rgba(255, 255, 255, 0.6)';
      default:
        return 'rgba(255, 255, 255, 0.4)';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'live':
        return 'LIVE';
      case 'completed':
        return 'FT';
      case 'scheduled':
        return 'Today';
      default:
        return 'TBD';
    }
  };

  const formatTime = (scheduledTime?: string) => {
    if (!scheduledTime) return 'TBD';
    const date = new Date(scheduledTime);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const renderMatchCard = (match: Match) => (
    <TouchableOpacity
      key={match.id}
      style={styles.matchCard}
      onPress={() => onMatchPress?.(match)}
    >
      <View style={styles.matchHeader}>
        <View style={styles.matchStatus}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(match.status) }]} />
          <Text style={styles.statusText}>{getStatusText(match.status)}</Text>
        </View>
        <Text style={styles.matchTime}>{formatTime(match.scheduled_time)}</Text>
      </View>

      <View style={styles.teamsContainer}>
        {/* Team 1 */}
        <View style={styles.teamContainer}>
          <View style={styles.teamLogoContainer}>
            {match.team1?.logo_url ? (
              <Image 
                source={{ uri: match.team1.logo_url }} 
                style={styles.teamLogo}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.teamLogoPlaceholder}>
                <Ionicons name="people" size={24} color="rgba(255, 255, 255, 0.6)" />
              </View>
            )}
          </View>
          <Text style={styles.teamName} numberOfLines={1}>
            {match.team1?.name || 'TBD'}
          </Text>
        </View>

        {/* VS Section */}
        <View style={styles.vsContainer}>
          <View style={styles.vsLine} />
          <Text style={styles.vsText}>VS</Text>
          <View style={styles.vsLine} />
        </View>

        {/* Team 2 */}
        <View style={styles.teamContainer}>
          <View style={styles.teamLogoContainer}>
            {match.team2?.logo_url ? (
              <Image 
                source={{ uri: match.team2.logo_url }} 
                style={styles.teamLogo}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.teamLogoPlaceholder}>
                <Ionicons name="people" size={24} color="rgba(255, 255, 255, 0.6)" />
              </View>
            )}
          </View>
          <Text style={styles.teamName} numberOfLines={1}>
            {match.team2?.name || 'TBD'}
          </Text>
        </View>
      </View>

      {/* Score (only show if match is completed or live) */}
      {(match.status === 'completed' || match.status === 'live') && (
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>{match.team1_score}</Text>
          <Text style={styles.scoreSeparator}>-</Text>
          <Text style={styles.scoreText}>{match.team2_score}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const rounds = getRounds();
  const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  const totalRounds = roundNumbers.length;

  if (matches.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="trophy-outline" size={60} color="rgba(255, 255, 255, 0.3)" />
        <Text style={styles.emptyTitle}>No Matches Yet</Text>
        <Text style={styles.emptyDescription}>
          Tournament bracket will be generated when the tournament starts
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {roundNumbers.map(roundNumber => (
        <View key={roundNumber} style={styles.roundContainer}>
          <Text style={styles.roundTitle}>{getRoundName(roundNumber, totalRounds)}</Text>
          <View style={styles.matchesContainer}>
            {rounds[roundNumber].map(match => renderMatchCard(match))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  roundContainer: {
    marginBottom: 32,
  },
  roundTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  matchesContainer: {
    gap: 16,
  },
  matchCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  matchStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  matchTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  teamLogoContainer: {
    width: 50,
    height: 50,
  },
  teamLogo: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  teamLogoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 100,
  },
  vsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    gap: 8,
  },
  vsLine: {
    width: 20,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  vsText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  scoreText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scoreSeparator: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default TournamentBracket;