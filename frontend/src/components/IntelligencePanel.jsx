import React from 'react';

const IntelligencePanel = () => {
  return (
    <div className="w-full max-w-sm bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-slate-100 pointer-events-auto animate-in slide-in-from-left duration-700">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-nu-green/10">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
        <h2 className="text-[10px] font-black text-nu-green uppercase tracking-widest leading-none">Intelligence Feed</h2>
      </div>
       
      <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar">
        <SensorItem name="S. Wulan (Demak)" level="710" status="SIAGA 1" color="text-red-600" />
        <SensorItem name="S. Juwana (Pati)" level="450" status="NORMAL" color="text-green-600" />
      </div>
      
      <div className="mt-3 pt-2 border-t border-slate-100">
         <p className="text-[8px] font-bold text-slate-400 uppercase italic">Seismik Regional: Aman</p>
      </div>
    </div>
  );
};

const SensorItem = ({ name, level, status, color }) => (
  <div className="flex justify-between items-end">
    <div>
      <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">{name}</p>
      <p className="text-xl font-black text-slate-800 leading-none">{level} <small className="text-[10px] font-bold">cm</small></p>
    </div>
    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 ${color}`}>{status}</span>
  </div>
);

export default IntelligencePanel;