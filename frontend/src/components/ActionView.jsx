import React, { useState } from 'react';
import api from '../services/api';

const ActionView = ({ incident, onComplete }) => {
  const klusterList = [
    { id: 'logistik', name: 'Logistik & Sembako', hasPaket: true },
    { id: 'medis', name: 'Kesehatan & Medis', hasPaket: false },
    { id: 'esar', name: 'ESAR / Evakuasi', hasPaket: false },
    { id: 'psikososial', name: 'Psikososial', hasPaket: true },
    { id: 'rekonstruksi', name: 'Rekonstruksi', hasPaket: true }
  ];

  const [actions, setActions] = useState(
    klusterList.reduce((acc, k) => ({ ...acc, [k.id]: { nama_kegiatan: '', jumlah_paket: '', penerima_manfaat: '' } }), {})
  );

  const handleSubmitAll = async () => {
    const filled = Object.keys(actions).filter(id => actions[id].nama_kegiatan.trim() !== "");
    if (filled.length === 0) return alert("Isi minimal satu kegiatan!");

    try {
      for (const id of filled) {
        await api.post('incidents/actions', {
          incident_id: incident.id,
          kluster: klusterList.find(k => k.id === id).name,
          ...actions[id]
        });
      }
      alert("✓ DATA RESPON BERHASIL DISIMPAN!");
      onComplete();
    } catch (e) { alert("Gagal simpan respon."); }
  };

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] font-sans">
      <div className="p-6 border-b bg-white flex justify-between items-center shadow-sm">
        <h2 className="font-black text-nu-green uppercase italic tracking-tighter">Mission Response Log: {incident.title}</h2>
        <div className="flex gap-4">
           <button onClick={onComplete} className="text-slate-400 font-bold text-xs uppercase">Batal</button>
           <button onClick={handleSubmitAll} className="bg-nu-green text-white px-8 py-2 rounded-full font-black text-xs shadow-lg hover:bg-green-800 transition-all uppercase">Simpan Seluruh Respon</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-10">
        <div className="bg-white rounded-[40px] shadow-2xl border border-slate-100 overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                <th className="p-5">Kluster</th>
                <th className="p-5">Nama Kegiatan (Essay)</th>
                <th className="p-5">Jumlah Paket</th>
                <th className="p-5">Penerima Manfaat</th>
              </tr>
            </thead>
            <tbody>
              {klusterList.map((k) => (
                <tr key={k.id} className="border-b border-slate-50 hover:bg-green-50/30 transition-colors">
                  <td className="p-5"><span className="font-bold text-nu-green text-sm italic">{k.name}</span></td>
                  <td className="p-3"><input type="text" className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 ring-nu-green" placeholder="..." value={actions[k.id].nama_kegiatan} onChange={(e) => setActions({...actions, [k.id]: {...actions[k.id], nama_kegiatan: e.target.value}})} /></td>
                  <td className="p-3"><input type="text" disabled={!k.hasPaket} className={`w-full p-3 border-none rounded-xl text-xs font-bold ${!k.hasPaket ? 'bg-slate-200' : 'bg-slate-50'}`} placeholder={k.hasPaket ? "Qty" : "N/A"} value={actions[k.id].jumlah_paket} onChange={(e) => setActions({...actions, [k.id]: {...actions[k.id], jumlah_paket: e.target.value}})} /></td>
                  <td className="p-3"><input type="text" className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-bold" placeholder="Jiwa/KK" value={actions[k.id].penerima_manfaat} onChange={(e) => setActions({...actions, [k.id]: {...actions[k.id], penerima_manfaat: e.target.value}})} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default ActionView;