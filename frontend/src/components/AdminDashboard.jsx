import React, { useState, useEffect, useCallback, useMemo } from 'react';
import AppHeader from './layout/AppHeader';
import AdminSidebar from './layout/AdminSidebar';
import CommandCenter from './CommandCenter';
import CompleteView from './CompleteView';
import InventoryCommand from './InventoryCommand';
import ShelterManagement from './ShelterManagement';
import AssetManagement from './AssetManagement';
import BuildingAssessment from './BuildingAssessment';
import ChatView from './ChatView';
import AnalyticsDashboard from './AnalyticsDashboard';
import NotificationPanel from './NotificationPanel';
import NewsTicker from './NewsTicker';
import LogFooter from './LogFooter';
import Assessment from './Assessment';
import InstructionView from './InstructionView';
import ActionView from './ActionView';
import DisasterTrendAnalyzer from './DisasterTrendAnalyzer';
import AuditLogView from './AuditLogView';
import VolunteerManagement from './VolunteerManagement';
import VolunteerMissionDashboard from './VolunteerMissionDashboard';
import Card from './ui/Card';
import Badge, { statusToBadge } from './ui/Badge';
import api from '../services/api';
import {
  Map, ListChecks, ChevronRight, AlertTriangle,
  Users, Package, Activity, BarChart2
} from 'lucide-react';

// ─── Menu items definition ─────────────────────────────────────────────────
const buildMenuItems = (userRole = '') => {
  const role = userRole.toUpperCase();
  const base = [
    { id: 'dashboard',        label: 'Home' },
    { id: 'command',          label: 'HUD' },
    { id: 'manager',          label: 'Mission' },
    { id: 'inventori',        label: 'Inventori' },
    { id: 'assets',           label: 'Assets' },
    { id: 'buildings',        label: 'Buildings' },
    { id: 'posko',            label: 'Posko' },
    { id: 'volunteer-mgmt',   label: 'Relawan' },
    { id: 'volunteer-mission',label: 'Misi Saya' },
    { id: 'chat',             label: 'Chat' },
    { id: 'analytics',        label: 'Analytics' },
    { id: 'notifications',    label: 'Notif' },
    { id: 'trends',           label: 'Trends' },
  ];
  if (['SUPER_ADMIN', 'ADMIN_PWNU'].includes(role)) {
    base.push({ id: 'audit-logs', label: 'Audit' });
  }
  return base;
};

// ─── Dashboard Home ────────────────────────────────────────────────────────
const DashboardHome = ({ incidents = [], user, onNavigate }) => {
  const stats = useMemo(() => ({
    total:    incidents.length,
    active:   incidents.filter(i => !['COMPLETED', 'CLOSED'].includes(i.status?.toUpperCase())).length,
    critical: incidents.filter(i => i.priority_level === 'CRITICAL').length,
    affected: incidents.reduce((a, b) => a + (parseInt(b.affected_people) || 0), 0),
  }), [incidents]);

  const statCards = [
    { label: 'Total Kejadian', value: stats.total,    color: 'text-slate-800',   bg: 'bg-slate-50',   Icon: Activity },
    { label: 'Misi Aktif',     value: stats.active,   color: 'text-red-600',     bg: 'bg-red-50',     Icon: AlertTriangle },
    { label: 'Kritis',         value: stats.critical, color: 'text-orange-600',  bg: 'bg-orange-50',  Icon: AlertTriangle },
    { label: 'Jiwa Terdampak', value: stats.affected, color: 'text-blue-600',    bg: 'bg-blue-50',    Icon: Users },
  ];

  const quickActions = [
    { label: 'Map HUD',        tab: 'command',   primary: true },
    { label: 'Mission Manager',tab: 'manager',   primary: false },
    { label: 'Shelter Manager',tab: 'posko',     primary: false },
    { label: 'Inventory',      tab: 'inventori', primary: false },
    { label: 'Trend Analyzer', tab: 'trends',    primary: false },
    ...(['SUPER_ADMIN', 'ADMIN_PWNU'].includes(user?.role?.toUpperCase())
      ? [{ label: 'Audit System Logs', tab: 'audit-logs', info: true }]
      : []
    ),
  ];

  return (
    <div className="p-5 md:p-8 space-y-6 animate-fade-in">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-[#006432] uppercase tracking-tight">Strategic Dashboard</h2>
          <p className="text-xs text-slate-400 mt-0.5">Real-time operational overview</p>
        </div>
        <button
          onClick={() => onNavigate('command')}
          className="flex items-center gap-2 text-xs font-semibold text-[#006432] hover:underline"
        >
          <Map size={14} />
          Open Map HUD
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ label, value, color, bg, Icon }) => (
          <Card key={label} className="p-5 flex flex-col items-center text-center gap-2">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon size={18} className={color} />
            </div>
            <p className={`text-2xl font-black ${color} leading-none`}>{value}</p>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
          </Card>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Recent incidents */}
        <div className="md:col-span-2">
          <Card>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700">Kejadian Terbaru</h3>
              <button onClick={() => onNavigate('manager')} className="flex items-center gap-1 text-xs text-[#006432] font-semibold hover:underline">
                Lihat Semua <ChevronRight size={12} />
              </button>
            </div>
            <div className="p-3 space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
              {incidents.length === 0 && (
                <p className="text-slate-400 text-xs text-center py-8">Tidak ada data kejadian</p>
              )}
              {incidents.slice(0, 10).map((inc, idx) => (
                <div
                  key={inc.id || idx}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-white hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => onNavigate('manager')}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {inc.disaster_type} — {inc.location}
                    </p>
                    <p className="text-[10px] text-slate-400 uppercase mt-0.5">{inc.region}</p>
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    <Badge label={inc.status || 'Reported'} variant={statusToBadge(inc.status)} />
                    <ChevronRight size={14} className="text-slate-300" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Quick actions */}
        <div>
          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-700 mb-1">Quick Actions</h3>
            {quickActions.map(({ label, tab, primary, info }) => (
              <button
                key={tab}
                onClick={() => onNavigate(tab)}
                className={`w-full px-4 py-3 rounded-xl text-xs font-bold uppercase text-left transition-all hover:scale-[1.01] active:scale-[0.99]
                  ${primary
                    ? 'bg-[#006432] text-white shadow-sm hover:bg-[#005028]'
                    : info
                    ? 'bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }
                `}
              >
                {label}
              </button>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
};

// ─── Admin Dashboard ───────────────────────────────────────────────────────
const AdminDashboard = ({ user, onLogout, isOnline = true }) => {
  const [activeTab, setActiveTab]   = useState('dashboard');
  const [incidents, setIncidents]   = useState([]);
  const [workspace, setWorkspace]   = useState({ mode: null, incident: null });

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await api.get('incidents');
      setIncidents(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Gagal sinkronisasi data insiden', e);
    }
  }, []);

  useEffect(() => { fetchIncidents(); }, [fetchIncidents]);

  const handleAction = (mode, incident) => setWorkspace({ mode, incident });

  const closeWorkspace = () => {
    setWorkspace({ mode: null, incident: null });
    setTimeout(fetchIncidents, 500);
  };

  // RBAC filter
  const incidentsToDisplay = useMemo(() => {
    const role = user?.role?.toUpperCase();
    if (['PWNU', 'SUPER_ADMIN', 'ADMIN_PWNU', 'COMMANDER', 'STAFF_PWNU'].includes(role)) return incidents;
    const userReg = String(user?.region).toLowerCase();
    return incidents.filter(i =>
      String(i.region).toLowerCase() === userReg ||
      i.priority_level === 'CRITICAL' ||
      i.status === 'REPORTED'
    );
  }, [incidents, user]);

  const menuItems = useMemo(() => buildMenuItems(user?.role), [user?.role]);

  // Mobile bottom nav items (subset)
  const mobileNavItems = menuItems.slice(0, 5);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#f8fafc] overflow-hidden">
      {/* Header */}
      <AppHeader user={user} onLogout={onLogout} isOnline={isOnline} />

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <AdminSidebar
          activeTab={activeTab}
          onNavigate={setActiveTab}
          menuItems={menuItems}
        />

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden bg-white relative">
          <NewsTicker />
          <div className="flex-1 overflow-y-auto custom-scrollbar pb-8">
            {activeTab === 'dashboard'         && <DashboardHome incidents={incidentsToDisplay} user={user} onNavigate={setActiveTab} />}
            {activeTab === 'command'           && <CommandCenter incidents={incidentsToDisplay} onAction={handleAction} />}
            {activeTab === 'manager'           && <CompleteView incidents={incidentsToDisplay} user={user} onRefresh={fetchIncidents} onAction={handleAction} />}
            {activeTab === 'inventori'         && <InventoryCommand onBack={() => setActiveTab('dashboard')} userData={user} />}
            {activeTab === 'assets'            && <AssetManagement user={user} onBack={() => setActiveTab('dashboard')} />}
            {activeTab === 'buildings'         && <BuildingAssessment user={user} onBack={() => setActiveTab('dashboard')} />}
            {activeTab === 'posko'             && <ShelterManagement incidents={incidentsToDisplay} userData={user} onBack={() => setActiveTab('dashboard')} />}
            {activeTab === 'chat'              && <ChatView user={user} onClose={() => setActiveTab('dashboard')} />}
            {activeTab === 'analytics'         && <AnalyticsDashboard onBack={() => setActiveTab('dashboard')} />}
            {activeTab === 'notifications'     && <NotificationPanel user={user} onClose={() => setActiveTab('dashboard')} />}
            {activeTab === 'trends'            && <DisasterTrendAnalyzer user={user} onBack={() => setActiveTab('dashboard')} />}
            {activeTab === 'volunteer-mgmt'    && <VolunteerManagement onBack={() => setActiveTab('dashboard')} />}
            {activeTab === 'volunteer-mission' && <VolunteerMissionDashboard user={user} onBack={() => setActiveTab('dashboard')} />}
            {activeTab === 'audit-logs'        && <AuditLogView user={user} onBack={() => setActiveTab('dashboard')} />}
          </div>
        </main>
      </div>



      {/* Workspace overlay (Assessment, Instruction, Action) */}
      {workspace.mode && workspace.incident && (
        <div className="fixed inset-0 z-[6000] bg-white flex flex-col animate-in">
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {workspace.mode === 'assess'    && <Assessment incident={workspace.incident} onBack={closeWorkspace} />}
            {workspace.mode === 'instruksi' && <InstructionView incident={workspace.incident} onSync={closeWorkspace} />}
            {workspace.mode === 'action'    && <ActionView incident={workspace.incident} onComplete={closeWorkspace} />}
          </div>
        </div>
      )}

      <LogFooter />
    </div>
  );
};

export default AdminDashboard;