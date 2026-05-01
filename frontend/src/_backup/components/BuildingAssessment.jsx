import React, { useState, useEffect } from 'react';
import api from '../services/api';

const BUILDING_FUNCTIONS = [
  { id: 'kantor', label: 'Kantor', icon: 'building' },
  { id: 'sekolah', label: 'Sekolah/Madrasah', icon: 'school' },
  { id: 'pesantren', label: 'Pondok Pesantren', icon: 'mosque' },
  { id: 'klinik', label: 'Klinik/RS', icon: 'hospital' },
  { id: 'tempat_ibadah', label: 'Tempat Ibadah', icon: 'pray' },
  { id: 'lainnya', label: 'Lainnya', icon: 'building-2' }
];

const THREAT_TYPES = [
  { id: 'gempa', label: 'Gempa Bumi', icon: 'house-crack' },
  { id: 'vulkanik', label: 'Vulkanik/Erupsi', icon: 'volcano' },
  { id: 'banjir', label: 'Banjir/Aliran Sungai', icon: 'flood' },
  { id: 'kekeringan', label: 'Kekeringan', icon: 'sun-plant-wilt' },
  { id: 'angin', label: 'Angin Puting Beliung', icon: 'wind' },
  { id: 'longsor', label: 'Likuefaksi/Longsor', icon: 'mountain' },
  { id: 'tsunami', label: 'Tsunami', icon: 'house-tsunami' },
  { id: 'lain', label: 'Ancaman Lain', icon: 'triangle-exclamation' }
];

const FACILITIES = [
  { id: 'mushola', label: 'Mushola', icon: 'pray' },
  { id: 'aula', label: 'Aula/Ruang Terbuka', icon: 'door-open' },
  { id: 'mck', label: 'MCK Layak', icon: 'bath' },
  { id: 'air', label: 'Sumber Air Mandiri', icon: 'faucet' },
  { id: 'listrik', label: 'Listrik Cadangan', icon: 'bolt' }
];

const EQUIPMENT = [
  { id: 'sop', label: 'SOP Kedaruratan', icon: 'file-contract' },
  { id: 'evakuasi', label: 'Jalur Evakuasi', icon: 'person-walking-arrow-right' },
  { id: 'titik_kumpul', label: 'Titik Kumpul', icon: 'location-dot' },
  { id: 'alarm', label: 'Alarm/EWS', icon: 'bell' },
  { id: 'apar', label: 'APAR', icon: 'fire-extinguisher' },
  { id: 'p3k', label: 'Kotak P3K', icon: 'kit-medical' },
  { id: 'ambulans', label: 'Ambulans/Kendaraan', icon: 'truck-medical' },
  { id: 'apd', label: 'APD', icon: 'helmet-safety' }
];

const BuildingAssessment = ({ onBack, existingData }) => {
  const [section, setSection] = useState(1);
  const [loading, setLoading] = useState(false);
  const [savedId, setSavedId] = useState(existingData?.id || null);
  
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (window.history.back()) {
      // Already handled
    }
  };
  
  // Section 1: Basic Info
  const [form1, setForm1] = useState({
    nama_gedung: existingData?.nama_gedung || '',
    fungsi: existingData?.fungsi || '',
    fungsi_lain: existingData?.fungsi_lain || '',
    alamat: existingData?.alamat || '',
    latitude: existingData?.latitude || '',
    longitude: existingData?.longitude || '',
    imb: existingData?.imb || 'tidak',
    slf: existingData?.slf || 'tidak'
  });
  
  // Section 2: Human Capital
  const [form2, setForm2] = useState({
    odnk: existingData?.odnk || 0,
    ibu_hamil: existingData?.ibu_hamil || 0,
    sakit_kronis: existingData?.sakit_kronis || 0,
    lansia: existingData?.lansia || 0,
    balita: existingData?.balita || 0,
    anak_anak: existingData?.anak_anak || 0,
    dewasa_sehat: existingData?.dewasa_sehat || 0
  });
  
  // Section 3: Natural Capital
  const [form3, setForm3] = useState({
    pernah_terjadi: existingData?.pernah_terjadi || false,
    ancaman: existingData?.ancaman || {},
    riwayat_desa: existingData?.riwayat_desa || ''
  });
  
  // Section 4: Physical Capital
  const [form4, setForm4] = useState({
    struktur: existingData?.struktur || 'tidak_tahu',
    non_struktural: existingData?.non_struktural || 'tidak',
    fasilitas: existingData?.fasilitas || [],
    peralatan: existingData?.peralatan || []
  });
  
  // Section 5: Financial Capital
  const [form5, setForm5] = useState({
    dana_darurat: existingData?.dana_darurat || 'tidak',
    anggaran: existingData?.anggaran || 'tidak',
    asuransi: existingData?.asuransi || 'tidak'
  });
  
  // Section 6: Social Capital
  const [form6, setForm6] = useState({
    kerjasama: existingData?.kerjasama || '',
    peduli: existingData?.peduli || 'cukup',
    konflik: existingData?.konflik || false
  });

  // Calculate total score with safety checks
  const totalScore = form1 && form2 && form3 && form4 && form5 && form6 ? calculateTotalScore() : 0;

  function calculateTotalScore() {
    // Ensure all form objects exist
    const f1 = form1 || {};
    const f2 = form2 || {};
    const f3 = form3 || {};
    const f4 = form4 || {};
    const f5 = form5 || {};
    const f6 = form6 || {};
    
    let score = 0;
    // Legalitas (15%)
    if (f1.imb === 'ya') score += 7.5;
    if (f1.slf === 'ya') score += 7.5;
    
    // Human Capital (10%)
    const totalRisiko = (f2.odnk || 0) + (f2.ibu_hamil || 0) + (f2.sakit_kronis || 0) + (f2.lansia || 0) + (f2.balita || 0) + (f2.anak_anak || 0);
    const totalAll = totalRisiko + parseInt(f2.dewasa_sehat || 0);
    if (totalAll > 0) score += 10;
    
    // Natural Capital (15%)
    if (f3.pernah_terjadi) score -= 15;
    else score += 15;
    
    // Physical Capital (30%)
    if (f4.struktur === 'ya') score += 10;
    if (f4.non_struktural === 'ya') score += 5;
    score += (f4.fasilitas?.length || 0) * 2;
    score += (f4.peralatan?.length || 0) * 2;
    
    // Financial Capital (15%)
    if (f5.dana_darurat === 'ya_cukup') score += 7.5;
    else if (f5.dana_darurat === 'ya_tidak_cukup') score += 3;
    if (f5.anggaran === 'ya') score += 3.75;
    if (f5.asuransi === 'ya') score += 3.75;
    
    // Social Capital (15%)
    if (f6.kerjasama) score += 7.5;
    if (f6.peduli === 'sangat') score += 7.5;
    else if (f6.peduli === 'cukup') score += 3;
    
    return Math.max(0, Math.min(100, score));
  }

   const handleSave = async (sectionNum) => {
    setLoading(true);
    try {
      const payload = {
        ...form1, ...form2, ...form3, ...form4, ...form5, ...form6,
        section: sectionNum,
        total_score: Math.round(totalScore), // Ensure integer for backend INTEGER column
        completed: sectionNum === 6
      };
      
      const res = savedId 
        ? await api.put(`/buildings/${savedId}`, payload)
        : await api.post('/buildings', payload);
      
      if (!savedId && res.data?.id) setSavedId(res.data.id);
      
      if (sectionNum < 6) {
        setSection(sectionNum + 1);
      } else {
        alert('✓ Assessment Gedung Selesai! Total Ketangguhan: ' + totalScore + '%');
        if (onBack) onBack();
      }
    } catch (e) {
      console.error("Save error:", e);
      alert('Gagal menyimpan. Cek koneksi server.');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans">
      {/* HEADER */}
      <div className="bg-[#006432] p-6 rounded-[2rem] mb-6 text-white">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-black uppercase italic">Asesmen Ketangguhan Bencana</h1>
            <p className="text-xs opacity-70">Pentagon Aset • {savedId ? 'Update' : 'Registrasi'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase opacity-70">Total Ketangguhan</p>
            <p className={`text-3xl font-black ${getScoreColor(totalScore)}`}>{totalScore}%</p>
          </div>
        </div>
      </div>

      {/* PROGRESS */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[1,2,3,4,5,6].map(s => (
          <div key={s} onClick={() => setSection(s)}
            className={`flex-1 min-w-[80px] py-3 px-4 rounded-full text-center cursor-pointer transition-all ${
              section === s ? 'bg-[#006432] text-white' : 
              s < section ? 'bg-green-100 text-[#006432]' : 'bg-slate-100 text-slate-400'
            }`}>
            <span className="text-xs font-black uppercase">{s}</span>
          </div>
        ))}
      </div>

      {/* SECTIONS */}
      {section === 1 && (
        <Section1 form={form1} setForm={setForm1} onNext={() => handleSave(1)} loading={loading} />
      )}
      
      {section === 2 && (
        <Section2 form={form2} setForm={setForm2} onNext={() => handleSave(2)} loading={loading} />
      )}
      
      {section === 3 && (
        <Section3 form={form3} setForm={setForm3} onNext={() => handleSave(3)} loading={loading} />
      )}
      
      {section === 4 && (
        <Section4 form={form4} setForm={setForm4} onNext={() => handleSave(4)} loading={loading} />
      )}
      
      {section === 5 && (
        <Section5 form={form5} setForm={setForm5} onNext={() => handleSave(5)} loading={loading} />
      )}
      
      {section === 6 && (
        <Section6 form={form6} setForm={setForm6} onNext={() => handleSave(6)} loading={loading} />
      )}

      {/* NAVIGATION */}
      <div className="flex gap-3 mt-6">
        {section > 1 && (
          <button onClick={() => setSection(section - 1)} className="flex-1 py-4 bg-slate-100 rounded-xl font-black uppercase">
            ← Kembali
          </button>
        )}
        <button onClick={handleBack} className="py-4 px-6 bg-slate-200 rounded-xl font-black uppercase text-slate-500">
          Keluar
        </button>
      </div>
    </div>
  );
};

// ===================== SECTION COMPONENTS =====================

const Section1 = ({ form, setForm, onNext, loading }) => (
  <div className="bg-white p-6 rounded-[2rem] shadow-lg space-y-6 animate-fade-in">
    <h2 className="text-lg font-black text-[#006432] uppercase flex items-center gap-2">
      <span className="w-8 h-8 bg-[#006432] text-white rounded-full flex items-center justify-center">1</span>
      Informasi Dasar (Identitas)
    </h2>
    
    <Input label="Nama Gedung" value={form.nama_gedung} onChange={v => setForm({...form, nama_gedung: v})} placeholder="Contoh: Gedung PCNU Kudus" />
    
    <div className="space-y-2">
      <Label label="Fungsi Gedung" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {BUILDING_FUNCTIONS.map(f => (
          <div key={f.id} onClick={() => setForm({...form, fungsi: f.id, fungsi_lain: f.id === 'lainnya' ? form.fungsi_lain : ''})}
            className={`p-4 rounded-xl border-2 cursor-pointer text-center transition-all ${
              form.fungsi === f.id ? 'bg-[#006432] border-[#006432] text-white' : 'border-slate-100 hover:border-[#006432]'
            }`}>
            <i className={`fas fa-${f.icon} text-xl mb-2 block`}></i>
            <span className="text-xs font-bold">{f.label}</span>
          </div>
        ))}
      </div>
      {form.fungsi === 'lainnya' && (
        <Input label="Sebutkan" value={form.fungsi_lain} onChange={v => setForm({...form, fungsi_lain: v})} />
      )}
    </div>
    
    <TextArea label="Alamat Lengkap" value={form.alamat} onChange={v => setForm({...form, alamat: v})} placeholder="Jl. Desa No. RT/RW, Desa, Kecamatan" />
    
    <div className="grid grid-cols-2 gap-4">
      <Input label="Latitude" type="decimal" value={form.latitude} onChange={v => setForm({...form, latitude: v})} placeholder="-7.xxx" />
      <Input label="Longitude" type="decimal" value={form.longitude} onChange={v => setForm({...form, longitude: v})} placeholder="110.xxx" />
    </div>
    
    <div className="grid grid-cols-2 gap-4">
      <Radio label="IMB/PBG" options={['ya', 'tidak']} value={form.imb} onChange={v => setForm({...form, imb: v})} />
      <Radio label="SLF" options={['ya', 'tidak', 'proses']} value={form.slf} onChange={v => setForm({...form, slf: v})} />
    </div>
    
    <SubmitBtn onClick={onNext} loading={loading} />
  </div>
);

const Section2 = ({ form, setForm, onNext, loading }) => {
  const update = (field, val) => setForm({...form, [field]: parseInt(val) || 0});
  
  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-lg space-y-6 animate-fade-in">
      <h2 className="text-lg font-black text-[#006432] uppercase flex items-center gap-2">
        <span className="w-8 h-8 bg-[#006432] text-white rounded-full flex items-center justify-center">2</span>
        Profil Penghuni & Inklusivitas
      </h2>
      <p className="text-xs text-slate-400">Isi dengan angka, ketik 0 jika tidak ada</p>
      
      <div className="grid grid-cols-2 gap-4">
        <Input label="OBK (Berkebutuhan Khusus)" type="number" value={form.odnk} onChange={v => update('odnk', v)} />
        <Input label="Ibu Hamil/Menyusui" type="number" value={form.ibu_hamil} onChange={v => update('ibu_hamil', v)} />
        <Input label="Sakit Kronis/Keras" type="number" value={form.sakit_kronis} onChange={v => update('sakit_kronis', v)} />
        <Input label="Lansia (60+ thn)" type="number" value={form.lansia} onChange={v => update('lansia', v)} />
        <Input label="Balita (0-5 thn)" type="number" value={form.balita} onChange={v => update('balita', v)} />
        <Input label="Anak-anak (6-13 thn)" type="number" value={form.anak_anak} onChange={v => update('anak_anak', v)} />
      </div>
      
      <Input label="Total Penghuni Dewasa Sehat" type="number" value={form.dewasa_sehat} onChange={v => update('dewasa_sehat', v)} />
      
      <div className="p-4 bg-blue-50 rounded-xl">
        <p className="text-sm font-bold text-blue-800">Total Penghuni Berisiko: {form.odnk + form.ibu_hamil + form.sakit_kronis + form.lansia + form.balita + form.anak_anak} orang</p>
      </div>
      
      <SubmitBtn onClick={onNext} loading={loading} />
    </div>
  );
};

const Section3 = ({ form, setForm, onNext, loading }) => {
  const toggleAncaman = (id) => {
    const current = form.ancaman || {};
    const updated = {...current, [id]: !current[id]};
    setForm({...form, ancaman: updated});
  };
  
  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-lg space-y-6 animate-fade-in">
      <h2 className="text-lg font-black text-[#006432] uppercase flex items-center gap-2">
        <span className="w-8 h-8 bg-[#006432] text-white rounded-full flex items-center justify-center">3</span>
        Riwayat & Ancaman Bencana
      </h2>
      
      <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
        <label className="text-sm font-bold">Pernah terjadi bencana dalam 5-10 tahun terakhir?</label>
        <button onClick={() => setForm({...form, pernah_terjadi: !form.pernah_terjadi})}
          className={`w-16 h-8 rounded-full transition-all ${form.pernah_terjadi ? 'bg-red-500' : 'bg-slate-200'}`}>
          <span className={`block w-8 h-8 bg-white rounded-full shadow transition-transform ${form.pernah_terjadi ? 'translate-x-8' : ''}`}></span>
        </button>
      </div>
      
      <div className="space-y-3">
        <Label label="Pilih Potensi Ancaman" />
        {THREAT_TYPES.map(t => (
          <div key={t.id} onClick={() => toggleAncaman(t.id)}
            className={`p-4 rounded-xl border-2 cursor-pointer flex items-center gap-3 ${
              form.ancaman?.[t.id] ? 'bg-red-50 border-red-300' : 'border-slate-100'
            }`}>
            <i className={`fas fa-${t.icon} text-xl ${form.ancaman?.[t.id] ? 'text-red-500' : 'text-slate-300'}`}></i>
            <span className="text-sm font-bold">{t.label}</span>
          </div>
        ))}
      </div>
      
      <TextArea label="Riwayat Desa (Dampak tidak langsung)" value={form.riwayat_desa} onChange={v => setForm({...form, riwayat_desa: v})} />
      
      <SubmitBtn onClick={onNext} loading={loading} />
    </div>
  );
};

const Section4 = ({ form, setForm, onNext, loading }) => {
  const toggle = (field, id) => {
    const current = form[field] || [];
    const updated = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    setForm({...form, [field]: updated});
  };
  
  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-lg space-y-6 animate-fade-in">
      <h2 className="text-lg font-black text-[#006432] uppercase flex items-center gap-2">
        <span className="w-8 h-8 bg-[#006432] text-white rounded-full flex items-center justify-center">4</span>
        Ketahanan Fisik & Fasilitas
      </h2>
      
      <div className="grid grid-cols-2 gap-4">
        <Radio label="Struktur Bangunan" options={['ya', 'tidak', 'tidak_tahu']} value={form.struktur} onChange={v => setForm({...form, struktur: v})} />
        <Radio label="Keamanan Non-Struktural" options={['ya', 'tidak']} value={form.non_struktural} onChange={v => setForm({...form, non_struktural: v})} />
      </div>
      
      <div className="space-y-2">
        <Label label="Fasilitas Umum" />
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          {FACILITIES.map(f => (
            <div key={f.id} onClick={() => toggle('fasilitas', f.id)}
              className={`p-3 rounded-xl text-center cursor-pointer border-2 ${
                form.fasilitas?.includes(f.id) ? 'bg-[#006432] border-[#006432] text-white' : 'border-slate-100'
              }`}>
              <i className={`fas fa-${f.icon} text-lg block mb-1`}></i>
              <span className="text-[8px] font-bold uppercase">{f.label}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="space-y-2">
        <Label label="Peralatan Kesiapsiagaan" />
        <div className="grid grid-cols-4 gap-2">
          {EQUIPMENT.map(e => (
            <div key={e.id} onClick={() => toggle('peralatan', e.id)}
              className={`p-3 rounded-xl text-center cursor-pointer border-2 ${
                form.peralatan?.includes(e.id) ? 'bg-[#c5a059] border-[#c5a059] text-white' : 'border-slate-100'
              }`}>
              <i className={`fas fa-${e.icon} text-lg block mb-1`}></i>
              <span className="text-[8px] font-bold uppercase">{e.label}</span>
            </div>
          ))}
        </div>
      </div>
      
      <SubmitBtn onClick={onNext} loading={loading} />
    </div>
  );
};

const Section5 = ({ form, setForm, onNext, loading }) => (
  <div className="bg-white p-6 rounded-[2rem] shadow-lg space-y-6 animate-fade-in">
    <h2 className="text-lg font-black text-[#006432] uppercase flex items-center gap-2">
      <span className="w-8 h-8 bg-[#006432] text-white rounded-full flex items-center justify-center">5</span>
      Ketahanan Finansial
    </h2>
    
    <Radio 
      label="Dana Darurat Khusus Bencana" 
      options={['ya_cukup', 'ya_tidak_cukup', 'tidak']} 
      value={form.dana_darurat} 
      onChange={v => setForm({...form, dana_darurat: v})} 
    />
    
    <Radio label="Anggaran Pelatihan/Simulasi" options={['ya', 'tidak']} value={form.anggaran} onChange={v => setForm({...form, anggaran: v})} />
    
    <Radio label="Asuransi Kebakaran/Bencana" options={['ya', 'tidak']} value={form.asuransi} onChange={v => setForm({...form, asuransi: v})} />
    
    <SubmitBtn onClick={onNext} loading={loading} />
  </div>
);

const Section6 = ({ form, setForm, onNext, loading }) => (
  <div className="bg-white p-6 rounded-[2rem] shadow-lg space-y-6 animate-fade-in">
    <h2 className="text-lg font-black text-[#006432] uppercase flex items-center gap-2">
      <span className="w-8 h-8 bg-[#006432] text-white rounded-full flex items-center justify-center">6</span>
      Jejaring Sosial
    </h2>
    
    <Input label="Kerjasama dengan BPBD/Relawan/Lembaga" value={form.kerjasama} onChange={v => setForm({...form, kerjasama: v})} placeholder="Nama lembaga jika ada" />
    
    <Radio label="Kepedulian Warga Sekitar" options={['sangat', 'cukup', 'tidak']} value={form.peduli} onChange={v => setForm({...form, peduli: v})} />
    
    <div className="flex items-center gap-4 p-4 bg-red-50 rounded-xl">
      <label className="text-sm font-bold">Lokasi Rawan Konflik Sosial/Massa?</label>
      <button onClick={() => setForm({...form, konflik: !form.konflik})}
        className={`w-16 h-8 rounded-full transition-all ${form.konflik ? 'bg-red-500' : 'bg-slate-200'}`}>
        <span className={`block w-8 h-8 bg-white rounded-full shadow transition-transform ${form.konflik ? 'translate-x-8' : ''}`}></span>
      </button>
    </div>
    
    <SubmitBtn onClick={onNext} loading={loading} label="Selesai & Simpan" />
  </div>
);

// ===================== HELPERS =====================

const Input = ({ label, value, onChange, type = "text", placeholder }) => (
  <div className="space-y-1">
    <label className="text-xs font-bold text-slate-500 uppercase ml-2">{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full p-4 bg-slate-50 rounded-xl border-2 border-slate-100 font-bold focus:border-[#006432] focus:outline-none transition-all"
    />
  </div>
);

const TextArea = ({ label, value, onChange, placeholder }) => (
  <div className="space-y-1">
    <label className="text-xs font-bold text-slate-500 uppercase ml-2">{label}</label>
    <textarea value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows="3"
      className="w-full p-4 bg-slate-50 rounded-xl border-2 border-slate-100 font-bold focus:border-[#006432] focus:outline-none transition-all resize-none"
    />
  </div>
);

const Label = ({ label }) => <label className="text-xs font-bold text-slate-500 uppercase ml-2 block mb-2">{label}</label>;

const Radio = ({ label, options, value, onChange }) => (
  <div className="space-y-2">
    <Label label={label} />
    <div className="flex gap-2">
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)}
          className={`flex-1 py-3 rounded-xl font-bold text-sm uppercase transition-all ${
            value === o ? 'bg-[#006432] text-white' : 'bg-slate-100 text-slate-400'
          }`}>
          {o.replace('_', ' ')}
        </button>
      ))}
    </div>
  </div>
);

const SubmitBtn = ({ onClick, loading, label }) => (
  <button onClick={onClick} disabled={loading}
    className="w-full py-5 bg-[#006432] text-white rounded-2xl font-black uppercase text-sm shadow-xl active:scale-95 transition-all disabled:opacity-50 mt-6">
    {loading ? 'Menyimpan...' : label || 'Simpan & Lanjut →'}
  </button>
);

export default BuildingAssessment;