import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl, useMap } from 'react-leaflet';
import IntelligencePanel from './IntelligencePanel';
import HeatmapLayer from './HeatmapLayer';
import 'leaflet.heat'; 
import 'leaflet/dist/leaflet.css';

// --- KOMPONEN PENYEMBUH MAP BLANK ---
function MapRefresher() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 500);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

const CommandCenter = ({ incidents = [], onRefresh, onAction, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterKab, setFilterKab] = useState('all');
  const [selectedLocal, setSelectedLocal] = useState(null);

  const kabJateng = ["Semarang", "Demak", "Kudus", "Pati", "Jepara", "Rembang", "Blora", "Grobogan", "Boyolali", "Solo", "Sukoharjo", "Wonogiri", "Karanganyar", "Sragen", "Klaten", "Magelang", "Temanggung", "Wonosobo", "Purworejo", "Kebumen", "Cilacap", "Banyumas", "Purbalingga", "Banjarnegara", "Batang", "Pekalongan", "Pemalang", "Tegal", "Brebes", "Kendal"];

  // --- ENGINE: FILTERING (DIPERKETAT AGAR TIDAK CRASH) ---
  const displayData = incidents.filter(i => {
    // Validasi angka koordinat secara ketat
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
      <MapContainer 
        center={[-7.15, 110.14]} 
        zoom={8} 
        minZoom={7} 
        maxZoom={13} 
        className="h-full w-full z-0" 
        zoomControl={false}
      >
        <MapRefresher />
        <LayersControl position="bottomright">
          <LayersControl.BaseLayer checked name="🌐 Tactical Roadmap">
            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="🛰️ Satellite Ops">
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
          </LayersControl.BaseLayer>
          <LayersControl.Overlay checked name="🔥 Risk Heatmap">
            <HeatmapLayer incidents={incidents} />
          </LayersControl.Overlay>
        </LayersControl>

        {/* RENDER MARKER DENGAN PROTEKSI DOUBLE */}
        {displayData.map(inc => {
          const lat = parseFloat(inc.latitude);
          const lng = parseFloat(inc.longitude);

          return (
            <CircleMarker 
              key={inc._id || inc.id} 
              center={[lat, lng]} 
              radius={inc.priority_level === 'CRITICAL' ? 16 : 10}
              pathOptions={{ 
                  fillColor: inc.status === 'completed' ? '#1e293b' : inc.priority_level === 'CRITICAL' ? '#ef4444' : '#3b82f6', 
                  color: 'white', weight: 3, fillOpacity: 0.9,
                  className: inc.status !== 'completed' ? 'animate-pulse' : ''
              }}
              eventHandlers={{ click: () => setSelectedLocal(inc) }}
            />
          );
        })}
      </MapContainer>

      {/* 3. INTELLIGENCE FEED */}
      <div className="absolute top-20 left-4 z-[1000] w-[260px] pointer-events-none scale-90 md:scale-100 origin-top-left">
         <div className="pointer-events-auto shadow-2xl">
            <IntelligencePanel />
         </div>
      </div>

      {/* 4. MISSION COMMAND DRAWER */}
      {selectedLocal && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[1002] w-[95%] max-w-2xl animate-in slide-in-from-bottom duration-500 pointer-events-none">
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
                 </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                 <CommandBtn icon="file-invoice" label="Assess" onClick={() => { onSelect(selectedLocal); onAction('assess'); }} />
                 <CommandBtn icon="signature" label="Instruksi" onClick={() => { onSelect(selectedLocal); onAction('instruksi'); }} />
                 <CommandBtn icon="hand-holding-heart" label="Action" onClick={() => { onSelect(selectedLocal); onAction('action'); }} />
                 <CommandBtn icon="file-pdf" label="SITREP" onClick={() => {}} color="bg-red-600" />
              </div>
           </div>
        </div>
      )}

      {/* 5. OPS METRICS */}
      <div className="absolute top-20 right-4 z-[1000] w-40 pointer-events-none scale-90 md:scale-100 origin-top-right">
         <div className="bg-white/80 backdrop-blur-md p-4 rounded-[30px] shadow-2xl border border-white pointer-events-auto">
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