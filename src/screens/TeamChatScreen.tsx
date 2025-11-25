import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { db, supabase } from '../lib/supabase';

type TeamChatRouteProp = RouteProp<RootStackParamList, 'TeamChat'>;
type TeamChatNavProp = StackNavigationProp<RootStackParamList, 'TeamChat'>;

interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  user_profiles?: {
    full_name?: string;
    username?: string;
    avatar_url?: string | null;
  } | null;
}

// Animated Message Component (same as match chat)
const AnimatedMessage: React.FC<{
  item: ChatMessage;
  isOwnMessage: boolean;
  currentUser: any;
  formatTime: (timestamp: string) => string;
}> = ({ item, isOwnMessage, currentUser, formatTime }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[
        styles.messageBubble,
        isOwnMessage ? styles.ownBubble : styles.otherBubble
      ]}>
        <View style={styles.messageHeader}>
          <Text style={[
            styles.username,
            isOwnMessage ? styles.ownUsername : styles.otherUsername
          ]}>
            {item.user_profiles?.username || item.user_profiles?.full_name || 'Player'}
          </Text>
          <Text style={[
            styles.timestamp,
            isOwnMessage ? styles.ownTimestamp : styles.otherTimestamp
          ]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
        <Text style={[
          styles.messageText,
          isOwnMessage ? styles.ownMessageText : styles.otherMessageText
        ]}>
          {item.content}
        </Text>
      </View>
    </Animated.View>
  );
};

const TeamChatScreen: React.FC = () => {
  const route = useRoute<TeamChatRouteProp>();
  const navigation = useNavigation<TeamChatNavProp>();
  const { teamId, teamName } = route.params;

  const [roomId, setRoomId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadCurrentUser();
    initializeTeamChat();
  }, [teamId]);

  const loadCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('username')
          .eq('id', user.id)
          .single();
        
        setCurrentUser({
          id: user.id,
          username: profile?.username || 'Anonymous'
        });
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const initializeTeamChat = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Ensure room exists
        const { data: room } = await db.ensureTeamChatRoom(teamId);
        if (room?.id) setRoomId(room.id);
        
        // Load initial messages
        const { data: initial } = await db.listTeamMessages(teamId, 100);
        if (initial) setMessages(initial as ChatMessage[]);
        
        // Subscribe to new messages
        const unsubscribe = db.subscribeTeamMessages(teamId, (msg) => {
          setMessages(prev => [...prev, msg as ChatMessage]);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
        });
        
        return () => unsubscribe();
      }
    } catch (error) {
      console.error('Error initializing team chat:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !roomId || sending) return;

    const messageContent = newMessage.trim();
    const tempId = `temp-${Date.now()}`;

    try {
      setSending(true);
      
      // Clear input immediately for better UX
      setNewMessage('');

      // Create optimistic message for immediate UI feedback
      const optimisticMessage: ChatMessage = {
        id: tempId,
        sender_id: currentUser?.id || '',
        content: messageContent,
        created_at: new Date().toISOString(),
        user_profiles: {
          username: currentUser?.username || 'You',
          full_name: currentUser?.username || 'You',
          avatar_url: null
        }
      };
      
      // Add optimistic message immediately
      setMessages(prev => [...prev, optimisticMessage]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

      // Send message asynchronously
      const sendMessageAsync = async () => {
        try {
          const { data, error } = await db.sendTeamMessage(teamId, roomId, messageContent);
          
          if (error) {
            throw error;
          }

          if (data) {
            // Replace optimistic message with real one
            setMessages(prev => 
              prev.map(msg => 
                msg.id === tempId 
                  ? { ...data, user_profiles: optimisticMessage.user_profiles } as ChatMessage
                  : msg
              )
            );
          }
        } catch (error) {
          console.error('Error sending message:', error);
          
          // Remove optimistic message on error
          setMessages(prev => prev.filter(msg => msg.id !== tempId));
          
          // Restore message content
          setNewMessage(messageContent);
        }
      };

      // Execute async operation without blocking UI
      sendMessageAsync();
      
    } catch (error) {
      console.error('Error in sendMessage:', error);
      setNewMessage(messageContent); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOwnMessage = item.sender_id === currentUser?.id;
    
    return (
      <AnimatedMessage
        item={item}
        isOwnMessage={isOwnMessage}
        currentUser={currentUser}
        formatTime={formatTime}
      />
    );
  };

  return (
    <ImageBackground source={require('../../assets/hage.jpeg')} style={styles.container}>
      <View style={styles.backgroundOverlay}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Team Chat</Text>
            <Text style={styles.headerSubtitle}>{teamName}</Text>
          </View>
          <View style={styles.placeholder} />
        </View>

        <KeyboardAvoidingView 
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={90}
        >
          {/* Messages List */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => {
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            maxToRenderPerBatch={10}
            windowSize={10}
            initialNumToRender={20}
            getItemLayout={(data, index) => ({
              length: 80, // Approximate height of each message
              offset: 80 * index,
              index,
            })}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={48} color="rgba(255, 255, 255, 0.3)" />
                <Text style={styles.emptyText}>No messages yet</Text>
                <Text style={styles.emptySubtext}>Start the team conversation!</Text>
              </View>
            }
          />

          {/* Message Input */}
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Message your team..."
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!newMessage.trim() || sending) && styles.sendButtonDisabled
                ]}
                onPress={sendMessage}
                disabled={!newMessage.trim() || sending}
              >
                <Ionicons 
                  name="send" 
                  size={20} 
                  color={(!newMessage.trim() || sending) ? "rgba(255, 255, 255, 0.3)" : "#fff"} 
                />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  placeholder: {
    width: 40,
  },
  chatContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 16,
    paddingBottom: 20,
  },
  messageContainer: {
    marginBottom: 12,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  ownBubble: {
    backgroundColor: '#4CAF50',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderBottomLeftRadius: 4,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    fontSize: 12,
    fontWeight: '600',
  },
  ownUsername: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  otherUsername: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#fff',
  },
  timestamp: {
    fontSize: 10,
  },
  ownTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherTimestamp: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 4,
  },
  inputContainer: {
    paddingVertical: 16,
    paddingBottom: 30,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  textInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    backgroundColor: '#4CAF50',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

export default TeamChatScreen;