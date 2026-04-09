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

// --- HUB SELURUH KOMPONEN SISTEM (14 KOMPONEN) ---
import MapHUD from './components/CommandCenter'; 
import MissionManager from './components/CompleteView'; 
import InventoryView from './components/InventoryView';
import PublicReport from './components/PublicReport';
import VolunteerRegister from './components/VolunteerRegister';
import RelawanTactical from './components/RelawanTactical'; 
import PublicDashboard from './components/PublicDashboard';
import Login from './components/Login';
import Register from './components/Register';
import Wallboard from './components/Wallboard';
import LogFooter from './components/LogFooter';
import LogisticsHub from './components/LogisticsHub';
import Assessment from './components/Assessment';
import InstructionView from './components/InstructionView';
import ActionView from './components/ActionView';

// --- KONFIGURASI ENGINE ---
const BASE_URL = 'https://nupeduli-pusdatin-nu-backend.hf.space';
const socket = io(BASE_URL, { 
  reconnection: true, 
  reconnectionAttempts: Infinity,
  transports: ['websocket'] 
});

const STATUS_COLORS = { 
  reported: '#64748b', verified: '#3b82f6', assessment: '#eab308', 
  commanded: '#f97316', responded: '#16a34a', completed: '#1e293b' 
};

function App() {
  // --- STATE AUTH & SESSION ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null);
  const [showLogin, setShowLogin] = useState(false);

  // --- STATE NAVIGATION (ADVANCED STACK) ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [navStack, setNavStack] = useState(['dashboard']);
  const [selectedIncident, setSelectedIncident] = useState(null);
  
  // --- STATE DATA & SYNC ENGINE ---
  const [incidents, setIncidents] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState([]);
  
  // --- STATE ENVIRONMENT ---
  const [weather, setWeather] = useState(null);
  const [currentCoords, setCurrentCoords] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // --- REF UNTUK NAVIGASI (Mencegah Stale Closure pada Listener Hardware) ---
  const stateRef = useRef({ activeTab, navStack, selectedIncident, isLoggedIn, syncQueue });
  useEffect(() => { 
    stateRef.current = { activeTab, navStack, selectedIncident, isLoggedIn, syncQueue }; 
  }, [activeTab, navStack, selectedIncident, isLoggedIn, syncQueue]);

  // --- 1. STORAGE UTILITY (NATIVE PREFERENCES) ---
  const storage = useMemo(() => ({
    set: async (key, val) => await Preferences.set({ key, value: JSON.stringify(val) }),
    get: async (key) => {
      const res = await Preferences.get({ key });
      return res.value ? JSON.parse(res.value) : null;
    },
    remove: async (key) => await Preferences.remove({ key }),
    clear: async () => await Preferences.clear()
  }), []);

  // --- 2. ENGINE: DATA SYNCHRONIZER (OFFLINE READY) ---
  const fetchData = useCallback(async () => {
    try {
      const [resInc, resInv] = await Promise.all([
        api.get('/api/incidents'), 
        api.get('/api/inventory')
      ]);
      setIncidents(resInc.data);
      setInventory(resInv.data);
      await storage.set('cache_incidents', resInc.data);
      await storage.set('cache_inventory', resInv.data);
    } catch (err) {
      const cInc = await storage.get('cache_incidents');
      const cInv = await storage.get('cache_inventory');
      if (cInc) setIncidents(cInc);
      if (cInv) setInventory(cInv);
    }
  }, [storage]);

  const processSyncQueue = useCallback(async () => {
    const queue = await storage.get('sync_queue') || [];
    if (queue.length === 0 || !navigator.onLine) return;

    const remainingQueue = [];
    for (const item of queue) {
      try {
        await api.post(item.endpoint, item.data);
      } catch (e) {
        remainingQueue.push(item);
      }
    }
    setSyncQueue(remainingQueue);
    await storage.set('sync_queue', remainingQueue);
    if (remainingQueue.length === 0) fetchData();
  }, [fetchData, storage]);

  const handleDataSubmit = async (endpoint, data) => {
    if (!isOnline) {
      const updatedQueue = [...stateRef.current.syncQueue, { endpoint, data, ts: Date.now() }];
      setSyncQueue(updatedQueue);
      await storage.set('sync_queue', updatedQueue);
      Haptics.impact({ style: ImpactStyle.Heavy });
      alert("⚠️ MODE OFFLINE: Data disimpan di HP. Akan otomatis terupload saat sinyal kembali.");
      goBack();
    } else {
      try {
        await api.post(endpoint, data);
        fetchData();
        goBack();
      } catch (e) { alert("Gagal mengirim data."); }
    }
  };

  // --- 3. ENGINE: NAVIGASI PINTAR (DASHBOARD ANCHOR) ---
  const navigateTo = (tab) => {
    if (tab === activeTab) return;
    setNavStack(prev => [...prev, tab]);
    setActiveTab(tab);
    setSelectedIncident(null);
    if (isMobile) Haptics.impact({ style: ImpactStyle.Light });
  };

  const goBack = useCallback(async () => {
    const { activeTab, navStack, selectedIncident, isLoggedIn } = stateRef.current;
    if (!isLoggedIn) return;

    // A. Tutup Overlay
    if (selectedIncident) {
      setSelectedIncident(null);
      if (isMobile) Haptics.impact({ style: ImpactStyle.Light });
      return;
    }

    // B. Kembali ke Dashboard (Anchor)
    if (activeTab !== 'dashboard') {
      setActiveTab('dashboard');
      setNavStack(['dashboard']);
      if (isMobile) Haptics.impact({ style: ImpactStyle.Medium });
    } else {
      // C. Konfirmasi Exit jika sudah di Dashboard
      const confirmExit = window.confirm("Keluar dari aplikasi PWNU Jateng?");
      if (confirmExit) CapApp.exitApp();
    }
  }, [isMobile]);

  // --- 4. ENGINE: NATIVE SENSORS & REAL-TIME ---
  const updateWeather = async (lat, lon) => {
    try {
      const res = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=YOUR_API_KEY&units=metric`);
      setWeather(res.data);
    } catch (e) { console.log("Weather error"); }
  };

  const initNativeFeatures = async () => {
    try {
      await Geolocation.requestPermissions();
      await Camera.requestPermissions();
      await LocalNotifications.requestPermissions();
      
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#006432' });

      Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 10000 }, (pos) => {
  if (pos && pos.coords) {
    // Pastikan formatnya sesuai dengan yang dibaca komponen Peta (lat & lng)
    const coords = {
      lat: pos.coords.latitude || -7.15,
      lng: pos.coords.longitude || 110.14
    };
    setCurrentCoords(coords);
    updateWeather(coords.lat, coords.lng);
  }
});

      Network.addListener('networkStatusChange', status => {
        setIsOnline(status.connected);
        if (status.connected) processSyncQueue();
      });

      CapApp.addListener('backButton', goBack);
    } catch (e) { console.log("Native API not available in Browser"); }
  };

  // --- 5. LIFECYCLE & BOOTSTRAP ---
  useEffect(() => {
    const bootstrap = async () => {
      const uData = await storage.get('userData');
      const logged = await storage.get('isLoggedIn');
      if (logged && uData) {
        setIsLoggedIn(true);
        setUserData(uData);
      }
      initNativeFeatures();
      fetchData();
    };
    bootstrap();
    if (window.location.pathname === '/login') {
      setShowLogin(true);
    }



    socket.on('emergency_broadcast', async (data) => {
      await LocalNotifications.schedule({
        notifications: [{
          id: data.incident_id || Date.now(),
          title: `🚨 DARURAT: ${data.title}`,
          body: data.summary,
          channelId: 'critical_alerts',
          sound: 'emergency_siren.wav'
        }]
      });
      Haptics.impact({ style: ImpactStyle.Heavy });
    });

    return () => {
      socket.off('emergency_broadcast');
      CapApp.removeAllListeners();
    };
  }, [fetchData, processSyncQueue, goBack, storage]);

  // --- 6. AUTH ENGINE (OFFLINE LOGIN SUPPORT) ---
  const handleLogin = async (credentials) => {
    try {
      const res = await api.post('/api/login', credentials);
      await storage.set('userData', res.data.user);
      await storage.set('isLoggedIn', true);
      await storage.set('last_creds', credentials);
      setUserData(res.data.user);
      setIsLoggedIn(true);
      fetchData();
    } catch (err) {
      const cachedUser = await storage.get('userData');
      const lastCreds = await storage.get('last_creds');
      if (cachedUser && lastCreds && lastCreds.email === credentials.email && lastCreds.password === credentials.password) {
        setIsLoggedIn(true);
        setUserData(cachedUser);
        alert("✅ Mode Offline: Login Berhasil menggunakan cache HP.");
      } else {
        alert("❌ Login Gagal: Cek sinyal atau data akun Anda.");
      }
    }
  };

  const handleLogout = async () => {
    await storage.remove('userData');
    await storage.remove('isLoggedIn');
    window.location.reload();
  };

  // --- 7. ROUTING LOGIC (RBAC & PUBLIC) ---
  const path = window.location.pathname;
  if (path === '/lapor') return <PublicReport />;
  if (path === '/gabung') return <VolunteerRegister />;
  
  if (!isLoggedIn) {
  return (
    <div className="h-screen w-screen relative bg-white overflow-hidden">
      {/* 1. Dashboard publik tetap terlihat di belakang */}
      <PublicDashboard incidents={incidents} />
      
      {/* 2. Tombol Login sekarang punya fungsi onClick */}
      <button 
        onClick={() => setShowLogin(true)} // <-- Saat diklik, showLogin jadi TRUE
        className="fixed bottom-10 right-10 z-[2500] bg-[#006432] text-white p-5 rounded-full shadow-2xl animate-bounce border-4 border-white"
      >
        <i className="fas fa-user-shield text-xl"></i>
      </button>

      {/* 3. Logika Munculkan Kotak Login */}
      {showLogin && ( // <-- Jika showLogin bernilai TRUE, maka munculkan komponen di bawah ini
        <Login 
          onLoginSuccess={(user) => {
            setUserData(user);
            setIsLoggedIn(true);
            setShowLogin(false); // Tutup login setelah berhasil
            fetchData();
          }} 
          onGoToRegister={() => window.location.pathname = '/gabung'} 
          onClose={() => setShowLogin(false)} // Fungsi untuk tombol silang (tutup)
        />
      )}
    </div>
  );
}

  if (userData?.role === 'RELAWAN' || path === '/v') {
    return <RelawanTactical user={userData} coords={currentCoords} onOfflineSubmit={handleDataSubmit} onLogout={handleLogout} />;
  }

  const filteredData = incidents.filter(inc => 
    userData.role === 'PWNU' || userData.role === 'SUPER_ADMIN' || inc.region === userData.region
  );

  // --- 8. RENDER UTAMA (STUCK NAVIGATION ARCHITECTURE) ---
  return (
    <div className="h-screen w-screen flex flex-col bg-[#f8fafc] text-slate-800 overflow-hidden font-sans relative safe-area-inset">
      
      {/* HEADER (STUCK TOP) */}
      <header className="h-14 md:h-16 bg-[#006432] border-b-2 border-[#c5a059] flex items-center px-4 md:px-8 justify-between shrink-0 shadow-2xl z-[5000]">
        <div className="flex items-center gap-3">
          <img src="https://pwnu-jateng.org/uploads/infoumum/20250825111304-2025-08-25infoumum111252.png" className="h-8 md:h-10" alt="logo" />
          <div className="flex flex-col">
            <h1 className="font-black text-[10px] md:text-sm text-white uppercase italic tracking-tighter leading-none">PWNU JATENG COMMAND CENTER</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-500 animate-pulse'}`}></span>
              <span className="text-[7px] text-white/70 font-bold uppercase tracking-widest leading-none">
                {weather ? `${weather.main.temp}°C - ${weather.weather[0].main}` : 'Syncing Sensors...'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {syncQueue.length > 0 && <div className="bg-orange-500 text-white text-[8px] px-2 py-1 rounded-full animate-bounce font-black">{syncQueue.length} SYNC</div>}
          <button onClick={handleLogout} className="text-white/40 hover:text-white p-2 transition-all"><i className="fas fa-power-off"></i></button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative flex-col md:flex-row">
        
        {/* SIDEBAR (Desktop Only) */}
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

        {/* WORKSPACE AREA (SCROLLABLE) */}
        <main className="flex-1 relative bg-white overflow-hidden shadow-inner">
          <div className="h-full w-full overflow-y-auto custom-scrollbar scrolling-touch">
            
            <div className="pb-24 pt-4 px-4 md:px-8">
              {activeTab === 'dashboard' && <DashboardHome incidents={filteredData} onNavigate={navigateTo} isOnline={isOnline} />}
              {activeTab === 'command' && <MapHUD incidents={filteredData} onRefresh={fetchData} onAction={setActiveTab} onSelect={setSelectedIncident} />}
              {activeTab === 'manager' && <MissionManager incidents={filteredData} onRefresh={fetchData} onAction={setActiveTab} onSelect={setSelectedIncident} />}
              {activeTab === 'assets' && <InventoryView inventory={inventory} onRefresh={fetchData} />}
              {activeTab === 'logistics' && <LogisticsHub user={userData} />}
              {activeTab === 'wallboard' && <Wallboard incidents={filteredData} />}
            </div>

            {/* FULL SCREEN OVERLAYS (Advanced Tactical View) */}
            {activeTab === 'assess' && selectedIncident && (
              <OverlayWrapper title="Asesmen Bencana" onBack={goBack}>
                <Assessment incident={selectedIncident} onBack={goBack} onSyncSubmit={handleDataSubmit} />
              </OverlayWrapper>
            )}

            {activeTab === 'instruksi' && selectedIncident && (
              <OverlayWrapper title="Instruksi Operasi" onBack={goBack}>
                <InstructionView incident={selectedIncident} onComplete={goBack} onSyncSubmit={handleDataSubmit} />
              </OverlayWrapper>
            )}

            {activeTab === 'action' && selectedIncident && (
              <OverlayWrapper title="Monitoring Taktis" onBack={goBack}>
                <ActionView incident={selectedIncident} onComplete={goBack} onSyncSubmit={handleDataSubmit} />
              </OverlayWrapper>
            )}
          </div>
        </main>

        {/* BOTTOM NAVIGATION (STUCK AT BOTTOM) */}
        {isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-100 flex justify-around items-center px-2 z-[5000] pb-safe shadow-[0_-5px_25px_rgba(0,0,0,0.1)]">
            <MobileNavBtn icon="home" label="Home" active={activeTab === 'dashboard'} onClick={() => navigateTo('dashboard')} />
            <MobileNavBtn icon="crosshairs" label="HUD" active={activeTab === 'command'} onClick={() => navigateTo('command')} />
            <MobileNavBtn icon="table" label="Misi" active={activeTab === 'manager'} onClick={() => navigateTo('manager')} />
            <MobileNavBtn icon="boxes" label="Aset" active={activeTab === 'assets'} onClick={() => navigateTo('assets')} />
            <MobileNavBtn icon="truck-loading" label="Logistik" active={activeTab === 'logistics'} onClick={() => navigateTo('logistics')} />
          </nav>
        )}
      </div>

      {!isMobile && <LogFooter logs={logs} />}
    </div>
  );
}

// --- UI SUB-COMPONENTS (TETAP TERJAGA) ---

function OverlayWrapper({ children, title, onBack }) {
  return (
    <div className="fixed inset-0 z-[6000] bg-white animate-in flex flex-col pt-safe">
       <div className="h-14 border-b bg-slate-50 flex items-center justify-between px-4 shrink-0 shadow-sm">
          <button onClick={onBack} className="text-[#006432] font-black text-xs uppercase flex items-center gap-2 active:scale-95 transition-all">
            <i className="fas fa-arrow-left"></i> KEMBALI
          </button>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{title}</span>
          <div className="w-16"></div>
       </div>
       <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function DashboardHome({ incidents, onNavigate, isOnline }) {
  const activeCount = incidents.filter(i => i.status !== 'completed').length;
  const criticalCount = incidents.filter(i => i.priority_level === 'CRITICAL').length;

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {!isOnline && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl flex items-center gap-3">
          <i className="fas fa-plane-slash text-red-600"></i>
          <span className="text-[10px] font-black text-red-800 uppercase">MODE OFFLINE - MENGGUNAKAN DATA CACHE HP</span>
        </div>
      )}

      <div className="flex justify-between items-end border-b-2 border-green-50 pb-4">
        <div>
          <h2 className="text-3xl font-black text-[#006432] uppercase italic tracking-tighter leading-none">Strategic Dashboard</h2>
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Sistem Informasi Pusat Kendali Bencana</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPIBox label="Total Kejadian" value={incidents.length} color="text-slate-800" />
        <KPIBox label="Misi Aktif" value={activeCount} color="text-blue-600" />
        <KPIBox label="Prioritas Kritis" value={criticalCount} color="text-red-600" />
        <KPIBox label="Respon Sukses" value={incidents.length - activeCount} color="text-green-600" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
        <QuickBtn label="Peta HUD" icon="crosshairs" color="green" onClick={() => onNavigate('command')} />
        <QuickBtn label="Mission Manager" icon="table" color="blue" onClick={() => onNavigate('manager')} />
        <QuickBtn label="Aset Logistik" icon="boxes" color="gold" onClick={() => onNavigate('assets')} />
        <QuickBtn label="Wallboard" icon="desktop" color="slate" onClick={() => onNavigate('wallboard')} />
      </div>
    </div>
  );
}

function KPIBox({ label, value, color }) {
  return (
    <div className="bg-white p-6 rounded-[35px] shadow-lg border border-slate-50 flex flex-col items-center justify-center text-center">
      <p className={`text-4xl font-black ${color} leading-none italic`}>{value}</p>
      <p className="text-[8px] font-black text-slate-400 uppercase mt-2 tracking-widest leading-tight">{label}</p>
    </div>
  );
}

function QuickBtn({ label, icon, onClick }) {
  return (
    <button onClick={onClick} className="bg-white p-6 rounded-[35px] shadow-md border border-slate-50 flex flex-col items-center gap-3 hover:bg-green-50 active:scale-95 transition-all group">
      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-xl text-[#006432] group-hover:bg-[#006432] group-hover:text-white transition-all">
         <i className={`fas fa-${icon}`}></i>
      </div>
      <span className="text-[10px] font-black uppercase text-slate-500 tracking-tighter">{label}</span>
    </button>
  );
}

function NavBtn({ icon, label, active, onClick }) {
  return (
    <div onClick={onClick} className={`group flex flex-col items-center gap-1.5 cursor-pointer transition-all duration-300 w-full px-1 ${active ? 'text-[#006432]' : 'text-slate-300 hover:text-[#006432]'}`}>
      <div className={`p-4 rounded-[26px] transition-all ${active ? 'bg-green-50 shadow-lg scale-110 border border-green-100' : 'group-hover:bg-slate-50'}`}>
        <i className={`fas fa-${icon} text-lg`}></i>
      </div>
      <span className="text-[8px] font-black uppercase tracking-widest opacity-80">{label}</span>
    </div>
  );
}

function MobileNavBtn({ icon, label, active, onClick }) {
  const handleClick = () => {
    Haptics.impact({ style: ImpactStyle.Light });
    onClick();
  };
  return (
    <button onClick={handleClick} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${active ? 'text-[#006432] scale-110' : 'text-slate-300'}`}>
      <i className={`fas fa-${icon} text-xl transition-all ${active ? 'mb-0.5' : ''}`}></i>
      <span className="text-[7px] font-black uppercase tracking-tighter">{label}</span>
      {active && <div className="w-1 h-1 bg-[#006432] rounded-full mt-0.5 animate-pulse"></div>}
    </button>
  );
}

export default App;