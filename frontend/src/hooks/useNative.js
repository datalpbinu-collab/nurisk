import { useEffect, useState, useCallback } from 'react';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

import {
  BackgroundGeolocation,
  PushNotificationService,
  OfflineSyncService,
  CameraService,
  NativeService
} from '../services/native';

export function useNative() {
  const [isNative, setIsNative] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [permissions, setPermissions] = useState({
    location: false,
    camera: false,
    notification: false,
    storage: false
  });
  const [pendingSync, setPendingSync] = useState(0);
  const [pendingMedia, setPendingMedia] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const detectPlatform = async () => {
      try {
        // Capacitor 6.x - use Capacitor.isNativePlatform
        const isNative = Capacitor.isNativePlatform;
        setIsNative(!!isNative);
      } catch (e) {
        setIsNative(false);
      }
    };

    const checkStatus = async () => {
      try {
        const queue = await OfflineSyncService.getQueue();
        setPendingSync(queue.length);

        const photosCount = await CameraService.getPhotosCount();
        setPendingMedia(photosCount);

        const trackingPref = await Preferences.get({ key: 'geolocation_tracking' });
        setIsTracking(trackingPref.value === 'true');
      } catch (e) {}
    };

    detectPlatform();
    checkStatus();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const initialize = useCallback(async () => {
    if (isInitialized) return;

    try {
      await NativeService.initialize();
      setIsInitialized(true);
    } catch (error) {
      console.error('[useNative] Init error:', error);
    }
  }, [isInitialized]);

  const requestPermissions = useCallback(async () => {
    try {
      const result = await NativeService.requestAllPermissions();
      setPermissions(result);
    } catch (error) {
      console.error('[useNative] Permission error:', error);
    }
  }, []);

  const startTracking = useCallback(async () => {
    try {
      await BackgroundGeolocation.startTracking();
      setIsTracking(true);
    } catch (error) {
      console.error('[useNative] Start tracking error:', error);
    }
  }, []);

  const stopTracking = useCallback(async () => {
    try {
      await BackgroundGeolocation.stopTracking();
      setIsTracking(false);
    } catch (error) {
      console.error('[useNative] Stop tracking error:', error);
    }
  }, []);

  const syncNow = useCallback(async () => {
    try {
      const result = await OfflineSyncService.syncPending();
      setPendingSync(result.failed);
      return result;
    } catch (error) {
      console.error('[useNative] Sync error:', error);
      return { synced: 0, failed: 0 };
    }
  }, []);

  const takePhoto = useCallback(async (incident_id) => {
    try {
      const photo = await CameraService.takePhoto({ incident_id });
      if (photo) {
        setPendingMedia(prev => prev + 1);
      }
      return photo;
    } catch (error) {
      console.error('[useNative] Take photo error:', error);
      return null;
    }
  }, []);

  const pickPhoto = useCallback(async (incident_id) => {
    try {
      const photo = await CameraService.pickFromGallery(incident_id);
      if (photo) {
        setPendingMedia(prev => prev + 1);
      }
      return photo;
    } catch (error) {
      console.error('[useNative] Pick photo error:', error);
      return null;
    }
  }, []);

  const showNotification = useCallback(async (title, body) => {
    try {
      await PushNotificationService.showLocalNotification({
        title,
        body,
        id: `app_${Date.now()}`
      });
    } catch (error) {
      console.error('[useNative] Show notification error:', error);
    }
  }, []);

  return {
    isNative,
    isOnline,
    isTracking,
    permissions,
    pendingSync,
    pendingMedia,
    isInitialized,
    initialize,
    requestPermissions,
    startTracking,
    stopTracking,
    syncNow,
    takePhoto,
    pickPhoto,
    showNotification
  };
}

export default useNative;