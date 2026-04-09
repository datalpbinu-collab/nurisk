import React, { useState } from 'react';
import api from '../services/api';
import { Preferences } from '@capacitor/preferences';

const Login = ({ onLoginSuccess, onGoToRegister, onClose }) => {
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/api/login', form);
      
      if (res.data.success) {
        localStorage.setItem('userData', JSON.stringify(res.data.user));
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userToken', res.data.token);

        await Preferences.set({ key: 'userData', value: JSON.stringify(res.data.user) });
        await Preferences.set({ key: 'isLoggedIn', value: 'true' });
        await Preferences.set({ key: 'userToken', value: res.data.token });

        onLoginSuccess(res.data.user);
      }
    } catch (err) {
      alert(err.response?.data?.error || "Gagal Login. Cek Koneksi Internet.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-[#f8fafc] flex items-center justify-center p-6 font-sans">
      <div className="bg-white w-full max-w-md p-12 rounded-[50px] shadow-2xl border-t-[10px] border-[#006432] text-center relative overflow-hidden">
        <button 
          onClick={onClose}
          className="absolute top-4 right-6 text-slate-300 hover:text-red-500 z-10"
        >
          <i className="fas fa-times-circle text-xl"></i>
        </button>
        
        <div className="absolute top-0 right-0 p-8 opacity-5"><i className="fas fa-shield-alt text-8xl"></i></div>
        
        <img src="https://upload.wikimedia.org/wikipedia/id/thumb/a/a2/Logo_Nahdlatul_Ulama.svg/1200px-Logo_Nahdlatul_Ulama.svg.png" className="h-20 mx-auto mb-6" alt="NU" />
        <h2 className="text-2xl font-black text-[#006432] uppercase italic tracking-tighter leading-none">Pusdatin Access</h2>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-2 mb-10">Command Center NU Peduli Jateng</p>

        <form onSubmit={handleLogin} className="space-y-4">
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
          
          <button type="submit" disabled={loading} className="w-full bg-[#006432] text-white font-black py-5 rounded-3xl shadow-xl hover:bg-green-800 transition-all uppercase tracking-widest text-xs mt-4">
            {loading ? 'Authenticating...' : 'Authorize Login'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-50">
           <p className="text-[10px] text-slate-400 font-bold uppercase mb-4">Masyarakat Umum & Relawan Baru?</p>
           <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={onGoToRegister} className="bg-white border-2 border-[#006432] text-[#006432] py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-green-50 transition-all">Daftar Admin</button>
              <button type="button" onClick={() => window.location.pathname = '/lapor'} className="bg-red-600 text-white py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-red-100 italic">🚨 Lapor Darurat</button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
