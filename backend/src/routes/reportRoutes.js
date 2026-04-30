const express = require('express')
const router = express.Router()
const path = require('path')
const fs = require('fs')

const reportController = require('../controllers/reportController')

router.get('/', reportController.getReports)
router.post('/', reportController.createReport)

// --- MEDIA UPLOAD FOR INCIDENTS ---
const multer = require('multer');
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedExts = ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.pdf', '.mp4', '.webm'];
        const ext = path.extname(file.originalname).toLowerCase();
        const mimetype = file.mimetype;
        
        if (allowedExts.includes(ext) || mimetype.startsWith('image/') || mimetype.startsWith('video/')) {
            return cb(null, true);
        }
        cb(new Error('File type not allowed'));
    }
});

router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const { incident_id, type, description } = req.body;
        
        // Save to database
        const pool = require('../config/database');
        
        const result = await pool.query(
            `INSERT INTO incident_media (incident_id, file_path, file_name, file_type, mime_type, size, description)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [
                incident_id || null,
                `/uploads/${req.file.filename}`,
                req.file.originalname,
                type || 'photo',
                req.file.mimetype,
                req.file.size,
                description || ''
            ]
        );
        
        res.status(201).json({
            success: true,
            file: result.rows[0],
            url: `/uploads/${req.file.filename}`
        });
    } catch (err) {
        console.error('[UPLOAD] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- GET MEDIA FOR INCIDENT ---
router.get('/media/:incident_id', async (req, res) => {
    const { incident_id } = req.params;
    try {
        const pool = require('../config/database');
        const result = await pool.query(
            `SELECT * FROM incident_media WHERE incident_id = $1 ORDER BY created_at DESC`,
            [parseInt(incident_id)]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router