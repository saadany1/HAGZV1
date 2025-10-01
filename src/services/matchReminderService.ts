// Match Reminder Service
// Handles automatic notifications for upcoming matches

import { supabase } from '../lib/supabase';
import { sendCustomLocalNotification } from './pushNotifications';

interface UpcomingMatch {
  booking_id: string;
  pitch_name: string;
  pitch_location: string;
  match_date: string;
  match_time: string;
  match_type: 'friendly' | 'ranked';
  created_by: string;
  max_players: number;
  is_public: boolean;
  reminder_time: string;
}

interface MatchParticipant {
  user_id: string;
  push_token: string;
  full_name: string;
  email: string;
}

class MatchReminderService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

  /**
   * Start the automatic match reminder service
   */
  start() {
    if (this.isRunning) {
      console.log('📅 Match reminder service is already running');
      return;
    }

    console.log('📅 Starting match reminder service...');
    this.isRunning = true;
    
    // Run immediately
    this.checkUpcomingMatches();
    
    // Then run every 5 minutes
    this.intervalId = setInterval(() => {
      this.checkUpcomingMatches();
    }, this.CHECK_INTERVAL);
  }

  /**
   * Stop the automatic match reminder service
   */
  stop() {
    if (!this.isRunning) {
      console.log('📅 Match reminder service is not running');
      return;
    }

    console.log('📅 Stopping match reminder service...');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Check for upcoming matches that need reminder notifications
   */
  private async checkUpcomingMatches() {
    try {
      console.log('📅 Checking for upcoming matches needing reminders...');

      // Get matches that need reminders using our database function
      const { data: matches, error: matchesError } = await supabase
        .rpc('get_matches_needing_reminders');

      if (matchesError) {
        console.error('❌ Error fetching matches needing reminders:', matchesError);
        return;
      }

      if (!matches || matches.length === 0) {
        console.log('📅 No matches need reminders at this time');
        return;
      }

      console.log(`📅 Found ${matches.length} matches needing reminders`);

      // Process each match
      for (const match of matches) {
        await this.sendMatchReminder(match);
      }

    } catch (error) {
      console.error('❌ Error in checkUpcomingMatches:', error);
    }
  }

  /**
   * Send reminder notifications for a specific match
   */
  private async sendMatchReminder(match: UpcomingMatch) {
    try {
      console.log(`📅 Processing reminder for match ${match.booking_id} at ${match.pitch_name}`);

      // Get all participants for this match
      const { data: participants, error: participantsError } = await supabase
        .rpc('get_match_participants', { booking_uuid: match.booking_id });

      if (participantsError) {
        console.error('❌ Error fetching match participants:', participantsError);
        return;
      }

      if (!participants || participants.length === 0) {
        console.log(`📅 No participants with push tokens found for match ${match.booking_id}`);
        await this.markReminderSent(match.booking_id);
        return;
      }

      console.log(`📅 Sending reminders to ${participants.length} participants`);

      // Create notification content
      const matchTime = this.formatMatchTime(match.match_date, match.match_time);
      const matchTypeText = match.match_type === 'ranked' ? 'Ranked Match' : 'Friendly Match';
      
      const title = `⚽ ${matchTypeText} Reminder`;
      const message = `Your match at ${match.pitch_name} starts in 2 hours (${matchTime}). Get ready!`;

      // Send notifications to all participants
      const notificationPromises = participants.map(async (participant: MatchParticipant) => {
        try {
          // Send push notification
          await this.sendPushNotification(participant, title, message, match);
          
          // Log the notification in the database
          await this.logNotificationSent(participant.user_id, match.booking_id, title, message);
          
          console.log(`✅ Reminder sent to ${participant.full_name || participant.email}`);
        } catch (error) {
          console.error(`❌ Failed to send reminder to ${participant.email}:`, error);
        }
      });

      // Wait for all notifications to be sent
      await Promise.all(notificationPromises);

      // Mark this match's reminder as sent
      await this.markReminderSent(match.booking_id);

      console.log(`✅ Match reminder complete for ${match.booking_id}`);

    } catch (error) {
      console.error(`❌ Error sending match reminder for ${match.booking_id}:`, error);
    }
  }

  /**
   * Send push notification to a participant
   */
  private async sendPushNotification(
    participant: MatchParticipant, 
    title: string, 
    message: string, 
    match: UpcomingMatch
  ) {
    // For server-side push notifications, you would use expo-server-sdk here
    // For now, we'll log what would be sent and use local notifications for testing
    
    const notificationData = {
      screen: 'GameDetails',
      gameId: match.booking_id,
      matchType: match.match_type,
      pitchName: match.pitch_name,
      matchTime: this.formatMatchTime(match.match_date, match.match_time)
    };

    console.log(`📱 Would send push notification to ${participant.push_token}:`, {
      title,
      message,
      data: notificationData
    });

    // TODO: Implement actual server-side push notification sending
    // This would use the expo-server-sdk to send to participant.push_token
    
    // For testing purposes, if this is the current user, send a local notification
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id === participant.user_id) {
        await sendCustomLocalNotification(title, message, notificationData, {
          sound: true,
          priority: 'high'
        });
      }
    } catch (error) {
      console.log('Note: Could not send test local notification:', error);
    }
  }

  /**
   * Log notification in database for tracking
   */
  private async logNotificationSent(
    userId: string, 
    bookingId: string, 
    title: string, 
    message: string
  ) {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'match_reminder',
          title: title,
          message: message,
          data: {
            booking_id: bookingId,
            reminder_type: '2_hour_reminder',
            sent_at: new Date().toISOString()
          },
          status: 'sent'
        });

      if (error) {
        console.error('❌ Error logging notification:', error);
      }
    } catch (error) {
      console.error('❌ Error in logNotificationSent:', error);
    }
  }

  /**
   * Mark a match reminder as sent in the database
   */
  private async markReminderSent(bookingId: string) {
    try {
      const { error } = await supabase
        .rpc('mark_reminder_sent', { booking_uuid: bookingId });

      if (error) {
        console.error('❌ Error marking reminder as sent:', error);
      } else {
        console.log(`✅ Marked reminder as sent for booking ${bookingId}`);
      }
    } catch (error) {
      console.error('❌ Error in markReminderSent:', error);
    }
  }

  /**
   * Format match date and time for display
   */
  private formatMatchTime(date: string, time: string): string {
    try {
      const matchDate = new Date(`${date}T${time}`);
      return matchDate.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return `${date} at ${time}`;
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.CHECK_INTERVAL,
      nextCheck: this.intervalId ? 'Running' : 'Stopped'
    };
  }

  /**
   * Manually trigger a check (for testing)
   */
  async triggerCheck() {
    console.log('📅 Manually triggering match reminder check...');
    await this.checkUpcomingMatches();
  }
}

// Export singleton instance
export const matchReminderService = new MatchReminderService();

// Export the class for testing
export default MatchReminderService;

