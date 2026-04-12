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
  // 1. STATE INITIALIZATION (Selalu awali dengan Array kosong [])
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [navStack, setNavStack] = useState(['dashboard']);
  const [selectedIncident, setSelectedIncident] = useState(null);
  
  const [incidents, setIncidents] = useState([]); 
  const [inventory, setInventory] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState([]);
  const [isLoading, setIsLoading] = useState(true); 
  
  const [weather, setWeather] = useState(null);
  const [currentCoords, setCurrentCoords] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const stateRef = useRef({ activeTab, navStack, selectedIncident, isLoggedIn, syncQueue });
  useEffect(() => { 
    stateRef.current = { activeTab, navStack, selectedIncident, isLoggedIn, syncQueue }; 
  }, [activeTab, navStack, selectedIncident, isLoggedIn, syncQueue]);

  // 2. STORAGE UTILITY
  const storage = useMemo(() => ({
    set: async (key, val) => await Preferences.set({ key, value: JSON.stringify(val) }),
    get: async (key) => {
      const res = await Preferences.get({ key });
      return res.value ? JSON.parse(res.value) : null;
    },
    remove: async (key) => await Preferences.remove({ key }),
    clear: async () => await Preferences.clear()
  }), []);

  // 3. ENGINE: DATA SYNCHRONIZER (FIX UNDEFINED LENGTH)
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
    } catch (err) {
      const cInc = await storage.get('cache_incidents');
      setIncidents(Array.isArray(cInc) ? cInc : []);
    } finally {
      setIsLoading(false);
    }
  }, [storage]);

  // --- FILTER DATA RBAC (PRD PILAR 2) - DENGAN TRIPLE GUARD ---
  const filteredData = useMemo(() => {
    const safeIncidents = Array.isArray(incidents) ? incidents : [];
    if (!isLoggedIn || !userData) return safeIncidents;

    return safeIncidents.filter((inc) => {
      if (!inc) return false;
      // PWNU & SUPER_ADMIN melihat semua
      if (userData.role === 'PWNU' || userData.role === 'SUPER_ADMIN') return true;
      // PCNU & RELAWAN hanya melihat regionnya
      return String(inc.region).toLowerCase() === String(userData.region).toLowerCase();
    });
  }, [incidents, userData, isLoggedIn]);

  // --- ENGINE LAINNYA (TETAP SESUAI PRD) ---
  const handleDataSubmit = async (endpoint, data) => {
    try {
      await api.post(endpoint.replace('/api/', ''), data);
      fetchData();
      setSelectedIncident(null);
    } catch (e) { alert("Gagal kirim data."); }
  };

  const navigateTo = (tab) => {
    setActiveTab(tab);
    if (isMobile) Haptics.impact({ style: ImpactStyle.Light });
  };

  const goBack = useCallback(() => {
    if (selectedIncident) { setSelectedIncident(null); return; }
    setActiveTab('dashboard');
  }, [selectedIncident]);

  const initNativeFeatures = async () => {
    try {
      await Geolocation.requestPermissions();
      await StatusBar.setBackgroundColor({ color: '#006432' });
      Network.addListener('networkStatusChange', status => setIsOnline(status.connected));
      CapApp.addListener('backButton', goBack);
    } catch (e) { console.log("Native API Skip"); }
  };

  // 4. LIFECYCLE
  useEffect(() => {
    const bootstrap = async () => {
      const uData = await storage.get('userData');
      if (uData) { setIsLoggedIn(true); setUserData(uData); }
      initNativeFeatures();
      fetchData();
    };
    bootstrap();

    socket.on('emergency_broadcast', (data) => {
      Haptics.impact({ style: ImpactStyle.Heavy });
      fetchData();
    });

    return () => { socket.off('emergency_broadcast'); };
  }, [fetchData, storage]);

  const handleLoginSuccess = (user) => {
    setIsLoading(true); // Kunci layar saat transisi role
    setUserData(user);
    setIsLoggedIn(true);
    setShowLogin(false);
    storage.set('userData', user);
    fetchData(); // Ambil data admin
  };

  const handleLogout = async () => {
    await storage.clear();
    window.location.reload();
  };

  // 5. ROUTING LOGIC
  const path = window.location.pathname;
  if (path === '/lapor') return <PublicReport />;
  if (path === '/gabung') return <VolunteerRegister />;
  
  // Layar Loading Sesuai PRD (Pilar 1 - Situational Awareness)
  if (isLoading) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-white">
      <div className="w-12 h-12 border-4 border-green-100 border-t-[#006432] rounded-full animate-spin"></div>
      <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sinkronisasi Pusdatin...</p>
    </div>
  );

  if (!isLoggedIn) {
    return (
      <div className="h-screen w-screen relative bg-white overflow-hidden">
        <PublicDashboard incidents={filteredData || []} onOpenLogin={() => setShowLogin(true)} />
        <button 
          onClick={() => setShowLogin(true)} 
          className="fixed bottom-10 right-10 z-[9999] bg-[#006432] text-white p-5 rounded-full shadow-2xl animate-bounce border-4 border-white active:scale-90 transition-all"
        >
          <i className="fas fa-user-shield text-xl"></i>
        </button>
        {showLogin && <Login onLoginSuccess={handleLoginSuccess} onClose={() => setShowLogin(false)} />}
      </div>
    );
  }

  if (userData?.role === 'RELAWAN') {
    return <RelawanTactical user={userData} incidents={filteredData || []} onLogout={handleLogout} />;
  }

  // 6. RENDER UTAMA ADMIN
  return (
    <div className="h-screen w-screen flex flex-col bg-[#f8fafc] text-slate-800 overflow-hidden font-sans relative safe-area-inset">
      <header className="h-14 md:h-16 bg-[#006432] border-b-2 border-[#c5a059] flex items-center px-4 md:px-8 justify-between shrink-0 shadow-2xl z-[5000]">
        <div className="flex items-center gap-3">
          <img src="https://pwnu-jateng.org/uploads/infoumum/20250825111304-2025-08-25infoumum111252.png" className="h-8 md:h-10" alt="logo" />
          <div className="flex flex-col">
            <h1 className="font-black text-[10px] md:text-sm text-white uppercase italic tracking-tighter leading-none">PWNU JATENG COMMAND CENTER</h1>
            <p className="text-[7px] text-white/50 font-bold uppercase mt-1">Role: {userData?.role} - {userData?.region}</p>
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
          </aside>
        )}

        <main className="flex-1 relative bg-white overflow-hidden shadow-inner">
          <div className="h-full w-full overflow-y-auto custom-scrollbar">
            <div className="pb-24 pt-4 px-4 md:px-8">
              {activeTab === 'dashboard' && <DashboardHome incidents={filteredData || []} onNavigate={navigateTo} />}
              {activeTab === 'command' && <MapHUD incidents={filteredData || []} onRefresh={fetchData} onAction={setActiveTab} onSelect={setSelectedIncident} />}
              {activeTab === 'manager' && <MissionManager incidents={filteredData || []} onRefresh={fetchData} onAction={setActiveTab} onSelect={setSelectedIncident} />}
              {activeTab === 'assets' && <InventoryView inventory={inventory || []} onRefresh={fetchData} />}
              {activeTab === 'logistics' && <LogisticsHub user={userData} inventory={inventory || []} />}
              {activeTab === 'wallboard' && <Wallboard incidents={filteredData || []} />}
            </div>

            {activeTab === 'assess' && selectedIncident && (
              <OverlayWrapper title="Asesmen Bencana" onBack={() => setActiveTab('manager')}><Assessment incident={selectedIncident} onBack={() => setActiveTab('manager')} onSyncSubmit={handleDataSubmit} /></OverlayWrapper>
            )}
          </div>
        </main>

        {isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-100 flex justify-around items-center px-2 z-[5000] pb-safe shadow-xl">
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

// UI HELPERS (DENGAN FALLBACK ARRAY || [])
function DashboardHome({ incidents = [] }) {
  const safeData = Array.isArray(incidents) ? incidents : [];
  const activeCount = safeData.filter(i => i?.status?.toLowerCase() !== 'completed').length;

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <h2 className="text-3xl font-black text-[#006432] uppercase italic tracking-tighter leading-none">Strategic Dashboard</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPIBox label="Total Kejadian" value={safeData.length} color="text-slate-800" icon="clipboard-list" />
        <KPIBox label="Misi Aktif" value={activeCount} color="text-red-600" icon="bullhorn" />
      </div>
    </div>
  );
}

function KPIBox({ label, value, color, icon }) {
  return (
    <div className="bg-white p-6 rounded-[35px] shadow-lg border border-slate-50 flex flex-col items-center justify-center text-center">
      <div className={`w-12 h-12 rounded-2xl mb-3 flex items-center justify-center bg-slate-50`}><i className={`fas fa-${icon} ${color} text-lg`}></i></div>
      <p className={`text-3xl font-black ${color} leading-none italic`}>{value}</p>
      <p className="text-[9px] font-black text-slate-400 uppercase mt-2 tracking-widest">{label}</p>
    </div>
  );
}

function NavBtn({ icon, active, onClick, label }) {
  return (
    <div onClick={onClick} className={`group flex flex-col items-center gap-1.5 cursor-pointer transition-all ${active ? 'text-[#006432]' : 'text-slate-300'}`}>
      <div className={`p-4 rounded-[26px] transition-all ${active ? 'bg-green-50 shadow-lg border border-green-100 scale-110' : 'hover:bg-slate-50'}`}><i className={`fas fa-${icon} text-lg`}></i></div>
      <span className="text-[8px] font-black uppercase tracking-widest opacity-80">{label}</span>
    </div>
  );
}

function MobileNavBtn({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${active ? 'text-[#006432] scale-110' : 'text-slate-300'}`}>
      <i className={`fas fa-${icon} text-xl transition-all`}></i>
      <span className="text-[7px] font-black uppercase tracking-tighter">{label}</span>
    </button>
  );
}

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

export default App;