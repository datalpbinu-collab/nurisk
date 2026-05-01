const https = require('https');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'src/data');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const url = 'https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_IDN_2.json';

console.log('Downloading GADM Indonesia level-2...');
const chunks = [];
https.get(url, res => {
  res.on('data', d => chunks.push(d));
  res.on('end', () => {
    const data = JSON.parse(Buffer.concat(chunks).toString());
    const jateng = {
      type: 'FeatureCollection',
      features: data.features
        .filter(f => f.properties.NAME_1 === 'Jawa Tengah')
        .map(f => ({
          type: 'Feature',
          properties: { name: f.properties.NAME_2 },
          geometry: f.geometry
        }))
    };
    const outPath = path.join(outDir, 'jateng-kabupaten.geojson');
    fs.writeFileSync(outPath, JSON.stringify(jateng));
    console.log(`Saved ${jateng.features.length} features to ${outPath}`);
  });
}).on('error', e => console.error('Error:', e.message));
