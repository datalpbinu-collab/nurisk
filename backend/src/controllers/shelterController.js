const pool = require('../config/database');

// --- CREATE SHELTER ---
exports.createShelter = async (req, res) => {
    const { name, incident_id, region, latitude, longitude, address, capacity, status } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO shelters (name, incident_id, region, latitude, longitude, address, capacity, status, score, refugee_count, stock_status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 100, 0, 'AMAN') RETURNING *`,
            [name, incident_id, region, latitude, longitude, address, capacity, status || 'active']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Create shelter error:", err);
        res.status(500).json({ error: err.message });
    }
};

// --- GET ALL SHELTERS ---
exports.getShelters = async (req, res) => {
    const { region, status, incident_id } = req.query;
    try {
        let query = `SELECT * FROM shelters WHERE 1=1`;
        const params = [];
        
        if (region) {
            params.push(region);
            query += ` AND region = $${params.length}`;
        }
        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }
        if (incident_id) {
            params.push(incident_id);
            query += ` AND incident_id = $${params.length}`;
        }
        
        query += ` ORDER BY created_at DESC`;
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- GET SHELTER BY ID ---
exports.getShelterById = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`SELECT * FROM shelters WHERE id = $1`, [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Shelter not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- UPDATE SHELTER ---
exports.updateShelter = async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    try {
        const result = await pool.query(
            `UPDATE shelters SET 
                name = COALESCE($1, name),
                latitude = COALESCE($2, latitude),
                longitude = COALESCE($3, longitude),
                address = COALESCE($4, address),
                capacity = COALESCE($5, capacity),
                status = COALESCE($6, status),
                score = COALESCE($7, score),
                refugee_count = COALESCE($8, refugee_count),
                stock_status = COALESCE($9, stock_status),
                updated_at = NOW()
             WHERE id = $10 RETURNING *`,
            [data.name, data.latitude, data.longitude, data.address, data.capacity, data.status, data.score, data.refugee_count, data.stock_status, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- SUBMIT FORM (A, B, C, D) ---
exports.submitForm = async (req, res) => {
    const { shelter_id } = req.params;
    const { type, data } = req.body;
    
    try {
        if (type === 'a') {
            // Refugee registration - update count
            await pool.query(
                `UPDATE shelters SET refugee_count = refugee_count + 1 WHERE id = $1`,
                [shelter_id]
            );
        }
        
        if (type === 'c') {
            // Health data - update score
            const { jamban, air_bersih, morbiditas } = data;
            let newScore = 100;
            
            // SPM calculation
            if (jamban > 0 && data.refugee_count > 0) {
                const ratio = jamban / data.refugee_count;
                if (ratio < 0.05) newScore = 40;
                else if (ratio < 0.1) newScore = 60;
                else if (ratio < 0.2) newScore = 80;
            }
            
            await pool.query(
                `UPDATE shelters SET score = $1, updated_at = NOW() WHERE id = $2`,
                [newScore, shelter_id]
            );
        }
        
        // Form D (HR) - just log, no update needed
        
        res.json({ success: true, message: `Form ${type} submitted` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- DELETE SHELTER ---
exports.deleteShelter = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(`DELETE FROM shelters WHERE id = $1`, [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};