import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import api from './services/api';
import axios from 'axios';
import ErrorBoundary from './components/ErrorBoundary';

// Error Boundary wrapper component
function withErrorBoundary(WrappedComponent) {
  return function WithErrorBoundaryComponent(props) {
    return (
      <ErrorBoundary>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}

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
import LogFooter from './components/LogFooter';
import PublicReport from './components/PublicReport';
import RelawanTactical from './components/RelawanTactical'; 
import FieldStaffDashboard from './components/FieldStaffDashboard';
import PublicDashboard from './components/PublicDashboard';
import PersonnelPortal from './components/PersonnelPortal';
import AuditLogView from './components/AuditLogView'; // Import the new component
import AdminDashboard from './components/AdminDashboard';


// --- KONFIGURASI ENGINE ---
const BASE_URL = import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:7860');

const socket = io(BASE_URL, {
  reconnection: true, 
  reconnectionAttempts: 10,
  transports: ['websocket', 'polling'], 
  path: '/socket.io/',
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
      const requests = [api.get('incidents').catch(() => ({ data: [] }))];
      
      if (stateRef.current.isLoggedIn) {
        requests.push(api.get('inventory').catch(() => ({ data: [] })));
      }

      const [resInc, resInv] = await Promise.all(requests);
      setIncidents(Array.isArray(resInc?.data) ? resInc.data : []);
      if (resInv) setInventory(Array.isArray(resInv.data) ? resInv.data : []);
    } catch (err) {
      console.error("Fetch Error");
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn]);

  const handleLoginSuccess = async (user) => {
    setIsLoading(true);
    setUserData(user);
    setIsLoggedIn(true);
    setShowLogin(false);
    await storage.set('userData', user);
    await storage.set('isLoggedIn', true);
    if (user.token) {
      localStorage.setItem('token', user.token);
    }
    fetchData();
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
        if (uData.token) {
          localStorage.setItem('token', uData.token);
        }
      }
      fetchData();
    };
    bootstrap();
    
    // Listen for various Socket events
    socket.on('emergency_broadcast', () => fetchData());
    socket.on('notification', (data) => {
      console.log('[SOCKET] New notification:', data);
      // You can add state update here to show notification in UI
    });
    socket.on('notification_read', ({ notification_id }) => {
      console.log('[SOCKET] Notification read:', notification_id);
    });
    socket.on('emergency_alert', (alert) => {
      console.log('[SOCKET] Emergency alert:', alert);
      alert(`🚨 EMERGENCY: ${alert.title}\n${alert.body}`);
    });
    
    return () => {
      socket.off('emergency_broadcast');
      socket.off('notification');
      socket.off('notification_read');
      socket.off('emergency_alert');
    };
  }, [fetchData, storage]);

  // --- ROUTING LOGIC ---
  const path = window.location.pathname;
  if (path === '/lapor') return <PublicReport />;
  
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
        {showLogin && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <PersonnelPortal onLoginSuccess={handleLoginSuccess} onBack={() => setShowLogin(false)} />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (userData?.role === 'FIELD_STAFF') {
    return <FieldStaffDashboard user={userData} onLogout={handleLogout} />;
  }

  if (userData?.role === 'RELAWAN') {
    return <RelawanTactical user={userData} incidents={filteredData} onLogout={handleLogout} />;
  }

  // ADMIN ROLES: PWNU, SUPER_ADMIN, STAFF_PWNU, STAFF_PCNU, ADMIN_PWNU, COMMANDER
  const adminRoles = ['PWNU', 'SUPER_ADMIN', 'STAFF_PWNU', 'STAFF_PCNU', 'ADMIN_PWNU', 'COMMANDER']; // Ensure 'ADMIN_PWNU' is included
  if (adminRoles.includes(userData?.role)) {
    return <AdminDashboard user={userData} onLogout={handleLogout} />; // Render AdminDashboard
  }

  // Fallback for other roles
  return <AdminDashboard user={userData} onLogout={handleLogout} />;
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

export default withErrorBoundary(App);