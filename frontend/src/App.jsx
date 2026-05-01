import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import api from './services/api';
import ErrorBoundary from './components/ErrorBoundary';
import { FullPageLoader } from './components/ui/LoadingSpinner';
import PersonnelPortal from './components/PersonnelPortal';
import PublicDashboard from './components/PublicDashboard';
import FieldStaffDashboard from './components/FieldStaffDashboard';
import RelawanTactical from './components/RelawanTactical';
import AdminDashboard from './components/AdminDashboard';
import PublicReport from './components/PublicReport';
import { X } from 'lucide-react';

// ----------------------------------------------------------------
// Error Boundary HOC
// ----------------------------------------------------------------
function withErrorBoundary(WrappedComponent) {
  return function WithErrorBoundaryComponent(props) {
    return (
      <ErrorBoundary>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}

// ----------------------------------------------------------------
// Storage helper — localStorage primary, Capacitor as overlay
// ----------------------------------------------------------------
const storage = {
  // Always use localStorage as source of truth on web.
  // Try Capacitor Preferences as an additional layer on native.
  async set(key, val) {
    const json = JSON.stringify(val);
    localStorage.setItem(key, json);
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key, value: json });
    } catch { /* not in Capacitor native env — localStorage is enough */ }
  },

  async get(key) {
    // Primary: localStorage (works on both web and native)
    const localVal = localStorage.getItem(key);
    if (localVal) {
      try { return JSON.parse(localVal); } catch { return null; }
    }
    // Fallback: try Capacitor Preferences (native only)
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const res = await Preferences.get({ key });
      return res.value ? JSON.parse(res.value) : null;
    } catch { return null; }
  },

  async remove(key) {
    localStorage.removeItem(key);
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key });
    } catch { /* ignore */ }
  },

  async clear() {
    localStorage.clear();
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.clear();
    } catch { /* ignore */ }
  },
};

// ----------------------------------------------------------------
// Haptics helper (no-op in browser)
// ----------------------------------------------------------------
const triggerHaptic = async () => {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // not in Capacitor env
  }
};

// ----------------------------------------------------------------
// Socket
// ----------------------------------------------------------------
const BASE_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:7860');

const socket = io(BASE_URL, {
  reconnection: true,
  reconnectionAttempts: 10,
  transports: ['websocket', 'polling'],
  path: '/socket.io/',
});

// ----------------------------------------------------------------
// App
// ----------------------------------------------------------------
function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData]     = useState(null);
  const [showLogin, setShowLogin]   = useState(false);
  const [incidents, setIncidents]   = useState([]);
  const [isOnline, setIsOnline]     = useState(navigator.onLine);
  const [isLoading, setIsLoading]   = useState(true);

  // Filtered data per role/region
  const filteredData = useMemo(() => {
    const safe = Array.isArray(incidents) ? incidents : [];
    if (!isLoggedIn || !userData) return safe;
    return safe.filter(inc => {
      if (!inc) return false;
      if (userData.role === 'PWNU' || userData.role === 'SUPER_ADMIN') return true;
      return String(inc.region).toLowerCase() === String(userData.region).toLowerCase();
    });
  }, [incidents, userData, isLoggedIn]);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('incidents').catch(() => ({ data: [] }));
      setIncidents(Array.isArray(res?.data) ? res.data : []);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLoginSuccess = async (user) => {
    setIsLoading(true);
    setUserData(user);
    setIsLoggedIn(true);
    setShowLogin(false);
    await storage.set('userData', user);
    await storage.set('isLoggedIn', true);
    if (user.token) localStorage.setItem('token', user.token);
    await triggerHaptic();
    fetchData();
  };

  const handleLogout = async () => {
    await storage.clear();
    localStorage.removeItem('token');
    window.location.reload();
  };

  // Online/offline
  useEffect(() => {
    const online  = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  // Bootstrap
  useEffect(() => {
    const bootstrap = async () => {
      const uData = await storage.get('userData');
      if (uData) {
        setUserData(uData);
        setIsLoggedIn(true);
        if (uData.token) localStorage.setItem('token', uData.token);
      }
      fetchData();
    };
    bootstrap();

    socket.on('emergency_broadcast', () => fetchData());
    return () => { socket.off('emergency_broadcast'); };
  }, [fetchData]);

  // ----------------------------------------------------------------
  // ROUTING
  // ----------------------------------------------------------------
  const path = window.location.pathname;
  if (path === '/lapor') return <PublicReport />;

  if (isLoading) return <FullPageLoader message="Sinkronisasi Pusdatin..." />;

  // Public view
  if (!isLoggedIn) {
    return (
      <div className="h-screen w-screen relative overflow-hidden">
        <PublicDashboard incidents={filteredData} onOpenLogin={() => setShowLogin(true)} />

        {/* Login Modal */}
        {showLogin && (
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={(e) => e.target === e.currentTarget && setShowLogin(false)}
          >
            <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar relative animate-fade-in rounded-2xl">
              {/* Close button */}
              <button
                onClick={() => setShowLogin(false)}
                className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <X size={16} className="text-white" />
              </button>
              <PersonnelPortal onLoginSuccess={handleLoginSuccess} onBack={() => setShowLogin(false)} isModal />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Role-based routing
  if (userData?.role === 'FIELD_STAFF') {
    return <FieldStaffDashboard user={userData} onLogout={handleLogout} />;
  }

  if (userData?.role === 'RELAWAN') {
    return <RelawanTactical user={userData} incidents={filteredData} onLogout={handleLogout} />;
  }

  // Admin roles (fallback)
  return <AdminDashboard user={userData} onLogout={handleLogout} isOnline={isOnline} />;
}

export default withErrorBoundary(App);