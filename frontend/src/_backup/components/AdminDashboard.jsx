import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import api from '../services/api';

const AdminDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [incidents, setIncidents] = useState([]);
  const [workspace, setWorkspace] = useState({ mode: null, incident: null });

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await api.get('incidents');
      setIncidents(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Gagal sinkronisasi data insiden");
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const handleAction = (mode, incident) => {
    setWorkspace({ mode, incident });
  };

  const closeWorkspace = () => {
    setWorkspace({ mode: null, incident: null });
    // Gunakan timeout kecil untuk memastikan backend sudah selesai memproses
    setTimeout(() => {
      fetchIncidents();
    }, 500);
  };

  // --- INTEGRASI RBAC: Filter data berdasarkan level user ---
  const incidentsToDisplay = useMemo(() => {
    const role = user?.role?.toUpperCase();
    if (['PWNU', 'SUPER_ADMIN', 'ADMIN_PWNU', 'COMMANDER', 'STAFF_PWNU'].includes(role)) {
      return incidents;
    }
  // Level PCNU (Admin/Staff) hanya melihat wilayahnya, yang KRITIS, atau yang baru dilaporkan (REPORTED)
  const userReg = String(user?.region).toLowerCase();
  return incidents.filter(i => 
    String(i.region).toLowerCase() === userReg || 
    i.priority_level === 'CRITICAL' ||
    i.status === 'REPORTED'
  );
  }, [incidents, user]);

   const menuItems = [
     { id: 'dashboard', icon: 'house', label: 'Home' },
     { id: 'command', icon: 'crosshairs', label: 'HUD' },
     { id: 'manager', icon: 'list-check', label: 'Mission' },
     { id: 'inventori', icon: 'boxes-stacked', label: 'Inventori' },
     { id: 'assets', icon: 'box-open', label: 'Assets' },
     { id: 'buildings', icon: 'building', label: 'Buildings' },
     { id: 'posko', icon: 'tent', label: 'Posko' },
     { id: 'volunteer-mgmt', icon: 'users', label: 'Relawan' },
     { id: 'volunteer-mission', icon: 'clipboard-list', label: 'Misi Saya' },
     { id: 'chat', icon: 'comments', label: 'Chat' },
     { id: 'analytics', icon: 'chart-line', label: 'Analytics' },
     { id: 'notifications', icon: 'bell', label: 'Notif' },
     { id: 'trends', icon: 'chart-area', label: 'Trends' },
     // Menu Audit hanya muncul untuk Level Provinsi/Super
     ...(['SUPER_ADMIN', 'ADMIN_PWNU'].includes(user?.role?.toUpperCase()) 
         ? [{ id: 'audit-logs', icon: 'clipboard-list', label: 'Audit' }] 
         : [])
   ];

  // --- DASHBOARD HOME COMPONENT ---
  const DashboardHome = ({ incidents = [], onNavigate }) => {
    const stats = useMemo(() => ({
      total: incidents.length,
      active: incidents.filter(i => !['COMPLETED','CLOSED'].includes(i.status?.toUpperCase())).length,
      critical: incidents.filter(i => i.priority_level === 'CRITICAL').length,
      affected: incidents.reduce((a, b) => a + (parseInt(b.affected_people) || 0), 0)
    }), [incidents]);

    return (
      <div className="p-4 md:p-8 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-[#006432] uppercase italic">Strategic Dashboard</h2>
          <button onClick={() => onNavigate('command')} className="text-[10px] font-bold text-[#006432] uppercase hover:underline">Open Map HUD ➔</button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-[35px] shadow-lg border flex flex-col items-center justify-center">
            <p className="text-3xl font-black text-slate-800">{stats.total}</p>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Total Kejadian</p>
          </div>
          <div className="bg-white p-6 rounded-[35px] shadow-lg border flex flex-col items-center justify-center">
            <p className="text-3xl font-black text-red-600">{stats.active}</p>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Misi Aktif</p>
          </div>
          <div className="bg-white p-6 rounded-[35px] shadow-lg border flex flex-col items-center justify-center">
            <p className="text-3xl font-black text-orange-600">{stats.critical}</p>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Kritis</p>
          </div>
          <div className="bg-white p-6 rounded-[35px] shadow-lg border flex flex-col items-center justify-center">
            <p className="text-3xl font-black text-blue-600">{stats.affected}</p>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Jiwa Terdampak</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white rounded-[35px] shadow-lg border p-6">
            <h3 className="text-sm font-black text-slate-700 uppercase mb-4">Kejadian Terbaru</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
              {incidents.slice(0, 10).map((inc, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{inc.disaster_type} - {inc.location}</p>
                    <p className="text-[9px] text-slate-400 uppercase">{inc.status} • {inc.region}</p>
                  </div>
                  <button onClick={() => onNavigate('manager')} className="text-[9px] font-bold text-[#006432] uppercase">Kelola ➔</button>
                </div>
              ))}
              {incidents.length === 0 && <p className="text-slate-400 text-xs text-center py-4">Tidak ada data kejadian</p>}
            </div>
          </div>
          <div className="bg-white rounded-[35px] shadow-lg border p-6 space-y-4">
            <h3 className="text-sm font-black text-slate-700 uppercase">Quick Actions</h3>
            <button onClick={() => onNavigate('command')} className="w-full p-4 bg-[#006432] text-white rounded-2xl text-xs font-black uppercase">Map HUD</button>
            <button onClick={() => onNavigate('manager')} className="w-full p-4 bg-slate-100 text-slate-700 rounded-2xl text-xs font-black uppercase">Mission Manager</button>
            <button onClick={() => onNavigate('posko')} className="w-full p-4 bg-slate-100 text-slate-700 rounded-2xl text-xs font-black uppercase">Shelter Manager</button>
            <button onClick={() => onNavigate('inventori')} className="w-full p-4 bg-slate-100 text-slate-700 rounded-2xl text-xs font-black uppercase">Inventory</button>
            <button onClick={() => onNavigate('trends')} className="w-full p-4 bg-slate-100 text-slate-700 rounded-2xl text-xs font-black uppercase">Trend Analyzer</button>
            {['SUPER_ADMIN', 'ADMIN_PWNU'].includes(user?.role?.toUpperCase()) && (
              <button onClick={() => onNavigate('audit-logs')} className="w-full p-4 bg-blue-50 text-blue-700 rounded-2xl text-xs font-black uppercase border border-blue-100">Audit System Logs</button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#f8fafc] text-slate-800 overflow-hidden relative">
      <header className="h-16 bg-[#006432] border-b-2 border-[#c5a059] flex items-center px-4 md:px-10 justify-between shrink-0 shadow-2xl z-[5000]">
        <div className="flex items-center gap-4">
          <img src="https://pwnu-jateng.org/uploads/infoumum/20250825111304-2025-08-25infoumum111252.png" className="h-10" alt="logo" />
          <div className="flex flex-col text-white leading-none">
            <h1 className="font-black text-xs uppercase italic">PWNU JATENG COMMAND HUB</h1>
            <span className="text-[7px] font-bold uppercase opacity-60">PROVINCE LEVEL • OPS ACTIVE</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="text-right hidden sm:block text-white">
              <p className="font-bold text-xs uppercase">{user?.full_name}</p>
              <p className="text-green-200 text-[8px] uppercase">{user?.role} • {user?.region}</p>
           </div>
           <button onClick={onLogout} className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-red-500 transition-all">
             <i className="fas fa-power-off"></i>
           </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <aside className="w-[85px] bg-white border-r border-slate-200 hidden md:flex flex-col items-center py-6 gap-4 shrink-0 z-40 overflow-y-auto">
          {menuItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === item.id ? 'text-[#006432]' : 'text-slate-300 hover:text-slate-500'}`}>
              <div className={`w-14 h-14 rounded-3xl flex items-center justify-center transition-all ${activeTab === item.id ? 'bg-green-50 scale-110 shadow-lg border border-green-100' : ''}`}>
                <i className={`fas fa-${item.icon} text-lg`}></i>
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </aside>

        <main className="flex-1 relative bg-white overflow-hidden flex flex-col h-full">
          <NewsTicker />
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'dashboard' && <DashboardHome incidents={incidentsToDisplay} onNavigate={setActiveTab} />}
            {activeTab === 'command' && <CommandCenter incidents={incidentsToDisplay} onAction={handleAction} />}
            {activeTab === 'manager' && <CompleteView incidents={incidentsToDisplay} user={user} onRefresh={fetchIncidents} onAction={handleAction} />}
            {activeTab === 'inventori' && <InventoryCommand onBack={() => setActiveTab('dashboard')} userData={user} />}
             {activeTab === 'assets' && <AssetManagement user={user} onBack={() => setActiveTab('dashboard')} />}
             {activeTab === 'buildings' && <BuildingAssessment user={user} onBack={() => setActiveTab('dashboard')} />}
             {activeTab === 'posko' && <ShelterManagement incidents={incidentsToDisplay} userData={user} onBack={() => setActiveTab('dashboard')} />}
            {activeTab === 'chat' && <ChatView user={user} onClose={() => setActiveTab('dashboard')} />}
            {activeTab === 'analytics' && <AnalyticsDashboard onBack={() => setActiveTab('dashboard')} />}
            {activeTab === 'notifications' && <NotificationPanel user={user} onClose={() => setActiveTab('dashboard')} />}
            {activeTab === 'trends' && <DisasterTrendAnalyzer user={user} onBack={() => setActiveTab('dashboard')} />}
             {activeTab === 'volunteer-mgmt' && <VolunteerManagement onBack={() => setActiveTab('dashboard')} />}
             {activeTab === 'volunteer-mission' && <VolunteerMissionDashboard user={user} onBack={() => setActiveTab('dashboard')} />}
              {activeTab === 'audit-logs' && <AuditLogView user={user} onBack={() => setActiveTab('dashboard')} />}
          </div>
        </main>
      </div>

      {workspace.mode && workspace.incident && (
        <div className="fixed inset-0 z-[6000] bg-white flex flex-col animate-in slide-in-from-bottom duration-500">
           <div className="flex-1 overflow-y-auto">
              {workspace.mode === 'assess' && <Assessment incident={workspace.incident} onBack={closeWorkspace} />}
              {workspace.mode === 'instruksi' && <InstructionView incident={workspace.incident} onSync={closeWorkspace} />}
              {workspace.mode === 'action' && <ActionView incident={workspace.incident} onComplete={closeWorkspace} />}
           </div>
        </div>
      )}
      <LogFooter />
    </div>
  );
};
export default AdminDashboard;