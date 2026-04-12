import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import api from './services/api';
import axios from 'axios';

// --- NATIVE HP INTEGRATION (CAPACITOR OFFICIAL) ---
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Network } from '@capacitor/network'; 
import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';

// --- HUB SELURUH KOMPONEN SISTEM (Sesuai Struktur Folder Anda) ---
import MapHUD from './components/CommandCenter'; 
import MissionManager from './components/CompleteView'; 
import InventoryView from './components/InventoryView';
import Wallboard from './components/Wallboard';
import LogFooter from './components/LogFooter';
import LogisticsHub from './components/LogisticsHub';
import Assessment from './components/Assessment';
import InstructionView from './components/InstructionView';
import ActionView from './components/ActionView';
import PublicReport from './components/PublicReport';
import VolunteerRegister from './components/VolunteerRegister';
import RelawanTactical from './components/RelawanTactical'; 
import PublicDashboard from './components/PublicDashboard';
import Login from './components/Login';

// --- KONFIGURASI ENGINE ---
const BASE_URL = 'https://nupeduli-pusdatin-nu-backend.hf.space';
const socket = io(BASE_URL, { 
  reconnection: true, 
  reconnectionAttempts: Infinity,
  transports: ['websocket'],
  upgrade: false,
  forceNew: true
});

function App() {
  // --- STATE AUTH & SESSION ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  
  // --- STATE NAVIGATION ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [navStack, setNavStack] = useState(['dashboard']);
  const [selectedIncident, setSelectedIncident] = useState(null);
  
  // --- STATE DATA & SYNC ENGINE ---
  const [incidents, setIncidents] = useState([]); 
  const [inventory, setInventory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // Pengaman transisi data
  
  // --- STATE ENVIRONMENT ---
  const [weather, setWeather] = useState(null);
  const [currentCoords, setCurrentCoords] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // --- REF UNTUK NAVIGASI ---
  const stateRef = useRef({ activeTab, navStack, selectedIncident, isLoggedIn, syncQueue });
  useEffect(() => { 
    stateRef.current = { activeTab, navStack, selectedIncident, isLoggedIn, syncQueue }; 
  }, [activeTab, navStack, selectedIncident, isLoggedIn, syncQueue]);

  // --- 1. STORAGE UTILITY ---
  const storage = useMemo(() => ({
    set: async (key, val) => await Preferences.set({ key, value: JSON.stringify(val) }),
    get: async (key) => {
      const res = await Preferences.get({ key });
      return res.value ? JSON.parse(res.value) : null;
    },
    remove: async (key) => await Preferences.remove({ key }),
    clear: async () => await Preferences.clear()
  }), []);

  // --- 2. ENGINE: DATA SYNCHRONIZER (FIX UNDEFINED) ---
  const fetchData = useCallback(async () => {
    try {
      const [resInc, resInv] = await Promise.all([
        api.get('incidents').catch(() => ({ data: [] })), 
        api.get('inventory').catch(() => ({ data: [] }))
      ]);
      
      const dataInc = Array.isArray(resInc.data) ? resInc.data : [];
      const dataInv = Array.isArray(resInv.data) ? resInv.data : [];

      setIncidents(dataInc);
      setInventory(dataInv);
      
      await storage.set('cache_incidents', dataInc);
      await storage.set('cache_inventory', dataInv);
    } catch (err) {
      const cInc = await storage.get('cache_incidents');
      if (cInc) setIncidents(cInc);
    } finally {
      setIsLoading(false);
    }
  }, [storage]);

  // --- FILTER DATA RBAC (PRD PILAR 2) ---
  const filteredData = useMemo(() => {
    const safeIncidents = Array.isArray(incidents) ? incidents : [];
    if (!isLoggedIn || !userData) return safeIncidents;
    return safeIncidents.filter((inc) => 
      userData.role === 'PWNU' || userData.role === 'SUPER_ADMIN' || inc.region === userData.region
    );
  }, [incidents, userData, isLoggedIn]);

  const processSyncQueue = useCallback(async () => {
    const queue = await storage.get('sync_queue') || [];
    if (queue.length === 0 || !navigator.onLine) return;
    const remainingQueue = [];
    for (const item of queue) {
      try { await api.post(item.endpoint.replace('/api/', ''), item.data); } 
      catch (e) { remainingQueue.push(item); }
    }
    setSyncQueue(remainingQueue);
    await storage.set('sync_queue', remainingQueue);
    if (remainingQueue.length === 0) fetchData();
  }, [fetchData, storage]);

  const handleDataSubmit = async (endpoint, data) => {
    const cleanPath = endpoint.replace('/api/', '');
    if (!isOnline) {
      const updatedQueue = [...stateRef.current.syncQueue, { endpoint: cleanPath, data, ts: Date.now() }];
      setSyncQueue(updatedQueue);
      await storage.set('sync_queue', updatedQueue);
      Haptics.impact({ style: ImpactStyle.Heavy });
      alert("⚠️ MODE OFFLINE: Tersimpan di HP.");
      goBack();
    } else {
      try {
        await api.post(cleanPath, data);
        fetchData();
        goBack();
      } catch (e) { alert("Gagal kirim data."); }
    }
  };

  // --- 3. ENGINE: NAVIGASI ---
  const navigateTo = (tab) => {
    if (tab === activeTab) return;
    setNavStack(prev => [...prev, tab]);
    setActiveTab(tab);
    setSelectedIncident(null);
    if (isMobile) Haptics.impact({ style: ImpactStyle.Light });
  };

  const goBack = useCallback(async () => {
    const { activeTab, selectedIncident, isLoggedIn } = stateRef.current;
    if (!isLoggedIn) { setShowLogin(false); return; }
    if (selectedIncident) { setSelectedIncident(null); return; }
    if (activeTab !== 'dashboard') { setActiveTab('dashboard'); } 
    else { CapApp.exitApp(); }
  }, [isMobile]);

  // --- 4. ENGINE: SENSORS ---
  const updateWeather = async (lat, lon) => {
    try {
      const res = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=311da565f6bbe61c1896ea46b2f8c353&units=metric`);
      setWeather(res.data);
    } catch (e) { console.log("Weather error"); }
  };

  const initNativeFeatures = async () => {
    try {
      await Geolocation.requestPermissions();
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#006432' });
      Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 10000 }, (pos) => {
        if (pos) {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentCoords(coords);
          updateWeather(coords.lat, coords.lng);
        }
      });
      Network.addListener('networkStatusChange', status => {
        setIsOnline(status.connected);
        if (status.connected) processSyncQueue();
      });
      CapApp.addListener('backButton', goBack);
    } catch (e) { console.log("Native API Skip"); }
  };

  // --- 5. LIFECYCLE ---
  useEffect(() => {
    const bootstrap = async () => {
      const uData = await storage.get('userData');
      if (uData) { setIsLoggedIn(true); setUserData(uData); }
      initNativeFeatures();
      fetchData();
    };
    bootstrap();

    socket.on('emergency_broadcast', async (data) => {
      await LocalNotifications.schedule({
        notifications: [{ id: Date.now(), title: `🚨 DARURAT: ${data.title}`, body: data.region }]
      });
      Haptics.impact({ style: ImpactStyle.Heavy });
      fetchData();
    });

    return () => {
      socket.off('emergency_broadcast');
      CapApp.removeAllListeners();
    };
  }, [fetchData, processSyncQueue, goBack, storage]);

  const handleLoginSuccess = (user) => {
    setUserData(user);
    setIsLoggedIn(true);
    setShowLogin(false);
    setIsLoading(true);
    fetchData();
  };

  const handleLogout = async () => {
    await storage.clear();
    window.location.reload();
  };

  // --- 6. ROUTING LOGIC ---
  const path = window.location.pathname;
  if (path === '/lapor') return <PublicReport />;
  if (path === '/gabung') return <VolunteerRegister />;
  
  if (!isLoggedIn) {
    return (
      <div className="h-screen w-screen relative bg-white overflow-hidden">
        <PublicDashboard incidents={filteredData || []} onOpenLogin={() => setShowLogin(true)} />
        <button onClick={() => setShowLogin(true)} className="fixed bottom-10 right-10 z-[9999] bg-[#006432] text-white p-5 rounded-full shadow-2xl animate-bounce border-4 border-white"><i className="fas fa-user-shield text-xl"></i></button>
        {showLogin && <Login onLoginSuccess={handleLoginSuccess} onGoToRegister={() => window.location.pathname = '/gabung'} onClose={() => setShowLogin(false)} />}
      </div>
    );
  }

  if (userData?.role === 'RELAWAN' || path === '/v') {
    return <RelawanTactical user={userData} incidents={filteredData || []} onLogout={handleLogout} />;
  }

  // --- 7. RENDER UTAMA ---
  return (
    <div className="h-screen w-screen flex flex-col bg-[#f8fafc] text-slate-800 overflow-hidden relative safe-area-inset">
      <header className="h-14 md:h-16 bg-[#006432] border-b-2 border-[#c5a059] flex items-center px-4 md:px-8 justify-between shrink-0 shadow-2xl z-[5000]">
        <div className="flex items-center gap-3">
          <img src="https://pwnu-jateng.org/uploads/infoumum/20250825111304-2025-08-25infoumum111252.png" className="h-8 md:h-10" alt="logo" />
          <div className="flex flex-col">
            <h1 className="font-black text-[10px] md:text-sm text-white uppercase italic tracking-tighter">PWNU JATENG COMMAND CENTER</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-500 animate-pulse'}`}></span>
              <span className="text-[7px] text-white/70 font-bold uppercase">{weather ? `${weather.main.temp}°C` : 'Syncing...'}</span>
            </div>
          </div>
        </div>
        <button onClick={handleLogout} className="text-white/40 hover:text-white p-2 transition-all"><i className="fas fa-power-off"></i></button>
      </header>

      <div className="flex flex-1 overflow-hidden relative flex-col md:flex-row">
        {!isMobile && (
          <aside className="w-[85px] bg-white border-r border-slate-200 flex flex-col items-center py-8 gap-10 shrink-0 z-40 shadow-sm">
            <NavBtn icon="home" label="Home" active={activeTab === 'dashboard'} onClick={() => navigateTo('dashboard')} />
            <NavBtn icon="crosshairs" label="HUD" active={activeTab === 'command'} onClick={() => navigateTo('command')} />
            <NavBtn icon="table" label="Missions" active={activeTab === 'manager'} onClick={() => navigateTo('manager')} />
            <NavBtn icon="boxes" label="Assets" active={activeTab === 'assets'} onClick={() => navigateTo('assets')} />
            <NavBtn icon="truck-loading" label="Logistik" active={activeTab === 'logistics'} onClick={() => navigateTo('logistics')} />
            <NavBtn icon="desktop" label="Wall" active={activeTab === 'wallboard'} onClick={() => navigateTo('wallboard')} />
          </aside>
        )}

        <main className="flex-1 relative bg-white overflow-hidden shadow-inner">
          <div className="h-full w-full overflow-y-auto custom-scrollbar">
            {isLoading ? (
               <div className="h-full w-full flex flex-col items-center justify-center"><div className="w-10 h-10 border-4 border-green-100 border-t-[#006432] rounded-full animate-spin"></div><p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sinkronisasi Pusdatin...</p></div>
            ) : (
              <div className="pb-24 pt-4 px-4 md:px-8">
                {activeTab === 'dashboard' && <DashboardHome incidents={filteredData || []} onNavigate={navigateTo} isOnline={isOnline} />}
                {activeTab === 'command' && <MapHUD incidents={filteredData || []} onRefresh={fetchData} onAction={setActiveTab} onSelect={setSelectedIncident} />}
                {activeTab === 'manager' && <MissionManager incidents={filteredData || []} onRefresh={fetchData} onAction={setActiveTab} onSelect={setSelectedIncident} />}
                {activeTab === 'assets' && <InventoryView inventory={inventory || []} onRefresh={fetchData} />}
                {activeTab === 'logistics' && <LogisticsHub user={userData} inventory={inventory || []} />}
                {activeTab === 'wallboard' && <Wallboard incidents={filteredData || []} />}
              </div>
            )}

            {activeTab === 'assess' && selectedIncident && (
              <OverlayWrapper title="Asesmen Bencana" onBack={() => setActiveTab('manager')}><Assessment incident={selectedIncident} onBack={() => setActiveTab('manager')} onSyncSubmit={handleDataSubmit} /></OverlayWrapper>
            )}
            {activeTab === 'instruksi' && selectedIncident && (
              <OverlayWrapper title="Instruksi Operasi" onBack={() => setActiveTab('manager')}><InstructionView incident={selectedIncident} onComplete={() => setActiveTab('manager')} onSyncSubmit={handleDataSubmit} /></OverlayWrapper>
            )}
            {activeTab === 'action' && selectedIncident && (
              <OverlayWrapper title="Monitoring Taktis" onBack={() => setActiveTab('manager')}><ActionView incident={selectedIncident} onComplete={() => setActiveTab('manager')} onSyncSubmit={handleDataSubmit} /></OverlayWrapper>
            )}
          </div>
        </main>

        {isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-100 flex justify-around items-center px-2 z-[5000] shadow-xl">
            <MobileNavBtn icon="home" label="Home" active={activeTab === 'dashboard'} onClick={() => navigateTo('dashboard')} />
            <MobileNavBtn icon="crosshairs" label="HUD" active={activeTab === 'command'} onClick={() => navigateTo('command')} />
            <MobileNavBtn icon="table" label="Misi" active={activeTab === 'manager'} onClick={() => navigateTo('manager')} />
            <MobileNavBtn icon="boxes" label="Aset" active={activeTab === 'assets'} onClick={() => navigateTo('assets')} />
          </nav>
        )}
      </div>
      {!isMobile && <LogFooter />}
    </div>
  );
}

// --- UI SUB-COMPONENTS ---
function OverlayWrapper({ children, title, onBack }) {
  return (
    <div className="fixed inset-0 z-[6000] bg-white flex flex-col pt-safe animate-in fade-in slide-in-from-bottom duration-300">
       <div className="h-14 border-b bg-slate-50 flex items-center justify-between px-4 shrink-0 shadow-sm">
          <button onClick={onBack} className="text-[#006432] font-black text-xs uppercase flex items-center gap-2 active:scale-95 transition-all"><i className="fas fa-arrow-left"></i> KEMBALI</button>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{title}</span><div className="w-16"></div>
       </div>
       <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function DashboardHome({ incidents = [], onNavigate, isOnline }) {
  const activeCount = incidents.filter((i) => i.status !== 'completed').length;
  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {!isOnline && <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl flex items-center gap-3"><i className="fas fa-plane-slash text-red-600"></i><span className="text-[10px] font-black text-red-800 uppercase">MODE OFFLINE - CACHE DATA</span></div>}
      <div className="flex justify-between items-end border-b-2 border-green-50 pb-4"><div><h2 className="text-3xl font-black text-[#006432] uppercase italic tracking-tighter leading-none">Strategic Dashboard</h2><p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Sistem Informasi Pusat Kendali Bencana</p></div></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPIBox label="Total Kejadian" value={incidents.length} color="text-slate-800" icon="clipboard-list" />
        <KPIBox label="Misi Aktif" value={activeCount} color="text-blue-600" icon="fire-extinguisher" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
        <QuickBtn label="Peta HUD" icon="crosshairs" onClick={() => onNavigate('command')} />
        <QuickBtn label="Mission Manager" icon="table" onClick={() => onNavigate('manager')} />
      </div>
    </div>
  );
}

function KPIBox({ label, value, color, icon }) {
  return (
    <div className="bento-card p-6 flex flex-col items-center justify-center text-center">
      <div className={`w-12 h-12 rounded-2xl mb-3 flex items-center justify-center bg-slate-50`}><i className={`fas fa-${icon} ${color} text-lg`}></i></div>
      <p className={`text-3xl font-black ${color} leading-none italic`}>{value}</p>
      <p className="text-[9px] font-black text-slate-400 uppercase mt-2 tracking-widest">{label}</p>
    </div>
  );
}

function QuickBtn({ label, icon, onClick }) {
  return (
    <button onClick={onClick} className="bento-card p-6 flex flex-col items-center gap-4 active:scale-95 group">
      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-xl text-[#006432] group-hover:bg-[#006432] group-hover:text-white transition-all shadow-inner"><i className={`fas fa-${icon}`}></i></div>
      <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest leading-none">{label}</span>
    </button>
  );
}

function NavBtn({ icon, label, active, onClick }) {
  return (
    <div onClick={onClick} className={`group flex flex-col items-center gap-1.5 cursor-pointer transition-all duration-300 w-full px-1 ${active ? 'text-[#006432]' : 'text-slate-300 hover:text-[#006432]'}`}>
      <div className={`p-4 rounded-[26px] transition-all ${active ? 'bg-green-50 shadow-lg scale-110 border border-green-100' : 'hover:bg-slate-50'}`}><i className={`fas fa-${icon} text-lg`}></i></div>
      <span className="text-[8px] font-black uppercase tracking-widest opacity-80">{label}</span>
    </div>
  );
}

function MobileNavBtn({ icon, label, active, onClick }) {
  const handleClick = () => { Haptics.impact({ style: ImpactStyle.Light }); onClick(); };
  return (
    <button onClick={handleClick} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${active ? 'text-[#006432] scale-110' : 'text-slate-300'}`}>
      <i className={`fas fa-${icon} text-xl transition-all`}></i>
      <span className="text-[7px] font-black uppercase tracking-tighter">{label}</span>
    </button>
  );
}

export default App;