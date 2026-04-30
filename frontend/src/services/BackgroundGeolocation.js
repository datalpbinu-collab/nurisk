import { 
  Geolocation
} from '@capacitor/geolocation';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import api from './api';

const LOCATION_KEY = 'offline_locations';
const isNative = Capacitor.isNativePlatform || Capacitor.platform !== 'web';

let locationWatchId = null;
let isTracking = false;

export const BackgroundGeolocation = {
  name: 'BackgroundGeolocation',
  
  async checkPermission() {
    if (!isNative) return { location: 'denied' };
    return await Geolocation.checkPermissions();
  },

  async requestPermission() {
    if (!isNative) return false;
    try {
      const result = await Geolocation.requestPermissions();
      return result.location === 'granted' || result.coarseLocation === 'granted';
    } catch (e) {
      console.log('[GEO] Permission request not available:', e.message);
      return false;
    }
  },

  async startTracking() {
    if (!isNative) {
      console.log('[GEO] Skipping - not native platform');
      return false;
    }
    if (isTracking) {
      console.log('[GEO] Already tracking');
      return true;
    }

    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      console.log('[GEO] Permission denied');
      return false;
    }

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });

      await this.saveLocation({
        volunteer_id: 0,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
        status: 'active'
      });

      try {
        locationWatchId = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 30000,
            distanceFilter: 10
          },
          async (position, err) => {
            if (position && !err) {
              await this.saveLocation({
                volunteer_id: 0,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp,
                status: 'active'
              });
            }
          }
        );
      } catch (e) {
        console.log('[GEO] Watch not available');
      }

      isTracking = true;
      await Preferences.set({ key: 'geolocation_tracking', value: 'true' });
      
      console.log('[GEO] Started tracking');
      return true;
    } catch (error) {
      console.error('[GEO] Start error:', error);
      return false;
    }
  },

  async stopTracking() {
    if (locationWatchId) {
      await Geolocation.clearWatch({ id: locationWatchId });
      locationWatchId = null;
    }

    isTracking = false;
    await Preferences.set({ key: 'geolocation_tracking', value: 'false' });
    console.log('[GEO] Stopped tracking');
  },

  async saveLocation(location) {
    try {
      const stored = await Preferences.get({ key: LOCATION_KEY });
      let locations = [];

      if (stored.value) {
        locations = JSON.parse(stored.value);
      }

      locations.push(location);

      if (locations.length > 100) {
        locations = locations.slice(-100);
      }

      await Preferences.set({
        key: LOCATION_KEY,
        value: JSON.stringify(locations)
      });
    } catch (error) {
      console.error('[GEO] Save location error:', error);
    }
  },

  async getStoredLocations() {
    try {
      const stored = await Preferences.get({ key: LOCATION_KEY });
      if (stored.value) {
        return JSON.parse(stored.value);
      }
    } catch (error) {
      console.error('[GEO] Get locations error:', error);
    }
    return [];
  },

  async syncLocations(locations) {
    try {
      const userData = await Preferences.get({ key: 'userData' });
      if (!userData.value) return;

      const user = JSON.parse(userData.value);
      
      const enrichedLocations = locations.map(loc => ({
        ...loc,
        volunteer_id: user.id
      }));

      await api.post('/volunteers/location-sync', {
        locations: enrichedLocations
      });

      await Preferences.set({
        key: LOCATION_KEY,
        value: JSON.stringify([])
      });

      console.log('[GEO] Synced', locations.length, 'locations');
    } catch (error) {
      console.error('[GEO] Sync error:', error);
    }
  },

  async getCurrentPosition() {
    try {
      return await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });
    } catch (error) {
      console.error('[GEO] Get position error:', error);
      return null;
    }
  },

  isTrackingStatus() {
    return isTracking;
  }
};

export default BackgroundGeolocation;