const express = require('express');
const router = express.Router();
const buildingController = require('../controllers/buildingController');

router.post('/', buildingController.createBuilding);
router.get('/', buildingController.getBuildings);
router.get('/stats', buildingController.getBuildingStats);
router.get('/:id', buildingController.getBuildingById);
router.put('/:id', buildingController.updateBuilding);
router.patch('/:id', buildingController.updateBuilding);
router.delete('/:id', buildingController.deleteBuilding);

module.exports = router;