import { create } from 'zustand';
import api from '../services/api';

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  
  setNotifications: (notifications) => set({ notifications }),
  setUnreadCount: (count) => set({ unreadCount: count }),
  setLoading: (loading) => set({ isLoading: loading }),
  
  fetchNotifications: async (userId, role) => {
    set({ isLoading: true });
    try {
      const res = await api.get(`/notifications?user_id=${userId}&role=${role}`);
      const unread = res.data.filter(n => n.status === 'pending');
      set({ notifications: res.data, unreadCount: unread.length });
    } catch (err) {
      console.error('Fetch notifications error:', err);
    } finally {
      set({ isLoading: false });
    }
  },
  
  createNotification: async (data) => {
    try {
      const res = await api.post('/notifications', data);
      set({ notifications: [res.data, ...get().notifications] });
      return res.data;
    } catch (err) {
      console.error('Create notification error:', err);
      throw err;
    }
  },
  
  sendNotification: async (notificationId) => {
    try {
      await api.post(`/notifications/${notificationId}/send`);
      const notifications = get().notifications.map(n => 
        n.id === notificationId ? { ...n, status: 'sent', sent_at: new Date() } : n
      );
      set({ notifications });
    } catch (err) {
      console.error('Send notification error:', err);
      throw err;
    }
  },
  
  sendEmergencyAlert: async (data) => {
    try {
      const res = await api.post('/notifications/emergency', data);
      return res.data;
    } catch (err) {
      console.error('Emergency alert error:', err);
      throw err;
    }
  },
  
  markAsRead: async (notificationId, userId) => {
    try {
      await api.put('/notifications/read', { notification_id: notificationId, user_id: userId });
      const notifications = get().notifications.map(n => 
        n.id === notificationId ? { ...n, status: 'read' } : n
      );
       set({ notifications, unreadCount: Math.max(0, get().unreadCount - 1) });
    } catch (err) {
      console.error('Mark read error:', err);
    }
  },
  
  clearNotifications: () => set({ notifications: [], unreadCount: 0 })
}));

export default useNotificationStore;