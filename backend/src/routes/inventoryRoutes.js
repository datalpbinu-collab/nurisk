const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventorycontroller');

const authMiddleware = require('../controllers/authMiddleware');

// Route untuk membuat item inventaris baru
router.post('/', authMiddleware, inventoryController.createInventoryItem);
// Route untuk mendapatkan semua item inventaris
router.get('/', inventoryController.getAllInventoryItems);
// Route untuk mendapatkan satu item
router.get('/:id', inventoryController.getInventoryItemById);
// Route untuk update item
router.put('/:id', authMiddleware, inventoryController.updateInventoryItem);

module.exports = router;