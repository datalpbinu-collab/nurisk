import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Camera, CameraResultType } from '@capacitor/camera';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * PUSDATIN NU PEDULI - MASTER SHELTER CONTROL (POSKO) V33.0
 * -----------------------------------------------------------
 * STAGES: 1. Activation, 2. Registration (A), 3. Resources (B), 
 *         4. Health (C), 5. HR Mapping (D), 6. SPM Audit
 */

const ShelterManagement = ({ incidents = [], userData, onBack }) => {
  // --- 1. OTORITAS & RBAC ENGINE ---
  const isPusat = useMemo(() => 
    ['PWNU', 'SUPER_ADMIN', 'ADMIN_PWNU'].includes(userData?.role), 
  [userData]);

  const [activeShelter, setActiveShelter] = useState(null);
  const [view, setView] = useState('list'); // list, activation, menu, form_a, form_b, form_c, form_d, logistics_pipeline
  const [shelters, setShelters] = useState([]);
  const [requests, setRequests] = useState([]); // Permintaan Logistik ke PWNU
  const [inventory, setInventory] = useState([]); // Integrasi dari LogisticsHub
  const [loading, setLoading] = useState(false);
  const [activationForm, setActivationForm] = useState({ 
    name: '', 
    incident_id: '',
    latitude: '',    // Manual GPS input - no signal needed
    longitude: '',
    address: '',
    capacity: 100
  });
  
  const [useGps, setUseGps] = useState(false);

  // --- 2. STATE DATA FORM (PRD COMPLIANT) ---
  const [formA, setFormA] = useState({
    id_pengungsi: `REG-${Date.now()}`,
    nama_kk: '', nik: '', no_hp: '',
    rentan: [], status_kesehatan: 'Sehat',
    kecamatan_asal: '', desa_asal: ''
  });

  const [formB, setFormB] = useState({
    kategori: 'Logistik Pangan', inventory_id: '', nama_barang: '',
    kondisi: 'Ready', transaksi: 'Masuk', kadaluwarsa: '', jumlah: 0,
    is_request_pwnu: false // Flag untuk permintaan ke pusat
  });

  const [formC, setFormC] = useState({
    tenaga_medis: '', morbiditas: { ispa: 0, diare: 0, kulit: 0 },
    rujukan: '', air_bersih: 0, jamban: 0
  });

  const [formD, setFormD] = useState({
    nama: '', nik: '', instansi: '', no_hp: '',
    kompetensi: 'Evakuasi', shift: 'Pagi'
  });

  // --- 3. FETCH & SYNC ENGINE ---
  const fetchData = async () => {
    try {
      const [resShelter, resReq, resInv] = await Promise.all([
        api.get('/shelters'),
        api.get(`/logistics?role=${userData.role}&region=${userData.region}`),
        api.get('/inventory')
      ]);
      
      const data = isPusat
        ? resShelter.data
        : resShelter.data.filter(s => s.region === userData?.region);
      setShelters(data || []);
      setRequests(resReq.data || []);
      setInventory(resInv.data || []);
    } catch (e) {
      console.error("Gagal sinkronisasi data");
    }
  };

  useEffect(() => { fetchData(); }, [isPusat, userData]);

  const handleSelectShelter = (s) => {
    setActiveShelter(s);
    setView('menu');
    setFormA(prev => ({ ...prev, id_pengungsi: `REG-${Math.floor(Math.random() * 100000)}` }));
    Haptics.impact({ style: ImpactStyle.Light });
  };

  const handleSubmitForm = async (type, payload) => {
    setLoading(true);
    try {
      if (type === 'b' && payload.is_request_pwnu) {
        // JIKA REQUEST KE PWNU: Gunakan alur Logistics Request dari LogisticsHub
        const item = inventory.find(i => i.id === parseInt(payload.inventory_id));
        await api.post('logistics', {
          incident_id: activeShelter.incident_id,
          shelter_id: activeShelter.id,
          inventory_id: payload.inventory_id,
          item_name: item ? item.name : payload.nama_barang,
          quantity_requested: payload.jumlah,
          region: userData.region,
          category: payload.kategori
        });
        alert("✓ PERMINTAAN LOGISTIK TERKIRIM KE PWNU!");
      } else {
        // JIKA LOG LOKAL (Inbound/Outbound POSKO)
        await api.post(`/shelters/${activeShelter.id}/forms`, { type, data: payload });
        alert(`✓ DATA FORM ${type.toUpperCase()} BERHASIL DISINKRONKAN!`);
      }

      Haptics.impact({ style: ImpactStyle.Medium });
      setView('menu');
      fetchData(); 
    } catch (e) {
      alert("Gagal mengirim data. Cek koneksi server.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePipelineStatus = async (id, status) => {
    let payload = { status, admin_note: "Update via Shelter Terminal" };

    if (status === 'shipped' && isPusat) {
      if (!window.confirm("Konfirmasi: Apakah barang sudah masuk ke armada pengiriman?")) return;
    }

    if (status === 'delivered') {
      const isConfirm = window.confirm("Konfirmasi Inbound: Apakah barang sudah masuk ke gudang Posko?");
      if (!isConfirm) return;
      
      try {
        const image = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Base64
        });
        payload.proof_of_delivery = image.base64String;
      } catch (e) {
        console.warn("Camera not available, skipping proof photo");
        // Continue without photo - not critical
      }
    }

    if (status === 'approved' || status === 'rejected') {
      const note = prompt("Berikan catatan otoritas (Opsional):") || "";
      payload.admin_note = note;
    }

    try {
      await api.patch(`logistics/${id}/status`, payload);
      alert(`✓ STATUS BERHASIL DIPERBARUI: ${status.toUpperCase()}`);
      fetchData();
    } catch (e) {
      alert("Gagal memperbarui status. Cek koneksi.");
    }
  };

  const handleExportManifest = (request) => {
    if (!jsPDF || !autoTable) {
      alert("PDF generation not available. Please install jspdf.");
      return;
    }
    
    try {
      const doc = new jsPDF();
      doc.setFont("helvetica", "bold").setFontSize(16);
      doc.text("MANIFEST PENGIRIMAN LOGISTIK", 105, 20, { align: "center" });
      doc.setFontSize(10).setFont("helvetica", "normal");
      doc.text(`ID Transaksi: LOG-${request.id}`, 14, 35);
      doc.text(`Tujuan: ${activeShelter?.name || 'Posko'} (${userData?.region})`, 14, 40);

      autoTable(doc, {
        startY: 50,
        head: [['DETAIL', 'KETERANGAN']],
        body: [
          ['Barang', request.item_name || 'N/A'],
          ['Kuantitas', String(request.quantity_requested || request.quantity || 0)],
          ['Kategori', request.category || 'Logistik'],
          ['Status', String(request.status || 'pending').toUpperCase()],
        ],
        theme: 'grid',
        headStyles: { fillColor: [0, 100, 50] }
      });

      doc.text("Petugas Logistik PWNU,", 140, doc.lastAutoTable.finalY + 20);
      doc.text("( ____________________ )", 140, doc.lastAutoTable.finalY + 45);
      doc.save(`MANIFEST_${request.item_name || 'item'}_${request.id}.pdf`);
    } catch (e) {
      console.error("PDF Error:", e);
      alert("Gagal membuat PDF");
    }
  };

  const handleActivateShelter = async () => {
    if (!activationForm.name || !activationForm.incident_id) return alert("Lengkapi nama posko dan incident!");
    if (!useGps && (!activationForm.latitude || !activationForm.longitude)) return alert("Masukkan koordinat GPS atau gunakan GPS otomatis!");
    
    setLoading(true);
    try {
      // Try GPS if enabled, otherwise use manual input
      let lat = activationForm.latitude;
      let lng = activationForm.longitude;
      
      if (useGps) {
        try {
          const { Geolocation } = await import('@capacitor/geolocation');
          const position = await Geolocation.getCurrentPosition();
          lat = position.coords.latitude;
          lng = position.coords.longitude;
        } catch (gpsErr) {
          alert("GPS tidak tersedia, gunakan input manual");
          return;
        }
      }
      
      await api.post('/shelters', {
        name: activationForm.name,
        incident_id: parseInt(activationForm.incident_id),
        region: userData.region,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        address: activationForm.address || '',
        capacity: parseInt(activationForm.capacity) || 100,
        status: 'active'
      });
      alert("✓ POSKO BERHASIL DIAKTIFKAN!");
      setView('list');
      setActivationForm({ name: '', incident_id: '', latitude: '', longitude: '', address: '', capacity: 100 });
      fetchData();
    } catch (e) {
      console.error("Activate error:", e);
      alert("Gagal mengaktifkan posko. Cek koneksi server.");
    } finally {
      setLoading(false);
    }
  };

  const renderDemographics = () => {
    if (!activeShelter) return null;
    return (
      <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 shadow-inner">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Demografi & Kapasitas Posko</h4>
          <span className="text-[8px] bg-[#006432]/10 text-[#006432] px-2 py-0.5 rounded font-black uppercase">Live Data</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MiniStat label="Total Jiwa" value={activeShelter.refugee_count || 0} active />
          <MiniStat label="Kesehatan" value={`${activeShelter.score || 0}%`} active />
          <MiniStat label="Zonasi" value={activeShelter.region} active />
          <MiniStat label="ID Posko" value={`#${activeShelter.id}`} active />
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-10 space-y-8 animate-in fade-in duration-500 font-sans">
      
      {/* ---------------------------------------------------------
          SECTION: TACTICAL HEADER
      --------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-slate-100 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            {(activeShelter || onBack) && (
              <button onClick={() => { if(activeShelter) { setActiveShelter(null); setView('list'); } else if(onBack) { onBack(); } }} className="bg-slate-100 p-2 rounded-full w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-[#006432] hover:text-white transition-all">
                <i className="fas fa-arrow-left text-xs"></i>
              </button>
            )}
            <h2 className="text-2xl md:text-3xl font-black text-[#006432] uppercase italic tracking-tighter">Command Hub: Posko</h2>
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1 italic">Standardized Crisis Response System</p>
        </div>
        <button 
          onClick={() => setView('activation')}
          className="w-full md:w-auto bg-[#006432] text-white px-8 py-4 rounded-[1.5rem] font-black uppercase text-[10px] shadow-xl hover:bg-green-800 transition-all flex items-center justify-center gap-3"
        >
          <i className="fas fa-plus-circle text-nu-gold"></i> Aktivasi Posko Baru
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* ---------------------------------------------------------
            LEFT COLUMN: SHELTER LIST & SPM SCORECARD (RBAC)
        --------------------------------------------------------- */}
        <div className="lg:col-span-4 space-y-6">
          <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
             <div className="w-2 h-2 bg-nu-gold rounded-full"></div>
             {isPusat ? 'Global Monitoring' : `Wilayah ${userData?.region}`}
          </h3>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            {shelters.map(s => (
              <div 
                key={s.id} 
                onClick={() => handleSelectShelter(s)} 
                className={`p-6 rounded-[2.5rem] border-2 transition-all cursor-pointer hover:shadow-xl relative overflow-hidden ${activeShelter?.id === s.id ? 'bg-[#006432] border-[#006432] text-white shadow-2xl scale-[1.02]' : 'bg-white border-slate-50 shadow-sm'}`}
              >
                <div className="flex justify-between items-start relative z-10">
                  <h4 className="font-black text-xs uppercase leading-tight max-w-[70%]">{s.name}</h4>
                  <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${s.score < 60 ? 'bg-red-600 text-white animate-pulse' : 'bg-green-100 text-green-700'}`}>
                    {s.score < 60 ? 'KRITIS' : 'AMAN'}
                  </span>
                </div>
                <div className="mt-6 grid grid-cols-3 gap-3 relative z-10">
                  <MiniStat label="Jiwa" value={s.refugee_count} active={activeShelter?.id === s.id} />
                  <MiniStat label="SPM" value={`${s.score}%`} active={activeShelter?.id === s.id} />
                  <MiniStat label="Stok" value={s.stock_status} active={activeShelter?.id === s.id} />
                </div>
                {isPusat && <p className={`text-[7px] font-black mt-4 uppercase opacity-50 ${activeShelter?.id === s.id ? 'text-white' : 'text-nu-green'}`}>📍 PCNU {s.region}</p>}
                
                {/* Background Decoration */}
                <i className={`fas fa-tent absolute -right-4 -bottom-4 text-6xl opacity-5 rotate-12`}></i>
              </div>
            ))}
            {shelters.length === 0 && <div className="py-20 text-center text-slate-300 font-black uppercase italic text-xs">Belum ada posko aktif</div>}
          </div>
        </div>

        {/* ---------------------------------------------------------
            RIGHT COLUMN: OPERATIONAL TERMINAL
        --------------------------------------------------------- */}
        <div className="lg:col-span-8 bg-white rounded-[3.5rem] p-6 md:p-10 shadow-2xl border border-slate-50 min-h-[600px] flex flex-col">
          
          {view === 'activation' ? (
            <div className="space-y-8 animate-in zoom-in duration-300">
              <h3 className="text-xl font-black text-[#006432] uppercase italic flex items-center gap-3">
                 <i className="fas fa-map-location-dot"></i> Aktivasi Posko Baru
              </h3>
              <div className="grid grid-cols-1 gap-6">
                <Input label="Nama Posko" placeholder="Contoh: Posko Desa Gajahmungkur" value={activationForm.name} onChange={v => setActivationForm({...activationForm, name: v})} />
                
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Incident Terkait</label>
                   <select className="w-full p-4 bg-slate-50 rounded-2xl border-none shadow-inner font-bold text-sm" value={activationForm.incident_id} onChange={e => setActivationForm({...activationForm, incident_id: e.target.value})}>
                     <option value="">Pilih Kejadian</option>
                     {incidents.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
                   </select>
                </div>
                
                {/* GPS MODE TOGGLE */}
                <div className="flex gap-2">
                  <button 
                    onClick={() => setUseGps(true)}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${useGps ? 'bg-[#006432] text-white' : 'bg-slate-100 text-slate-400'}`}
                  >
                    <i className="fas fa-crosshairs mr-2"></i> Pakai GPS
                  </button>
                  <button 
                    onClick={() => setUseGps(false)}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${!useGps ? 'bg-[#006432] text-white' : 'bg-slate-100 text-slate-400'}`}
                  >
                    <i className="fas fa-pen mr-2"></i> Input Manual
                  </button>
                </div>
                
                {useGps ? (
                  <div className="h-48 bg-slate-100 rounded-[2rem] border-4 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-3">
                    <i className="fas fa-satellite-dish text-3xl animate-pulse"></i>
                    <p className="text-[10px] font-black uppercase tracking-widest text-center px-10">Menunggu sinyal GPS...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Latitude" type="decimal" placeholder="-7.xxx" value={activationForm.latitude} onChange={v => setActivationForm({...activationForm, latitude: v})} />
                    <Input label="Longitude" type="decimal" placeholder="110.xxx" value={activationForm.longitude} onChange={v => setActivationForm({...activationForm, longitude: v})} />
                    <Input label="Alamat Detail" placeholder="Jl. Desa No. RT/RW" value={activationForm.address} onChange={v => setActivationForm({...activationForm, address: v})} />
                    <Input label="Kapasitas (jiwa)" type="number" value={activationForm.capacity} onChange={v => setActivationForm({...activationForm, capacity: v})} />
                  </div>
                )}
                
                <button 
                  onClick={handleActivateShelter}
                  disabled={loading}
                  className="bg-[#006432] text-white py-5 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Aktifkan & Publish Posko'}
                </button>
              </div>
            </div>
          ) : activeShelter ? (
            <div className="flex-1 flex flex-col space-y-8">
              {/* Terminal Navigator */}
              <div className="flex flex-col md:flex-row justify-between items-center bg-slate-50 p-6 rounded-[2.5rem] gap-4 border border-slate-100 shadow-inner">
                <div className="text-center md:text-left leading-none">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Active Operational Terminal</span>
                  <h3 className="text-sm font-black text-[#006432] uppercase italic mt-1">{activeShelter.name}</h3>
                </div>
                <div className="flex gap-2">
                  {['A', 'B', 'C', 'D'].map(f => (
                    <button 
                      key={f} 
                      onClick={() => setView(`form_${f.toLowerCase()}`)} 
                      className={`w-10 h-10 rounded-xl font-black text-xs transition-all shadow-sm ${view === `form_${f.toLowerCase()}` ? 'bg-[#006432] text-white scale-110' : 'bg-white text-slate-400 hover:text-[#006432]'}`}
                    >
                      {f}
                    </button>
                  ))}
                  <button onClick={() => setView('menu')} className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs ${view==='menu' ? 'bg-nu-gold text-white' : 'bg-white text-slate-400'}`}><i className="fas fa-grid-2"></i></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {/* FORM A: PENGUNGSI */}
                {view === 'form_a' && (
                  <div className="space-y-6 animate-in slide-in-from-right duration-500">
                    <div className="flex justify-between items-end border-b pb-3 border-slate-100">
                      <h4 className="font-black text-slate-700 uppercase text-xs italic tracking-widest">Form A: Registrasi Pengungsi</h4>
                      <span className="text-[10px] font-mono text-[#006432] font-black">ID: {formA.id_pengungsi}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Input label="Nama Kepala Keluarga" value={formA.nama_kk} onChange={v => setFormA({...formA, nama_kk: v})} />
                      <Input label="NIK (16 Digit)" type="number" value={formA.nik} onChange={v => setFormA({...formA, nik: v})} />
                      <Input label="No WhatsApp" value={formA.no_hp} onChange={v => setFormA({...formA, no_hp: v})} />
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Kesehatan</label>
                        <select className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold border-none shadow-inner" value={formA.status_kesehatan} onChange={e => setFormA({...formA, status_kesehatan: e.target.value})}>
                          {['Sehat', 'Luka Ringan', 'Luka Berat', 'Sakit Kronis'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Klasifikasi Kelompok Rentan (P0)</label>
                      <div className="flex flex-wrap gap-2">
                        {['Balita', 'Ibu Hamil/Menyusui', 'Lansia', 'Disabilitas'].map(r => (
                          <label key={r} className={`px-5 py-3 rounded-2xl text-[10px] font-black border-2 cursor-pointer transition-all ${formA.rentan.includes(r) ? 'bg-nu-gold border-nu-gold text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-nu-green/30'}`}>
                            <input type="checkbox" className="hidden" onChange={() => setFormA({ ...formA, rentan: formA.rentan.includes(r) ? formA.rentan.filter(x => x !== r) : [...formA.rentan, r] })} /> 
                            <i className={`fas ${formA.rentan.includes(r) ? 'fa-check-circle' : 'fa-circle'} mr-2`}></i> {r}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                      <Input label="Kecamatan Asal" value={formA.kecamatan_asal} onChange={v => setFormA({...formA, kecamatan_asal: v})} />
                      <Input label="Desa Asal" value={formA.desa_asal} onChange={v => setFormA({...formA, desa_asal: v})} />
                    </div>
                    <SubmitBtn onClick={() => handleSubmitForm('a', formA)} loading={loading} />
                  </div>
                )}

                {/* FORM B: LOGISTIK (FIFO BASED) */}
                {view === 'form_b' && (
                  <div className="space-y-6 animate-in slide-in-from-right duration-500 pb-10">
                    <div className="flex justify-between items-center border-b pb-3 border-slate-100">
                       <h4 className="font-black text-slate-700 uppercase text-xs italic">Form B: Warehouse & Logistics</h4>
                       <button 
                        onClick={() => setFormB({...formB, is_request_pwnu: !formB.is_request_pwnu})}
                        className={`px-4 py-2 rounded-xl text-[9px] font-black transition-all ${formB.is_request_pwnu ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}
                       >
                        {formB.is_request_pwnu ? '🚀 REQUEST KE PWNU' : '📦 STOK MANDIRI POSKO'}
                       </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Kategori Aset</label>
                        <select className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold border-none shadow-inner" value={formB.kategori} onChange={e => setFormB({...formB, kategori: e.target.value})}>
                          {['Peralatan DU', 'Komunikasi', 'Tenda/Hunian', 'ATK', 'Logistik Pangan', 'Medis'].map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </div>

                      {formB.is_request_pwnu ? (
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Pilih Barang (Inventori Pusat)</label>
                          <select 
                            className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold border-none shadow-inner" 
                            value={formB.inventory_id} 
                            onChange={e => setFormB({...formB, inventory_id: e.target.value})}
                          >
                            <option value="">-- Pilih Barang --</option>
                            {inventory.map(i => <option key={i.id} value={i.id}>{i.name} (Stok: {i.available_quantity})</option>)}
                          </select>
                        </div>
                      ) : (
                        <Input label="Nama Barang" placeholder="Contoh: Beras Raja Lele" value={formB.nama_barang} onChange={v => setFormB({...formB, nama_barang: v})} />
                      )}

                      {!formB.is_request_pwnu && (
                        <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Transaksi</label>
                        <select className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold border-none shadow-inner" value={formB.transaksi} onChange={e => setFormB({...formB, transaksi: e.target.value})}>
                           <option value="Masuk">Masuk (Donasi/Drop)</option>
                           <option value="Keluar">Keluar (Distribusi)</option>
                        </select>
                      </div>
                      )}

                      <Input label="Jumlah Unit/Pax" type="number" value={formB.jumlah} onChange={v => setFormB({...formB, jumlah: v})} />
                    </div>
                    
                    {!formB.is_request_pwnu && <Input label="Tanggal Kadaluwarsa (Penting untuk FIFO)" type="date" value={formB.kadaluwarsa} onChange={v => setFormB({...formB, kadaluwarsa: v})} />}
                    
                    {formB.is_request_pwnu && (
                      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200">
                        <p className="text-[10px] font-bold text-amber-800 leading-relaxed italic">
                          Permintaan ini akan diteruskan ke dashboard Logistik PWNU Jawa Tengah untuk ditinjau dan dikirimkan ke lokasi posko Anda.
                        </p>
                      </div>
                    )}

                    <SubmitBtn 
                      label={formB.is_request_pwnu ? "Kirim Request ke PWNU" : "Simpan Log Inbound/Outbound"}
                      onClick={() => handleSubmitForm('b', formB)} 
                      loading={loading} 
                    />
                    
                    {/* PIPELINE VIEW TOGGLE */}
                    <button onClick={() => setView('logistics_pipeline')} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase hover:bg-slate-50 transition-all mt-4">
                      Lihat Pipeline Pengiriman dari Pusat ➔
                    </button>
                  </div>
                )}

                {/* LOGISTICS PIPELINE (MERGED FROM LOGISTIC HUB) */}
                {view === 'logistics_pipeline' && (
                  <div className="space-y-6 animate-in slide-in-from-right duration-500">
                     <div className="flex justify-between items-center border-b pb-3 border-slate-100">
                        <h4 className="font-black text-slate-700 uppercase text-xs italic">Logistics Pipeline: Inbound from PWNU</h4>
                        <span className="text-[8px] bg-nu-green text-white px-2 py-0.5 rounded uppercase">Stock Inbounded Auto-Sync</span>
                     </div>
                     <div className="space-y-3">
                        {requests.filter(r => isPusat || r.shelter_id === activeShelter.id).map(r => (
                          <div key={r.id} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 shadow-sm">
                             <div className="flex justify-between items-center">
                                <div className="flex-1">
                                   <p className="text-xs font-black text-slate-800 uppercase">{r.item_name} <span className="text-slate-400 ml-1 font-normal">x{r.quantity_requested || r.quantity}</span></p>
                                   <p className="text-[7px] text-slate-400 font-bold uppercase mt-1">📍 {r.requester_region || userData.region} • Untuk: {r.incident_title || 'Misi Taktis'}</p>
                                   {r.proof_of_delivery && (
                                     <button onClick={() => alert("Menampilkan Bukti Foto...")} className="text-[8px] text-blue-600 font-bold uppercase mt-1 underline"><i className="fas fa-camera mr-1"></i> Lihat Bukti Terima</button>
                                   )}
                                </div>
                                <div className="text-right px-4">
                                <p className="text-[8px] font-bold text-slate-400 uppercase">
                                  Status: <span className={['shipped', 'pending'].includes(r.status) ? 'text-orange-600 animate-pulse' : 'text-nu-green'}>{r.status?.toUpperCase()}</span>
                                </p>
                             </div>
                             <div className="flex gap-2">
                             {isPusat && r.status === 'pending' && (
                               <div className="flex gap-2">
                                  <button onClick={() => handleUpdatePipelineStatus(r.id, 'approved')} className="bg-nu-green text-white p-2 px-4 rounded-xl text-[9px] font-black uppercase">Approve</button>
                                  <button onClick={() => handleUpdatePipelineStatus(r.id, 'rejected')} className="bg-red-600 text-white p-2 px-4 rounded-xl text-[9px] font-black uppercase">Reject</button>
                               </div>
                             )}
                             {isPusat && r.status === 'approved' && (
                               <div className="flex gap-2">
                                  <button onClick={() => handleExportManifest(r)} className="bg-slate-800 text-white p-2 px-4 rounded-xl text-[9px] font-black uppercase"><i className="fas fa-file-pdf mr-1"></i> Manifest</button>
                                  <button onClick={() => handleUpdatePipelineStatus(r.id, 'shipped')} className="bg-orange-500 text-white p-2 px-4 rounded-xl text-[9px] font-black uppercase">🚀 Kirim</button>
                               </div>
                             )}
                             {r.status === 'shipped' && (
                                <button onClick={() => handleUpdatePipelineStatus(r.id, 'delivered')} className="bg-[#006432] text-white p-2 px-4 rounded-xl text-[9px] font-black uppercase">✅ Konfirmasi Terima</button>
                             )}
                             {r.status === 'delivered' && (
                                <span className="text-[18px] text-nu-green"><i className="fas fa-check-circle"></i></span>
                             )}
                             </div>
                             </div>
                          </div>
                        ))}
                        {requests.length === 0 && <p className="text-center py-20 text-[9px] font-black text-slate-300 uppercase italic">Tidak ada antrian pengiriman</p>}
                     </div>
                     <button onClick={() => setView('menu')} className="w-full py-4 bg-slate-100 rounded-2xl text-[10px] font-black text-slate-400 uppercase">Kembali ke Menu Utama</button>
                  </div>
                )}

                {/* FORM C: MEDIS & SPM */}
                {view === 'form_c' && (
                  <div className="space-y-6 animate-in slide-in-from-right duration-500">
                    <h4 className="font-black text-slate-700 uppercase text-xs italic border-b pb-3 border-slate-100">Form C: Morbiditas & Sanitasi</h4>
                    <Input label="Nama Tenaga Medis Bertugas" placeholder="dr. Ahmad / Perawat Siti" value={formC.tenaga_medis} onChange={v => setFormC({...formC, tenaga_medis: v})} />
                    <div className="grid grid-cols-3 gap-4">
                      <Input label="Kasus ISPA" type="number" value={formC.morbiditas.ispa} onChange={v => setFormC({...formC, morbiditas: {...formC.morbiditas, ispa: v}})} />
                      <Input label="Kasus Diare" type="number" value={formC.morbiditas.diare} onChange={v => setFormC({...formC, morbiditas: {...formC.morbiditas, diare: v}})} />
                      <Input label="Penyakit Kulit" type="number" value={formC.morbiditas.kulit} onChange={v => setFormC({...formC, morbiditas: {...formC.morbiditas, kulit: v}})} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100 shadow-inner">
                      <Input label="Volume Air Bersih (Liter)" type="number" value={formC.air_bersih} onChange={v => setFormC({...formC, air_bersih: v})} />
                      <Input label="Jamban Fungsional" type="number" value={formC.jamban} onChange={v => setFormC({...formC, jamban: v})} />
                    </div>
                    {/* AUDIT SPM LOGIC (P1) */}
                    {activeShelter.refugee_count > 0 && formC.jamban > 0 && (formC.jamban < activeShelter.refugee_count / 20) && (
                      <div className="p-4 bg-red-100 border-l-8 border-red-600 text-red-700 text-[10px] font-black uppercase shadow-lg animate-pulse rounded-r-xl">
                        <i className="fas fa-triangle-exclamation mr-2"></i> Peringatan SPM: Rasio Jamban ({formC.jamban}) Tidak Mencukupi untuk {activeShelter.refugee_count} orang!
                      </div>
                    )}
                    <SubmitBtn onClick={() => handleSubmitForm('c', formC)} loading={loading} />
                  </div>
                )}

                {/* FORM D: SDM & HR */}
                {view === 'form_d' && (
                  <div className="space-y-6 animate-in slide-in-from-right duration-500">
                    <h4 className="font-black text-slate-700 uppercase text-xs italic border-b pb-3 border-slate-100">Form D: HR Assignment</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Input label="Nama Petugas" value={formD.nama} onChange={v => setFormD({...formD, nama: v})} />
                      <Input label="NIK" type="number" value={formD.nik} onChange={v => setFormD({...formD, nik: v})} />
                      <Input label="Instansi" placeholder="BPBD / Bagana / LazisNU" value={formD.instansi} onChange={v => setFormD({...formD, instansi: v})} />
                      <Input label="Nomor WhatsApp" value={formD.no_hp} onChange={v => setFormD({...formD, no_hp: v})} />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Kompetensi</label>
                        <select className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold border-none shadow-inner" value={formD.kompetensi} onChange={e => setFormD({...formD, kompetensi: e.target.value})}>
                          {['Medis', 'Dapur Umum', 'IT-Data', 'Evakuasi', 'Psikososial'].map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Shift</label>
                        <select className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold border-none shadow-inner" value={formD.shift} onChange={e => setFormD({...formD, shift: e.target.value})}>
                          {['Pagi', 'Sore', 'Malam'].map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </div>
                    </div>
                    <SubmitBtn onClick={() => handleSubmitForm('d', formD)} loading={loading} />
                  </div>
                )}

                {/* MAIN MENU TERMINAL */}
                {view === 'menu' && (
                  <div className="grid grid-cols-2 gap-6 py-10">                    
                    <MenuIcon icon="users-rays" label="Data Jiwa" sub="Form A" color="bg-[#006432]" onClick={() => setView('form_a')} />
                    <MenuIcon icon="box-archive" label="Logistik" sub="Form B" color="bg-[#c5a059]" onClick={() => setView('form_b')} />
                    <MenuIcon icon="house-medical" label="Layanan Medis" sub="Form C" color="bg-red-600" onClick={() => setView('form_c')} />
                    <MenuIcon icon="user-shield" label="Penugasan" sub="Form D" color="bg-slate-800" onClick={() => setView('form_d')} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-30 p-20">
               <i className="fas fa-microchip text-8xl mb-6"></i>
               <p className="font-black uppercase tracking-[0.4em] text-xs">Pilih Posko Untuk Mengakses Terminal Operasional</p>
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------
          STAGE 5: TRUST REPORTING (FOOTER)
      --------------------------------------------------------- */}
      <div className="bg-[#006432] p-8 md:p-12 rounded-[4rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-10 overflow-hidden relative group">
        <div className="relative z-10 text-center md:text-left">
          <h4 className="text-2xl font-black text-white uppercase italic leading-none tracking-tighter">Real-Time Trust Matrix</h4>
          <p className="text-[10px] font-bold text-green-200 uppercase tracking-widest mt-4 max-w-md">Otomatisasi Laporan Akuntabilitas untuk Donatur dan Masyarakat Luas.</p>
        </div>
        <button className="relative z-10 bg-nu-gold text-[#006432] px-12 py-5 rounded-[2rem] font-black uppercase text-[11px] shadow-2xl active:scale-95 hover:bg-white transition-all">
          Publish Integrated Sitrep
        </button>
        <i className="fas fa-file-contract absolute -right-10 -bottom-10 text-[15rem] text-white/5 rotate-12 group-hover:rotate-0 transition-transform duration-1000"></i>
      </div>
    </div>
  );
};

// --- MINI COMPONENTS ---

const Input = ({ label, value, onChange, type = "text", placeholder }) => (
  <div className="space-y-1">
    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">{label}</label>
    <input 
      type={type} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold shadow-inner outline-none focus:ring-2 ring-nu-green/20" 
      placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} 
    />
  </div>
);

const SubmitBtn = ({ onClick, loading }) => (
  <button 
    onClick={onClick} disabled={loading}
    className="w-full bg-[#006432] text-white py-5 rounded-[2rem] font-black uppercase text-[11px] shadow-xl active:scale-95 transition-all mt-6 shadow-[#006432]/30 flex items-center justify-center gap-3"
  >
    {loading ? 'Transmitting Encryption...' : 'Simpan Laporan Taktis ✓'}
  </button>
);

const MenuIcon = ({ icon, label, sub, color, onClick }) => (
  <button onClick={onClick} className={`${color} p-10 rounded-[3.5rem] text-white flex flex-col items-center justify-center gap-4 shadow-xl active:scale-90 transition-all border-b-[8px] border-black/20 hover:translate-y-[-5px]`}>
    <i className={`fas fa-${icon} text-4xl`}></i>
    <div className="text-center"><p className="text-sm font-black leading-none uppercase italic">{label}</p><span className="text-[8px] font-bold opacity-60 uppercase tracking-widest mt-2 block">{sub}</span></div>
  </button>
);

const MiniStat = ({ label, value, active }) => (
  <div className={`p-3 rounded-2xl text-center ${active ? 'bg-white/10' : 'bg-slate-50'}`}>
    <p className={`text-xs font-black leading-none ${active ? 'text-nu-gold' : 'text-slate-800'}`}>{value}</p>
    <p className={`text-[7px] font-black uppercase mt-1 leading-none ${active ? 'text-white/60' : 'text-slate-400'}`}>{label}</p>
  </div>
);

export default ShelterManagement;