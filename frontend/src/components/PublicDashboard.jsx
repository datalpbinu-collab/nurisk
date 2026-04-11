import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import api from '../services/api';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- SUB-KOMPONEN: LIFE CYCLE DOTS (PRD TAHAP 3) ---
const LifeCycleStatus = ({ currentStatus }) => {
  const stages = ['REPORTED', 'VERIFIED', 'ASSESSMENT', 'COMMANDED', 'RESPONDED', 'COMPLETED'];
  const currentIndex = stages.indexOf(currentStatus?.toUpperCase() || 'REPORTED');
  return (
    <div className="flex items-center gap-1 mt-2">
      {stages.map((s, i) => (
        <div key={i} className={`h-1.5 w-full rounded-full ${i <= currentIndex ? 'bg-green-600 shadow-[0_0_5px_rgba(22,163,74,0.5)]' : 'bg-slate-200'}`} title={s} />
      ))}
    </div>
  );
};

// --- SUB-KOMPONEN: GAP ANALYSIS GAUGE (PRD HAL 4) ---
const NeedsDistributionGauge = ({ needs = [], distribution = [] }) => {
  const totalNeeds = needs.reduce((acc, curr) => acc + (parseInt(curr.qty) || 0), 0) || 100; // Default 100 if empty
  const totalDist = distribution.reduce((acc, curr) => acc + (parseInt(curr.qty) || 0), 0) || 0;
  const percent = Math.min(Math.round((totalDist / totalNeeds) * 100), 100);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[9px] font-black uppercase tracking-tighter">
        <span className="text-slate-400">Penyaluran Bantuan</span>
        <span className={percent >= 100 ? 'text-green-600' : 'text-orange-600'}>{percent}% Terpenuhi</span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-50">
        <div className="h-full bg-gradient-to-r from-orange-400 to-green-500 transition-all duration-1000" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

const PublicDashboard = ({ incidents = [], onOpenLogin }) => {
  const [data, setData] = useState(Array.isArray(incidents) ? incidents : []);
  const [news, setNews] = useState([]);
  const [inventory, setInventory] = useState([]);

  // Fetch Data Sesuai PRD (Transparency & Scraper)
  useEffect(() => {
    const fetchPublicData = async () => {
      try {
        const [resInc, resInv, resNews] = await Promise.all([
          api.get('incidents/public').catch(() => ({ data: [] })),
          api.get('inventory').catch(() => ({ data: [] })),
          api.get('news').catch(() => ({ data: [] }))
        ]);
        setData(Array.isArray(resInc.data) ? resInc.data : []);
        setInventory(Array.isArray(resInv.data) ? resInv.data : []);
        setNews(Array.isArray(resNews.data) ? resNews.data : []);
      } catch (e) { console.error("Sync Error"); }
    };
    fetchPublicData();
  }, [incidents]);

  // Integrated SITREP PDF (PRD Hal 4)
  const downloadSITREP = (item) => {
    const doc = new jsPDF();
    doc.setFillColor(0, 100, 50); doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255); doc.setFontSize(16).text("PUBLIC SITUATION REPORT (SITREP)", 105, 15, { align: 'center' });
    doc.setFontSize(10).text("Data Terverifikasi Pusdatin NU Peduli Jawa Tengah", 105, 22, { align: 'center' });
    autoTable(doc, {
      startY: 40, theme: 'grid',
      head: [['Parameter', 'Detail Informasi']],
      body: [
        ['Kejadian', item.title], ['Wilayah', item.region], ['Status Akhir', item.status],
        ['Waktu Laporan', new Date(item.createdAt).toLocaleString('id-ID')],
        ['AI Severity Score', item.priority_score || 'Calculating...']
      ],
      headStyles: { fillColor: [197, 160, 89] }
    });
    doc.save(`SITREP_${item.region}_${item.id}.pdf`);
  };

  return (
    <div className="flex flex-col h-screen bg-[#f1f5f9] text-slate-900 overflow-hidden font-sans">
      
      {/* HEADER: Modern NU Style */}
      <header className="h-14 bg-white/80 backdrop-blur-md border-b flex items-center px-6 justify-between z-[5000] shadow-sm sticky top-0">
        <div className="flex items-center gap-3">
          <img src="https://pwnu-jateng.org/uploads/infoumum/20250825111304-2025-08-25infoumum111252.png" className="h-8" alt="logo" />
          <div className="flex flex-col">
            <h1 className="text-[10px] md:text-sm font-black text-[#006432] uppercase tracking-tighter italic leading-none">Integrated Command Center</h1>
            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">NU Peduli Jawa Tengah</p>
          </div>
        </div>
        <button onClick={onOpenLogin} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-[#006432] transition-all">
          <i className="fas fa-user-shield text-lg"></i>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-6 pb-32">
        
        {/* KPI BOXES: Situational Awareness */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
           <KPIBox label="Total Kejadian" value={data?.length || 0} color="text-slate-800" icon="clipboard-list" />
           <KPIBox label="Misi Aktif" value={data?.filter(i => i.status !== 'COMPLETED').length || 0} color="text-red-600" icon="bullhorn" />
           <KPIBox label="Relawan Siaga" value="1,242" color="text-green-600" icon="user-shield" />
           <KPIBox label="Aset Armada" value="24 Unit" color="text-[#c5a059]" icon="truck-moving" />
        </div>

        {/* TACTICAL HUD MAP (PRD Hal 1) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
           <div className="lg:col-span-8 h-[400px] md:h-[550px] bg-white rounded-[40px] border-[10px] border-white shadow-2xl relative overflow-hidden">
              <MapContainer center={[-7.15, 110.14]} zoom={8} className="h-full w-full" zoomControl={false}>
                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}" />
                <ZoomControl position="bottomright" />
                {data.map((inc) => {
                  const lat = parseFloat(inc.latitude);
                  const lng = parseFloat(inc.longitude);
                  if (isNaN(lat) || isNaN(lng)) return null;
                  const isCritical = inc.priority_score > 1000 || inc.priority_level === 'CRITICAL';
                  return (
                    <CircleMarker 
                      key={inc.id || Math.random()} 
                      center={[lat, lng]} 
                      radius={isCritical ? 14 : 10} 
                      pathOptions={{ 
                        fillColor: inc.status === 'COMPLETED' ? '#1e293b' : '#ef4444', 
                        color: 'white', weight: 3, fillOpacity: 0.8,
                        className: isCritical ? 'animate-pulse' : '' 
                      }}
                    >
                      <Popup className="premium-popup">
                         <div className="w-64 p-2 font-sans">
                            <h4 className="font-black text-[#006432] uppercase italic text-xs border-b pb-2 mb-2">{inc.title}</h4>
                            <div className="bg-slate-50 p-3 rounded-2xl text-[10px] italic border mb-4">"{inc.kondisi_mutakhir || "Laporan terverifikasi sistem."}"</div>
                            <button onClick={() => downloadSITREP(inc)} className="w-full bg-[#c5a059] text-white py-2 rounded-xl text-[8px] font-black uppercase shadow-md mb-2">Unduh Sitrep PDF</button>
                            <LifeCycleStatus currentStatus={inc.status} />
                         </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
           </div>
           
           {/* MISSION PROGRESS FEED (PRD PILAR 2) */}
           <div className="lg:col-span-4 bg-[#006432] rounded-[3rem] p-8 text-white h-[400px] md:h-[550px] flex flex-col shadow-2xl relative border-t-[12px] border-[#c5a059] overflow-hidden">
              <h3 className="font-black uppercase italic border-b border-white/20 pb-4 text-xs mb-6 flex items-center gap-3">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                Mission Progress Feed
              </h3>
              <div className="flex-1 overflow-y-auto space-y-8 custom-scrollbar pr-2">
                {data.length > 0 ? data.map((inc) => (
                  <div key={inc.id || Math.random()} className="relative pl-6 border-l border-white/10 pb-2 group">
                     <div className="absolute -left-[4.5px] top-0 w-2 h-2 rounded-full bg-[#c5a059] shadow-[0_0_10px_#c5a059]"></div>
                     <p className="text-[9px] font-bold text-white/40 uppercase leading-none mb-1">
                       {inc.createdAt ? new Date(inc.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '--:--'}
                     </p>
                     <h4 className="text-xs font-bold leading-tight group-hover:text-[#c5a059] transition-colors">{inc.title}</h4>
                     <div className="flex items-center gap-2 mt-2">
                        <span className="text-[7px] font-black bg-white/10 px-2 py-0.5 rounded-full uppercase">{inc.status}</span>
                        <span className="text-[7px] text-white/30 italic font-bold">{inc.region}</span>
                     </div>
                  </div>
                )) : <div className="text-center py-20 text-white/20 font-black text-[10px] uppercase">Radar Wilayah Clear</div>}
              </div>
           </div>
        </div>

        {/* BOTTOM SECTION: News & Gap Analysis (PRD HAL 4) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {/* AI NEWS SCRAPER */}
           <div className="bg-white p-8 rounded-[40px] border-t-[12px] border-red-600 shadow-xl h-[450px] flex flex-col overflow-hidden">
              <h3 className="font-black text-slate-800 uppercase italic border-b pb-4 text-xs mb-6 tracking-tighter">AI Intelligence Scraper & EWS</h3>
              <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
                {news.length > 0 ? news.map((n) => (
                  <div key={n.id} className="p-4 bg-slate-50 rounded-[2rem] border border-slate-100 hover:border-[#c5a059] transition-all cursor-default">
                    <span className="text-[7px] font-black px-2 py-1 bg-red-100 text-red-700 rounded-lg uppercase">{n.category || 'SCRAPER'}</span>
                    <h4 className="text-xs font-bold mt-2 leading-tight text-slate-700">{n.title}</h4>
                    <p className="text-[8px] text-slate-400 mt-2 uppercase font-black">{n.source} • {n.date ? new Date(n.date).toLocaleDateString() : ''}</p>
                  </div>
                )) : <div className="text-center py-20 text-slate-300 font-black text-[10px] uppercase animate-pulse">Scanning Media...</div>}
              </div>
           </div>

           {/* GAP ANALYSIS */}
           <div className="bg-white p-8 rounded-[40px] border-t-[12px] border-[#c5a059] shadow-xl h-[450px] flex flex-col">
              <h3 className="font-black text-slate-800 uppercase italic mb-8 text-xs border-b pb-4 tracking-tighter">Gap Analysis Bantuan (Needs vs Dist)</h3>
              <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2">
                {data.filter(i => i.status !== 'COMPLETED').slice(0, 4).map((inc) => (
                   <div key={inc.id || Math.random()} className="p-5 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                      <h4 className="text-[10px] font-black text-slate-700 uppercase mb-3 truncate">{inc.title}</h4>
                      <NeedsDistributionGauge needs={inc.needs} distribution={inc.distribution} />
                   </div>
                ))}
              </div>
              <button className="w-full bg-[#006432] text-white font-black py-4 rounded-3xl text-[10px] uppercase shadow-xl mt-6 active:scale-95 transition-all">Sinergi Donasi LAZISNU</button>
           </div>
        </div>
      </main>

      {/* FIXED NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t flex items-center justify-around z-[5000] shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
        <NavBtn icon="home" label="Dashboard" active />
        <div className="relative -top-5">
           <button onClick={() => window.location.href='/lapor'} className="w-16 h-16 bg-red-600 rounded-full shadow-2xl flex items-center justify-center text-white border-4 border-white active:scale-90 transition-all shadow-red-200">
             <i className="fas fa-bullhorn text-xl"></i>
           </button>
           <p className="text-[8px] font-black text-center mt-1 uppercase text-red-600 tracking-tighter">Lapor Cepat</p>
        </div>
        <NavBtn icon="user-circle" label="Akses Admin" onClick={onOpenLogin} />
      </nav>
    </div>
  );
};

// UI ATOMS
const KPIBox = ({ label, value, color, icon }) => (
  <div className="bg-white p-5 rounded-[30px] shadow-lg flex flex-col items-center justify-center text-center group border border-slate-50">
    <div className="w-10 h-10 rounded-2xl mb-2 flex items-center justify-center bg-slate-50 group-hover:bg-[#006432]/10 transition-colors">
      <i className={`fas fa-${icon} ${color} text-xs`}></i>
    </div>
    <p className={`text-xl font-black ${color} tracking-tighter leading-none`}>{value}</p>
    <p className="text-[8px] font-black text-slate-400 uppercase mt-2 tracking-widest">{label}</p>
  </div>
);

const NavBtn = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 flex-1 ${active ? 'text-[#006432]' : 'text-slate-300'}`}>
    <i className={`fas fa-${icon} text-lg`}></i>
    <span className="text-[8px] font-black uppercase tracking-widest leading-none">{label}</span>
  </button>
);

export default PublicDashboard;