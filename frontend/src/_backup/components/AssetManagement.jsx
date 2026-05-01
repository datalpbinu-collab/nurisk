import React, { useState, useEffect } from 'react';
import { useAssetStore } from '../store/useAssetStore';
import { KAB_JATENG } from '../utils/constants'; // Import KAB_JATENG

const ASSET_CATEGORIES = [
  { id: 'logistik', name: 'Logistik & Sembako' },
  { id: 'medis', name: 'Alat Medis' },
  { id: 'sar', name: 'Peralatan SAR' },
  { id: 'komunikasi', name: 'Komunikasi' },
  { id: 'transport', name: 'Transport' },
  { id: 'other', name: 'Lainnya' }
];

const AssetManagement = ({ user, onBack }) => {
  const { 
    assets, transactions, warehouseSummary, lowStock,
    fetchAssets, fetchWarehouseSummary, createAsset, requestAsset, fetchTransactions 
  } = useAssetStore();
  
  const [activeTab, setActiveTab] = useState('inventory');
  const [showForm, setShowForm] = useState(false);
  const [newAsset, setNewAsset] = useState({
    name: '', category: 'logistik', quantity: 0, unit: 'unit', location: ''
  });

  useEffect(() => {
    fetchAssets();
    fetchWarehouseSummary();
    fetchTransactions();
  }, []);

  const handleCreateAsset = async () => {
    try {
      await createAsset(newAsset);
      setShowForm(false);
      setNewAsset({ name: '', category: 'logistik', quantity: 0, unit: 'unit', location: '' });
      alert('Asset berhasil ditambahkan!');
    } catch (err) {
      alert('Gagal menambahkan asset');
    }
  };

  const handleRequestAsset = async (assetId) => {
    const qty = prompt('Jumlah yang dibutuhkan:');
    if (!qty) return;
    
    try {
      await requestAsset({
        asset_id: assetId,
        incident_id: null,
        volunteer_id: user.id,
        quantity: parseInt(qty)
      });
      alert('Request berhasil dikirim!');
    } catch (err) {
      alert('Gagal request');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="h-14 bg-[#006432] px-4 flex items-center justify-between shrink-0">
        <button onClick={onBack} className="text-white font-black text-xs uppercase flex items-center gap-2">
          <i className="fas fa-arrow-left"></i> Kembali
        </button>
        <h2 className="text-white font-black text-sm uppercase italic">Asset & Warehouse</h2>
        <button onClick={() => setShowForm(true)} className="text-white">
          <i className="fas fa-plus"></i>
        </button>
      </div>

      <div className="flex border-b bg-white">
        <button onClick={() => setActiveTab('inventory')} 
          className={`flex-1 py-3 text-xs font-black uppercase ${activeTab === 'inventory' ? 'text-[#006432] border-b-2 border-[#006432]' : 'text-slate-400'}`}>
          Inventory
        </button>
        <button onClick={() => setActiveTab('transactions')} 
          className={`flex-1 py-3 text-xs font-black uppercase ${activeTab === 'transactions' ? 'text-[#006432] border-b-2 border-[#006432]' : 'text-slate-400'}`}>
          Riwayat
        </button>
        <button onClick={() => setActiveTab('summary')} 
          className={`flex-1 py-3 text-xs font-black uppercase ${activeTab === 'summary' ? 'text-[#006432] border-b-2 border-[#006432]' : 'text-slate-400'}`}>
          Summary
        </button>
      </div>

      {activeTab === 'inventory' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {assets.map(asset => (
            <div key={asset.id} className="bg-white p-4 rounded-2xl shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-sm">{asset.name}</h4>
                  <p className="text-xs text-slate-400">{ASSET_CATEGORIES.find(c => c.id === asset.category)?.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-[#006432]">{asset.quantity}</p>
                  <p className="text-[8px] text-slate-400 uppercase">{asset.unit}</p>
                </div>
              </div>
              <div className="flex justify-between items-center mt-3 pt-3 border-t">
                <span className="text-[10px] text-slate-400">{asset.location}</span>
                <button onClick={() => handleRequestAsset(asset.id)} className="text-[10px] font-black text-[#006432] uppercase">
                  Request <i className="fas fa-arrow-right ml-1"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {transactions.map(trans => (
            <div key={trans.id} className="bg-white p-4 rounded-2xl shadow-sm">
              <div className="flex justify-between">
                <div>
                  <h4 className="font-bold text-sm">{trans.asset_name}</h4>
                  <p className="text-xs text-slate-400">{trans.incident_title || '-'}</p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${
                    trans.status === 'approved' ? 'bg-green-100 text-green-700' : 
                    trans.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {trans.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'summary' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-[#006432] p-6 rounded-[30px] text-white">
            <h3 className="text-xs font-black uppercase mb-2">Total Stok</h3>
            <p className="text-4xl font-black">{warehouseSummary?.total_items || 0}</p>
            <p className="text-xs opacity-60">{warehouseSummary?.total_types || 0} Jenis Asset</p>
          </div>
          
          {lowStock.length > 0 && (
            <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
              <h4 className="text-xs font-black text-red-600 uppercase mb-2">Stok Menipis</h4>
              {lowStock.map(item => (
                <div key={item.id} className="flex justify-between py-2 border-b border-red-100">
                  <span className="text-sm">{item.name}</span>
                  <span className="font-black text-red-600">{item.quantity} {item.unit}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[8000] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[30px] p-6">
            <h3 className="font-black text-lg mb-4">Tambah Asset Baru</h3>
            <div className="space-y-4">
              <input type="text" placeholder="Nama Asset" value={newAsset.name} onChange={(e) => setNewAsset({...newAsset, name: e.target.value})}
                className="w-full p-3 bg-slate-50 rounded-xl" />
              <select value={newAsset.category} onChange={(e) => setNewAsset({...newAsset, category: e.target.value})}
                className="w-full p-3 bg-slate-50 rounded-xl">
                {ASSET_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="Jumlah" value={newAsset.quantity} onChange={(e) => setNewAsset({...newAsset, quantity: parseInt(e.target.value)})}
                  className="w-full p-3 bg-slate-50 rounded-xl" />
                <input type="text" placeholder="Satuan" value={newAsset.unit} onChange={(e) => setNewAsset({...newAsset, unit: e.target.value})}
                  className="w-full p-3 bg-slate-50 rounded-xl" />
              </div>
              <select value={newAsset.location} onChange={(e) => setNewAsset({...newAsset, location: e.target.value})}
                className="w-full p-3 bg-slate-50 rounded-xl">
                <option value="">Pilih Lokasi</option>
                {KAB_JATENG.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-black text-sm">Batal</button>
              <button onClick={handleCreateAsset} className="flex-1 py-3 bg-[#006432] text-white rounded-xl font-black text-sm">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetManagement;