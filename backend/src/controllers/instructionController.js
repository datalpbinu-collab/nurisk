const pool = require('../config/database');

exports.createInstruction = async (req, res) => {
    const { incident_id, pj_nama, pic_lapangan, tim_anggota, armada_detail, peralatan_detail, duration } = req.body;
    const nomor_sp = `SP/NU-JTG/${new Date().getFullYear()}/${incident_id}`;

    try {
        const result = await pool.query(
            `INSERT INTO incident_instructions (incident_id, nomor_sp, pj_nama, pic_lapangan, tim_anggota, armada_detail, peralatan_detail, duration)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             ON CONFLICT (incident_id) DO UPDATE SET 
                pj_nama=$3, pic_lapangan=$4, tim_anggota=$5, armada_detail=$6, peralatan_detail=$7, duration=$8, updated_at=NOW()
             RETURNING *`,
            [incident_id, nomor_sp, pj_nama, pic_lapangan, tim_anggota, armada_detail, peralatan_detail, duration]
        );

        // Update status bencana menjadi 'commanded'
        await pool.query("UPDATE incidents SET status = 'COMMANDED', updated_at = NOW() WHERE id = $1", [incident_id]);

        res.json(result.rows[0]);
    } catch (err) {
        console.error("🔥 INSTRUCTION_ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.getInstructionByIncidentId = async (req, res) => {
    const { incident_id } = req.params;
    try {
        const result = await pool.query("SELECT * FROM incident_instructions WHERE incident_id = $1", [parseInt(incident_id)]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Instruction not found" });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateInstruction = async (req, res) => {
    const { incident_id } = req.params;
    const { pj_nama, pic_lapangan, tim_anggota, armada_detail, peralatan_detail, duration } = req.body;
    try {
        const result = await pool.query(
            `UPDATE incident_instructions SET 
                pj_nama=$1, pic_lapangan=$2, tim_anggota=$3, armada_detail=$4, peralatan_detail=$5, duration=$6, updated_at=NOW()
             WHERE incident_id=$7 RETURNING *`,
            [pj_nama, pic_lapangan, tim_anggota, armada_detail, peralatan_detail, duration, parseInt(incident_id)]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteInstruction = async (req, res) => {
    const { incident_id } = req.params;
    try {
        await pool.query("DELETE FROM incident_instructions WHERE incident_id = $1", [parseInt(incident_id)]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};