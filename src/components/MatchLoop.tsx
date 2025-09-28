import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  Dimensions,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';

interface MatchItem {
  id: string;
  type: 'match' | 'booking';
  title: string;
  subtitle: string;
  time: string;
  date: string;
  badge: string;
  badgeColor: string;
  onPress: () => void;
}

interface MatchLoopProps {
  matches: MatchItem[];
  speed?: number;
  direction?: 'left' | 'right';
  gap?: number;
  pauseOnHover?: boolean;
  scaleOnHover?: boolean;
  fadeOut?: boolean;
  fadeOutColor?: string;
  containerHeight?: number;
}

const MatchLoop: React.FC<MatchLoopProps> = ({
  matches,
  speed = 120,
  direction = 'left',
  gap = 20,
  pauseOnHover = true,
  scaleOnHover = true,
  fadeOut = true,
  fadeOutColor = '#ffffff',
  containerHeight = 160,
}) => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const { width: screenWidth } = Dimensions.get('window');
  const itemWidth = 280; // Width of each match card
  const totalWidth = (itemWidth + gap) * matches.length * 2; // Double for seamless loop

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(scrollX, {
        toValue: direction === 'left' ? -totalWidth / 2 : totalWidth / 2,
        duration: (totalWidth / 2) * (1000 / speed),
        useNativeDriver: true,
      })
    );
    animation.start();

    return () => animation.stop();
  }, [scrollX, totalWidth, speed, direction]);

  const renderMatchCard = (match: MatchItem, index: number) => (
    <TouchableOpacity
      key={`${match.id}-${index}`}
      style={[styles.matchCard, { marginRight: gap }]}
      onPress={match.onPress}
      activeOpacity={0.8}
    >
      <View style={styles.matchHeader}>
        <View style={styles.matchTypeContainer}>
          <View style={[styles.matchTypeBadge, { backgroundColor: match.badgeColor }]}>
            <Text style={styles.matchTypeText}>{match.badge}</Text>
          </View>
        </View>
        <Text style={styles.matchTime}>{match.time}</Text>
      </View>

      <View style={styles.matchContent}>
        <Text style={styles.matchTitle} numberOfLines={1}>
          {match.title}
        </Text>
        <Text style={styles.matchSubtitle} numberOfLines={1}>
          {match.subtitle}
        </Text>
      </View>

      <View style={styles.matchFooter}>
        <Text style={styles.matchDate}>{match.date}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { height: containerHeight }]}>
      <Animated.View
        style={[
          styles.scrollContainer,
          {
            transform: [{ translateX: scrollX }],
            width: totalWidth,
          },
        ]}
      >
        {/* First set of matches */}
        {matches.map((match, index) => renderMatchCard(match, index))}
        {/* Second set for seamless loop */}
        {matches.map((match, index) => renderMatchCard(match, index + matches.length))}
      </Animated.View>
      
      {/* Fade out gradients */}
      {fadeOut && (
        <>
          <View style={[styles.fadeGradient, styles.fadeLeft, { backgroundColor: fadeOutColor }]} />
          <View style={[styles.fadeGradient, styles.fadeRight, { backgroundColor: fadeOutColor }]} />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  scrollContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    width: 280,
    minHeight: 140,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  matchTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  matchTypeText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#fff',
  },
  matchTime: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  matchContent: {
    flex: 1,
    marginBottom: 12,
  },
  matchTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  matchSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  matchFooter: {
    alignItems: 'center',
  },
  matchDate: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '500',
  },
  fadeGradient: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 50,
    zIndex: 1,
  },
  fadeLeft: {
    left: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  fadeRight: {
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
});

export default MatchLoop;
