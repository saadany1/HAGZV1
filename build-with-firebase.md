# Build Commands with Firebase Integration

Now that Firebase is properly configured, use these commands to build your app:

## Development Build (Recommended for Testing)

```bash
# Build for Android development
eas build --platform android --profile development

# Build for iOS development (if needed)
eas build --platform ios --profile development
```

## Production Build

```bash
# Build for Android production
eas build --platform android --profile production

# Build for iOS production (if needed)
eas build --platform ios --profile production
```

## Build Status Verification

After running the build command, you should see:

1. **Firebase Configuration Detected**:
   ```
   ✅ Using google-services.json for Firebase configuration
   ```

2. **Expo Notifications Plugin Applied**:
   ```
   ✅ Applied expo-notifications plugin
   ```

3. **Build Successful**:
   ```
   ✅ Build completed successfully
   ```

## Installation and Testing

1. **Download the APK/AAB** from the EAS build dashboard
2. **Install on physical Android device** (not emulator)
3. **Open the app and login**
4. **Check console logs** for push token generation
5. **Test notifications** using the admin panel

## Quick Test Commands

After installing the app:

```bash
# Monitor logs during app startup
adb logcat | grep -i "expo\|firebase\|fcm\|push"

# Check if Firebase is initialized
adb logcat | grep -i "firebase"

# Monitor push token generation
adb logcat | grep -i "push.*token"
```

## Expected Log Output

When everything is working correctly, you should see:

```
Getting Expo push token with project ID: fff459d0-6111-4155-9d6a-715cb66f4b28
Platform: android
Device info: { isDevice: true, deviceName: "...", osVersion: "..." }
✅ Expo push token obtained: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
Token type: Expo Push Token
✅ Push token saved to database
✅ Push notifications registered successfully
```

## Troubleshooting Build Issues

### Issue: "google-services.json not found"
**Solution**: Ensure the file is in the project root and the path in `app.json` is correct.

### Issue: "Package name mismatch"
**Solution**: Verify that the package name in `app.json` matches one of the clients in `google-services.json`.

### Issue: "Build fails with Firebase errors"
**Solution**: Check that the `google-services.json` file is valid JSON and contains all required fields.

## Next Steps

1. **Build the app** using the commands above
2. **Install on a physical device**
3. **Test push notification functionality**
4. **Use the admin panel** to send test notifications
5. **Verify notifications are received** on the device

Your Firebase integration is now complete and ready for testing!




