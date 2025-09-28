import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ImageBackground } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { supabase } from '../lib/supabase';
import { useAppData } from '../context/AppDataContext';
import { ENV } from '../config/env';
import { Video, ResizeMode } from 'expo-av';

const { width } = Dimensions.get('window');

type HighlightsNavigationProp = StackNavigationProp<RootStackParamList, 'Highlights'>;

interface Highlight {
  id: string;
  title: string;
  description: string;
  video_url: string;
  game_date: string;
  views: number;
  likes: number;
  is_featured?: boolean;
  is_highlight_of_week?: boolean;
  category: string;
  priority: number;
  user_id: string;
  team_id?: string;
  user_has_liked?: boolean; // Track if current user has liked this highlight
  // Joined data
  user_profiles?: {
    username: string;
    full_name?: string;
    avatar_url?: string;
  };
  teams?: {
    name: string;
    logo_url?: string;
  };
}

const HighlightsScreen: React.FC = () => {
  const navigation = useNavigation<HighlightsNavigationProp>();
  
  // Use global app data for highlights
  const { highlights, refreshHighlights } = useAppData();
  
  const [selectedVideo, setSelectedVideo] = useState<Highlight | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    // Get current user for like status
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    
    getCurrentUser();
    console.log('✅ HighlightsScreen: Highlights already loaded from global context!', highlights.length);
  }, [highlights]);



  const handleVideoPress = (highlight: Highlight) => {
    // Increment views when video is pressed
    incrementViews(highlight.id);
    setSelectedVideo(highlight);
    setShowVideoModal(true);
  };

  const handleProfilePress = (userId: string) => {
    navigation.navigate('Profile', { userId });
  };

  // Increment views when video is pressed
  const incrementViews = async (highlightId: string) => {
    try {
      // Get current views count
      const { data: currentHighlight } = await supabase
        .from('highlights')
        .select('views')
        .eq('id', highlightId)
        .single();
      
      if (currentHighlight) {
        // Update views count
        const { error } = await supabase
          .from('highlights')
          .update({ views: currentHighlight.views + 1 })
          .eq('id', highlightId);
        
        if (error) {
          console.error('Error incrementing views:', error);
        } else {
          // Note: Views updated in database, UI will refresh on next load
        }
      }
    } catch (error) {
      console.error('Error incrementing views:', error);
    }
  };

  // Toggle like for a highlight (with optimistic updates)
  const toggleLike = async (highlightId: string) => {
    if (!currentUserId) {
      Alert.alert('Login Required', 'Please log in to like highlights');
      return;
    }

    // Find the current highlight to get its state
    const currentHighlight = highlights.find(h => h.id === highlightId);
    if (!currentHighlight) return;

    const isCurrentlyLiked = currentHighlight.user_has_liked;
    const currentLikeCount = currentHighlight.likes;

    // Note: Like status will be updated in database

    // Update selected video in modal if it's the same highlight
    if (selectedVideo && selectedVideo.id === highlightId) {
      setSelectedVideo(prev => prev ? {
        ...prev,
        likes: isCurrentlyLiked ? Math.max(currentLikeCount - 1, 0) : currentLikeCount + 1,
        user_has_liked: !isCurrentlyLiked
      } : null);
    }

    // Now perform database operations in background
    try {
      if (isCurrentlyLiked) {
        // Remove the like
        const { error: deleteError } = await supabase
          .from('user_likes')
          .delete()
          .eq('highlight_id', highlightId)
          .eq('user_id', currentUserId);

        if (deleteError) {
          console.error('Error removing like:', deleteError);
          // Error occurred, like status not changed
          return;
        }

        // Update likes count in database
        const newLikeCount = Math.max(currentLikeCount - 1, 0);
        await supabase
          .from('highlights')
          .update({ likes: newLikeCount })
          .eq('id', highlightId);

      } else {
        // Add the like
        const { error: insertError } = await supabase
          .from('user_likes')
          .insert({
            highlight_id: highlightId,
            user_id: currentUserId
          });

        if (insertError) {
          console.error('Error adding like:', insertError);
          // Error occurred, like status not changed
          return;
        }

        // Update likes count in database
        const newLikeCount = currentLikeCount + 1;
        await supabase
          .from('highlights')
          .update({ likes: newLikeCount })
          .eq('id', highlightId);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
          // Error occurred, like status not changed
    }
  };

  const closeVideoModal = () => {
    setShowVideoModal(false);
    setSelectedVideo(null);
  };

  const renderHighlightCard = (highlight: Highlight, isLarge = false) => {
    console.log('Rendering highlight card for:', highlight.title, 'User data:', highlight.user_profiles);
    return (
    <TouchableOpacity
      key={highlight.id}
      style={[styles.highlightCard, isLarge && styles.largeHighlightCard]}
      onPress={() => handleVideoPress(highlight)}
    >
      <View style={[styles.videoThumbnail, isLarge && styles.largeThumbnail]}>
        {/* Video Preview */}
        <Video
          source={{ uri: highlight.video_url }}
          style={styles.videoPreview}
          resizeMode={ResizeMode.COVER}
          shouldPlay={false}
          useNativeControls={false}
          isLooping={false}
        />
        
        <View style={styles.playOverlay}>
          <View style={styles.playButton}>
            <Ionicons name="play" size={isLarge ? 32 : 20} color="#fff" />
          </View>
        </View>
        
        {/* Minimal badge for highlight of the week */}
        {highlight.is_highlight_of_week && (
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredBadgeText}>WEEK</Text>
          </View>
        )}
      </View>
      
      <View style={styles.highlightInfo}>
        <View style={styles.titleRow}>
          <Text style={[styles.highlightTitle, isLarge && styles.largeTitle]} numberOfLines={2}>
            {highlight.title}
          </Text>
          <TouchableOpacity 
            onPress={() => handleProfilePress(highlight.user_id)}
            style={styles.profileImageContainer}
          >
            {highlight.user_profiles?.avatar_url ? (
              <Image
                source={{ 
                  uri: highlight.user_profiles.avatar_url.startsWith('http') 
                    ? highlight.user_profiles.avatar_url 
                    : `${ENV.SUPABASE_URL}/storage/v1/object/public/${highlight.user_profiles.avatar_url}`
                }}
                style={styles.profileImage}
                onError={(error) => {
                  console.log('Image load error for user:', highlight.user_profiles?.username, 'URL:', highlight.user_profiles?.avatar_url, error);
                  // You could set a state here to show default avatar on error
                }}
                onLoad={() => {
                  console.log('Image loaded successfully for user:', highlight.user_profiles?.username);
                }}
                resizeMode="cover"
                defaultSource={require('../../assets/icon.png')} // Fallback to app icon
              />
            ) : (
              <View style={styles.defaultAvatar}>
                <Ionicons name="person" size={16} color="rgba(255, 255, 255, 0.6)" />
              </View>
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.highlightMeta}>
          <Text style={styles.playerName}>
            {highlight.user_profiles?.username || highlight.user_profiles?.full_name || 'Player'}
          </Text>
          <View style={styles.statsContainer}>
            <Text style={styles.viewsText}>{highlight.views} views</Text>
            <TouchableOpacity 
              style={styles.likeButton}
              onPress={() => toggleLike(highlight.id)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={highlight.user_has_liked ? "heart" : "heart-outline"} 
                size={16} 
                color={highlight.user_has_liked ? "#ff4757" : "rgba(255, 255, 255, 0.6)"} 
              />
              <Text style={[
                styles.likesText,
                { color: highlight.user_has_liked ? "#ff4757" : "rgba(255, 255, 255, 0.6)" }
              ]}>
                {highlight.likes}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
    );
  };

  const renderHighlightsContent = () => {
    const highlightOfWeek = highlights.find(h => h.is_highlight_of_week);
    const featuredHighlights = highlights.filter(h => h.is_featured && !h.is_highlight_of_week);
    const regularHighlights = highlights.filter(h => !h.is_featured && !h.is_highlight_of_week);

    return (
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContent}>
        {/* Highlight of the Week */}
        {highlightOfWeek && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🌟 Highlight of the Week</Text>
            </View>
            {renderHighlightCard(highlightOfWeek, true)}
          </View>
        )}

        {/* Featured Highlights */}
        {featuredHighlights.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>⭐ Featured Highlights</Text>
            </View>
            <View style={styles.highlightsGrid}>
              {featuredHighlights.slice(0, 4).map(highlight => renderHighlightCard(highlight, false))}
            </View>
          </View>
        )}

        {/* All Highlights */}
        {regularHighlights.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🎥 All Highlights</Text>
            </View>
            <View style={styles.highlightsGrid}>
              {regularHighlights.map(highlight => renderHighlightCard(highlight, false))}
            </View>
          </View>
        )}

        {/* Empty State */}
        {highlights.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="videocam-outline" size={60} color="rgba(255, 255, 255, 0.3)" />
            <Text style={styles.emptyTitle}>No Highlights Available</Text>
            <Text style={styles.emptyDescription}>
              Check back later for amazing highlights!
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };


  return (
    <ImageBackground
      source={require('../../assets/hage.jpeg')}
      style={styles.container}
    >
      <View style={styles.backgroundOverlay}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Highlights</Text>
          <TouchableOpacity style={styles.searchButton}>
            <Ionicons name="search" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {renderHighlightsContent()}
        </View>

        {/* Video Modal */}
        <Modal
          visible={showVideoModal}
          animationType="fade"
          presentationStyle="overFullScreen"
          statusBarTranslucent
        >
          <View style={styles.videoModal}>
            {/* Close Button */}
            <TouchableOpacity onPress={closeVideoModal} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            
            {/* Video Player */}
            {selectedVideo && (
              <View style={styles.videoContainer}>
                <Video
                  source={{ uri: selectedVideo.video_url }}
                  style={styles.videoPlayer}
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay={false}
                  useNativeControls={true}
                  isLooping={false}
                />
              </View>
            )}
            
            {/* Minimal Info */}
            <View style={styles.videoInfo}>
              <Text style={styles.videoTitle}>{selectedVideo?.title}</Text>
              <Text style={styles.videoDescription}>{selectedVideo?.description}</Text>
              <View style={styles.videoMeta}>
                <Text style={styles.videoPlayerName}>
                  {selectedVideo?.user_profiles?.username || selectedVideo?.user_profiles?.full_name || 'Player'} • {selectedVideo?.views} views
                </Text>
                <TouchableOpacity 
                  style={styles.modalLikeButton}
                  onPress={() => selectedVideo && toggleLike(selectedVideo.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={selectedVideo?.user_has_liked ? "heart" : "heart-outline"} 
                    size={20} 
                    color={selectedVideo?.user_has_liked ? "#ff4757" : "rgba(255, 255, 255, 0.6)"} 
                  />
                  <Text style={[
                    styles.modalLikesText,
                    { color: selectedVideo?.user_has_liked ? "#ff4757" : "rgba(255, 255, 255, 0.6)" }
                  ]}>
                    {selectedVideo?.likes}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  searchButton: {
    padding: 8,
  },
  scrollContent: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  highlightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  highlightCard: {
    width: (width - 60) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  largeHighlightCard: {
    width: width - 40,
    marginBottom: 20,
  },
  videoThumbnail: {
    height: 120,
    position: 'relative',
  },
  largeThumbnail: {
    height: 200,
  },
  videoPreview: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  featuredBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  featuredBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '600',
  },
  highlightInfo: {
    padding: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  highlightTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    flex: 1,
    marginRight: 8,
  },
  profileImageContainer: {
    marginLeft: 8,
  },
  profileImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  defaultAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  highlightMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerName: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '400',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  viewsText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likesText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  videoModal: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayer: {
    width: width,
    height: width * 0.75, // Better aspect ratio
  },
  videoInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  videoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  videoDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 12,
    lineHeight: 20,
  },
  videoPlayerName: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  videoMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalLikeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalLikesText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default HighlightsScreen;
