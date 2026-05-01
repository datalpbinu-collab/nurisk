import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON,
  LayersControl, Circle, ZoomControl, ScaleControl, WMSTileLayer
} from 'react-leaflet';
import L from 'leaflet';
import api from '../services/api';
import axios from 'axios';
import 'leaflet/dist/leaflet.css'; // Ensure Leaflet CSS is imported
import HeatmapLayer from './HeatmapLayer';
import { normalizeStatus, KAB_JATENG, DISASTER_TYPES } from '../utils/constants';

const CENTER_JATENG = [-7.15, 110.14];
const JATENG_BOUNDS = [[-8.8, 108.3], [-5.4, 111.9]];
const INARISK_WMS_URL = window.__env?.VITE_INARISK_WMS_URL || "https://inarisk1.bnpb.go.id:8443/geoserver/raster/wms";

const getTacticalIcon = (type, status, color = "#ef4444") => {
  const statusColors = {
    'REPORTED': '#64748b',
    'VERIFIED': '#3b82f6',
    'ASSESSMENT': '#eab308',
    'COMMANDED': '#f97316',
    'ACTION': '#22c55e',
    'COMPLETED': '#0f172a'
  };

  const finalColor = statusColors[normalizeStatus(status)] || color;

  const iconMap = {
    'banjir': 'faucet-drip',
    'banjir bandang': 'cloud-showers-heavy',
    'cuaca ekstrim': 'bolt-lightning',
    'gelombang ekstrim dan abrasi': 'water',
    'gempabumi': 'house-crack',
    'kebakaran hutan dan lahan': 'fire-flame-curved',
    'kekeringan': 'sun-plant-wilt',
    'letusan gunung api': 'volcano',
    'tanah longsor': 'hill-rockslide',
    'tsunami': 'house-tsunami',
    'likuefaksi': 'house-flood-water-circle-arrow-right',
    'default': 'satellite-dish'
  };

  const iconClass = iconMap[type?.toLowerCase()] || iconMap['default'];

  if (type?.toLowerCase().includes('gunung api')) {
    return L.divIcon({
      html: `<div class="relative flex items-center justify-center">
              <div class="animate-ping absolute h-8 w-8 rounded-full bg-orange-500 opacity-20"></div>
              <div style="width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-bottom: 22px solid ${finalColor}; filter: drop-shadow(0 0 5px ${finalColor});"></div>
              <div class="absolute top-[12px] text-[7px] font-black text-white italic">AI</div>
            </div>`,
      className: '', iconSize: [24, 24]
    });
  }

  return L.divIcon({
    html: `<div style="background-color: ${finalColor}" class="w-8 h-8 rounded-lg border-2 border-white shadow-2xl rotate-45 flex items-center justify-center animate-pulse">
          <div class="-rotate-45"><i class="fas fa-${iconClass} text-white text-[10px]"></i></div>
        </div>`,
    className: '', iconSize: [32, 32]
  });
};

const formatTacticalDate = (dateStr) => {
  if (!dateStr) return "BARU SAJA";
  const d = new Date(dateStr.includes(' ') ? dateStr.replace(' ', 'T') : dateStr);
  if (isNaN(d.getTime())) return "REALTIME";
  return d.toLocaleString('id-ID', { 
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
  }).replace(/\./g, ':');
};

function MapEngine() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
      map.setMaxBounds(JATENG_BOUNDS);
    }, 1000);
  }, [map]);
  return null;
}

const MapDisplay = ({ incidents = [], onSelect }) => {
  const [volcanoAI, setVolcanoAI] = useState([]);
  const [bmkg, setBmkg] = useState([]);
  const [historicalHotspots, setHistoricalHotspots] = useState([]);
  const [radarTime, setRadarTime] = useState(null);
  const [geoJsonData, setGeoJsonData] = useState(null);

  const [historicalFilterRegion, setHistoricalFilterRegion] = useState('all');
  const [historicalFilterDisasterType, setHistoricalFilterDisasterType] = useState('all');
  const [historicalFilterStartDate, setHistoricalFilterStartDate] = useState('');
  const [historicalFilterEndDate, setHistoricalFilterEndDate] = useState('');

  useEffect(() => {
    // Try multiple sources for GeoJSON data
    const geoJsonSources = [
      'https://raw.githubusercontent.com/denyherianto/indonesia-geojson-topojson-maps-with-38-provinces/main/GeoJSON/indonesia-38-provinces.geojson',
      'https://raw.githubusercontent.com/Alf-Anas/batas-administrasi-indonesia/master/provinsi.geojson',
      'https://cdn.jsdelivr.net/gh/denyherianto/indonesia-geojson-topojson-maps-with-38-provinces@main/GeoJSON/indonesia-38-provinces.geojson'
    ];
    
    const tryFetch = async (sources) => {
      for (const url of sources) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const text = await res.text();
          if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
            const data = JSON.parse(text);
            setGeoJsonData(data);
            return;
          }
        } catch (e) {
          console.warn(`GeoJSON source failed: ${url}`, e.message);
        }
      }
      console.error('All GeoJSON sources failed');
    };
    
    tryFetch(geoJsonSources);
  }, []);

  const syncIntelligence = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (historicalFilterRegion !== 'all') params.append('region', historicalFilterRegion);
      if (historicalFilterDisasterType !== 'all') params.append('disaster_type', historicalFilterDisasterType);
      if (historicalFilterStartDate) params.append('start_date', historicalFilterStartDate);
      if (historicalFilterEndDate) params.append('end_date', historicalFilterEndDate);

      const handleApiError = (defaultData) => {
        return (err) => {
          console.warn('API fetch error:', err.response?.status);
          return { data: defaultData };
        };
      };

      const [resQuake, resRadar, resHistorical] = await Promise.all([
        axios.get('https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json').catch(handleApiError({ Inforgempa: { gempa: [] } })),
        axios.get('https://api.rainviewer.com/public/weather-maps.json').catch(handleApiError({})),
        // Historical data may need auth, wrap with error handling
        api.get(`historical-data/map?${params.toString()}`).catch(handleApiError([]))
      ]);
      
      // Volcano data removed - backend doesn no longer provide geology/volcano-reports endpoint
      
      const quakeData = resQuake.data?.Infogempa?.gempa || [];
      setBmkg(quakeData);
      
      if (resRadar.data?.radar?.past?.length > 0) {
        setRadarTime(resRadar.data.radar.past.pop().time);
      }
      
      const validHistorical = (resHistorical.data || []).filter(h =>
        h.latitude && h.longitude && !isNaN(parseFloat(h.latitude)) && !isNaN(parseFloat(h.longitude))
      );
      setHistoricalHotspots(validHistorical);
    } catch (e) { 
      console.error("INTEL_SYNC_FAULT", e); 
    }
  }, [historicalFilterRegion, historicalFilterDisasterType, historicalFilterStartDate, historicalFilterEndDate]);

  useEffect(() => {
    syncIntelligence();
    const interval = setInterval(syncIntelligence, 300000);
    return () => clearInterval(interval);
  }, [syncIntelligence]);

  // Constants are now imported at the top of the file

  return (
    <div className="h-full w-full relative bg-[#f1f5f9]">
      
      <div className="absolute bottom-10 left-6 z-[1000] pointer-events-none">
        <div className="bg-white/90 backdrop-blur-md p-5 rounded-[2rem] border-2 border-[#006432]/10 shadow-2xl space-y-3 w-56">
           <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[10px] font-black text-[#006432] uppercase tracking-[0.1em]">Disaster Legend</span>
           </div>
           <div className="space-y-2.5">
              <LegendItem icon="triangle" color="bg-orange-500" label="Vulkanik (AI)" />
              <LegendItem icon="circle" color="bg-red-600" label="Seismik (BMKG)" />
              <LegendItem icon="square" color="bg-[#006432]" label="Misi Terverifikasi" />
              <LegendItem icon="fire" color="bg-yellow-500" label="Historis (Heatmap)" />
              {/* Filter UI for Historical Hotspots */}
              <div className="pt-4 border-t border-slate-100 mt-4">
                <p className="text-[8px] font-black text-slate-400 uppercase mb-2 italic">Filter Historis</p>
                <select
                  className="w-full p-2 bg-slate-50 rounded-lg text-[9px] font-bold mb-2"
                  value={historicalFilterRegion}
                  onChange={(e) => setHistoricalFilterRegion(e.target.value)}
                >
                  <option value="all">Semua Wilayah</option>
                  {KAB_JATENG.map((region) => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
                <select
                  className="w-full p-2 bg-slate-50 rounded-lg text-[9px] font-bold mb-2"
                  value={historicalFilterDisasterType}
                  onChange={(e) => setHistoricalFilterDisasterType(e.target.value)}
                >
                  <option value="all">Semua Jenis Bencana</option>
                  {DISASTER_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <input
                  type="date"
                  className="w-full p-2 bg-slate-50 rounded-lg text-[9px] font-bold mb-2"
                  value={historicalFilterStartDate}
                  onChange={(e) => setHistoricalFilterStartDate(e.target.value)}
                  title="Tanggal Mulai"
                />
                <input
                  type="date"
                  className="w-full p-2 bg-slate-50 rounded-lg text-[9px] font-bold mb-2"
                  value={historicalFilterEndDate}
                  onChange={(e) => setHistoricalFilterEndDate(e.target.value)}
                  title="Tanggal Akhir"
                />
                <button
                  onClick={syncIntelligence}
                  className="w-full bg-[#006432] text-white py-2 rounded-lg text-[9px] font-black uppercase mt-2"
                >Terapkan Filter</button>
              </div>
              <div className="pt-2">
                 <p className="text-[8px] font-black text-slate-400 uppercase mb-2 italic">Terrain & Hydro Arsir</p>
                 <div className="flex items-center gap-2">
                    <div className="w-full h-1.5 bg-gradient-to-r from-blue-300 via-blue-600 to-indigo-900 rounded-full opacity-60"></div>
                    <span className="text-[8px] font-bold text-slate-500 uppercase">Risk</span>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <MapContainer 
        center={CENTER_JATENG} zoom={9} minZoom={7} maxZoom={16}
        className="h-full w-full z-0" zoomControl={false}
      >
        <MapEngine />
        
        <LayersControl position="topright">
          {/* Overlay Batas Wilayah Administrasi */}
          <LayersControl.Overlay name="🗺️ Batas Kota/Kabupaten">
            {geoJsonData && (
              <GeoJSON 
                data={geoJsonData} 
                filter={(feature) => 
                  feature.properties.region === 'JAWA TENGAH' || 
                  feature.properties.propinsi === 'JAWA TENGAH'
                }
                // Use feature.properties.name or feature.properties.NAME_2 for regency name
                style={{
                  color: '#006432', weight: 1.5, fillOpacity: 0, dashArray: '3'
                }}
                onEachFeature={(feature, layer) => {
                  layer.bindTooltip(
                    feature.properties.name || feature.properties.NAME_2, 
                    { sticky: true, className: 'tactical-tooltip' }
                  );
                }}
              />
            )}
           </LayersControl.Overlay>

          <LayersControl.Overlay name="🗺️ Batas Desa">
            <WMSTileLayer
              url={INARISK_WMS_URL} layers="raster:Batas_Desa"
              format="image/png" transparent={true} version="1.1.1" styles="raster" opacity={0.5} maxNativeZoom={13}
            />
          </LayersControl.Overlay>

          <LayersControl.BaseLayer checked name="Tactical View (Street)">
            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="NASA Satellite Recon">
            <TileLayer 
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" 
              maxNativeZoom={17}
            />
          </LayersControl.BaseLayer>

          <LayersControl.Overlay name="⛰️ Tekstur Medan (Hillshade)">
            <TileLayer 
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}" 
              opacity={0.3} zIndex={1} maxNativeZoom={15}
            />
          </LayersControl.Overlay>

          

          <LayersControl.Overlay name="🌊 [MODEL] Bahaya Banjir">
            <WMSTileLayer
              url={INARISK_WMS_URL} layers="raster:INDEKS_BAHAYA_BANJIR1"
              format="image/png" transparent={true} version="1.1.1" styles="index_bahaya"
              opacity={0.5} zIndex={10} attribution="BNPB" maxNativeZoom={13}
            />
          </LayersControl.Overlay>

          <LayersControl.Overlay name="🌊 [MODEL] Banjir Bandang">
            <WMSTileLayer
              url={INARISK_WMS_URL} layers="raster:INDEKS_BAHAYA_BANJIRBANDANG1"
              format="image/png" transparent={true} version="1.1.1" styles="index_bahaya" opacity={0.5} maxNativeZoom={13}
            />
          </LayersControl.Overlay>

          <LayersControl.Overlay name="⛰️ [MODEL] Tanah Longsor">
            <WMSTileLayer
              url={INARISK_WMS_URL} layers="raster:INDEKS_BAHAYA_TANAHLONGSOR1"
              format="image/png" transparent={true} version="1.1.1" styles="index_bahaya" opacity={0.5} maxNativeZoom={13}
            />
           </LayersControl.Overlay>

          <LayersControl.Overlay name="⚡ [MODEL] Cuaca Ekstrim">
            <WMSTileLayer
              url={INARISK_WMS_URL} layers="raster:INDEKS_BAHAYA_CUACAEKSTRIM1"
              format="image/png" transparent={true} version="1.1.1" styles="index_bahaya" opacity={0.5} maxNativeZoom={13}
            />
          </LayersControl.Overlay>

          <LayersControl.Overlay name="☀️ [MODEL] Kekeringan">
            <WMSTileLayer
              url={INARISK_WMS_URL} layers="raster:INDEKS_BAHAYA_KEKERINGAN1"
              format="image/png" transparent={true} version="1.1.1" styles="index_bahaya" opacity={0.5} maxNativeZoom={13}
            />
          </LayersControl.Overlay>

          <LayersControl.Overlay name="🌋 [MODEL] Gunung Api">
            <WMSTileLayer
              url={INARISK_WMS_URL} layers="raster:INDEKS_BAHAYA_GUNUNGAPI1"
              format="image/png" transparent={true} version="1.1.1" styles="index_bahaya" opacity={0.5} maxNativeZoom={13}
            />
          </LayersControl.Overlay>

          <LayersControl.Overlay name="🛰️ Satelit Himawari-9 (NASA)">
            <TileLayer 
              url="https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Himawari9_AHI_Brightness_Temp_Band13/default/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png"
              opacity={0.3} 
              maxNativeZoom={6} 
              zIndex={50}
              attribution="NASA GIBS"
            />
          </LayersControl.Overlay>

          <LayersControl.Overlay name="🔥 Heatmap Konsentrasi">
             <HeatmapLayer incidents={incidents} />
          </LayersControl.Overlay>

          <LayersControl.Overlay name="🔥 Historis (Hotspots)">
             <HeatmapLayer incidents={historicalHotspots} intensityKey="fixed_intensity" /> {/* Pass historical data */}
          </LayersControl.Overlay>
        </LayersControl>

        <ZoomControl position="bottomright" />

        {volcanoAI.filter(v => !incidents.some(inc => inc.id === v.id)).map((v, i) => (
          <Marker 
            key={`volc-${v.id || i}`} 
            position={[parseFloat(v.latitude), parseFloat(v.longitude)]} 
            icon={getTacticalIcon('gunung api', v.status)}
          >
            <Popup className="tactical-popup">
              <div className="p-1 w-64 font-sans">
                <div className="flex justify-between items-center mb-2">
                   <h4 className="font-black text-slate-800 uppercase text-xs">{v.title}</h4>
                   <span className="text-[7px] bg-red-600 text-white px-2 py-0.5 rounded font-black uppercase">VULKANIK</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 mb-2">
                   <p className="text-[10px] font-black text-red-600 uppercase mb-1">Status: {v.status}</p>
                   <p className="text-[11px] text-slate-700 leading-relaxed italic">"{v.description}"</p>
                </div>
                <div className="flex justify-between items-center text-[7px] font-bold text-slate-400 uppercase">
                   <span>MAGMA_ESDM Feed</span>
                   <span>Sync: {formatTacticalDate(v.updated_at)}</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {bmkg.map((g, i) => (
          <Marker 
            key={`q-${i}`} 
            position={[parseFloat(g.Coordinates.split(',')[0]), parseFloat(g.Coordinates.split(',')[1])]} 
            icon={L.divIcon({ 
              html: `<div class="bg-red-600 w-5 h-5 rounded-full animate-ping border-2 border-white shadow-[0_0_15px_red]"></div>`, 
              className: '' 
            })}
          >
            <Popup className="tactical-popup">
               <div className="p-1 w-56 font-sans">
                  <h4 className="font-black text-red-600 uppercase text-[10px] mb-2">Peringatan Seismik</h4>
                  <div className="space-y-1 text-slate-700 border-t pt-2">
                     <p className="text-xs font-bold uppercase">{g.Wilayah}</p>
                     <div className="flex gap-3 mt-2">
                        <div className="bg-red-50 p-2 rounded flex-1">
                           <p className="text-[8px] font-black text-red-600 uppercase">Magnitudo</p>
                           <p className="text-sm font-black">{g.Magnitude} SR</p>
                        </div>
                        <div className="bg-slate-50 p-2 rounded flex-1">
                           <p className="text-[8px] font-black text-slate-500 uppercase">Kedalaman</p>
                           <p className="text-sm font-black">{g.Kedalaman}</p>
                        </div>
                     </div>
                  </div>
               </div>
            </Popup>
          </Marker>
        ))}

        {incidents.filter(inc => 
          inc.latitude && inc.longitude && 
          !isNaN(parseFloat(inc.latitude)) && !isNaN(parseFloat(inc.longitude))
        ).map(inc => (
          <Marker 
            key={inc.id} 
            position={[parseFloat(inc.latitude), parseFloat(inc.longitude)]} 
            icon={getTacticalIcon(inc.disaster_type, inc.status)}
          >
            <Popup className="tactical-popup">
               <div className="p-1 w-64 font-sans">
                 <div className="flex justify-between items-start mb-2">
                      <h4 className="font-black text-[#006432] uppercase text-xs leading-tight">{inc.title}</h4>
                      <span className="text-[7px] bg-green-600 text-white px-2 py-0.5 rounded font-black uppercase">{inc.status}</span>
                 </div>
                 <div className="space-y-2 border-t pt-2">
                    <div className="flex items-center gap-2 text-slate-500">
                       <i className="fas fa-location-dot text-[10px]"></i>
                       <p className="text-[10px] font-bold uppercase">{inc.region}</p>
                    </div>
                    <p className="text-[11px] leading-relaxed bg-slate-50 p-2 rounded">
                       {inc.description || 'Sedang dalam penanganan unit aksi relawan.'}
                    </p>
                     {inc.needs_numeric && Object.values(inc.needs_numeric).some(v => v > 0) && (
                        <div className="mt-2 bg-amber-50 p-2 rounded-xl border border-amber-200">
                           <p className="text-[8px] font-black text-amber-700 uppercase mb-1">Kebutuhan Mendesak:</p>
                           <div className="flex flex-wrap gap-1">
                              {Object.entries(inc.needs_numeric).map(([k, v]) => v > 0 && (
                                 <span key={k} className="text-[7px] bg-white px-1.5 py-0.5 rounded border border-amber-100 font-bold uppercase">{k}: {v}</span>
                              ))}
                           </div>
                        </div>
                     )}
                  </div>
                </div>
             </Popup>
           </Marker>
         ))}
      </MapContainer>
    </div>
  );
};

const LegendItem = ({ icon, color, label }) => (
  <div className="flex items-center gap-3">
     {icon === 'triangle' && <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-b-orange-500 border-l-transparent border-r-transparent shadow-sm"></div>}
     {icon === 'circle' && <div className="w-3 h-3 rounded-full bg-red-600 shadow-sm"></div>}
     {icon === 'fire' && <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-sm flex items-center justify-center text-[8px] text-white"><i className="fas fa-fire"></i></div>}
     {icon === 'square' && <div className={`w-3 h-3 rounded-sm ${color} rotate-45 shadow-sm`}></div>}
     <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter">{label}</span>
  </div>
);

export default MapDisplay;
