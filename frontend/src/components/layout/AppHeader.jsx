import React from 'react';
import { LogOut, Wifi, WifiOff } from 'lucide-react';

/**
 * AppHeader — header admin yang reusable
 * Props: user, onLogout, isOnline
 */
const AppHeader = ({ user, onLogout, isOnline = true }) => {
  return (
    <header className="h-14 bg-[#006432] flex items-center px-4 md:px-6 justify-between shrink-0 shadow-lg z-[5000]">
      {/* Branding */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
          <img
            src="https://pwnu-jateng.org/uploads/infoumum/20250825111304-2025-08-25infoumum111252.png"
            className="h-6 w-6 object-contain"
            alt="logo"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
        <div className="flex flex-col leading-none">
          <h1 className="font-black text-white text-xs uppercase tracking-tight">
            PWNU JATENG <span className="text-white/50 font-normal">COMMAND HUB</span>
          </h1>
          <span className="text-[9px] font-semibold uppercase text-white/40 tracking-widest">
            Province Level • Ops Active
          </span>
        </div>
      </div>

      {/* User Info + Actions */}
      <div className="flex items-center gap-3">
        {/* Online Status */}
        <div className="hidden sm:flex items-center gap-1.5">
          {isOnline
            ? <Wifi size={12} className="text-green-300" />
            : <WifiOff size={12} className="text-red-400" />
          }
          <span className="text-[9px] text-white/40 uppercase font-semibold">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-6 w-px bg-white/10" />

        {/* User */}
        {user && (
          <div className="hidden sm:flex flex-col items-end leading-none">
            <p className="font-bold text-white text-xs">{user.full_name}</p>
            <p className="text-[9px] text-white/50 uppercase">
              {user.role} • {user.region}
            </p>
          </div>
        )}

        {/* Avatar */}
        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white font-black text-xs uppercase">
          {user?.full_name?.[0] || 'U'}
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
          title="Logout"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white/70 hover:bg-red-500/80 hover:text-white transition-all duration-200 text-xs font-semibold"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
