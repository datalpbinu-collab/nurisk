import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Geolocation } from '@capacitor/geolocation';
import MapDisplay from './MapDisplay'; 
import InventoryView from './InventoryView'; 
import DisasterTrendAnalyzer from './DisasterTrendAnalyzer'; 
import { NEED_CATEGORIES, normalizeStatus } from '../utils/constants';

/**
 * PUSDATIN NU PEDULI - TOTAL PUBLIC DASHBOARD V26.0
 * -----------------------------------------------------------
 * SOLUTION: Handshaking Authority Fix, Active Navigation, 
 * Adaptive Weather Intel (Mobile & Desktop Balanced).
 */

const PublicDashboard = ({ incidents = [], inventory = [], news = [], onOpenLogin, onOpenReport }) => {
  const [activeTab, setActiveTab] = useState('home');
  const [weather, setWeather] = useState({ current: null, hourly: [], daily: [] });
  const [location, setLocation] = useState({ name: 'JAWA TENGAH', lat: -7.15, lon: 110.14 });
  const [selectedKPI, setSelectedKPI] = useState(null);

  // --- 1. ENGINE: DATE PROTECTOR (ANTI-INVALID-DATE) ---
  const formatTacticalTime = useCallback((d) => {
    if (!d) return "TRANSMITTING";
    const validStr = d.includes(' ') ? d.replace(' ', 'T') : d;
    const date = new Date(validStr);
    if (isNaN(date.getTime())) return "REALTIME";
    return date.toLocaleString('id-ID', { 
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
    }).replace(/\./g, ':');
  }, []);

  // --- 2. ENGINE: ADAPTIVE WEATHER HUB ---
  const initWeather = async () => {
    try {
      let lat = -7.15, lon = 110.14;
      
      if (typeof window !== 'undefined' && window.Geolocation) {
        try {
          const pos = await Geolocation.getCurrentPosition();
          lat = pos.coords.latitude;
          lon = pos.coords.longitude;
        } catch (e) {
          console.log('Using default location');
        }
      }
      
      const API_KEY = '311da565f6bbe61c1896ea46b2f8c353';
      
      // Current + Forecast
      const res = await axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=id`);
      
      const current = res.data.list[0];
      const hourly = res.data.list.slice(0, 12);
      const dailyMap = {};
      res.data.list.forEach(item => {
        const date = new Date(item.dt * 1000).toLocaleDateString('id-ID');
        if (!dailyMap[date]) dailyMap[date] = item;
      });
      const daily = Object.values(dailyMap).slice(0, 7);
      
      setWeather({ current, hourly, daily });
      if (res.data.city) setLocation({ name: res.data.city.name, lat, lon });
    } catch (e) {
      console.error("Weather Error:", e.message);
    }
  };

  useEffect(() => { initWeather(); }, []);

  // --- 3. DERIVED STATS ---
  const stats = useMemo(() => {
    const total = incidents.length;
    const active = incidents.filter(i => normalizeStatus(i.status) !== 'COMPLETED').length;
    const affected = incidents.reduce((sum, i) => sum + (i.affected_people || 0), 0);
    return { total, active, affected };
  }, [incidents]);

  // --- 4. NEWS & INVENTORY DISPLAY ---
  const displayedNews = useMemo(() => news.slice(0, 5), [news]);
  const displayedInventory = useMemo(() => inventory.slice(0, 4), [inventory]);

  // --- 5. RENDER ---
  if (selectedKPI) {
    return (
      <div className="min-h-screen bg-[#f8fafc] font-sans">
        <header className="h-14 bg-[#006432] px-4 flex items-center justify-between">
          <button onClick={() => setSelectedKPI(null)} className="text-white font-black text-xs uppercase flex items-center gap-2">
            <i className="fas fa-arrow-left"></i> Kembali
          </button>
          <h2 className="text-white font-black text-sm uppercase italic">{selectedKPI.title}</h2>
          <div></div>
        </header>
        <main className="p-4 md:p-10">
          <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectedKPI.data.map((item, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-[#006432]">
                <p className="text-xs font-bold text-slate-400 uppercase">{item.disaster_type || 'Unknown'}</p>
                <p className="text-lg font-black text-slate-800 mt-2">{item.title}</p>
                <p className="text-sm text-slate-500 mt-1">{item.region}</p>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#f8fafc] font-sans flex flex-col">
      <header className="h-14 bg-[#006432] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <i className="fas fa-shield-halved text-white/50 text-xl"></i>
          <div>
            <h1 className="text-white font-black text-sm uppercase tracking-tighter">PUSDATIN <span className="text-white/60 font-normal">NU</span></h1>
            <p className="text-[10px] text-white/60 font-medium tracking-widest">PELAYANAN DARURAT TANGGAP</p>
          </div>
        </div>
        {onOpenLogin && (
          <button onClick={onOpenLogin} className="bg-white/10 text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-white/20 transition-all flex items-center gap-2">
            <i className="fas fa-user-circle"></i> LOGIN
          </button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto pb-40 p-4 md:p-10 space-y-10 custom-scrollbar min-h-0">
        {activeTab === 'home' ? (
          <div className="max-w-[1600px] mx-auto space-y-10 animate-in fade-in duration-500">
            
            {/* PILLAR 1: COMPACT KPI CARDS */}
            <div className="grid grid-cols-3 gap-4 md:gap-10">
              <KPIBlock label="Kejadian" value={stats.total} color="text-slate-800" icon="bullhorn" onClick={() => setSelectedKPI({ title: 'Rekap Kejadian', data: incidents })} />
              <KPIBlock label="Misi Aktif" value={stats.active} color="text-red-600" icon="radar" onClick={() => setSelectedKPI({ title: 'Misi Dalam Penanganan', data: incidents.filter(i=>normalizeStatus(i.status)!=='COMPLETED') })} />
              <KPIBlock label="Korban" value={stats.affected} color="text-orange-600" icon="users" onClick={() => setSelectedKPI({ title: 'Jiwa Terdampak', data: incidents.filter(i=>i.affected_people > 0) })} />
            </div>

            {/* PILLAR 2: GOOGLE-STYLE WEATHER HUB */}
            <div className="bg-gradient-to-br from-[#006432] via-[#007a3d] to-[#004d26] rounded-[2rem] shadow-xl overflow-hidden">
               {/* Current Weather - Full Width */}
               <div className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                     {weather.current && (
                        <>
                           <div>
                              <p className="text-5xl font-black text-white italic">{Math.round(weather.current.main.temp)}°</p>
                              <p className="text-white/70 text-sm">Feels like {Math.round(weather.current.main.feels_like)}°</p>
                           </div>
                           <img src={`https://openweathermap.org/img/wn/${weather.current.weather[0].icon}@4x.png`} className="w-20 h-20" />
                        </>
                     )}
                  </div>
                  <div className="text-right">
                     <p className="text-white/90 text-xl font-medium">{location.name}</p>
                     <p className="text-white/50 text-sm">{weather.current?.weather[0]?.main || 'Clear'}</p>
                  </div>
               </div>
               
               {/* Hourly Forecast - Clean Horizontal Bar */}
               <div className="px-4 py-3 bg-white/10 flex gap-3 overflow-x-auto scrollbar-hide">
                  {weather.hourly.slice(0, 12).map((h, i) => (
                     <div key={i} className="flex-shrink-0 flex flex-col items-center gap-1 min-w-[50px]">
                        <span className="text-white/60 text-xs">{new Date(h.dt * 1000).getHours()}:00</span>
                        <img src={`https://openweathermap.org/img/wn/${h.weather[0].icon}.png`} className="w-8 h-8" />
                        <span className="text-white font-semibold text-sm">{Math.round(h.main.temp)}°</span>
                     </div>
                  ))}
               </div>
               
               {/* Daily Forecast + Details Grid */}
               <div className="bg-white">
                  <div className="p-4">
                     {weather.daily.slice(0, 7).map((d, i) => (
                        <div key={i} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                           <span className="text-slate-600 font-medium w-16">{i === 0 ? 'Today' : new Date(d.dt * 1000).toLocaleDateString('id-ID', { weekday: 'short' })}</span>
                           <img src={`https://openweathermap.org/img/wn/${d.weather[0].icon}.png`} className="w-8 h-8 -mx-2" />
                           <div className="flex items-center gap-2 flex-1 justify-end">
                              <span className="text-slate-800 font-semibold">{Math.round(d.main.temp_max)}°</span>
                              <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                 <div className="h-full bg-gradient-to-r from-blue-400 to-red-400" style={{ width: `${((d.main.temp_max - d.main.temp_min) / 40) * 100}%` }}></div>
                              </div>
                              <span className="text-slate-400 font-medium">{Math.round(d.main.temp_min)}°</span>
                           </div>
                        </div>
                     ))}
                  </div>
                  
                  {/* Weather Details Bar */}
                  <div className="p-4 pt-0 grid grid-cols-4 gap-4">
                     <WeatherDetailBar label="Wind" value={weather.current ? `${weather.current.wind.speed} m/s` : '--'} />
                     <WeatherDetailBar label="Humidity" value={weather.current ? `${weather.current.main.humidity}%` : '--'} />
                     <WeatherDetailBar label="Pressure" value={weather.current ? `${weather.current.main.pressure} hPa` : '--'} />
                     <WeatherDetailBar label="Visibility" value={weather.current ? `${(weather.current.visibility / 1000).toFixed(1)} km` : '--'} />
                  </div>
               </div>
            </div>

            {/* PILLAR 3 & 4: MAPS & MISSION FEED */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
               <div className="lg:col-span-8 h-[500px] md:h-[650px] bg-white rounded-[3.5rem] border-[12px] border-white shadow-2xl relative overflow-hidden ring-1 ring-slate-100">
                  <MapDisplay incidents={incidents} />
               </div>

               <div className="lg:col-span-4 bg-white p-8 rounded-[3.5rem] shadow-2xl h-[500px] md:h-[650px] flex flex-col border-b-[15px] border-red-600">
                  <h3 className="text-[11px] font-black uppercase text-slate-400 italic tracking-[0.3em] flex items-center gap-3 mb-8">
                     <i className="fas fa-satellite-dish animate-pulse text-red-600"></i> Active Mission Feed
                  </h3>
                  <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                     {incidents.sort((a,b)=>b.id-a.id).map((inc, i) => (
                        <div key={i} className="p-6 bg-slate-50 rounded-[2.2rem] border-l-[6px] border-[#006432] hover:bg-white hover:shadow-xl transition-all relative group overflow-hidden">
                           <p className="text-[9px] font-black text-slate-400 uppercase mb-2">{formatTacticalTime(inc.created_at)}</p>
                           <h4 className="text-xs font-black text-slate-800 uppercase leading-relaxed group-hover:text-[#006432] transition-colors">{inc.title}</h4>
                           <div className="flex justify-between items-center mt-5">
                              <span className={`text-[8px] px-3 py-1 rounded-full font-black uppercase ${normalizeStatus(inc.status)==='COMPLETED'?'bg-green-100 text-green-600':'bg-red-100 text-red-600 animate-pulse'}`}>
                                 {normalizeStatus(inc.status)}
                              </span>
                              <button className="text-[10px] font-black text-[#c5a059] uppercase hover:underline">Analysis ➔</button>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            {/* PILLAR 5: INVENTORY PREVIEW */}
            <div>
               <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-black text-slate-800 uppercase italic">Resource Overview</h3>
                  <button onClick={() => setActiveTab('resource')} className="text-[10px] font-bold text-[#006432] uppercase hover:underline">View All</button>
               </div>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {displayedInventory.map((item, i) => (
                     <div key={i} className="bg-white p-4 rounded-2xl shadow-sm text-center">
                        <p className="text-xs text-slate-400 uppercase">{item.category}</p>
                        <p className="text-2xl font-black text-[#006432]">{item.quantity || 0}</p>
                     </div>
                  ))}
               </div>
            </div>

            {/* PILLAR 6: NEWS TICKER */}
            {displayedNews.length > 0 && (
               <NewsTicker news={displayedNews} />
            )}
          </div>
        ) : activeTab === 'resource' ? (
          <div className="max-w-[1600px] mx-auto animate-in fade-in duration-500">
            <InventoryView onBack={() => setActiveTab('home')} />
          </div>
        ) : (
          <div className="max-w-[1600px] mx-auto animate-in fade-in duration-500">
            <DisasterTrendAnalyzer user={null} />
          </div>
        )}
      </main>

      {/* --- FOOTER TACTICAL NAV (FULLY ACTIVE) --- */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[92%] md:w-[500px] h-20 bg-white/90 backdrop-blur-2xl border border-white/50 flex items-center justify-around z-[6000] px-8 rounded-[2.5rem] shadow-2xl">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-[#006432]' : 'text-slate-300'}`}>
          <i className="fas fa-house text-2xl"></i><span className="text-[10px] font-black uppercase">Home</span>
        </button>
        <div className="relative -top-12">
          <button 
            onClick={onOpenReport || (() => window.location.href = '/lapor')} 
            className="w-24 h-24 bg-gradient-to-br from-red-600 to-red-800 rounded-full shadow-[0_20px_40px_rgba(220,38,38,0.5)] flex flex-col items-center justify-center text-white border-[10px] border-white active:scale-95 transition-all hover:rotate-12 group"
          >
            <i className="fas fa-bullhorn text-3xl mb-1 group-hover:animate-bounce"></i>
            <span className="text-[8px] font-black uppercase tracking-widest">REPORT</span>
          </button>
        </div>
        <button 
          onClick={() => setActiveTab('resource')} 
          className={`flex flex-col items-center gap-1 transition-all duration-500 ${activeTab === 'resource' ? 'text-[#006432]' : 'text-slate-300 hover:text-[#006432]'}`}
        >
          <i className="fas fa-boxes-nodes text-2xl"></i>
          <span className="text-[10px] font-black uppercase tracking-[0.1em]">Resource</span>
        </button>
        <button 
          onClick={() => setActiveTab('trends')} 
          className={`flex flex-col items-center gap-1 transition-all duration-500 ${activeTab === 'trends' ? 'text-[#006432]' : 'text-slate-300 hover:text-[#006432]'}`}
        >
          <i className="fas fa-chart-line text-2xl"></i>
          <span className="text-[10px] font-black uppercase tracking-[0.1em]">Tren</span>
        </button>
      </nav>
    </div>
  );
};

// --- MINI COMPONENTS ---
const KPIBlock = ({ label, value, color, icon, onClick }) => (
  <div onClick={onClick} className="bg-white p-5 md:p-8 rounded-2xl shadow-md flex flex-col items-center justify-center text-center active:scale-95 transition-all cursor-pointer">
    <div className="w-10 h-10 rounded-xl mb-2 bg-slate-50 flex items-center justify-center"><i className={`fas fa-${icon} ${color} text-lg`}></i></div>
    <p className={`text-2xl font-black ${color} tracking-tighter`}>{value}</p>
    <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider mt-1">{label}</p>
  </div>
);

const WeatherDetailBar = ({ label, value }) => (
  <div className="text-center">
    <p className="text-slate-400 text-xs">{label}</p>
    <p className="text-slate-800 font-semibold text-sm">{value}</p>
  </div>
);

export default PublicDashboard;
