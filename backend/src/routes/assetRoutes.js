const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');

router.post('/', assetController.createAsset);
router.get('/', assetController.getAssets);
router.get('/qr/:qr_code', assetController.getAssetByQR);
router.put('/:id', assetController.updateAsset);

router.post('/transactions', assetController.createTransaction);
router.get('/transactions', assetController.getTransactions);
router.put('/transactions/:id/approve', assetController.approveTransaction);

router.get('/warehouse/summary', assetController.getWarehouseSummary);

module.exports = router;