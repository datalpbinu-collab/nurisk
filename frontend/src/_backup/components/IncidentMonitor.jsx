import React, { useState } from 'react';

const IncidentMonitor = ({ incidents, statusColors, onSelect }) => {
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const steps = ['reported', 'verified', 'assessment', 'commanded', 'responded', 'completed'];

  const filtered = incidents.filter(inc => {
    const matchStatus = filterStatus === 'all' || inc.status === filterStatus;
    const matchSearch = inc.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        inc.region.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="p-8 bg-[#f8fafc] h-full overflow-y-auto font-sans">
      <div className="flex justify-between items-end mb-8 border-b-2 border-green-50 pb-6">
        <div>
          <h2 className="text-2xl font-black text-nu-green uppercase italic tracking-tighter">Strategic Mission Tracker</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Monitoring Seluruh Siklus Penanganan Bencana</p>
        </div>
        
        {/* FILTER BOX */}
        <div className="flex gap-4">
          <input 
            type="text" 
            placeholder="Cari Wilayah / Judul..." 
            className="p-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold w-64 shadow-sm focus:ring-2 ring-nu-green outline-none"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select 
            className="p-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold shadow-sm text-nu-green outline-none"
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Semua Status</option>
            {steps.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>
        </div>
      </div>

      {/* MISSION GRID */}
      <div className="grid grid-cols-1 gap-6">
        {filtered.map(inc => {
          const currentIndex = steps.indexOf(inc.status);
          const progressPercent = ((currentIndex + 1) / steps.length) * 100;

          return (
            <div 
              key={inc.id} 
              onClick={() => onSelect(inc)}
              className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-xl hover:shadow-2xl hover:border-nu-green transition-all cursor-pointer group relative overflow-hidden"
            >
              {/* Prioritas AI Tag */}
              <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-[20px] font-black text-[9px] uppercase text-white ${inc.priority_level === 'CRITICAL' ? 'bg-red-600 animate-pulse' : 'bg-nu-green'}`}>
                Priority: {inc.priority_level || 'LOW'}
              </div>

              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                    {inc.incident_code || 'TAC-PENDING'} • {new Date(inc.created_at).toLocaleDateString()}
                  </span>
                  <h3 className="text-xl font-black text-slate-800 uppercase italic mt-1 group-hover:text-nu-green transition-colors">{inc.title}</h3>
                  <p className="text-xs font-bold text-slate-500 uppercase">{inc.disaster_type} — {inc.region}</p>
                </div>
                <div className="text-right mr-20">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Score</p>
                    <p className="text-2xl font-black text-slate-800 leading-none">{inc.priority_score || 0}</p>
                </div>
              </div>

              {/* VISUAL LIFE CYCLE PROGRESS */}
              <div className="space-y-3">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-[10px] font-black text-nu-green uppercase tracking-widest">Life Cycle Progress</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Step {currentIndex + 1} of 6</p>
                </div>
                
                {/* Progress Bar Background */}
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex p-0.5 border border-slate-50">
                  <div 
                    className="h-full bg-nu-green rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(0,100,50,0.3)]"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>

                {/* Step Labels */}
                <div className="flex justify-between px-1">
                  {steps.map((s, i) => (
                    <div key={s} className="flex flex-col items-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${i <= currentIndex ? 'bg-nu-green shadow-[0_0_8px_#006432]' : 'bg-slate-200'}`}></div>
                       <span className={`text-[8px] font-black uppercase tracking-tighter ${i <= currentIndex ? 'text-nu-green' : 'text-slate-300'}`}>
                          {s}
                       </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="py-20 text-center text-slate-300 italic uppercase font-black text-sm tracking-widest">
             Tidak ada misi yang ditemukan dalam database
          </div>
        )}
      </div>
    </div>
  );
};

export default IncidentMonitor;