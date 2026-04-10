import React, { useState } from 'react';
import api from '../services/api';

const Register = ({ onBackToLogin }) => {
  const [form, setForm] = useState({ 
    full_name: '', region: 'Jawa Tengah', username: '', password: '', role: 'RELAWAN', secret_key: '' 
  });

  const kabJateng = ["Semarang", "Demak", "Kudus", "Pati", "Jepara", "Rembang", "Blora", "Grobogan", "Boyolali", "Solo", "Sukoharjo", "Wonogiri", "Karanganyar", "Sragen", "Klaten", "Magelang", "Temanggung", "Wonosobo", "Purworejo", "Kebumen", "Cilacap", "Banyumas", "Purbalingga", "Banjarnegara", "Batang", "Pekalongan", "Pemalang", "Tegal", "Brebes", "Kendal"];

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('auth/register', form);
      alert("Registrasi Berhasil! Role: " + form.role);
      onBackToLogin();
    } catch (err) {
      alert(err.response?.data?.error || "Gagal Mendaftar");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 font-sans">
      <div className="bg-white w-full max-w-lg p-12 rounded-[50px] shadow-2xl border-t-[10px] border-[#c5a059] relative">
        <h2 className="text-2xl font-black text-nu-green uppercase italic tracking-tighter leading-none mb-2">Personnel Registration</h2>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-10">Pilih Role sesuai penugasan organisasi</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
             <div className="col-span-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Nama Lengkap</label>
                <input className="w-full p-4 bg-slate-50 rounded-2xl text-sm border-none shadow-inner font-bold" placeholder="Sesuai KTP" required onChange={e => setForm({...form, full_name: e.target.value})} />
             </div>

             <div>
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Tingkat Akses (Role)</label>
                <select className="w-full p-4 bg-slate-50 rounded-2xl text-sm border-none shadow-inner font-bold text-nu-green" 
                  value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  <option value="RELAWAN">Relawan (Mobile)</option>
                  <option value="PCNU">Admin Cabang (Kabupaten)</option>
                  <option value="PWNU">Admin Wilayah (Pusat)</option>
                </select>
             </div>

             <div>
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Wilayah Tugas</label>
                <select className="w-full p-4 bg-slate-50 rounded-2xl text-sm border-none shadow-inner font-bold" 
                  disabled={form.role === 'PWNU'} value={form.role === 'PWNU' ? 'Jawa Tengah' : form.region}
                  onChange={e => setForm({...form, region: e.target.value})}>
                  <option>Jawa Tengah</option>
                  {kabJateng.sort().map(k => <option key={k} value={k}>PCNU {k}</option>)}
                </select>
             </div>
          </div>

          {form.role === 'PWNU' && (
            <div className="animate-in fade-in zoom-in duration-300">
               <label className="text-[9px] font-black text-red-500 uppercase ml-2 italic">Master Secret Key (Wajib)</label>
               <input type="password" placeholder="Key Khusus Pusat" className="w-full p-4 bg-red-50 rounded-2xl text-sm border-2 border-red-100 shadow-inner font-bold" 
                 onChange={e => setForm({...form, secret_key: e.target.value})} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-4">
             <input className="w-full p-4 bg-slate-50 rounded-2xl text-sm border-none shadow-inner font-bold" placeholder="Username" required onChange={e => setForm({...form, username: e.target.value})} />
             <input type="password" className="w-full p-4 bg-slate-50 rounded-2xl text-sm border-none shadow-inner font-bold" placeholder="Password" required onChange={e => setForm({...form, password: e.target.value})} />
          </div>

          <button type="submit" className="w-full bg-[#c5a059] text-green-950 font-black py-5 rounded-3xl shadow-xl hover:bg-yellow-600 transition-all uppercase tracking-widest text-xs mt-6">
            Daftarkan Personil Baru
          </button>
        </form>

        <button onClick={onBackToLogin} className="w-full mt-6 text-[10px] font-black text-slate-300 hover:text-nu-green uppercase tracking-widest transition-all">Sudah punya akses? Login kembali</button>
      </div>
    </div>
  );
};

export default Register;