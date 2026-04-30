import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import api from '../services/api';
import { normalizeStatus } from '../utils/constants';
import PublicReport from './PublicReport';
import NotificationPanel from './NotificationPanel';
import MapDisplay from './MapDisplay';
import VolunteerMissionDashboard from './VolunteerMissionDashboard';
import { useNotificationStore } from '../store/useNotificationStore';

const RelawanTactical = ({ user, onLogout, onOpenChat }) => {
  const userRegion = user?.region || 'jateng';
  const userId = user?.id;  
  
  const [incidents, setIncidents] = useState([]);
  const [verifiedIncidents, setVerifiedIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [joiningMission, setJoiningMission] = useState(null);
  
  const { notifications, unreadCount, fetchNotifications, markAsRead } = useNotificationStore();
  const mountedRef = useRef(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch notifications
  useEffect(() => {
    if (userId) fetchNotifications(userId, user?.role);
  }, [userId, user?.role]);

  // Fetch incidents - verified only for relawan view
  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    api.get('incidents/public', { signal: controller.signal })
      .then(res => {
        clearTimeout(timeoutId);
        if (!mountedRef.current) return;
        
        const allData = Array.isArray(res.data) ? res.data : [];
        // Filter for verified/assessed incidents in user region or critical
        const verified = allData.filter(i => 
          ['VERIFIED', 'ASSESSED', 'COMMANDED', 'ACTION'].includes(normalizeStatus(i.status)) &&
          (String(i.region).toLowerCase() === String(userRegion).toLowerCase() || 
           i.priority_level === 'CRITICAL')
        );
        
        setIncidents(allData);
        setVerifiedIncidents(verified);
        setLoading(false);
      })
      .catch(e => {
        clearTimeout(timeoutId);
        if (mountedRef.current) {
          setError(e.name === 'AbortError' ? 'Waktu tunggu habis' : 'Gagal memuat data');
          setLoading(false);
        }
      });

    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [userRegion, refreshKey]);

  const handleLogout = useCallback(() => {
    onLogout?.();
  }, [onLogout]);

  const handleJoinMission = async (incidentId) => {
    if (!userId) return alert('Login required');
    setJoiningMission(incidentId);
    
    try {
      // Use correct endpoint from volunteerRoutes.js
      await api.post('/volunteers/deployments', {
        incident_id: incidentId,
        volunteer_id: userId,
        status: 'pending',
        available_from: new Date(),
        note: 'Relawan mendaftar melalui aplikasi mobile'
      });
      alert('Berhasil mendaftar misi! Menunggu konfirmasi admin.');
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error('Join mission error:', err);
      alert(`Gagal mendaftar: ${err.response?.data?.error || err.message}`);
    } finally {
      setJoiningMission(null);
    }
  };

  const handleNotificationRead = async (notifId) => {
    await markAsRead(notifId, userId);
  };

  // Stats
  const stats = useMemo(() => {
    const active = verifiedIncidents.filter(i => 
      !['COMPLETED', 'COMPLETED'].includes(normalizeStatus(i.status))
    ).length;
    const critical = verifiedIncidents.filter(i => i.priority_level === 'CRITICAL').length;
    const myMissions = verifiedIncidents.filter(i => 
      i.volunteers?.some(v => v.volunteer_id === userId)
    ).length;
    
    return { active, critical, myMissions };
  }, [verifiedIncidents, userId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="w-12 h-12 border-4 border-[#006432] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-[#006432] font-bold">MEMUAT DATA...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen bg-slate-50 items-center justify-center p-4">
        <p className="text-red-500 mb-4 text-center">{error}</p>
        <button 
          onClick={() => setRefreshKey(prev => prev + 1)} 
          className="bg-[#006432] text-white px-6 py-3 rounded-lg font-bold"
        >
          <i className="fas fa-redo mr-2"></i>Muat Ulang
        </button>
      </div>
    );
  }

  // Render tab content
  if (activeTab === 'report') {
    return <PublicReport onBack={() => setActiveTab('home')} />;
  }

  if (activeTab === 'notifications') {
    return (
      <NotificationPanel 
        user={user} 
        onClose={() => setActiveTab('home')} 
      />
    );
  }

  if (activeTab === 'missions') {
    return <VolunteerMissionDashboard user={user} onBack={() => setActiveTab('home')} />;
  }

  if (activeTab === 'map') {
    return (
      <div className="h-screen bg-white">
        <div className="h-14 bg-[#006432] px-4 flex items-center justify-between">
          <button 
            onClick={() => setActiveTab('home')}
            className="text-white font-bold text-xs uppercase flex items-center gap-2"
          >
            <i className="fas fa-arrow-left"></i> Kembali
          </button>
          <h2 className="text-white font-black text-sm uppercase">Peta Bencana</h2>
          <div className="w-8"></div>
        </div>
        <div className="h-[calc(100vh-56px)]">
          <MapDisplay incidents={verifiedIncidents} onSelect={setSelectedIncident} />
        </div>
      </div>
    );
  }

  if (activeTab === 'mission' && selectedIncident) {
    const inc = selectedIncident;
    return (
      <div className="h-screen bg-white overflow-y-auto">
        <div className="h-14 bg-[#006432] px-4 flex items-center justify-between">
          <button 
            onClick={() => setActiveTab('home')}
            className="text-white font-bold text-xs uppercase flex items-center gap-2"
          >
            <i className="fas fa-arrow-left"></i> Kembali
          </button>
          <h2 className="text-white font-black text-sm uppercase">Detail Misi</h2>
          <div className="w-8"></div>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="bg-white rounded-2xl shadow-lg p-4 border-l-4 border-[#006432]">
            <h3 className="font-black text-lg text-slate-800">{inc.title}</h3>
            <div className="flex gap-2 mt-2">
              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded font-bold uppercase">
                {inc.disaster_type}
              </span>
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold uppercase">
                {inc.status}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Lokasi</p>
            <p className="text-sm font-bold">{inc.region} - {inc.kecamatan || 'N/A'}</p>
            {inc.latitude && inc.longitude && (
              <p className="text-xs text-slate-400 mt-1">
                {parseFloat(inc.latitude).toFixed(4)}, {parseFloat(inc.longitude).toFixed(4)}
              </p>
            )}
          </div>

          {inc.description && (
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">Deskripsi</p>
              <p className="text-sm text-slate-700">{inc.description}</p>
            </div>
          )}

          {inc.needs_numeric && Object.values(inc.needs_numeric).some(v => v > 0) && (
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
              <p className="text-xs font-bold text-amber-700 uppercase mb-2">Kebutuhan</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(inc.needs_numeric).map(([k, v]) => 
                  v > 0 && (
                    <span key={k} className="text-[10px] bg-white px-2 py-1 rounded border border-amber-100 font-bold uppercase">
                      {k}: {v}
                    </span>
                  )
                )}
              </div>
            </div>
          )}

          <button
            onClick={() => handleJoinMission(inc.id)}
            disabled={joiningMission === inc.id}
            className="w-full bg-[#006432] text-white py-3 rounded-xl font-bold disabled:opacity-50"
          >
            {joiningMission === inc.id ? (
              <><i className="fas fa-spinner fa-spin mr-2"></i>Mendaftar...</>
            ) : (
              <><i className="fas fa-hand-rock mr-2"></i>Join Misi Ini</>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-[#006432] p-4 shadow-lg shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-white font-bold uppercase">Relawan {userRegion}</h1>
            <p className="text-green-200 text-xs">{user?.full_name}</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setActiveTab('notifications')}
              className="relative text-white"
            >
              <i className="fas fa-bell text-lg"></i>
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
            <button 
              onClick={handleLogout} 
              className="text-white bg-red-500 px-3 py-2 rounded text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white p-3 rounded-xl shadow text-center">
              <p className="text-xl font-bold text-red-600">{stats.active}</p>
              <p className="text-[8px] text-slate-500 uppercase">Misi Aktif</p>
            </div>
            <div className="bg-white p-3 rounded-xl shadow text-center">
              <p className="text-xl font-bold text-orange-600">{stats.critical}</p>
              <p className="text-[8px] text-slate-500 uppercase">Kritis</p>
            </div>
            <div className="bg-white p-3 rounded-xl shadow text-center">
              <p className="text-xl font-bold text-blue-600">{stats.myMissions}</p>
              <p className="text-[8px] text-slate-500 uppercase">Misi Saya</p>
            </div>
          </div>

          {/* Critical Alerts */}
          {verifiedIncidents.filter(i => i.priority_level === 'CRITICAL').slice(0, 3).map(inc => (
            <div 
              key={inc.id} 
              className="bg-red-600 text-white p-4 rounded-xl shadow-lg cursor-pointer"
              onClick={() => { setSelectedIncident(inc); setActiveTab('mission'); }}
            >
              <p className="text-xs opacity-70 uppercase">Misi Kritis</p>
              <p className="font-bold mt-1">{inc.title}</p>
              <p className="text-xs mt-2 opacity-80">{inc.region}</p>
            </div>
          ))}

          {/* Verified Incidents List */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="font-bold text-sm uppercase">Kejadian Terverifikasi</h2>
              <span className="text-xs text-slate-500">{verifiedIncidents.length} kejadian</span>
            </div>
            <div className="divide-y max-h-96 overflow-y-auto">
              {verifiedIncidents.length === 0 ? (
                <p className="p-4 text-slate-400 text-center text-sm">Tidak ada kejadian terverifikasi</p>
              ) : (
                verifiedIncidents.map(inc => (
                  <div 
                    key={inc.id} 
                    className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => { setSelectedIncident(inc); setActiveTab('mission'); }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-bold text-sm">{inc.title}</p>
                        <p className="text-xs text-slate-500 mt-1">{inc.region} • {inc.disaster_type}</p>
                      </div>
                      <span className={`text-[8px] px-2 py-1 rounded font-bold uppercase ${
                        inc.priority_level === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                        inc.priority_level === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {inc.priority_level || 'LOW'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] bg-slate-100 px-2 py-1 rounded">
                        {inc.status}
                      </span>
                      {inc.priority_level === 'CRITICAL' && (
                        <span className="text-[10px] bg-red-500 text-white px-2 py-1 rounded animate-pulse">
                          URGENT
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex justify-around text-xs z-10 shadow-lg">
        <button 
          onClick={() => setActiveTab('home')}
          className={`${activeTab === 'home' ? 'text-[#006432]' : 'text-slate-400'} font-bold flex flex-col items-center`}
        >
          <i className="fas fa-home text-lg"></i>
          <span>Home</span>
        </button>
        <button 
          onClick={() => setActiveTab('map')}
          className={`${activeTab === 'map' ? 'text-[#006432]' : 'text-slate-400'} flex flex-col items-center`}
        >
          <i className="fas fa-map text-lg"></i>
          <span>Peta</span>
        </button>
        <button 
          onClick={() => setActiveTab('missions')}
          className={`${activeTab === 'missions' ? 'text-[#006432]' : 'text-slate-400'} flex flex-col items-center`}
        >
          <i className="fas fa-briefcase text-lg"></i>
          <span>Misi</span>
        </button>
        <button 
          onClick={() => setActiveTab('report')}
          className={`${activeTab === 'report' ? 'text-[#006432]' : 'text-slate-400'} flex flex-col items-center`}
        >
          <i className="fas fa-bullhorn text-lg"></i>
          <span>Lapor</span>
        </button>
        <button 
          onClick={() => setActiveTab('notifications')}
          className={`${activeTab === 'notifications' ? 'text-[#006432]' : 'text-slate-400'} flex flex-col items-center relative`}
        >
          <i className="fas fa-bell text-lg"></i>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center">
              {unreadCount}
            </span>
          )}
          <span>Notif</span>
        </button>
      </nav>
    </div>
  );
};

export default RelawanTactical;
