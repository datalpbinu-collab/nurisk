import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet'; // Import L from leaflet
import api from '../services/api';

// Fix for default Leaflet marker icons not showing
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const InventoryView = ({ inventory = [], onRefresh }) => {
  const [showAddAssetModal, setShowAddAssetModal] = useState(false); // New state for add asset modal
  const [newAssetForm, setNewAssetForm] = useState({ // New state for new asset form data
    type: 'Gedung', // Default type
    name: '',
    quantity: 1,
    available_quantity: 1,
    latitude: '',
    longitude: '',
    description: '',
    // Add other common fields as needed, e.g., unit, status, etc.
  });
  const [isSubmitting, setIsSubmitting] = useState(false); // To prevent double submission
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const assetTypes = [ // Moved to be accessible by handleOpenAddAssetModal
    'Gedung',
    'Relawan',
    'Armada',
    'Komunikasi', 
    'SAR', 
    'Medis', 
    'Alat Penunjang', 
    'Dapur Umum'
  ];

  const filteredInventory = inventory.filter(item => {
    const matchesType = filterType === 'all' || item.type === filterType;
    const matchesSearch = (item.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  }).sort((a, b) => {
    // Sorting FIFO: Kadaluwarsa terdekat atau stok paling sedikit muncul di atas
    if (a.expiry_date && b.expiry_date) return new Date(a.expiry_date) - new Date(b.expiry_date);
    return a.available_quantity - b.available_quantity;
  });

  const handleOpenAddAssetModal = (initialType = 'Gedung') => {
    setNewAssetForm(prev => ({
      ...prev,
      type: initialType,
      name: '',
      quantity: 1,
      available_quantity: 1,
      latitude: '',
      longitude: '',
      description: '',
    }));
    setShowAddAssetModal(true);
  };

  const handleAddAsset = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Basic validation
      if (!newAssetForm.name || !newAssetForm.type || newAssetForm.quantity <= 0) {
        alert('Nama, Jenis, dan Kuantitas harus diisi dengan benar.');
        setIsSubmitting(false);
        return;
      }

      const payload = {
        ...newAssetForm,
        quantity: parseInt(newAssetForm.quantity),
        available_quantity: parseInt(newAssetForm.available_quantity),
        latitude: newAssetForm.latitude ? parseFloat(newAssetForm.latitude) : null,
        longitude: newAssetForm.longitude ? parseFloat(newAssetForm.longitude) : null,
      };

      // Standarisasi endpoint tanpa leading slash jika base URL sudah mengaturnya
      await api.post('inventory', payload); 
      alert('Aset berhasil ditambahkan!');
      onRefresh(); // Refresh global data
      setShowAddAssetModal(false);
      setNewAssetForm({ // Reset form
        type: 'Gedung', name: '', quantity: 1, available_quantity: 1, latitude: '', longitude: '', description: ''
      });
    } catch (error) {
      console.error('Gagal menambahkan aset:', error);
      alert('Gagal menambahkan aset. Pastikan data valid dan server berjalan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // PRD: Tactical Resource Icon Generator
  const getAssetIcon = (type) => {
    const colors = { 'Relawan': '#006432', 'Armada': '#ef4444', 'Gedung': '#3b82f6' };
    const icons = { 'Relawan': 'user-ninja', 'Armada': 'truck-medical', 'Gedung': 'warehouse' };
    
    return L.divIcon({
      html: `<div style="background-color: ${colors[type] || '#64748b'}" class="w-7 h-7 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white">
              <i class="fas fa-${icons[type] || 'box'} text-[10px]"></i>
            </div>`,
      className: '',
      iconSize: [28, 28]
    });
  };

  return (
    <div className="p-4 md:p-8 bg-[#f8fafc] h-full overflow-y-auto font-sans custom-scrollbar">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b-2 border-green-50 pb-6 gap-4">
        <h2 className="text-2xl md:text-3xl font-black text-nu-green uppercase italic tracking-tighter leading-none">Strategic Assets Hub</h2>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <input
            type="text"
            placeholder="CARI ASET..."
            className="flex-1 md:w-64 p-3 bg-white border rounded-2xl text-xs font-bold outline-none shadow-sm ring-1 ring-slate-100"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="p-3 bg-white border rounded-2xl text-xs font-black text-nu-green shadow-sm outline-none"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">SEMUA JENIS ASET</option>
            {assetTypes.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
          </select>
          {/* Modified button to open generic add asset modal, pre-selecting 'Relawan' */}
          <button onClick={() => handleOpenAddAssetModal('Relawan')} className="bg-nu-gold text-green-950 px-6 py-3 rounded-2xl font-black text-[10px] shadow-lg hover:shadow-nu-gold/20 transition-all uppercase">+ Personil</button>
          {/* New button for adding other assets */}
          <button onClick={() => handleOpenAddAssetModal('Gedung')} className="bg-nu-green text-white px-6 py-3 rounded-2xl font-black text-[10px] shadow-lg hover:shadow-nu-green/20 transition-all uppercase">+ Aset Strategis</button>
        </div>
      </div>

      {/* 1. MAP SEBARAN ASET (HIGH-END) */}
      <div className="h-64 md:h-80 w-full bg-white rounded-[40px] shadow-2xl border-[10px] border-white overflow-hidden mb-10 relative">
         <MapContainer center={[-7.15, 110.14]} zoom={7} className="h-full w-full">
            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
            {filteredInventory.map(item => (
              item.latitude && item.longitude && (
                <Marker key={item.id} position={[item.latitude, item.longitude]} icon={getAssetIcon(item.type)}>
                  <Popup>
                    <div className="font-sans">
                      <p className="text-[10px] font-black text-nu-green uppercase">{item.type}</p>
                      <h4 className="font-bold text-sm">{item.name}</h4>
                      <p className="text-[10px] text-slate-500">Ketersediaan: {item.available_quantity}/{item.quantity}</p>
                    </div>
                  </Popup>
                </Marker>
              )
            ))} {/* Logic: Menampilkan Marker khusus Aset / Gudang / Ambulans */}
         </MapContainer>
         <div className="absolute top-4 right-4 z-[1000] bg-white/80 p-3 rounded-2xl text-[8px] font-bold uppercase tracking-widest shadow-lg italic">Tactical Resource Map</div>
      </div>

      {/* 2. GRID KARTU ASET (BENTO STYLE) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredInventory.map(item => (
          <div key={item.id} className="bg-white p-6 rounded-[35px] border border-slate-50 shadow-lg flex flex-col justify-between hover:scale-105 transition-all group">
            <div className="flex justify-between items-start mb-4">
               <div className="min-w-0">
                  <span className="text-[8px] font-black text-nu-green bg-green-50 px-2 py-0.5 rounded uppercase tracking-tighter">{item.type}</span>
                  <h4 className="text-slate-800 font-black text-sm uppercase italic mt-1 truncate leading-none">{item.name}</h4>
               </div>
               <div className="shrink-0 text-right">
                  <span className="text-2xl font-black text-nu-green leading-none">{item.available_quantity}</span>
                  <span className="text-[10px] text-slate-400 font-bold tracking-tighter">/{item.quantity}</span>
               </div>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden shadow-inner mt-4">
              <div className="h-full bg-nu-green transition-all duration-1000 shadow-sm" style={{ width: `${(item.available_quantity / item.quantity) * 100}%` }}></div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Asset Modal */}
      {showAddAssetModal && (
        <div className="fixed inset-0 z-[5000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl p-8 animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-nu-green uppercase italic text-lg tracking-tighter">Tambah Aset Baru</h3>
              <button onClick={() => setShowAddAssetModal(false)} className="text-slate-400 hover:text-red-500 transition-colors"><i className="fas fa-times-circle text-xl"></i></button>
            </div>
            <form onSubmit={handleAddAsset} className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Jenis Aset</label>
                <select
                  className="w-full p-3 bg-slate-50 rounded-2xl text-xs font-bold border-none shadow-inner outline-none"
                  value={newAssetForm.type}
                  onChange={(e) => setNewAssetForm({ ...newAssetForm, type: e.target.value })}
                  required
                >
                  {assetTypes.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Nama Aset</label>
                <input
                  type="text"
                  className="w-full p-3 bg-slate-50 rounded-2xl text-xs font-bold border-none shadow-inner outline-none"
                  placeholder="Nama aset (e.g., Gedung Serbaguna, Ambulans A-01, Relawan Budi)"
                  value={newAssetForm.name}
                  onChange={(e) => setNewAssetForm({ ...newAssetForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Total Kuantitas</label>
                  <input
                    type="number"
                    className="w-full p-3 bg-slate-50 rounded-2xl text-xs font-bold border-none shadow-inner outline-none"
                    value={newAssetForm.quantity}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, quantity: parseInt(e.target.value) || 0 })}
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Kuantitas Tersedia</label>
                  <input
                    type="number"
                    className="w-full p-3 bg-slate-50 rounded-2xl text-xs font-bold border-none shadow-inner outline-none"
                    value={newAssetForm.available_quantity}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, available_quantity: Math.min(parseInt(e.target.value) || 0, newAssetForm.quantity) })}
                    min="0"
                    max={newAssetForm.quantity}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Latitude (Opsional)</label>
                  <input
                    type="text"
                    className="w-full p-3 bg-slate-50 rounded-2xl text-xs font-bold border-none shadow-inner outline-none"
                    placeholder="-7.12345"
                    value={newAssetForm.latitude}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, latitude: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Longitude (Opsional)</label>
                  <input
                    type="text"
                    className="w-full p-3 bg-slate-50 rounded-2xl text-xs font-bold border-none shadow-inner outline-none"
                    placeholder="110.12345"
                    value={newAssetForm.longitude}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, longitude: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Deskripsi (Opsional)</label>
                <textarea
                  className="w-full p-3 bg-slate-50 rounded-2xl text-xs font-bold border-none shadow-inner outline-none h-20"
                  placeholder="Detail aset, kondisi, dll."
                  value={newAssetForm.description}
                  onChange={(e) => setNewAssetForm({ ...newAssetForm, description: e.target.value })}
                ></textarea>
              </div>
              <button
                type="submit"
                className="w-full bg-nu-green text-white py-4 rounded-3xl font-black uppercase text-xs shadow-xl shadow-green-900/20 mt-4 active:scale-95 transition-all disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Menambahkan Aset...' : 'Tambah Aset'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default InventoryView;