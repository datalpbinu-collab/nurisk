const express = require('express')
const router = express.Router()

const mapController = require('../controllers/mapController')
const scraper = require('../utils/scraper')

router.get('/command', mapController.commandMap)

// Endpoint untuk trigger scraping CEVADIS manual
router.get('/cevadis/scrape', async (req, res) => {
    try {
        const result = await scraper.scrapeCevadis();
        res.json({ success: true, message: 'CEVADIS scrape triggered', result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Endpoint untuk trigger Portal Data Jateng
router.get('/portal-jateng/scrape', async (req, res) => {
    try {
        const result = await scraper.scrapePortalDataJateng();
        res.json({ success: true, message: 'Portal Data Jateng scrape triggered', result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Endpoint untuk cek status scraper CEVADIS
router.get('/cevadis/status', async (req, res) => {
    try {
        const pool = require('../config/database');
        const result = await pool.query(
            `SELECT COUNT(*) as count FROM incidents WHERE source_url LIKE '%cevadis%' OR source_url LIKE '%data.jatengprov%'`
        );
        res.json({ 
            success: true, 
            cevadis_count: parseInt(result.rows[0].count) || 0,
            message: 'CEVADIS data status'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router