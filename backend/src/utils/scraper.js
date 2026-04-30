const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const Parser = require('rss-parser');

// Try to load crypto-js, if not available use fallback
let CryptoJS;
try {
  CryptoJS = require('crypto-js');
} catch (e) {
  console.warn('[SCRAPER] crypto-js not installed, using fallback');
  CryptoJS = { SHA256: (data) => data };
}

const aiOrchestrator = require('./ai_orchestrator');

const JATENG_KEYWORDS = ['jateng', 'jawa tengah', 'semarang', 'demak', 'kudus', 'pati', 'rembang', 'blora', 'grobogan', 'solo', 'sragen', 'wonogiri', 'klaten', 'boyolali', 'karanganyar', 'sragen', 'pekalongan', 'banyumas', 'cilacap', 'purbalingga', 'banjarnegara', 'kebumen', 'magelang', 'wonosobo', 'temanggung', 'salatiga', 'Kendal', 'batang', 'pemalang', 'tegal', 'brebes'];

const JATENG_COORDS = {
    "Semarang": { lat: -6.99, lng: 110.42, primary_regency: "Semarang" },
    "Demak": { lat: -6.89, lng: 110.63, primary_regency: "Demak" },
    "Merapi": { lat: -7.540, lng: 110.446, primary_regency: "Magelang" },
    "Slamet": { lat: -7.242, lng: 109.208, primary_regency: "Pemalang" },
    "Dieng": { lat: -7.200, lng: 109.920, primary_regency: "Banjarnegara" },
    "Sumbing": { lat: -7.384, lng: 110.070, primary_regency: "Temanggung" },
    "Sindoro": { lat: -7.300, lng: 109.992, primary_regency: "Wonosobo" },
    "Semeru": { lat: -8.108, lng: 112.922, primary_regency: "Lumajang" }
};

const VOLCANO_CODES = {
    "MER": { name: "Merapi", lat: -7.540, lng: 110.446, region: "Magelang" },
    "SMR": { name: "Semeru", lat: -8.108, lng: 112.922, region: "Lumajang" },
    "SLA": { name: "Slamet", lat: -7.242, lng: 109.208, region: "Pemalang" },
    "DIE": { name: "Dieng", lat: -7.200, lng: 109.920, region: "Banjarnegara" },
    "SBG": { name: "Sumbing", lat: -7.384, lng: 110.070, region: "Temanggung" },
    "SUN": { name: "Sundoro", lat: -7.300, lng: 109.992, region: "Wonosobo" }
};

const VOLCANO_ALERT_LEVELS = {
    NORMAL: { interval: 0, collect: false },
    WASPADA: { interval: 360, collect: true },
    SIAGA: { interval: 180, collect: true },
    AWAS: { interval: 60, collect: true }
};

const CENTRAL_JAVA_BOUNDS = {
    minLat: -7.9,
    maxLat: -6.5,
    minLng: 108.7,
    maxLng: 111.5
};

const isInCentralJava = (lat, lng, wilayahText) => {
    if (lat && lng) {
        if (lat >= CENTRAL_JAVA_BOUNDS.minLat && lat <= CENTRAL_JAVA_BOUNDS.maxLat &&
            lng >= CENTRAL_JAVA_BOUNDS.minLng && lng <= CENTRAL_JAVA_BOUNDS.maxLng) {
            return true;
        }
    }
    return isCentralJava(wilayahText || '');
};

let currentVolcanoStatus = {};

const SOURCES = [
    { name: 'Antara Tengah', url: 'https://jateng.antaranews.com/rss/nasional.xml' },
    { name: 'BMKG Nowcast', url: 'https://www.bmkg.go.id/alerts/nowcast/id/rss.xml' }
];

const detectLocation = (text) => {
    for (let kab in JATENG_COORDS) {
        if (text.toLowerCase().includes(kab.toLowerCase())) {
            return { name: kab, ...JATENG_COORDS[kab] };
        }
    }
    return { name: 'Jawa Tengah', lat: -7.15, lng: 110.14 };
};

const isCentralJava = (text) => {
    const lowerText = text.toLowerCase();
    return JATENG_KEYWORDS.some(kw => lowerText.includes(kw));
};

const getHighestAlertLevel = () => {
    const levels = Object.values(currentVolcanoStatus);
    if (levels.includes('AWAS')) return 'AWAS';
    if (levels.includes('SIAGA')) return 'SIAGA';
    if (levels.includes('WASPADA')) return 'WASPADA';
    return 'NORMAL';
};

// --- SCRAPER 1: MAGMA INDONESIA (HTML Parsing from Laporan Harian) ---
const scrapeVolcanoActivity = async () => {
    console.log("[AI-GEOLOGY] Scraping MAGMA Indonesia (Volcano)...");
    const alertLevels = {};
    try {
        const res = await axios.get('https://magma.esdm.go.id/v1/gunung-api/laporan-harian', {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 20000
        });

        const $ = cheerio.load(res.data);
        let count = 0;

        $('table.table').first().find('tbody tr').each((i, row) => {
            try {
                const cells = $(row).find('th, td');
                if (cells.length < 5) return;

                const volcanoName = $(cells[1]).text().trim();
                const visual = $(cells[2]).text().trim().substring(0, 200);
                const seismicity = $(cells[3]).text().trim();
                const recommendation = $(cells[4]).text().trim().substring(0, 200);

                for (const [code, volcano] of Object.entries(VOLCANO_CODES)) {
                    if (volcanoName.toLowerCase().includes(volcano.name.toLowerCase())) {
                        let alertLevel = 'NORMAL';
                        if (seismicity.includes('Letusan') || seismicity.includes('Erupsi')) alertLevel = 'AWAS';
                        else if (seismicity.includes('Guguran')) alertLevel = 'SIAGA';
                        else if (seismicity.includes('Tremor')) alertLevel = 'WASPADA';

                        alertLevels[volcano.name] = alertLevel;

                        const config = VOLCANO_ALERT_LEVELS[alertLevel];
                        if (config && config.collect) {
                            setTimeout(async () => {
                                await aiOrchestrator.processDeduplication({
                                    title: `[${volcano.name}] Status ${alertLevel}`,
                                    category: 'Gunung Api',
                                    source: 'MAGMA Indonesia',
                                    url: 'https://magma.esdm.go.id/v1/gunung-api/laporan-harian',
                                    lat: volcano.lat,
                                    lng: volcano.lng,
                                    region: volcano.region,
                                    raw_content: `${visual} | Kegempaan: ${seismicity} | Rekomendasi: ${recommendation}`,
                                    status_level: alertLevel
                                });
                            }, i * 200);
                            count++;
                            console.log(`  → ${volcano.name}: ${alertLevel}`);
                        } else {
                            console.log(`  → ${volcano.name}: ${alertLevel} (no collection - normal)`);
                        }
                        break;
                    }
                }
            } catch (e) { }
        });

        currentVolcanoStatus = alertLevels;
        console.log(`✅ [AI-GEOLOGY] Processed ${count} volcano alerts (highest: ${getHighestAlertLevel()})`);
    } catch (e) {
        console.error("[ERROR] MAGMA Scraper Failed:", e.message);
    }
};

// --- SCRAPER 2: BMKG GEMPA (Earthquake via XML - Central Java only) ---
const scrapeEarthquakeData = async () => {
    console.log("[AI-SEISMIC] Scraping BMKG Earthquake Data (Central Java only)...");
    const bmkgUrls = [
        { name: 'Latest', url: 'https://data.bmkg.go.id/DataMKG/TEWS/autogempa.xml' },
        { name: 'M5+', url: 'https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.xml' },
        { name: 'Felt', url: 'https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.xml' }
    ];

    let count = 0;
    for (const src of bmkgUrls) {
        try {
            const res = await axios.get(src.url, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/xml, text/xml, application/xhtml+xml, text/html'
                },
                timeout: 15000
            });

            if (res.data && typeof res.data === 'string') {
                const $ = cheerio.load(res.data, { xmlMode: true });
                const isList = src.name !== 'Latest';
                
                $('gempa').each((i, el) => {
                    if (isList && i >= 15) return;
                    const gemaEl = $(el);
                    
                    const magnitude = parseFloat(gemaEl.find('Magnitude').text() || gemaEl.attr('magnitudo')) || 0;
                    if (magnitude < 3.0) return;

                    const wilayah = gemaEl.find('Wilayah').text() || gemaEl.attr('wilayah') || '';
                    const tanggal = gemaEl.find('Tanggal').text() || gemaEl.attr('tgl') || '';
                    const jam = gemaEl.find('Jam').text() || gemaEl.attr('jam') || '';
                    const kedalaman = gemaEl.find('Kedalaman').text() || gemaEl.attr('kedalaman') || '0';
                    const lintang = gemaEl.find('Lintang').text() || gemaEl.attr('lintang') || '-7.15';
                    const bujur = gemaEl.find('Bujur').text() || gemaEl.attr('bujur') || '110.14';
                    const dirasakan = gemaEl.find('Dirasakan').text() || '-';
                    const potensi = gemaEl.find('Potensi').text() || '-';

                    const lat = parseFloat(lintang) || -7.15;
                    const lng = parseFloat(bujur) || 110.14;

if (isInCentralJava(lat, lng, wilayah)) {
                        aiOrchestrator.processDeduplication({
                            title: `Gempa M${magnitude.toFixed(1)} - ${wilayah}`,
                            category: 'Gempa',
                            source: 'BMKG',
                            url: src.url,
                            lat: lat,
                            lng: lng,
                            region: detectLocation(wilayah).name,
                            raw_Content: `Waktu: ${tanggal} ${jam} | Kedalaman: ${kedalaman}km | Lintang: ${lintang} | Bujur: ${bujur} | Dirasakan: ${dirasakan} | Potensi: ${potensi}`,
                            status_Level: magnitude >= 5.0 ? 'HIGH' : magnitude >= 4.0 ? 'MEDIUM' : 'LOW'
                        });
                        count++;
                    }
                });
                console.log(`[BMKG] ${src.name}: OK (${count} processed)`);
            }
        } catch (e) {
            console.log(`[BMKG] ${src.name} failed:`, e.message);
        }
    }
    console.log(`✅ [AI-SEISMIC] Total Central Java earthquakes: ${count}`);
};

// --- SCRAPER 3: CUACA/WEATHER (BMKG - Optional) ---
const scrapeWeatherData = async () => {
    console.log("[AI-WEATHER] Scraping BMKG Weather Data...");
    try {
        const weatherUrls = [
            'https://data.bmkg.go.id/DataMKG/CEWS/polda.json',
            'https://bmkg-api.vercel.app/weather/jawa-tengah'
        ];

        let success = false;
        for (const url of weatherUrls) {
            try {
                const res = await axios.get(url, {
                    headers: { 
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 10000
                });

                if (res.data && !res.data.error) {
                    success = true;
                    console.log(`✅ [AI-WEATHER] Data available from ${url.split('/').pop()}`);
                    break;
                }
            } catch (e) { }
        }

        if (!success) {
            console.log("[AI-WEATHER] No weather data available (sources unavailable)");
        }
    } catch (e) {
        console.error("[ERROR] Weather Scraper Failed:", e.message);
    }
};

// --- SCRAPER 4: CEVADIS BPBD JATENG ---
const scrapeCevadis = async () => {
    console.log("[AI-CEVADIS] Scraping CEVADIS BPBD Jateng...");
    try {
        // Coba beberapa pendekatan untuk mengakses CEVADIS
        const attempts = [
            {
                url: 'https://cevadis.bpbd.jatengprov.go.id/kejadian',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml'
                }
            },
            {
                url: 'https://cevadis.bpbd.jatengprov.go.id/api/kejadian',
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/json'
                }
            }
        ];

        let res = null;
        for (const attempt of attempts) {
            try {
                res = await axios.get(attempt.url, {
                    headers: attempt.headers,
                    timeout: 15000,
                    validateStatus: () => true
                });
                if (res.status === 200) break;
            } catch (e) { continue; }
        }

        if (!res || res.status !== 200) {
            console.log(`[AI-CEVADIS] Direct access blocked, using Portal Data Jateng...`);
            return await scrapePortalDataJateng();
        }

        // Process response (JSON atau HTML)
        if (typeof res.data === 'string' && res.data.includes('<')) {
            // HTML response
            const $ = cheerio.load(res.data);
            let count = 0;
            
            $('table tbody tr, .kejadian-item, .incident-card').each((i, el) => {
                try {
                    const $el = $(el);
                    const text = $el.text().toLowerCase();
                    
                    // Deteksi jenis bencana
                    let jenisBencana = 'Bencana';
                    const disasterTypes = ['banjir', 'longsor', 'kebakaran', 'puting beliung', 'gempa', 'tsunami', 'gunung api'];
                    for (const dt of disasterTypes) {
                        if (text.includes(dt)) {
                            jenisBencana = dt.charAt(0).toUpperCase() + dt.slice(1);
                            break;
                        }
                    }
                    
                    // Cari lokasi
                    let lokasi = '';
                    for (const kw of JATENG_KEYWORDS) {
                        if (text.includes(kw)) {
                            lokasi = kw.charAt(0).toUpperCase() + kw.slice(1);
                            break;
                        }
                    }
                    
                    if (lokasi) {
                        const loc = detectLocation(lokasi);
                        aiOrchestrator.processDeduplication({
                            title: `${jenisBencana} - ${lokasi}`,
                            category: jenisBencana,
                            source: 'CEVADIS BPBD Jateng',
                            url: 'https://cevadis.bpbd.jatengprov.go.id/kejadian',
                            lat: loc.lat,
                            lng: loc.lng,
                            region: loc.name,
                            raw_content: $el.text().substring(0, 300),
                            status_level: 'REPORTED'
                        });
                        count++;
                    }
                } catch (e) { }
            });
            console.log(`✅ [AI-CEVADIS] Processed ${count} incidents from HTML`);
        } else if (res.data && typeof res.data === 'object') {
            // JSON response
            const items = Array.isArray(res.data) ? res.data : (res.data.data || res.data.items || []);
            let count = 0;
            
            for (const item of items.slice(0, 20)) {
                try {
                    const loc = detectLocation(item.lokasi || item.location || item.wilayah || '');
                    aiOrchestrator.processDeduplication({
                        title: item.judul || item.title || `${item.jenis_bencana || 'Bencana'} - ${loc.name}`,
                        category: item.jenis_bencana || item.disaster_type || 'Bencana',
                        source: 'CEVADIS BPBD Jateng',
                        url: 'https://cevadis.bpbd.jatengprov.go.id/kejadian',
                        lat: item.latitude || item.lat || loc.lat,
                        lng: item.longitude || item.lng || loc.lng,
                        region: loc.name,
                        raw_content: item.keterangan || item.description || '',
                        status_level: 'REPORTED'
                    });
                    count++;
                } catch (e) { }
            }
            console.log(`✅ [AI-CEVADIS] Processed ${count} incidents from JSON`);
        }
    } catch (e) {
        console.error("[ERROR] CEVADIS Scraper Failed:", e.message);
        await scrapePortalDataJateng();
    }
};

// --- SCRAPER 4B: PORTAL DATA JATENG (Open Data API) ---
const scrapePortalDataJateng = async () => {
    console.log("[AI-PORTAL] Scraping Portal Data Jateng...");
    try {
        // Try to get recent disaster data from Portal Data Jateng
        const res = await axios.get('https://data.jatengprov.go.id/api/3/action/package_search', {
            params: {
                q: 'bencana',
                rows: 10,
                sort: 'metadata_modified desc'
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        });

        if (res.data?.result?.results) {
            let count = 0;
            for (const dataset of res.data.result.results) {
                const title = dataset.title || '';
                if (title.toLowerCase().includes('bencana') || title.toLowerCase().includes('kejadian')) {
                    const loc = detectLocation(title + ' ' + (dataset.notes || ''));
                    aiOrchestrator.processDeduplication({
                        title: title,
                        category: 'Bencana',
                        source: 'Portal Data Jateng',
                        url: `https://data.jatengprov.go.id/dataset/${dataset.name}`,
                        lat: loc.lat,
                        lng: loc.lng,
                        region: loc.name,
                        raw_content: dataset.notes?.substring(0, 300) || '',
                        status_level: 'REPORTED'
                    });
                    count++;
                }
            }
            console.log(`✅ [AI-PORTAL] Processed ${count} datasets`);
            return { success: true, count };
        } else {
            console.log(`[AI-PORTAL] No data returned from API`);
            return { success: false, reason: 'No data' };
        }
    } catch (e) {
        console.error("[ERROR] Portal Data Jateng Failed:", e.message);
        return { success: false, error: e.message };
    }
};

// --- SCRAPER 5: NEWS RSS ---
const scrapeNewsFeed = async () => {
    console.log("[AI-NEWS] Scanning News Feed (Central Java only)...");
    const parser = new Parser();
    
    for (const src of SOURCES) {
        try {
            const feed = await parser.parseURL(src.url);
            for (const item of feed.items.slice(0, 10)) {
                const text = ((item.title || "") + " " + (item.contentSnippet || item.content || "")).toLowerCase();
                
                if (!isCentralJava(text)) continue;
                
                if (text.includes('banjir') || text.includes('gempa') || 
                    text.includes('longsor') || text.includes('puting beliung') ||
                    text.includes('kebakaran') || text.includes('tsunami')) {
                    
                    const loc = detectLocation(text);
                    const category = text.includes('banjir') ? 'Banjir' :  
                                   text.includes('gempa') ? 'Gempa' :  
                                   text.includes('longsor') ? 'Longsor' :  
                                   text.includes('tsunami') ? 'Tsunami' : 'Cuaca Ekstrim';
                    
                    await aiOrchestrator.processDeduplication({
                        title: item.title,
                        category: category,
                        source: src.name,
                        url: item.link,
                        lat: loc.lat,
                        lng: loc.lng,
                        region: loc.name,
                        raw_content: item.contentSnippet?.substring(0, 300) || item.content?.substring(0, 300) || ''
                    });
                }
            }
            console.log(`  → ${src.name}: OK`);
        } catch (e) {
            console.error(`[ERROR] News Scraping ${src.name} failed:`, e.message);
        }
    }
};

// --- MAIN RUNNER ---
const runScraper = async () => {
    console.log("==========================================");
    console.log("[SYSTEM] PUSDATIN SCRAPER ENGINE STARTING");
    console.log("==========================================");
    
    await Promise.allSettled([
        scrapeVolcanoActivity(),
        scrapeEarthquakeData(),
        scrapeWeatherData(),
        scrapeCevadis(),
        scrapeNewsFeed()
    ]);
    
    console.log("[SYSTEM] ✅ All scrapers finished.");
};

// --- AUTOMATIC SCHEDULERS ---
let earthquakeScheduler = null;
let volcanoScheduler = null;
let newsScheduler = null;

const getOptimalInterval = () => {
    const highestLevel = getHighestAlertLevel();
    const config = VOLCANO_ALERT_LEVELS[highestLevel];
    return config?.interval || 0;
};

const getCronForMinutes = (minutes) => {
    if (minutes >= 60) {
        const hours = minutes / 60;
        return `0 */${hours} * * *`;
    }
    if (minutes === 0) {
        return null;
    }
    return `*/${minutes} * * * *`;
};

const startEarthquakeScheduler = (intervalMinutes = 1) => {
    if (earthquakeScheduler) {
        earthquakeScheduler.stop();
    }
    const cronExpr = intervalMinutes === 1 
        ? '* * * * *' 
        : `*/${intervalMinutes} * * * *`;
    console.log(`[SCHEDULER] Earthquake: every ${intervalMinutes} min (${cronExpr})`);
    earthquakeScheduler = cron.schedule(cronExpr, async () => {
        console.log("[SCHEDULER] Running earthquake scraper...");
        await scrapeEarthquakeData();
    });
    return earthquakeScheduler;
};

const startVolcanoScheduler = () => {
    if (volcanoScheduler) {
        volcanoScheduler.stop();
    }
    const interval = getOptimalInterval();
    const cronExpr = getCronForMinutes(interval);
    
    if (!cronExpr) {
        console.log(`[SCHEDULER] Volcano: No collection (status: ${getHighestAlertLevel()})`);
        volcanoScheduler = null;
        return null;
    }
    
    console.log(`[SCHEDULER] Volcano: every ${interval} min (${cronExpr})`);
    volcanoScheduler = cron.schedule(cronExpr, async () => {
        console.log("[SCHEDULER] Running volcano scraper...");
        await scrapeVolcanoActivity();
    });
    return volcanoScheduler;
};

const startNewsScheduler = (intervalMinutes = 60) => {
    if (newsScheduler) {
        newsScheduler.stop();
    }
    const hours = intervalMinutes / 60;
    const cronExpr = `0 */${hours} * * *`;
    console.log(`[SCHEDULER] News RSS: every ${intervalMinutes} min (${cronExpr})`);
    newsScheduler = cron.schedule(cronExpr, async () => {
        console.log("[SCHEDULER] Running news RSS scraper...");
        await scrapeNewsFeed();
    });
    return newsScheduler;
};

let cevadisScheduler = null;
const startCevadisScheduler = (intervalMinutes = 30) => {
    if (cevadisScheduler) {
        cevadisScheduler.stop();
    }
    const cronExpr = `*/${intervalMinutes} * * * *`;
    console.log(`[SCHEDULER] CEVADIS: every ${intervalMinutes} min (${cronExpr})`);
    cevadisScheduler = cron.schedule(cronExpr, async () => {
        console.log("[SCHEDULER] Running CEVADIS scraper...");
        await scrapeCevadis();
    });
    return cevadisScheduler;
};

const startAllSchedulers = () => {
    console.log("[SCHEDULER] Starting all schedulers...");
    startEarthquakeScheduler(1);
    startVolcanoScheduler();
    startNewsScheduler(60);
    startCevadisScheduler(30);
};

const stopAllSchedulers = () => {
    if (earthquakeScheduler) { earthquakeScheduler.stop(); earthquakeScheduler = null; }
    if (volcanoScheduler) { volcanoScheduler.stop(); volcanoScheduler = null; }
    if (newsScheduler) { newsScheduler.stop(); newsScheduler = null; }
    if (cevadisScheduler) { cevadisScheduler.stop(); cevadisScheduler = null; }
    console.log("[SCHEDULER] All schedulers stopped.");
};

const updateSchedulers = () => {
    if (volcanoScheduler) {
        const newInterval = getOptimalInterval();
        console.log(`[SCHEDULER] Updating volcano interval to ${newInterval} min (status: ${getHighestAlertLevel()})`);
        startVolcanoScheduler();
    }
};

module.exports = { 
    runScraper, 
    startAllSchedulers, 
    stopAllSchedulers,
    startEarthquakeScheduler,
    startVolcanoScheduler,
    startNewsScheduler,
    startCevadisScheduler,
    updateSchedulers,
    startScheduler: startAllSchedulers, // Alias for compatibility
    getHighestAlertLevel,
    getOptimalInterval
};
