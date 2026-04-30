import React from 'react';

const Overview = ({ incidents, onNavigate }) => {
  const stats = [
    { id: 'command', label: 'Total Incident', value: incidents.length, color: 'text-blue-500', icon: 'bullhorn' },
    { id: 'manager', label: 'In Assessment', value: incidents.filter(i => i.status === 'assessment').length, color: 'text-yellow-500', icon: 'file-invoice' },
    { id: 'manager', label: 'Active Response', value: incidents.filter(i => i.status === 'responded').length, color: 'text-green-500', icon: 'shipping-fast' },
    { id: 'manager', label: 'Closed/Success', value: incidents.filter(i => i.status === 'completed').length, color: 'text-slate-400', icon: 'check-double' }
  ];

  return (
    <div className="p-8 h-full bg-[#0f172a] overflow-y-auto">
      <h2 className="text-xl font-black text-white italic uppercase mb-8 tracking-widest border-b border-slate-800 pb-2">
        Strategic Overview
      </h2>
      
      {/* WIDGET STATISTIK */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {stats.map(s => (
          <div 
            key={s.label} 
            onClick={() => onNavigate?.(s.id)}
            className="bg-[#1e293b] p-6 rounded-3xl border border-slate-800 shadow-2xl hover:border-green-900 transition-all cursor-pointer"
          >
            <div className="flex justify-between items-center mb-2">
               <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{s.label}</p>
               <i className={`fas fa-${s.icon} text-slate-700 text-xs`}></i>
            </div>
            <p className={`text-5xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* CHART PLACEHOLDER (VISUAL DATA) */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-[#1e293b] p-8 rounded-3xl border border-slate-800 h-80 flex flex-col items-center justify-center text-center">
           <i className="fas fa-chart-pie text-5xl text-slate-800 mb-4"></i>
           <h3 className="text-white font-bold text-xs uppercase opacity-50 italic">Incident Distribution Analysis</h3>
           <p className="text-[10px] text-slate-600 mt-2 font-mono">-- [ ANALYZING GEOSPATIAL DATA PACKETS ] --</p>
        </div>
        <div className="bg-[#1e293b] p-8 rounded-3xl border border-slate-800 h-80 flex flex-col items-center justify-center text-center">
           <i className="fas fa-chart-line text-5xl text-slate-800 mb-4"></i>
           <h3 className="text-white font-bold text-xs uppercase opacity-50 italic">Operational Trend (24h)</h3>
           <p className="text-[10px] text-slate-600 mt-2 font-mono">-- [ WAITING FOR DATA LOGS ] --</p>
        </div>
      </div>
    </div>
  );
};

export default Overview;