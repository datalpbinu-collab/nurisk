const pool = require('../config/database');

// --- CONVERSATIONS ---
exports.createConversation = async (req, res) => {
    const { incident_id, type, participant_ids } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO chat_conversations (incident_id, type) VALUES ($1, $2) RETURNING *`,
            [incident_id, type || 'incident']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getConversations = async (req, res) => {
    const { user_id, role, region } = req.query;
    try {
        let query = `
            SELECT c.*, i.title as incident_title,
            (SELECT message FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
            (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id AND NOT ($1 = ANY(read_by)) ) as unread_count
            FROM chat_conversations c
            LEFT JOIN incidents i ON c.incident_id = i.id
            WHERE 1=1
        `;
        const params = [parseInt(user_id) || 0];
        
        // RBAC: Filter conversations based on role (must match App.jsx)
        if (role === 'RELAWAN' || role === 'FIELD_STAFF') {
            // Volunteers and Field Staff only see their own conversations
            query += ` AND c.id IN (SELECT conversation_id FROM chat_messages WHERE sender_id = $1)`;
        } else if (region && !['PWNU', 'SUPER_ADMIN', 'ADMIN_PWNU', 'COMMANDER'].includes(role)) {
            // PCNU level - only see region-specific conversations
            query += ` AND i.region = $${params.length + 1}`;
            params.push(region);
        }
        // PWNU/SUPER_ADMIN can see all conversations
        
        query += ` ORDER BY c.created_at DESC`;
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getConversationByIncident = async (req, res) => {
    const { incident_id } = req.params;
    try {
        const result = await pool.query(
            `SELECT * FROM chat_conversations WHERE incident_id = $1`,
            [incident_id]
        );
        if (result.rows.length === 0) {
            const newConv = await pool.query(
                `INSERT INTO chat_conversations (incident_id, type) VALUES ($1, 'incident') RETURNING *`,
                [incident_id]
            );
            return res.json(newConv.rows[0]);
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- MESSAGES ---
exports.sendMessage = async (req, res) => {
    const { conversation_id, sender_id, message } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO chat_messages (conversation_id, sender_id, message, read_by)
             VALUES ($1, $2, $3, ARRAY[$2]) RETURNING *`,
            [conversation_id, sender_id, message]
        );
        
        const io = req.app.get('socketio');
        if (io) {
            io.to(`conversation_${conversation_id}`).emit('new_message', result.rows[0]);
        }
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getMessages = async (req, res) => {
    const { conversation_id, limit = 50, offset = 0 } = req.query;
    try {
        const result = await pool.query(
            `SELECT m.*, u.full_name as sender_name
             FROM chat_messages m
             JOIN users u ON m.sender_id = u.id
             WHERE m.conversation_id = $1
             ORDER BY m.created_at DESC
             LIMIT $2 OFFSET $3`,
            [conversation_id, limit, offset]
        );
        res.json(result.rows.reverse());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.markAsRead = async (req, res) => {
    const { message_id, user_id } = req.body;
    try {
        await pool.query(
            `UPDATE chat_messages SET read_by = array_append(read_by, $1) WHERE id = $2`,
            [user_id, message_id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- BROADCAST ---
exports.broadcastMessage = async (req, res) => {
    const { sender_id, sender_role, message, target_role, target_region } = req.body;
    
    // RBAC: Only PWNU/SUPER_ADMIN can broadcast
    if (!['PWNU', 'SUPER_ADMIN', 'ADMIN_PWNU', 'COMMANDER'].includes(sender_role)) {
        return res.status(403).json({ error: 'Hanya PWNU yang dapat broadcast pesan' });
    }
    
    try {
        let query = `INSERT INTO chat_messages (conversation_id, sender_id, message) VALUES`;
        const params = [];
        
        if (target_role || target_region) {
            const users = await pool.query(
                `SELECT id FROM users WHERE 1=1 ${target_role ? 'AND role = $1' : ''} ${target_region ? 'AND region = $2' : ''}`,
                [target_role, target_region].filter(Boolean)
            );
            
            const io = req.app.get('socketio');
            if (io) {
                users.rows.forEach(u => {
                    io.to(`user_${u.id}`).emit('broadcast', { message, sender_id });
                });
            }
        } else {
            const io = req.app.get('socketio');
            if (io) io.emit('broadcast', { message, sender_id });
        }
        
        res.json({ success: true, message: 'Broadcast sent' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};