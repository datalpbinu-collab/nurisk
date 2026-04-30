const express = require('express');
const router = express.Router();
const instructionController = require('../controllers/instructionController');
const authMiddleware = require('../controllers/authMiddleware');

// All instruction routes require authentication
router.post('/', authMiddleware, instructionController.createInstruction);
router.get('/:incident_id', authMiddleware, instructionController.getInstructionByIncidentId);
router.put('/:incident_id', authMiddleware, instructionController.updateInstruction);
router.delete('/:incident_id', authMiddleware, instructionController.deleteInstruction);

module.exports = router;
