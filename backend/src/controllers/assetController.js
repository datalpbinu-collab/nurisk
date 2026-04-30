const pool = require('../config/database');
const { generateQRCode } = require('../utils/generateCode');

// --- ASSET INVENTORY ---
exports.createAsset = async (req, res) => {
    const { name, category, quantity, unit, location, warehouse_id } = req.body;
    try {
        const qr_code = `PUSDATIN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        
        const result = await pool.query(
            `INSERT INTO asset_inventories (name, category, quantity, unit, location, warehouse_id, qr_code)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [name, category, quantity, unit, location, warehouse_id, qr_code]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getAssets = async (req, res) => {
    const { category, location, status, warehouse_id } = req.query;
    try {
        let query = `SELECT * FROM asset_inventories WHERE 1=1`;
        const params = [];
        
        if (category) { params.push(category); query += ` AND category = $${params.length}`; }
        if (location) { params.push(location); query += ` AND location = $${params.length}`; }
        if (status) { params.push(status); query += ` AND status = $${params.length}`; }
        if (warehouse_id) { params.push(warehouse_id); query += ` AND warehouse_id = $${params.length}`; }
        
        query += ` ORDER BY name ASC`;
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getAssetByQR = async (req, res) => {
    const { qr_code } = req.params;
    try {
        const result = await pool.query(
            `SELECT * FROM asset_inventories WHERE qr_code = $1`,
            [qr_code]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateAsset = async (req, res) => {
    const { id } = req.params;
    const { name, category, quantity, unit, location, status } = req.body;
    try {
        const result = await pool.query(
            `UPDATE asset_inventories SET 
                name = COALESCE($1, name),
                category = COALESCE($2, category),
                quantity = COALESCE($3, quantity),
                unit = COALESCE($4, unit),
                location = COALESCE($5, location),
                status = COALESCE($6, status)
             WHERE id = $7 RETURNING *`,
            [name, category, quantity, unit, location, status, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- TRANSACTIONS (Request, Dispatch, Return) ---
exports.createTransaction = async (req, res) => {
    const { asset_id, incident_id, volunteer_id, quantity, type } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO asset_transactions (asset_id, incident_id, volunteer_id, quantity, type, status)
             VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
            [asset_id, incident_id, volunteer_id, quantity, type]
        );
        
        // Auto-approve for now
        await pool.query(
            `UPDATE asset_inventories SET quantity = quantity - $1 WHERE id = $2`,
            [quantity, asset_id]
        );
        
        await pool.query(
            `UPDATE asset_transactions SET status = 'approved' WHERE id = $3`,
            [quantity, asset_id, result.rows[0].id]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getTransactions = async (req, res) => {
    const { asset_id, incident_id, volunteer_id, status, type } = req.query;
    try {
        let query = `
            SELECT t.*, a.name as asset_name, i.title as incident_title, v.full_name as volunteer_name
            FROM asset_transactions t
            LEFT JOIN asset_inventories a ON t.asset_id = a.id
            LEFT JOIN incidents i ON t.incident_id = i.id
            LEFT JOIN volunteers v ON t.volunteer_id = v.id
            WHERE 1=1
        `;
        const params = [];
        
        if (asset_id) { params.push(asset_id); query += ` AND t.asset_id = $${params.length}`; }
        if (incident_id) { params.push(incident_id); query += ` AND t.incident_id = $${params.length}`; }
        if (volunteer_id) { params.push(volunteer_id); query += ` AND t.volunteer_id = $${params.length}`; }
        if (status) { params.push(status); query += ` AND t.status = $${params.length}`; }
        if (type) { params.push(type); query += ` AND t.type = $${params.length}`; }
        
        query += ` ORDER BY t.created_at DESC`;
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.approveTransaction = async (req, res) => {
    const { id } = req.params;
    const { action } = req.body; // 'approve' or 'reject'
    try {
        const trans = await pool.query(`SELECT * FROM asset_transactions WHERE id = $1`, [id]);
        if (trans.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
        
        const t = trans.rows[0];
        
        if (action === 'approve') {
            if (t.type === 'dispatch') {
                await pool.query(`UPDATE asset_inventories SET quantity = quantity - $1 WHERE id = $2`, [t.quantity, t.asset_id]);
            } else if (t.type === 'return') {
                await pool.query(`UPDATE asset_inventories SET quantity = quantity + $1 WHERE id = $2`, [t.quantity, t.asset_id]);
            }
            await pool.query(`UPDATE asset_transactions SET status = 'approved' WHERE id = $1`, [id]);
        } else {
            await pool.query(`UPDATE asset_transactions SET status = 'rejected' WHERE id = $1`, [id]);
        }
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- WAREHOUSE SUMMARY ---
exports.getWarehouseSummary = async (req, res) => {
    const { location } = req.query;
    try {
        let whereClause = location ? `WHERE location = $1` : ``;
        const params = location ? [location] : [];
        
        const total = await pool.query(
            `SELECT SUM(quantity) as total_items, COUNT(*) as total_types FROM asset_inventories ${whereClause}`,
            params
        );
        
        const byCategory = await pool.query(
            `SELECT category, SUM(quantity) as total FROM asset_inventories ${whereClause} GROUP BY category`,
            params
        );
        
        const lowStock = await pool.query(
            `SELECT * FROM asset_inventories ${whereClause ? whereClause + ' AND' : 'WHERE'} quantity < 10`,
            params
        );
        
        res.json({
            total: total.rows[0],
            byCategory: byCategory.rows,
            lowStock: lowStock.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};