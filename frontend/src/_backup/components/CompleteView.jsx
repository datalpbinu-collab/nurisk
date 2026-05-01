import React, { useState, useEffect, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../services/api';
import { KAB_JATENG } from '../utils/constants'; // Import KAB_JATENG

const getIncidentConfig = (type) => {
  const map = {
    'Banjir': { icon: 'fa-house-flood-water', color: 'bg-blue-500' },
    'Banjir Bandang': { icon: 'fa-cloud-showers-heavy', color: 'bg-indigo-700' },
    'Cuaca Ekstrim': { icon: 'fa-bolt-lightning', color: 'bg-slate-700' },
    'Gempabumi': { icon: 'fa-house-crack', color: 'bg-orange-600' },
    'Tanah Longsor': { icon: 'fa-hill-rockslide', color: 'bg-amber-800' },
    'Letusan Gunung Api': { icon: 'fa-volcano', color: 'bg-red-700' },
    'Tsunami': { icon: 'fa-house-tsunami', color: 'bg-blue-900' },
    'Kekeringan': { icon: 'fa-sun-plant-wilt', color: 'bg-yellow-600' },
    'Kebakaran Hutan dan Lahan': { icon: 'fa-fire-flame-curved', color: 'bg-orange-700' },
    'Likuefaksi': { icon: 'fa-mountain-sun', color: 'bg-stone-600' }
  };
  return map[type] || { icon: 'fa-circle-exclamation', color: 'bg-slate-500' };
};

const STATUS_THEME = {
  'REPORTED': { color: 'bg-slate-500', label: 'Dilaporkan', step: 2 },
  'VERIFIED': { color: 'bg-blue-600', label: 'Terverifikasi', step: 3 },
  'REJECTED': { color: 'bg-red-600', label: 'Ditolak', step: 3 },
  'ASSESSMENT': { color: 'bg-yellow-500', label: 'Assessment Lapangan', step: 4 },
  'ASSESSED': { color: 'bg-amber-600', label: 'Selesai Assessment', step: 6 },
  'COMMANDED': { color: 'bg-orange-500', label: 'Tim Command Aktif', step: 7 },
  'ACTION': { color: 'bg-green-600', label: 'Tim Aksi Lapangan', step: 8 },
  'COMPLETED': { color: 'bg-slate-900', label: 'Selesai & Arsip', step: 10 }
};

const CompleteView = ({ incidents = [], onRefresh, onAction, onSelect }) => {
  // --- STATE CORE ---
  const [expandedId, setExpandedId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // --- STATE TACTICAL ---
  const [nearbyVolunteers, setNearbyVolunteers] = useState([]);
  const [waitingList, setWaitingList] = useState([]); 
  const [isScanning, setIsScanning] = useState(false);
  const [showInstructionForm, setShowInstructionForm] = useState(false);
  
  const [instForm, setInstForm] = useState({
    pj_nama: 'Ketua PWNU Jawa Tengah',
    koordinator: '',
    petugas: [],
    armada: '',
    peralatan: '',
    lama_tugas: ''
  });

  // --- ENGINE: FILTERING & SORTING ---
  const filtered = incidents.filter(i => {
    const matchStatus = filterStatus === 'all' || String(i.status).toUpperCase() === filterStatus.toUpperCase();
    const matchRegion = filterRegion === 'all' || i.region === filterRegion;
    const matchSearch = (i.title || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchRegion && matchSearch;
  }).sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));

  // --- HANDLER: BUKA BARIS ---
  const handleToggleRow = async (incident) => {
    if (expandedId === incident.id) {
      setExpandedId(null);
      setShowInstructionForm(false);
    } else {
      setExpandedId(incident.id);
      if (onSelect) onSelect(incident);
      setIsScanning(true);
      try {
        // PRD: Sync Radar & Deployment Queue
        const [resRadar, resWait] = await Promise.all([
          api.get(`volunteers/nearby?lat=${incident.latitude}&lng=${incident.longitude}&expertise=`),
          api.get(`volunteers/deployments/${incident.id}`)
        ]);
        setNearbyVolunteers(resRadar.data || []);
        setWaitingList(Array.isArray(resWait.data) ? resWait.data : []);
      } catch (e) {
        console.error("Sync Data Error");
      } finally {
        setIsScanning(false);
      }
    }
  };

  const handleReject = async (incidentId) => {
    if (!window.confirm("Yakin ingin menolak laporan ini?")) return;
    try {
      await api.put(`incidents/${incidentId}`, { status: 'REJECTED' });
      if (onRefresh) onRefresh();
      setExpandedId(null);
    } catch (e) { alert("Gagal menolak laporan."); }
  };

  const handleFlowUpdate = async (incidentId, status) => {
    try {
      await api.put(`incidents/${incidentId}`, { status });
      if (onRefresh) onRefresh();
      if (status.toUpperCase() === 'COMPLETED') setExpandedId(null);
    } catch (err) {
      alert("Gagal memperbarui status misi.");
    }
  };

  const submitInstruction = async (incidentId) => {
    if (!instForm.koordinator || instForm.petugas.length === 0) {
      return alert("Pilih Koordinator dan Petugas!");
    }
    try {
      await api.post('incidents/instructions', {
        incident_id: incidentId,
        pj_nama: instForm.pj_nama,
        pic_lapangan: instForm.koordinator,
        tim_anggota: instForm.petugas.join(', '),
        armada_detail: instForm.armada,
        peralatan_detail: instForm.peralatan,
        duration: instForm.lama_tugas
      });
      alert("✓ SURAT PERINTAH BERHASIL DITERBITKAN!");
      await handleFlowUpdate(incidentId, 'COMMANDED');
      setShowInstructionForm(false);
    } catch (e) {
      alert("Gagal menerbitkan instruksi.");
    }
  };

  const handleApproveDeployment = async (deployId, status) => {
    try {
      await api.put(`volunteers/deployments/${deployId}`, { status });
      alert("Personil Berhasil Diverifikasi!");
      if (onRefresh) onRefresh();
    } catch (e) {
      alert("Gagal verifikasi relawan");
    }
  };

  const generatePDF = async (incident) => {
    try {
      const res = await api.get(`incidents/${incident.id}/full-report`);
      const { incident: fullData, instruction, actions } = res.data;

      const doc = new jsPDF();
      doc.setFont("helvetica", "bold").setFontSize(16).text("LAPORAN TERPADU NU PEDULI JATENG", 105, 15, {align:'center'});
      
      autoTable(doc, { 
        startY: 25,
        head: [['KATEGORI', 'INFORMASI DETIL']],
        body: [
          ['KODE KEJADIAN', fullData.incident_code || 'N/A'],
          ['JENIS BENCANA', fullData.title],
          ['WILAYAH', `${fullData.region}, ${fullData.kecamatan || ''}, ${fullData.desa || ''}`],
          ['STATUS TERAKHIR', fullData.status.toUpperCase()],
          ['KONDISI MUTAKHIR', fullData.kondisi_mutakhir || 'N/A'],
          ['DAMPAK JIWA', JSON.stringify(fullData.dampak_manusia || {})]
        ] 
      });

      if (actions && actions.length > 0) {
        doc.text("LOG RESPONS LAPANGAN", 14, doc.lastAutoTable.finalY + 15);
        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 20,
          head: [['Kluster', 'Kegiatan', 'Paket', 'Penerima']],
          body: actions.map(a => [a.kluster, a.nama_kegiatan, a.jumlah_paket, a.penerima_manfaat])
        });
      }

    // Blok Tanda Tangan Digital
    const finalY = doc.lastAutoTable.finalY + 30;
    doc.setFontSize(10).text("Diterbitkan Secara Digital Oleh:", 140, finalY);
    doc.setFont("courier", "bold").text("PUSDATIN ICC NU PEDULI", 140, finalY + 10);
    doc.setFont("helvetica", "normal").setFontSize(8).text(`ID: ${fullData.incident_code || 'AUTH-AUTO'}`, 140, finalY + 15);
    doc.text(`Waktu: ${new Date().toISOString()}`, 140, finalY + 20);

      doc.save(`SITREP_${fullData.incident_code || fullData.id}.pdf`);
    } catch (e) { alert("PDF Error"); }
  };

  return (
    <div className="p-4 md:p-8 bg-[#f8fafc] h-full overflow-y-auto font-sans custom-scrollbar">
      
      {/* HEADER & FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b-2 border-green-50 pb-6 gap-6">
        <div>
          <h2 className="text-3xl font-black text-[#006432] uppercase italic tracking-tighter leading-none">Mission Control Manager</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">Professional Deployment System</p>
        </div>
        <div className="flex gap-4">
           <select className="p-3 bg-white border rounded-2xl text-xs font-black text-[#006432] shadow-sm outline-none" value={filterRegion} onChange={e => setFilterRegion(e.target.value)}>
             <option value="all">SEMUA CABANG</option>
             {KAB_JATENG.map(k => <option key={k} value={k}>{k.toUpperCase()}</option>)}
           </select>
        </div>
      </div>

      {/* LIST MISSION */}
      <div className="space-y-5 pb-40">
        {filtered.map(i => {
          const s = i.status?.toUpperCase() || 'REPORTED';
          return (
          <div key={i.id} className={`bg-white rounded-[45px] border transition-all duration-500 overflow-hidden ${expandedId === i.id ? 'shadow-2xl border-[#006432] ring-8 ring-green-50' : 'shadow-md border-slate-100'}`}>
            
            <div className="p-6 flex flex-col md:flex-row items-center justify-between cursor-pointer gap-6" onClick={() => handleToggleRow(i)}>
              <div className="flex gap-6 items-center flex-1">
                <div className={`w-14 h-14 rounded-[22px] flex flex-col items-center justify-center shadow-xl text-white ${getIncidentConfig(i.disaster_type).color}`}>
                  <i className={`fas ${getIncidentConfig(i.disaster_type).icon} text-2xl`}></i>
                  <span className="text-[7px] font-black mt-1">{i.priority_score || 0} PTS</span>
                </div>
                <div className="leading-tight min-w-0 flex-1">
                  <h4 className="font-black text-slate-800 uppercase italic text-md md:text-lg tracking-tighter truncate">{i.title}</h4>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest"><i className="fas fa-clock mr-1"></i> {new Date(i.created_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                 <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase text-white shadow-lg ${STATUS_THEME[s]?.color || 'bg-slate-400'} ${s === 'REPORTED' ? 'animate-pulse' : ''}`}>
                    {s}
                 </span>
                 <i className={`fas fa-chevron-down transition-transform ${expandedId === i.id ? 'rotate-180 text-[#006432]' : 'text-slate-300'}`}></i>
              </div>
            </div>

            {expandedId === i.id && (
              <div className="p-8 bg-white border-t border-slate-50 animate-in slide-in-from-top duration-500">
                 
                 {showInstructionForm ? (
                    <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-200 shadow-inner animate-in zoom-in">
                        <div className="flex justify-between items-center mb-8 border-b pb-4 border-slate-200">
                           <h3 className="text-xl font-black text-[#006432] uppercase italic tracking-tighter">Drafting Surat Perintah Tugas</h3>
                           <button onClick={() => setShowInstructionForm(false)} className="text-slate-400 font-bold text-xs uppercase hover:text-red-500 transition-all">✕ Batal</button>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-sm">
                           <div className="space-y-4">
                              <Input label="Penanggung Jawab" value={instForm.pj_nama} onChange={v => setInstForm({...instForm, pj_nama: v})} />
                              <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block">Koordinator Lapangan</label>
                                 <select className="w-full p-4 bg-white border rounded-2xl font-bold text-[#006432]" onChange={e => setInstForm({...instForm, koordinator: e.target.value})}>
                                    <option value="">-- Pilih Koordinator --</option>
                                    {waitingList.filter(v => v.status === 'approved').map(v => <option key={v.id} value={v.full_name}>{v.full_name}</option>)}
                                 </select>
                              </div>
                              <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block">Anggota Tim</label>
                                 <div className="max-h-40 overflow-y-auto bg-white p-4 rounded-2xl border space-y-2">
                                    {waitingList.map(v => (
                                       <label key={v.id} className="flex items-center gap-3 cursor-pointer">
                                          <input type="checkbox" className="w-4 h-4 text-[#006432]" onChange={(e) => {
                                              const newPetugas = e.target.checked ? [...instForm.petugas, v.full_name] : instForm.petugas.filter(p => p !== v.full_name);
                                              setInstForm({...instForm, petugas: newPetugas});
                                          }} />
                                          <span className="text-xs font-bold text-slate-600">{v.full_name}</span>
                                       </label>
                                    ))}
                                 </div>
                              </div>
                           </div>
                           <div className="space-y-4">
                              <Input label="Lama Tugas" placeholder="Misal: 3 Hari" onChange={v => setInstForm({...instForm, lama_tugas: v})} />
                              <TextArea label="Armada" onChange={v => setInstForm({...instForm, armada: v})} />
                              <TextArea label="Peralatan" onChange={v => setInstForm({...instForm, peralatan: v})} />
                           </div>
                        </div>
                        <button onClick={() => submitInstruction(i.id)} className="w-full bg-[#006432] text-white font-black py-5 rounded-[25px] shadow-xl mt-8 flex items-center justify-center gap-3 uppercase">
                           <i className="fas fa-signature text-amber-400"></i> Terbitkan Instruksi Resmi
                        </button>
                    </div>
                 ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                       <div className="space-y-6">
                          {/* BUKTI VISUAL DARI WARGA */}
                          {i.photo_data && (
                            <div className="space-y-2">
                              <p className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest italic">Evidence Attachment</p>
                              <div className="relative group overflow-hidden rounded-[30px] border-4 border-white shadow-xl">
                                <img 
                                  src={i.photo_data.startsWith('data:') 
                                    ? i.photo_data 
                                    : `${api.defaults.baseURL.replace('/api/', '/')}${i.photo_data}`
                                  } 
                                  alt="Bukti Kejadian" 
                                  className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-700" 
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-4">
                                  <button onClick={() => window.open(i.photo_data)} className="text-white text-[9px] font-bold uppercase"><i className="fas fa-expand mr-2"></i> Perbesar Foto</button>
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="bg-[#020617] p-6 rounded-[35px] text-green-400 font-mono shadow-2xl">
                             <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                                <span className="text-[9px] font-black uppercase tracking-widest">AI Strategic Briefing</span>
                             </div>
                             <p className="text-[11px] text-slate-300 leading-relaxed italic">"{i.description || 'Analyzing geospatial data...'}"</p>
                          </div>
                          <div className="bg-green-50/50 p-6 rounded-[35px] border border-green-100">
                             <h4 className="text-[10px] font-black text-[#006432] uppercase mb-4 tracking-[0.2em]">Strategy SOP</h4>
                             <div className="space-y-3">
                                <CheckItem label="Assessment Detail" checked={!!i.kecamatan} />
                                <CheckItem label="Instruksi SP Terbit" checked={['COMMANDED', 'ACTION', 'COMPLETED'].includes(s)} />
                                <CheckItem label="Misi Tuntas" checked={s === 'COMPLETED'} />
                             </div>
                          </div>
                       </div>

                       <div className="bg-slate-50 p-6 rounded-[40px] border border-slate-100 shadow-inner flex flex-col gap-3">
                          <div className="text-center mb-4">
                             <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Life Cycle Controller</p>
                             <p className="text-[8px] font-bold text-slate-300 uppercase">Operational Life Cycle (Multi-Update)</p>
                          </div>
                          
                          {/* Step 1: Verify */}
                          <LifecycleBtn num="1" label="Verify" active={s === 'REPORTED'} done={s !== 'REPORTED' && s !== 'REJECTED' && s !== 'DRAFT'} onClick={()=>handleFlowUpdate(i.id, 'VERIFIED')} onReject={() => handleReject(i.id)} showReject={s === 'REPORTED'} />
                          
                          {/* Step 2: Assess */}
                          <LifecycleBtn num="2" label="Assess" active={s === 'VERIFIED'} done={['ASSESSED', 'ASSESSMENT', 'COMMANDED', 'ACTION', 'COMPLETED'].includes(s)} onClick={()=>onAction('assess', i)} />
                          
                          {/* Step 3: Command */}
                          <LifecycleBtn num="3" label="Command" active={['ASSESSED', 'ASSESSMENT'].includes(s)} done={['COMMANDED', 'ACTION', 'COMPLETED'].includes(s)} onClick={()=>onAction('instruksi', i)} />
                          
                          {/* Step 4: Action */}
                          <LifecycleBtn num="4" label="Action" active={s === 'COMMANDED'} done={['ACTION', 'COMPLETED'].includes(s)} onClick={()=>onAction('action', i)} />
                          
                          {/* Step 5: Archive */}
                          <button onClick={()=>handleFlowUpdate(i.id, 'COMPLETED')} disabled={s !== 'ACTION'} className={`mt-4 py-4 rounded-[25px] font-black text-[10px] uppercase shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 ${s === 'ACTION' ? 'bg-slate-900 text-white cursor-pointer hover:bg-black' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}><i className="fas fa-archive text-amber-500"></i> Archive Incident</button>
                       </div>

                       <div className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-inner flex flex-col gap-4 h-[480px]">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 italic">Personnel Mobilization</h4>
                          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                             {waitingList.map(v => (
                               <div key={v.id} className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                                  <div className="flex justify-between">
                                     <p className="text-[11px] font-black text-slate-800 uppercase">{v.full_name}</p>
                                     <span className="text-[7px] bg-amber-100 text-[#006432] px-2 py-0.5 rounded font-black uppercase">{v.status}</span>
                                  </div>
                                  <p className="text-[8px] text-slate-400 mt-2 uppercase">{v.region} • {v.expertise}</p>
                                  <div className="flex gap-2 mt-4">
                                     <button onClick={() => handleApproveDeployment(v.id, 'approved')} className="flex-1 bg-white border border-[#006432] text-[#006432] py-2 rounded-xl text-[8px] font-black uppercase hover:bg-[#006432] hover:text-white transition-all">Verify Personnel</button>
                                  </div>
                               </div>
                             ))}
                             {waitingList.length === 0 && <p className="text-center text-slate-300 text-[9px] py-20 uppercase tracking-widest italic">Awaiting tactical field force...</p>}
                          </div>
                       </div>
                    </div>
                 )}

                 <div className="mt-10 pt-6 border-t border-slate-100 flex justify-between items-center">
                    <button onClick={()=>generatePDF(i)} className="bg-red-600 text-white px-10 py-3.5 rounded-[22px] font-black text-[11px] uppercase shadow-xl flex items-center gap-3 active:scale-95"><i className="fas fa-file-pdf"></i> Generate SITREP</button>
                    <button onClick={() => setExpandedId(null)} className="text-[10px] font-black text-slate-300 hover:text-slate-500 uppercase tracking-widest italic underline">➔ Tutup Workspace</button>
                 </div>
              </div>
            )}
          </div>
        )})}
      </div>
    </div>
  );
};

// --- SUB-COMPONENTS ---
const Input = ({ label, value, onChange, placeholder }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">{label}</label>
    <input className="p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-2 ring-green-600" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
  </div>
);

const TextArea = ({ label, value, onChange, placeholder }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">{label}</label>
    <textarea className="p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold shadow-sm outline-none h-24 focus:ring-2 ring-green-600" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
  </div>
);

const CheckItem = ({ label, checked }) => (
  <div className="flex items-center gap-3">
    <div className={`w-4 h-4 rounded-lg flex items-center justify-center border-2 transition-all ${checked ? 'bg-[#006432] border-[#006432] text-white shadow-lg shadow-green-200' : 'bg-white border-slate-200'}`}>
      {checked && <i className="fas fa-check text-[7px]"></i>}
    </div>
    <span className={`text-[10px] font-bold transition-all ${checked ? 'text-[#006432] italic' : 'text-slate-400'}`}>{label}</span>
  </div>
);

const LifecycleBtn = ({ num, label, active, done, onClick, onReject, showReject }) => {
  const isClickable = active || done;
  return (
    <div className="group relative">
       <div onClick={() => isClickable && onClick()} className={`flex items-center justify-between p-4 rounded-[25px] border-2 transition-all ${active ? 'bg-[#006432] border-[#006432] text-white shadow-xl scale-[1.02] cursor-pointer' : done ? 'bg-green-50 border-green-100 opacity-90 cursor-pointer hover:bg-green-100' : 'bg-white border-slate-50 opacity-40 cursor-not-allowed'}`}>
          <div className="flex items-center gap-4">
             <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-[10px] ${done ? 'bg-[#006432] text-white' : active ? 'bg-amber-400 text-[#006432]' : 'bg-slate-200 text-slate-400'}`}>
                {done ? <i className="fas fa-check"></i> : num}
             </div>
             <div className="flex flex-col leading-none">
                <span className={`text-[11px] font-black uppercase ${active ? 'text-white' : done ? 'text-[#006432]' : 'text-slate-300'}`}>{label}</span>
                {active && <span className="text-[7px] text-amber-400 font-black animate-pulse uppercase mt-1 italic leading-none">Operational Target</span>}
             </div>
          </div>
          
          {showReject && (
             <button onClick={(e) => { e.stopPropagation(); onReject(); }} className="bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-[12px] hover:bg-red-800 transition-all active:scale-75 shadow-xl border-2 border-white" title="Reject / Fake Report"><i className="fas fa-times"></i></button>
          )}
       </div>
    </div>
  );
};

export default CompleteView;