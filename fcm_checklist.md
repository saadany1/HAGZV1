# ✅ FCM Push Notification Setup Checklist (React Native + Expo + AAB)

Use this checklist to verify the Firebase Cloud Messaging (FCM) setup for an app distributed via **Google Play Internal Testing**.  
Each step must be confirmed as **PASS** before moving on.

---

## 1. Firebase Project Setup
- [ ] The app is registered in **Firebase Console**.
- [ ] `google-services.json` downloaded for **Android app**.
- [ ] The **package name** in Firebase matches exactly:
  - `expo.android.package` in `app.json` or `app.config.js`
  - `applicationId` in `android/app/build.gradle`

---

## 2. google-services.json File
- [ ] File exists at: `android/app/google-services.json`
- [ ] The JSON contents contain correct `package_name` (same as app).
- [ ] If SHA-1 was updated in Firebase, the file was re-downloaded and replaced.

---

## 3. Play Store Signing Keys
- [ ] Open **Google Play Console → Setup → App Integrity**.
- [ ] Copy the **SHA-1 of App Signing certificate**.
- [ ] Paste this SHA-1 into **Firebase → Project Settings → Android App → Add Fingerprint**.
- [ ] After adding SHA-1, download a new `google-services.json` and update it in the project.

---

## 4. Gradle Configuration
### `android/build.gradle`
- [ ] Contains:
  ```gradle
  buildscript {
    dependencies {
      classpath 'com.google.gms:google-services:4.3.15'
    }
  }
  ```

### `android/app/build.gradle`
- [ ] Has:
  ```gradle
  apply plugin: 'com.google.gms.google-services'
  ```
- [ ] Includes Firebase Messaging dependency:
  ```gradle
  implementation 'com.google.firebase:firebase-messaging'
  ```

---

## 5. Android Permissions
Check `android/app/src/main/AndroidManifest.xml`:
- [ ] Contains:
  ```xml
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.WAKE_LOCK" />
  <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
  ```

---

## 6. Dependencies Installed
- [ ] Installed core Firebase packages:
  ```sh
  npx expo install @react-native-firebase/app @react-native-firebase/messaging
  ```

---

## 7. Code Validation
- [ ] App requests FCM token:
  ```js
  import messaging from '@react-native-firebase/messaging';

  async function getToken() {
    await messaging().registerDeviceForRemoteMessages();
    const token = await messaging().getToken();
    console.log('🔥 FCM Token:', token);
  }
  ```
- [ ] App requests permissions (optional for Android 13+, required for iOS).
- [ ] Token is logged in **adb logcat** when running the app.

---

## 8. Build & Test
- [ ] Built `.aab` with EAS or Gradle.
- [ ] Uploaded to **Google Play Internal Testing**.
- [ ] Installed via Play Store (not sideloaded).
- [ ] Opened app → checked logs → saw `🔥 FCM Token: ...`.

---

## 9. Sending Test Notification
- [ ] Open **Firebase Console → Cloud Messaging**.
- [ ] Paste FCM token from logs.
- [ ] Send test message.
- [ ] Device receives notification.

---

✅ If all steps above are marked **PASS**, push notifications via FCM are correctly configured.
