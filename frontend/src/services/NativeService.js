import { App } from '@capacitor/app';
import { Haptics } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

import BackgroundGeolocation from './BackgroundGeolocation';
import PushNotificationService from './PushNotificationService';
import OfflineSyncService from './OfflineSyncService';
import CameraService from './CameraService';

const isNative = Capacitor.isNativePlatform || Capacitor.platform !== 'web';

let Device;
try {
  Device = require('@capacitor/device');
} catch (e) {
  console.log('[NATIVE] Device module not available');
}

export const NativeService = {
  name: 'NativeService',
  isInitialized: false,

  async initialize() {
    if (this.isInitialized) return;
    if (!isNative) {
      console.log('[NATIVE] Skipping init - web platform');
      this.isInitialized = true;
      return;
    }

    console.log('[NATIVE] Initializing...');

    try {
      let deviceInfo = { platform: 'web', osVersion: '1.0.0', appVersion: '1.0.0', model: 'web' };
      let uuid = { uuid: 'web-' + Date.now() };
      
      try {
        if (Device) {
          deviceInfo = await Device.getInfo();
          uuid = await Device.getUuid();
        }
      } catch (e) {
        console.log('[NATIVE] Device info not available');
      }

      console.log('[NATIVE] Device:', deviceInfo.model, deviceInfo.platform, deviceInfo.osVersion);

      await this.setupAppListeners();

      await OfflineSyncService.setup();

      await Preferences.set({
        key: 'device_info',
        value: JSON.stringify({
          platform: deviceInfo.platform,
          version: deviceInfo.appVersion,
          uuid: uuid.uuid,
          model: deviceInfo.model
        })
      });

      this.isInitialized = true;
      console.log('[NATIVE] Initialize complete');
    } catch (error) {
      console.error('[NATIVE] Initialize error:', error);
    }
  },

  async requestAllPermissions() {
    if (!isNative) {
      console.log('[NATIVE] Skipping permissions - web platform');
      return { location: false, camera: false, notification: false, storage: true };
    }

    const results = {
      location: false,
      camera: false,
      notification: false,
      storage: false
    };

    try {
      results.location = await BackgroundGeolocation.requestPermission();
      results.camera = await CameraService.checkPermission();

      try {
        await PushNotificationService.setup();
        results.notification = true;
      } catch (e) {
        console.log('[NATIVE] Push permission not available');
      }

      results.storage = true;

      console.log('[NATIVE] Permissions:', results);
    } catch (error) {
      console.error('[NATIVE] Permission error:', error);
    }

    return results;
  },

  async startBackgroundServices() {
    console.log('[NATIVE] Starting background services...');

    try {
      await BackgroundGeolocation.startTracking();
      console.log('[NATIVE] Background services started');
    } catch (error) {
      console.error('[NATIVE] Background services error:', error);
    }
  },

  async stopBackgroundServices() {
    console.log('[NATIVE] Stopping background services...');

    try {
      await BackgroundGeolocation.stopTracking();
      console.log('[NATIVE] Background services stopped');
    } catch (error) {
      console.error('[NATIVE] Stop services error:', error);
    }
  },

  async setupAppListeners() {
    App.addListener('appStateChange', async (state) => {
      console.log('[NATIVE] App state:', state);

      if (state.isActive) {
        await OfflineSyncService.syncPending();
      } else if (state.isBackground) {
        await BackgroundGeolocation.startTracking();
      }
    });

    App.addListener('backButton', (data) => {
      console.log('[NATIVE] Back button:', data);
    });
  },

  async vibrate(type = 'success') {
    try {
      await Haptics.notification({ type: type });
    } catch (error) {
      console.log('[NATIVE] Vibrate error:', error);
    }
  },

  async hapticFeedback(style = 'light') {
    try {
      await Haptics.impact({ style: style });
    } catch (error) {
      console.log('[NATIVE] Haptic error:', error);
    }
  },

  async getNativeInfo() {
    try {
      let deviceInfo = { platform: 'web', osVersion: '1.0.0', model: 'web' };
      let uuid = { uuid: 'unknown' };
      
      try {
        if (Device) {
          deviceInfo = await Device.getInfo();
          uuid = await Device.getUuid();
        }
      } catch (e) {}

      return {
        platform: deviceInfo.platform,
        version: deviceInfo.osVersion,
        uuid: uuid.uuid,
        battery: 0,
        isCharging: false
      };
    } catch (error) {
      return {
        platform: 'web',
        version: '1.0.0',
        uuid: 'unknown',
        battery: 0,
        isCharging: false
      };
    }
  },

  async getBatteryInfo() {
    try {
      if (Device) {
        const info = await Device.getBatteryInfo();
        return {
          level: info.batteryLevel,
          isCharging: info.isCharging
        };
      }
    } catch (error) {}
    return { level: 0, charging: false };
  }
};

export default NativeService;