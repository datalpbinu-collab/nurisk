import React, { useState, useEffect } from 'react';
import { getTickerData } from '../services/tickerService';
import { Radio } from 'lucide-react';

const NewsTicker = () => {
  const [text, setText] = useState('Initializing Strategic Feeds...');

  useEffect(() => {
    const update = async () => {
      const news = await getTickerData();
      setText(news);
    };
    update();
    const interval = setInterval(update, 300000);
    return () => clearInterval(interval);
  }, []);

  // Duplikat 4x agar tidak ada jeda saat loop (2 group x 2 copy per group)
  const content = `${text} \u00a0•\u00a0 ${text} \u00a0•\u00a0 ${text} \u00a0•\u00a0 ${text}`;

  return (
    <div className="h-10 bg-white border-b border-slate-100 flex items-center overflow-hidden whitespace-nowrap shrink-0 z-[2000]">
      {/* Badge kiri */}
      <div className="bg-[#006432] h-full px-4 flex items-center gap-2 shrink-0 shadow-sm">
        <Radio size={12} className="text-white/80 animate-pulse" />
        <span className="text-[9px] font-black text-white uppercase tracking-widest">Live</span>
      </div>

      {/* Scrolling text — infinite seamless loop */}
      <div className="flex-1 overflow-hidden relative flex items-center bg-slate-50 h-full">
        <div
          className="text-[11px] font-semibold text-slate-500 tracking-wider uppercase inline-block"
          style={{
            animation: 'marquee-ticker 90s linear infinite',
            whiteSpace: 'nowrap',
            paddingLeft: '2rem',
          }}
        >
          {/* 4 salinan untuk loop tanpa celah */}
          {content}
        </div>
      </div>

      {/* Badge kanan */}
      <div className="bg-slate-100 h-full px-3 flex items-center text-[9px] font-bold text-slate-400 border-l border-slate-200 shrink-0">
        Real-time
      </div>

      {/* Keyframe khusus untuk ticker ini */}
      <style>{`
        @keyframes marquee-ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

export default NewsTicker;