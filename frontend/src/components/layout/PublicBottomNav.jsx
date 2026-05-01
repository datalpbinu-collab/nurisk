import React from 'react';
import { Home, Package, TrendingUp, Megaphone } from 'lucide-react';

/**
 * PublicBottomNav — bottom navigation untuk public dashboard (mobile-first)
 * Props: activeTab, onNavigate, onReport
 */
const PublicBottomNav = ({ activeTab, onNavigate, onReport }) => {
  const navItems = [
    { id: 'home', label: 'Home', Icon: Home },
    { id: 'resource', label: 'Resource', Icon: Package },
    { id: 'trends', label: 'Tren', Icon: TrendingUp },
  ];

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] md:w-[480px] h-16 bg-white/95 backdrop-blur-xl border border-slate-200/80 flex items-center justify-around z-[6000] px-4 rounded-2xl shadow-2xl shadow-slate-200/60">
      {/* Home */}
      <NavItem
        id="home"
        label="Home"
        Icon={Home}
        isActive={activeTab === 'home'}
        onClick={() => onNavigate('home')}
      />

      {/* Report Button (Center) */}
      <div className="relative -top-7 md:top-0 md:flex md:items-center">
        <button
          onClick={onReport || (() => (window.location.href = '/lapor'))}
          className="w-16 h-16 md:w-auto md:h-10 md:px-5 md:rounded-xl bg-[#006432] rounded-full shadow-lg md:shadow-none shadow-green-900/30 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 text-white border-4 md:border-0 border-white active:scale-95 transition-all hover:bg-[#005028] group"
        >
          <Megaphone size={20} className="md:w-4 md:h-4 group-hover:scale-110 transition-transform" />
          <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-wider mt-0.5 md:mt-0">Lapor</span>
        </button>
      </div>

      {/* Resource */}
      <NavItem
        id="resource"
        label="Resource"
        Icon={Package}
        isActive={activeTab === 'resource'}
        onClick={() => onNavigate('resource')}
      />

      {/* Tren — hidden on mobile to keep layout balanced, shown md+ */}
      <div className="hidden sm:flex">
        <NavItem
          id="trends"
          label="Tren"
          Icon={TrendingUp}
          isActive={activeTab === 'trends'}
          onClick={() => onNavigate('trends')}
        />
      </div>
    </nav>
  );
};

const NavItem = ({ id, label, Icon, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200
      ${isActive ? 'text-[#006432]' : 'text-slate-400 hover:text-slate-600'}
    `}
  >
    <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
    <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
  </button>
);

export default PublicBottomNav;
