import React from 'react';
import { Activity, Clock } from 'lucide-react';

const LogFooter = ({ logs = [] }) => {
  const safeLogs = Array.isArray(logs) ? logs : [];

  return (
    <footer className="h-8 bg-slate-900 text-white flex items-center px-4 md:px-6 justify-between z-[9999] border-t border-white/5 shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/70">System Live</span>
        </div>
        <div className="h-3 w-px bg-white/10" />
        <div className="flex items-center gap-1.5 text-white/40">
          <Clock size={10} />
          <span className="text-[9px] font-semibold">{safeLogs.length} Aktivitas Tercatat</span>
        </div>
      </div>
      <div className="flex items-center gap-3 text-[9px] font-semibold uppercase tracking-wider text-white/30">
        <span>PWNU Jateng Pusdatin v2.0</span>
        <span className="text-white/10">|</span>
        <span>{new Date().toLocaleDateString('id-ID')}</span>
      </div>
    </footer>
  );
};

export default LogFooter;