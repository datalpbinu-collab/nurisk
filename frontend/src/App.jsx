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

import PublicReport from './components/PublicReport';
import VolunteerRegister from './components/VolunteerRegister';
import RelawanTactical from './components/RelawanTactical'; 
import PublicDashboard from './components/PublicDashboard';
import Login from './components/Login';

const BASE_URL = 'https://nupeduli-pusdatin-nu-backend.hf.space';
const socket = io(BASE_URL, { transports: ['websocket'] });

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [incidents, setIncidents] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Fungsi Login Berhasil
  const handleLoginSuccess = (user) => {
    setUserData(user);
    setIsLoggedIn(true);
    setShowLogin(false);
  };

  // Fungsi Logout
  const handleLogout = async () => {
    await Preferences.remove({ key: 'userData' });
    await Preferences.remove({ key: 'isLoggedIn' });
    window.location.reload();
  };

  if (!isLoggedIn) {
    return (
      <div className="h-screen w-screen relative bg-white overflow-hidden">
        {/* Dashboard Publik */}
        <PublicDashboard 
          incidents={incidents} 
          onOpenLogin={() => setShowLogin(true)} 
        />
        
        {/* Tombol Perisai (Login) */}
        <button 
          onClick={() => setShowLogin(true)} 
          className="fixed bottom-10 right-10 z-[9999] bg-[#006432] text-white p-5 rounded-full shadow-2xl animate-bounce border-4 border-white active:scale-90 transition-all"
        >
          <i className="fas fa-user-shield text-xl"></i>
        </button>

        {/* Overlay Login */}
        {showLogin && (
          <Login 
            onLoginSuccess={handleLoginSuccess} 
            onGoToRegister={() => window.location.pathname = '/gabung'} 
            onClose={() => setShowLogin(false)}
          />
        )}
      </div>
    );
  }

  // Jika sudah login, tampilkan dashboard relawan
  return <RelawanTactical user={userData} onLogout={handleLogout} />;
}

export default App;