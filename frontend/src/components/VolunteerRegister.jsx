import React, { useState } from 'react';
import api from '../services/api';

const VolunteerRegister = () => {
  const [form, setForm] = useState({
    username: '',
    password: '',
    name: '',
    role: 'RELAWAN',
    region: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const res = await api.post('/api/register', form);
      if (res.data.success) {
        setMessage('Berhasil Daftar! Silakan Login.');
        setTimeout(() => {
          window.location.pathname = '/';
        }, 2000);
      }
    } catch (err) {
      setMessage(err.response?.data?.error || "Gagal Daftar. Cek Koneksi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 font-sans">
      <div className="bg-white w-full max-w-md p-10 rounded-[40px] shadow-2xl border-t-[10px] border-[#006432]">
        <div className="text-center mb-8">
          <img src="https://upload.wikimedia.org/wikipedia/id/thumb/a/a2/Logo_Nahdlatul_Ulama.svg/1200px-Logo_Nahdlatul_Ulama.svg.png" className="h-16 mx-auto mb-4" alt="NU" />
          <h2 className="text-2xl font-black text-[#006432] uppercase italic tracking-tighter">Daftar Akun</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Pusdatin NU Peduli Jawa Tengah</p>
        </div>

        {message && (
          <div className={`p-4 rounded-2xl mb-6 text-center text-xs font-bold uppercase tracking-widest ${message.includes('Berhasil') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <input 
            className="w-full p-4 bg-slate-50 rounded-2xl text-sm border-none shadow-inner focus:ring-2 ring-[#006432] transition-all font-bold" 
            placeholder="Nama Lengkap" 
            required
            value={form.name}
            onChange={e => setForm({...form, name: e.target.value})} 
          />
          <input 
            className="w-full p-4 bg-slate-50 rounded-2xl text-sm border-none shadow-inner focus:ring-2 ring-[#006432] transition-all font-bold" 
            placeholder="Username" 
            required
            value={form.username}
            onChange={e => setForm({...form, username: e.target.value})} 
          />
          <input 
            type="password"
            className="w-full p-4 bg-slate-50 rounded-2xl text-sm border-none shadow-inner focus:ring-2 ring-[#006432] transition-all font-bold" 
            placeholder="Password" 
            required
            value={form.password}
            onChange={e => setForm({...form, password: e.target.value})} 
          />
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Pilih Role</label>
            <select 
              className="w-full p-4 bg-slate-50 rounded-2xl text-sm border-none shadow-inner focus:ring-2 ring-[#006432] transition-all font-bold appearance-none"
              value={form.role}
              onChange={e => setForm({...form, role: e.target.value})}
            >
              <option value="RELAWAN">RELAWAN</option>
              <option value="ADMIN_PCNU">ADMIN PCNU</option>
              <option value="ADMIN_PWNU">ADMIN PWNU</option>
            </select>
          </div>

          <input 
            className="w-full p-4 bg-slate-50 rounded-2xl text-sm border-none shadow-inner focus:ring-2 ring-[#006432] transition-all font-bold" 
            placeholder="Wilayah (Contoh: Semarang)" 
            required
            value={form.region}
            onChange={e => setForm({...form, region: e.target.value})} 
          />
          
          <button type="submit" disabled={loading} className="w-full bg-[#006432] text-white font-black py-5 rounded-3xl shadow-xl hover:bg-green-800 transition-all uppercase tracking-widest text-xs mt-4">
            {loading ? 'Mendaftarkan...' : 'Daftar Sekarang'}
          </button>
        </form>
        
        <button 
          type="button"
          onClick={() => window.location.pathname = '/'}
          className="w-full mt-4 text-[10px] font-black text-slate-400 uppercase hover:text-[#006432] transition-all"
        >
          Sudah punya akun? Login
        </button>
      </div>
    </div>
  );
};

export default VolunteerRegister;
