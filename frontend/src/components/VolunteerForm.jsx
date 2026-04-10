import React, { useState } from 'react';
import api from '../services/api';

const VolunteerForm = ({ onBack }) => {
  const [form, setForm] = useState({
    full_name: '', phone: '', birth_date: '', gender: 'Laki-laki', blood_type: '',
    regency: '', district: '', village: '', detail_address: '',
    is_domicile_same: true, domicile_address: '', latitude: '', longitude: '',
    medical_history: '', expertise: [], experience: ''
  });

  const expertiseOptions = [
    "Analisis Risiko Bencana", "Perencanaan Kontinjensi", "Kebijakan & Kelembagaan", 
    "Pemetaan & SIG", "SAR", "Rapid Assessment", "Logistik & Dapur Umum", 
    "Manajemen Pengungsian", "Kesehatan/Medis", "Infrastruktur", "Sanitasi", 
    "Psikososial & Trauma Healing", "Pemulihan Ekonomi", "Relawan & Komunikasi", 
    "Transportasi (Driver)", "Penunjang (Alat Berat)"
  ];

  const handleExpertise = (val) => {
    setForm(prev => ({
      ...prev,
      expertise: prev.expertise.includes(val) 
        ? prev.expertise.filter(i => i !== val) 
        : [...prev.expertise, val]
    }));
  };

  const submit = async () => {
    try {
      await api.post('inventory/volunteers', form);
      alert("Relawan Berhasil Didata!");
      onBack();
    } catch (e) { alert("Gagal Simpan"); }
  };

  return (
    <div className="h-full bg-white flex flex-col overflow-hidden font-sans">
      <div className="p-4 border-b flex justify-between items-center bg-slate-50 shadow-sm">
        <button onClick={onBack} className="text-nu-green font-black text-xs">← BATAL</button>
        <h2 className="font-black text-nu-green uppercase tracking-widest italic">Pendaftaran Personil Relawan</h2>
        <button onClick={submit} className="bg-nu-green text-white px-8 py-2 rounded-full font-black text-xs shadow-lg uppercase">Simpan Personil</button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-10 pb-32">
        {/* SEKSI 1: BIODATA */}
        <section className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="font-black text-slate-400 text-[10px] uppercase border-b pb-2 tracking-widest">Identitas Dasar</h3>
            <Input label="Nama Lengkap" onChange={v => setForm({...form, full_name: v})} />
            <Input label="No. HP / WhatsApp" onChange={v => setForm({...form, phone: v})} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Tanggal Lahir" type="date" onChange={v => setForm({...form, birth_date: v})} />
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase ml-2">Jenis Kelamin</label>
                <select className="w-full p-3 bg-slate-100 rounded-xl border-none text-sm font-bold mt-1" onChange={e => setForm({...form, gender: e.target.value})}>
                  <option>Laki-laki</option><option>Perempuan</option>
                </select>
              </div>
            </div>
          </div>
          <div className="space-y-4">
             <h3 className="font-black text-slate-400 text-[10px] uppercase border-b pb-2 tracking-widest">Kesehatan & Lokasi</h3>
             <Input label="Golongan Darah" placeholder="O / A / B / AB" onChange={v => setForm({...form, blood_type: v})} />
             <Input label="Riwayat Penyakit" onChange={v => setForm({...form, medical_history: v})} />
             <div className="grid grid-cols-2 gap-4">
                <Input label="Lat" placeholder="GPS Lat" onChange={v => setForm({...form, latitude: v})} />
                <Input label="Lng" placeholder="GPS Lng" onChange={v => setForm({...form, longitude: v})} />
             </div>
          </div>
        </section>

        {/* SEKSI 2: KEAHLIAN (MULTI-SELECT) */}
        <section>
          <h3 className="font-black text-slate-400 text-[10px] uppercase border-b pb-4 tracking-widest mb-4">Bidang Keahlian (Bisa pilih lebih dari satu)</h3>
          <div className="grid grid-cols-4 gap-2">
            {expertiseOptions.map(opt => (
              <div 
                key={opt} 
                onClick={() => handleExpertise(opt)}
                className={`p-3 rounded-xl border text-[10px] font-bold cursor-pointer transition-all ${form.expertise.includes(opt) ? 'bg-nu-green text-white border-nu-green shadow-md' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-nu-green'}`}
              >
                {opt}
              </div>
            ))}
          </div>
        </section>

        {/* SEKSI 3: PENGALAMAN */}
        <section>
           <h3 className="font-black text-slate-400 text-[10px] uppercase border-b pb-2 tracking-widest mb-4">Pengalaman Penanganan Bencana</h3>
           <textarea 
             className="w-full p-4 bg-slate-50 border-none rounded-3xl text-sm font-medium h-32 focus:ring-2 ring-nu-green transition-all shadow-inner"
             placeholder="Bencana apa, kapan, dimana, sebagai apa..."
             onChange={e => setForm({...form, experience: e.target.value})}
           ></textarea>
        </section>
      </div>
    </div>
  );
};

const Input = ({ label, type = "text", placeholder, onChange }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[9px] font-bold text-slate-400 uppercase ml-2 tracking-widest">{label}</label>
    <input type={type} placeholder={placeholder} className="p-3 bg-slate-100 rounded-xl border-none text-sm font-bold focus:ring-2 ring-nu-green transition-all shadow-inner" onChange={e => onChange(e.target.value)} />
  </div>
);

export default VolunteerForm;