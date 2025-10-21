import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { ENV } from '../config/env';

// Configure how notifications are handled when received in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('NL', {
    name: 'HAGZ',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'notification_sound.wav',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function getExpoPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.warn('Push notifications require a physical device');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('Push notification permissions not granted');
      return null;
    }

    await ensureAndroidChannel();

    const pushToken = (await Notifications.getExpoPushTokenAsync()).data;
    return pushToken;
  } catch (error) {
    console.error('Error getting Expo push token:', error);
    return null;
  }
}

export async function registerForPushAndSaveToken(): Promise<{ token: string | null }>
{
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      // No logged-in user; skip saving
      return { token: null };
    }

    const token = await getExpoPushToken();
    if (!token) return { token: null };

    // Save to user_profiles.push_token
    const { error } = await supabase
      .from('user_profiles')
      .update({ push_token: token })
      .eq('id', user.id);

    if (error) {
      console.error('Failed to save push token:', error);
    }

    return { token };
  } catch (error) {
    console.error('registerForPushAndSaveToken error:', error);
    return { token: null };
  }
}

type BroadcastPayload = {
  title: string;
  message: string;
  data?: Record<string, any>;
  sound?: boolean;
};

export async function sendBroadcastNotification(payload: BroadcastPayload): Promise<{ ok: boolean; sentCount?: number; error?: string; raw?: string }>
{
  try {
    const url = `${ENV.API_BASE_URL}/send-broadcast-notification`;
    console.log('🚀 Sending broadcast notification to:', url);
    console.log('📦 Payload:', payload);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

    // Try to parse JSON, but gracefully handle HTML/text error pages
    const contentType = response.headers.get('content-type') || '';
    let parsed: any = null;
    let rawText: string | undefined;
    if (contentType.includes('application/json')) {
      try {
        parsed = await response.json();
        console.log('✅ Parsed JSON response:', parsed);
      } catch (e) {
        // fall back to text to capture server error pages
        rawText = await response.text();
        console.log('⚠️ Failed to parse JSON, got text:', rawText);
      }
    } else {
      rawText = await response.text();
      console.log('📄 Non-JSON response:', rawText);
    }

    if (!response.ok) {
      const message = parsed?.error || rawText || `HTTP ${response.status}`;
      console.error('❌ Request failed:', message);
      return { ok: false, error: message, raw: rawText };
    }

    const sent = parsed?.sentCount ?? parsed?.success ?? 0;
    console.log('✅ Broadcast successful, sent to:', sent, 'devices');
    return { ok: true, sentCount: typeof sent === 'number' ? sent : 0, raw: rawText };
  } catch (error: any) {
    console.error('💥 Broadcast error:', error);
    return { ok: false, error: String(error?.message || error) };
  }
}


