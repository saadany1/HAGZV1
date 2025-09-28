import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ImageBackground,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type SettingsNavigationProp = StackNavigationProp<RootStackParamList, 'Settings'>;

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<SettingsNavigationProp>();
  const [settings, setSettings] = useState({
    darkMode: true,
    autoSave: true,
    dataSync: true,
    locationServices: false,
    analytics: true,
    biometricAuth: false,
    autoBackup: true,
    offlineMode: false,
  });

  const handleSaveSettings = () => {
    // Here you would typically save to local storage or Supabase
    Alert.alert('Success', 'Settings saved successfully!');
  };

  const settingsItems = [
    {
      key: 'darkMode',
      title: 'Dark Mode',
      subtitle: 'Use dark theme throughout the app',
      icon: 'moon',
      section: 'appearance',
    },
    {
      key: 'autoSave',
      title: 'Auto Save',
      subtitle: 'Automatically save your progress',
      icon: 'save',
      section: 'data',
    },
    {
      key: 'dataSync',
      title: 'Data Sync',
      subtitle: 'Sync data across devices',
      icon: 'sync',
      section: 'data',
    },
    {
      key: 'locationServices',
      title: 'Location Services',
      subtitle: 'Use your location for nearby matches',
      icon: 'location',
      section: 'privacy',
    },
    {
      key: 'analytics',
      title: 'Analytics',
      subtitle: 'Help improve the app with usage data',
      icon: 'analytics',
      section: 'privacy',
    },
    {
      key: 'biometricAuth',
      title: 'Biometric Authentication',
      subtitle: 'Use fingerprint or face ID for login',
      icon: 'finger-print',
      section: 'security',
    },
    {
      key: 'autoBackup',
      title: 'Auto Backup',
      subtitle: 'Automatically backup your data',
      icon: 'cloud-upload',
      section: 'data',
    },
    {
      key: 'offlineMode',
      title: 'Offline Mode',
      subtitle: 'Work without internet connection',
      icon: 'wifi-off',
      section: 'data',
    },
  ];

  const groupedSettings = settingsItems.reduce((acc, item) => {
    if (!acc[item.section]) {
      acc[item.section] = [];
    }
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, typeof settingsItems>);

  const sectionTitles = {
    appearance: 'Appearance',
    data: 'Data & Storage',
    privacy: 'Privacy & Security',
    security: 'Security',
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
          <Text style={styles.title}>App Settings</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {Object.entries(groupedSettings).map(([section, items]) => (
            <View key={section} style={styles.section}>
              <Text style={styles.sectionTitle}>{sectionTitles[section as keyof typeof sectionTitles]}</Text>
              {items.map((item) => (
                <View key={item.key} style={styles.settingItem}>
                  <View style={styles.settingContent}>
                    <View style={styles.settingIcon}>
                      <Ionicons name={item.icon as any} size={20} color="#059669" />
                    </View>
                    <View style={styles.settingText}>
                      <Text style={styles.settingTitle}>{item.title}</Text>
                      <Text style={styles.settingSubtitle}>{item.subtitle}</Text>
                    </View>
                  </View>
                  <Switch
                    value={settings[item.key as keyof typeof settings] as boolean}
                    onValueChange={(value) => setSettings({...settings, [item.key]: value})}
                    trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: '#059669' }}
                    thumbColor={settings[item.key as keyof typeof settings] ? '#fff' : 'rgba(255, 255, 255, 0.5)'}
                  />
                </View>
              ))}
            </View>
          ))}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <TouchableOpacity style={styles.actionItem}>
              <View style={styles.actionContent}>
                <View style={styles.actionIcon}>
                  <Ionicons name="refresh" size={20} color="#f59e0b" />
                </View>
                <View style={styles.actionText}>
                  <Text style={styles.actionTitle}>Refresh Data</Text>
                  <Text style={styles.actionSubtitle}>Sync latest data from server</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.5)" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem}>
              <View style={styles.actionContent}>
                <View style={styles.actionIcon}>
                  <Ionicons name="trash" size={20} color="#ef4444" />
                </View>
                <View style={styles.actionText}>
                  <Text style={styles.actionTitle}>Clear Cache</Text>
                  <Text style={styles.actionSubtitle}>Free up storage space</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.5)" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSaveSettings}>
            <Text style={styles.saveButtonText}>Save Settings</Text>
          </TouchableOpacity>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  settingItem: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(5, 150, 105, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  actionItem: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  saveButton: {
    backgroundColor: '#059669',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SettingsScreen;
