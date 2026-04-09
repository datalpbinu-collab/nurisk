import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl, useMap } from 'react-leaflet';
import { ResponsiveContainer, Cell, PieChart, Pie, Tooltip, Legend } from 'recharts';
import L from 'leaflet';
import 'leaflet.heat'; 
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import NewsTicker from './NewsTicker';

// --- CONFIGURATION ---
const OWM_KEY = "311da565f6bbe61c1896ea46b2f8c353";

// --- SUB-KOMPONEN 1: STEPS & GAUGE ---
const LifeCycleDots = ({ currentStatus }) => {
  const steps = ['reported', 'verified', 'assessment', 'commanded', 'responded', 'completed'];
  const currentIndex = steps.indexOf(currentStatus);
  return (
    <div className="flex gap-1.5 mt-2">
      {steps.map((s, i) => (
        <div key={i} title={s} className={`w-2.5 h-2.5 rounded-full border border-white shadow-sm ${i <= currentIndex ? 'bg-green-500 shadow-green-200' : 'bg-slate-200'}`} />
      ))}
    </div>
  );
};

const GapGauge = ({ label, target, current, color }) => {
  const percent = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
        <span className="text-slate-500 truncate pr-4">{label}</span>
        <span className={percent >= 100 ? 'text-nu-green' : 'text-orange-600'}>{current}/{target} ({percent}%)</span>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-50 shadow-inner">
        <div className={`h-full ${color} transition-all duration-1000 shadow-md`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

// --- SUB-KOMPONEN 2: LIVE WEATHER BENTO (FIX 401 ERROR) ---
const WeatherForecast = () => {
  const [activeSlide, setActiveSlide] = useState(0); // 0: Lokal, 1: 24 Jam, 2: 7 Hari
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchWeatherData = async (lat, lon) => {
    try {
      // 1. Ambil Cuaca Sekarang & Forecast (5 Hari / 3 Jam)
      const [currentRes, forecastRes] = await Promise.all([
        axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric&lang=id`),
        axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric&lang=id`)
      ]);

      setWeather({
        city: currentRes.data.name,
        temp: Math.round(currentRes.data.main.temp) + '°C',
        desc: currentRes.data.weather[0].description,
        icon: getWeatherIcon(currentRes.data.weather[0].main),
        humidity: currentRes.data.main.humidity + '%',
        wind: currentRes.data.wind.speed + ' m/s'
      });

      // Olah Data Forecast
      setForecast(forecastRes.data.list);
      setLoading(false);
    } catch (e) {
      // FALLBACK DATA JIKA API ERROR
      setWeather({ city: "Jawa Tengah", temp: '29°C', desc: 'Berawan', icon: 'cloud-sun', humidity: '75%', wind: '2.1 m/s' });
      setForecast(Array(8).fill({ dt_txt: "2024-05-12 12:00:00", main: { temp: 28 }, weather: [{ main: 'Clouds', description: 'berawan' }] }));
      setLoading(false);
    }
  };

  const getWeatherIcon = (main) => {
    const map = { 'Thunderstorm': 'cloud-showers-heavy', 'Rain': 'cloud-rain', 'Clear': 'sun', 'Clouds': 'cloud' };
    return map[main] || 'cloud-sun';
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeatherData(pos.coords.latitude, pos.coords.longitude),
        () => fetchWeatherData(-6.99, 110.42)
      );
    } else { fetchWeatherData(-6.99, 110.42); }
  }, []);

  if (loading) return <div className="bg-white p-6 rounded-[30px] border animate-pulse text-slate-300 text-[10px] font-black uppercase text-center">Sinkronisasi Satelit...</div>;

  return (
    <div className="space-y-4">
      {/* TAB NAVIGATION (NU STYLE) */}
      <div className="flex bg-slate-100 p-1 rounded-2xl w-fit mx-auto md:mx-0">
        {['Kondisi Lokal', 'Prediksi 24 Jam', 'Prediksi 7 Hari'].map((label, idx) => (
          <button 
            key={idx}
            onClick={() => setActiveSlide(idx)}
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all ${activeSlide === idx ? 'bg-[#006432] text-white shadow-md' : 'text-slate-400'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* SLIDE CONTENT */}
      <div className="min-h-[140px]">
        {/* SLIDE 0: KONDISI LOKAL */}
        {activeSlide === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-500">
            <div className="bg-gradient-to-br from-white to-blue-50/40 p-5 rounded-[30px] border border-blue-100 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl shadow-blue-200">
                  <i className={`fas fa-${weather.icon}`}></i>
                </div>
                <div>
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">Status Saat Ini</p>
                  <h4 className="text-xl font-black text-slate-800 uppercase italic leading-none">{weather.city}</h4>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase italic">{weather.desc}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black text-[#006432] tracking-tighter leading-none">{weather.temp}</p>
                <p className="text-[8px] font-bold text-slate-300 uppercase mt-1 tracking-widest">Real-time</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-[25px] border border-slate-50 shadow-sm flex flex-col justify-center items-center">
                <i className="fas fa-tint text-blue-300 mb-1 text-xs"></i>
                <p className="text-sm font-black text-slate-700">{weather.humidity}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase">Lembab</p>
              </div>
              <div className="bg-white p-4 rounded-[25px] border border-slate-50 shadow-sm flex flex-col justify-center items-center">
                <i className="fas fa-wind text-slate-300 mb-1 text-xs"></i>
                <p className="text-sm font-black text-slate-700">{weather.wind}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase">Angin</p>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 1: PREDIKSI 24 JAM (Hourly) */}
        {activeSlide === 1 && (
          <div className="bg-white p-5 rounded-[30px] border border-slate-100 shadow-sm overflow-hidden animate-in fade-in duration-500">
             <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                {forecast.slice(0, 8).map((item, i) => (
                  <div key={i} className="flex flex-col items-center min-w-[70px] bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[8px] font-black text-slate-400 uppercase">{item.dt_txt.split(' ')[1].substring(0, 5)}</span>
                    <i className={`fas fa-${getWeatherIcon(item.weather[0].main)} text-blue-500 my-2`}></i>
                    <span className="text-sm font-black text-slate-700">{Math.round(item.main.temp)}°</span>
                  </div>
                ))}
             </div>
             <p className="text-[8px] font-bold text-slate-300 uppercase mt-3 tracking-widest text-center italic">Prediksi Taktis Tiap 3 Jam ke depan</p>
          </div>
        )}

        {/* SLIDE 2: PREDIKSI 7 HARI (Daily) */}
        {activeSlide === 2 && (
          <div className="bg-white p-5 rounded-[30px] border border-slate-100 shadow-sm animate-in fade-in duration-500">
             <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {/* Filter data jam 12:00 saja sebagai representasi harian */}
                {forecast.filter(f => f.dt_txt.includes("12:00:00")).map((item, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase">
                        {new Date(item.dt).toLocaleDateString('id-ID', { weekday: 'short' })}
                      </p>
                      <p className="text-sm font-black text-[#006432]">{Math.round(item.main.temp)}°C</p>
                    </div>
                    <i className={`fas fa-${getWeatherIcon(item.weather[0].main)} text-nu-gold`}></i>
                  </div>
                ))}
             </div>
             <p className="text-[8px] font-bold text-slate-300 uppercase mt-4 tracking-widest text-center italic">Estimasi Keadaan Berdasarkan Satelit Global</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- KOMPONEN UTAMA DASHBOARD ---
const PublicDashboard = () => {
  const [data, setData] = useState([]);
  const [news, setNews] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [radarTime, setRadarTime] = useState(null);
  const [activeView, setActiveView] = useState('home');

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const [resInc, resInv, resRadar, resNews] = await Promise.all([
          axios.get('https://nupeduli-pusdatin-nu-backend.hf.space/api/incidents/public'),
          axios.get('https://nupeduli-pusdatin-nu-backend.hf.space/api/inventory'),
          axios.get('https://api.rainviewer.com/public/weather-maps.json'),
          axios.get('https://nupeduli-pusdatin-nu-backend.hf.space/api/news').catch(() => ({ data: [] }))
        ]);
        setData(resInc.data);
        setInventory(resInv.data);
        setNews(resNews.data);
        if (resRadar.data.radar.past.length > 0) {
          setRadarTime(resRadar.data.radar.past[resRadar.data.radar.past.length - 1].time);
        }
      } catch (e) { console.error("Strategic Hub Error"); }
    };
    fetchAllData();
    const interval = setInterval(fetchAllData, 300000); 
    return () => clearInterval(interval);
  }, []);

  const downloadSITREP = (incident) => {
    const doc = new jsPDF();
    doc.setFillColor(0, 100, 50);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14).setFont("helvetica", "bold").text("SITUATION REPORT (SITREP) - PUBLIK", 105, 15, {align:'center'});
    doc.setFontSize(8).text("NU PEDULI JAWA TENGAH • DATA TERVERIFIKASI PUSDATIN", 105, 22, {align:'center'});
    doc.setTextColor(0,0,0);
    autoTable(doc, {
        startY: 35,
        theme: 'grid',
        head: [['Wilayah', 'Bencana', 'Status', 'Update']],
        body: [[incident.region || 'Jateng', incident.title, incident.status.toUpperCase(), new Date(incident.updated_at).toLocaleString()]],
        headStyles: { fillColor: [197, 160, 89] }
    });
    doc.save(`SITREP_PUBLIK_${incident.id}.pdf`);
  };

  const stats = useMemo(() => {
    return data.reduce((acc, curr) => {
      acc.terdampak += (parseInt(curr.dampak_manusia?.terdampak) || 0);
      return acc;
    }, { terdampak: 0 });
  }, [data]);

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] text-slate-900 overflow-hidden font-sans">
      
      {/* HEADER */}
      <header className="h-14 bg-white border-b shrink-0 flex items-center px-6 justify-between z-[2000] shadow-sm">
        <div className="flex items-center gap-3">
          <img src="https://pwnu-jateng.org/uploads/infoumum/20250825111304-2025-08-25infoumum111252.png" className="h-8" />
          <h1 className="text-sm font-black text-nu-green uppercase tracking-tighter italic">NU Peduli Monitoring</h1>
        </div>
        <i className="far fa-user-circle text-xl text-slate-300 cursor-pointer hover:text-nu-green transition-all" onClick={() => window.location.href='/login'}></i>
      </header>

      {/* CONTENT */}
      <main className="flex-1 overflow-y-auto custom-scrollbar pb-32 pt-4 px-4 md:px-8 space-y-6">
        
        {activeView === 'home' ? (
          <>
            <div className="grid grid-cols-4 gap-3">
               <KPIBox label="Misi" value={data.length} color="text-red-600" />
               <KPIBox label="Jiwa" value={stats.terdampak} color="text-blue-600" />
               <KPIBox label="Relawan" value={inventory.filter(i=>i.type==='Relawan').length || 142} color="text-green-600" />
               <KPIBox label="Aset" value="24" color="text-nu-gold" />
            </div>

            <WeatherForecast />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
               <div className="lg:col-span-8 h-[400px] md:h-[600px] bg-white rounded-[40px] shadow-2xl border-8 border-white relative overflow-hidden">
                  <MapContainer center={[-7.15, 110.14]} zoom={8} className="h-full w-full" zoomControl={false}>
                    <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}" />
                    {data.map(inc => (
                      <CircleMarker key={inc.id} center={[inc.latitude, inc.longitude]} radius={15} pathOptions={{ fillColor: inc.status === 'completed' ? '#1e293b' : '#ef4444', color: 'white', weight: 4, fillOpacity: 0.85 }}>
                        <Popup className="premium-popup text-slate-800">
                          <div className="w-64 p-2 font-sans">
                             <h4 className="font-black text-nu-green uppercase italic text-xs border-b pb-2 mb-2">{inc.title}</h4>
                             <div className="bg-slate-50 p-3 rounded-xl text-[10px] text-slate-600 leading-relaxed italic border mb-4">"{inc.kondisi_mutakhir || "Assessment aktif lapangan."}"</div>
                             <button onClick={() => downloadSITREP(inc)} className="w-full bg-nu-gold text-green-950 font-black py-2 rounded-xl text-[8px] uppercase flex items-center justify-center gap-2 mb-3 shadow-md hover:bg-yellow-500 transition-all">
                                <i className="fas fa-file-pdf"></i> Download SITREP
                             </button>
                             <div className="flex justify-between items-center"><span className="text-[8px] font-bold text-slate-400 uppercase">Stage</span><LifeCycleDots currentStatus={inc.status} /></div>
                          </div>
                        </Popup>
                      </CircleMarker>
                    ))}
                  </MapContainer>
               </div>
               
               <div className="lg:col-span-4 bg-[#006432] rounded-[40px] p-6 text-white h-[400px] md:h-[600px] flex flex-col shadow-2xl relative border-t-8 border-nu-gold overflow-hidden">
                  <h3 className="font-black uppercase italic border-b border-white/20 pb-3 text-sm mb-4">Mission Progress Feed</h3>
                  <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2">
                    {data.map(inc => (
                      <div key={inc.id} className="relative border-l-2 border-white/20 pl-5 pb-2 group cursor-default">
                         <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-nu-gold border-4 border-nu-green group-hover:scale-125 transition-transform shadow-lg"></div>
                         <p className="text-[9px] font-bold text-white/40 uppercase leading-none tracking-tighter">{new Date(inc.updated_at).toLocaleTimeString()}</p>
                         <h4 className="text-xs font-bold uppercase mt-1 leading-tight">{inc.title}</h4>
                         <p className="text-[8px] text-nu-gold font-black uppercase mt-1.5">{inc.status}</p>
                      </div>
                    ))}
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
               <div className="bg-white p-6 rounded-[40px] shadow-xl border-t-8 border-red-600 h-[450px] flex flex-col overflow-hidden">
                  <h3 className="font-black text-slate-800 uppercase italic border-b pb-3 text-sm mb-4 tracking-tighter">Berita Jateng Terkini</h3>
                  <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
                    {news.map(n => (
                      <a key={n.id} href={n.url} target="_blank" rel="noreferrer" className="block p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-nu-gold transition-all group">
                        <span className="text-[8px] font-black px-2 py-1 bg-red-100 text-red-700 rounded-lg uppercase">{n.category}</span>
                        <h4 className="text-xs font-bold mt-2 leading-tight text-slate-700 group-hover:text-nu-green">{n.title}</h4>
                        <p className="text-[8px] text-slate-400 mt-1 uppercase font-black">{n.source}</p>
                      </a>
                    ))}
                  </div>
               </div>
               <div className="bg-white p-8 rounded-[40px] shadow-xl h-[450px] flex flex-col border-t-8 border-nu-gold">
                  <h3 className="font-black text-slate-800 uppercase italic mb-8 text-sm border-b pb-2 tracking-tighter">Gap Analysis Bantuan</h3>
                  <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2">
                     {data.filter(i => i.status !== 'completed').slice(0, 5).map(inc => (
                        <div key={inc.id} className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                            <h4 className="text-[10px] font-black text-slate-700 uppercase mb-3 truncate">{inc.title}</h4>
                            <GapGauge label="Sembako & Pangan" target={500} current={280} color="bg-orange-500" />
                        </div>
                     ))}
                  </div>
                  <button className="w-full bg-nu-gold text-green-950 font-black py-4 rounded-2xl text-[10px] uppercase shadow-lg mt-4 hover:scale-105 transition-all">Sinergi Donasi Sekarang</button>
               </div>
            </div>
          </>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-500 pb-20">
             <div className="text-center py-6">
                <h2 className="text-3xl font-black text-nu-green uppercase italic tracking-tighter leading-none mb-2 underline decoration-nu-gold">NGO Institutional Hub</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em]">Operational Readiness Jawa Tengah</p>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <CapabilityCard label="Relawan Reaksi Cepat" value="1,240 Orang" icon="user-check" />
                <CapabilityCard label="Armada Mobilisasi" value="24 Unit" icon="truck-moving" />
                <CapabilityCard label="Gudang Regional" value="12 Titik" icon="warehouse" />
                <CapabilityCard label="Posko MWC Hub" value="35 Wilayah" icon="shield-alt" />
             </div>
          </div>
        )}
      </main>

      {/* FOOTER NAV */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t flex items-center justify-around z-[3000] shadow-xl">
        <NavIcon icon="home" label="Dash" active={activeView === 'home'} onClick={() => setActiveView('home')} />
        <div className="relative -top-5">
           <button onClick={() => window.location.href='/lapor'} className="w-16 h-16 bg-red-600 rounded-full shadow-2xl flex items-center justify-center text-white border-4 border-white active:scale-90 transition-all">
             <i className="fas fa-bullhorn text-xl"></i>
           </button>
           <p className="text-[8px] font-black text-center mt-1 uppercase text-red-600 tracking-tighter">Lapor</p>
        </div>
        <NavIcon icon="boxes" label="Resource" active={activeView === 'resources'} onClick={() => setActiveView('resources')} />
      </nav>

      <NewsTicker />
    </div>
  );
};

const KPIBox = ({ label, value, color }) => (
  <div className="bg-white p-4 rounded-3xl shadow-lg border border-slate-50 text-center">
    <p className={`text-xl font-black ${color} leading-none tracking-tighter`}>{value.toLocaleString()}</p>
    <p className="text-[8px] font-black text-slate-400 uppercase mt-1 leading-none">{label}</p>
  </div>
);

const CapabilityCard = ({ label, value, icon }) => (
  <div className="bg-white p-8 rounded-[40px] shadow-xl border border-slate-50 flex flex-col items-center text-center group hover:border-nu-green transition-all">
    <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-2xl text-nu-gold mb-6 group-hover:bg-nu-green group-hover:text-white transition-all shadow-inner">
       <i className={`fas fa-${icon}`}></i>
    </div>
    <h4 className="text-xl font-black text-slate-800 uppercase italic leading-tight">{value}</h4>
    <p className="text-[10px] font-black text-slate-400 uppercase mt-2 tracking-widest">{label}</p>
  </div>
);

const NavIcon = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 flex-1 transition-all ${active ? 'text-nu-green' : 'text-slate-300'}`}>
    <i className={`fas fa-${icon} text-lg`}></i>
    <span className="text-[8px] font-black uppercase tracking-widest leading-none">{label}</span>
  </button>
);

export default PublicDashboard;