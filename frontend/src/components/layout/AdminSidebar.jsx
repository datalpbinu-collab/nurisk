import React from 'react';
import {
  Home, Crosshair, ListChecks, Package, Box, Building2,
  Tent, Users, ClipboardList, MessageSquare, BarChart2,
  Bell, TrendingUp, FileText, ChevronRight
} from 'lucide-react';

/**
 * AdminSidebar — sidebar kiri dengan navigation items
 * Props: activeTab, onNavigate, userRole
 */

const ICON_MAP = {
  dashboard:        Home,
  command:          Crosshair,
  manager:          ListChecks,
  inventori:        Package,
  assets:           Box,
  buildings:        Building2,
  posko:            Tent,
  'volunteer-mgmt': Users,
  'volunteer-mission': ClipboardList,
  chat:             MessageSquare,
  analytics:        BarChart2,
  notifications:    Bell,
  trends:           TrendingUp,
  'audit-logs':     FileText,
};

const AdminSidebar = ({ activeTab, onNavigate, menuItems = [] }) => {
  return (
    <aside className="w-[70px] md:w-[80px] bg-white border-r border-slate-100 flex flex-col items-center py-4 gap-1 shrink-0 z-40 overflow-y-auto custom-scrollbar">
      {menuItems.map(item => {
        const Icon = ICON_MAP[item.id] || Home;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            title={item.label}
            className={`
              relative flex flex-col items-center gap-1.5 w-full py-3 px-2 transition-all duration-200 group
              ${isActive
                ? 'text-[#006432]'
                : 'text-slate-300 hover:text-slate-600'
              }
            `}
          >
            {/* Active indicator */}
            {isActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-[#006432] rounded-r-full" />
            )}
            <div className={`
              w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200
              ${isActive
                ? 'bg-green-50 shadow-sm'
                : 'group-hover:bg-slate-50'
              }
            `}>
              <Icon size={18} />
            </div>
            <span className={`text-[8px] font-bold uppercase tracking-wide leading-none text-center
              ${isActive ? 'text-[#006432]' : 'text-slate-400 group-hover:text-slate-600'}
            `}>
              {item.label}
            </span>
          </button>
        );
      })}
    </aside>
  );
};

export default AdminSidebar;
