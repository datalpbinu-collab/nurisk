import React, { useState, useEffect } from 'react';
import api from '../services/api';
import InputField from './ui/Input';
import Button from './ui/Button';
import { ShieldCheck, ChevronRight, ChevronLeft, CheckCircle } from 'lucide-react';

/**
 * PersonnelPortal — Login & Multi-step Registration
 * Menggunakan shared UI components (InputField, Button)
 * Show/hide password built-in di InputField
 */
const PersonnelPortal = ({ initialMode = 'login', onLoginSuccess, onBack, isModal = false }) => {
  const [mode, setMode]     = useState(initialMode);
  const [step, setStep]     = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  // Region cascading
  const [listKab, setListKab] = useState([]);
  const [listKec, setListKec] = useState([]);
  const [listDesa, setListDesa] = useState([]);

  useEffect(() => {
    fetch('https://www.emsifa.com/api-wilayah-indonesia/api/regencies/33.json')
      .then(r => r.json())
      .then(setListKab)
      .catch(() => setListKab([]));
  }, []);

  useEffect(() => { setMode(initialMode); }, [initialMode]);

  // Form state
  const [form, setForm] = useState({
    username: '', password: '', role: 'RELAWAN', secret_key: '',
    full_name: '', phone: '', birth_date: '', gender: 'Laki-laki', blood_type: 'O',
    regency: 'Semarang', district: '', village: '', detail_address: '',
    is_domicile_same: true, domicile_address: '', latitude: '', longitude: '',
    medical_history: '-', expertise: [], experience: '',
  });

  const patch = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleRegencyChange = (id, name) => {
    patch('regency', name); patch('district', ''); patch('village', '');
    fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/districts/${id}.json`)
      .then(r => r.json()).then(setListKec).catch(() => setListKec([]));
  };

  const handleDistrictChange = (id, name) => {
    patch('district', name); patch('village', '');
    fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/villages/${id}.json`)
      .then(r => r.json()).then(setListDesa).catch(() => setListDesa([]));
  };

  const toggleExpertise = (val) => {
    setForm(prev => ({
      ...prev,
      expertise: prev.expertise.includes(val)
        ? prev.expertise.filter(i => i !== val)
        : [...prev.expertise, val],
    }));
  };

  const expertiseOptions = ['SAR', 'Medis', 'Logistik', 'Dapur Umum', 'Assessment', 'Psikososial', 'Driver', 'Komunikasi'];

  // ── Login ──────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) {
      setError('Harap isi username dan password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('auth/login', {
        username: form.username.trim().toLowerCase(),
        password: form.password,
      });
      if (res.data.success && res.data.token) {
        await onLoginSuccess({ ...res.data.user, token: res.data.token });
      } else {
        setError(res.data.error || 'Otoritas ditolak');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal terhubung ke server');
    } finally {
      setLoading(false);
    }
  };

  // ── Register ───────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const resAccount = await api.post('auth/register', {
        full_name: form.full_name?.trim(),
        username:  form.username?.toLowerCase().trim(),
        password:  form.password,
        role:      form.role,
        region:    form.regency,
        secret_key: form.secret_key,
      });

      if (resAccount.data.success && resAccount.data.userId) {
        try {
          await api.post('volunteers', {
            user_id:        resAccount.data.userId,
            full_name:      form.full_name,
            phone:          form.phone,
            birth_date:     form.birth_date,
            gender:         form.gender,
            blood_type:     form.blood_type,
            regency:        form.regency,
            district:       form.district,
            village:        form.village,
            detail_address: form.detail_address,
            latitude:       parseFloat(form.latitude) || null,
            longitude:      parseFloat(form.longitude) || null,
            medical_history: form.medical_history || '-',
            expertise:      Array.isArray(form.expertise) ? form.expertise.join(', ') : '',
            experience:     form.experience || '-',
          });
        } catch {
          alert('⚠️ Akun berhasil dibuat, tapi profil gagal tersimpan. Silakan login dan lengkapi data.');
          setMode('login');
          return;
        }
        alert('✓ Pendaftaran berhasil. Silakan login.');
        setMode('login');
        setStep(1);
        setForm(prev => ({ ...prev, password: '', secret_key: '' }));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Pendaftaran gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className={`font-sans ${isModal ? 'w-full' : 'min-h-screen bg-slate-100 flex items-center justify-center p-4'}`}>
      <div className={`bg-white ${isModal ? 'rounded-2xl' : 'w-full max-w-xl rounded-2xl shadow-2xl'} overflow-hidden border border-slate-200`}>

        {/* Header */}
        <div className="bg-[#006432] px-8 py-8 text-center">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={28} className="text-white" />
          </div>
          <h2 className="text-lg font-black text-white uppercase tracking-tight">
            {mode === 'login' ? 'Personnel Access' : 'Personnel Registration'}
          </h2>
          <p className="text-white/50 text-xs mt-1">PUSDATIN NU • Command Hub</p>

          {/* Step indicator */}
          {mode === 'register' && (
            <div className="flex justify-center gap-2 mt-5">
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${step >= i ? 'w-8 bg-white' : 'w-4 bg-white/30'}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="p-6 md:p-8">
          {/* Error */}
          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-start gap-2">
              <span className="text-red-500 mt-0.5">⚠</span>
              {error}
            </div>
          )}

          {/* ── LOGIN ── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5 animate-fade-in">
              <InputField
                label="Username"
                value={form.username}
                onChange={v => patch('username', v)}
                placeholder="Masukkan nama pengguna"
                required
              />
              <InputField
                label="Password"
                type="password"
                value={form.password}
                onChange={v => patch('password', v)}
                placeholder="Masukkan kata sandi"
                required
              />

              <Button type="submit" variant="primary" fullWidth size="lg" loading={loading}>
                {!loading && 'Masuk ke Sistem'}
              </Button>

              <div className="pt-4 border-t border-slate-100 text-center space-y-3">
                <p className="text-xs text-slate-400">Belum memiliki akun?</p>
                <button
                  type="button"
                  onClick={() => { setMode('register'); setStep(1); setError(''); }}
                  className="text-[#006432] font-bold text-sm hover:underline"
                >
                  Daftar Personil Baru
                </button>
                {!isModal && onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="block w-full text-slate-400 text-xs mt-2 hover:text-slate-600"
                  >
                    ← Kembali ke Dashboard
                  </button>
                )}
              </div>
            </form>
          )}

          {/* ── REGISTER ── */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-5">

              {/* Step 1: Account */}
              {step === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">1 — Buat Akun</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField label="Username" value={form.username} onChange={v => patch('username', v)} placeholder="username" required />
                    <InputField label="Password" type="password" value={form.password} onChange={v => patch('password', v)} placeholder="••••••••" required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Jabatan</label>
                    <select
                      className="w-full px-4 py-3 bg-slate-50 rounded-xl text-sm font-medium border border-slate-200 outline-none focus:border-[#006432] focus:ring-2 focus:ring-[#006432]/20 transition-all"
                      value={form.role}
                      onChange={e => patch('role', e.target.value)}
                    >
                      <option value="RELAWAN">Relawan / Volunter</option>
                      <option value="FIELD_STAFF">Field Staff (Tenaga Ahli Lapangan)</option>
                      <option value="STAFF_PCNU">Staff PCNU (Kabupaten/Kota)</option>
                      <option value="STAFF_PWNU">Staff PWNU (Provinsi)</option>
                    </select>
                  </div>
                  {['STAFF_PCNU', 'STAFF_PWNU'].includes(form.role) && (
                    <InputField label="Master Secret Key" type="password" onChange={v => patch('secret_key', v)} placeholder="••••••••" required />
                  )}
                  <StepNav onBack={() => setMode('login')} onNext={() => setStep(2)} backLabel="Batal" />
                </div>
              )}

              {/* Step 2: Biodata */}
              {step === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">2 — Biodata</p>
                  <InputField label="Nama Lengkap (KTP)" value={form.full_name} onChange={v => patch('full_name', v)} required />
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="No. WhatsApp" value={form.phone} onChange={v => patch('phone', v)} required />
                    <InputField label="Tanggal Lahir" type="date" value={form.birth_date} onChange={v => patch('birth_date', v)} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <SelectField label="Jenis Kelamin" options={['Laki-laki', 'Perempuan']} onChange={v => patch('gender', v)} />
                    <SelectField label="Gol. Darah" options={['O', 'A', 'B', 'AB']} onChange={v => patch('blood_type', v)} />
                  </div>
                  <StepNav onBack={() => setStep(1)} onNext={() => setStep(3)} />
                </div>
              )}

              {/* Step 3: Address */}
              {step === 3 && (
                <div className="space-y-4 animate-fade-in">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">3 — Alamat</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <RegionSelect label="Kabupaten" options={listKab} onChange={(id, name) => handleRegencyChange(id, name)} />
                    <RegionSelect label="Kecamatan" options={listKec} onChange={(id, name) => handleDistrictChange(id, name)} />
                    <RegionSelect label="Desa" options={listDesa} onChange={(id, name) => patch('village', name)} />
                  </div>
                  <textarea
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl text-sm font-medium border border-slate-200 outline-none focus:border-[#006432] focus:ring-2 focus:ring-[#006432]/20 h-20 resize-none transition-all"
                    placeholder="Alamat Detail (Sesuai KTP)"
                    onChange={e => patch('detail_address', e.target.value)}
                  />
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-[#006432]"
                      checked={form.is_domicile_same}
                      onChange={e => patch('is_domicile_same', e.target.checked)}
                    />
                    <span className="text-xs font-semibold text-slate-600">Domisili sesuai KTP</span>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="GPS Latitude" placeholder="-7.xxx" onChange={v => patch('latitude', v)} />
                    <InputField label="GPS Longitude" placeholder="110.xxx" onChange={v => patch('longitude', v)} />
                  </div>
                  <StepNav onBack={() => setStep(2)} onNext={() => setStep(4)} />
                </div>
              )}

              {/* Step 4: Expertise + Submit */}
              {step === 4 && (
                <div className="space-y-5 animate-fade-in">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">4 — Keahlian</p>
                  <InputField label="Riwayat Penyakit" value={form.medical_history} onChange={v => patch('medical_history', v)} />
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Bidang Keahlian</label>
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                      {expertiseOptions.map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleExpertise(opt)}
                          className={`p-2.5 text-center rounded-xl text-[10px] font-bold border transition-all
                            ${form.expertise.includes(opt)
                              ? 'bg-[#006432] text-white border-[#006432]'
                              : 'bg-white text-slate-500 border-slate-200 hover:border-[#006432] hover:text-[#006432]'
                            }
                          `}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl text-sm font-medium border border-slate-200 outline-none focus:border-[#006432] focus:ring-2 focus:ring-[#006432]/20 h-24 resize-none transition-all"
                    placeholder="Ringkasan pengalaman kebencanaan..."
                    onChange={e => patch('experience', e.target.value)}
                  />
                  <div className="flex gap-3">
                    <Button type="button" variant="secondary" onClick={() => setStep(3)}>
                      <ChevronLeft size={14} /> Kembali
                    </Button>
                    <Button type="submit" variant="primary" fullWidth loading={loading} icon={CheckCircle}>
                      {!loading && 'Selesaikan Pendaftaran'}
                    </Button>
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

// ─── Helper components ──────────────────────────────────────────────────────
const StepNav = ({ onBack, onNext, backLabel = 'Kembali' }) => (
  <div className="flex gap-3 pt-2">
    <Button type="button" variant="secondary" onClick={onBack} className="flex-1">
      <ChevronLeft size={14} /> {backLabel}
    </Button>
    {onNext && (
      <Button type="button" variant="primary" onClick={onNext} className="flex-1">
        Lanjut <ChevronRight size={14} />
      </Button>
    )}
  </div>
);

const SelectField = ({ label, options, onChange }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
    <select
      className="w-full px-4 py-3 bg-slate-50 rounded-xl text-sm font-medium border border-slate-200 outline-none focus:border-[#006432] focus:ring-2 focus:ring-[#006432]/20 transition-all"
      onChange={e => onChange(e.target.value)}
    >
      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  </div>
);

const RegionSelect = ({ label, options, onChange }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
    <select
      className="w-full px-4 py-3 bg-slate-50 rounded-xl text-xs font-medium border border-slate-200 outline-none focus:border-[#006432] focus:ring-2 focus:ring-[#006432]/20 transition-all"
      onChange={e => onChange(e.target.value, e.target.options[e.target.selectedIndex].text)}
    >
      <option value="">Pilih {label}</option>
      {options.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
    </select>
  </div>
);

export default PersonnelPortal;