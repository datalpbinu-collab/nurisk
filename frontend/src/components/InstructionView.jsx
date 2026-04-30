import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * INSTRUCTION VIEW ICC V32.0
 * -----------------------------------------------------------
 * FUNCTION: Issuing Task Orders (Surat Perintah) 
 * DATA: Sync with real-time volunteer applicants (username database)
 */

const InstructionView = ({ incident, onSync }) => {
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    pj_nama: 'Ketua PWNU Jawa Tengah',
    pic_lapangan: '',
    tim_anggota: [], // Simpan dalam array untuk pilihan ganda
    armada_detail: '',
    peralatan_detail: '',
    durasi: '',
    has_shelter: false
  });

  // --- 1. ENGINE: SYNC APPLICANTS ---
  useEffect(() => {
    const fetchApplicants = async () => {
      try {
        const res = await api.get(`/volunteers/deployments/${incident.id}`);
        setApplicants(res.data || []);
      } catch (e) {
        console.error("Gagal menarik daftar pelamar.");
      }
    };
    if (incident?.id) fetchApplicants();
  }, [incident.id]);

  // --- 2. GET SCORING FROM ASSESSMENT ---
  const assessmentScore = useMemo(() => {
    return {
      priority: incident?.priority_score || 0,
      kerusakan: incident?.damage_score || 0,
      kebutuhan: incident?.needs_score || 0,
      terdampak: incident?.dampak_manusia?.terdampak || 0,
     kk: incident?.dampak_manusia?.kk_terdampak || 0
    };
  }, [incident]);

  // --- 2. HANDLER: MULTI-SELECT TIM ---
  const handleSelectMember = (username) => {
    setForm(prev => ({
      ...prev,
      tim_anggota: prev.tim_anggota.includes(username)
        ? prev.tim_anggota.filter(u => u !== username)
        : [...prev.tim_anggota, username]
    }));
  };

  // --- 3. HANDLER: SUBMIT SURAT PERINTAH (SP) ---
  const handleSubmit = async () => {
    if (!form.pic_lapangan) return alert("Pilih Koordinator Lapangan!");
    if (form.tim_anggota.length === 0) return alert("Pilih minimal satu anggota tim!");

    setLoading(true);
    try {
      await api.post('incidents/instructions', { 
        ...form, 
        tim_anggota: form.tim_anggota.join(', '), // Gabung array jadi string untuk DB
        incident_id: incident.id 
      });

      // Update status kejadian menjadi COMMANDED (Sudah Diperintah)
      await api.put(`/incidents/${incident.id}`, { 
        status: 'COMMANDED', // Status ini akan di-handle oleh incidentController
        has_shelter: form.has_shelter 
      });

      Haptics.impact({ style: ImpactStyle.Medium });
      alert("✓ SURAT PERINTAH RESMI TELAH DITERBITKAN!");
      if (onSync) onSync(); // Refresh data dashboard
    } catch (e) {
      alert("Gagal menerbitkan instruksi. Cek koneksi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-10 bg-slate-100 min-h-screen font-sans animate-in fade-in">
      <div className="bg-white max-w-4xl mx-auto shadow-2xl rounded-[40px] border-t-[15px] border-[#006432] overflow-hidden">
        
        {/* HEADER DOKUMEN */}
        <div className="p-8 border-b border-slate-100 text-center bg-slate-50">
           <h2 className="text-xl font-black text-[#006432] uppercase italic tracking-tighter">Drafting Surat Perintah Tugas (SP)</h2>
           <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 tracking-widest">Nomor: SP/PWNU-JTG/ICC/{incident.id}/{new Date().getFullYear()}</p>
        </div>

        <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          {/* KOLOM KIRI: PENUNJUKAN PERSONIL */}
          <div className="space-y-6">
            <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest border-b pb-2">I. Personil Taktis</h4>
            
            {/* INPUT PJ */}
            <div className="space-y-1">
               <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Penanggung Jawab (Pusat)</label>
               <input className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm border-none shadow-inner" 
                value={form.pj_nama} onChange={e => setForm({...form, pj_nama: e.target.value})} />
            </div>

            {/* PILIH KOORDINATOR */}
            <div className="space-y-1">
               <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Koordinator Lapangan (PIC)</label>
               <select className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl font-bold text-sm shadow-sm" 
                 onChange={e => setForm({...form, pic_lapangan: e.target.value})}>
                 <option value="">-- Pilih PIC Lapangan --</option>
                 {applicants.map(v => (
                    <option key={v.id} value={v.full_name}>{v.full_name} ({v.expertise})</option>
                 ))}
               </select>
               {applicants.length === 0 && <p className="text-[8px] text-red-500 italic ml-2 mt-1">Belum ada relawan yang mendaftar untuk misi ini.</p>}
            </div>

            {/* PILIH ANGGOTA TIM (MULTI-SELECT) */}
            <div className="space-y-2">
               <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Daftar Anggota Tim (Checklist)</label>
               <div className="max-h-60 overflow-y-auto bg-slate-50 p-4 rounded-3xl border border-slate-100 space-y-3 custom-scrollbar">
                  {applicants.map(v => (
                    <label key={v.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${form.tim_anggota.includes(v.full_name) ? 'bg-[#006432] border-[#006432] text-white shadow-lg' : 'bg-white border-slate-100 text-slate-600'}`}>
                       <input type="checkbox" className="hidden" onChange={() => handleSelectMember(v.full_name)} />
                       <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${form.tim_anggota.includes(v.full_name) ? 'border-white' : 'border-slate-200'}`}>
                          {form.tim_anggota.includes(v.full_name) && <div className="w-2 h-2 bg-white rounded-full"></div>}
                       </div>
                       <div className="leading-tight">
                          <p className="text-xs font-black uppercase">{v.full_name}</p>
                          <p className={`text-[8px] font-bold ${form.tim_anggota.includes(v.full_name) ? 'text-white/60' : 'text-slate-400'} uppercase`}>{v.expertise} • {v.region}</p>
                       </div>
                    </label>
                  ))}
                  {applicants.length === 0 && <p className="text-center py-10 text-[9px] text-slate-300 font-bold uppercase italic tracking-widest">Waiting for field force...</p>}
               </div>
            </div>
          </div>

          {/* KOLOM KANAN: DETAIL OPS */}
          <div className="space-y-6">
            {/* ASSESSMENT RESULT DISPLAY */}
            {(assessmentScore.priority > 0 || assessmentScore.kerusakan > 0) && (
              <div className="bg-amber-50 p-4 rounded-3xl border border-amber-200">
                <p className="text-[10px] font-black text-amber-800 uppercase mb-3 tracking-widest">Hasil Assessment Lapangan</p>
                <div className="grid grid-cols-2 gap-3">
                  <ScoreBox label="Skor Prioritas" value={assessmentScore.priority} color="text-red-600" />
                  <ScoreBox label="Kerusakan" value={assessmentScore.kerusakan} color="text-orange-600" />
                  <ScoreBox label="Kebutuhan" value={assessmentScore.kebutuhan} color="text-blue-600" />
                  <ScoreBox label="Terdampak" value={assessmentScore.terdampak + ' Jiwa'} color="text-slate-700" />
                </div>
              </div>
            )}
            
            <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest border-b pb-2">II. Dukungan Operasional</h4>
            
            {/* TOGGLE AKTIVASI POSKO */}
            <div className={`p-4 rounded-3xl border-2 transition-all flex items-center justify-between ${form.has_shelter ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-transparent'}`}>
               <div>
                  <p className="text-[10px] font-black uppercase text-amber-800">Aktivasi Posko Lapangan</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Buka shelter untuk manajemen pengungsi</p>
               </div>
               <button 
                onClick={() => setForm({...form, has_shelter: !form.has_shelter})}
                className={`w-12 h-6 rounded-full relative transition-all ${form.has_shelter ? 'bg-[#006432]' : 'bg-slate-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.has_shelter ? 'right-1' : 'left-1'}`}></div>
               </button>
            </div>
            
            <div className="space-y-1">
               <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Estimasi Durasi Tugas</label>
               <input className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm border-none shadow-inner" 
                placeholder="Misal: 3 Hari Kerja" onChange={e => setForm({...form, durasi: e.target.value})} />
            </div>

            <div className="space-y-1">
               <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Detail Armada</label>
               <textarea className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs border-none shadow-inner h-24" 
                placeholder="Misal: 1 Unit Ambulans, 2 Mobil Triton" onChange={e => setForm({...form, armada_detail: e.target.value})} />
            </div>

            <div className="space-y-1">
               <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Peralatan Teknis</label>
               <textarea className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs border-none shadow-inner h-24" 
                placeholder="Misal: Chainsaw, Tenda Pengungsi, Alat Komunikasi" onChange={e => setForm({...form, peralatan_detail: e.target.value})} />
            </div>
          </div>
        </div>

        {/* FOOTER ACTION */}
        <div className="p-8 bg-slate-50 border-t flex flex-col md:flex-row gap-4">
           <button onClick={handleSubmit} disabled={loading} className="flex-1 bg-[#006432] text-white py-5 rounded-[25px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all hover:bg-green-800 flex items-center justify-center gap-3">
              <i className="fas fa-file-signature text-nu-gold"></i>
              {loading ? 'Processing Document...' : 'Terbitkan Instruksi Resmi'}
           </button>
        </div>
      </div>
    </div>
  );
};

const ScoreBox = ({ label, value, color }) => (
  <div className="bg-white p-3 rounded-xl">
    <p className={`text-lg font-black ${color} leading-none`}>{value}</p>
    <p className="text-[7px] font-black text-slate-400 uppercase mt-1">{label}</p>
  </div>
);

export default InstructionView;