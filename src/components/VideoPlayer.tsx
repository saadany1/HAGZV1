import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface VideoPlayerProps {
  videoSource: any;
  thumbnailSource?: any;
  title?: string;
  date?: string;
  style?: any;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoSource,
  thumbnailSource,
  title = "Early Stage of Football Industry",
  date = "June, 29",
  style,
}) => {
  const [isPlaying, setIsPlaying] = useState(false); // User starts the video
  const [showControls, setShowControls] = useState(false);
  const [videoStatus, setVideoStatus] = useState<AVPlaybackStatus | null>(null);
  const videoRef = useRef<Video>(null);

  const handlePlayPause = async () => {
    if (videoRef.current) {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVideoPress = () => {
    // Always toggle play/pause when video is pressed
    handlePlayPause();
    // Show controls briefly when toggling
    setShowControls(true);
    // Hide controls after 3 seconds
    setTimeout(() => setShowControls(false), 3000);
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    setVideoStatus(status);
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
    }
  };

  const formatTime = (millis: number) => {
    const minutes = Math.floor(millis / 60000);
    const seconds = Math.floor((millis % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity 
        style={styles.videoContainer}
        onPress={handleVideoPress}
        activeOpacity={0.9}
      >
        {/* Video element - always visible and looping */}
        <Video
          ref={videoRef}
          style={styles.video}
          source={videoSource}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isPlaying}
          isLooping={true}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        />
        
        {/* Removed dark overlay - video is always at full brightness */}

        {/* Video Info Overlay */}
        <View style={styles.videoInfo}>
          <Text style={styles.videoTitle}>{title}</Text>
          <Text style={styles.videoDate}>{date}</Text>
        </View>

        {/* Play/Pause Button - always visible */}
        <View style={styles.playButtonContainer}>
          <TouchableOpacity style={styles.playButton} onPress={handlePlayPause}>
            <Ionicons name={isPlaying ? "pause" : "play"} size={32} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Video Label */}
        <View style={styles.videoLabelContainer}>
          <Text style={styles.videoLabel}>VIDEO</Text>
        </View>

        {/* Controls Overlay - show when playing and controls are visible */}
        {isPlaying && showControls && (
          <View style={styles.controlsOverlay}>
            <TouchableOpacity style={styles.controlButton} onPress={handlePlayPause}>
              <Ionicons name="pause" size={24} color="#fff" />
            </TouchableOpacity>
            
            {/* Progress Bar */}
            {videoStatus?.isLoaded && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        width: `${videoStatus.durationMillis ? (videoStatus.positionMillis / videoStatus.durationMillis) * 100 : 0}%` 
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.timeText}>
                  {formatTime(videoStatus.positionMillis || 0)} / {formatTime(videoStatus.durationMillis || 0)}
                </Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoInfo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 80,
    zIndex: 10,
  },
  videoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  videoDate: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  playButtonContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }],
    zIndex: 10,
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  videoLabelContainer: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 10,
  },
  videoLabel: {
    color: '#4CAF50',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  controlsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlButton: {
    marginRight: 15,
    padding: 8,
  },
  progressContainer: {
    flex: 1,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginBottom: 5,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'right',
  },
});

export default VideoPlayer;
