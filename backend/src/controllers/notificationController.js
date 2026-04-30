const pool = require('../config/database');

/**
 * Helper function to verify user roles.
 */
const verifyRole = (req, allowedRoles) => {
    const userRole = req.user?.role?.toUpperCase().replace(/\s/g, '_');
    if (!userRole || !allowedRoles.includes(userRole)) throw new Error(`Forbidden: Role ${req.user.role} is not allowed.`);
};

// --- CREATE NOTIFICATION ---
exports.createNotification = async (req, res) => {
    const { title, body, target_role, target_region, incident_id, type } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO notifications (title, body, target_role, target_region, incident_id, type)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [title, body, target_role, target_region, incident_id, type || 'broadcast']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- SEND NOTIFICATION (Push via Socket) ---
exports.sendNotification = async (req, res) => {
    const { notification_id } = req.params;
    try {
        const notif = await pool.query(`SELECT * FROM notifications WHERE id = $1`, [notification_id]);
        if (notif.rows.length === 0) return res.status(404).json({ error: 'Notification not found' });
        
        const n = notif.rows[0];
        const io = req.app.get('socketio');
        
        if (n.target_role || n.target_region) {
            const users = await pool.query(
                `SELECT id FROM users WHERE 1=1 ${n.target_role ? 'AND role = $1' : ''} ${n.target_region ? 'AND region = $2' : ''}`,
                [n.target_role, n.target_region].filter(Boolean)
            );
            
            users.rows.forEach(u => {
                io.to(`user_${u.id}`).emit('notification', n);
            });
        } else {
            io.emit('notification', n);
        }
        
        await pool.query(
            `UPDATE notifications SET status = 'sent', sent_at = NOW() WHERE id = $1`,
            [notification_id]
        );
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- GET NOTIFICATIONS ---
exports.getNotifications = async (req, res) => {
    const { user_id, role, region, status } = req.query;
    try {
        let query = `SELECT * FROM notifications WHERE 1=1`;
        const params = [];
        
        // Show relevant notifications based on role/region (must match App.jsx roles)
        if (role && role !== 'SUPER_ADMIN') {
            params.push(role);
            query += ` AND (target_role = $${params.length} OR target_role IS NULL OR target_role = 'PWNU')`;
        }
        
        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }
        
        query += ` ORDER BY created_at DESC LIMIT 50`;
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- MARK AS READ ---
exports.markAsRead = async (req, res) => {
    const { notification_id, user_id } = req.body;
    try {
        const io = req.app.get('socketio');
        if (io) {
            io.to(`user_${user_id}`).emit('notification_read', { notification_id });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- DELETE NOTIFICATION ---
exports.deleteNotification = async (req, res) => {
    const { notification_id } = req.params;
    try {
        await pool.query(`DELETE FROM notifications WHERE id = $1`, [notification_id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- SEND EMERGENCY ALERT ---
exports.sendEmergencyAlert = async (req, res) => {
    const { title, body, incident_id, severity, target_region } = req.body;
    verifyRole(req, ['ADMIN_PWNU', 'SUPER_ADMIN', 'COMMANDER']);
    try {
        const io = req.app.get('socketio');
        
        const alert = {
            title: title || 'EMERGENCY ALERT',
            body,
            incident_id,
            severity,
            type: 'emergency',
            created_at: new Date()
        };
        
        if (target_region) {
            const users = await pool.query(
                `SELECT id FROM users WHERE region = $1 AND role IN ('ADMIN_PCNU', 'ADMIN_PWNU', 'PWNU')`,
                [target_region]
            );
            users.rows.forEach(u => {
                io.to(`user_${u.id}`).emit('emergency_alert', alert);
            });
        } else {
            io.emit('emergency_alert', alert);
        }
        
        await pool.query(
            `INSERT INTO notifications (title, body, target_region, incident_id, type, status)
             VALUES ($1, $2, $3, $4, 'emergency', 'sent')`,
            [alert.title, body, target_region, incident_id]
        );
        
        res.json({ success: true, alert });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- REGISTER DEVICE TOKEN (FCM) ---
exports.registerToken = async (req, res) => {
    const { volunteer_id, token, platform } = req.body;
    try {
        // Store token in volunteer record or separate table
        await pool.query(
            `INSERT INTO volunteer_devices (volunteer_id, token, platform, created_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (token) DO UPDATE SET last_active = NOW()`,
            [volunteer_id, token, platform]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- RESPOND TO NOTIFICATION ---
exports.respondNotification = async (req, res) => {
    const { notification_id, volunteer_id, action } = req.body;
    try {
        // Log response
        console.log(`[NOTIF] Volunteer ${volunteer_id} responded to ${notification_id}: ${action}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};