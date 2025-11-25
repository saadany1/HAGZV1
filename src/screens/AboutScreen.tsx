import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type AboutNavigationProp = StackNavigationProp<RootStackParamList, 'About'>;

const AboutScreen: React.FC = () => {
  const navigation = useNavigation<AboutNavigationProp>();

  const appInfo = {
    version: '1.0.0',
    buildNumber: '100',
    releaseDate: 'December 2024',
    developer: 'Hagz Development Team',
  };

  const features = [
    'Team Management',
    'Match Organization',
    'Player Statistics',
    'Community Building',
    'Real-time Notifications',
    'Location-based Matching',
    'Leaderboards',
    'Social Features',
  ];

  const socialLinks = [
    {
      name: 'Website',
      icon: 'globe',
      url: 'https://hagz.com',
      color: '#059669',
    },
    {
      name: 'Twitter',
      icon: 'logo-twitter',
      url: 'https://twitter.com/hagz',
      color: '#1da1f2',
    },
    {
      name: 'Instagram',
      icon: 'logo-instagram',
      url: 'https://instagram.com/hagz',
      color: '#e1306c',
    },
    {
      name: 'Facebook',
      icon: 'logo-facebook',
      url: 'https://facebook.com/hagz',
      color: '#4267b2',
    },
  ];

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open link');
    });
  };

  return (
    <ImageBackground
      source={require('../../assets/hage.jpeg')}
      style={styles.container}
    >
      <View style={styles.backgroundOverlay}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>About Hagz</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* App Info Section */}
          <View style={styles.section}>
            <View style={styles.appIconContainer}>
              <View style={styles.appIcon}>
                <Ionicons name="football" size={40} color="#059669" />
              </View>
            </View>
            <Text style={styles.appName}>Hagz</Text>
            <Text style={styles.appDescription}>
              Hagz is a football community app that connects players, helps organize matches, and builds lasting friendships through the beautiful game.
            </Text>
            
            <View style={styles.versionInfo}>
              <Text style={styles.versionText}>Version {appInfo.version}</Text>
              <Text style={styles.buildText}>Build {appInfo.buildNumber}</Text>
              <Text style={styles.dateText}>Released {appInfo.releaseDate}</Text>
            </View>
          </View>

          {/* Features Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Features</Text>
            <View style={styles.featuresGrid}>
              {features.map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Social Links Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Connect With Us</Text>
            <View style={styles.socialGrid}>
              {socialLinks.map((social, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.socialItem}
                  onPress={() => openLink(social.url)}
                >
                  <View style={[styles.socialIcon, { backgroundColor: `${social.color}20` }]}>
                    <Ionicons name={social.icon as any} size={24} color={social.color} />
                  </View>
                  <Text style={styles.socialText}>{social.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Developer Info Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Developer</Text>
            <View style={styles.developerInfo}>
              <Text style={styles.developerText}>{appInfo.developer}</Text>
              <Text style={styles.copyrightText}>© 2024 All rights reserved</Text>
            </View>
          </View>

          {/* Legal Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Legal</Text>
            <TouchableOpacity 
              style={styles.legalItem}
              onPress={() => navigation.navigate('TermsPrivacy' as any)}
            >
              <Ionicons name="document-text" size={20} color="#6b7280" />
              <Text style={styles.legalText}>Terms of Service & Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.5)" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.legalItem}
              onPress={() => Alert.alert('Licenses', 'Open source licenses coming soon!')}
            >
              <Ionicons name="code-slash" size={20} color="#6b7280" />
              <Text style={styles.legalText}>Open Source Licenses</Text>
              <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.5)" />
            </TouchableOpacity>
          </View>

          {/* Acknowledgments */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Acknowledgments</Text>
            <Text style={styles.acknowledgmentText}>
              Special thanks to all the football players and communities who helped make Hagz possible. 
              Your feedback and support drive us to create the best football community experience.
            </Text>
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
  placeholder: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  section: {
    marginBottom: 30,
  },
  appIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'rgba(5, 150, 105, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(5, 150, 105, 0.3)',
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  appDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  versionInfo: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  versionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: 4,
  },
  buildText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  featuresGrid: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 12,
  },
  socialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  socialItem: {
    width: '48%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  socialIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  socialText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  developerInfo: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  developerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  copyrightText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  legalItem: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  legalText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 12,
    flex: 1,
  },
  acknowledgmentText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
    fontStyle: 'italic',
  },
});

export default AboutScreen;
