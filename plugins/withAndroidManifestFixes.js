const { withAndroidManifest } = require('@expo/config-plugins');

const withAndroidManifestFixes = (config) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    
    // Add Firebase Cloud Messaging permission
    const fcmPermission = {
      $: {
        'android:name': 'com.google.android.c2dm.permission.RECEIVE'
      }
    };
    
    // Check if permission already exists
    const existingPermissions = androidManifest.manifest['uses-permission'] || [];
    const hasFcmPermission = existingPermissions.some(
      permission => permission.$['android:name'] === 'com.google.android.c2dm.permission.RECEIVE'
    );
    
    if (!hasFcmPermission) {
      androidManifest.manifest['uses-permission'].push(fcmPermission);
    }
    
    // Add tools namespace if not present
    if (!androidManifest.manifest.$['xmlns:tools']) {
      androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }
    
    // Add tools:replace to application tag to resolve conflicts
    if (androidManifest.manifest.application && androidManifest.manifest.application[0]) {
      const app = androidManifest.manifest.application[0];
      if (!app.$['tools:replace']) {
        app.$['tools:replace'] = 'android:allowBackup';
      }
    }
    
    // Add Firebase messaging service
    const firebaseService = {
      $: {
        'android:name': 'com.google.firebase.messaging.FirebaseMessagingService',
        'android:exported': 'false',
        'tools:replace': 'android:exported'
      },
      'intent-filter': [{
        $: {
          'android:priority': '-500'
        },
        action: [{
          $: {
            'android:name': 'com.google.firebase.MESSAGING_EVENT'
          }
        }]
      }]
    };
    
    // Add Firebase Instance ID service
    const firebaseInstanceService = {
      $: {
        'android:name': 'com.google.firebase.iid.FirebaseInstanceIdService',
        'android:exported': 'false',
        'tools:replace': 'android:exported'
      },
      'intent-filter': [{
        $: {
          'android:priority': '-500'
        },
        action: [{
          $: {
            'android:name': 'com.google.firebase.INSTANCE_ID_EVENT'
          }
        }]
      }]
    };
    
    // Add Firebase messaging receiver
    const firebaseReceiver = {
      $: {
        'android:name': 'com.google.firebase.iid.FirebaseInstanceIdReceiver',
        'android:exported': 'true',
        'android:permission': 'com.google.android.c2dm.permission.SEND',
        'tools:replace': 'android:exported'
      },
      'intent-filter': [{
        $: {
          'android:priority': '-500'
        },
        action: [
          {
            $: {
              'android:name': 'com.google.android.c2dm.intent.RECEIVE'
            }
          },
          {
            $: {
              'android:name': 'com.google.android.c2dm.intent.REGISTRATION'
            }
          }
        ],
        category: [{
          $: {
            'android:name': '${applicationId}'
          }
        }]
      }]
    };
    
    // Ensure application array exists
    if (!androidManifest.manifest.application || !androidManifest.manifest.application[0]) {
      return config;
    }
    
    const app = androidManifest.manifest.application[0];
    
    // Initialize service and receiver arrays if they don't exist
    if (!app.service) {
      app.service = [];
    }
    if (!app.receiver) {
      app.receiver = [];
    }
    
    // Add Firebase services if they don't exist
    const hasFirebaseService = app.service.some(
      service => service.$['android:name'] === 'com.google.firebase.messaging.FirebaseMessagingService'
    );
    
    if (!hasFirebaseService) {
      app.service.push(firebaseService);
      app.service.push(firebaseInstanceService);
    }
    
    const hasFirebaseReceiver = app.receiver.some(
      receiver => receiver.$['android:name'] === 'com.google.firebase.iid.FirebaseInstanceIdReceiver'
    );
    
    if (!hasFirebaseReceiver) {
      app.receiver.push(firebaseReceiver);
    }
    
    // Add tools:replace to Firebase metadata to resolve conflicts
    if (app['meta-data']) {
      app['meta-data'].forEach(metadata => {
        const name = metadata.$['android:name'];
        if (name && name.startsWith('com.google.firebase.messaging.default_notification_')) {
          if (metadata.$['android:value']) {
            metadata.$['tools:replace'] = 'android:value';
          } else if (metadata.$['android:resource']) {
            metadata.$['tools:replace'] = 'android:resource';
          }
        }
      });
    }
    
    // Ensure Firebase metadata has tools:replace attributes
    const firebaseMetadata = [
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
    
    firebaseMetadata.forEach(meta => {
      const existingMeta = app['meta-data'].find(m => m.$['android:name'] === meta.name);
      if (existingMeta) {
        existingMeta.$['tools:replace'] = meta.replaceAttr;
      }
    });
    
    return config;
  });
};

module.exports = withAndroidManifestFixes;
