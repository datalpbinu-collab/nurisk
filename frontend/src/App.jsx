import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import api from './services/api';
import axios from 'axios';

// --- NATIVE HP INTEGRATION ---
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Network } from '@capacitor/network'; 
import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';

// --- HUB KOMPONEN ASLI ---
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
// PENTING: GANTI URL DI BAWAH DENGAN NAMA SPACE HUGGING FACE ANDA YANG BARU
const BASE_URL = 'https://nupeduli-pusdatin-nu-backend.hf.space'; 

const socket = io(BASE_URL, { 
  reconnection: true, 
  reconnectionAttempts: Infinity,
  transports: ['websocket'], 
  upgrade: false, 
  forceNew: true
});

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [navStack, setNavStack] = useState(['dashboard']);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [incidents, setIncidents] = useState([]); 
  const [inventory, setInventory] = useState([]); 
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isLoading, setIsLoading] = useState(true); 
  const [syncQueue, setSyncQueue] = useState([]);

  const stateRef = useRef({ activeTab, navStack, selectedIncident, isLoggedIn, syncQueue });
  useEffect(() => { 
    stateRef.current = { activeTab, navStack, selectedIncident, isLoggedIn, syncQueue }; 
  }, [activeTab, navStack, selectedIncident, isLoggedIn, syncQueue]);

  const storage = useMemo(() => ({
    set: async (key, val) => await Preferences.set({ key, value: JSON.stringify(val) }),
    get: async (key) => {
      const res = await Preferences.get({ key });
      return res.value ? JSON.parse(res.value) : null;
    },
    remove: async (key) => await Preferences.remove({ key }),
    clear: async () => await Preferences.clear()
  }), []);

  // --- FILTERING DATA (DIPERKUAT ANTI-CRASH) ---
  const filteredData = useMemo(() => {
    const safeIncidents = Array.isArray(incidents) ? incidents : [];
    
    // Jika tidak login, tampilkan semua (Mode Publik)
    if (!isLoggedIn || !userData) return safeIncidents; 
    
    // Jika login, filter berdasarkan Role & Region
    return safeIncidents.filter((inc) => {
      if (!inc) return false;
      if (userData.role === 'PWNU' || userData.role === 'SUPER_ADMIN') return true;
      return String(inc.region).toLowerCase() === String(userData.region).toLowerCase();
    });
  }, [incidents, userData, isLoggedIn]);

  const fetchData = useCallback(async () => {
    try {
      const [resInc, resInv] = await Promise.all([
        api.get('incidents').catch(() => ({ data: [] })), 
        api.get('inventory').catch(() => ({ data: [] }))
      ]);
      setIncidents(Array.isArray(resInc.data) ? resInc.data : []);
      setInventory(Array.isArray(resInv.data) ? resInv.data : []);
    } catch (err) {
      console.error("Fetch Error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLoginSuccess = async (user) => {
    setIsLoading(true); // Tampilkan loading saat transisi
    setUserData(user);
    setIsLoggedIn(true);
    setShowLogin(false);
    await storage.set('userData', user);
    await storage.set('isLoggedIn', true);
    fetchData(); // Ambil data sesuai role
  };

  const handleLogout = async () => {
    await storage.clear();
    window.location.reload();
  };

  const navigateTo = (tab) => {
    setActiveTab(tab);
    if (window.innerWidth < 768) Haptics.impact({ style: ImpactStyle.Light });
  };

  useEffect(() => {
    const bootstrap = async () => {
      const uData = await storage.get('userData');
      if (uData) {
        setUserData(uData);
        setIsLoggedIn(true);
      }
      fetchData();
    };
    bootstrap();
    socket.on('emergency_broadcast', () => fetchData());
    return () => socket.off('emergency_broadcast');
  }, [fetchData, storage]);

  // --- ROUTING LOGIC ---
  const path = window.location.pathname;
  if (path === '/lapor') return <PublicReport />;
  if (path === '/gabung') return <VolunteerRegister />;
  
  if (isLoading) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-white">
      <div className="w-12 h-12 border-4 border-green-100 border-t-[#006432] rounded-full animate-spin"></div>
      <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sinkronisasi Pusdatin...</p>
    </div>
  );

  if (!isLoggedIn) {
    return (
      <div className="h-screen w-screen relative bg-white overflow-hidden">
        <PublicDashboard incidents={filteredData} onOpenLogin={() => setShowLogin(true)} />
        <button onClick={() => setShowLogin(true)} className="fixed bottom-10 right-10 z-[9999] bg-[#006432] text-white p-5 rounded-full shadow-2xl animate-bounce border-4 border-white"><i className="fas fa-user-shield text-xl"></i></button>
        {showLogin && <Login onLoginSuccess={handleLoginSuccess} onClose={() => setShowLogin(false)} />}
      </div>
    );
  }

  if (userData?.role === 'RELAWAN') {
    return <RelawanTactical user={userData} incidents={filteredData} onLogout={handleLogout} />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#f8fafc] text-slate-800 overflow-hidden font-sans relative safe-area-inset">
      <header className="h-14 bg-[#006432] border-b-2 border-[#c5a059] flex items-center px-6 justify-between shrink-0 shadow-2xl z-[5000]">
        <div className="flex items-center gap-3">
          <img src="https://pwnu-jateng.org/uploads/infoumum/20250825111304-2025-08-25infoumum111252.png" className="h-8" alt="logo" />
          <h1 className="font-black text-[10px] md:text-sm text-white uppercase italic tracking-tighter">PWNU JATENG COMMAND CENTER</h1>
        </div>
        <button onClick={handleLogout} className="text-white/40 p-2"><i className="fas fa-power-off"></i></button>
      </header>

      <div className="flex flex-1 overflow-hidden relative flex-col md:flex-row">
        <aside className="hidden md:flex w-[85px] bg-white border-r border-slate-200 flex flex-col items-center py-8 gap-10 shrink-0 z-40">
          <NavBtn icon="home" active={activeTab === 'dashboard'} onClick={() => navigateTo('dashboard')} />
          <NavBtn icon="crosshairs" active={activeTab === 'command'} onClick={() => navigateTo('command')} />
          <NavBtn icon="table" active={activeTab === 'manager'} onClick={() => navigateTo('manager')} />
          <NavBtn icon="boxes" active={activeTab === 'assets'} onClick={() => navigateTo('assets')} />
        </aside>

        <main className="flex-1 relative bg-white overflow-hidden shadow-inner">
          <div className="h-full w-full overflow-y-auto custom-scrollbar p-4 md:p-8">
             {activeTab === 'dashboard' && <DashboardHome incidents={filteredData} onNavigate={navigateTo} />}
             {activeTab === 'command' && <MapHUD incidents={filteredData} onRefresh={fetchData} onAction={setActiveTab} onSelect={setSelectedIncident} />}
             {activeTab === 'manager' && <MissionManager incidents={filteredData} onRefresh={fetchData} onAction={setActiveTab} onSelect={setSelectedIncident} />}
             {activeTab === 'assets' && <InventoryView inventory={inventory} onRefresh={fetchData} />}
             {activeTab === 'logistics' && <LogisticsHub user={userData} inventory={inventory} />}
             {activeTab === 'wallboard' && <Wallboard incidents={filteredData} />}
          </div>
        </main>
      </div>
      <LogFooter />
    </div>
  );
}

// SUB KOMPONEN (PENTING: Gunakan default value [] )
function DashboardHome({ incidents = [], onNavigate }) {
  const safeData = Array.isArray(incidents) ? incidents : [];
  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <h2 className="text-3xl font-black text-[#006432] uppercase italic tracking-tighter">Strategic Dashboard</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[35px] shadow-lg border flex flex-col items-center justify-center">
          <p className="text-3xl font-black text-slate-800">{safeData.length}</p>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Total Kejadian</p>
        </div>
      </div>
    </div>
  );
}

function NavBtn({ icon, active, onClick }) {
  return (
    <div onClick={onClick} className={`p-4 rounded-[26px] cursor-pointer transition-all ${active ? 'bg-green-50 text-[#006432] shadow-lg border border-green-100 scale-110' : 'text-slate-300 hover:bg-slate-50'}`}>
      <i className={`fas fa-${icon} text-lg`}></i>
    </div>
  );
}

export default App;