import { Preferences } from '@capacitor/preferences';
import { Network } from '@capacitor/network';

const CACHE_VERSION = 'v1';
const CACHE_KEYS = {
  incidents: `cache_incidents_${CACHE_VERSION}`,
  inventory: `cache_inventory_${CACHE_VERSION}`,
  news: `cache_news_${CACHE_VERSION}`,
  user: `cache_user_${CACHE_VERSION}`,
  weather: `cache_weather_${CACHE_VERSION}`,
  volunteers: `cache_volunteers_${CACHE_VERSION}`,
  shelters: `cache_shelters_${CACHE_VERSION}`,
  actions: `cache_actions_${CACHE_VERSION}`,
  lastSync: 'cache_last_sync'
};

export const OfflineDataService = {
  name: 'OfflineDataService',

  async isOnline() {
    try {
      const status = await Network.getStatus();
      return status.connected;
    } catch {
      return navigator.onLine;
    }
  },

  async cacheIncidents(incidents) {
    try {
      await Preferences.set({
        key: CACHE_KEYS.incidents,
        value: JSON.stringify({
          data: incidents,
          timestamp: Date.now()
        })
      });
      console.log('[CACHE] Incidents cached:', incidents.length);
    } catch (e) { console.error('[CACHE] Incident error:', e); }
  },

  async getCachedIncidents() {
    try {
      const stored = await Preferences.get({ key: CACHE_KEYS.incidents });
      if (stored.value) {
        const parsed = JSON.parse(stored.value);
        return parsed.data || [];
      }
    } catch (e) { console.error('[CACHE] Get incidents error:', e); }
    return [];
  },

  async cacheInventory(inventory) {
    try {
      await Preferences.set({
        key: CACHE_KEYS.inventory,
        value: JSON.stringify({
          data: inventory,
          timestamp: Date.now()
        })
      });
      console.log('[CACHE] Inventory cached:', inventory.length);
    } catch (e) { console.error('[CACHE] Inventory error:', e); }
  },

  async getCachedInventory() {
    try {
      const stored = await Preferences.get({ key: CACHE_KEYS.inventory });
      if (stored.value) {
        const parsed = JSON.parse(stored.value);
        return parsed.data || [];
      }
    } catch (e) { console.error('[CACHE] Get inventory error:', e); }
    return [];
  },

  async cacheNews(news) {
    try {
      await Preferences.set({
        key: CACHE_KEYS.news,
        value: JSON.stringify({
          data: news,
          timestamp: Date.now()
        })
      });
    } catch (e) { console.error('[CACHE] News error:', e); }
  },

  async getCachedNews() {
    try {
      const stored = await Preferences.get({ key: CACHE_KEYS.news });
      if (stored.value) {
        const parsed = JSON.parse(stored.value);
        return parsed.data || [];
      }
    } catch (e) { console.error('[CACHE] Get news error:', e); }
    return [];
  },

  async cacheWeather(weather) {
    try {
      await Preferences.set({
        key: CACHE_KEYS.weather,
        value: JSON.stringify({
          data: weather,
          timestamp: Date.now()
        })
      });
    } catch (e) { console.error('[CACHE] Weather error:', e); }
  },

  async getCachedWeather() {
    try {
      const stored = await Preferences.get({ key: CACHE_KEYS.weather });
      if (stored.value) {
        const parsed = JSON.parse(stored.value);
        if (Date.now() - parsed.timestamp < 3600000) {
          return parsed.data;
        }
      }
    } catch (e) { console.error('[CACHE] Get weather error:', e); }
    return null;
  },

  async cacheVolunteers(volunteers) {
    try {
      await Preferences.set({
        key: CACHE_KEYS.volunteers,
        value: JSON.stringify({
          data: volunteers,
          timestamp: Date.now()
        })
      });
    } catch (e) { console.error('[CACHE] Volunteers error:', e); }
  },

  async getCachedVolunteers() {
    try {
      const stored = await Preferences.get({ key: CACHE_KEYS.volunteers });
      if (stored.value) {
        const parsed = JSON.parse(stored.value);
        return parsed.data || [];
      }
    } catch (e) { console.error('[CACHE] Get volunteers error:', e); }
    return [];
  },

  async cacheShelters(shelters) {
    try {
      await Preferences.set({
        key: CACHE_KEYS.shelters,
        value: JSON.stringify({
          data: shelters,
          timestamp: Date.now()
        })
      });
    } catch (e) { console.error('[CACHE] Shelters error:', e); }
  },

  async getCachedShelters() {
    try {
      const stored = await Preferences.get({ key: CACHE_KEYS.shelters });
      if (stored.value) {
        const parsed = JSON.parse(stored.value);
        return parsed.data || [];
      }
    } catch (e) { console.error('[CACHE] Get shelters error:', e); }
    return [];
  },

  async cacheActions(actions) {
    try {
      await Preferences.set({
        key: CACHE_KEYS.actions,
        value: JSON.stringify({
          data: actions,
          timestamp: Date.now()
        })
      });
    } catch (e) { console.error('[CACHE] Actions error:', e); }
  },

  async getCachedActions() {
    try {
      const stored = await Preferences.get({ key: CACHE_KEYS.actions });
      if (stored.value) {
        const parsed = JSON.parse(stored.value);
        return parsed.data || [];
      }
    } catch (e) { console.error('[CACHE] Get actions error:', e); }
    return [];
  },

  async setLastSync() {
    await Preferences.set({
      key: CACHE_KEYS.lastSync,
      value: Date.now().toString()
    });
  },

  async getLastSync() {
    try {
      const stored = await Preferences.get({ key: CACHE_KEYS.lastSync });
      return stored.value ? parseInt(stored.value) : null;
    } catch { return null; }
  },

  async syncAll(apiService) {
    if (!await this.isOnline()) {
      console.log('[CACHE] Offline, skipping sync');
      return false;
    }

    try {
      const [incidents, inventory, news] = await Promise.all([
        apiService.get('incidents').catch(() => ({ data: [] })),
        apiService.get('inventory').catch(() => ({ data: [] })),
        apiService.get('intel/news').catch(() => ({ data: [] }))
      ]);

      await Promise.all([
        this.cacheIncidents(incidents.data || []),
        this.cacheInventory(inventory.data || []),
        this.cacheNews(news.data || [])
      ]);

      await this.setLastSync();
      console.log('[CACHE] Full sync complete');
      return true;
    } catch (e) {
      console.error('[CACHE] Sync error:', e);
      return false;
    }
  },

  async clearAll() {
    try {
      const keys = Object.values(CACHE_KEYS);
      for (const key of keys) {
        await Preferences.remove({ key });
      }
      console.log('[CACHE] All cleared');
    } catch (e) { console.error('[CACHE] Clear error:', e); }
  }
};

export default OfflineDataService;