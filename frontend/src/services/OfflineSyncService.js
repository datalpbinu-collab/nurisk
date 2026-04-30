import { Preferences } from '@capacitor/preferences';
import { Network } from '@capacitor/network';
import api from './api';

const OFFLINE_QUEUE_KEY = 'offline_queue';
const SYNC_STATUS_KEY = 'sync_status';

export const OfflineSyncService = {
  name: 'OfflineSyncService',

  async setup() {
    try {
      const status = await Network.getStatus();
      console.log('[SYNC] Network status:', status);
    } catch (error) {
      console.log('[SYNC] Setup error:', error);
    }
  },

  async isOnline() {
    try {
      const status = await Network.getStatus();
      return status.connected;
    } catch (error) {
      return false;
    }
  },

  async queueAction(action) {
    try {
      const queuedAction = {
        ...action,
        id: `${action.endpoint}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        retryCount: 0
      };

      const stored = await Preferences.get({ key: OFFLINE_QUEUE_KEY });
      let queue = [];

      if (stored.value) {
        queue = JSON.parse(stored.value);
      }

      queue.push(queuedAction);

      await Preferences.set({
        key: OFFLINE_QUEUE_KEY,
        value: JSON.stringify(queue)
      });

      console.log('[SYNC] Queued:', queuedAction.id);

      const online = await this.isOnline();
      if (online) {
        await this.processQueue();
      }
    } catch (error) {
      console.error('[SYNC] Queue action error:', error);
    }
  },

  async processQueue() {
    let synced = 0;
    let failed = 0;

    try {
      const stored = await Preferences.get({ key: OFFLINE_QUEUE_KEY });
      if (!stored.value) {
        return { synced, failed };
      }

      let queue = JSON.parse(stored.value);
      const online = await this.isOnline();

      if (!online) {
        console.log('[SYNC] Offline, skipping sync');
        return { synced, failed };
      }

      const remainingQueue = [];

      for (const action of queue) {
        try {
          if (action.type === 'create') {
            await api.post(action.endpoint, action.data);
          } else if (action.type === 'update') {
            await api.put(action.endpoint, action.data);
          } else if (action.type === 'delete') {
            await api.delete(action.endpoint);
          }

          synced++;
          console.log('[SYNC] Synced:', action.id);
        } catch (error) {
          action.retryCount++;

          if (action.retryCount < 3) {
            remainingQueue.push(action);
            failed++;
          } else {
            console.log('[SYNC] Dropped (max retries):', action.id);
          }
        }
      }

      await Preferences.set({
        key: OFFLINE_QUEUE_KEY,
        value: JSON.stringify(remainingQueue)
      });

      console.log('[SYNC] Process complete - synced:', synced, 'failed:', failed);
      return { synced, failed };
    } catch (error) {
      console.error('[SYNC] Process queue error:', error);
      return { synced, failed };
    }
  },

  async syncPending() {
    await this.processQueue();
  },

  async getQueue() {
    try {
      const stored = await Preferences.get({ key: OFFLINE_QUEUE_KEY });
      if (stored.value) {
        return JSON.parse(stored.value);
      }
    } catch (error) {
      console.error('[SYNC] Get queue error:', error);
    }
    return [];
  },

  async clearQueue() {
    await Preferences.set({
      key: OFFLINE_QUEUE_KEY,
      value: JSON.stringify([])
    });
  },

  async reportIncident(data) {
    await this.queueAction({
      type: 'create',
      endpoint: '/incidents',
      data
    });
  },

  async updateIncident(id, data) {
    await this.queueAction({
      type: 'update',
      endpoint: `/incidents/${id}`,
      data
    });
  },

  async applyForMission(data) {
    await this.queueAction({
      type: 'create',
      endpoint: '/volunteers/deployments',
      data
    });
  },

  async sendChatMessage(data) {
    await this.queueAction({
      type: 'create',
      endpoint: '/chat/messages',
      data
    });
  }
};

export default OfflineSyncService;