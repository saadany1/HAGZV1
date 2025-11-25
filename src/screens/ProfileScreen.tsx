import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ImageBackground,
  TextInput,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { auth, db, supabase } from '../lib/supabase';
import HourglassLoader from '../components/HourglassLoader';

type ProfileNavigationProp = StackNavigationProp<RootStackParamList, 'Profile'>;
type ProfileRouteProp = RouteProp<RootStackParamList, 'Profile'>;

const { width } = Dimensions.get('window');

interface UserProfile {
  username: string;
  full_name?: string;
  age?: number;
  position?: string;
  height?: string;
  weight?: string;
  country?: string;
  preferred_foot?: string;
  avatar_url?: string;
  profile_picture?: string;
  xp: number;
  level: number;
  division: number;
  stats: {
    matches_played: number;
    wins: number;
    draws: number;
    losses: number;
    mvps: number;
    goals?: number;
    assists?: number;
  };
}

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<ProfileNavigationProp>();
  const route = useRoute<ProfileRouteProp>();
  const { userId } = route.params || {};
  const [activeTab, setActiveTab] = useState('Profile');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    username: '',
    age: '',
    height: '',
    weight: '',
    country: '',
    preferred_foot: '',
    position: '',
  });

  // Cache refs to prevent unnecessary reloads
  const profileCacheRef = useRef<{ [key: string]: { data: UserProfile; timestamp: number } }>({});
  const lastLoadedUserIdRef = useRef<string | null>(null);
  const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes for profile screen

  const tabs = ['Profile', 'Matches', 'Stats', 'Career'];

  // Check local cache first to avoid unnecessary loading states
  const getCachedProfile = (targetUserId: string): UserProfile | null => {
    const cached = profileCacheRef.current[targetUserId];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    return null;
  };

  // Cache profile data locally
  const setCachedProfile = (targetUserId: string, profileData: UserProfile) => {
    profileCacheRef.current[targetUserId] = {
      data: profileData,
      timestamp: Date.now()
    };
  };

  // Load user profile from Supabase with smart caching
  const loadUserProfile = async (forceReload: boolean = false) => {
    try {
      const targetUserId = userId || (await auth.getCurrentUser())?.id;
      if (!targetUserId) return;

      // Check if we need to reload
      const isSameUser = lastLoadedUserIdRef.current === targetUserId;
      const cachedProfile = getCachedProfile(targetUserId);

      // Use cached data if available and not forcing reload
      if (!forceReload && isSameUser && cachedProfile) {
        setUserProfile(cachedProfile);
        setIsLoadingProfile(false);
        return;
      }

      // Only show loading state if we don't have cached data
      if (!cachedProfile) {
        setIsLoadingProfile(true);
      }

      const { data: profile } = await db.getUserProfile(targetUserId);
      if (profile) {
        const formattedProfile: UserProfile = {
          username: profile.username || profile.full_name || 'Player',
          full_name: profile.full_name,
          age: profile.age,
          position: profile.position,
          height: profile.height,
          weight: profile.weight,
          country: profile.country,
          preferred_foot: profile.preferred_foot,
          avatar_url: profile.avatar_url || profile.profile_picture,
          xp: profile.xp || 0,
          level: profile.level || 1,
          division: profile.division || 5,
          stats: {
            matches_played: profile.matches_played || 0,
            wins: profile.wins || 0,
            draws: profile.draws || 0,
            losses: profile.losses || 0,
            mvps: profile.mvps || 0,
            goals: profile.goals || 0,
            assists: profile.assists || 0,
          },
        };

        // Update state and cache
        setUserProfile(formattedProfile);
        setCachedProfile(targetUserId, formattedProfile);
        lastLoadedUserIdRef.current = targetUserId;

        // Populate edit form with current profile data
        setEditForm({
          full_name: profile.full_name || '',
          username: profile.username || '',
          age: profile.age ? profile.age.toString() : '',
          height: profile.height || '',
          weight: profile.weight || '',
          country: profile.country || '',
          preferred_foot: profile.preferred_foot || '',
          position: profile.position || '',
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setIsLoadingProfile(false);
    }
  };

  // Handle profile picture selection and upload
  const handleImagePicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImageToSupabase(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  // Upload image to Supabase storage
  const uploadImageToSupabase = async (imageUri: string) => {
    try {
      setIsUploadingImage(true);
      const currentUser = await auth.getCurrentUser();
      
      if (!currentUser) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      // Create unique filename
      const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Read the image as base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: 'base64',
      });

      // Convert base64 to Uint8Array
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('profile-images')
        .upload(filePath, byteArray, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (error) {
        console.error('Upload error:', error);
        Alert.alert('Error', 'Failed to upload image');
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL and invalidate cache
      if (userProfile) {
        const updatedProfile = { ...userProfile, avatar_url: publicUrl };
        setUserProfile(updatedProfile);
        
        // Update cache with new avatar URL
        const targetUserId = userId || (await auth.getCurrentUser())?.id;
        if (targetUserId) {
          setCachedProfile(targetUserId, updatedProfile);
        }
      }
      
      // Save to database
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', currentUser.id);

      if (updateError) {
        console.error('Database update error:', updateError);
        Alert.alert('Error', 'Failed to save profile picture');
        return;
      }

      Alert.alert('Success', 'Profile picture updated successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Save profile changes
  const handleSaveProfile = async () => {
    try {
      setIsSavingProfile(true);
      const currentUser = await auth.getCurrentUser();
      
      if (!currentUser) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      // Validate preferred_foot field
      let preferredFoot = editForm.preferred_foot;
      if (preferredFoot && preferredFoot.trim() !== '') {
        const lowerFoot = preferredFoot.toLowerCase();
        if (!['left', 'right', 'both'].includes(lowerFoot)) {
          Alert.alert('Invalid Input', 'Preferred foot must be "Left", "Right", or "Both"');
          return;
        }
        // Normalize the value
        preferredFoot = lowerFoot.charAt(0).toUpperCase() + lowerFoot.slice(1);
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: editForm.full_name,
          username: editForm.username,
          age: editForm.age ? parseInt(editForm.age) : null,
          height: editForm.height,
          weight: editForm.weight,
          country: editForm.country,
          preferred_foot: preferredFoot,
          position: editForm.position,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id);

      if (error) {
        console.error('Error saving profile:', error);
        if (error.code === '23514') {
          Alert.alert('Invalid Input', 'Please check your input values. Preferred foot must be "Left", "Right", or "Both".');
        } else {
          Alert.alert('Error', 'Failed to save profile');
        }
        return;
      }

      // Reload profile to get updated data and invalidate cache
      await loadUserProfile(true);
      setIsEditMode(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle edit mode toggle
  const handleEditToggle = () => {
    if (isEditMode) {
      // Cancel edit mode - reset form to original values
      if (userProfile) {
        setEditForm({
          full_name: userProfile.full_name || '',
          username: userProfile.username || '',
          age: userProfile.age ? userProfile.age.toString() : '',
          height: userProfile.height || '',
          weight: userProfile.weight || '',
          country: userProfile.country || '',
          preferred_foot: userProfile.preferred_foot || '',
          position: userProfile.position || '',
        });
      }
    }
    setIsEditMode(!isEditMode);
  };

  // Load profile when screen mounts
  useEffect(() => {
    loadUserProfile();
  }, [userId]);

  // Handle navigation focus - only reload if necessary
  useFocusEffect(
    React.useCallback(() => {
      const targetUserId = userId || lastLoadedUserIdRef.current;
      if (targetUserId) {
        const cachedProfile = getCachedProfile(targetUserId);
        if (cachedProfile) {
          // Use cached data immediately, no loading state
          setUserProfile(cachedProfile);
          setIsLoadingProfile(false);
        } else {
          // Only load if no cache available
          loadUserProfile();
        }
      }
    }, [userId])
  );

  const renderEditForm = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Edit Profile</Text>
      <View style={styles.editForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={styles.textInput}
            value={editForm.full_name}
            onChangeText={(text) => setEditForm({...editForm, full_name: text})}
                  placeholder="Enter your full name"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                />
              </View>
        
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Username</Text>
                <TextInput
                  style={styles.textInput}
            value={editForm.username}
            onChangeText={(text) => setEditForm({...editForm, username: text})}
                  placeholder="Enter your username"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                />
              </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.inputLabel}>Age</Text>
                <TextInput
                  style={styles.textInput}
              value={editForm.age}
              onChangeText={(text) => setEditForm({...editForm, age: text})}
              placeholder="Age"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  keyboardType="numeric"
                />
              </View>
          
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.inputLabel}>Height</Text>
                <TextInput
                  style={styles.textInput}
              value={editForm.height}
              onChangeText={(text) => setEditForm({...editForm, height: text})}
              placeholder="e.g., 5'10 or 178cm"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                />
              </View>
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.inputLabel}>Weight</Text>
                <TextInput
                  style={styles.textInput}
              value={editForm.weight}
              onChangeText={(text) => setEditForm({...editForm, weight: text})}
              placeholder="e.g., 160 lbs or 73kg"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                />
              </View>
          
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.inputLabel}>Country</Text>
                <TextInput
                  style={styles.textInput}
              value={editForm.country}
              onChangeText={(text) => setEditForm({...editForm, country: text})}
              placeholder="Country"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                />
              </View>
              </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.inputLabel}>Position</Text>
                <TextInput
                  style={styles.textInput}
              value={editForm.position}
              onChangeText={(text) => setEditForm({...editForm, position: text})}
              placeholder="e.g., Midfielder"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                />
              </View>
          
          <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.inputLabel}>Preferred Foot</Text>
                <TextInput
                  style={styles.textInput}
              value={editForm.preferred_foot}
              onChangeText={(text) => {
                // Auto-correct common typos
                const corrected = text.toLowerCase();
                let finalValue = text;
                if (corrected.includes('left')) finalValue = 'Left';
                else if (corrected.includes('right')) finalValue = 'Right';
                else if (corrected.includes('both')) finalValue = 'Both';
                else if (corrected.includes('rght') || corrected.includes('rigt')) finalValue = 'Right';
                
                setEditForm({...editForm, preferred_foot: finalValue});
              }}
                  placeholder="Left, Right, or Both"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                />
              </View>
              </View>

        <View style={styles.editActions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.cancelButton]} 
            onPress={handleEditToggle}
            disabled={isSavingProfile}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
              <TouchableOpacity 
            style={[styles.actionButton, styles.saveButton]} 
                onPress={handleSaveProfile}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? (
              <HourglassLoader size={16} color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderPlayerDetailsCard = () => (
    <View style={styles.card}>
      <View style={styles.detailsGrid}>
        <View style={styles.detailItem}>
          <Text style={styles.detailValue}>{userProfile?.height || 'N/A'}</Text>
          <Text style={styles.detailLabel}>Height</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailValue}>{userProfile?.age ? `${userProfile.age} years` : 'N/A'}</Text>
          <Text style={styles.detailLabel}>Age</Text>
        </View>
        <View style={styles.detailItem}>
          <View style={styles.countryContainer}>
            <Text style={styles.flag}>🏳️</Text>
            <Text style={styles.detailValue}>{userProfile?.country || 'N/A'}</Text>
          </View>
          <Text style={styles.detailLabel}>Country</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailValue}>{userProfile?.level || 1}</Text>
          <Text style={styles.detailLabel}>Level</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailValue}>{userProfile?.preferred_foot || 'N/A'}</Text>
          <Text style={styles.detailLabel}>Preferred foot</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailValue}>{userProfile?.xp || 0}</Text>
          <Text style={styles.detailLabel}>XP</Text>
        </View>
      </View>
    </View>
  );

  const renderSeasonPerformanceCard = () => {
    const winRate = userProfile?.stats.matches_played && userProfile.stats.matches_played > 0 
      ? ((userProfile.stats.wins / userProfile.stats.matches_played) * 100).toFixed(1)
      : '0.0';
    
    return (
      <View style={styles.card}>
        <View style={styles.leagueHeader}>
          <View style={styles.leagueIcon}>
            <Text style={styles.leagueIconText}>⚽</Text>
          </View>
          <Text style={styles.leagueText}>Division {userProfile?.division || 5}</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{userProfile?.stats.matches_played || 0}</Text>
            <Text style={styles.statLabel}>Matches</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{userProfile?.stats.goals || 0}</Text>
            <Text style={styles.statLabel}>Goals</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{userProfile?.stats.assists || 0}</Text>
            <Text style={styles.statLabel}>Assists</Text>
          </View>
          <View style={styles.statItem}>
            <View style={styles.ratingContainer}>
              <Text style={styles.ratingValue}>{winRate}%</Text>
            </View>
            <Text style={styles.statLabel}>Win Rate</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderPlayerTraitsCard = () => {
    const matches = userProfile?.stats.matches_played || 0;
    const goalsPerMatch = matches > 0 ? ((userProfile?.stats.goals || 0) / matches * 100).toFixed(0) : '0';
    const assistsPerMatch = matches > 0 ? ((userProfile?.stats.assists || 0) / matches * 100).toFixed(0) : '0';
    const mvpRate = matches > 0 ? ((userProfile?.stats.mvps || 0) / matches * 100).toFixed(0) : '0';
    const winRate = matches > 0 ? ((userProfile?.stats.wins || 0) / matches * 100).toFixed(0) : '0';

    return (
      <View style={styles.card}>
        <View style={styles.traitsHeader}>
          <Text style={styles.traitsTitle}>Player Performance</Text>
          <View style={styles.traitsSubtitle}>
            <Text style={styles.traitsSubtitleText}>Stats based on your matches</Text>
            <View style={styles.questionMark}>
              <Text style={styles.questionMarkText}>?</Text>
            </View>
          </View>
        </View>
        <View style={styles.radarChart}>
          <View style={styles.radarContainer}>
            <View style={styles.radarChartInner}>
              <View style={styles.radarPoint} />
              <View style={styles.radarLine} />
            </View>
          </View>
          <View style={styles.radarLabels}>
            <View style={styles.radarLabel}>
              <Text style={styles.radarLabelText}>Goals</Text>
              <Text style={styles.radarPercentage}>{goalsPerMatch}%</Text>
            </View>
            <View style={styles.radarLabel}>
              <Text style={styles.radarLabelText}>Assists</Text>
              <Text style={styles.radarPercentage}>{assistsPerMatch}%</Text>
            </View>
            <View style={styles.radarLabel}>
              <Text style={styles.radarLabelText}>MVP Rate</Text>
              <Text style={styles.radarPercentage}>{mvpRate}%</Text>
            </View>
            <View style={styles.radarLabel}>
              <Text style={styles.radarLabelText}>Win Rate</Text>
              <Text style={styles.radarPercentage}>{winRate}%</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (isLoadingProfile) {
    return (
      <ImageBackground
        source={require('../../assets/hage.jpeg')}
        style={styles.container}
      >
        <View style={styles.backgroundOverlay}>
          <HourglassLoader
            size={50}
            color="#4CAF50"
            text="Loading profile..."
            containerStyle={styles.loadingContainer}
          />
        </View>
      </ImageBackground>
    );
  }

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
          <View style={styles.headerActions}>
            {!userId && (
              <TouchableOpacity style={styles.followButton} onPress={handleEditToggle}>
                <Text style={styles.followButtonText}>{isEditMode ? 'Cancel' : 'Edit'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Player Info */}
        <View style={styles.playerInfo}>
          <TouchableOpacity style={styles.playerAvatar} onPress={handleImagePicker}>
            {userProfile?.avatar_url ? (
              <Image 
                source={{ uri: userProfile.avatar_url }} 
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color="rgba(255, 255, 255, 0.6)" />
              </View>
            )}
            {isUploadingImage && (
              <View style={styles.uploadOverlay}>
                <HourglassLoader size={20} color="#4CAF50" />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.playerDetails}>
            <Text style={styles.playerName}>{userProfile?.full_name || userProfile?.username || 'Player'}</Text>
            <TouchableOpacity style={styles.teamButton}>
              <Text style={styles.teamLogo}>⚽</Text>
              <Text style={styles.teamName}>Division {userProfile?.division || 5}</Text>
            </TouchableOpacity>
              </View>
              </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {tabs.map((tab) => (
              <TouchableOpacity 
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab}
              </Text>
              {activeTab === tab && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          ))}
                  </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === 'Profile' && (
            <>
              {isEditMode && !userId ? renderEditForm() : renderPlayerDetailsCard()}
              {!isEditMode && renderSeasonPerformanceCard()}
              {!isEditMode && renderPlayerTraitsCard()}
            </>
          )}
          {activeTab === 'Matches' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recent Matches</Text>
              <Text style={styles.comingSoon}>Coming Soon</Text>
            </View>
          )}
          {activeTab === 'Stats' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Detailed Statistics</Text>
              <Text style={styles.comingSoon}>Coming Soon</Text>
            </View>
          )}
          {activeTab === 'Career' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Career History</Text>
              <Text style={styles.comingSoon}>Coming Soon</Text>
            </View>
          )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerActionButton: {
    padding: 8,
  },
  followButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  followButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  playerAvatar: {
    marginRight: 16,
    position: 'relative',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerDetails: {
    flex: 1,
  },
  playerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  teamButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  teamLogo: {
    fontSize: 16,
    marginRight: 6,
  },
  teamName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    position: 'relative',
  },
  activeTab: {
    // Active tab styling
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#4CAF50',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  comingSoon: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 20,
  },
  // Player Details Card
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  countryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flag: {
    fontSize: 16,
    marginRight: 4,
  },
  // Season Performance Card
  leagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  leagueIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  leagueIconText: {
    fontSize: 12,
  },
  leagueText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  ratingContainer: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ratingValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Player Traits Card
  traitsHeader: {
    marginBottom: 20,
  },
  traitsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  traitsSubtitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  traitsSubtitleText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  questionMark: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  questionMarkText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  radarChart: {
    alignItems: 'center',
  },
  radarContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  radarChartInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  radarPoint: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  radarLine: {
    position: 'absolute',
    width: 2,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    transform: [{ rotate: '45deg' }],
  },
  radarLabels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  radarLabel: {
    width: '45%',
    alignItems: 'center',
    marginBottom: 12,
  },
  radarLabelText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
  radarPercentage: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Edit Form Styles
  editForm: {
    marginTop: 10,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    fontSize: 16,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileScreen;
