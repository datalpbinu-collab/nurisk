import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../store/useChatStore';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { KAB_JATENG } from '../utils/constants';
 
const ChatView = ({ user, onClose, incident }) => {
  const { 
    conversations, activeConversation, messages, 
    fetchConversations, fetchMessages, sendMessage, createConversation, setActiveConversation 
  } = useChatStore();
  
  const [message, setMessage] = useState('');
  const [showConversations, setShowConversations] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (user?.id) {
      fetchConversations(user.id, user.role);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (activeConversation?.id) {
      fetchMessages(activeConversation.id);
    }
  }, [activeConversation?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || !activeConversation) return;
    
    await Haptics.impact({ style: ImpactStyle.Light });
    await sendMessage(activeConversation.id, user.id, message.trim());
    setMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startIncidentChat = async (inc) => {
    const conv = await createConversation(inc.id);
    setActiveConversation(conv);
    setShowConversations(false);
  };

  return (
    <div className="fixed inset-0 z-[7000] bg-white flex flex-col">
      <div className="h-14 bg-[#006432] px-4 flex items-center justify-between shrink-0">
        <button onClick={() => onClose()} className="text-white font-black text-xs uppercase flex items-center gap-2">
          <i className="fas fa-arrow-left"></i> Kembali
        </button>
        <h2 className="text-white font-black text-sm uppercase italic">Team Chat</h2>
        <button onClick={() => setShowConversations(true)} className="text-white/70">
          <i className="fas fa-list"></i>
        </button>
      </div>

      {showConversations ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <h3 className="text-xs font-black text-slate-400 uppercase mb-4">Pilih Percakapan</h3>
          
          {conversations.map(conv => (
            <div key={conv.id} onClick={() => { setActiveConversation(conv); setShowConversations(false); }}
              className="p-4 bg-slate-50 rounded-2xl cursor-pointer hover:bg-green-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#006432] rounded-xl flex items-center justify-center text-white">
                  <i className="fas fa-comments"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm truncate">{conv.incident_title || `Incident #${conv.incident_id}`}</h4>
                  <p className="text-xs text-slate-400 truncate">{conv.last_message || 'Belum ada pesan'}</p>
                </div>
                {conv.unread_count > 0 && (
                  <div className="w-5 h-5 bg-red-500 rounded-full text-white text-[8px] flex items-center justify-center">
                    {conv.unread_count}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {conversations.length === 0 && (
            <p className="text-center text-slate-300 text-sm py-10">Belum ada percakapan</p>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] p-3 rounded-2xl ${
                  msg.sender_id === user.id 
                    ? 'bg-[#006432] text-white rounded-br-none' 
                    : 'bg-slate-100 rounded-bl-none'
                }`}>
                  {msg.sender_id !== user.id && (
                    <p className="text-[8px] font-black text-[#c5a059] mb-1">{msg.sender_name}</p>
                  )}
                  <p className="text-sm">{msg.message}</p>
                  <p className={`text-[8px] ${msg.sender_id === user.id ? 'text-white/50' : 'text-slate-400'} mt-1`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="p-3 border-t bg-white">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ketik pesan..."
                className="flex-1 p-3 bg-slate-50 rounded-2xl text-sm"
              />
              <button onClick={handleSend} className="w-12 h-12 bg-[#006432] rounded-2xl text-white flex items-center justify-center">
                <i className="fas fa-paper-plane"></i>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatView;