import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const TermsScreen: React.FC = () => {
  const navigation = useNavigation();
  return (
    <ImageBackground source={require('../../assets/hage.jpeg')} style={styles.container}>
      <View style={styles.backgroundOverlay}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Terms of Service</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.updatedDate}>Last updated: September 2025</Text>

          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            These Terms of Service (the “Terms”) govern your access to and use of the Hagz mobile
            application, website and related services (collectively, the “Service”). By creating an
            account or using the Service, you agree to be bound by these Terms and our Privacy
            Policy. If you do not agree, do not use the Service.
          </Text>

          <Text style={styles.sectionTitle}>2. Eligibility & Accounts</Text>
          <Text style={styles.paragraph}>
            You must be at least 13 years old (or older where required by local law) to use the
            Service. If you are under the age of majority in your jurisdiction, you represent that you
            have your parent or legal guardian’s permission to use the Service. You are responsible for
            maintaining the confidentiality of your login credentials and for all activities that occur
            under your account.
          </Text>

          <Text style={styles.sectionTitle}>3. Community & Player Conduct</Text>
          <Text style={styles.paragraph}>
            We expect respectful behavior on and off the pitch. You agree not to harass, threaten, or
            discriminate against other users; not to post or share illegal, hateful, pornographic,
            infringing, or otherwise objectionable content; and not to use the Service for any unlawful
            purpose. Hagz may remove content, suspend, or terminate accounts that violate these Terms or
            harm the community.
          </Text>

          <Text style={styles.sectionTitle}>4. Matches, Safety & Assumption of Risk</Text>
          <Text style={styles.paragraph}>
            Hagz helps you discover, organize, and join football matches. Football and related
            activities can be physically demanding and carry inherent risks, including the risk of
            injury. You agree that you participate at your own risk and are solely responsible for your
            safety, fitness to participate, and compliance with all venue rules and local laws.
            Hagz does not supervise matches or vet venues, equipment, or participants.
          </Text>

          <Text style={styles.sectionTitle}>5. Payments, Refunds & Third‑Party Services</Text>
          <Text style={styles.paragraph}>
            Some features may involve fees or payments processed by third‑party providers. Where
            applicable, you authorize those providers to charge your selected payment method. Except as
            required by law or expressly stated within the Service, fees are non‑refundable. Hagz is not
            responsible for third‑party services or their terms and policies.
          </Text>

          <Text style={styles.sectionTitle}>6. User Content & License</Text>
          <Text style={styles.paragraph}>
            You retain ownership of any content you submit to the Service (e.g., text, photos,
            highlights). You grant Hagz a worldwide, non‑exclusive, royalty‑free license to host,
            store, reproduce, modify, display, and distribute such content solely for operating,
            improving, and promoting the Service. You represent and warrant that you have all rights
            necessary to grant this license and that your content does not infringe the rights of any
            third party.
          </Text>

          <Text style={styles.sectionTitle}>7. Intellectual Property</Text>
          <Text style={styles.paragraph}>
            The Service, including its software, design, trademarks, and content (excluding User
            Content), is owned by or licensed to Hagz and protected by applicable intellectual property
            laws. Except for the limited rights granted in these Terms, no rights are transferred to you.
          </Text>

          <Text style={styles.sectionTitle}>8. Prohibited Uses</Text>
          <Text style={styles.paragraph}>
            You agree not to: (a) copy, modify, or distribute any part of the Service except as
            permitted by these Terms; (b) reverse engineer or attempt to extract source code; (c) use any
            automated means to access the Service; (d) upload malware; (e) impersonate others or misstate
            your affiliation; or (f) interfere with or disrupt the Service.
          </Text>

          <Text style={styles.sectionTitle}>9. Apple App Store & Google Play</Text>
          <Text style={styles.paragraph}>
            If you downloaded the app from the Apple App Store, you acknowledge that these Terms are
            between you and Hagz only, not Apple; that Apple is not responsible for the app or its
            content; and that Apple has no obligation to provide maintenance or support. To the maximum
            extent permitted by law, Apple will have no warranty obligation, and Apple is not responsible
            for any claims relating to the app or your use of it. You must comply with the App Store
            Terms of Service. Similar terms apply for downloads from Google Play.
          </Text>

          <Text style={styles.sectionTitle}>10. Disclaimers</Text>
          <Text style={styles.paragraph}>
            THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM EXTENT PERMITTED BY LAW,
            HAGZ DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING ANY WARRANTIES OF
            MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON‑INFRINGEMENT. HAGZ DOES NOT
            WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR‑FREE.
          </Text>

          <Text style={styles.sectionTitle}>11. Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, HAGZ AND ITS AFFILIATES WILL NOT BE LIABLE FOR ANY
            INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF
            PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE, EVEN IF
            ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. IN NO EVENT WILL HAGZ’S TOTAL LIABILITY EXCEED THE
            AMOUNT YOU HAVE PAID TO HAGZ IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE
            CLAIM (OR USD $100 IF NO SUCH PAYMENTS HAVE BEEN MADE).
          </Text>

          <Text style={styles.sectionTitle}>12. Indemnification</Text>
          <Text style={styles.paragraph}>
            You agree to indemnify and hold harmless Hagz and its affiliates from any claims, damages,
            obligations, losses, liabilities, costs, or expenses (including reasonable attorneys’ fees)
            arising from: (a) your use of the Service; (b) your violation of these Terms; or (c) your
            violation of any third‑party right.
          </Text>

          <Text style={styles.sectionTitle}>13. Termination</Text>
          <Text style={styles.paragraph}>
            We may suspend or terminate your access to the Service at any time if we believe you have
            violated these Terms or pose a risk to the community. You may stop using the Service at any
            time. Sections that by their nature should survive termination will survive.
          </Text>

          <Text style={styles.sectionTitle}>14. Changes to the Service or Terms</Text>
          <Text style={styles.paragraph}>
            We may modify the Service and these Terms from time to time. If we make material changes, we
            will provide notice within the app or by other reasonable means. Continued use of the Service
            after changes take effect constitutes acceptance of the new Terms.
          </Text>

          <Text style={styles.sectionTitle}>15. Governing Law & Dispute Resolution</Text>
          <Text style={styles.paragraph}>
            These Terms are governed by the laws of your country or state of residence, without regard to
            conflict‑of‑laws principles. Where permitted by law, any dispute will be resolved exclusively
            in the courts located in your jurisdiction of residence, unless the parties agree to
            alternative dispute resolution.
          </Text>

          <Text style={styles.sectionTitle}>16. Contact</Text>
          <Text style={styles.paragraph}>
            Questions about these Terms? Contact us at legal@hagz.com.
          </Text>
        </ScrollView>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)'
  },
  backButton: { padding: 8 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 30 },
  updatedDate: { color: 'rgba(255, 255, 255, 0.6)', fontStyle: 'italic', marginBottom: 20 },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  section: { marginBottom: 30 },
  paragraph: { color: 'rgba(255, 255, 255, 0.8)', lineHeight: 22, marginBottom: 12, fontSize: 14 }
});

export default TermsScreen;
