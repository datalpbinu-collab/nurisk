const pool = require('../config/database');

/**
 * Helper function to verify user roles.
 */
const verifyRole = (req, allowedRoles) => {
    const userRole = req.user?.role?.toUpperCase().replace(/\s/g, '_');
    if (!userRole || !allowedRoles.includes(userRole)) throw new Error(`Forbidden: Role ${req.user.role} is not allowed.`);
};

// --- CREATE BUILDING ASSESSMENT ---
exports.createBuilding = async (req, res) => {
    const data = req.body;
    console.log("[BUILDING] Create request:", JSON.stringify(data).substring(0, 200));
    
    verifyRole(req, ['ADMIN_PWNU', 'SUPER_ADMIN', 'COMMANDER', 'FIELD_STAFF', 'TENAGA_AHLI']);

    try {
        // Ensure JSON fields are stringified, even if empty
        const ancaman = JSON.stringify(data.ancaman || {});
        const fasilitas = JSON.stringify(data.fasilitas || []);
        const peralatan = JSON.stringify(data.peralatan || []);

        const result = await pool.query(
            `INSERT INTO building_assessments (
                nama_gedung, fungsi, fungsi_lain, alamat, latitude, longitude, imb, slf,
                odnk, ibu_hamil, sakit_kronis, lansia, balita, anak_anak, dewasa_sehat,
                pernah_terjadi, ancaman, riwayat_desa, struktur, non_struktural,
                fasilitas, peralatan, dana_darurat, anggaran, asuransi,
                kerjasama, peduli, konflik, section, total_score, completed
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31) RETURNING *`,
            [
                data.nama_gedung || 'Tanpa Nama',
                data.fungsi || 'kantor',
                data.fungsi_lain || '',
                data.alamat || '',
                data.latitude ? parseFloat(data.latitude) : null,
                data.longitude ? parseFloat(data.longitude) : null,
                data.imb || 'tidak',
                data.slf || 'tidak',
                data.odnk || 0, data.ibu_hamil || 0, data.sakit_kronis || 0, data.lansia || 0, data.balita || 0, data.anak_anak || 0, data.dewasa_sehat || 0,
                data.pernah_terjadi || false,
                ancaman, data.riwayat_desa || '',
                data.struktur || 'tidak_tahu', data.non_struktural || 'tidak',
                fasilitas, peralatan,
                data.dana_darurat || 'tidak', data.anggaran || 'tidak', data.asuransi || 'tidak',
                data.kerjasama || '', data.peduli || 'cukup', data.konflik || false,
                 data.section || 1,
                 Math.round(data.total_score) || 0, // Round to integer for INTEGER column
                 data.completed || false
             ]
         );
         console.log("[BUILDING] Created ID:", result.rows[0]?.id);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("[BUILDING] Create error:", err.message, err.stack);
        res.status(500).json({ error: err.message });
    }
};

// --- UPDATE BUILDING ASSESSMENT ---
exports.updateBuilding = async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    verifyRole(req, ['ADMIN_PWNU', 'SUPER_ADMIN', 'COMMANDER', 'FIELD_STAFF', 'TENAGA_AHLI']);
    try {
        // Ensure numeric fields are properly handled
        const getNumericValue = (val, defaultVal = 0) => {
            if (val === '' || val === null || val === undefined) return defaultVal;
            const parsed = parseInt(val);
            return isNaN(parsed) ? defaultVal : parsed;
        };

        const result = await pool.query(
            `UPDATE building_assessments SET 
                nama_gedung = COALESCE($1, nama_gedung),
                fungsi = COALESCE($2, fungsi),
                fungsi_lain = COALESCE($3, fungsi_lain),
                alamat = COALESCE($4, alamat),
                latitude = COALESCE($5, latitude),
                longitude = COALESCE($6, longitude),
                imb = COALESCE($7, imb),
                slf = COALESCE($8, slf),
                odnk = COALESCE($9, odnk),
                ibu_hamil = COALESCE($10, ibu_hamil),
                sakit_kronis = COALESCE($11, sakit_kronis),
                lansia = COALESCE($12, lansia),
                balita = COALESCE($13, balita),
                anak_anak = COALESCE($14, anak_anak),
                dewasa_sehat = COALESCE($15, dewasa_sehat),
                pernah_terjadi = COALESCE($16, pernah_terjadi),
                ancaman = COALESCE($17, ancaman),
                riwayat_desa = COALESCE($18, riwayat_desa),
                struktur = COALESCE($19, struktur),
                non_struktural = COALESCE($20, non_struktural),
                fasilitas = COALESCE($21, fasilitas),
                peralatan = COALESCE($22, peralatan),
                dana_darurat = COALESCE($23, dana_darurat),
                anggaran = COALESCE($24, anggaran),
                asuransi = COALESCE($25, asuransi),
                kerjasama = COALESCE($26, kerjasama),
                peduli = COALESCE($27, peduli),
                konflik = COALESCE($28, konflik),
                section = COALESCE($29, section),
                total_score = COALESCE($30, total_score),
                completed = COALESCE($31, completed),
                updated_at = NOW()
            WHERE id = $32 RETURNING *`,
            [
                data.nama_gedung, data.fungsi, data.fungsi_lain, data.alamat, 
                data.latitude ? parseFloat(data.latitude) : null, 
                data.longitude ? parseFloat(data.longitude) : null,
                data.imb, data.slf,
                getNumericValue(data.odnk), 
                getNumericValue(data.ibu_hamil), 
                getNumericValue(data.sakit_kronis), 
                getNumericValue(data.lansia), 
                getNumericValue(data.balita), 
                getNumericValue(data.anak_anak), 
                getNumericValue(data.dewasa_sehat),
                data.pernah_terjadi, 
                JSON.stringify(data.ancaman || {}), 
                data.riwayat_desa,
                data.struktur, data.non_struktural,
                JSON.stringify(data.fasilitas || []), 
                JSON.stringify(data.peralatan || []),
                data.dana_darurat, data.anggaran, data.asuransi,
                data.kerjasama, data.peduli, data.konflik, 
                data.section, 
                getNumericValue(data.total_score, 0), // Default to 0 if empty
                data.completed,
                id
            ]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Building not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Update building error:", err);
        res.status(500).json({ error: err.message });
    }
};

// --- GET ALL BUILDINGS ---
exports.getBuildings = async (req, res) => {
    const { region, fungsi, completed } = req.query;
    const userRole = req.user?.role?.toUpperCase().replace(/\s/g, '_');
    const userRegion = req.user?.region?.toLowerCase();

    try {
        let query = `SELECT * FROM building_assessments WHERE 1=1`;
        const params = [];
        
        // RBAC: PCNU/Field Staff only see their region's buildings
        if (['PCNU', 'ADMIN_PCNU', 'STAFF_PCNU', 'FIELD_STAFF', 'TENAGA_AHLI'].includes(userRole)) {
            params.push(userRegion);
            query += ` AND LOWER(region) = $${params.length}`;
        } else if (region) { params.push(region); query += ` AND region = $${params.length}`; } // Allow PWNU/SuperAdmin to filter by region
        if (fungsi) { params.push(fungsi); query += ` AND fungsi = $${params.length}`; } // Allow filtering by function for all
        if (completed !== undefined) { params.push(completed === 'true'); query += ` AND completed = $${params.length}`; }
        
        query += ` ORDER BY total_score DESC, created_at DESC`;
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- GET BUILDING BY ID ---
exports.getBuildingById = async (req, res) => {
    const { id } = req.params;
    verifyRole(req, ['ADMIN_PWNU', 'SUPER_ADMIN', 'COMMANDER', 'PCNU', 'ADMIN_PCNU', 'FIELD_STAFF', 'TENAGA_AHLI']);
    try {
        const result = await pool.query(`SELECT * FROM building_assessments WHERE id = $1`, [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Building not found' });
        
        // Parse JSON fields
        const building = result.rows[0];
        try { building.ancaman = JSON.parse(building.ancaman); } catch(e) {}
        try { building.fasilitas = JSON.parse(building.fasilitas); } catch(e) {}
        try { building.peralatan = JSON.parse(building.peralatan); } catch(e) {}
        
        res.json(building);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- DELETE BUILDING ---
exports.deleteBuilding = async (req, res) => {
    const { id } = req.params;
    verifyRole(req, ['ADMIN_PWNU', 'SUPER_ADMIN', 'COMMANDER']); // Only high-level admins can delete
    try {
        // Audit before delete
        await pool.query(
            `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id) 
             VALUES ($1, $2, $3, $4)`,
            [req.user.id, 'DELETE_BUILDING', 'building_assessments', id]
        );

        await pool.query(`DELETE FROM building_assessments WHERE id = $1`, [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- GET STATISTICS ---
exports.getBuildingStats = async (req, res) => {
    try {
        const total = await pool.query(`SELECT COUNT(*) as count FROM building_assessments`);
        const completed = await pool.query(`SELECT COUNT(*) as count FROM building_assessments WHERE completed = true`);
        const avgScore = await pool.query(`SELECT AVG(total_score) as avg FROM building_assessments WHERE completed = true`);
        const byFungsi = await pool.query(`SELECT fungsi, COUNT(*) as count FROM building_assessments GROUP BY fungsi`);
        
        res.json({
            total: total.rows[0]?.count || 0,
            completed: completed.rows[0]?.count || 0,
            avgScore: avgScore.rows[0]?.avg || 0,
            byFungsi: byFungsi.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};