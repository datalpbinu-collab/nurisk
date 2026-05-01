import React, { useState, useEffect } from 'react';
import { getTickerData } from '../services/tickerService';

const NewsTicker = () => {
  const [text, setText] = useState("Initializing Strategic Feeds...");

  useEffect(() => {
    const updateTicker = async () => {
      const news = await getTickerData();
      setText(news);
    };

    updateTicker();
    const interval = setInterval(updateTicker, 300000); // Update tiap 5 menit
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="h-12 bg-white border-t flex items-center overflow-hidden whitespace-nowrap sticky bottom-0 z-[2000] shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
      <div className="bg-[#006432] h-full px-8 flex items-center text-[10px] font-black italic text-white tracking-widest border-r z-20 shadow-2xl">
        LIVE INTELLIGENCE
      </div>
      <div className="flex-1 overflow-hidden relative flex items-center bg-slate-50 h-full">
        <div className="animate-marquee inline-block pl-10 text-[11px] font-bold uppercase text-slate-500 tracking-[0.2em]">
          {text} • {text} {/* Diulang agar tidak ada celah kosong */}
        </div>
      </div>
      <div className="bg-slate-100 h-full px-4 flex items-center text-[8px] font-black text-slate-400 border-l z-20">
        REAL-TIME FEED
      </div>
    </footer>
  );
};

export default NewsTicker;