import React, { useState, useEffect } from 'react';
import { useAnalyticsStore } from '../store/useAnalyticsStore';

const AnalyticsDashboard = ({ onBack }) => {
  const { 
    dashboardStats, volunteerPerformance, 
    fetchDashboardStats, fetchVolunteerPerformance, fetchKPIs, downloadSITREP, kpis 
  } = useAnalyticsStore();
  
  const [timeRange, setTimeRange] = useState({ start: '', end: '' });
  const [dimension, setDimension] = useState('disaster_type');

  useEffect(() => {
    fetchDashboardStats();
    fetchVolunteerPerformance();
    fetchKPIs(new Date().getFullYear());
  }, []);

  const stat = dashboardStats;
  
  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="h-14 bg-[#006432] px-4 flex items-center justify-between shrink-0">
        <button onClick={onBack} className="text-white font-black text-xs uppercase flex items-center gap-2">
          <i className="fas fa-arrow-left"></i> Kembali
        </button>
        <h2 className="text-white font-black text-sm uppercase italic">Analytics & KPIs</h2>
        <button onClick={() => fetchDashboardStats()} className="text-white">
          <i className="fas fa-sync"></i>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* MAIN KPIs */}
        <div className="space-y-2">
          <h3 className="text-xs font-black text-slate-400 uppercase">Statistik Keseluruhan</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-2xl shadow-sm">
              <p className="text-xs text-slate-400 uppercase">Total Kejadian</p>
              <p className="text-3xl font-black text-[#006432]">{stat?.incidents?.total_incidents || 0}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm">
              <p className="text-xs text-slate-400 uppercase">Volunteer Aktif</p>
              <p className="text-3xl font-black text-blue-600">{stat?.volunteers?.active || 0}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm">
              <p className="text-xs text-slate-400 uppercase">Asset Tersedia</p>
              <p className="text-3xl font-black text-[#c5a059]">{stat?.assets?.total_items || 0}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm">
              <p className="text-xs text-slate-400 uppercase">Critical</p>
              <p className="text-3xl font-black text-red-600">{stat?.incidents?.critical || 0}</p>
            </div>
          </div>
        </div>

        {/* INCIDENT STATUS FUNNEL */}
        <div className="space-y-2">
          <h3 className="text-xs font-black text-slate-400 uppercase">Incident Pipeline</h3>
          <div className="space-y-2">
            {[
              { label: 'Reported', value: stat?.incidents?.reported || 0, color: 'bg-slate-500' },
              { label: 'Verified', value: stat?.incidents?.verified || 0, color: 'bg-blue-500' },
              { label: 'Assessed', value: stat?.incidents?.assessed || 0, color: 'bg-yellow-500' },
              { label: 'Commanded', value: stat?.incidents?.commanded || 0, color: 'bg-orange-500' },
              { label: 'In Action', value: stat?.incidents?.in_action || 0, color: 'bg-green-500' },
              { label: 'Completed', value: stat?.incidents?.completed || 0, color: 'bg-slate-800' }
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="w-20 text-xs font-bold text-slate-600">{item.label}</span>
                <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full`} style={{ width: `${(item.value / (stat?.incidents?.total_incidents || 1)) * 100}%` }}></div>
                </div>
                <span className="w-8 text-xs font-black text-right">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* TOP VOLUNTEERS */}
        <div className="space-y-2">
          <h3 className="text-xs font-black text-slate-400 uppercase">Top Volunteers</h3>
          <div className="bg-white rounded-2xl overflow-hidden">
            {(volunteerPerformance || []).slice(0, 5).map((v, idx) => (
              <div key={v.id} className="flex items-center gap-3 p-3 border-b">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                  idx === 0 ? 'bg-yellow-400 text-black' : idx === 1 ? 'bg-slate-300 text-black' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold">{v.full_name}</p>
                  <p className="text-[10px] text-slate-400">{v.expertise} • {v.regency}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-[#006432]">{v.missions_completed} misi</p>
                  <p className="text-[8px] text-slate-400">{v.total_hours || 0} jam</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MONTHLY KPIs */}
        <div className="space-y-2">
          <h3 className="text-xs font-black text-slate-400 uppercase">KPI Bulanan</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-2xl shadow-sm">
              <p className="text-xs text-slate-400 uppercase">Waktu Respon Rata-rata</p>
              <p className="text-2xl font-black text-[#006432]">{Number(kpis?.avgResponseHours || 0).toFixed(1)}</p>
              <p className="text-[8px] text-slate-400">jam</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm">
              <p className="text-xs text-slate-400 uppercase">Volunteer Baru</p>
              <p className="text-2xl font-black text-blue-600">{kpis?.newVolunteers || 0}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm col-span-2">
              <p className="text-xs text-slate-400 uppercase">Asset Dideploy</p>
              <p className="text-2xl font-black text-[#c5a059]">{kpis?.assetsDeployed || 0}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;