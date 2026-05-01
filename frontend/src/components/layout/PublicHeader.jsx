import React from 'react';
import { ShieldCheck, LogIn } from 'lucide-react';

/**
 * PublicHeader — header untuk public dashboard
 * Props: onOpenLogin
 */
const PublicHeader = ({ onOpenLogin }) => {
  return (
    <header className="h-14 bg-[#006432] px-4 md:px-6 flex items-center justify-between shrink-0 shadow-lg z-50">
      {/* Branding */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
          <ShieldCheck size={18} className="text-white/80" />
        </div>
        <div className="flex flex-col leading-none">
          <h1 className="font-black text-white text-sm tracking-tight">
            PUSDATIN <span className="text-white/50 font-normal text-xs">NU</span>
          </h1>
          <p className="text-[9px] text-white/40 font-semibold uppercase tracking-widest">
            Pelayanan Darurat Tanggap
          </p>
        </div>
      </div>

      {/* Login Button */}
      {onOpenLogin && (
        <button
          onClick={onOpenLogin}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition-all duration-200 border border-white/20"
        >
          <LogIn size={14} />
          <span>Login</span>
        </button>
      )}
    </header>
  );
};

export default PublicHeader;
