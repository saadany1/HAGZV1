import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ImageBackground,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type HelpSupportNavigationProp = StackNavigationProp<RootStackParamList, 'HelpSupport'>;

const HelpSupportScreen: React.FC = () => {
  const navigation = useNavigation<HelpSupportNavigationProp>();
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const faqData = [
    {
      question: 'How do I join a team?',
      answer: 'You can join a team by browsing public teams in the Teams section, or by receiving an invitation from a team captain. Simply tap on a team and select "Request to Join".'
    },
    {
      question: 'How do I create a match?',
      answer: 'Go to the Play section and tap "Create Match". Fill in the details like date, time, location, and number of players needed. You can make it public or invite specific players.'
    },
    {
      question: 'How do I update my profile?',
      answer: 'Tap on the More tab, then select Profile. You can edit your personal information, skills, and preferences. Don\'t forget to save your changes!'
    },
    {
      question: 'How do I earn XP and points?',
      answer: 'You earn XP by participating in matches, winning games, and being voted MVP. Points are awarded based on your performance and team success.'
    },
    {
      question: 'Can I play without joining a team?',
      answer: 'Yes! You can join public matches as a free agent. This is a great way to meet new players and potentially join a team later.'
    },
    {
      question: 'How do I report inappropriate behavior?',
      answer: 'You can report any inappropriate behavior by tapping the three dots menu on any user\'s profile and selecting "Report User". Our moderation team will review all reports.'
    },
    {
      question: 'What if I can\'t attend a match I\'ve joined?',
      answer: 'If you need to cancel your attendance, go to the match details and tap "Leave Match". Please do this as early as possible so other players can join.'
    },
    {
      question: 'How do I change my team captain?',
      answer: 'Team captains can transfer leadership by going to Team Settings and selecting "Transfer Captaincy" to another team member.'
    }
  ];

  const contactMethods = [
    {
      icon: 'mail',
      title: 'Email Support',
      subtitle: 'Get help via email',
      action: () => Linking.openURL('mailto:support@hagz.com'),
    },
  ];

  const openMail = (subject: string, body: string) => {
    const s = encodeURIComponent(subject);
    const b = encodeURIComponent(body);
    Linking.openURL(`mailto:support@hagz.com?subject=${s}&body=${b}`);
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
          <Text style={styles.title}>Help & Support</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Contact Support Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Support</Text>
            {contactMethods.map((method, index) => (
              <TouchableOpacity key={index} style={styles.contactItem} onPress={method.action}>
                <View style={styles.contactContent}>
                  <View style={styles.contactIcon}>
                    <Ionicons name={method.icon as any} size={20} color="#059669" />
                  </View>
                  <View style={styles.contactText}>
                    <Text style={styles.contactTitle}>{method.title}</Text>
                    <Text style={styles.contactSubtitle}>{method.subtitle}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.5)" />
              </TouchableOpacity>
            ))}
          </View>

          {/* Help Resources removed */}

          {/* FAQ Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
            {faqData.map((faq, index) => (
              <View key={index} style={styles.faqItem}>
                <TouchableOpacity 
                  style={styles.faqQuestion} 
                  onPress={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                >
                  <Text style={styles.faqQuestionText}>{faq.question}</Text>
                  <Ionicons 
                    name={expandedFAQ === index ? "chevron-down" : "chevron-forward"} 
                    size={20} 
                    color="rgba(255, 255, 255, 0.5)" 
                  />
                </TouchableOpacity>
                {expandedFAQ === index && (
                  <View style={styles.faqAnswer}>
                    <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <TouchableOpacity style={styles.actionButton} onPress={() => openMail('Bug Report: [describe here]', 'Please describe the bug, what you expected, and steps to reproduce.\n\nDevice/OS: \nApp version: \nScreenshots (if any):')}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="bug" size={20} color="#ef4444" />
                <Text style={styles.actionButtonText}>Report a Bug</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => openMail('Feature Suggestion: [your idea]', 'Tell us what you want to see, and why it would help.\n\nDetails/Mockups:')}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="bulb" size={20} color="#f59e0b" />
                <Text style={styles.actionButtonText}>Suggest a Feature</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="star" size={20} color="#f59e0b" />
                <Text style={styles.actionButtonText}>Rate the App</Text>
              </View>
            </TouchableOpacity>
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
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  contactItem: {
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
  contactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(5, 150, 105, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  contactText: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  contactSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  resourceItem: {
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
  resourceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  resourceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  resourceText: {
    flex: 1,
  },
  resourceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  resourceSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  faqItem: {
    marginBottom: 8,
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 16,
  },
  faqQuestionText: {
    fontSize: 16,
    color: '#fff',
    flex: 1,
    fontWeight: '500',
  },
  faqAnswer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    padding: 16,
    marginTop: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#059669',
  },
  faqAnswerText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
  },
  actionButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 12,
  },
});

export default HelpSupportScreen;
