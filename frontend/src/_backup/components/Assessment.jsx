import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { NEED_CATEGORIES, DISASTER_TYPES, KAB_JATENG } from '../utils/constants'; // Import constants

const Assessment = ({ incident, onBack }) => {
  // State Dropdown Wilayah
  const [listKab, setListKab] = useState([]);
  const [listKec, setListKec] = useState([]);
  const [listDesa, setListDesa] = useState([]);

  // Form State (Semua Field dari pwnu_assess.html)
  const [data, setData] = useState({
    // I. Identitas & Lokasi
    disaster_type: incident.disaster_type || '',
    region: incident.region || '',
    kecamatan: incident.kecamatan || '',
    desa: incident.desa || '',
    alamat_spesifik: incident.alamat_spesifik || '',
    event_date: new Date().toISOString().split('T')[0],
    event_time: "12:00",
    latitude: incident.latitude || 0,
    longitude: incident.longitude || 0,

    // II. Narasi
    kondisi_mutakhir: incident.kondisi_mutakhir || '',
    upaya_penanganan: incident.upaya_penanganan || '',
    sebaran_dampak: incident.sebaran_dampak || '',

    // III. Kebutuhan (Essay)
    kebutuhan: incident.kebutuhan || { dana: '', relawan: '', logistik: '', peralatan: '', medis: '' },
    
    // III-b. Kebutuhan Logistik Spesifik (Untuk Gap Analysis PRD)
    // Menyimpan data numerik: { sembako: 500, selimut: 200, ... }
    needs_numeric: incident.needs_numeric || {},

    // IV. Dampak Manusia (Jiwa) - Format BNPB
    dampak_manusia: incident.dampak_manusia || { 
      meninggal: 0, 
      luka_ringan: 0, 
      luka_berat: 0, 
      dampak_manusia: 0, 
      pengungsi_jiwa: 0, 
      pengungsi_kk: 0,
      hilang: 0
    },

    // V. Kerusakan Rumah (Unit) - Format BNPB
    dampak_rumah: incident.dampak_rumah || { 
      ringan: 0, 
      sedang: 0, 
      berat: 0 
    },

    // V-b. Fasilitas Umum - Format BNPB
    dampak_fasum: incident.dampak_fasum || { 
      sanitas: 0, 
      pendidikan: 0, 
      kesehatan: 0, 
      ibadah: 0, 
      komunikasi: 0, 
      listrik: 0, 
      kantor: 0, 
      jembatan: 0,
      pasar: 0,
      spbu: 0
    },

    // VI. Sarana Vital & Lingkungan
    dampak_vital: incident.dampak_vital || { air: 0, listrik: 0, telkom: 0, irigasi: 0, jalan: 0, spbu: 0 },
    dampak_lingkungan: incident.dampak_lingkungan || { sawah: 0, ternak: 0 }
  });

   // Load API Wilayah & Existing Data
   useEffect(() => {
     fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/33.json`).then(r => r.json()).then(setListKab);
     
     // Load existing assessment data if available
     if (incident.id) {
       api.get(`incidents/${incident.id}`).then(res => {
         const d = res.data;
         if (d) {
           setData(prev => ({
             ...prev,
             kecamatan: d.kecamatan || prev.kecamatan,
             desa: d.desa || prev.desa,
             alamat_spesifik: d.alamat_spesifik || prev.alamat_spesifik,
             kondisi_mutakhir: d.kondisi_mutakhir || prev.kondisi_mutakhir,
             dampak_manusia: d.dampak_manusia || prev.dampak_manusia,
             dampak_rumah: d.dampak_rumah || prev.dampak_rumah,
             dampak_fasum: d.dampak_fasum || prev.dampak_fasum,
             dampak_vital: d.dampak_vital || prev.dampak_vital,
             dampak_lingkungan: d.dampak_lingkungan || prev.dampak_lingkungan,
             needs_numeric: d.needs_numeric || prev.needs_numeric,
             event_date: d.event_date ? new Date(d.event_date).toISOString().split('T')[0] : prev.event_date
           }));
         }
       }).catch(err => console.error("Failed to load assessment data", err));
     }
   }, [incident.id]);

  const changeKab = (id, name) => {
    setData({...data, region: name});
    fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/districts/${id}.json`).then(r => r.json()).then(setListKec);
  };

  const changeKec = (id, name) => {
    setData({...data, kecamatan: name});
    fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/villages/${id}.json`).then(r => r.json()).then(setListDesa);
  };

  const handleSave = async () => {
    try {
      await api.patch(`incidents/${incident.id}/assessment`, data);
      alert("Assessment Berhasil Diperbarui!");
      if (onBack) {
        onBack();
      }
    } catch (e) { alert("Gagal Simpan. Cek koneksi backend."); }
  };

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] font-sans">
      {/* HEADER STICKY */}
      <div className="p-4 border-b flex justify-between items-center bg-white shadow-sm sticky top-0 z-50">
        <button onClick={onBack} className="text-nu-green font-black text-xs uppercase tracking-widest flex items-center gap-2">
          <i className="fas fa-chevron-left"></i> Batal
        </button>
        <h2 className="font-black text-nu-green uppercase italic tracking-tighter">Detailed Assessment PWNU Jateng</h2>
        <button onClick={handleSave} className="bg-nu-green text-white px-8 py-2 rounded-full font-black text-xs shadow-lg hover:bg-green-800 transition-all uppercase tracking-widest">
          Update Data Mutakhir
        </button>
      </div>

       <div className="flex-1 overflow-y-auto p-6 space-y-10 pb-40">
         
         {/* QUICK NAVIGATION */}
         <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap gap-2 sticky top-0 z-40">
           {['I. Lokasi', 'II. Narasi', 'III. Kebutuhan', 'IV. Dampak Jiwa', 'V. Kerusakan', 'VI. Sarana Vital'].map((label, idx) => (
             <button key={idx} onClick={() => {
               const sections = document.querySelectorAll('section');
               if (sections[idx]) sections[idx].scrollIntoView({ behavior: 'smooth' });
             }} className="px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-black uppercase text-slate-600 hover:bg-[#006432] hover:text-white transition-all">
               {label}
             </button>
           ))}
         </div>
         
         {/* SEKSI I: LOKASI & WAKTU */}
        <section className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
          <SectionTitle icon="map-marked-alt" title="I. Identitas, Lokasi & Waktu" />
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="flex flex-col gap-1 flex-1">
               <label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-widest">Kabupaten (Zonasi)</label>
               <select className="p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold shadow-inner" value={data.region} onChange={e => changeKab(e.target.value, e.target.options[e.target.selectedIndex].text)}>
                  <option value="">Pilih Kabupaten</option>
                  {listKab.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
               </select>
            </div>
            <SelectField label="Kecamatan" options={listKec} onChange={(id, name) => changeKec(id, name)} />
            <SelectField label="Desa / Kelurahan" options={listDesa} onChange={(id, name) => setData({...data, desa: name})} />
          </div>
          <div className="grid grid-cols-2 gap-6">
             <InputField label="Alamat Spesifik (RT/RW/Dukuh)" placeholder="Contoh: RT 02 RW 01 Dusun Krajan" value={data.alamat_spesifik} onChange={v => setData({...data, alamat_spesifik: v})} />
             <div className="grid grid-cols-2 gap-4">
                <InputField label="Tanggal Kejadian" type="date" value={data.event_date} onChange={v => setData({...data, event_date: v})} />
                <InputField label="Waktu" type="time" value={data.event_time} onChange={v => setData({...data, event_time: v})} />
             </div>
          </div>
        </section>

        {/* SEKSI II: NARASI */}
        <section className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-6">
          <SectionTitle icon="edit" title="II. Narasi Laporan" />
          <TextAreaField label="Kondisi Mutakhir" placeholder="Update situasi terkini..." value={data.kondisi_mutakhir} onChange={v => setData({...data, kondisi_mutakhir: v})} />
          <TextAreaField label="Upaya Penanganan" placeholder="Langkah yang sudah diambil..." value={data.upaya_penanganan} onChange={v => setData({...data, upaya_penanganan: v})} />
          <TextAreaField label="Sebaran Dampak" placeholder="Luasan wilayah terdampak..." value={data.sebaran_dampak} onChange={v => setData({...data, sebaran_dampak: v})} />
        </section>

        {/* SEKSI III: KEBUTUHAN */}
        <section className="bg-green-50 p-8 rounded-[40px] border border-green-100 shadow-sm">
           <SectionTitle icon="shopping-basket" title="III. Kebutuhan Mendesak (Essay)" color="text-green-800" />
           <div className="grid grid-cols-3 gap-6">
              <InputField label="Dana" value={data.kebutuhan.dana} onChange={v => setData({...data, kebutuhan: {...data.kebutuhan, dana: v}})} />
              <InputField label="Relawan" value={data.kebutuhan.relawan} onChange={v => setData({...data, kebutuhan: {...data.kebutuhan, relawan: v}})} />
              <InputField label="Logistik" value={data.kebutuhan.logistik} onChange={v => setData({...data, kebutuhan: {...data.kebutuhan, logistik: v}})} />
           </div>
           
           <div className="mt-8 pt-8 border-t border-green-200">
              <p className="text-[10px] font-black text-green-700 uppercase mb-4 italic">Kebutuhan Numerik (Untuk Transparansi Publik):</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                 {NEED_CATEGORIES.map(cat => (
                    <div key={cat.id}>
                       <label className="text-[8px] font-black text-slate-400 uppercase ml-2 mb-1 block">{cat.label} ({cat.unit})</label>
                       <input type="number" className="w-full p-3 bg-white border border-green-100 rounded-xl text-xs font-bold" 
                        value={data.needs_numeric[cat.id] || 0} onChange={e => setData({...data, needs_numeric: {...data.needs_numeric, [cat.id]: parseInt(e.target.value) || 0}})} />
                    </div>
                 ))}
              </div>
           </div>
        </section>

        {/* SEKSI IV: DAMPAK JIWA */}
        <section className="bg-red-50 p-8 rounded-[40px] border border-red-100 shadow-sm">
          <SectionTitle icon="users" title="IV. Dampak Manusia (Jiwa)" color="text-red-700" />
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            <NumberInput label="Meninggal Dunia" value={data.dampak_manusia.meninggal} onChange={v => setData({...data, dampak_manusia: {...data.dampak_manusia, meninggal: v}})} />
            <NumberInput label="Luka Ringan" value={data.dampak_manusia.luka_ringan} onChange={v => setData({...data, dampak_manusia: {...data.dampak_manusia, luka_ringan: v}})} />
            <NumberInput label="Luka Berat" value={data.dampak_manusia.luka_berat} onChange={v => setData({...data, dampak_manusia: {...data.dampak_manusia, luka_berat: v}})} />
            <NumberInput label="Dampak Manusia" value={data.dampak_manusia.dampak_manusia} onChange={v => setData({...data, dampak_manusia: {...data.dampak_manusia, dampak_manusia: v}})} />
            <NumberInput label="Pengungsi (Jiwa)" value={data.dampak_manusia.pengungsi_jiwa} onChange={v => setData({...data, dampak_manusia: {...data.dampak_manusia, pengungsi_jiwa: v}})} />
            <NumberInput label="Pengungsi (KK)" value={data.dampak_manusia.pengungsi_kk} onChange={v => setData({...data, dampak_manusia: {...data.dampak_manusia, pengungsi_kk: v}})} />
          </div>
        </section>

        {/* SEKSI V: KERUSAKAN RUMAH */}
        <section className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 shadow-sm">
          <SectionTitle icon="home" title="V. Kerusakan Rumah (Unit)" color="text-slate-700" />
          <div className="grid grid-cols-3 gap-6">
            <NumberInput label="Rusak Ringan" value={data.dampak_rumah.ringan} onChange={v => setData({...data, dampak_rumah: {...data.dampak_rumah, ringan: v}})} />
            <NumberInput label="Rusak Sedang" value={data.dampak_rumah.sedang} onChange={v => setData({...data, dampak_rumah: {...data.dampak_rumah, sedang: v}})} />
            <NumberInput label="Rusak Berat" value={data.dampak_rumah.berat} onChange={v => setData({...data, dampak_rumah: {...data.dampak_rumah, berat: v}})} />
          </div>
        </section>

        {/* SEKSI VI: FASILITAS UMUM */}
        <section className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 shadow-sm">
          <SectionTitle icon="building" title="VI. Fasilitas Umum" color="text-slate-700" />
          <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
            <NumberInput label="Sanitasi/MCK Umum" value={data.dampak_fasum.sanitas} onChange={v => setData({...data, dampak_fasum: {...data.dampak_fasum, sanitas: v}})} />
            <NumberInput label="Fasilitas Pendidikan" value={data.dampak_fasum.pendidikan} onChange={v => setData({...data, dampak_fasum: {...data.dampak_fasum, pendidikan: v}})} />
            <NumberInput label="Fasilitas Kesehatan" value={data.dampak_fasum.kesehatan} onChange={v => setData({...data, dampak_fasum: {...data.dampak_fasum, kesehatan: v}})} />
            <NumberInput label="Tempat Ibadah" value={data.dampak_fasum.ibadah} onChange={v => setData({...data, dampak_fasum: {...data.dampak_fasum, ibadah: v}})} />
            <NumberInput label="Fasilitas Komunikasi" value={data.dampak_fasum.komunikasi} onChange={v => setData({...data, dampak_fasum: {...data.dampak_fasum, komunikasi: v}})} />
            <NumberInput label="Jaringan Listrik" value={data.dampak_fasum.listrik} onChange={v => setData({...data, dampak_fasum: {...data.dampak_fasum, listrik: v}})} />
            <NumberInput label="Kantor Pemerintahan" value={data.dampak_fasum.kantor} onChange={v => setData({...data, dampak_fasum: {...data.dampak_fasum, kantor: v}})} />
            <NumberInput label="Fasilitas Publik (Jembatan)" value={data.dampak_fasum.jembatan} onChange={v => setData({...data, dampak_fasum: {...data.dampak_fasum, jembatan: v}})} />
            <NumberInput label="Pasar" value={data.dampak_fasum.pasar} onChange={v => setData({...data, dampak_fasum: {...data.dampak_fasum, pasar: v}})} />
            <NumberInput label="SPBU" value={data.dampak_fasum.spbu} onChange={v => setData({...data, dampak_fasum: {...data.dampak_fasum, spbu: v}})} />
          </div>
        </section>

        {/* SEKSI VI: SARANA VITAL */}
        <section className="bg-blue-50 p-8 rounded-[40px] border border-blue-100 shadow-sm">
           <SectionTitle icon="faucet" title="VI. Sarana Vital & Lingkungan" color="text-blue-800" />
           <div className="grid grid-cols-6 gap-4 mb-8">
              {Object.keys(data.dampak_vital).map(k => (
                <NumberInput key={k} label={k} value={data.dampak_vital[k]} onChange={v => setData({...data, dampak_vital: {...data.dampak_vital, [k]: v}})} />
              ))}
           </div>
           <div className="grid grid-cols-2 gap-6 pt-6 border-t border-blue-200">
              <NumberInput label="Sawah (Ha)" value={data.dampak_lingkungan.sawah} onChange={v => setData({...data, dampak_lingkungan: {...data.dampak_lingkungan, sawah: v}})} />
              <NumberInput label="Ternak (Ekor)" value={data.dampak_lingkungan.ternak} onChange={v => setData({...data, dampak_lingkungan: {...data.dampak_lingkungan, ternak: v}})} />
           </div>
        </section>

      </div>
    </div>
  );
};

// UI REUSABLE HELPERS
const SectionTitle = ({ icon, title, color = "text-nu-green" }) => (
  <div className={`flex items-center gap-3 mb-6 ${color}`}>
    <div className="w-10 h-10 rounded-2xl bg-current bg-opacity-10 flex items-center justify-center">
      <i className={`fas fa-${icon} text-lg`}></i>
    </div>
    <h3 className="font-black uppercase text-xs tracking-[0.2em]">{title}</h3>
  </div>
);

const InputField = ({ label, value, onChange, type = "text", placeholder }) => (
  <div className="flex flex-col gap-1 flex-1">
    <label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-widest">{label}</label>
    <input type={type} className="p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 ring-nu-green transition-all" 
      placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
  </div>
);

const SelectField = ({ label, options, onChange }) => (
  <div className="flex flex-col gap-1 flex-1">
    <label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-widest">{label}</label>
    <select className="p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold shadow-inner" 
      onChange={e => onChange(e.target.value, e.target.options[e.target.selectedIndex].text)}>
      <option value="">Pilih {label}</option>
      {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  </div>
);

const TextAreaField = ({ label, value, onChange, placeholder }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-widest">{label}</label>
    <textarea className="p-5 bg-slate-50 border-none rounded-[30px] text-sm font-medium shadow-inner" 
      rows="3" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
  </div>
);

const NumberInput = ({ label, value, onChange }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[9px] font-black text-slate-400 uppercase text-center mb-1">{label}</label>
    <input type="number" className="p-4 bg-white border border-slate-100 rounded-[20px] text-center font-black text-xl shadow-sm focus:ring-2 ring-nu-green" 
      value={value} onChange={e => onChange(parseInt(e.target.value) || 0)} />
  </div>
);

export default Assessment;