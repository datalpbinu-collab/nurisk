import React from 'react';

const Placeholder = ({ name }) => (
  <div className="p-8 text-center bg-white rounded-3xl shadow-md border">
    <h2 className="text-xl font-bold text-nu-green">{name}</h2>
    <p className="text-slate-400 mt-2 italic">Component is under construction...</p>
  </div>
);

export const MapHUD = () => <Placeholder name="Command Center (Map HUD)" />;
export const MissionManager = () => <Placeholder name="Mission Manager" />;
export const InventoryView = () => <Placeholder name="Strategic Assets Hub" />;
export const Wallboard = () => <Placeholder name="Strategic Monitoring Wall" />;
export const LogFooter = () => <div className="h-10 bg-[#020617] border-t border-white/5 flex items-center px-4 overflow-hidden shrink-0 z-[2000] text-slate-500 text-[9px] uppercase tracking-widest">System Secure • Handshake established</div>;
export const LogisticsHub = () => <Placeholder name="Logistics Request Hub" />;
export const Assessment = () => <Placeholder name="Detailed Assessment" />;
export const InstructionView = () => <Placeholder name="Instruction View" />;
export const ActionView = () => <Placeholder name="Action View" />;
