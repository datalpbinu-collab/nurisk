const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

const authMiddleware = require('../controllers/authMiddleware'); // Import authMiddleware
console.log('[ROUTES] Loading analytics routes...');

// Main analytics endpoints
router.get('/dashboard', analyticsController.getDashboardStats);
router.get('/response-metrics', analyticsController.getResponseMetrics);
router.get('/incidents-by', analyticsController.getIncidentsByDimension);
router.get('/volunteers/performance', analyticsController.getVolunteerPerformance);
router.get('/kpis', analyticsController.getKPIs);

// Building stats
router.get('/buildings/stats', analyticsController.getBuildingStats);

// SITREP
router.get('/incidents/:incident_id/sitrep', analyticsController.generateSITREP);
router.get('/incidents/:incident_id/sitrep-json', async (req, res) => {
    const { incident_id } = req.params;
    const pool = require('../config/database');
    try {
        const incident = await pool.query(`SELECT * FROM incidents WHERE id = $1`, [parseInt(incident_id)]);
        if (incident.rows.length === 0) return res.status(404).json({ error: 'Incident not found' });
        
        const instruction = await pool.query(`SELECT * FROM incident_instructions WHERE incident_id = $1`, [parseInt(incident_id)]);
        const actions = await pool.query(`SELECT * FROM incident_actions WHERE incident_id = $1`, [parseInt(incident_id)]);
        
        res.json({
            incident: incident.rows[0],
            instruction: instruction.rows[0],
            actions: actions.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Audit Logs (Protected route)
router.get('/audit-logs', authMiddleware, analyticsController.getAuditLogs);

console.log('[ROUTES] Analytics routes loaded successfully');

module.exports = router;
module.exports.router = router;