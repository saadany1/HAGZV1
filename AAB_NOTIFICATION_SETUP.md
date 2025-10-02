# AAB Notification Setup Guide

## Changes Made for AAB Compatibility

### 1. Enhanced Push Notification Service (`src/services/pushNotifications.ts`)
- ✅ Added comprehensive debug logging
- ✅ Fixed project ID detection for standalone builds
- ✅ Added environment detection (Expo Go vs Standalone)
- ✅ Improved error handling and fallbacks
- ✅ Enhanced Android notification channel creation

### 2. Updated App Configuration (`app.json`)
- ✅ Added `POST_NOTIFICATIONS` permission for Android 13+
- ✅ Added `VIBRATE` and `WAKE_LOCK` permissions
- ✅ Updated notification icon to use `notification_icon.png`
- ✅ Set notification mode to `production`

### 3. Created Notification Debugger (`src/services/notificationDebugger.ts`)
- ✅ Comprehensive diagnostic tool for AAB builds
- ✅ Tests local notifications, channels, and permissions
- ✅ Provides detailed environment information
- ✅ Helps identify AAB-specific issues

### 4. Enhanced Push Notification Tester
- ✅ Added diagnostic button for AAB testing
- ✅ Improved error reporting and logging
- ✅ Better token validation and display

## Testing Steps for AAB Builds

### 1. Build and Install AAB
```bash
cd HagzApp
npx expo prebuild --clean
npx eas build -p android --profile production
```

### 2. Install on Physical Device
- Download and install the AAB file
- Grant notification permissions when prompted

### 3. Test Notification Flow
1. **Open the app** and navigate to the notification tester
2. **Run Diagnostic** - Click the "Diagnostic" button to run full tests
3. **Check Console Logs** - Look for detailed debug information
4. **Test Local Notifications** - Verify local notifications work
5. **Test Push Tokens** - Ensure tokens are generated correctly
6. **Test Server Notifications** - Send test notifications from your server

### 4. Debug Information to Check
- Device type (physical vs simulator)
- App ownership (expo vs standalone)
- Project ID availability
- Permission status
- Token generation success
- Notification channel creation

## Common AAB Issues and Solutions

### Issue: Notifications work in Expo Go but not AAB
**Solution**: 
- Check if project ID is available in standalone builds
- Verify Firebase configuration is correct
- Ensure notification permissions are granted
- Test local notifications first

### Issue: Push tokens not generated
**Solution**:
- Check if running on physical device
- Verify notification permissions
- Check console logs for token generation errors
- Try fallback token generation method

### Issue: Notifications not showing
**Solution**:
- Check notification channel creation
- Verify sound files are bundled correctly
- Check Android notification settings
- Test with different notification priorities

## Key Differences: Expo Go vs AAB

| Feature | Expo Go | AAB Build |
|---------|---------|-----------|
| Push Service | Expo Push Service | Expo Push Service + Firebase |
| Project ID | Not required | Required for standalone |
| Permissions | Auto-granted | Must be requested |
| Sound Files | Bundled automatically | Must be in assets |
| Debugging | Limited | Full access to logs |

## Environment Detection
The app now automatically detects the environment:
- `Constants.appOwnership === 'expo'` - Expo Go
- `Constants.appOwnership === 'standalone'` - AAB/APK build

## Debug Commands
Use the diagnostic tool to get comprehensive information:
```typescript
import NotificationDebugger from '../services/notificationDebugger';

// Get debug info
const debugInfo = await NotificationDebugger.getDebugInfo();

// Run full diagnostic
const result = await NotificationDebugger.runFullDiagnostic();
```

## Next Steps
1. Build AAB with these changes
2. Install on physical device
3. Run diagnostic tests
4. Check console logs for any issues
5. Test push notifications from server
6. Verify all notification types work correctly

## Support
If issues persist, check:
- Console logs for detailed error messages
- Firebase project configuration
- Google Services JSON file
- Notification permissions
- Device notification settings

