const pool = require('../config/database');

/**
 * Helper function to verify user roles.
 */
const verifyRole = (req, allowedRoles) => {
    const userRole = req.user?.role?.toUpperCase().replace(/\s/g, '_');
    if (!userRole || !allowedRoles.includes(userRole)) throw new Error(`Forbidden: Role ${req.user.role} is not allowed.`);
};

// 1. PCNU Mengajukan Permintaan
exports.createRequest = async (req, res) => {
    const { incident_id, inventory_id, item_name, quantity, region } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO logistics_requests (incident_id, inventory_id, item_name, quantity_requested, requester_region, status) 
             VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
            [incident_id, inventory_id, item_name, quantity, region]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// 2. Mengambil Semua Permintaan (Filter by Role)
exports.getRequests = async (req, res) => {
    const { role, region } = req.query;
    try {
        let query = "SELECT r.*, i.title as incident_title FROM logistics_requests r JOIN incidents i ON r.incident_id = i.id";
        let params = [];

        if (role === 'PCNU') {
            query += " WHERE r.requester_region = $1";
            params.push(region);
        }

        const result = await pool.query(query + " ORDER BY r.created_at DESC", params);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// 3. PWNU Memberikan Persetujuan (Approval)
exports.approveRequest = async (req, res) => {
    const { id } = req.params;
    verifyRole(req, ['ADMIN_PWNU', 'SUPER_ADMIN', 'COMMANDER']);
    const { status, admin_note } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const updatedReq = await client.query(
            "UPDATE logistics_requests SET status = $1, admin_note = $2, updated_at = NOW() WHERE id = $3 RETURNING *",
            [status, admin_note, id]
        );

        // Log detailed audit
        await client.query(
            `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, payload) 
             VALUES ($1, $2, $3, $4, $5)`,
            [req.user.id, 'APPROVE_LOGISTICS', 'logistics_requests', id, JSON.stringify({ status, note: admin_note })]
        );

        if (status === 'approved') {
            const request = updatedReq.rows[0];
            await client.query(
                "UPDATE inventory SET available_quantity = available_quantity - $1 WHERE id = $2",
                [request.quantity_requested, request.inventory_id]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
};

exports.getRequestById = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            "SELECT r.*, i.title as incident_title FROM logistics_requests r JOIN incidents i ON r.incident_id = i.id WHERE r.id = $1",
            [id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Request not found' });
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateStatus = async (req, res) => {
    const { id } = req.params;
    const { status, admin_note } = req.body;
    try {
        const result = await pool.query(
            "UPDATE logistics_requests SET status = $1, admin_note = $2, updated_at = NOW() WHERE id = $3 RETURNING *",
            [status, admin_note, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Request not found' });
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
};