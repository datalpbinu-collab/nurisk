const axios = require('axios');
const path = require('path');
const fs = require('fs');
const pointInPolygon = require('point-in-polygon');

let jatengRegencies = [];

const LOCAL_GEOJSON_PATH = path.join(__dirname, '../data/jateng-kabupaten.geojson');

const loadJatengGeoJSON = async () => {
  console.log('[GEOJSON] Loading Jawa Tengah regency boundaries...');

  // ── 1. Coba file lokal dulu (paling cepat & reliable) ──────────────────────
  try {
    if (fs.existsSync(LOCAL_GEOJSON_PATH)) {
      const raw = fs.readFileSync(LOCAL_GEOJSON_PATH, 'utf-8');
      const data = JSON.parse(raw);
      if (data?.features?.length > 0) {
        jatengRegencies = mapFeatures(data.features);
        console.log(`✅ [GEOJSON] Loaded ${jatengRegencies.length} regencies from local file.`);
        return;
      }
    }
  } catch (e) {
    console.warn('[GEOJSON] Local file read failed:', e.message);
  }

  // ── 2. Fallback: download dari GADM (sumber terpercaya) ────────────────────
  try {
    console.log('[GEOJSON] Local file not found. Fetching from GADM...');
    const res = await axios.get(
      'https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_IDN_2.json',
      { timeout: 20000 }
    );
    const features = res.data?.features?.filter(f => f.properties.NAME_1 === 'JawaTengah') || [];

    if (features.length > 0) {
      const mapped = features.map(f => ({
        type: 'Feature',
        properties: { name: f.properties.NAME_2 },
        geometry: f.geometry
      }));
      jatengRegencies = mapFeatures(mapped);

      // Simpan ke lokal agar next restart langsung baca lokal
      try {
        fs.mkdirSync(path.dirname(LOCAL_GEOJSON_PATH), { recursive: true });
        fs.writeFileSync(LOCAL_GEOJSON_PATH, JSON.stringify({ type: 'FeatureCollection', features: mapped }));
        console.log('[GEOJSON] Cached to local file for future restarts.');
      } catch { /* ignore write error */ }

      console.log(`✅ [GEOJSON] Loaded ${jatengRegencies.length} regencies from GADM.`);
      return;
    }
  } catch (e) {
    console.warn('[GEOJSON] GADM fetch failed:', e.message);
  }

  // ── 3. Semua sumber gagal — server tetap jalan ─────────────────────────────
  console.warn('[GEOJSON] All sources failed. Point-in-Polygon will be disabled.');
  jatengRegencies = [];
};

const mapFeatures = (features) =>
  features
    .filter(f => f.geometry)
    .map(f => ({
      name: f.properties?.name || f.properties?.NAME_2 || 'Unknown',
      geometry: f.geometry,
    }));

const getRegencyByCoordinates = (latitude, longitude) => {
  if (!jatengRegencies || jatengRegencies.length === 0) return null;

  const point = [longitude, latitude]; // GeoJSON: [lon, lat]

  for (const regency of jatengRegencies) {
    try {
      const { geometry } = regency;
      if (geometry.type === 'Polygon' && pointInPolygon(point, geometry.coordinates[0])) return regency.name;
      if (geometry.type === 'MultiPolygon' && geometry.coordinates.some(poly => pointInPolygon(point, poly[0]))) return regency.name;
    } catch { /* skip malformed */ }
  }
  return null;
};

module.exports = {
  loadJatengGeoJSON,
  getRegencyByCoordinates,
};