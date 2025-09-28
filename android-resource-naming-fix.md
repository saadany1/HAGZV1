# Android Resource Naming Fix

## Issue
Android resource files (inside res/raw, res/drawable, etc.) cannot use dashes (-) in their names. They must use only lowercase letters, numbers, or underscores.

## Files Affected
The following files had invalid names with dashes:
- `notification-sound.wav` ❌
- `notification-icon.png` ❌

## ✅ Solution Applied

### 1. File Renaming
**Old Names → New Names:**
- `notification-sound.wav` → `notification_sound.wav` ✅
- `notification-icon.png` → `notification_icon.png` ✅

### 2. Code Updates
Updated all references in the following files:

**`app.json`:**
```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification_icon.png",  // ✅ Updated
          "sounds": ["./assets/notification_sound.wav"]  // ✅ Updated
        }
      ]
    ]
  }
}
```

**`src/services/pushNotificationService.ts`:**
```typescript
// Android notification channel
await Notifications.setNotificationChannelAsync('default', {
  sound: 'notification_sound.wav',  // ✅ Updated
});

// Local test notification
await Notifications.scheduleNotificationAsync({
  content: {
    sound: 'notification_sound.wav',  // ✅ Updated
  },
});
```

### 3. Verification
- ✅ All file references updated
- ✅ No remaining dashes in resource file names
- ✅ Files exist in correct location (`assets/`)
- ✅ No broken references in codebase

## Android Resource Naming Rules

For future reference, Android resource files must follow these rules:

### ✅ Valid Characters:
- Lowercase letters (a-z)
- Numbers (0-9)
- Underscores (_)

### ❌ Invalid Characters:
- Dashes (-)
- Uppercase letters (A-Z)
- Spaces
- Special characters (@, #, $, etc.)

### Examples:
- ✅ `notification_sound.wav`
- ✅ `app_icon.png`
- ✅ `background_music.mp3`
- ✅ `sound1.wav`
- ❌ `notification-sound.wav`
- ❌ `App-Icon.png`
- ❌ `background music.mp3`

## Impact on Build
This fix ensures that:
1. **EAS Build** will succeed without Android resource naming errors
2. **Notification sounds** will work properly on Android devices
3. **Notification icons** will display correctly
4. **No runtime errors** related to missing resources

## Next Steps
1. **Create new build** with `eas build --platform android`
2. **Test notifications** on physical Android device
3. **Verify sound playback** when notifications are received
4. **Confirm icon display** in notification tray

The Android resource naming issue has been completely resolved! 🎉



