import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import PublicHeader from './layout/PublicHeader';
import PublicBottomNav from './layout/PublicBottomNav';
import MapDisplay from './MapDisplay';
import InventoryView from './InventoryView';
import DisasterTrendAnalyzer from './DisasterTrendAnalyzer';
import Card from './ui/Card';
import Badge, { statusToBadge } from './ui/Badge';
import { normalizeStatus } from '../utils/constants';
import {
  Megaphone, Radar, Users, Wind, Droplets,
  Gauge, Eye, ArrowLeft, ChevronRight, Satellite
} from 'lucide-react';

const PublicDashboard = ({ incidents = [], inventory = [], onOpenLogin, onOpenReport }) => {
  const [activeTab, setActiveTab]   = useState('home');
  const [weather, setWeather]       = useState({ current: null, hourly: [], daily: [] });
  const [location, setLocation]     = useState({ name: 'Jawa Tengah', lat: -7.15, lon: 110.14 });
  const [selectedKPI, setSelectedKPI] = useState(null);

  // Format date helper
  const formatTime = useCallback((d) => {
    if (!d) return '—';
    const validStr = d.includes(' ') ? d.replace(' ', 'T') : d;
    const date = new Date(validStr);
    if (isNaN(date.getTime())) return 'Realtime';
    return date.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }, []);

  // Weather fetch
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        let lat = -7.15, lon = 110.14;
        try {
          if (navigator.geolocation) {
            await new Promise((resolve) => {
              navigator.geolocation.getCurrentPosition(
                (pos) => { lat = pos.coords.latitude; lon = pos.coords.longitude; resolve(); },
                () => resolve(),
                { timeout: 5000 }
              );
            });
          }
        } catch { /* use default */ }

        const API_KEY = '311da565f6bbe61c1896ea46b2f8c353';
        const res = await axios.get(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=id`
        );
        const current = res.data.list[0];
        const hourly  = res.data.list.slice(0, 12);
        const dailyMap = {};
        res.data.list.forEach(item => {
          const date = new Date(item.dt * 1000).toLocaleDateString('id-ID');
          if (!dailyMap[date]) dailyMap[date] = item;
        });
        setWeather({ current, hourly, daily: Object.values(dailyMap).slice(0, 7) });
        if (res.data.city) setLocation({ name: res.data.city.name, lat, lon });
      } catch (e) {
        console.error('Weather Error:', e.message);
      }
    };
    fetchWeather();
  }, []);

  // Stats
  const stats = useMemo(() => ({
    total:    incidents.length,
    active:   incidents.filter(i => normalizeStatus(i.status) !== 'COMPLETED').length,
    affected: incidents.reduce((sum, i) => sum + (i.affected_people || 0), 0),
  }), [incidents]);

  // KPI Detail view
  if (selectedKPI) {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        <PublicHeader onOpenLogin={onOpenLogin} />
        <div className="p-4 md:p-8">
          <button
            onClick={() => setSelectedKPI(null)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#006432] mb-6 transition-colors"
          >
            <ArrowLeft size={16} /> Kembali
          </button>
          <h2 className="text-lg font-black text-slate-800 uppercase mb-4">{selectedKPI.title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl">
            {selectedKPI.data.map((item, i) => (
              <Card key={i} accent="green" className="p-5">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{item.disaster_type || 'Unknown'}</p>
                <p className="text-base font-black text-slate-800">{item.title || `${item.disaster_type} — ${item.location}`}</p>
                <p className="text-xs text-slate-500 mt-1">{item.region}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#f8fafc] flex flex-col overflow-hidden">
      <PublicHeader onOpenLogin={onOpenLogin} />

      <main className="flex-1 overflow-y-auto custom-scrollbar pb-32">
        {activeTab === 'home' && (
          <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 space-y-8 animate-fade-in">

            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-4">
              <KPICard
                label="Kejadian"
                value={stats.total}
                colorClass="text-slate-800"
                bgClass="bg-slate-100"
                Icon={Megaphone}
                onClick={() => setSelectedKPI({ title: 'Rekap Kejadian', data: incidents })}
              />
              <KPICard
                label="Misi Aktif"
                value={stats.active}
                colorClass="text-red-600"
                bgClass="bg-red-100"
                Icon={Radar}
                onClick={() => setSelectedKPI({ title: 'Misi Dalam Penanganan', data: incidents.filter(i => normalizeStatus(i.status) !== 'COMPLETED') })}
              />
              <KPICard
                label="Korban"
                value={stats.affected}
                colorClass="text-orange-600"
                bgClass="bg-orange-100"
                Icon={Users}
                onClick={() => setSelectedKPI({ title: 'Jiwa Terdampak', data: incidents.filter(i => i.affected_people > 0) })}
              />
            </div>

            {/* Weather */}
            <WeatherCard weather={weather} location={location} />

            {/* Map + Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Map */}
              <div className="lg:col-span-8 h-[400px] md:h-[520px] bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
                <MapDisplay incidents={incidents} />
              </div>

              {/* Mission Feed */}
              <div className="lg:col-span-4 flex flex-col">
                <Card className="flex-1 flex flex-col h-[400px] md:h-[520px]">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                    <Satellite size={14} className="text-red-500 animate-pulse" />
                    <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">Active Mission Feed</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                    {incidents.length === 0 && (
                      <p className="text-slate-400 text-xs text-center py-8">Tidak ada data</p>
                    )}
                    {incidents.sort((a, b) => b.id - a.id).map((inc, i) => (
                      <div
                        key={inc.id || i}
                        className="p-4 bg-slate-50 rounded-xl border-l-4 border-[#006432] hover:bg-white hover:shadow-sm transition-all"
                      >
                        <p className="text-[9px] text-slate-400 font-medium mb-1">{formatTime(inc.created_at)}</p>
                        <p className="text-xs font-bold text-slate-800 leading-snug">{inc.title || `${inc.disaster_type} — ${inc.location}`}</p>
                        <div className="flex justify-between items-center mt-2">
                          <Badge
                            label={normalizeStatus(inc.status)}
                            variant={statusToBadge(inc.status)}
                            pulse={normalizeStatus(inc.status) !== 'COMPLETED'}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'resource' && (
          <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 animate-fade-in">
            <InventoryView onBack={() => setActiveTab('home')} />
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 animate-fade-in">
            <DisasterTrendAnalyzer user={null} />
          </div>
        )}
      </main>

      <PublicBottomNav
        activeTab={activeTab}
        onNavigate={setActiveTab}
        onReport={onOpenReport}
      />
    </div>
  );
};

// ─── Sub Components ─────────────────────────────────────────────────────────

const KPICard = ({ label, value, colorClass, bgClass, Icon, onClick }) => (
  <button
    onClick={onClick}
    className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-100 flex flex-col items-center gap-2 text-center hover:shadow-md hover:border-slate-200 transition-all active:scale-95 w-full"
  >
    <div className={`w-10 h-10 rounded-xl ${bgClass} flex items-center justify-center`}>
      <Icon size={18} className={colorClass} />
    </div>
    <p className={`text-2xl font-black ${colorClass} leading-none`}>{value}</p>
    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
  </button>
);

const WeatherCard = ({ weather, location }) => {
  if (!weather.current) {
    return (
      <div className="bg-gradient-to-br from-[#006432] to-[#004d26] rounded-2xl p-6 h-32 flex items-center justify-center">
        <p className="text-white/50 text-sm">Memuat data cuaca...</p>
      </div>
    );
  }

  const weatherDetails = [
    { label: 'Angin',    value: `${weather.current.wind.speed} m/s`,               Icon: Wind },
    { label: 'Kelembaban',value: `${weather.current.main.humidity}%`,               Icon: Droplets },
    { label: 'Tekanan',  value: `${weather.current.main.pressure} hPa`,            Icon: Gauge },
    { label: 'Visibilitas',value: `${(weather.current.visibility / 1000).toFixed(1)} km`, Icon: Eye },
  ];

  return (
    <div className="bg-gradient-to-br from-[#006432] via-[#007a3d] to-[#004d26] rounded-2xl overflow-hidden shadow-lg">
      {/* Current */}
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-5xl font-black text-white leading-none">
              {Math.round(weather.current.main.temp)}°
            </p>
            <p className="text-white/60 text-sm mt-1">
              Feels like {Math.round(weather.current.main.feels_like)}°
            </p>
          </div>
          <img
            src={`https://openweathermap.org/img/wn/${weather.current.weather[0].icon}@2x.png`}
            alt="weather"
            className="w-16 h-16"
          />
        </div>
        <div className="text-right">
          <p className="text-white text-lg font-semibold">{location.name}</p>
          <p className="text-white/50 text-sm">{weather.current.weather[0].main}</p>
        </div>
      </div>

      {/* Hourly */}
      <div className="px-4 pb-4 flex gap-3 overflow-x-auto w-full" style={{ scrollbarWidth: 'none' }}>
        {weather.hourly.map((h, i) => (
          <div key={i} className="flex-shrink-0 flex flex-col items-center gap-1 bg-white/10 rounded-xl px-3 py-2 min-w-[60px] md:min-w-0 md:flex-1 transition-all hover:bg-white/20">
            <span className="text-white/60 text-[10px] font-semibold">
              {new Date(h.dt * 1000).getHours()}:00
            </span>
            <img src={`https://openweathermap.org/img/wn/${h.weather[0].icon}.png`} alt="w" className="w-8 h-8 md:w-10 md:h-10" />
            <span className="text-white font-bold text-sm md:text-base">{Math.round(h.main.temp)}°</span>
          </div>
        ))}
      </div>

      {/* Daily + Details */}
      <div className="bg-white">
        <div className="p-4 space-y-1">
          {weather.daily.slice(0, 5).map((d, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <span className="text-slate-600 font-semibold text-sm w-16">
                {i === 0 ? 'Today' : new Date(d.dt * 1000).toLocaleDateString('id-ID', { weekday: 'short' })}
              </span>
              <img src={`https://openweathermap.org/img/wn/${d.weather[0].icon}.png`} alt="w" className="w-8 h-8" />
              <div className="flex items-center gap-2">
                <span className="text-slate-800 font-bold text-sm">{Math.round(d.main.temp_max || d.main.temp)}°</span>
                <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-300 to-red-400 rounded-full" style={{ width: '60%' }} />
                </div>
                <span className="text-slate-400 text-sm">{Math.round(d.main.temp_min || d.main.temp)}°</span>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 pb-4 pt-0 grid grid-cols-2 md:grid-cols-4 gap-3">
          {weatherDetails.map(({ label, value, Icon }) => (
            <div key={label} className="flex items-center gap-2 bg-slate-50 rounded-xl p-3">
              <Icon size={14} className="text-slate-400 shrink-0" />
              <div>
                <p className="text-[9px] text-slate-400 font-semibold uppercase">{label}</p>
                <p className="text-sm font-bold text-slate-700">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PublicDashboard;
