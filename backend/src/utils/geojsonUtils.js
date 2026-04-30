const axios = require('axios');
const pointInPolygon = require('point-in-polygon');

let jatengRegencies = [];

const loadJatengGeoJSON = async () => {
    try {
        console.log("[GEOJSON] Loading Jawa Tengah regency boundaries...");
        const response = await axios.get('https://raw.githubusercontent.com/superpikar/indonesia-geojson/master/indonesia-regencies-cities.json');
        const allFeatures = response.data.features;

        // Filter for Jawa Tengah regencies/cities
        jatengRegencies = allFeatures.filter(feature => {
            const region = feature.properties.region || feature.properties.propinsi;
            return region && region.toUpperCase() === 'JAWA TENGAH';
        }).map(feature => {
            // Normalize name and extract geometry
            const name = feature.properties.name || feature.properties.NAME_2;
            return {
                name: name,
                geometry: feature.geometry
            };
        });
        console.log(`✅ [GEOJSON] Loaded ${jatengRegencies.length} regencies for Jawa Tengah.`);
    } catch (error) {
        console.error("[GEOJSON] Failed to load or parse GeoJSON data:", error.message);
        jatengRegencies = []; // Ensure it's empty on failure
    }
};

const getRegencyByCoordinates = (latitude, longitude) => {
    if (!jatengRegencies || jatengRegencies.length === 0) {
        console.warn("[GEOJSON] GeoJSON data not loaded or empty. Cannot perform Point-in-Polygon check.");
        return null;
    }

    const point = [longitude, latitude]; // GeoJSON coordinates are [longitude, latitude]

    for (const regency of jatengRegencies) {
        const geometry = regency.geometry;
        if (geometry.type === 'Polygon' && pointInPolygon(point, geometry.coordinates[0])) return regency.name;
        if (geometry.type === 'MultiPolygon' && geometry.coordinates.some(polygon => pointInPolygon(point, polygon[0]))) return regency.name;
    }
    return null; // No regency found
};

module.exports = {
    loadJatengGeoJSON,
    getRegencyByCoordinates
};