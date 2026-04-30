import { create } from 'zustand';
import api from '../services/api';

export const useChatStore = create((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  unreadCount: 0,
  isLoading: false,
  
  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (conv) => set({ activeConversation: conv }),
  setMessages: (messages) => set({ messages }),
  setUnreadCount: (count) => set({ unreadCount: count }),
  setLoading: (loading) => set({ isLoading: loading }),
  
   fetchConversations: async (userId, role) => {
     set({ isLoading: true });
     try {
       const res = await api.get(`/chat/conversations?user_id=${userId}&role=${role}`);
       set({ conversations: res.data, unreadCount: res.data.reduce((acc, c) => acc + ((c?.unread_count) || 0), 0) });
     } catch (err) {
       console.error('Fetch conversations error:', err);
     } finally {
       set({ isLoading: false });
     }
   },
  
  fetchMessages: async (conversationId) => {
    set({ isLoading: true });
    try {
      const res = await api.get(`/chat/messages?conversation_id=${conversationId}`);
      set({ messages: res.data });
    } catch (err) {
      console.error('Fetch messages error:', err);
    } finally {
      set({ isLoading: false });
    }
  },
  
  sendMessage: async (conversationId, senderId, message) => {
    try {
      const res = await api.post('/chat/messages', {
        conversation_id: conversationId,
        sender_id: senderId,
        message
      });
      set({ messages: [...get().messages, res.data] });
      return res.data;
    } catch (err) {
      console.error('Send message error:', err);
      throw err;
    }
  },
  
  createConversation: async (incidentId) => {
    try {
      const res = await api.post('/chat/conversations', {
        incident_id: incidentId,
        type: 'incident'
      });
      set({ activeConversation: res.data });
      return res.data;
    } catch (err) {
      console.error('Create conversation error:', err);
      throw err;
    }
  }
}));

export default useChatStore;