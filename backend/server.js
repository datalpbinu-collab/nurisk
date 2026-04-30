const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');

// --- IMPORT ENGINE ---
const { loadJatengGeoJSON } = require('./src/utils/geojsonUtils');
const { runScraper, startScheduler, startAllSchedulers } = require('./src/utils/scraper');

const app = express();
const server = http.createServer(app);

// =============================================================
//  DATABASE CONNECTION
// =============================================================
const pool = require('./src/config/database');
const validateEnv = require('./src/utils/validateEnv');

// Validate environment variables
const { missing, warnings } = validateEnv(process.env.NODE_ENV || 'development');
if (missing.length > 0 && process.env.NODE_ENV === 'production') {
  process.exit(1);
}

// =============================================================
//  MIGRATION
// =============================================================
const migrateDb = async () => {
  try {
    console.log('[SYSTEM] Verifying Database Columns...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS incidents (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        disaster_type VARCHAR(100),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        status VARCHAR(50) DEFAULT 'REPORTED',
        region VARCHAR(100),
        affected_people INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_ai_generated BOOLEAN DEFAULT FALSE,
        description TEXT,
        source_url TEXT,
        priority_score INTEGER DEFAULT 0,
        priority_level VARCHAR(50) DEFAULT 'LOW',
        damage_score INTEGER DEFAULT 0,
        needs_score INTEGER DEFAULT 0,
        has_shelter BOOLEAN DEFAULT FALSE,
        kecamatan VARCHAR(100),
        desa VARCHAR(100),
        needs_numeric JSONB DEFAULT '{}',
        reporter_name VARCHAR(255),
        whatsapp_number VARCHAR(50),
        event_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        photo_data TEXT,
        dampak_manusia JSONB DEFAULT '{}',
        dampak_rumah JSONB DEFAULT '{}',
        dampak_fasum JSONB DEFAULT '{}',
        dampak_vital JSONB DEFAULT '{}',
        dampak_lingkungan JSONB DEFAULT '{}'
      )
    `);

    // Create other tables...
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255),
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'RELAWAN',
        region VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
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
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS building_assessments (
        id SERIAL PRIMARY KEY,
        nama_gedung VARCHAR(255),
        fungsi VARCHAR(50),
        fungsi_lain VARCHAR(255),
        alamat TEXT,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        imb VARCHAR(20) DEFAULT 'tidak',
        slf VARCHAR(20) DEFAULT 'tidak',
        odnk INTEGER DEFAULT 0,
        ibu_hamil INTEGER DEFAULT 0,
        sakit_kronis INTEGER DEFAULT 0,
        lansia INTEGER DEFAULT 0,
        balita INTEGER DEFAULT 0,
        anak_anak INTEGER DEFAULT 0,
        dewasa_sehat INTEGER DEFAULT 0,
        pernah_terjadi BOOLEAN DEFAULT FALSE,
        ancaman JSONB DEFAULT '{}',
        riwayat_desa TEXT,
        struktur VARCHAR(20) DEFAULT 'tidak_tahu',
        non_struktural VARCHAR(20) DEFAULT 'tidak',
        fasilitas JSONB DEFAULT '[]',
        peralatan JSONB DEFAULT '[]',
        dana_darurat VARCHAR(20) DEFAULT 'tidak',
        anggaran VARCHAR(20) DEFAULT 'tidak',
        asuransi VARCHAR(20) DEFAULT 'tidak',
        kerjasama VARCHAR(255),
        peduli VARCHAR(20) DEFAULT 'cukup',
        konflik BOOLEAN DEFAULT FALSE,
        section INTEGER DEFAULT 1,
        total_score INTEGER DEFAULT 0,
        completed BOOLEAN DEFAULT FALSE,
        region VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        actor_id INTEGER REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50),
        entity_id INTEGER,
        payload JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS historical_disasters (
        id SERIAL PRIMARY KEY,
        region VARCHAR(100) NOT NULL,
        disaster_type VARCHAR(100) NOT NULL,
        event_date TIMESTAMP NOT NULL,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        time VARCHAR(10) DEFAULT '00:00'
      )
    `);

    console.log('✅ DATABASE: All Intelligence Columns Verified');
    await loadJatengGeoJSON();

  } catch (err) {
    console.error('❌ DATABASE MIGRATION ERROR:', err.message);
  }
};

// =============================================================
//  CORS
// =============================================================
let allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
if (process.env.ALLOWED_ORIGINS) {
  allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin tidak diizinkan — ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// =============================================================
//  SOCKET.IO
// =============================================================
const socketAllowedOrigins = process.env.SOCKET_ALLOWED_ORIGINS
  ? process.env.SOCKET_ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : allowedOrigins;

const io = new Server(server, {
  cors: {
    origin: socketAllowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('socketio', io);

io.on('connection', (socket) => {
  console.log(`[SOCKET] Client terhubung: ${socket.id}`);

  socket.on('join_user', (userId) => {
    socket.join(`user_${userId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[SOCKET] Client terputus: ${socket.id}`);
  });
});

// =============================================================
//  AUTH MIDDLEWARE
// =============================================================
const authMiddleware = require('./src/controllers/authMiddleware');

// =============================================================
//  ROUTES
// =============================================================
app.get('/api/ping', (req, res) => res.json({ status: "Engine Online", timestamp: new Date() }));

// Public routes (no auth required)
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/reports', require('./src/routes/reportRoutes'));
app.use('/api/historical-data', require('./src/routes/historicalDataRoutes'));

// Protected routes (require authentication)
app.use('/api/incidents', authMiddleware, require('./src/routes/incidentRoutes'));
app.use('/api/inventory', authMiddleware, require('./src/routes/inventoryRoutes'));
app.use('/api/logistics', authMiddleware, require('./src/routes/logisticsRoutes'));
app.use('/api/maps', authMiddleware, require('./src/routes/mapRoutes'));
app.use('/api/news', authMiddleware, require('./src/routes/newsRoutes'));
// Volunteers: auth handled inside route file (some endpoints public for registration)
app.use('/api/volunteers', require('./src/routes/volunteerRoutes'));
app.use('/api/chat', authMiddleware, require('./src/routes/chatRoutes'));
app.use('/api/notifications', authMiddleware, require('./src/routes/notificationRoutes'));
app.use('/api/assets', authMiddleware, require('./src/routes/assetRoutes'));
app.use('/api/analytics', authMiddleware, require('./src/routes/analyticsRoutes'));
app.use('/api/shelters', authMiddleware, require('./src/routes/shelterRoutes'));
app.use('/api/buildings', authMiddleware, require('./src/routes/buildingRoutes'));
app.use('/api/dashboard', authMiddleware, require('./src/routes/dashboardRoutes'));
app.use('/api/instructions', authMiddleware, require('./src/routes/instructionRoutes'));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// =============================================================
//  GLOBAL ERROR HANDLER
// =============================================================
app.use((err, req, res, next) => {
  console.error('🔥 GLOBAL_ERROR:', err.message, err.stack);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ success: false, error: message });
});

// =============================================================
//  START SERVER
// =============================================================
let currentPort = parseInt(process.env.PORT) || 7860;
const ENV = process.env.NODE_ENV || 'development';

const bootstrap = async () => {
  try {
    const client = await pool.connect();
    client.release();
    console.log('✅ DATABASE: PostgreSQL Connected');

    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    await migrateDb();

    server.listen(currentPort, () => {
      console.log(`
  =====================================================
  PUSDATIN ENGINE STARTED
  Port        : ${currentPort}
  Environment : ${ENV}
  =====================================================
      `);
    });
  } catch (err) {
    console.error('❌ BOOTSTRAP FAILED:', err.message || err.code || err);
    process.exit(1);
  }
};

bootstrap();
