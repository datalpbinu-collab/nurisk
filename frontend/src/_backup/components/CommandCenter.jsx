import React, { useState, useEffect, useCallback } from 'react';
import L from 'leaflet';
import MapDisplay from './MapDisplay';
import IntelligencePanel from './IntelligencePanel';
import api from '../services/api';
import 'leaflet/dist/leaflet.css';

// --- 1. CONFIGURATION HELPERS (Penting: Jangan Dihapus) ---

const getIncidentConfig = (type) => {
  const map = { // Using NU Peduli's color palette
    'Banjir': { icon: 'fa-house-flood-water', color: '#3b82f6' }, // Biru
    'Banjir Bandang': { icon: 'fa-cloud-showers-heavy', color: '#1e3a8a' }, // Biru Tua
    'Cuaca Ekstrim': { icon: 'fa-bolt-lightning', color: '#64748b' }, // Abu-abu
    'Gelombang Ekstrim dan Abrasi': { icon: 'fa-water', color: '#0ea5e9' }, // Biru Muda
    'Gempabumi': { icon: 'fa-house-crack', color: '#d97706' }, // Oranye
    'Kebakaran Hutan dan Lahan': { icon: 'fa-fire-flame-curved', color: '#ef4444' }, // Merah
    'Kekeringan': { icon: 'fa-sun-plant-wilt', color: '#fbbf24' }, // Kuning
    'Letusan Gunung Api': { icon: 'fa-volcano', color: '#dc2626' }, // Merah Gelap
    'Tanah Longsor': { icon: 'fa-hill-rockslide', color: '#78350f' }, // Coklat
    'Tsunami': { icon: 'fa-house-tsunami', color: '#1d4ed8' }, // Biru Sangat Tua
    'Likuefaksi': { icon: 'fa-mountain-sun', color: '#4b5563' }, // Abu-abu Gelap
  };
  return map[type] || { icon: 'fa-circle-exclamation', color: '#64748b' }; // Default abu-abu
};

const createTacticalIcon = (type, priority, status) => {
  const config = getIncidentConfig(type); // Get config based on disaster type
  const isCritical = priority === 'CRITICAL'; // Only critical priority triggers pulse
  const statusColor = status === 'COMPLETED' ? '#1e293b' : '#22c55e'; // Green for active, dark for completed

  return L.divIcon({
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        ${isCritical ? `
          <div style="position: absolute; width: 45px; height: 45px; background-color: ${config.color}; border-radius: 50%; opacity: 0.4; animation: pulse 2s infinite;"></div>
        ` : ''}
        <div style="position: relative; width: 36px; height: 36px; background-color: ${config.color}; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
          <i class="fas ${config.icon}" style="font-size: 16px;"></i>
          <div style="position: absolute; bottom: -2px; right: -2px; width: 12px; height: 12px; background-color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid #ddd;">
             <div style="width: 7px; height: 7px; border-radius: 50%; background-color: ${statusColor};"></div>
          </div>
        </div>
      </div>
    `,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
};

const mapDisasterToExpertise = (type) => {
  const t = type?.toLowerCase() || '';
  if (t.includes('banjir')) return 'SAR';
  if (t.includes('gempa') || t.includes('gunung') || t.includes('tsunami')) return 'Medis';
  if (t.includes('kebakaran')) return 'SAR';
  if (t.includes('longsor')) return 'SAR';
  if (t.includes('kekeringan')) return 'Logistik';
  if (t.includes('cuaca ekstrim')) return 'SAR';
  return 'SAR'; // Default to SAR if type is unknown
};


// --- 2. KOMPONEN UTAMA ---

const CommandCenter = ({ incidents = [], onRefresh, onAction, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterKab, setFilterKab] = useState('all');
  const [selectedLocal, setSelectedLocal] = useState(null);
  const [smartDispatch, setSmartDispatch] = useState([]);
  const [loadingDispatch, setLoadingDispatch] = useState(false);

  const fetchSmartDispatch = useCallback(async (incident) => {
    if (!incident?.latitude || !incident?.longitude) return;
    setLoadingDispatch(true);
    try {
      const expertise = mapDisasterToExpertise(incident.disaster_type);
      const res = await api.get(`volunteers/nearby?lat=${incident.latitude}&lng=${incident.longitude}&expertise=${expertise}`);
      setSmartDispatch(res.data?.slice(0, 3) || []);
    } catch (e) {
      console.error("Smart Dispatch Sync Error");
    } finally {
      setLoadingDispatch(false);
    }
  }, []);

  useEffect(() => {
    if (selectedLocal) fetchSmartDispatch(selectedLocal);
    else setSmartDispatch([]);
  }, [selectedLocal, fetchSmartDispatch]);

  const kabJateng = ["Semarang", "Demak", "Kudus", "Pati", "Jepara", "Rembang", "Blora", "Grobogan", "Boyolali", "Solo", "Sukoharjo", "Wonogiri", "Karanganyar", "Sragen", "Klaten", "Magelang", "Temanggung", "Wonosobo", "Purworejo", "Kebumen", "Cilacap", "Banyumas", "Purbalingga", "Banjarnegara", "Batang", "Pekalongan", "Pemalang", "Tegal", "Brebes", "Kendal"];

  const displayData = incidents.filter(i => {
    const lat = parseFloat(i.latitude);
    const lng = parseFloat(i.longitude);
    const hasValidCoords = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    const matchSearch = (i.title || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchKab = filterKab === 'all' || i.region === filterKab;
    return matchSearch && matchKab && hasValidCoords;
  });

  const activeMissions = incidents.filter(i => i.status !== 'completed');

  return (
    <div className="h-full w-full relative bg-[#f8fafc] overflow-hidden font-sans">
      
      {/* 1. TOP TACTICAL TOOLBAR */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1001] w-[95%] max-w-4xl flex gap-2 pointer-events-none">
        <div className="flex-1 bg-white/90 backdrop-blur-md p-2 rounded-2xl shadow-2xl border border-white flex items-center gap-2 pointer-events-auto">
          <i className="fas fa-search ml-3 text-slate-400 text-xs"></i>
          <input 
            type="text" 
            placeholder="Cari kejadian atau kode..." 
            className="bg-transparent border-none outline-none text-xs font-bold w-full p-1"
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
          <select 
            className="bg-slate-50 border-none outline-none text-[10px] font-black text-[#006432] px-3 py-2 rounded-xl"
            onChange={(e) => setFilterKab(e.target.value)}
          >
            <option value="all">SELURUH JATENG</option>
            {kabJateng.sort().map(k => <option key={k} value={k}>{k.toUpperCase()}</option>)}
          </select>
        </div>
      </div>

      {/* 2. MAP THEATER */}
      <MapDisplay incidents={displayData} onSelect={setSelectedLocal} />

      {/* 3. INTELLIGENCE FEED */}
      <div className="absolute top-20 left-4 z-[1000] w-[260px] pointer-events-auto shadow-2xl">
         <IntelligencePanel />
      </div>

      {/* 4. MISSION COMMAND DRAWER */}
      {selectedLocal && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[1002] w-[95%] max-w-2xl animate-in slide-in-from-bottom duration-500">
           <div className="bg-white rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border-t-8 border-[#006432] p-6 pointer-events-auto relative">
              <button onClick={() => setSelectedLocal(null)} className="absolute top-4 right-6 text-slate-300 hover:text-red-500"><i className="fas fa-times-circle text-xl"></i></button>
              
              <div className="flex gap-6 items-start mb-6">
                 <div className={`w-16 h-16 rounded-3xl flex flex-col items-center justify-center text-white shadow-lg ${selectedLocal.priority_score > 500 ? 'bg-red-600' : 'bg-[#006432]'}`}>
                    <span className="text-[8px] font-bold uppercase">Score</span>
                    <span className="text-2xl font-black">{selectedLocal.priority_score || 0}</span>
                 </div>
                 <div className="flex-1">
                    <h3 className="text-lg font-black text-slate-800 uppercase italic leading-none">{selectedLocal.title}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">📍 {selectedLocal.region} • Status: <span className="text-[#006432] font-black">{selectedLocal.status?.toUpperCase()}</span></p>
                    {selectedLocal.has_shelter && (
                      <span className="inline-block mt-2 bg-amber-100 text-amber-700 text-[8px] font-black px-2 py-0.5 rounded-full border border-amber-200 uppercase tracking-widest"><i className="fas fa-tent mr-1"></i> Posko Aktif</span>
                    )}
                 </div>
              </div>

              {/* SMART DISPATCH PANEL */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-[10px] font-black text-[#006432] uppercase tracking-widest flex items-center gap-2">
                    <i className="fas fa-microchip animate-pulse"></i> Smart Dispatch Suggestions
                  </h4>
                  {loadingDispatch && <i className="fas fa-spinner fa-spin text-[#006432] text-xs"></i>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {smartDispatch.map(v => (
                    <div key={v.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 relative overflow-hidden group">
                      <p className="text-[10px] font-black text-slate-800 truncate">{v.full_name}</p>
                      <p className="text-[8px] font-bold text-[#c5a059] uppercase">{v.expertise}</p>
                      <p className="text-[7px] text-slate-400 mt-1 uppercase font-bold italic">{v.distance_km?.toFixed(1) || '?'} KM dari lokasi</p>
                      <i className="fas fa-user-ninja absolute -right-2 -bottom-2 text-3xl opacity-5 group-hover:scale-110 transition-transform"></i>
                    </div>
                  ))}
                  {smartDispatch.length === 0 && !loadingDispatch && <p className="col-span-3 text-center py-4 text-[9px] font-black text-slate-300 uppercase italic">Mencari relawan terdekat...</p>}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                 <CommandBtn icon="file-invoice" label="Assess" onClick={() => onAction('assess', selectedLocal)} />
                 <CommandBtn icon="signature" label="Instruksi" onClick={() => onAction('instruksi', selectedLocal)} />
                 <CommandBtn icon="hand-holding-heart" label="Action" onClick={() => onAction('action', selectedLocal)} />
                 <CommandBtn icon="file-pdf" label="SITREP" onClick={() => {}} color="bg-red-600" />
              </div>
           </div>
        </div>
      )}

      {/* 5. OPS METRICS */}
      <div className="absolute top-20 right-4 z-[1000] w-40 pointer-events-auto">
         <div className="bg-white/80 backdrop-blur-md p-4 rounded-[30px] shadow-2xl border border-white">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b pb-1">Status Ops</h3>
            <div className="flex justify-between items-center text-center">
               <div>
                  <p className="text-xl font-black text-red-600">{activeMissions.length}</p>
                  <p className="text-[7px] font-bold text-slate-400 uppercase">Aktif</p>
               </div>
               <div className="border-l pl-4">
                  <p className="text-xl font-black text-[#006432]">{incidents.length - activeMissions.length}</p>
                  <p className="text-[7px] font-bold text-slate-400 uppercase">Selesai</p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

const CommandBtn = ({ icon, label, onClick, color="bg-[#006432]" }) => (
    <button onClick={onClick} className={`${color} text-white p-3 rounded-2xl flex flex-col items-center gap-1 shadow-lg active:scale-90 transition-all`}>
        <i className={`fas fa-${icon} text-sm`}></i>
        <span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>
    </button>
);

export default CommandCenter;