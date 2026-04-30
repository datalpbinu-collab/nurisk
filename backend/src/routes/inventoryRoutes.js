const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventorycontroller');

// Route untuk membuat item inventaris baru
router.post('/', inventoryController.createInventoryItem);
// Route untuk mendapatkan semua item inventaris
router.get('/', inventoryController.getAllInventoryItems);
// Route untuk mendapatkan satu item
router.get('/:id', inventoryController.getInventoryItemById);
// Route untuk update item
router.put('/:id', inventoryController.updateInventoryItem);

module.exports = router;