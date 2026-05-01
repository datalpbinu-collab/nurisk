import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

const HeatmapLayer = ({ incidents = [], intensityKey = 'priority_score' }) => {
  const map = useMap();
  const heatLayerRef = useRef(null); // Anti-bug: Melacak instance layer secara presisi

  useEffect(() => {
    if (!map) return;

    // FUNGSI UTAMA: MEMBUAT HEATMAP
    const updateHeatmap = () => {
      try {
        // 1. Bersihkan layer lama jika ada (Mencegah Layer Duplikat/Overlapping)
        if (heatLayerRef.current) {
          map.removeLayer(heatLayerRef.current);
          heatLayerRef.current = null;
        }

        if (!incidents || incidents.length === 0) return;

        // 2. Transformasi Data dengan Intensitas Dinamis (Power)
        // Intensitas dihitung berdasarkan skor insiden (Skala 0.0 - 1.0)
        const points = incidents
          .filter(i => i.latitude && i.longitude)
          .map(i => {
            // Ensure latitude and longitude are numbers
            const lat = parseFloat(i.latitude);
            const lng = parseFloat(i.longitude);
            if (isNaN(lat) || isNaN(lng)) return null;
            
            // Jika fixed_intensity, gunakan nilai tinggi (0.8), 
            // jika berdasarkan score, bagi dengan 1000 untuk normalisasi 0-1.
            const intensity = intensityKey === 'fixed_intensity' 
              ? 0.8 
              : Math.min((i[intensityKey] || 0) / 1000, 1.0);

            return [lat, lng, intensity];
          });
        
        const validPoints = points.filter(p => p !== null);

        if (validPoints.length > 0) {
          // 3. Konfigurasi Tactical Heatmap
          heatLayerRef.current = L.heatLayer(validPoints, {
            radius: 40,      // Luas jangkauan sebaran
            blur: 25,        // Kelembutan transisi
            maxZoom: 10,
            max: 1.0,        // Nilai maksimal intensitas
            gradient: {
              0.2: '#004d26', // Hijau (Aman)
              0.4: '#c5a059', // Emas (Waspada)
              0.6: '#ea580c', // Oranye (Bahaya)
              1.0: '#b91c1c'  // Merah Gelap (Bencana Kritikal)
            }
          });

          heatLayerRef.current.addTo(map);
        }

        // 4. Force Invalidate Size (Anti-Blank Map)
        map.invalidateSize();
      } catch (err) {
        console.error("Heatmap Orchestration Error:", err);
      }
    };

    // JEDA EKSEKUSI: Menjamin Container DOM sudah Render 100%
    const timer = setTimeout(updateHeatmap, 800);

    // CLEANUP: Saat komponen di-unmount atau data berubah
    return () => {
      clearTimeout(timer);
      if (map && heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    };
  }, [incidents, map]);

  return null;
};

export default HeatmapLayer;