import { 
  PushNotifications
} from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { Haptics } from '@capacitor/haptics';
import api from './api';

const NOTIFICATION_KEY = 'pending_notifications';

export const PushNotificationService = {
  name: 'PushNotificationService',

  async setup() {
    try {
      const permission = await PushNotifications.requestPermission();
      if (permission.granted) {
        await PushNotifications.register();
        
        const token = await PushNotifications.getToken();
        console.log('[PUSH] Token:', token.value);
        
        await this.saveToken(token.value);
        
        await this.setupHandlers();
        
        await this.setupLocalNotifications();
        
        console.log('[PUSH] Setup complete');
        return true;
      }
      
      console.log('[PUSH] Permission denied');
      return false;
    } catch (error) {
      console.error('[PUSH] Setup error:', error);
      return false;
    }
  },

  async setupHandlers() {
    PushNotifications.addListener('registration', (token) => {
      console.log('[PUSH] Registered:', token.value);
      this.saveToken(token.value);
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('[PUSH] Registration error:', error);
    });

    PushNotifications.addListener('pushNotificationReceived', async (notification) => {
      console.log('[PUSH] Received:', notification.title);
      await this.handleNotification(notification);
      
      try {
        await Haptics.impact({ style: 'heavy' });
      } catch (e) {}
    });

    PushNotifications.addListener('actionPerformed', async (notification) => {
      console.log('[PUSH] Action performed:', notification.notificationId);
      await this.handleAction(notification);
    });
  },

  async setupLocalNotifications() {
    try {
      await LocalNotifications.requestPermission();
      
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: 'incident_alert',
            actions: [
              { id: 'view', title: 'Lihat', foreground: true },
              { id: 'acknowledge', title: 'Konfirmasi', foreground: true },
              { id: 'dismiss', title: 'Tutup', destructive: true }
            ]
          }
        ]
      });
      
      console.log('[LOCAL] Setup complete');
    } catch (error) {
      console.log('[LOCAL] Setup error:', error);
    }
  },

  async saveToken(token) {
    try {
      const userData = await Preferences.get({ key: 'userData' });
      if (userData.value) {
        const user = JSON.parse(userData.value);
        await api.post('/notifications/register-token', {
          volunteer_id: user.id,
          token: token,
          platform: 'android'
        });
      }
    } catch (error) {
      console.error('[PUSH] Save token error:', error);
    }
  },

  async handleNotification(notification) {
    try {
      await this.saveNotification({
        id: notification.id || Date.now().toString(),
        title: notification.title || 'Notifikasi',
        body: notification.body || '',
        data: notification.data || {},
        timestamp: Date.now(),
        read: false
      });
    } catch (error) {
      console.error('[PUSH] Handle notification error:', error);
    }
  },

  async handleAction(action) {
    const notificationId = action.notificationId;
    const actionId = action.actionId;
    
    console.log('[PUSH] Action:', actionId, 'on notification:', notificationId);

    try {
      const userData = await Preferences.get({ key: 'userData' });
      if (!userData.value) return;

      const user = JSON.parse(userData.value);

      if (actionId === 'view' || actionId === 'respond') {
        await api.post('/notifications/respond', {
          notification_id: notificationId,
          volunteer_id: user.id,
          action: 'viewed'
        });
      } else if (actionId === 'acknowledge') {
        await api.post('/notifications/respond', {
          notification_id: notificationId,
          volunteer_id: user.id,
          action: 'acknowledged'
        });
      }
    } catch (error) {
      console.error('[PUSH] Handle action error:', error);
    }
  },

  async saveNotification(notification) {
    try {
      const stored = await Preferences.get({ key: NOTIFICATION_KEY });
      let notifications = [];

      if (stored.value) {
        notifications = JSON.parse(stored.value);
      }

      notifications.unshift(notification);

      if (notifications.length > 50) {
        notifications = notifications.slice(0, 50);
      }

      await Preferences.set({
        key: NOTIFICATION_KEY,
        value: JSON.stringify(notifications)
      });

      window.dispatchEvent(new CustomEvent('notification_received', { detail: notification }));
    } catch (error) {
      console.error('[PUSH] Save notification error:', error);
    }
  },

  async getNotifications() {
    try {
      const stored = await Preferences.get({ key: NOTIFICATION_KEY });
      if (stored.value) {
        return JSON.parse(stored.value);
      }
    } catch (error) {
      console.error('[PUSH] Get notifications error:', error);
    }
    return [];
  },

  async showLocalNotification(options) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: options.title,
            body: options.body,
            id: parseInt(options.id || Date.now().toString()),
            sound: options.sound || 'default',
            data: options.data || {}
          }
        ]
      });
    } catch (error) {
      console.error('[LOCAL] Show notification error:', error);
    }
  },

  async showIncidentAlert(incident) {
    const isEmergency = incident.priority === 'CRITICAL' || incident.priority === 'HIGH';
    
    await this.showLocalNotification({
      title: isEmergency ? 'DARURAT!' : 'Insiden Baru',
      body: `${incident.title} - ${incident.region}`,
      id: `incident_${incident.id}`,
      data: { incident_id: incident.id, type: 'incident' }
    });

    if (isEmergency) {
      try {
        await Haptics.impact({ style: 'heavy' });
      } catch (e) {}
    }
  },

  async markAsRead(notificationId) {
    try {
      const notifications = await this.getNotifications();
      const updated = notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      );
      
      await Preferences.set({
        key: NOTIFICATION_KEY,
        value: JSON.stringify(updated)
      });
    } catch (error) {
      console.error('[PUSH] Mark as read error:', error);
    }
  },

  async clearAll() {
    await Preferences.set({
      key: NOTIFICATION_KEY,
      value: JSON.stringify([])
    });
  },

  async unregister() {
    try {
      await PushNotifications.unregister();
      console.log('[PUSH] Unregistered');
    } catch (error) {
      console.error('[PUSH] Unregister error:', error);
    }
  }
};

export default PushNotificationService;