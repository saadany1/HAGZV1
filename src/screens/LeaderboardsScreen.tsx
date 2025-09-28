import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ImageBackground,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { db } from '../lib/supabase';

type LeaderboardsNavigationProp = StackNavigationProp<RootStackParamList>;

const LeaderboardsScreen: React.FC = () => {
  const navigation = useNavigation<LeaderboardsNavigationProp>();
  
  const [mode, setMode] = useState<'players' | 'teams'>('players');
  const [query, setQuery] = useState('');
  const [division, setDivision] = useState<'All' | 'D1' | 'D2' | 'D3' | 'D4' | 'D5'>('All');
  const [range, setRange] = useState<'All-time' | 'Season' | 'Month' | 'Week'>('All-time');
  const [showFilters, setShowFilters] = useState(false);

  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const handleProfilePress = (playerId: string) => {
    navigation.navigate('Profile', { userId: playerId });
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: pData }, { data: tData }] = await Promise.all([
          db.getTopPlayers(100, query),
          db.getTopTeams(100, query),
        ]);
        setPlayers(pData || []);
        setTeams(tData || []);
      } catch (e) {
        console.error('Leaderboards load error', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [query]);
  const filteredPlayers = useMemo(() => {
    const normQ = query.trim().toLowerCase();
    return (players || [])
      .filter(p => !normQ || (p.full_name || '').toLowerCase().includes(normQ) || (p.username || '').toLowerCase().includes(normQ))
      .sort((a, b) => {
        // Primary sort by wins (descending)
        const winsA = Number(a.wins || 0);
        const winsB = Number(b.wins || 0);
        if (winsA !== winsB) {
          return winsB - winsA;
        }
        // Secondary sort by points for tie-breaking
        return Number(b.pts || 0) - Number(a.pts || 0);
      });
  }, [players, query]);

  const filteredTeams = useMemo(() => {
    const normQ = query.trim().toLowerCase();
    return (teams || [])
      .filter(t => !normQ || (t.name || '').toLowerCase().includes(normQ) || (t.division || '').toLowerCase().includes(normQ))
      .sort((a, b) => (Number(b.pts || 0) - Number(a.pts || 0)));
  }, [teams, query]);

  return (
    <ImageBackground source={require('../../assets/hage.jpeg')} style={styles.container}>
      <View style={styles.backgroundOverlay}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <LinearGradient
              colors={['rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.3)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerContainer}
            >
              <View style={styles.headerLeft}>
                <Ionicons name="trophy-outline" size={28} color="#fff" />
                <View style={styles.headerCenter}>
                  <Text style={styles.title}>Leaderboards</Text>
                  <Text style={styles.subtitle}>Top players and teams</Text>
                </View>
              </View>
              <View style={{ width: 1 }} />
            </LinearGradient>
          </View>

          <View style={styles.topBarContainer}>
            <View style={styles.topBarRow}>
              <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color="rgba(255,255,255,0.7)" />
                <TextInput
                  placeholder="Search players or teams"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={query}
                  onChangeText={setQuery}
                  style={styles.searchInput}
                />
              </View>
            </View>
            <View style={styles.controlsRow}>
              <View style={styles.inlineToggleContainer}>
                <TouchableOpacity
                  style={[styles.inlineToggleButton, mode === 'players' && styles.inlineToggleButtonActive]}
                  onPress={() => setMode('players')}
                >
                  <Text style={[styles.inlineToggleText, mode === 'players' && styles.inlineToggleTextActive]}>Players</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.inlineToggleButton, mode === 'teams' && styles.inlineToggleButtonActive]}
                  onPress={() => setMode('teams')}
                >
                  <Text style={[styles.inlineToggleText, mode === 'teams' && styles.inlineToggleTextActive]}>Teams</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilters(!showFilters)}>
                <Ionicons name="funnel-outline" size={18} color="#fff" />
                <Text style={styles.filterButtonText}>Filters</Text>
                <Ionicons name={showFilters ? 'chevron-up' : 'chevron-down'} size={16} color="#fff" />
              </TouchableOpacity>
            </View>

            {showFilters && (
              <View style={styles.dropdown}>
                <Text style={styles.dropdownLabel}>Division</Text>
                <View style={styles.chipsRow}>
                  {(['All','D1','D2','D3','D4','D5'] as const).map(d => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setDivision(d)}
                      style={[styles.chip, division === d && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, division === d && styles.chipTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.dropdownLabel, { marginTop: 10 }]}>Time Range</Text>
                <View style={styles.chipsRow}>
                  {(['All-time','Season','Month','Week'] as const).map(r => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setRange(r)}
                      style={[styles.chip, range === r && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, range === r && styles.chipTextActive]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.listContainer}>
              <View style={styles.sectionHeader}> 
                <Text style={styles.sectionTitle}>{mode === 'players' ? 'Top Players' : 'Top Teams'}</Text>
              </View>
              {mode === 'players' ? (
                filteredPlayers.map((player, idx) => {
                  const playerKey = String(player.id || idx);
                  const isOpen = !!expanded[playerKey];
                  return (
                  <TouchableOpacity key={`p-${playerKey}`} style={styles.rowCard} onPress={() => setExpanded(prev => ({ ...prev, [playerKey]: !prev[playerKey] }))}>
                    <View style={styles.rankContainer}>
                      <Text style={[
                        styles.rankText,
                        { color: idx < 3 ? '#fff' : 'rgba(255, 255, 255, 0.7)' }
                      ]}>#{idx + 1}</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.playerAvatarContainer}
                      onPress={() => handleProfilePress(player.id)}
                      activeOpacity={0.7}
                    >
                      {player.avatar_url ? (
                        <Image source={{ uri: player.avatar_url }} style={styles.playerAvatar} />
                      ) : (
                        <View style={styles.playerAvatarPlaceholder}>
                          <Text style={styles.playerAvatarText}>👤</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    <View style={styles.playerInfo}>
                      <Text style={styles.playerName} numberOfLines={1} ellipsizeMode="tail">{player.username || 'Player'}</Text>
                      <Text style={styles.playerTeam}>Wins: {player.wins ?? 0}</Text>
                      {isOpen && (
                        <View style={styles.expandedContent}>
                          <Text style={styles.expandedLine}>Matches {player.matches_played ?? 0}</Text>
                          <Text style={styles.expandedLine}>Draws {player.draws ?? 0} • Losses {player.losses ?? 0}</Text>
                          <Text style={styles.expandedLine}>MVPs {player.mvps ?? 0} • Points {Number(player.pts || 0)}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.playerStats}>
                      <Text style={styles.pointsText}>{player.wins ?? 0} wins</Text>
                      <Text style={styles.statsText}>{Number(player.pts || 0)} pts</Text>
                    </View>
                  </TouchableOpacity>
                );})
              ) : (
                filteredTeams.map((team, idx) => {
                  const teamKey = String(team.id || idx);
                  const isOpen = !!expanded[teamKey];
                  return (
                  <TouchableOpacity key={`t-${teamKey}`} style={styles.rowCard} onPress={() => setExpanded(prev => ({ ...prev, [teamKey]: !prev[teamKey] }))}>
                    <View style={styles.rankContainer}>
                      <Text style={[
                        styles.rankText,
                        { color: idx < 3 ? '#fff' : 'rgba(255, 255, 255, 0.7)' }
                      ]}>#{idx + 1}</Text>
                    </View>
                    <View style={styles.teamInfo}>
                      <Text style={styles.teamName} numberOfLines={1} ellipsizeMode="tail">{team.name}</Text>
                      <Text style={styles.teamDivision}>{team.division || 'Division'}</Text>
                      {isOpen && (
                        <View style={styles.expandedContent}>
                          <Text style={styles.expandedLine}>Wins {team.wins ?? 0} • Draws {team.draws ?? 0} • Losses {team.losses ?? 0}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.teamStats}>
                      <Text style={styles.pointsText}>{Number(team.pts || 0)} pts</Text>
                      <Text style={styles.statsText} />
                    </View>
                  </TouchableOpacity>
                );})
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  backgroundOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  header: {
    paddingHorizontal: 0,
    paddingTop: 30,
    paddingBottom: 10,
  },
  topBarContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 'auto',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flex: 1,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
  },
  inlineToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)'
  },
  inlineToggleButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  inlineToggleButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)'
  },
  inlineToggleText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  inlineToggleTextActive: {
    color: '#fff',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginLeft: 'auto',
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 6,
  },
  dropdown: {
    marginTop: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 10,
  },
  dropdownLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 88,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerCenter: {
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  
  filtersContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)'
  },
  chipActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)'
  },
  chipText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },
  listContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  rowCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  expandedContent: {
    marginTop: 8,
    gap: 4,
  },
  expandedLine: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  rankContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  rankText: {
    fontSize: 16,
    fontWeight: '600',
  },
  playerAvatarContainer: {
    marginRight: 12,
  },
  playerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  playerAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerAvatarText: {
    fontSize: 16,
  },
  playerInfo: {
    flex: 1,
    minWidth: 0,
  },
  teamInfo: {
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  playerTeam: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  teamDivision: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  playerStats: {
    alignItems: 'flex-end',
  },
  teamStats: {
    alignItems: 'flex-end',
  },
  pointsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  statsText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
});

export default LeaderboardsScreen;




