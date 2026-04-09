const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// --- 1. IMPORT SEMUA JALUR PINTU (ROUTES) ---
const authRoutes = require('./routes/authRoutes');
const incidentRoutes = require('./routes/incidentRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const newsRoutes = require('./routes/newsRoutes');
const logisticsRoutes = require('./routes/logisticsRoutes'); // INI YANG TADI TERLEWAT

// --- 2. AKTIFKAN SEMUA JALUR PINTU (ROUTES) ---
app.use('/api/auth', authRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/logistics', logisticsRoutes); // Pintu untuk Request Bantuan
app.get('/api/incidents/public', incidentController.getIncidents);

module.exports = app;