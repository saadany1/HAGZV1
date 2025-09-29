const { withAndroidManifest } = require('@expo/config-plugins');

const withFirebaseManifestFix = (config) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    
    console.log('🔧 Applying Firebase manifest fixes...');
    
    // Ensure tools namespace is present
    if (!androidManifest.manifest.$['xmlns:tools']) {
      androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
      console.log('✅ Added tools namespace');
    }
    
    // Add Firebase FCM permission if not present
    const fcmPermission = {
      $: {
        'android:name': 'com.google.android.c2dm.permission.RECEIVE'
      }
    };
    
    const existingPermissions = androidManifest.manifest['uses-permission'] || [];
    const hasFcmPermission = existingPermissions.some(
      permission => permission.$['android:name'] === 'com.google.android.c2dm.permission.RECEIVE'
    );
    
    if (!hasFcmPermission) {
      if (!androidManifest.manifest['uses-permission']) {
        androidManifest.manifest['uses-permission'] = [];
      }
      androidManifest.manifest['uses-permission'].push(fcmPermission);
      console.log('✅ Added Firebase FCM permission');
    }
    
    // Ensure application exists
    if (!androidManifest.manifest.application || !androidManifest.manifest.application[0]) {
      console.log('❌ No application tag found');
      return config;
    }
    
    const app = androidManifest.manifest.application[0];
    
    // Add tools:replace to application tag
    if (!app.$['tools:replace']) {
      app.$['tools:replace'] = 'android:allowBackup';
      console.log('✅ Added tools:replace to application');
    }
    
    // Ensure meta-data array exists
    if (!app['meta-data']) {
      app['meta-data'] = [];
    }
    
    // Force add Firebase metadata with tools:replace attributes
    const firebaseMetadataConfigs = [
      {
        name: 'com.google.firebase.messaging.default_notification_channel_id',
        value: 'default',
        replaceAttr: 'android:value'
      },
      {
        name: 'com.google.firebase.messaging.default_notification_color',
        resource: '@color/notification_icon_color',
        replaceAttr: 'android:resource'
      },
      {
        name: 'com.google.firebase.messaging.default_notification_icon',
        resource: '@drawable/notification_icon',
        replaceAttr: 'android:resource'
      }
    ];
    
    firebaseMetadataConfigs.forEach(metaConfig => {
      // Remove any existing metadata with the same name
      app['meta-data'] = app['meta-data'].filter(
        meta => meta.$['android:name'] !== metaConfig.name
      );
      
      // Create new metadata with tools:replace
      const newMetadata = {
        $: {
          'android:name': metaConfig.name,
          'tools:replace': metaConfig.replaceAttr
        }
      };
      
      if (metaConfig.value) {
        newMetadata.$['android:value'] = metaConfig.value;
      } else if (metaConfig.resource) {
        newMetadata.$['android:resource'] = metaConfig.resource;
      }
      
      // Add the new metadata
      app['meta-data'].push(newMetadata);
      console.log(`✅ Added ${metaConfig.name} with tools:replace="${metaConfig.replaceAttr}"`);
    });
    
    // Add Firebase services if not present
    if (!app.service) {
      app.service = [];
    }
    
    const firebaseService = {
      $: {
        'android:name': 'com.google.firebase.messaging.FirebaseMessagingService',
        'android:exported': 'false',
        'tools:replace': 'android:exported'
      },
      'intent-filter': [{
        $: { 'android:priority': '-500' },
        action: [{ $: { 'android:name': 'com.google.firebase.MESSAGING_EVENT' } }]
      }]
    };
    
    const hasFirebaseService = app.service.some(
      service => service.$['android:name'] === 'com.google.firebase.messaging.FirebaseMessagingService'
    );
    
    if (!hasFirebaseService) {
      app.service.push(firebaseService);
      console.log('✅ Added Firebase messaging service');
    }
    
    // Add Firebase receiver if not present
    if (!app.receiver) {
      app.receiver = [];
    }
    
    const firebaseReceiver = {
      $: {
        'android:name': 'com.google.firebase.iid.FirebaseInstanceIdReceiver',
        'android:exported': 'true',
        'android:permission': 'com.google.android.c2dm.permission.SEND',
        'tools:replace': 'android:exported'
      },
      'intent-filter': [{
        $: { 'android:priority': '-500' },
        action: [
          { $: { 'android:name': 'com.google.android.c2dm.intent.RECEIVE' } },
          { $: { 'android:name': 'com.google.android.c2dm.intent.REGISTRATION' } }
        ],
        category: [{ $: { 'android:name': '${applicationId}' } }]
      }]
    };
    
    const hasFirebaseReceiver = app.receiver.some(
      receiver => receiver.$['android:name'] === 'com.google.firebase.iid.FirebaseInstanceIdReceiver'
    );
    
    if (!hasFirebaseReceiver) {
      app.receiver.push(firebaseReceiver);
      console.log('✅ Added Firebase messaging receiver');
    }
    
    console.log('🎉 Firebase manifest fixes completed successfully!');
    
    return config;
  });
};

module.exports = withFirebaseManifestFix;

