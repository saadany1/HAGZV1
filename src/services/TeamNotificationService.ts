import { supabase } from '../lib/supabase';
import { pushNotificationService, AdminPushService } from './pushNotificationService';

export interface TeamNotificationData {
  type: 'match_found' | 'team_chat_message' | 'team_update' | 'match_reminder';
  team_id: string;
  title: string;
  body: string;
  data?: any;
}

export class TeamNotificationService {
  /**
   * Send notification to all members of a team
   */
  static async notifyTeamMembers(
    teamId: string,
    excludeUserId: string | null,
    title: string,
    body: string,
    data?: any
  ): Promise<{ success: boolean; sentCount?: number; error?: string }> {
    try {
      console.log('Sending team notification:', { teamId, title, body });

      // Get all team members' push tokens
      const { data: tokens, error } = await supabase.rpc('get_team_push_tokens', {
        p_team_id: teamId,
        p_exclude_user_id: excludeUserId
      });

      if (error) {
        console.error('Error getting team push tokens:', error);
        return { success: false, error: error.message };
      }

      if (!tokens || tokens.length === 0) {
        console.log('No push tokens found for team members');
        return { success: false, error: 'No active push tokens found for team members' };
      }

      // Extract token strings
      const tokenStrings = tokens.map((item: any) => item.token).filter(Boolean);
      
      if (tokenStrings.length === 0) {
        return { success: false, error: 'No valid tokens found' };
      }

      // Send notifications using the admin service
      const result = await AdminPushService.sendPushNotification(
        tokenStrings,
        title,
        body,
        data
      );

      if (result.success) {
        console.log(`✅ Team notification sent to ${tokenStrings.length} members`);
        return { success: true, sentCount: tokenStrings.length };
      } else {
        return { success: false, error: result.error };
      }

    } catch (error) {
      console.error('Exception in notifyTeamMembers:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Notify team members when a match is found
   */
  static async notifyMatchFound(
    teamId: string,
    opponentTeamName: string,
    matchDate: string,
    matchTime: string
  ): Promise<{ success: boolean; sentCount?: number; error?: string }> {
    return this.notifyTeamMembers(
      teamId,
      null, // Don't exclude anyone
      'Match Found! ⚽',
      `You have a match against ${opponentTeamName} on ${matchDate} at ${matchTime}`,
      {
        type: 'match_found',
        team_id: teamId,
        opponent_team: opponentTeamName,
        match_date: matchDate,
        match_time: matchTime,
      }
    );
  }

  /**
   * Notify team members of a new chat message
   */
  static async notifyNewTeamMessage(
    teamId: string,
    senderUserId: string,
    senderName: string,
    message: string,
    messageId: string
  ): Promise<{ success: boolean; sentCount?: number; error?: string }> {
    const truncatedMessage = message.length > 50 ? `${message.substring(0, 50)}...` : message;
    
    return this.notifyTeamMembers(
      teamId,
      senderUserId, // Exclude the sender
      `New message from ${senderName}`,
      truncatedMessage,
      {
        type: 'team_chat_message',
        team_id: teamId,
        message_id: messageId,
        sender_id: senderUserId,
      }
    );
  }

  /**
   * Notify team members of team updates (new member, settings change, etc.)
   */
  static async notifyTeamUpdate(
    teamId: string,
    excludeUserId: string | null,
    title: string,
    body: string,
    updateType: string
  ): Promise<{ success: boolean; sentCount?: number; error?: string }> {
    return this.notifyTeamMembers(
      teamId,
      excludeUserId,
      title,
      body,
      {
        type: 'team_update',
        team_id: teamId,
        update_type: updateType,
      }
    );
  }

  /**
   * Notify team members of upcoming match reminder
   */
  static async notifyMatchReminder(
    teamId: string,
    opponentTeamName: string,
    matchDate: string,
    matchTime: string,
    minutesUntilMatch: number
  ): Promise<{ success: boolean; sentCount?: number; error?: string }> {
    const timeText = minutesUntilMatch >= 60 
      ? `${Math.floor(minutesUntilMatch / 60)} hour${Math.floor(minutesUntilMatch / 60) > 1 ? 's' : ''}`
      : `${minutesUntilMatch} minute${minutesUntilMatch > 1 ? 's' : ''}`;

    return this.notifyTeamMembers(
      teamId,
      null, // Don't exclude anyone
      'Match Reminder ⏰',
      `Your match against ${opponentTeamName} starts in ${timeText}!`,
      {
        type: 'match_reminder',
        team_id: teamId,
        opponent_team: opponentTeamName,
        match_date: matchDate,
        match_time: matchTime,
        minutes_until: minutesUntilMatch,
      }
    );
  }

  /**
   * Get team members count for notification purposes
   */
  static async getTeamMembersCount(teamId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', teamId);

      if (error) {
        console.error('Error getting team members count:', error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      console.error('Exception getting team members count:', error);
      return 0;
    }
  }

  /**
   * Check if user has push notifications enabled for team
   */
  static async isUserNotificationEnabled(userId: string, teamId: string): Promise<boolean> {
    try {
      // Check if user has active push tokens
      const { data, error } = await supabase.rpc('get_user_push_tokens', {
        p_user_id: userId
      });

      if (error || !data || data.length === 0) {
        return false;
      }

      // For now, assume all users with tokens want team notifications
      // In the future, you could add a user preferences table
      return true;
    } catch (error) {
      console.error('Exception checking user notification settings:', error);
      return false;
    }
  }
}

export default TeamNotificationService;
