import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useAnalyticsStore } from '../store/useAnalyticsStore';

const EXPERTISE_OPTIONS = ['SAR', 'Medis', 'Logistik', 'Dapur Umum', 'Assessment', 'Psikososial', 'Driver', 'Komunikasi'];

const VolunteerManagement = ({ onBack }) => {
  const { volunteerPerformance, fetchVolunteerPerformance } = useAnalyticsStore();
  const [volunteers, setVolunteers] = useState([]);
  const [filteredVolunteers, setFilteredVolunteers] = useState([]);
  const [search, setSearch] = useState('');
  const [filterExpertise, setFilterExpertise] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [selectedVolunteer, setSelectedVolunteer] = useState(null);
  const [viewMode, setViewMode] = useState('list');

  useEffect(() => {
    loadVolunteers();
  }, []);

  useEffect(() => {
    let result = volunteers;
    if (search) result = result.filter(v => 
      v.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      v.expertise?.toLowerCase().includes(search.toLowerCase())
    );
    if (filterExpertise !== 'all') result = result.filter(v => 
      v.expertise?.toLowerCase().includes(filterExpertise.toLowerCase())
    );
    if (filterRegion !== 'all') result = result.filter(v => v.regency === filterRegion);
    setFilteredVolunteers(result);
  }, [volunteers, search, filterExpertise, filterRegion]);

  const loadVolunteers = async () => {
    try {
      const res = await api.get('/volunteers/nearby');
      setVolunteers(res.data);
    } catch (err) {
      console.error('Load volunteers error:', err);
    }
  };

  const handleStatusChange = async (volunteerId, newStatus) => {
    try {
      await api.put(`/volunteers/profile/${volunteerId}`, { status: newStatus });
      await Haptics.impact({ style: ImpactStyle.Medium });
      loadVolunteers();
    } catch (err) {
      alert('Gagal update status');
    }
  };

  const viewVolunteerDetails = (v) => {
    setSelectedVolunteer(v);
    setViewMode('detail');
  };

  if (viewMode === 'detail' && selectedVolunteer) {
    return (
      <div className="flex flex-col h-full bg-[#f8fafc]">
        <div className="h-14 bg-[#006432] px-4 flex items-center justify-between shrink-0">
          <button onClick={() => setViewMode('list')} className="text-white font-black text-xs uppercase flex items-center gap-2">
            <i className="fas fa-arrow-left"></i> Kembali
          </button>
          <h2 className="text-white font-black text-sm uppercase italic">Detail Volunteer</h2>
          <div className="w-10"></div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-white p-6 rounded-[30px] text-center">
            <div className="w-20 h-20 bg-[#006432] rounded-full flex items-center justify-center text-white text-3xl font-black mx-auto mb-4">
              {selectedVolunteer.full_name?.charAt(0)}
            </div>
            <h3 className="text-xl font-black">{selectedVolunteer.full_name}</h3>
            <p className="text-sm text-slate-400">{selectedVolunteer.expertise}</p>
          </div>

          <div className="bg-white p-4 rounded-2xl space-y-3">
            <InfoRow label="Telepon" value={selectedVolunteer.phone || '-'} />
            <InfoRow label="Kabupaten" value={selectedVolunteer.regency || '-'} />
            <InfoRow label="Kecamatan" value={selectedVolunteer.district || '-'} />
            <InfoRow label="Gol. Darah" value={selectedVolunteer.blood_type || '-'} />
            <InfoRow label="Status" value={selectedVolunteer.status || 'approved'} />
          </div>

          <div className="bg-white p-4 rounded-2xl">
            <h4 className="text-xs font-black text-slate-400 uppercase mb-3">Riwayat Misi</h4>
            <p className="text-sm text-slate-300 italic">Segera hadir...</p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => handleStatusChange(selectedVolunteer.id, 'approved')} 
              className="flex-1 py-3 bg-green-500 text-white rounded-xl font-black text-sm">
              Aktivasi
            </button>
            <button onClick={() => handleStatusChange(selectedVolunteer.id, 'suspended')} 
              className="flex-1 py-3 bg-red-500 text-white rounded-xl font-black text-sm">
              Nonaktifkan
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="h-14 bg-[#006432] px-4 flex items-center justify-between shrink-0">
        <button onClick={onBack} className="text-white font-black text-xs uppercase flex items-center gap-2">
          <i className="fas fa-arrow-left"></i> Kembali
        </button>
        <h2 className="text-white font-black text-sm uppercase italic">Volunteer Management</h2>
        <div className="w-10"></div>
      </div>

      <div className="p-4 space-y-3">
        <input 
          type="text" 
          placeholder="Cari volunteer..." 
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full p-3 bg-white rounded-2xl shadow-sm"
        />
        
        <div className="flex gap-2 overflow-x-auto pb-2">
          <FilterBtn label="Semua" active={filterExpertise === 'all'} onClick={() => setFilterExpertise('all')} />
          {EXPERTISE_OPTIONS.map(exp => (
            <FilterBtn key={exp} label={exp} active={filterExpertise === exp} onClick={() => setFilterExpertise(exp)} />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-20 space-y-3">
        {filteredVolunteers.map(v => (
          <div key={v.id} onClick={() => viewVolunteerDetails(v)}
            className="bg-white p-4 rounded-2xl shadow-sm cursor-pointer">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-black ${
                v.status === 'approved' ? 'bg-[#006432]' : 'bg-slate-300'
              }`}>
                {v.full_name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm">{v.full_name}</h4>
                <p className="text-xs text-slate-400 truncate">{v.expertise}</p>
                <p className="text-[8px] text-slate-300">{v.regency}</p>
              </div>
              <div className="text-right">
                <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${
                  v.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
                }`}>
                  {v.status === 'approved' ? 'Aktif' : v.status}
                </span>
              </div>
            </div>
          </div>
        ))}
        
        {filteredVolunteers.length === 0 && (
          <p className="text-center text-slate-300 py-10">Tidak ada volunteer</p>
        )}
      </div>
    </div>
  );
};

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between py-2 border-b border-slate-50">
    <span className="text-xs text-slate-400">{label}</span>
    <span className="text-sm font-bold">{value}</span>
  </div>
);

const FilterBtn = ({ label, active, onClick }) => (
  <button onClick={onClick}
    className={`px-4 py-2 rounded-full text-[10px] font-black whitespace-nowrap uppercase ${
      active ? 'bg-[#006432] text-white' : 'bg-white text-slate-400 border'
    }`}>
    {label}
  </button>
);

export default VolunteerManagement;