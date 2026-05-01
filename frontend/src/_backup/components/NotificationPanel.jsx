import React, { useState, useEffect } from 'react';
import { useNotificationStore } from '../store/useNotificationStore';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const NotificationPanel = ({ user, onClose }) => {
  const { notifications, unreadCount, fetchNotifications, markAsRead, sendEmergencyAlert } = useNotificationStore();
  const [showForm, setShowForm] = useState(false);
  const [emergency, setEmergency] = useState({ title: '', body: '', severity: 'HIGH' });

  useEffect(() => {
    if (user?.id) fetchNotifications(user.id, user.role);
  }, [user?.id, user?.role]);

  const handleEmergency = async () => {
    if (!emergency.title || !emergency.body) return alert('Isi semua field!');
    
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await sendEmergencyAlert(emergency);
      alert('Emergency Alert dikirim!');
      setShowForm(false);
      setEmergency({ title: '', body: '', severity: 'HIGH' });
    } catch (err) {
      alert('Gagal mengirim alert');
    }
  };

  const handleRead = async (notifId) => {
    await markAsRead(notifId, user.id);
  };

  return (
    <div className="fixed inset-0 z-[7000] bg-white flex flex-col">
      <div className="h-14 bg-[#006432] px-4 flex items-center justify-between shrink-0">
        <button onClick={onClose} className="text-white font-black text-xs uppercase flex items-center gap-2">
          <i className="fas fa-arrow-left"></i> Kembali
        </button>
        <h2 className="text-white font-black text-sm uppercase italic">Notifications</h2>
        {['ADMIN_PWNU', 'SUPER_ADMIN'].includes(user?.role) && (
          <button onClick={() => setShowForm(true)} className="text-red-400">
            <i className="fas fa-bell"></i>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {notifications.map(notif => (
          <div key={notif.id} onClick={() => handleRead(notif.id)}
            className={`p-4 rounded-2xl border-l-4 cursor-pointer ${
              notif.status === 'pending' ? 'bg-amber-50 border-amber-500' : 'bg-white border-slate-200'
            }`}>
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-sm">{notif.title}</h4>
                <p className="text-xs text-slate-500 mt-1">{notif.body}</p>
              </div>
              {notif.type === 'emergency' && (
                <span className="px-2 py-1 bg-red-500 text-white text-[8px] font-black rounded-full uppercase">URGENT</span>
              )}
            </div>
            <div className="flex justify-between mt-2 pt-2 border-t">
              <span className="text-[8px] text-slate-400">
                {notif.target_role || notif.target_region || 'All'}
              </span>
              <span className="text-[8px] text-slate-400">
                {new Date(notif.created_at).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
        
        {notifications.length === 0 && (
          <p className="text-center text-slate-300 py-10">Tidak ada notifikasi</p>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[8000] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[30px] p-6">
            <h3 className="font-black text-lg text-red-600 mb-4">Kirim Emergency Alert</h3>
            <div className="space-y-4">
              <input type="text" placeholder="Judul" value={emergency.title} 
                onChange={(e) => setEmergency({...emergency, title: e.target.value})}
                className="w-full p-3 bg-slate-50 rounded-xl" />
              <textarea placeholder="Pesan" value={emergency.body} 
                onChange={(e) => setEmergency({...emergency, body: e.target.value})}
                className="w-full p-3 bg-slate-50 rounded-xl h-24" />
              <select value={emergency.severity} onChange={(e) => setEmergency({...emergency, severity: e.target.value})}
                className="w-full p-3 bg-slate-50 rounded-xl">
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-black text-sm">Batal</button>
              <button onClick={handleEmergency} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black text-sm">Kirim Sekarang</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;