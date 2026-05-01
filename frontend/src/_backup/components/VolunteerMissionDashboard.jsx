import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Geolocation } from '@capacitor/geolocation'; // Import Geolocation

const VolunteerMissionDashboard = ({ user, onBack }) => {
  const [myMissions, setMyMissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMyMissions = useCallback(async () => {
    try {
      const res = await api.get('incidents/my-missions');
      setMyMissions(res.data);
    } catch (e) {
      console.error("Gagal mengambil misi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyMissions();
  }, [fetchMyMissions]);

  const handleConfirmAttendance = async (mission) => {
    if (!window.confirm(`Konfirmasi kehadiran untuk misi "${mission.title}"?`)) return;

    setLoading(true);
    try {
      const coordinates = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000, // 10 detik timeout
      });

      const { latitude, longitude } = coordinates.coords;

      await api.post('incidents/confirm-attendance', {
        incident_id: mission.incident_id,
        latitude,
        longitude,
      });

      alert("Kehadiran berhasil dikonfirmasi!");
      fetchMyMissions(); // Refresh daftar misi
    } catch (e) {
      console.error("Gagal konfirmasi kehadiran:", e);
      alert("Gagal mengkonfirmasi kehadiran. Pastikan GPS aktif dan Anda berada di lokasi.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved': return 'bg-green-100 text-green-700 border-green-200';
      case 'attended': return 'bg-blue-100 text-blue-700 border-blue-200'; // Status baru
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'rejected': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading) return <div className="p-10 text-center animate-pulse text-slate-400 font-black uppercase text-xs">Syncing My Missions...</div>;

  return (
    <div className="p-4 md:p-8 space-y-6 font-sans bg-[#f8fafc] min-h-screen">
      <div className="border-b-2 border-slate-100 pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-[#006432] uppercase italic tracking-tighter">Misi Saya</h2>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Riwayat Kontribusi & Status Penugasan</p>
        </div>
        {onBack && (
          <button onClick={onBack} className="text-[#006432] font-black text-xs uppercase flex items-center gap-2">
            <i className="fas fa-arrow-left"></i> Kembali
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {myMissions.map((mission) => (
          <div key={mission.deployment_id} className="bg-white rounded-[30px] p-6 shadow-lg border border-slate-50 relative overflow-hidden group">
            <div className={`absolute top-0 right-0 px-4 py-2 rounded-bl-2xl font-black text-[9px] uppercase border-b border-l ${getStatusColor(mission.application_status)}`}>
              {mission.application_status === 'attended' ? 'HADIR' : mission.application_status}
            </div>
            
            <div className="space-y-4">
              <div>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{mission.disaster_type}</span>
                <h3 className="text-lg font-black text-slate-800 uppercase italic leading-tight group-hover:text-[#006432] transition-colors">
                  {mission.title}
                </h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">📍 {mission.region}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                <div>
                  <p className="text-[8px] font-black text-slate-300 uppercase">Tgl Daftar</p>
                  <p className="text-[10px] font-bold text-slate-600">{new Date(mission.applied_at).toLocaleDateString('id-ID')}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-300 uppercase">Status Insiden</p>
                  <p className="text-[10px] font-bold text-nu-green">{mission.incident_status}</p>
                </div>
              </div>

              {mission.application_status === 'approved' && !loading && (
                <button className="w-full bg-[#006432] text-white py-3 rounded-2xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-all">
                  Buka Lembar Instruksi ➔
                </button>
              )}
              {mission.application_status === 'approved' && (
                <button onClick={() => handleConfirmAttendance(mission)} disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-2xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-all mt-2">
                  {loading ? 'Mengkonfirmasi...' : 'Konfirmasi Kehadiran (GPS) ➔'}
                  Buka Lembar Instruksi ➔
                </button>
              )}
            </div>
          </div>
        ))}

        {myMissions.length === 0 && (
          <div className="col-span-full py-20 text-center space-y-4 opacity-40">
            <i className="fas fa-clipboard-list text-6xl text-slate-300"></i>
            <p className="font-black uppercase text-xs italic tracking-widest">Anda belum mendaftar pada misi apapun.</p>
            <button className="text-[#006432] font-black text-[10px] uppercase underline">Cari Misi Aktif ➔</button>
          </div>
        )}
      </div>
      
      {/* Ringkasan Performa Kecil */}
      <div className="bg-[#006432] p-6 rounded-[35px] text-white shadow-xl flex items-center justify-between mt-10">
        <div>
          <p className="text-[10px] font-black uppercase opacity-60 leading-none">Total Kontribusi</p>
          <p className="text-2xl font-black italic">{myMissions.filter(m => m.application_status === 'approved').length} Misi Selesai</p>
        </div>
        <i className="fas fa-medal text-3xl text-nu-gold"></i>
      </div>
    </div>
  );
};

export default VolunteerMissionDashboard;