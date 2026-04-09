import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import api from '../services/api';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';

// --- KOMPONEN PENDUKUNG ---
const MapRefresher = () => {
  const map = useMap();
  useEffect(() => { setTimeout(() => map.invalidateSize(), 500); }, [map]);
  return null;
};

const HeatmapLayer = ({ incidents }) => {
  const map = useMap();
  useEffect(() => {
    if (!incidents || !incidents.length) return;
    const points = incidents
      .filter(i => i.latitude && i.longitude && !isNaN(parseFloat(i.latitude)))
      .map(i => [parseFloat(i.latitude), parseFloat(i.longitude), 0.7]);

    if (points.length > 0) {
      const heat = L.heatLayer(points, { radius: 25, blur: 15 }).addTo(map);
      return () => map.removeLayer(heat);
    }
  }, [incidents, map]);
  return null;
};

const RelawanTactical = ({ user }) => {
  // --- STATE CORE ---
  const [data, setData] = useState([]);
  const [radarTime, setRadarTime] = useState(null);
  const [location, setLocation] = useState({ lat: -7.15, lng: 110.14 });
  const [gpsActive, setGpsActive] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // --- STATE ORKESTRASI (WORKFLOW BARU) ---
  const [showDutyForm, setShowDutyForm] = useState(false);
  const [targetIncident, setTargetIncident] = useState(null);
  const [availability, setAvailability] = useState({ from: '', until: '' });
  const [myDeployments, setMyDeployments] = useState([]);

  // 1. DATA SYNC & PCNU FILTER
  const fetchOps = async () => {
    try {
      const [resInc, resRadar, resMyTasks] = await Promise.all([
        api.get('/api/incidents'),
        axios.get('https://api.rainviewer.com/public/weather-maps.json'),
        api.get(`/api/volunteers/${user.id}/task`) // Data tugas saya
      ]);
      
      const filtered = resInc.data.filter(i => i.region === user.region || i.priority_level === 'CRITICAL');
      setData(filtered);
      setIsOffline(false);
      localStorage.setItem(`cache_ops_${user.region}`, JSON.stringify(filtered));
      if (resRadar.data.radar.past.length > 0) setRadarTime(resRadar.data.radar.past.pop().time);
    } catch (e) {
      setIsOffline(true);
      const cached = localStorage.getItem(`cache_ops_${user.region}`);
      if (cached) setData(JSON.parse(cached));
    }
  };

  useEffect(() => {
    fetchOps();
    const interval = setInterval(fetchOps, 30000);
    return () => clearInterval(interval);
  }, [user.region]);

  // 2. LIVE GPS TRACKING
  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition((pos) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLocation(coords);
      setGpsActive(true);
      api.patch(`/api/inventory/volunteers/${user.id}/ping`, coords).catch(() => {});
    }, () => setGpsActive(false), { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [user.id]);

  // 3. LOGIKA AMBIL KESEDIAAN (APPLY DUTY)
  const handleApplyDuty = async () => {
    if (!availability.from || !availability.until) return alert("Pilih rentang waktu kesediaan Anda!");
    try {
      await api.post('/api/volunteers/apply', {
        volunteer_id: user.id,
        incident_id: targetIncident.id,
        available_from: availability.from,
        available_until: availability.until,
        note: "Siap diterjunkan"
      });
      alert("Kesediaan dikirim! Menunggu Approval PCNU/PWNU.");
      setShowDutyForm(false);
      fetchOps();
    } catch (e) { alert("Gagal mengirim aplikasi tugas"); }
  };

  const stats = useMemo(() => ({
    aktif: data.filter(i => i.status !== 'completed').length,
    critical: data.filter(i => i.priority_level === 'CRITICAL').length,
    jiwa: data.reduce((acc, curr) => acc + (parseInt(curr.dampak_manusia?.terdampak) || 0), 0)
  }), [data]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans overflow-x-hidden pb-32">
      
      {/* HEADER TACTICAL */}
      <nav className="bg-[#006432] p-4 pt-12 border-b-4 border-[#c5a059] flex justify-between items-center shadow-xl sticky top-0 z-[1001]">
        <div className="flex items-center gap-3">
          <img src="https://pwnu-jateng.org/uploads/infoumum/20250825111304-2025-08-25infoumum111252.png" className="h-8 border border-white/20 rounded-full" alt="logo" />
          <div className="leading-none">
            <h1 className="text-sm font-black uppercase italic text-white leading-none">TRC {user.region}</h1>
            <p className="text-[8px] font-bold text-green-200 uppercase tracking-widest mt-1">{user.full_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           {isOffline && <i className="fas fa-wifi-slash text-red-400 text-xs animate-pulse"></i>}
           <div className={`w-2.5 h-2.5 rounded-full ${gpsActive ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500 animate-ping'}`}></div>
           <i className="fas fa-power-off text-white/30 ml-2" onClick={() => { localStorage.clear(); window.location.reload(); }}></i>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        
        {/* KPI BENTO GRID */}
        <div className="grid grid-cols-4 gap-2">
           <KPIBox label="Misi" value={stats.aktif} color="text-red-600" />
           <KPIBox label="Kritis" value={stats.critical} color="text-orange-500" />
           <KPIBox label="Terdampak" value={stats.jiwa} color="text-blue-600" />
           <KPIBox label="Zonasi" value={user.region} color="text-nu-green" isText />
        </div>

        {/* --- URGENT BROADCAST (PENGAMBILAN AKSI MANDIRI) --- */}
        {data.filter(i => i.priority_level === 'CRITICAL' && i.status !== 'completed').map(i => (
          <div key={i.id} className="bg-red-600 p-5 rounded-[30px] text-white shadow-2xl animate-in fade-in slide-in-from-top border-b-4 border-black/20 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-20"><i className="fas fa-exclamation-triangle text-4xl"></i></div>
             <p className="text-[8px] font-black uppercase tracking-widest opacity-70">🚨 Misi Prioritas Tinggi (Open Mission)</p>
             <h3 className="text-lg font-black uppercase italic mt-1 leading-tight">{i.title}</h3>
             <button 
                onClick={() => { setTargetIncident(i); setShowDutyForm(true); }}
                className="mt-4 bg-white text-red-600 px-6 py-2 rounded-full font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all"
             >
                Ambil Kesediaan Tugas
             </button>
          </div>
        ))}

        {/* --- TACTICAL MAP --- */}
        <section className="bg-white rounded-[40px] shadow-2xl border-[10px] border-white h-[350px] relative overflow-hidden">
          <MapContainer center={[location.lat, location.lng]} zoom={12} className="h-full w-full" zoomControl={false}>
            <MapRefresher />
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Tactical"><TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}" /></LayersControl.BaseLayer>
              <LayersControl.Overlay checked name="Radar Hujan">{radarTime && <TileLayer url={`https://tilecache.rainviewer.com/v2/radar/${radarTime}/256/{z}/{x}/{y}/2/1_1.png`} opacity={0.4} />}</LayersControl.Overlay>
            </LayersControl>
{location && location.lat && location.lng && (
            <CircleMarker center={[location.lat, location.lng]} radius={8} pathOptions={{fillColor: '#006432', color: 'white', weight: 3, fillOpacity: 1}} />
)}
            {data.map(inc => {
  // VALIDASI: Cek apakah koordinat tersedia
  const lat = parseFloat(inc.latitude);
  const lng = parseFloat(inc.longitude);

  if (isNaN(lat) || isNaN(lng)) return null; // Jangan render jika koordinat rusak

  return (
    <CircleMarker 
      key={inc.id} 
      center={[lat, lng]} // Gunakan variabel yang sudah di-parse
      radius={12} 
      pathOptions={{ 
        fillColor: inc.priority_level === 'CRITICAL' ? '#ef4444' : '#3b82f6', 
        color: 'white', 
        weight: 4, 
        fillOpacity: 0.85 
      }}
    >
      <Popup className="premium-popup">
         <div className="p-1 font-sans">
            <h4 className="font-black text-nu-green uppercase text-[10px] mb-2">{inc.title}</h4>
            <button onClick={() => window.open(`https://www.google.com/maps?q=${lat},${lng}`)} className="w-full bg-slate-100 py-2 rounded-lg text-[8px] font-black uppercase">Buka Navigasi</button>
         </div>
      </Popup>
    </CircleMarker>
  );
})}
            
          </MapContainer>
        </section>

        {/* --- MISSION MANAGER & FEED --- */}
        <div className="grid grid-cols-1 gap-6">
           <div className="bg-[#006432] p-8 rounded-[45px] shadow-xl text-white h-[400px] flex flex-col overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-5"><i className="fas fa-rss text-9xl"></i></div>
              <h3 className="text-sm font-black uppercase italic mb-6 border-b border-white/10 pb-2">Wilayah Respon: {user.region}</h3>
              <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2 relative z-10">
                 {data.length > 0 ? data.map(inc => (
                    <div key={inc.id} className="relative border-l-2 border-white/20 pl-5 group active:scale-95 transition-all">
                       <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-nu-gold border-4 border-nu-green"></div>
                       <p className="text-[8px] font-bold text-white/50 uppercase">{new Date(inc.updated_at).toLocaleTimeString()}</p>
                       <h4 className="text-xs font-bold uppercase leading-tight">{inc.title}</h4>
                       <div className="flex gap-2 mt-2">
                          <span className="text-[7px] text-nu-gold font-black uppercase bg-white/10 px-2 py-0.5 rounded-full">{inc.status}</span>
                          {inc.priority_level === 'CRITICAL' && <span className="text-[7px] text-white font-black uppercase bg-red-600 px-2 py-0.5 rounded-full animate-pulse">Critical</span>}
                       </div>
                    </div>
                 )) : <p className="text-white/30 italic text-xs text-center py-20 uppercase">Radar Wilayah Clear</p>}
              </div>
           </div>
        </div>

      </main>

      {/* --- FORM KESEDIAAN (MODAL OVERLAY) --- */}
      {showDutyForm && (
        <div className="fixed inset-0 z-[3000] bg-black/60 backdrop-blur-md p-6 flex items-end">
           <div className="w-full bg-white rounded-[40px] shadow-2xl p-8 animate-in slide-in-from-bottom duration-500">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="font-black text-nu-green uppercase italic text-lg tracking-tighter">Atur Jadwal Tugas</h3>
                 <i className="fas fa-times-circle text-slate-300 text-xl" onClick={() => setShowDutyForm(false)}></i>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-6 leading-relaxed">Misi: {targetIncident.title}</p>
              
              <div className="space-y-4">
                 <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Waktu Mulai Bisa Bantu</label>
                    <input type="datetime-local" className="w-full p-4 bg-slate-50 rounded-2xl border-none shadow-inner font-bold text-sm" 
                      onChange={e => setAvailability({...availability, from: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Waktu Harus Selesai</label>
                    <input type="datetime-local" className="w-full p-4 bg-slate-50 rounded-2xl border-none shadow-inner font-bold text-sm" 
                      onChange={e => setAvailability({...availability, until: e.target.value})} />
                 </div>
                 <button onClick={handleApplyDuty} className="w-full bg-nu-green text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl shadow-green-900/20 mt-4 active:scale-95 transition-all">
                    Konfirmasi Siap Terjun
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* FIXED ACTION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/95 backdrop-blur-md border-t flex items-center justify-around z-[2000] px-6 shadow-[0_-10px_25px_rgba(0,0,0,0.05)] pb-safe">
          <NavIcon icon="home" label="Dashboard" active />
          <div className="relative -top-6">
             <button onClick={() => window.location.pathname = '/lapor'} className="w-16 h-16 bg-red-600 rounded-full shadow-2xl flex items-center justify-center text-white border-4 border-white active:scale-90 transition-all shadow-red-200">
                <i className="fas fa-bullhorn text-2xl"></i>
             </button>
             <p className="text-[8px] font-black text-center mt-1 uppercase text-red-600 tracking-widest leading-none">Quick_Report</p>
          </div>
          <NavIcon icon="user-clock" label="Shift Saya" />
      </nav>
    </div>
  );
};

// UI ATOMS
const KPIBox = ({ label, value, color, isText }) => (
  <div className="bg-white p-3 rounded-2xl shadow-md border border-slate-50 text-center flex flex-col justify-center h-20">
    <p className={`${isText ? 'text-[10px]' : 'text-xl'} font-black ${color} leading-none truncate`}>{value}</p>
    <p className="text-[7px] font-black text-slate-400 uppercase mt-1 tracking-tighter">{label}</p>
  </div>
);

const NavIcon = ({ icon, label, active }) => (
  <div className={`flex flex-col items-center gap-1 ${active ? 'text-nu-green' : 'text-slate-300'}`}>
    <i className={`fas fa-${icon} text-xl`}></i>
    <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
  </div>
);

export default RelawanTactical;