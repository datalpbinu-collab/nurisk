import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const OWM_KEY = "311da565f6bbe61c1896ea46b2f8c353";

// --- SUB-KOMPONEN: CUACA ---
const WeatherForecast = () => {
  const [activeSlide, setActiveSlide] = useState(0); 
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchWeatherData = async (lat, lon) => {
    try {
      const [currentRes, forecastRes] = await Promise.all([
        axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric&lang=id`),
        axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric&lang=id`)
      ]);
      setWeather({
        city: currentRes.data.name,
        temp: Math.round(currentRes.data.main.temp) + '°C',
        desc: currentRes.data.weather[0].description,
        icon: currentRes.data.weather[0].main === 'Rain' ? 'cloud-rain' : 'cloud-sun',
        humidity: currentRes.data.main.humidity + '%',
        wind: currentRes.data.wind.speed + ' m/s'
      });
      setForecast(forecastRes.data.list);
      setLoading(false);
    } catch (e) { setLoading(false); }
  };

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchWeatherData(pos.coords.latitude, pos.coords.longitude),
      () => fetchWeatherData(-6.99, 110.42)
    );
  }, []);

  if (loading) return <div className="p-6 text-center animate-pulse text-slate-400 font-black uppercase text-[10px]">Sinkronisasi Cuaca...</div>;

  return (
    <div className="space-y-4">
      <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
        {['Lokal', '24 Jam', '7 Hari'].map((label, idx) => (
          <button key={idx} onClick={() => setActiveSlide(idx)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeSlide === idx ? 'bg-[#006432] text-white shadow-md' : 'text-slate-400'}`}>{label}</button>
        ))}
      </div>
      {activeSlide === 0 && weather && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
          <div className="bg-gradient-to-br from-white to-blue-50/40 p-5 rounded-[30px] border border-blue-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white shadow-lg"><i className={`fas fa-${weather.icon}`}></i></div>
              <div>
                <h4 className="text-lg font-black text-slate-800 uppercase italic leading-none">{weather.city}</h4>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{weather.desc}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-[#006432] leading-none">{weather.temp}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-[25px] border border-slate-50 flex flex-col items-center">
              <i className="fas fa-tint text-blue-300 mb-1"></i>
              <p className="text-sm font-black text-slate-700">{weather.humidity}</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase">Lembab</p>
            </div>
            <div className="bg-white p-4 rounded-[25px] border border-slate-50 flex flex-col items-center">
              <i className="fas fa-wind text-slate-300 mb-1"></i>
              <p className="text-sm font-black text-slate-700">{weather.wind}</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase">Angin</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- KOMPONEN UTAMA ---
const PublicDashboard = ({ incidents, onOpenLogin }) => {
  const [data, setData] = useState(incidents || []);
  const [news, setNews] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [activeView, setActiveView] = useState('home');

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const [resInc, resInv, resNews] = await Promise.all([
          axios.get('https://nupeduli-pusdatin-nu-backend.hf.space/api/incidents/public'),
          axios.get('https://nupeduli-pusdatin-nu-backend.hf.space/api/inventory'),
          axios.get('https://nupeduli-pusdatin-nu-backend.hf.space/api/news').catch(() => ({ data: [] }))
        ]);
        setData(resInc.data);
        setInventory(resInv.data);
        setNews(resNews.data);
      } catch (e) { console.error("Data Fetch Error"); }
    };
    fetchAllData();
  }, [incidents]);

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] text-slate-900 overflow-hidden font-sans">
      <header className="h-14 bg-white border-b shrink-0 flex items-center px-6 justify-between z-[2000] shadow-sm">
        <div className="flex items-center gap-3">
          <img src="https://pwnu-jateng.org/uploads/infoumum/20250825111304-2025-08-25infoumum111252.png" className="h-8" alt="logo" />
          <h1 className="text-sm font-black text-[#006432] uppercase tracking-tighter italic">NU Peduli Monitoring</h1>
        </div>
        <i className="far fa-user-circle text-xl text-slate-300 cursor-pointer hover:text-[#006432] transition-all" onClick={onOpenLogin}></i>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar pb-32 pt-4 px-4 md:px-8 space-y-6">
        {activeView === 'home' ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <KPIBox label="Misi" value={data.length} color="text-red-600" icon="fire-extinguisher" />
               <KPIBox label="Jiwa" value={1240} color="text-blue-600" icon="users" />
               <KPIBox label="Relawan" value={142} color="text-green-600" icon="user-shield" />
               <KPIBox label="Wilayah" value={35} color="text-[#c5a059]" icon="map-marked-alt" />
            </div>

            <div className="bento-card p-6"><WeatherForecast /></div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
               <div className="lg:col-span-8 h-[400px] md:h-[600px] bento-card border-[12px] border-white relative overflow-hidden">
                  <MapContainer center={[-7.15, 110.14]} zoom={8} className="h-full w-full" zoomControl={false}>
                    <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}" />
                    {data.map((inc) => (
                      <CircleMarker key={inc.id || inc._id} center={[parseFloat(inc.latitude), parseFloat(inc.longitude)]} radius={12} pathOptions={{ fillColor: '#ef4444', color: 'white', weight: 3, fillOpacity: 0.8 }}>
                        <Popup><div className="p-2 font-sans"><h4 className="font-black text-[#006432] uppercase text-xs">{inc.title}</h4></div></Popup>
                      </CircleMarker>
                    ))}
                  </MapContainer>
               </div>
               
               <div className="lg:col-span-4 bg-[#006432] rounded-[3rem] p-8 text-white h-[600px] flex flex-col shadow-2xl relative border-t-[12px] border-[#c5a059] overflow-hidden">
                  <h3 className="font-black uppercase italic border-b border-white/20 pb-3 text-sm mb-6 flex items-center gap-3">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span> Mission Progress Feed
                  </h3>
                  <div className="flex-1 overflow-y-auto space-y-8 custom-scrollbar">
                    {data.map((inc) => (
                      <div key={inc.id || inc._id} className="relative pl-6 border-l border-white/10 pb-2">
                         <div className="absolute -left-[4.5px] top-0 w-2 h-2 rounded-full bg-[#c5a059]"></div>
                         <p className="text-[9px] font-bold text-white/30 uppercase">{inc.updated_at ? new Date(inc.updated_at).toLocaleTimeString() : '--:--'}</p>
                         <h4 className="text-sm font-bold mt-1">{inc.title}</h4>
                         <span className="text-[8px] font-black bg-white/10 px-2 py-0.5 rounded-md uppercase mt-2 inline-block">{inc.status}</span>
                      </div>
                    ))}
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10">
               <div className="bento-card p-8 border-t-[12px] border-red-600 h-[450px] flex flex-col overflow-hidden">
                  <h3 className="font-black text-slate-800 uppercase italic border-b pb-3 text-sm mb-6">Berita Jateng Terkini</h3>
                  <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                    {news.length > 0 ? news.map((n) => (
                      <a key={n.id} href={n.url} target="_blank" rel="noreferrer" className="block p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-[#c5a059] transition-all">
                        <h4 className="text-sm font-bold leading-tight text-slate-700">{n.title}</h4>
                        <p className="text-[8px] text-slate-400 mt-1 uppercase font-black">{n.source}</p>
                      </a>
                    )) : <p className="text-center text-slate-300 text-[10px] font-black uppercase mt-10">Mengambil Berita BMKG & Media...</p>}
                  </div>
               </div>
               <div className="bento-card p-8 h-[450px] flex flex-col border-t-[12px] border-[#c5a059]">
                  <h3 className="font-black text-slate-800 uppercase italic mb-8 text-sm border-b pb-3">Gap Analysis Bantuan</h3>
                  <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar">
                     {data.slice(0, 3).map((inc) => (
                        <div key={inc.id} className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100">
                            <h4 className="text-[10px] font-black text-slate-700 uppercase mb-3">{inc.title}</h4>
                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-orange-500 w-[60%]"></div></div>
                            <div className="flex justify-between text-[8px] font-black mt-1 uppercase"><span>Logistik Terpenuhi</span><span>60%</span></div>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
          </>
        ) : (
          <div className="space-y-8 animate-fade-in pb-20">
             <div className="text-center py-6">
                <h2 className="text-3xl font-black text-[#006432] uppercase italic tracking-tighter mb-2 underline decoration-[#c5a059]">NGO Institutional Hub</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em]">Resource & Readiness Jawa Tengah</p>
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

      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t flex items-center justify-around z-[3000] shadow-xl">
        <NavIcon icon="home" label="Dash" active={activeView === 'home'} onClick={() => setActiveView('home')} />
        <div className="relative -top-5">
           <button onClick={() => window.location.href='/lapor'} className="w-16 h-16 bg-red-600 rounded-full shadow-2xl flex items-center justify-center text-white border-4 border-white active:scale-90 transition-all"><i className="fas fa-bullhorn text-xl"></i></button>
           <p className="text-[8px] font-black text-center mt-1 uppercase text-red-600">Lapor</p>
        </div>
        <NavIcon icon="boxes" label="Resource" active={activeView === 'resources'} onClick={() => setActiveView('resources')} />
      </nav>
    </div>
  );
};

const KPIBox = ({ label, value, color, icon }) => (
  <div className="bento-card p-5 flex flex-col items-center justify-center group">
    <div className={`w-10 h-10 rounded-2xl mb-2 flex items-center justify-center bg-slate-50 group-hover:bg-[#006432]/10 transition-colors`}><i className={`fas fa-${icon} ${color} text-xs`}></i></div>
    <p className={`text-2xl font-black ${color} tracking-tighter leading-none`}>{value.toLocaleString()}</p>
    <p className="text-[9px] font-black text-slate-400 uppercase mt-2 leading-none tracking-widest">{label}</p>
  </div>
);

const CapabilityCard = ({ label, value, icon }) => (
  <div className="bento-card p-8 flex flex-col items-center text-center group">
    <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-2xl text-[#c5a059] mb-6 group-hover:bg-[#006432] group-hover:text-white transition-all shadow-inner"><i className={`fas fa-${icon}`}></i></div>
    <h4 className="text-xl font-black text-slate-800 uppercase italic leading-tight">{value}</h4>
    <p className="text-[10px] font-black text-slate-400 uppercase mt-2 tracking-widest">{label}</p>
  </div>
);

const NavIcon = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 flex-1 transition-all ${active ? 'text-[#006432]' : 'text-slate-300'}`}>
    <i className={`fas fa-${icon} text-lg`}></i>
    <span className="text-[8px] font-black uppercase tracking-widest leading-none">{label}</span>
  </button>
);

export default PublicDashboard;