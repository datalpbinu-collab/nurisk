const express = require('express');
const http = require('http');
const cors = require('cors');
const axios = require('axios');
const pool = require('./config/database'); 
const { runScraper, startAllSchedulers } = require('./utils/scraper');

const app = express();
const server = http.createServer(app);

// 1. MIDDLEWARE DASAR
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 2. DATABASE MIGRATION (Ensure Tables Exist)
const migrateDb = async () => {
    try {
        // Create table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS incidents (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255),
                disaster_type VARCHAR(100),
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                region VARCHAR(100),
                status VARCHAR(50) DEFAULT 'reported'
            )
        `);

        // Add columns one by one
        const columns = [
            'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
            'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
            'kecamatan VARCHAR(100)',
            'desa VARCHAR(100)',
            'priority_score INTEGER DEFAULT 0',
            'priority_level VARCHAR(50) DEFAULT \'LOW\'',
            'has_shelter BOOLEAN DEFAULT FALSE',
            'needs_numeric JSONB DEFAULT \'{}\'',
            'reporter_name VARCHAR(255)',
            'whatsapp_number VARCHAR(50)',
            'event_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
            'photo_data TEXT',
            'is_ai_generated BOOLEAN DEFAULT FALSE',
            'description TEXT',
            'source_url TEXT'
        ];

        for (const col of columns) {
            const colName = col.split(' ')[0];
            try {
                await pool.query(`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS ${col}`);
            } catch (e) {
                console.log(`[MIGRATE] Column ${colName} may already exist:`, e.message);
            }
        }
            
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255),
                username VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'RELAWAN',
                region VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS volunteers (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                full_name VARCHAR(255),
                phone VARCHAR(50),
                birth_date DATE,
                gender VARCHAR(20),
                blood_type VARCHAR(5),
                regency VARCHAR(100),
                district VARCHAR(100),
                village VARCHAR(100),
                detail_address TEXT,
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                medical_history TEXT,
                expertise TEXT,
                experience TEXT,
                status VARCHAR(50) DEFAULT 'approved',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS volunteer_deployments (
                id SERIAL PRIMARY KEY,
                incident_id INTEGER REFERENCES incidents(id),
                volunteer_id INTEGER REFERENCES volunteers(id),
                status VARCHAR(50) DEFAULT 'pending',
                available_from TIMESTAMP,
                available_until TIMESTAMP,
                note TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS incident_instructions (
                incident_id INTEGER PRIMARY KEY REFERENCES incidents(id),
                nomor_sp VARCHAR(100),
                pj_nama VARCHAR(255),
                pic_lapangan VARCHAR(255),
                tim_anggota TEXT,
                armada_detail TEXT,
                peralatan_detail TEXT,
                duration VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS shelters (
                id SERIAL PRIMARY KEY,
                incident_id INTEGER REFERENCES incidents(id),
                name VARCHAR(255),
                region VARCHAR(100),
                status VARCHAR(50) DEFAULT 'AKTIF',
                score INTEGER DEFAULT 100,
                refugee_count INTEGER DEFAULT 0,
                stock_status VARCHAR(100) DEFAULT 'AMAN',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS volunteer_schedules (
                id SERIAL PRIMARY KEY,
                volunteer_id INTEGER REFERENCES volunteers(id),
                date DATE NOT NULL,
                shift_start TIME,
                shift_end TIME,
                status VARCHAR(20) DEFAULT 'available',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS certifications (
                id SERIAL PRIMARY KEY,
                volunteer_id INTEGER REFERENCES volunteers(id),
                name VARCHAR(255),
                issued_date DATE,
                expiry_date DATE,
                certificate_number VARCHAR(100),
                document_url TEXT,
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS asset_inventories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(100),
                quantity INTEGER DEFAULT 0,
                unit VARCHAR(50),
                location VARCHAR(255),
                warehouse_id INTEGER,
                qr_code VARCHAR(100) UNIQUE,
                status VARCHAR(50) DEFAULT 'available',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS asset_transactions (
                id SERIAL PRIMARY KEY,
                asset_id INTEGER REFERENCES asset_inventories(id),
                incident_id INTEGER REFERENCES incidents(id),
                volunteer_id INTEGER REFERENCES volunteers(id),
                quantity INTEGER,
                type VARCHAR(20),
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS chat_conversations (
                id SERIAL PRIMARY KEY,
                incident_id INTEGER REFERENCES incidents(id),
                type VARCHAR(20) DEFAULT 'incident',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                conversation_id INTEGER REFERENCES chat_conversations(id),
                sender_id INTEGER REFERENCES users(id),
                message TEXT,
                read_by INTEGER[],
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS team_messages (
                id SERIAL PRIMARY KEY,
                region VARCHAR(100),
                sender_id INTEGER,
                sender_name VARCHAR(255),
                message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS historical_disasters (
                id SERIAL PRIMARY KEY,
                region VARCHAR(100),
                disaster_type VARCHAR(100),
                event_date TIMESTAMP,
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                time VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_historical_region ON historical_disasters(region);
            CREATE INDEX IF NOT EXISTS idx_historical_disaster_type ON historical_disasters(disaster_type);
            CREATE INDEX IF NOT EXISTS idx_historical_event_date ON historical_disasters(event_date DESC);
            CREATE INDEX IF NOT EXISTS idx_historical_region_date ON historical_disasters(region, event_date DESC);

            CREATE TABLE IF NOT EXISTS logistics_requests (
                id SERIAL PRIMARY KEY,
                region VARCHAR(100),
                requester_id INTEGER,
                requester_name VARCHAR(255),
                type VARCHAR(50),
                quantity INTEGER,
                urgency VARCHAR(20) DEFAULT 'normal',
                notes TEXT,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255),
                body TEXT,
                target_role VARCHAR(50),
                target_region VARCHAR(100),
                incident_id INTEGER REFERENCES incidents(id),
                type VARCHAR(50) DEFAULT 'broadcast',
                status VARCHAR(20) DEFAULT 'pending',
                sent_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS volunteer_performance (
                id SERIAL PRIMARY KEY,
                volunteer_id INTEGER REFERENCES volunteers(id),
                incident_id INTEGER REFERENCES incidents(id),
                hours_worked DECIMAL(5,2),
                missions_completed INTEGER DEFAULT 0,
                rating DECIMAL(3,2),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ DATABASE: Schema Orchestrated');
    } catch (err) {
        console.error('❌ MIGRATION ERROR:', err.message);
    }
};
migrateDb();

// 2. LOGGING UNTUK DIAGNOSA (Cek di terminal VS Code)
app.use((req, res, next) => {
    console.log(`[ACCESS] ${req.method} ${req.url}`);
    
    // Tambahkan CSP Header untuk mengizinkan koneksi ke API publik & Map Tiles
    res.setHeader("Content-Security-Policy", 
        "default-src 'self'; " +
        "connect-src 'self' https://*.hf.space https://indonesia-public-api.vercel.app https://magma.esdm.go.id https://nominatim.openstreetmap.org https://data.bmkg.go.id https://api.rainviewer.com https://api.openweathermap.org; " +
        "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://tilecache.rainviewer.com https://*.openstreetmap.org; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline';"
    );
    next();
});

// ==========================================================
// 3. JALUR UTAMA INTELLIGENCE (HARUS DI ATAS RUTE LAIN)
// ==========================================================

// Tes koneksi dasar
app.get('/api/ping', (req, res) => res.json({ status: "Engine Online" }));

// RUTE VOLCANO REPORTS (DITARIK DARI DATABASE HASIL SCRAPER)
app.get('/api/geology/volcano-reports', async (req, res) => {
    console.log("--> Triggered: /api/geology/volcano-reports");
    try {
        const result = await pool.query(
            `SELECT * FROM incidents 
             WHERE disaster_type = 'Gunung Api' 
             OR is_ai_generated = TRUE 
             ORDER BY created_at DESC`
        );
        // Pastikan mengembalikan data mentah array []
        res.status(200).json(result.rows); 
    } catch (error) {
        console.error("DB_ERROR:", error.message);
        res.status(500).json({ error: "Database Error" });
    }
});

// PROXY GEOLOGI LIVE (BACKUP)
app.get('/api/geology/volcanoes-live', async (req, res) => {
    try {
        const response = await axios.get('https://indonesia-public-api.vercel.app/api/volcanoes');
        const jateng = response.data.filter(v => 
            v.latitude > -8.5 && v.latitude < -5.5 && v.longitude > 108.5 && v.longitude < 112.0
        );
        res.json(jateng);
    } catch (error) { res.json([]); }
});

// MANUAL RUN SCRAPER
app.get('/api/system/run-scraper', async (req, res) => {
    try {
        console.log("--> Manual Scraper Triggered via API");
        await runScraper();
        res.json({ success: true, message: "Scraper executed successfully" });
    } catch (error) {
        console.error("SCRAPER_ROUTE_ERROR:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Alias rute untuk menghindari 404 jika dipanggil tanpa prefix /api/system
app.get('/run-scraper', async (req, res) => {
    res.redirect('/api/system/run-scraper');
});

// AUTOMATIC SCHEDULER: Jalankan scraper setiap 1 jam
setInterval(async () => {
    console.log("[SYSTEM] Auto-running scraper...");
    await runScraper();
}, 3600000);

// Start all schedulers including CEVADIS
startAllSchedulers();

// ==========================================================
// 4. RUTE STANDAR LAINNYA (AUTH, INCIDENTS, DLL)
// ==========================================================
const loadRoute = (path, routeFile) => {
    try { app.use(path, require(routeFile)); } catch (e) { console.log(`Warning: Route ${path} could not be loaded.`); }
};

loadRoute('/api/auth', './routes/authRoutes');
loadRoute('/api/incidents', './routes/incidentRoutes');
loadRoute('/api/reports', './routes/reportRoutes');
loadRoute('/api/volunteers', './routes/volunteerRoutes');
loadRoute('/api/inventory', './routes/inventoryRoutes');
loadRoute('/api/logistics', './routes/logisticsRoutes');
loadRoute('/api/maps', './routes/mapRoutes');
loadRoute('/api/news', './routes/newsRoutes');
loadRoute('/api/chat', './routes/chatRoutes');
loadRoute('/api/analytics', './routes/analyticsRoutes');

// ==========================================================
// 5. HANDLING 404 (SANGAT TERAKHIR)
// ==========================================================
app.use((req, res) => {
    console.log(`!!! 404 HIT: ${req.url}`);
    res.status(404).json({ success: false, message: "Endpoint tidak ditemukan" });
});

// 6. START SERVER
const PORT = 7860;
server.listen(PORT, () => {
    console.log(`
    ==================================================
     PUSDATIN ENGINE STARTED ON PORT ${PORT}
    ==================================================
    `);
});

module.exports = app;