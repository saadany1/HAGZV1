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
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type TermsPrivacyNavigationProp = StackNavigationProp<RootStackParamList, 'TermsPrivacy'>;

const TermsPrivacyScreen: React.FC = () => {
  const navigation = useNavigation<TermsPrivacyNavigationProp>();

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
          <Text style={styles.title}>Terms & Privacy</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Terms of Service Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Terms of Service</Text>
            <Text style={styles.updatedDate}>Last updated: December 2024</Text>
            
            <View style={styles.subsection}>
              <Text style={styles.subsectionTitle}>1. Acceptance of Terms</Text>
              <Text style={styles.paragraph}>
                By using Hagz, you agree to these terms of service. The app is designed for football enthusiasts to connect, organize matches, and build teams.
              </Text>
            </View>

            <View style={styles.subsection}>
              <Text style={styles.subsectionTitle}>2. User Eligibility</Text>
              <Text style={styles.paragraph}>
                Users must be 13 years or older to use this service. All users are responsible for their conduct and content shared through the platform.
              </Text>
            </View>

            <View style={styles.subsection}>
              <Text style={styles.subsectionTitle}>3. User Conduct</Text>
              <Text style={styles.paragraph}>
                Users agree to not engage in harassment, discrimination, or any form of inappropriate behavior. Violations may result in account suspension or termination.
              </Text>
            </View>

            <View style={styles.subsection}>
              <Text style={styles.subsectionTitle}>4. Content and Intellectual Property</Text>
              <Text style={styles.paragraph}>
                Users retain ownership of their content but grant Hagz a license to use, display, and distribute content for the purpose of providing services.
              </Text>
            </View>

            <View style={styles.subsection}>
              <Text style={styles.subsectionTitle}>5. Limitation of Liability</Text>
              <Text style={styles.paragraph}>
                Hagz is not liable for any injuries, damages, or losses that may occur during matches or interactions facilitated through the platform.
              </Text>
            </View>
          </View>

          {/* Privacy Policy Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Privacy Policy</Text>
            <Text style={styles.updatedDate}>Last updated: December 2024</Text>
            
            <View style={styles.subsection}>
              <Text style={styles.subsectionTitle}>1. Information We Collect</Text>
              <Text style={styles.paragraph}>
                We collect and use your information to provide and improve our services. This includes profile information, location data, and usage analytics.
              </Text>
            </View>

            <View style={styles.subsection}>
              <Text style={styles.subsectionTitle}>2. How We Use Your Information</Text>
              <Text style={styles.paragraph}>
                Your data is used to match you with other players, organize matches, provide personalized recommendations, and improve our services.
              </Text>
            </View>

            <View style={styles.subsection}>
              <Text style={styles.subsectionTitle}>3. Data Protection</Text>
              <Text style={styles.paragraph}>
                Your data is protected using industry-standard security measures and is never shared with third parties without your explicit consent.
              </Text>
            </View>

            <View style={styles.subsection}>
              <Text style={styles.subsectionTitle}>4. Your Rights</Text>
              <Text style={styles.paragraph}>
                You can request deletion of your data at any time by contacting our support team. You also have the right to access and modify your personal information.
              </Text>
            </View>

            <View style={styles.subsection}>
              <Text style={styles.subsectionTitle}>5. Cookies and Tracking</Text>
              <Text style={styles.paragraph}>
                We use cookies and similar technologies to enhance your experience, analyze usage patterns, and provide personalized content.
              </Text>
            </View>
          </View>

          {/* Contact Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <Text style={styles.paragraph}>
              If you have any questions about these terms or our privacy practices, please contact us:
            </Text>
            <View style={styles.contactInfo}>
              <Text style={styles.contactItem}>Email: legal@hagz.com</Text>
              <Text style={styles.contactItem}>Phone: +1 (555) 123-4567</Text>
              <Text style={styles.contactItem}>Address: 123 Football Street, Sports City, SC 12345</Text>
            </View>
          </View>

          {/* Agreement */}
          <View style={styles.agreementSection}>
            <Text style={styles.agreementText}>
              By continuing to use Hagz, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service and Privacy Policy.
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
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  updatedDate: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  subsection: {
    marginBottom: 20,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 22,
    marginBottom: 12,
  },
  contactInfo: {
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  contactItem: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  agreementSection: {
    marginTop: 20,
    padding: 20,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.3)',
  },
  agreementText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default TermsPrivacyScreen;
