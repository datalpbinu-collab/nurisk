const express = require('express');
const router = express.Router();
const logisticsController = require('../controllers/logisticsController'); // Perhatikan underscore jika Anda menggunakan nama itu

router.get('/', logisticsController.getRequests);
router.get('/:id', logisticsController.getRequestById);
router.post('/', logisticsController.createRequest);
router.patch('/:id/status', logisticsController.updateStatus);
router.patch('/:id/approve', logisticsController.approveRequest);

module.exports = router;