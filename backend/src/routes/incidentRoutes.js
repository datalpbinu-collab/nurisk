const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incidentController');
const authMiddleware = require('../controllers/authMiddleware');
const multer = require('multer');
const path = require('path');

// Konfigurasi Penyimpanan Fisik
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, 'incident-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- PUBLIC ROUTES (no auth required) ---
router.get('/public', incidentController.getPublicData);
router.get('/status/:status', incidentController.getIncidentsByStatus);

// --- PROTECTED ROUTES (require auth) ---
router.get('/', authMiddleware, incidentController.getIncidents);
router.post('/', authMiddleware, upload.single('photo'), incidentController.createIncident);
router.post('/instructions', authMiddleware, incidentController.createInstruction);
router.post('/actions', authMiddleware, incidentController.createAction);

router.patch('/:id/assessment', authMiddleware, incidentController.updateAssessment);
router.get('/:id/full-report', authMiddleware, incidentController.getFullReport);
router.get('/:id', authMiddleware, incidentController.getAssessment);
router.put('/:id', authMiddleware, incidentController.updateStatus);
router.delete('/:id', authMiddleware, incidentController.deleteIncident);

module.exports = router;
