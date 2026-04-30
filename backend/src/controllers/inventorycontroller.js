const pool = require('../config/database');

exports.createInventoryItem = async (req, res) => {
    const { name, type, quantity, available_quantity, latitude, longitude, description, unit } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO asset_inventories (name, category, quantity, unit, latitude, longitude, description, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'available') RETURNING *`,
            [name, type || 'logistik', quantity || 1, unit || 'unit', latitude, longitude, description]
        );
        res.status(201).json({ success: true, item: result.rows[0] });
    } catch (err) {
        console.error("Error creating inventory item:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.getAllInventoryItems = async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM asset_inventories ORDER BY created_at DESC");
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching inventory items:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.getInventoryItemById = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query("SELECT * FROM asset_inventories WHERE id = $1", [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
        res.status(200).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateInventoryItem = async (req, res) => {
    const { id } = req.params;
    const { name, type, quantity, available_quantity, latitude, longitude, description, unit, status } = req.body;
    try {
        const result = await pool.query(
            `UPDATE asset_inventories SET 
                name = COALESCE($1, name),
                type = COALESCE($2, type),
                quantity = COALESCE($3, quantity),
                available_quantity = COALESCE($4, available_quantity),
                unit = COALESCE($5, unit),
                status = COALESCE($6, status),
                latitude = COALESCE($7, latitude),
                longitude = COALESCE($8, longitude),
                description = COALESCE($9, description),
                updated_at = NOW()
             WHERE id = $10 RETURNING *`,
            [name, type, quantity, available_quantity, unit, status, latitude, longitude, description, id]
        );
        res.status(200).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};