import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { KAB_JATENG } from '../utils/constants';

/**
 * PERSONNEL PORTAL ICC V31.0 - FINAL STABLE
 * -----------------------------------------------------------
 * FUNCTIONS: Secure Login Handshake & Multi-Step Registration
 * TARGET: Direct Redirection to Admin Dashboard on Success
 */

const PersonnelPortal = ({ initialMode = 'login', onLoginSuccess, onBack, isModal = false }) => {
  const [mode, setMode] = useState(initialMode);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // State Wilayah untuk Cascading Dropdown
  const [listKab, setListKab] = useState([]);
  const [listKec, setListKec] = useState([]);
  const [listDesa, setListDesa] = useState([]);

  useEffect(() => {
    fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/33.json`)
      .then(r => r.json()).then(setListKab);
  }, []);

  const handleRegencyChange = (id, name) => {
    setForm({ ...form, regency: name, district: '', village: '' });
    fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/districts/${id}.json`)
      .then(r => r.json()).then(setListKec);
  };

  const handleDistrictChange = (id, name) => {
    setForm({ ...form, district: name, village: '' });
    fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/villages/${id}.json`)
      .then(r => r.json()).then(setListDesa);
  };

  // --- 1. STATE FORM (Shared for Login & Register) ---
  const [form, setForm] = useState({
    username: '', 
    password: '', 
    role: 'RELAWAN', 
    secret_key: '',
    full_name: '', 
    phone: '', 
    birth_date: '', 
    gender: 'Laki-laki', 
    blood_type: 'O',
    regency: 'Semarang', 
    district: '', 
    village: '', 
    detail_address: '',
    is_domicile_same: true, 
    domicile_address: '', 
    latitude: '', 
    longitude: '',
    medical_history: '-', 
    expertise: [], 
    experience: ''
  });

  const expertiseOptions = ["SAR", "Medis", "Logistik", "Dapur Umum", "Assessment", "Psikososial", "Driver", "Komunikasi"];

  // Sinkronisasi mode jika props berubah
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const handleExpertise = (val) => {
    setForm(prev => ({
      ...prev,
      expertise: prev.expertise.includes(val) ? prev.expertise.filter(i => i !== val) : [...prev.expertise, val]
    }));
  };

  // --- 2. HANDLER: LOGIN (FIXED HANDSHAKE) ---
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) {
      setError("HARAP ISI USERNAME DAN PASSWORD");
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      // Mengirim data login secara bersih (clean payload)
      const res = await api.post('auth/login', {
        username: form.username.trim().toLowerCase(),
        password: form.password
      });

      // Jika Backend memberikan respon sukses
      if (res.data.success && res.data.token) {
        console.log("--> AUTH SUCCESS: Redirecting to Admin Core...");
        Haptics.impact({ style: ImpactStyle.Medium });

        // Pastikan orchestrator (App.jsx) menerima payload lengkap sebelum melanjutkan
        const userWithToken = {
          ...res.data.user,
          token: res.data.token
        };
        
        await onLoginSuccess(userWithToken);
      } else {
        setError(res.data.error || "OTORITAS DITOLAK");
        Haptics.impact({ style: ImpactStyle.Heavy });
      }
    } catch (err) {
      console.error("Login Error:", err);
      const msg = err.response?.data?.error || "GAGAL TERHUBUNG KE ENGINE";
      setError(msg.toUpperCase());
      Haptics.impact({ style: ImpactStyle.Heavy });
    } finally {
      setLoading(false);
    }
  };

  // --- 3. HANDLER: REGISTER ---
  const handleFinalRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // STEP A: PEMBUATAN AKUN (AUTHENTICATION)
      const resAccount = await api.post('auth/register', {
        full_name: form.full_name?.trim(),
        username: form.username?.toLowerCase().trim(),
        password: form.password,
        role: form.role,
        region: form.regency, 
        secret_key: form.secret_key
      });

      if (resAccount.data.success && resAccount.data.userId) {
        const userId = resAccount.data.userId;

        // STEP B: PEMBUATAN PROFIL RELAWAN (INVENTORY/VOLUNTEER)
        try {
          const profileData = {
            user_id: userId,
            full_name: form.full_name,
            phone: form.phone,
            birth_date: form.birth_date,
            gender: form.gender,
            blood_type: form.blood_type,
            regency: form.regency,
            district: form.district,
            village: form.village,
            detail_address: form.detail_address, // Ensure these are parsed as numbers
            latitude: parseFloat(form.latitude) || null, // Use null if not provided
            longitude: parseFloat(form.longitude) || null, // Use null if not provided
            medical_history: form.medical_history || '-',
            expertise: Array.isArray(form.expertise) ? form.expertise.join(', ') : '',
            experience: form.experience || '-'
          };

          await api.post('volunteers', profileData);
        } catch (profileErr) {
          console.error("Critical Profile Sync Error:", profileErr);
          // Jika akun sukses tapi profil gagal, arahkan user untuk login dan update profil nanti
          alert("⚠️ AKUN BERHASIL DIBUAT, TAPI PROFIL GAGAL TERSIMPAN. SILAKAN LOGIN DAN LENGKAPI DATA.");
          setMode('login');
          return;
        }

        Haptics.impact({ style: ImpactStyle.Medium });
        alert("✓ PENDAFTARAN BERHASIL. SILAKAN LOGIN.");
        setMode('login');
        setStep(1);
        // Reset password & secret key demi keamanan
        setForm(prev => ({ ...prev, password: '', secret_key: '' }));
      }
    } catch (err) {
      console.error("Registration Sync Error:", err);
      const msg = err.response?.data?.error || "PENDAFTARAN GAGAL - TERJADI GANGGUAN INTEGRASI";
      setError(msg.toUpperCase());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${isModal ? 'w-full' : 'min-h-screen bg-[#f1f5f9] flex items-center justify-center p-4'} font-sans`}>
      <div className={`bg-white w-full ${isModal ? '' : 'max-w-2xl rounded-[40px] shadow-2xl border-t-[12px] border-[#006432]'} overflow-hidden`}>
        
        {/* HEADER BRANDING */}
        <div className="bg-slate-50 p-8 text-center border-b">
          <img src="https://pwnu-jateng.org/uploads/infoumum/20250825111304-2025-08-25infoumum111252.png" className="h-12 mx-auto mb-4" alt="logo" />
          <h2 className="text-xl font-black text-[#006432] uppercase italic">
            {mode === 'login' ? 'Personnel Access' : 'Personnel Registration'}
          </h2>
          
          {mode === 'register' && (
            <div className="flex justify-center gap-2 mt-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={`h-1.5 w-10 rounded-full transition-all ${step >= i ? 'bg-[#006432]' : 'bg-slate-200'}`}></div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 md:p-10">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-[10px] font-black uppercase tracking-widest animate-pulse">
              ⚠️ {error}
            </div>
          )}

          {/* ---------------------------------------------------------
              MODE: LOGIN (Laman Utama)
          --------------------------------------------------------- */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-6 animate-in fade-in slide-in-from-bottom duration-500">
              <div className="space-y-4">
                <Input 
                   label="Username / ID" 
                   onChange={v => setForm({...form, username: v})} 
                   value={form.username} 
                   placeholder="Masukkan nama pengguna"
                   required 
                />
                <Input 
                   label="Password" 
                   type="password" 
                   onChange={v => setForm({...form, password: v})} 
                   value={form.password} 
                   placeholder="Masukkan kata sandi"
                   required 
                />
              </div>
              
              <button 
                 type="submit" 
                 disabled={loading} 
                 className="w-full bg-[#006432] text-white py-5 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? 'Authenticating System...' : 'Enter Tactical Hub ➔'}
              </button>

              <div className="pt-8 border-t text-center space-y-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Belum Memiliki Otoritas?</p>
                <button type="button" onClick={() => { setMode('register'); setStep(1); setError(''); }} className="text-[#006432] font-black text-xs uppercase hover:underline italic">
                  Daftar Personil Baru
                </button>
                {!isModal && (
                   <button type="button" onClick={onBack} className="block w-full text-slate-400 font-black text-[9px] uppercase tracking-tighter mt-4">
                      Kembali ke Dashboard
                   </button>
                )}
              </div>
            </form>
          )}

          {/* ---------------------------------------------------------
              MODE: REGISTER (Multi-Step Logic)
          --------------------------------------------------------- */}
          {mode === 'register' && (
            <form onSubmit={handleFinalRegister} className="space-y-6">
              
              {/* STEP 1: AKUN */}
              {step === 1 && (
                <div className="space-y-5 animate-in slide-in-from-right">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Buat Username" onChange={v => setForm({...form, username: v})} value={form.username} required />
                    <Input label="Buat Password" type="password" onChange={v => setForm({...form, password: v})} value={form.password} required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Jabatan Organisasi</label>
                    <select className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold border-none shadow-inner ring-1 ring-slate-200" 
                      value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                      <option value="RELAWAN">RELAWAN / VOLUNTER</option>
                      <option value="FIELD_STAFF">FIELD STAFF (Tenaga Ahli Lapangan)</option>
                      <option value="STAFF_PCNU">STAFF PCNU (Kabupaten/Kota)</option>
                      <option value="STAFF_PWNU">STAFF PWNU (Provinsi)</option>
                    </select>
                  </div>
                  {['STAFF_PCNU', 'STAFF_PWNU'].includes(form.role) && <Input label="Master Secret Key" type="password" onChange={v => setForm({...form, secret_key: v})} required />}
                  <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => setMode('login')} className="flex-1 bg-slate-100 py-4 rounded-2xl font-black uppercase text-[10px]">Batal</button>
                    <button type="button" onClick={() => setStep(2)} className="flex-1 bg-[#006432] text-white py-4 rounded-2xl font-black uppercase text-[10px]">Lanjut ➔</button>
                  </div>
                </div>
              )}

              {/* STEP 2: BIODATA */}
              {step === 2 && (
                <div className="space-y-5 animate-in slide-in-from-right">
                  <Input label="Nama Lengkap (KTP)" onChange={v => setForm({...form, full_name: v})} value={form.full_name} required />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="No. WhatsApp" onChange={v => setForm({...form, phone: v})} value={form.phone} required />
                    <Input label="Tgl Lahir" type="date" onChange={v => setForm({...form, birth_date: v})} value={form.birth_date} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Dropdown label="Jenis Kelamin" options={['Laki-laki', 'Perempuan']} onChange={v => setForm({...form, gender: v})} />
                    <Dropdown label="Gol. Darah" options={['O', 'A', 'B', 'AB']} onChange={v => setForm({...form, blood_type: v})} />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => setStep(1)} className="flex-1 bg-slate-100 py-4 rounded-2xl font-black uppercase text-[10px]">Kembali</button>
                    <button type="button" onClick={() => setStep(3)} className="flex-1 bg-[#006432] text-white py-4 rounded-2xl font-black uppercase text-[10px]">Lanjut ➔</button>
                  </div>
                </div>
              )}

              {/* STEP 3: ALAMAT */}
              {step === 3 && (
                <div className="space-y-5 animate-in slide-in-from-right">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Kabupaten</label>
                      <select className="w-full p-4 bg-slate-50 rounded-2xl text-[11px] font-bold border-none shadow-inner ring-1 ring-slate-200 outline-none" 
                        onChange={e => handleRegencyChange(e.target.value, e.target.options[e.target.selectedIndex].text)}>
                        <option value="">Pilih Kabupaten</option>
                        {listKab.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Kecamatan</label>
                      <select className="w-full p-4 bg-slate-50 rounded-2xl text-[11px] font-bold border-none shadow-inner ring-1 ring-slate-200 outline-none" 
                        onChange={e => handleDistrictChange(e.target.value, e.target.options[e.target.selectedIndex].text)}>
                        <option value="">Pilih Kecamatan</option>
                        {listKec.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Desa</label>
                      <select className="w-full p-4 bg-slate-50 rounded-2xl text-[11px] font-bold border-none shadow-inner ring-1 ring-slate-200 outline-none" 
                        onChange={e => setForm({...form, village: e.target.options[e.target.selectedIndex].text})}>
                        <option value="">Pilih Desa</option>
                        {listDesa.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <textarea className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold border-none shadow-inner h-20 ring-1 ring-slate-200" placeholder="Alamat Detail (Sesuai KTP)" onChange={e => setForm({...form, detail_address: e.target.value})}></textarea>
                  
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-2xl border border-green-100">
                    <input type="checkbox" className="w-4 h-4 accent-[#006432]" checked={form.is_domicile_same} onChange={e => setForm({...form, is_domicile_same: e.target.checked})} />
                    <label className="text-[10px] font-black text-green-800 uppercase">Domisili sesuai KTP</label>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="GPS Lat" placeholder="-7.xxx" onChange={v => setForm({...form, latitude: v})} required />
                    <Input label="GPS Lng" placeholder="110.xxx" onChange={v => setForm({...form, longitude: v})} required />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => setStep(2)} className="flex-1 bg-slate-100 py-4 rounded-2xl font-black uppercase text-[10px]">Kembali</button>
                    <button type="button" onClick={() => setStep(4)} className="flex-1 bg-[#006432] text-white py-4 rounded-2xl font-black uppercase text-[10px]">Lanjut ➔</button>
                  </div>
                </div>
              )}

              {/* STEP 4: KEAHLIAN */}
              {step === 4 && (
                <div className="space-y-6 animate-in slide-in-from-right">
                  <Input label="Riwayat Penyakit" onChange={v => setForm({...form, medical_history: v})} value={form.medical_history} />
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 block mb-3 italic">Bidang Keahlian Taktis</label>
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                      {expertiseOptions.map(opt => (
                        <div key={opt} onClick={() => handleExpertise(opt)}
                          className={`p-3 text-center rounded-xl text-[9px] font-black cursor-pointer border transition-all ${form.expertise.includes(opt) ? 'bg-[#006432] text-white border-[#006432] shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}>
                          {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                  <textarea className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold border-none shadow-inner h-24 ring-1 ring-slate-200" placeholder="Ringkasan Pengalaman Kebencanaan..." onChange={e => setForm({...form, experience: e.target.value})}></textarea>
                  <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => setStep(3)} className="flex-1 bg-slate-100 py-4 rounded-2xl font-black uppercase text-[10px]">Kembali</button>
                    <button type="submit" disabled={loading} className="flex-1 bg-[#c5a059] text-[#006432] py-4 rounded-2xl font-black uppercase text-[10px] shadow-xl active:scale-95">
                      {loading ? 'Processing...' : 'Selesaikan Pendaftaran ✓'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// --- REUSABLE INPUT COMPONENT ---
const Input = ({ label, type = "text", onChange, value, placeholder, required }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest leading-none mb-1">{label}</label>
    <input 
      type={type} 
      required={required} 
      placeholder={placeholder} 
      className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold border-none shadow-inner focus:ring-2 ring-[#006432] outline-none transition-all placeholder:text-slate-300" 
      onChange={e => onChange(e.target.value)} 
      value={value} 
    />
  </div>
);

const Dropdown = ({ label, options, onChange }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest leading-none mb-1">{label}</label>
    <select className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold border-none shadow-inner ring-1 ring-slate-200" onChange={e => onChange(e.target.value)}>
      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  </div>
);

export default PersonnelPortal;