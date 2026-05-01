const express = require('express');
const router = express.Router();
const historicalDataController = require('../controllers/historicalDataController');
const authMiddleware = require('../controllers/authMiddleware');

// Public read endpoints (no auth required)
router.get('/map', historicalDataController.getHistoricalMapData);
router.get('/trends', historicalDataController.getDisasterTrends);
router.get('/data', historicalDataController.getAllHistoricalData);

// Protected endpoints (auth required)
router.get('/forecast', historicalDataController.getPredictiveForecast);
router.post('/upload', authMiddleware, historicalDataController.uploadHistoricalData);
router.delete('/:id', authMiddleware, historicalDataController.deleteHistoricalData);

module.exports = router;
