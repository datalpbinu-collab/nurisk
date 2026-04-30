import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Geolocation } from '@capacitor/geolocation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * PUBLIC REPORT SYSTEM V32.0
 * -----------------------------------------------------------
 * FEATURES: Responsive Scrollable APK/WAP, GPS Auto-Lock, 
 * Advanced Disaster Categories, Close Button Integration.
 */

// --- UTILITY: FRONTEND IMAGE COMPRESSION ---
const compressImage = (file, maxWidth = 1280, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error("Compression failed"));
          const compressedFile = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
          resolve(compressedFile);
        }, 'image/jpeg', quality);
      };
    };
    reader.onerror = (err) => reject(err);
  });
};

const PublicReport = ({ onBack }) => {
  const [loc, setLoc] = useState({ lat: null, lng: null, accuracy: null });
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    reporter_name: '',
    whatsapp_number: '',
    disaster_type: 'Banjir',
    description: '',
    photo: null
  });

  // --- 1. LIST BENCANA (PRD STANDARD) ---
  const disasterOptions = [
    "Banjir",
    "Banjir Bandang",
    "Cuaca Ekstrim",
    "Gelombang Ekstrim dan Abrasi",
    "Gempabumi",
    "Kebakaran Hutan dan Lahan",
    "Kekeringan",
    "Letusan Gunung Api",
    "Tanah Longsor",
    "Tsunami",
    "Likuefaksi"
  ];

  // --- 2. ENGINE: GPS AUTO-LOCK (CAPACITOR NATIVE) ---
  useEffect(() => {
    const startGps = async () => {
      try {
        const coordinates = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true
        });
        setLoc({
          lat: coordinates.coords.latitude,
          lng: coordinates.coords.longitude,
          accuracy: coordinates.coords.accuracy
        });
      } catch (e) {
        console.error("GPS_SIGNAL_LOST");
      }
    };
    startGps();
  }, []);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      // Kompresi dilakukan segera setelah file dipilih
      const compressedFile = await compressImage(file);
      setForm({ 
        ...form, 
        photo: compressedFile, 
        photoPreview: URL.createObjectURL(compressedFile) 
      });
    } catch (err) {
      console.error("Gagal kompresi, menggunakan file asli:", err);
      setForm({ ...form, photo: file, photoPreview: URL.createObjectURL(file) });
    } finally {
      setLoading(false);
    }
  };

  // --- 3. HANDLER: SUBMIT ---
  const submitReport = async (e) => {
    e.preventDefault();
    if (!loc.lat) return alert("Sinyal GPS belum terkunci. Mohon tunggu atau pindah ke area terbuka.");

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', `LAPORAN WARGA: ${form.disaster_type.toUpperCase()}`);
      formData.append('disaster_type', form.disaster_type);
      formData.append('latitude', parseFloat(loc.lat));
      formData.append('longitude', parseFloat(loc.lng));
      formData.append('region', "Menunggu Verifikasi");
      formData.append('reporter_name', form.reporter_name);
      formData.append('whatsapp_number', form.whatsapp_number);
      formData.append('description', form.description);
      formData.append('status', 'REPORTED');
      if (form.photo) formData.append('photo', form.photo);

      await api.post('reports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      Haptics.impact({ style: ImpactStyle.Medium });
      alert("✓ LAPORAN TERKIRIM! Tim ICC NU Peduli sedang memverifikasi lokasi Anda.");
      if (onBack) onBack(); else window.location.href = '/';
    } catch (err) {
      alert("Gagal mengirim laporan. Cek koneksi internet Anda.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-[#f8fafc] flex flex-col font-sans overflow-hidden">
      
      {/* ---------------------------------------------------------
          SECTION: HEADER & CLOSE BUTTON
      --------------------------------------------------------- */}
      <header className="h-16 bg-[#006432] flex items-center px-6 justify-between shrink-0 shadow-lg border-b-2 border-[#c5a059]">
        <div className="flex items-center gap-3">
          <img src="https://pwnu-jateng.org/uploads/infoumum/20250825111304-2025-08-25infoumum111252.png" className="h-8 bg-white p-1 rounded-lg" alt="logo" />
          <h1 className="text-xs font-black text-white uppercase italic tracking-widest">Public Report Hub</h1>
        </div>
        <button 
          onClick={onBack} 
          className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white active:scale-90 transition-all"
        >
          <i className="fas fa-times text-xl"></i>
        </button>
      </header>

      {/* ---------------------------------------------------------
          SECTION: SCROLLABLE FORM
      --------------------------------------------------------- */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <div className="max-w-md mx-auto space-y-6 pb-20">
          
          <div className="text-center">
            <h2 className="text-2xl font-black text-[#006432] uppercase italic tracking-tighter">Laporan Darurat</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Nahdlatul Ulama Peduli Jawa Tengah</p>
          </div>

          <form onSubmit={submitReport} className="space-y-5">
            {/* Nama Pelapor */}
            <div className="space-y-1">
               <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Identitas Pelapor</label>
               <input 
                 className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm focus:ring-2 ring-[#006432] outline-none" 
                 placeholder="Nama Lengkap Sesuai KTP" 
                 required 
                 onChange={e => setForm({...form, reporter_name: e.target.value})} 
               />
            </div>
            
            {/* WhatsApp */}
            <div className="space-y-1">
               <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Kontak Aktif</label>
               <input 
                 className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm focus:ring-2 ring-[#006432] outline-none" 
                 placeholder="Nomor WhatsApp (Contoh: 0812...)" 
                 type="tel"
                 required 
                 onChange={e => setForm({...form, whatsapp_number: e.target.value})} 
               />
            </div>

            {/* Jenis Bencana */}
            <div className="space-y-1">
               <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Jenis Kejadian</label>
               <select 
                 className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-black text-[#006432] shadow-sm outline-none focus:ring-2 ring-[#006432]"
                 value={form.disaster_type}
                 onChange={e => setForm({...form, disaster_type: e.target.value})}
               >
                 {disasterOptions.map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
               </select>
            </div>

            {/* Keterangan Situasi */}
            <div className="space-y-1">
               <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Gambaran Situasi (4W)</label>
               <textarea 
                 className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm focus:ring-2 ring-[#006432] outline-none min-h-[120px]" 
                 placeholder="Jelaskan apa yang terjadi, kondisi korban, dan akses jalan saat ini..." 
                 required
                 onChange={e => setForm({...form, description: e.target.value})} 
               />
            </div>

            {/* Kamera & Photo */}
            <div className="space-y-1">
               <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Bukti Visual</label>
               <div className="bg-slate-50 p-6 rounded-3xl border-2 border-dashed border-slate-200 text-center relative hover:bg-slate-100 transition-all cursor-pointer">
                  <input type="file" accept="image/*" capture="environment" onChange={handleFile} className="absolute inset-0 opacity-0 cursor-pointer" id="cam" />
                  <div className="flex flex-col items-center">
                    <i className="fas fa-camera text-3xl text-[#c5a059] mb-2"></i>
                    <span className="text-[10px] font-black text-slate-500 uppercase">Ambil Foto Kejadian Sekarang</span>
                  </div>
                  {form.photoPreview && <img src={form.photoPreview} className="mt-4 rounded-2xl shadow-lg h-48 w-full object-cover border-4 border-white" alt="preview" />}
               </div>
            </div>

            {/* Status GPS */}
            <div className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${loc.lat ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
               <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${loc.lat ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black text-slate-700 uppercase tracking-tighter">
                        {loc.lat ? 'Geospatial Fixed' : 'Searching GPS Signal...'}
                     </span>
                     <span className="text-[8px] font-bold text-slate-400 uppercase">
                        {loc.lat ? `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)} (±${loc.accuracy?.toFixed(0)}m)` : 'Mohon berikan izin lokasi'}
                     </span>
                  </div>
               </div>
               {loc.lat && <i className="fas fa-check-circle text-green-500"></i>}
            </div>

            {/* Action Button */}
            <button 
              type="submit" 
              disabled={!loc.lat || loading} 
              className="w-full bg-[#006432] text-white font-black py-5 rounded-[25px] shadow-[0_15px_30px_rgba(0,100,50,0.3)] hover:bg-green-800 transition-all uppercase tracking-[0.2em] disabled:bg-slate-300 disabled:shadow-none active:scale-95"
            >
              {loading ? 'Transmitting Data...' : 'Kirim Laporan ICC ➔'}
            </button>
          </form>

          <p className="text-[8px] text-center text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
            Setiap laporan palsu akan ditindaklanjuti.<br/>Pastikan data yang Anda kirimkan akurat untuk kecepatan evakuasi.
          </p>
        </div>
      </main>
    </div>
  );
};

export default PublicReport;