import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { KAB_JATENG } from '../utils/constants';
 
// Import the full BuildingAssessment component
import BuildingAssessment from './BuildingAssessment';

const EXPERTISE_OPTIONS = ['SAR', 'Medis', 'Logistik', 'Dapur Umum', 'Assessment', 'Psikososial', 'Driver', 'Komunikasi'];

const ASSET_CATEGORIES = [
  { id: 'logistik', name: 'Logistik' },
  { id: 'medis', name: 'Alat Medis' },
  { id: 'sar', name: 'SAR' },
  { id: 'komunikasi', name: 'Komunikasi' },
  { id: 'transport', name: 'Transport' },
  { id: 'armada', name: 'Armada' },
  { id: 'gedung', name: 'Gedung' },
  { id: 'relawan', name: 'Relawan' },
  { id: 'other', name: 'Lainnya' }
];

const BUILDING_FUNCTIONS = [
  { id: 'kantor', label: 'Kantor' },
  { id: 'sekolah', label: 'Sekolah' },
  { id: 'pesantren', label: 'Pondok' },
  { id: 'klinik', label: 'Klinik/RS' },
  { id: 'tempat_ibadah', label: 'Tempat Ibadah' },
  { id: 'lainnya', label: 'Lainnya' }
];

const InventoryCommand = ({ onBack, userData }) => {
  const [activeTab, setActiveTab] = useState('inventori');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [inventories, setInventories] = useState([]);
  const [assets, setAssets] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [buildings, setBuildings] = useState([]);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFullAssessment, setShowFullAssessment] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState(null);
  const [addForm, setAddForm] = useState({
    category: 'inventori',
    name: '',
    quantity: 1,
    unit: 'unit',
    location: '',
    latitude: '',
    longitude: '',
    expertise: 'Logistik', // Default value added
    fungsi: 'kantor'       // Default value added
  });
  
  useEffect(() => {
    loadAllData();
  }, []);
  
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [resInv, resAssets, resVol, resBld] = await Promise.allSettled([ // Use allSettled to prevent one failed request from blocking others
        api.get('/inventory').catch(() => ({ data: [] })),
        api.get('/assets').catch(() => ({ data: [] })),
        api.get('/volunteers/nearby').catch(() => ({ data: [] })), // Backend now filters by region for PCNU/Field Staff
        api.get('/buildings').catch(() => ({ data: [] }))
      ]);
      setInventories(resInv.status === 'fulfilled' ? resInv.value.data || [] : []);
      setAssets(resAssets.status === 'fulfilled' ? resAssets.value.data || [] : []);
      setVolunteers(resVol.status === 'fulfilled' ? resVol.value.data || [] : []);
      setBuildings(resBld.status === 'fulfilled' ? resBld.value.data || [] : []);
    } catch (err) {
      console.error('Load data error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleAdd = async () => {
    if (!addForm.name.trim()) {
      alert('Nama harus diisi!');
      return;
    }
    
    setLoading(true);
    try {
      let payload = {
        name: addForm.name,
        quantity: parseInt(addForm.quantity) || 1,
        unit: addForm.unit || 'unit',
        location: addForm.location,
        latitude: addForm.latitude ? parseFloat(addForm.latitude) : null,
        longitude: addForm.longitude ? parseFloat(addForm.longitude) : null
      };
      
      let endpoint = 'assets';
      
      if (addForm.category === 'inventori') {
        endpoint = 'inventory';
        payload = {
          name: addForm.name,
          type: addForm.location || 'logistik',
          quantity: parseInt(addForm.quantity) || 1,
          available_quantity: parseInt(addForm.quantity) || 1,
          unit: addForm.unit || 'unit',
          description: ''
        };
      } else if (addForm.category === 'relawan') {
        endpoint = 'volunteers/register';
        payload = {
          full_name: addForm.name,
          expertise: addForm.expertise || 'Logistik',
          phone: '',
          status: 'approved'
        };
      } else if (addForm.category === 'gedung') {
        endpoint = 'buildings';
        payload = {
          nama_gedung: addForm.name,
          fungsi: addForm.fungsi || 'kantor',
          alamat: addForm.location || '',
          latitude: addForm.latitude ? parseFloat(addForm.latitude) : null, // Ensure parsing
          longitude: addForm.longitude ? parseFloat(addForm.longitude) : null, // Ensure parsing
          section: 1,
          total_score: 0,
          completed: false
        };
      } else {
        // assets, meds, sar, komunikasi, transport, armada, other
        payload.category = addForm.category;
      }
      
      await api.post(endpoint, payload);
      
      alert('Berhasil ditambahkan!');
      setShowAddModal(false);
      setAddForm({
        category: 'inventori',
        name: '',
        quantity: 1,
        unit: 'unit',
        location: '',
        latitude: '',
        longitude: '',
        expertise: 'Logistik',
        fungsi: 'kantor'
      });
      loadAllData();
    } catch (err) {
      console.error('Save error:', err);
      alert('Gagal menyimpan data: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };
  
  const filteredInventories = inventories.filter(i => 
    i.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredAssets = assets.filter(a =>
    a.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredVolunteers = volunteers.filter(v =>
    v.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.expertise?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredBuildings = buildings.filter(b =>
    b.nama_gedung?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.alamat?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const totalStats = useMemo(() => ({
    inventori: inventories.length,
    assets: assets.length,
    volunteers: volunteers.length,
    buildings: buildings.length
  }), [inventories, assets, volunteers, buildings]);
  
  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      {/* HEADER */}
      <div className="h-14 bg-[#006432] px-4 flex items-center justify-between shrink-0">
        <button 
          onClick={() => {
            if (onBack) onBack();
          }} 
          className="text-white font-black text-xs uppercase flex items-center gap-2 hover:bg-white/10 p-2 rounded-lg transition-all">
          <i className="fas fa-arrow-left"></i> Kembali
        </button>
        <h2 className="text-white font-black text-sm uppercase italic">Inventori Command</h2>
        <button onClick={() => setShowAddModal(true)} className="text-white">
          <i className="fas fa-plus"></i>
        </button>
      </div>
      
      {/* SEARCH */}
      <div className="p-3 bg-white border-b">
        <input 
          type="text" 
          placeholder="CARI..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold shadow-sm"
        />
      </div>
      
      {/* SUB TABS */}
      <div className="flex border-b bg-white overflow-x-auto">
        <SubTab icon="box-archive" label="Inventori" active={activeTab === 'inventori'} count={totalStats.inventori} onClick={() => setActiveTab('inventori')} />
        <SubTab icon="truck-box" label="Aset" active={activeTab === 'assets'} count={totalStats.assets} onClick={() => setActiveTab('assets')} />
        <SubTab icon="users" label="Relawan" active={activeTab === 'volunteers'} count={totalStats.volunteers} onClick={() => setActiveTab('volunteers')} />
        <SubTab icon="building" label="Gedung" active={activeTab === 'buildings'} count={totalStats.buildings} onClick={() => setActiveTab('buildings')} />
      </div>
      
      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-20">
        
        {/* INVENTORI TAB */}
        {activeTab === 'inventori' && filteredInventories.map(item => (
          <CardItem 
            key={item.id} 
            icon="box-archive" 
            title={item.name} 
            subtitle={item.type || item.category || 'Inventori'}
            stat={item.available_quantity || item.quantity || 0}
            unit={item.unit || 'unit'}
            color="text-[#006432]"
          />
        ))}
        
        {/* ASET TAB */}
        {activeTab === 'assets' && filteredAssets.map(item => (
          <CardItem 
            key={item.id} 
            icon="truck-box" 
            title={item.name} 
            subtitle={item.category || 'Aset'}
            stat={item.quantity || 0}
            unit={item.unit || 'unit'}
            color="text-orange-600"
          />
        ))}
        
        {/* RELAWAN TAB */}
        {activeTab === 'volunteers' && filteredVolunteers.map(v => (
          <div key={v.id} className="bg-white p-4 rounded-2xl shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-black ${
                v.status === 'approved' ? 'bg-[#006432]' : 'bg-slate-300'
              }`}>
                {v.full_name?.charAt(0) || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm">{v.full_name}</h4>
                <p className="text-xs text-slate-400 truncate">{v.expertise || '-'}</p>
                <p className="text-[8px] text-slate-300">{v.regency || '-'}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${
                v.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
              }`}>
                {v.status === 'approved' ? 'Aktif' : v.status}
              </span>
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t">
              {v.phone && <span className="text-[10px] text-slate-400"><i className="fas fa-phone mr-1"></i>{v.phone}</span>}
              {v.blood_type && <span className="text-[10px] text-slate-400"><i className="fas fa-droplet mr-1"></i>{v.blood_type}</span>}
            </div>
          </div>
        ))}
        
        {/* GEDUNG TAB */}
        {activeTab === 'buildings' && (
          <>
            {/* QUICK ADD BUTTON */}
            <div className="bg-[#006432] p-4 rounded-2xl text-white mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-sm">ASESMEN KETANGGUHAN BENCANA</h4>
                  <p className="text-[10px] opacity-70">Pentagon Aset • 6 Section</p>
                </div>
                <button 
                  onClick={() => { setEditingBuilding(null); setShowFullAssessment(true); }}
                  className="bg-white text-[#006432] px-4 py-2 rounded-xl font-black text-xs"
                >
                  <i className="fas fa-plus mr-2"></i>Asesmen Baru
                </button>
              </div>
            </div>
            
            {filteredBuildings.map(b => (
              <div key={b.id} className="bg-white p-4 rounded-2xl shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-bold text-sm">{b.nama_gedung}</h4>
                    <p className="text-xs text-slate-400">{b.fungsi || b.alamat || '-'}</p>
                    <p className="text-[8px] text-slate-300 mt-1">{b.alamat || '-'}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-black ${(b.total_score || 0) >= 60 ? 'text-green-600' : 'text-red-600'}`}>
                      {b.total_score || 0}%
                    </p>
                    <p className="text-[8px] text-slate-400 uppercase">Ketangguhan</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-2">
                  {b.odnk > 0 && <span className="text-[9px] bg-red-50 text-red-600 px-2 py-1 rounded">OBK: {b.odnk}</span>}
                  {b.lansia > 0 && <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-1 rounded">Lansia: {b.lansia}</span>}
                  {b.balita > 0 && <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-1 rounded">Balita: {b.balita}</span>}
                </div>
                <div className="mt-3 flex gap-2">
                  <button 
                    onClick={() => { setEditingBuilding(b); setShowFullAssessment(true); }}
                    className="flex-1 py-2 bg-[#006432] text-white rounded-xl text-[10px] font-black"
                  >
                    {b.completed ? 'Lihat/Ubah Assessment' : 'Lanjutkan Assessment'}
                  </button>
                  <button 
                    onClick={() => { setEditingBuilding(b); setActiveTab('inventori'); alert('Fitur hapus belum aktif'); }}
                    className="py-2 px-4 bg-red-100 text-red-600 rounded-xl text-[10px] font-black"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
        
        {/* EMPTY STATE */}
        {(activeTab === 'inventori' && filteredInventories.length === 0) && (
          <EmptyState label="Inventori" />
        )}
        {(activeTab === 'assets' && filteredAssets.length === 0) && (
          <EmptyState label="Aset" />
        )}
        {(activeTab === 'volunteers' && filteredVolunteers.length === 0) && (
          <EmptyState label="Relawan" />
        )}
        {(activeTab === 'buildings' && filteredBuildings.length === 0) && (
          <EmptyState label="Gedung" />
        )}
      </div>
      
      {/* FULL BUILDING ASSESSMENT MODAL */}
      {showFullAssessment && (
        <div className="fixed inset-0 z-[9000] bg-[#f8fafc] overflow-y-auto custom-scrollbar">
          <BuildingAssessment 
            onBack={() => { setShowFullAssessment(false); setEditingBuilding(null); loadAllData(); }} 
            existingData={editingBuilding}
          />
        </div>
      )}
      
      {/* ADD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-[8000] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[30px] p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-lg">Tambah Baru</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            {addForm.category === 'gedung' && (
              <button 
                onClick={() => { setShowAddModal(false); setShowFullAssessment(true); }}
                className="w-full py-3 bg-[#c5a059] text-white rounded-xl font-black text-xs mb-4 flex items-center justify-center gap-2"
              >
                <i className="fas fa-clipboard-list"></i> 
                Asesmen Ketangguhan Lengkap (6 Section Pentagon)
              </button>
            )}
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase">Kategori</label>
                <select 
                  className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold"
                  value={addForm.category}
                  onChange={(e) => setAddForm({...addForm, category: e.target.value})}
                >
                  {ASSET_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase">Nama</label>
                <input 
                  type="text" 
                  className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold"
                  placeholder="Nama item..."
                  value={addForm.name}
                  onChange={(e) => setAddForm({...addForm, name: e.target.value})}
                />
              </div>
              
              {addForm.category === 'relawan' ? (
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Keahlian</label>
                  <select 
                    className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold"
                    value={addForm.expertise}
                    onChange={(e) => setAddForm({...addForm, expertise: e.target.value})}
                  >
                    <option value="">Pilih Keahlian</option>
                    {EXPERTISE_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              ) : addForm.category === 'gedung' ? (
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Fungsi</label>
                  <select 
                    className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold"
                    value={addForm.fungsi}
                    onChange={(e) => setAddForm({...addForm, fungsi: e.target.value})}
                  >
                    <option value="">Pilih Fungsi</option>
                    {BUILDING_FUNCTIONS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase">Jumlah</label>
                      <input 
                        type="number" 
                        className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold"
                        value={addForm.quantity}
                        onChange={(e) => setAddForm({...addForm, quantity: parseInt(e.target.value)})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase">Satuan</label>
                      <input 
                        type="text" 
                        className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold"
                        placeholder="unit"
                        value={addForm.unit}
                        onChange={(e) => setAddForm({...addForm, unit: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Lokasi</label>
                    <select 
                      className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold"
                      value={addForm.location}
                      onChange={(e) => setAddForm({...addForm, location: e.target.value})}
                    >
                      <option value="">Pilih Lokasi</option>
                      {KAB_JATENG.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                </>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Latitude</label>
                  <input 
                    type="text" 
                    className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold"
                    placeholder="-7.xxx"
                    value={addForm.latitude}
                    onChange={(e) => setAddForm({...addForm, latitude: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Longitude</label>
                  <input 
                    type="text" 
                    className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold"
                    placeholder="110.xxx"
                    value={addForm.longitude}
                    onChange={(e) => setAddForm({...addForm, longitude: e.target.value})}
                  />
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-black text-sm">Batal</button>
              <button onClick={handleAdd} disabled={loading} className="flex-1 py-3 bg-[#006432] text-white rounded-xl font-black text-sm disabled:opacity-50">
                {loading ? 'Simpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SubTab = ({ icon, label, active, count, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-3 text-xs font-black whitespace-nowrap border-b-2 transition-all ${
      active ? 'text-[#006432] border-[#006432]' : 'text-slate-400 border-transparent'
    }`}
  >
    <i className={`fas fa-${icon}`}></i>
    {label}
    {count > 0 && <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[8px]">{count}</span>}
  </button>
);

const CardItem = ({ icon, title, subtitle, stat, unit, color }) => (
  <div className="bg-white p-4 rounded-2xl shadow-sm">
    <div className="flex items-center gap-3">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50 ${color}`}>
        <i className={`fas fa-${icon}`}></i>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-sm truncate">{title}</h4>
        <p className="text-xs text-slate-400 truncate">{subtitle}</p>
      </div>
      <div className="text-right">
        <p className={`text-xl font-black ${color}`}>{stat}</p>
        <p className="text-[8px] text-slate-400 uppercase">{unit}</p>
      </div>
    </div>
  </div>
);

const EmptyState = ({ label }) => (
  <div className="py-20 text-center">
    <i className="fas fa-inbox text-5xl text-slate-200 mb-4 block"></i>
    <p className="text-sm text-slate-300">Belum ada {label}</p>
    <p className="text-[10px] text-slate-300 mt-1">Klik + untuk menambahkan</p>
  </div>
);

export default InventoryCommand;