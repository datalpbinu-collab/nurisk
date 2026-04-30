import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import api from '../services/api';
import { normalizeStatus } from '../utils/constants';
import Assessment from './Assessment';
import BuildingAssessment from './BuildingAssessment';
import PublicReport from './PublicReport';
import NotificationPanel from './NotificationPanel';
import MapDisplay from './MapDisplay';
import NewsTicker from './NewsTicker';
import LogFooter from './LogFooter';
import { useNotificationStore } from '../store/useNotificationStore';

const FieldStaffDashboard = ({ user, onLogout }) => {
  const userRegion = user?.region || 'jateng';
  const userId = user?.id;  
  
  const [incidents, setIncidents] = useState([]);
  const [verifiedIncidents, setVerifiedIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [view, setView] = useState('main');
  const [joiningMission, setJoiningMission] = useState(null);
  
  const { notifications, unreadCount, fetchNotifications, markAsRead } = useNotificationStore();
  const mountedRef = useRef(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch notifications
  useEffect(() => {
    if (userId) fetchNotifications(userId, user?.role);
  }, [userId, user?.role]);

  // Fetch incidents - verified only for field staff view
  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    api.get('incidents', { signal: controller.signal })
      .then(res => {
        clearTimeout(timeoutId);
        if (!mountedRef.current) return;
        
        const allData = Array.isArray(res.data) ? res.data : [];
        // Field staff can see verified/assessed incidents in their region or critical
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
      await api.post('/volunteers/deployments', {
        incident_id: incidentId,
        volunteer_id: userId,
        status: 'pending',
        available_from: new Date(),
        note: 'Field Staff mendaftar melalui aplikasi'
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

  const openBuildingAssessment = () => {
    setView('building');
  };

  const openIncidentAssessment = (incident) => {
    setSelectedIncident(incident);
    setView('incident');
  };

  const goBack = () => {
    setView('main');
    setRefreshKey(prev => prev + 1);
    setSelectedIncident(null);
  };

  // Stats
  const stats = useMemo(() => {
    let aktif = 0;
    let critical = 0;
    for (let i = 0; i < verifiedIncidents.length; i++) {
      const item = verifiedIncidents[i];
      if (item.priority_level === 'CRITICAL') critical++;
      if (normalizeStatus(item.status) !== 'COMPLETED') aktif++;
    }
    return { aktif, critical, total: verifiedIncidents.length };
  }, [verifiedIncidents]);

  const displayData = useMemo(() => 
    (Array.isArray(verifiedIncidents) ? verifiedIncidents.slice(0, 20) : []), 
    [verifiedIncidents]
  );

  // View routing
  if (view === 'building') {
    return <BuildingAssessment onBack={goBack} />;
  }

  if (view === 'incident' && selectedIncident) {
    return <Assessment incident={selectedIncident} onBack={goBack} />;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#f8fafc]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#006432] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-[#006432] font-bold">LOADING...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#f8fafc]">
        <div className="text-center p-8">
          <p className="text-red-600 font-bold mb-4">{error}</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => setRefreshKey(prev => prev + 1)} className="px-6 py-4 bg-[#006432] text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">
              <i className="fas fa-sync mr-2"></i> Muat Ulang Data
            </button>
            <button onClick={handleLogout} className="text-slate-400 font-black text-[10px] uppercase hover:text-red-600 transition-all">
              Logout Akun
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#f8fafc] text-slate-800 overflow-hidden relative">
      {/* PREMIUM HEADER */}
      <header className="h-16 bg-[#006432] border-b-2 border-[#c5a059] flex items-center px-6 justify-between shrink-0 shadow-2xl z-50">
        <div className="flex items-center gap-3">
          <img src="https://pwnu-jateng.org/uploads/infoumum/20250825111304-2025-08-25infoumum111252.png" className="h-9 bg-white p-1 rounded-xl" alt="logo" />
          <div className="flex flex-col text-white leading-none">
            <h1 className="font-black text-xs uppercase italic tracking-tighter">FIELD SPECIALIST</h1>
            <span className="text-[7px] font-bold uppercase opacity-60">{user?.region} • ASSESSMENT UNIT</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block text-white leading-none">
            <p className="font-bold text-[10px] uppercase">{user?.full_name}</p>
            <p className="text-green-300 text-[7px] font-bold uppercase tracking-widest mt-1">OPERATIONAL ACTIVE</p>
          </div>
          <button onClick={handleLogout} className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-red-500 transition-all shadow-lg border border-white/5">
            <i className="fas fa-power-off"></i>
          </button>
        </div>
      </header>

      {/* NAVIGATION TABS */}
      <div className="bg-white border-b border-slate-200 px-6 flex gap-6 shrink-0">
        {['home', 'map', 'missions', 'notifications'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-4 px-2 border-b-2 font-bold text-[9px] uppercase tracking-widest transition-all ${
              activeTab === tab 
                ? 'border-[#006432] text-[#006432]' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <i className={`fas fa-${tab === 'home' ? 'home' : tab === 'map' ? 'map' : tab === 'missions' ? 'tasks' : 'bell'} mr-2`}></i>
            {tab === 'home' ? 'Home' : tab === 'map' ? 'Map' : tab === 'missions' ? 'Missions' : `Notif${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar pb-24">
        <NewsTicker />
        
        {activeTab === 'home' && (
          <>
            {/* QUICK STATS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 group hover:border-green-500 transition-all">
                <div className="flex justify-between items-start">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Misi Aktif</p>
                  <i className="fas fa-radar text-slate-100 group-hover:text-green-500"></i>
                </div>
                <p className="text-4xl font-black text-[#006432] leading-none mt-2">{stats.aktif}</p>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 group hover:border-red-500 transition-all">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status Kritis</p>
                <p className="text-4xl font-black text-red-600 leading-none mt-2">{stats.critical}</p>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 group hover:border-blue-500 transition-all">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Misi</p>
                <p className="text-4xl font-black text-blue-600 leading-none mt-2">{stats.total}</p>
              </div>
            </div>

            {/* MAIN ACTIONS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button onClick={openBuildingAssessment} className="group bg-[#006432] p-8 rounded-[3rem] text-white flex items-center justify-between shadow-xl hover:shadow-green-900/20 transition-all border-b-[8px] border-black/20">
                <div className="text-left">
                  <h3 className="text-xl font-black uppercase italic tracking-tighter">Assessment Gedung</h3>
                  <p className="text-[9px] font-bold opacity-60 uppercase tracking-widest mt-1">Audit Ketangguhan 6 Pentagon</p>
                </div>
                <i className="fas fa-building text-4xl opacity-20 group-hover:scale-125 transition-transform"></i>
              </button>

              <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                  <h2 className="font-black text-[11px] text-slate-800 uppercase tracking-widest italic">Incident Radar</h2>
                  <span className="text-[8px] font-bold text-slate-400 uppercase">Live Queue</span>
                </div>
                <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto custom-scrollbar">
                  {displayData.map(item => (
                    <div key={item.id} className="p-5 flex items-center justify-between hover:bg-green-50/50 transition-all cursor-pointer group" onClick={() => openIncidentAssessment(item)}>
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-xs text-slate-700 uppercase italic truncate group-hover:text-[#006432] transition-colors">{item.title}</p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase mt-1 tracking-widest">📍 {item.region} • {item.status}</p>
                      </div>
                      <i className="fas fa-chevron-right text-slate-200 group-hover:text-[#006432] transition-all"></i>
                    </div>
                  ))}
                  {displayData.length === 0 && (
                    <p className="text-center text-slate-300 py-20 text-[10px] font-black uppercase italic">Tidak ada antrian misi</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'map' && (
          <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50">
              <h2 className="font-black text-[11px] text-slate-800 uppercase tracking-widest italic">Map Display</h2>
            </div>
            <div className="h-[500px]">
              <MapDisplay incidents={displayData} />
            </div>
          </div>
        )}

        {activeTab === 'missions' && (
          <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50">
              <h2 className="font-black text-[11px] text-slate-800 uppercase tracking-widest italic">Available Missions</h2>
            </div>
            <div className="divide-y divide-slate-50">
              {displayData.map(item => (
                <div key={item.id} className="p-6 flex items-center justify-between hover:bg-green-50/50 transition-all">
                  <div className="flex-1">
                    <p className="font-black text-sm text-slate-700 uppercase italic">{item.title}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">📍 {item.region} • Priority: {item.priority_level}</p>
                  </div>
                  <button
                    onClick={() => handleJoinMission(item.id)}
                    disabled={joiningMission === item.id}
                    className="px-4 py-2 bg-[#006432] text-white rounded-xl text-[9px] font-black uppercase disabled:opacity-50"
                  >
                    {joiningMission === item.id ? '...' : 'Join'}
                  </button>
                </div>
              ))}
              {displayData.length === 0 && (
                <p className="text-center text-slate-300 py-20 text-[10px] font-black uppercase italic">No missions available</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <NotificationPanel 
            userId={userId} 
            notifications={notifications} 
            onRead={handleNotificationRead} 
            onClose={() => {}} 
          />
        )}
      </main>
      <LogFooter />
    </div>
  );
};

export default FieldStaffDashboard;
