import api from './api';
import axios from 'axios';

export const getTickerData = async () => {
  try {
    const res = await api.get('news');
    const newsItems = res.data;
    const resQuake = await axios.get('https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json');
    const quake = resQuake.data.Infogempa.gempa[0];

    let tickerText = newsItems.map(n => 
        `[${n.source.toUpperCase()}] ${n.category.toUpperCase()}: ${n.title}`
    ).join(" •++• ");
    tickerText = `[BMKG GEMPA] M ${quake.Magnitude} - ${quake.Wilayah} (${quake.Potensi}) •++• ` + tickerText;

    return tickerText || "System Online: Central Java Intelligence Sync Active...";
  } catch (err) {
    return "Establishing Link to News Gateways...";
  }
};
