const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const chatController = require('../controllers/chatController');

// --- SIMPLE TEAM MESSAGE FOR TACTICAL (region-based) ---
router.get('/team-messages', async (req, res) => {
    const { region } = req.query;
    try {
        const result = await pool.query(
            `SELECT * FROM team_messages WHERE region = $1 ORDER BY created_at DESC LIMIT 50`,
            [region]
        );
        res.json(result.rows);
    } catch (err) {
        res.json([]);
    }
});

router.post('/team-messages', async (req, res) => {
    const { region, sender_id, sender_name, message } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO team_messages (region, sender_id, sender_name, message) VALUES ($1, $2, $3, $4) RETURNING *`,
            [region, sender_id, sender_name, message]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- LOGISTICS REQUEST FOR TACTICAL ---
router.get('/logistics-requests', async (req, res) => {
    const { region } = req.query;
    try {
        const result = await pool.query(
            `SELECT * FROM logistics_requests WHERE region = $1 ORDER BY created_at DESC LIMIT 50`,
            [region]
        );
        res.json(result.rows);
    } catch (err) {
        res.json([]);
    }
});

router.post('/logistics-requests', async (req, res) => {
    const { region, requester_id, requester_name, type, quantity, urgency, notes } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO logistics_requests (region, requester_id, requester_name, type, quantity, urgency, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [region, requester_id, requester_name, type, quantity, urgency, notes]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- EXISTING CHAT ROUTES ---
router.post('/conversations', chatController.createConversation);
router.get('/conversations', chatController.getConversations);
router.get('/conversations/incident/:incident_id', chatController.getConversationByIncident);

router.post('/messages', chatController.sendMessage);
router.get('/messages', chatController.getMessages);
router.put('/messages/read', chatController.markAsRead);

router.post('/broadcast', chatController.broadcastMessage);

module.exports = router;