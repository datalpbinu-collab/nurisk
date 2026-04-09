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

// --- HUB KOMPONEN ---
import { MapHUD, MissionManager, InventoryView, Wallboard, LogFooter, LogisticsHub, Assessment, InstructionView, ActionView } from './components/Placeholders';
import PublicReport from './components/PublicReport';
import VolunteerRegister from './components/VolunteerRegister';
import RelawanTactical from './components/RelawanTactical'; 
import PublicDashboard from './components/PublicDashboard';
import Login from './components/Login';

const BASE_URL = 'https://nupeduli-pusdatin-nu-backend.hf.space';
const socket = io(BASE_URL, { reconnection: true, transports: ['websocket'] });

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [incidents, setIncidents] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const storage = useMemo(() => ({
    set: async (key, val) => await Preferences.set({ key, value: JSON.stringify(val) }),
    get: async (key) => {
      const res = await Preferences.get({ key });
      return res.value ? JSON.parse(res.value) : null;
    },
    remove: async (key) => await Preferences.remove({ key })
  }), []);

  const fetchData = useCallback(async () => {
    try {
      const resInc = await api.get('/api/incidents');
      setIncidents(resInc.data);
      await storage.set('cache_incidents', resInc.data);
    } catch (err) {
      const cInc = await storage.get('cache_incidents');
      if (cInc) setIncidents(cInc);
    }
  }, [storage]);

  useEffect(() => {
    const bootstrap = async () => {
      const uData = await storage.get('userData');
      if (uData) {
        setIsLoggedIn(true);
        setUserData(uData);
      }
      fetchData();
    };
    bootstrap();
  }, [fetchData, storage]);

  const path = window.location.pathname;
  if (path === '/lapor') return <PublicReport />;
  if (path === '/gabung') return <VolunteerRegister />;
  
  if (!isLoggedIn) {
    return (
      <div className="h-screen w-screen relative bg-white overflow-hidden">
        <PublicDashboard incidents={incidents} onOpenLogin={() => setShowLogin(true)} />
        <button onClick={() => setShowLogin(true)} className="fixed bottom-10 right-10 z-[9999] bg-[#006432] text-white p-5 rounded-full shadow-2xl animate-bounce border-4 border-white active:scale-90 transition-all">
          <i className="fas fa-user-shield text-xl"></i>
        </button>
        {showLogin && <Login onLoginSuccess={(u) => { setUserData(u); setIsLoggedIn(true); setShowLogin(false); }} onClose={() => setShowLogin(false)} />}
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#f8fafc] text-slate-800 overflow-hidden font-sans relative safe-area-inset">
      <header className="h-14 md:h-16 bg-[#006432] border-b-2 border-[#c5a059] flex items-center px-4 md:px-8 justify-between shrink-0 shadow-2xl z-[5000]">
        <div className="flex items-center gap-3">
          <img src="https://pwnu-jateng.org/uploads/infoumum/20250825111304-2025-08-25infoumum111252.png" className="h-8 md:h-10" alt="logo" />
          <h1 className="font-black text-[10px] md:text-sm text-white uppercase italic tracking-tighter leading-none">PWNU JATENG COMMAND CENTER</h1>
        </div>
        <button onClick={() => { storage.remove('userData'); window.location.reload(); }} className="text-white/40 hover:text-white p-2 transition-all"><i className="fas fa-power-off"></i></button>
      </header>

      <div className="flex flex-1 overflow-hidden relative flex-col md:flex-row">
        {!isMobile && (
          <aside className="w-[85px] bg-white border-r border-slate-200 flex flex-col items-center py-8 gap-10 shrink-0 z-40 shadow-sm">
            <NavBtn icon="home" label="Home" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
            <NavBtn icon="crosshairs" label="HUD" active={activeTab === 'command'} onClick={() => setActiveTab('command')} />
          </aside>
        )}
        <main className="flex-1 relative bg-white overflow-hidden shadow-inner">
          <div className="h-full w-full overflow-y-auto custom-scrollbar p-4 md:p-8">
            {activeTab === 'dashboard' && <DashboardHome incidents={incidents} onNavigate={setActiveTab} />}
            {activeTab === 'command' && <MapHUD />}
          </div>
        </main>
      </div>
      {!isMobile && <LogFooter />}
    </div>
  );
}

function DashboardHome({ incidents, onNavigate }) {
  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="flex justify-between items-end border-b-2 border-green-50 pb-4">
        <div>
          <h2 className="text-3xl font-black text-[#006432] uppercase italic tracking-tighter leading-none">Strategic Dashboard</h2>
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Sistem Informasi Pusat Kendali Bencana</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPIBox label="Kejadian" value={incidents.length} color="text-slate-800" icon="clipboard-list" />
        <KPIBox label="Misi Aktif" value={incidents.filter(i=>i.status!=='completed').length} color="text-blue-600" icon="fire-extinguisher" />
      </div>
    </div>
  );
}

function KPIBox({ label, value, color, icon }) {
  return (
    <div className="bento-card p-6 flex flex-col items-center justify-center text-center group">
      <div className={`w-12 h-12 rounded-2xl mb-3 flex items-center justify-center bg-slate-50 group-hover:bg-[#006432]/10 transition-colors`}><i className={`fas fa-${icon} ${color} text-lg`}></i></div>
      <p className={`text-3xl font-black ${color} leading-none italic tracking-tighter`}>{value}</p>
      <p className="text-[9px] font-black text-slate-400 uppercase mt-2 tracking-widest leading-tight">{label}</p>
    </div>
  );
}

function NavBtn({ icon, label, active, onClick }) {
  return (
    <div onClick={onClick} className={`group flex flex-col items-center gap-1.5 cursor-pointer transition-all duration-300 w-full px-1 ${active ? 'text-[#006432]' : 'text-slate-300 hover:text-[#006432]'}`}>
      <div className={`p-4 rounded-[26px] transition-all ${active ? 'bg-green-50 shadow-lg scale-110 border border-green-100' : 'group-hover:bg-slate-50'}`}><i className={`fas fa-${icon} text-lg`}></i></div>
      <span className="text-[8px] font-black uppercase tracking-widest opacity-80">{label}</span>
    </div>
  );
}

function MobileNavBtn({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${active ? 'text-[#006432] scale-110' : 'text-slate-300'}`}>
      <i className={`fas fa-${icon} text-xl transition-all ${active ? 'mb-0.5' : ''}`}></i>
      <span className="text-[7px] font-black uppercase tracking-tighter">{label}</span>
    </button>
  );
}

export default App;