import React from 'react';

const LogFooter = ({ logs = [] }) => {
  // PENGAMAN: Pastikan logs selalu berupa Array
  const safeLogs = Array.isArray(logs) ? logs : [];

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-8 bg-slate-900 text-white flex items-center px-6 justify-between z-[9999] border-t border-white/10">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span className="text-[10px] font-black uppercase tracking-widest">System Live</span>
        </div>
        <div className="h-4 w-[1px] bg-white/10"></div>
        <div className="flex items-center gap-2 text-white/50">
          <i className="fas fa-history text-[10px]"></i>
          {/* GUNAKAN safeLogs AGAR TIDAK ERROR LENGTH */}
          <span className="text-[9px] font-bold uppercase">{safeLogs.length} Aktivitas Tercatat</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-tighter text-white/40">
        <span>PWNU Jateng Pusdatin v2.0</span>
        <span className="text-white/10">|</span>
        <span>{new Date().toLocaleDateString('id-ID')}</span>
      </div>
    </footer>
  );
};

export default LogFooter;