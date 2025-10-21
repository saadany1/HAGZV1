// Game Invitation Notification Service
// Handles push notifications for game invitations

import { supabase } from '../lib/supabase';
import { getEndpointUrl, SERVER_CONFIG } from '../config/server';

interface GameInvitationData {
  user_id: string;
  type: string;
  title: string;
  message: string;
  game_id: string;
  invited_by: string;
  status?: string;
}

interface InvitationDetails {
  gameTitle: string;
  gameDate: string;
  gameTime: string;
  pitchName: string;
  pitchLocation?: string;
  inviterName: string;
  gameId: string;
}

class GameInvitationService {
  /**
   * Send game invitation with push notification
   */
  async sendGameInvitation(
    targetUserId: string,
    inviterUserId: string,
    invitationDetails: InvitationDetails
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🎮 Sending game invitation to user ${targetUserId}`);

      // Get target user's push token
      const { data: targetUser, error: userError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, push_token')
        .eq('id', targetUserId)
        .single();

      if (userError || !targetUser) {
        console.error('❌ Target user not found:', userError);
        return { success: false, error: 'User not found' };
      }

      // Create notification in database
      const notificationData: GameInvitationData = {
        user_id: targetUserId,
        type: 'game_invitation',
        title: '⚽ Game Invitation',
        message: `${invitationDetails.inviterName} invited you to join "${invitationDetails.gameTitle}" on ${invitationDetails.gameDate} at ${invitationDetails.gameTime}`,
        game_id: invitationDetails.gameId,
        invited_by: inviterUserId,
        status: 'pending'
      };

      const { data: notification, error: notificationError } = await supabase
        .from('notifications')
        .insert([{
          ...notificationData,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (notificationError) {
        console.error('❌ Error creating notification:', notificationError);
        return { success: false, error: 'Failed to create notification' };
      }

      // Send push notification if user has a valid token
      if (targetUser.push_token) {
        try {
          console.log(`📱 Attempting to send push notification to ${targetUser.email} with token: ${targetUser.push_token.substring(0, 20)}...`);
          
          const serverUrl = 'https://web-production-397d5.up.railway.app'; // Use the correct server URL
          
          const pushNotificationData = {
            screen: 'GameDetails',
            gameId: invitationDetails.gameId,
            invitationId: notification.id,
            type: 'game_invitation',
            inviterName: invitationDetails.inviterName,
            gameTitle: invitationDetails.gameTitle,
            gameDate: invitationDetails.gameDate,
            gameTime: invitationDetails.gameTime
          };

          console.log('📤 Sending push notification request to server:', {
            serverUrl: `${serverUrl}/send-game-invitation`,
            userId: targetUserId,
            title: notificationData.title,
            message: notificationData.message,
            data: pushNotificationData
          });

          const response = await fetch(`${serverUrl}/send-game-invitation`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: targetUserId,
              title: notificationData.title,
              message: notificationData.message,
              data: pushNotificationData,
            }),
          });

          console.log('📡 Server response status:', response.status);
          
          if (!response.ok) {
            throw new Error(`Server responded with status ${response.status}: ${response.statusText}`);
          }
          
          const result = await response.json();
          console.log('📡 Server response:', result);
          
          if (result.success) {
            console.log(`✅ Push notification sent successfully to ${targetUser.email}`);
          } else {
            console.warn(`⚠️ Push notification failed for ${targetUser.email}:`, result.error);
          }
        } catch (pushError) {
          console.error('❌ Error sending push notification:', pushError);
          // Don't fail the entire invitation if push notification fails
        }
      } else {
        console.log(`ℹ️ No push token for user ${targetUser.email}, skipping push notification`);
      }

      console.log(`✅ Game invitation sent successfully to ${targetUser.email}`);
      return { success: true };

    } catch (error) {
      console.error('❌ Error in sendGameInvitation:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Send push notification for game invitation
   */
  // Push notification method removed

  /**
   * Send local notification if this is the current user (for testing)
   */
  // Local notification method removed

  /**
   * Format date and time for display
   */
  private formatDateTime(date: string, time: string): string {
    try {
      // Handle different date formats
      let formattedDate = date;
      let formattedTime = time;
      
      // If date is in YYYY-MM-DD format, format it nicely
      if (date.includes('-')) {
        const dateObj = new Date(date);
        if (!isNaN(dateObj.getTime())) {
          formattedDate = dateObj.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          });
        }
      }
      
      // If time is in HH:MM format, format it nicely
      if (time.includes(':')) {
        const timeObj = new Date(`2000-01-01T${time}`);
        if (!isNaN(timeObj.getTime())) {
          formattedTime = timeObj.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
        }
      }
      
      return `${formattedDate} at ${formattedTime}`;
    } catch (error) {
      console.log('Date formatting error:', error);
      return `${date} at ${time}`;
    }
  }

  /**
   * Check if user already has pending invitation for this game
   */
  async hasPendingInvitation(userId: string, gameId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('game_id', gameId)
        .eq('type', 'game_invitation')
        .eq('status', 'pending')
        .single();

      return !error && !!data;
    } catch (error) {
      console.error('Error checking pending invitation:', error);
      return false;
    }
  }

  /**
   * Bulk send invitations to multiple users
   */
  async sendBulkInvitations(
    targetUserIds: string[],
    inviterUserId: string,
    invitationDetails: InvitationDetails
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const userId of targetUserIds) {
      try {
        // Check for existing invitation
        const hasPending = await this.hasPendingInvitation(userId, invitationDetails.gameId);
        if (hasPending) {
          errors.push(`User ${userId} already has a pending invitation`);
          failed++;
          continue;
        }

        const result = await this.sendGameInvitation(userId, inviterUserId, invitationDetails);
        if (result.success) {
          success++;
        } else {
          failed++;
          errors.push(result.error || `Failed to invite user ${userId}`);
        }
      } catch (error) {
        failed++;
        errors.push(`Error inviting user ${userId}: ${error}`);
      }
    }

    console.log(`📊 Bulk invitation results: ${success} success, ${failed} failed`);
    return { success, failed, errors };
  }
}

// Export singleton instance
export const gameInvitationService = new GameInvitationService();

// Export the class for testing
export default GameInvitationService;





