const pool = require('../config/database');
const { getRegencyByCoordinates } = require('../utils/geojsonUtils'); // Import PIP function

/**
 * PUSDATIN NU PEDULI - INCIDENT ENGINE (MASTER CONTROLLER)
 * -----------------------------------------------------------
 * STATUS LOGIC: REPORTED, VERIFIED, ASSESSED, COMMANDED, ACTION, COMPLETED
 */

/**
 * Helper function to verify user roles inside this controller
 */
const verifyRole = (req, allowedRoles) => {
    // If req.user is not set, try to decode from token directly
    if (!req.user) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const jwt = require('jsonwebtoken');
                const JWT_SECRET = process.env.JWT_SECRET || 'PUSDATIN_JATENG_SECRET_2024';
                const decoded = jwt.verify(token, JWT_SECRET);
                req.user = decoded;
                console.log('[VERIFY] Manually decoded token:', decoded);
            } catch (e) {
                console.error('[VERIFY] Token decode failed:', e.message);
            }
        }
    }
    
    if (!req.user) {
        console.error('[AUTH] req.user is undefined! Headers:', req.headers.authorization ? 'Token present' : 'No token');
        throw new Error('Unauthorized: Invalid or missing token');
    }
    const userRole = req.user.role?.toUpperCase().replace(/\s/g, '_');
    if (!userRole || !allowedRoles.includes(userRole)) {
        throw new Error(`Forbidden: Role ${req.user.role} is not allowed.`);
    }
};

// --- 1. ENGINE: RUMUS SKORING AI (Weighting System) ---
const calculateAIScore = (data) => {
    const { 
        dampak_manusia: d = {}, 
        dampak_rumah: h = {}, 
        dampak_fasum: f = {}, 
        dampak_vital: v = {}, 
        dampak_lingkungan: l = {} 
    } = data;

    const score = 
        (parseInt(d.meninggal) || 0) * 100 + (parseInt(d.hilang) || 0) * 80 +
        (parseInt(d.sakit) || 0) * 40 + (parseInt(d.mengungsi) || 0) * 30 + (parseInt(d.terdampak) || 0) * 10 +
        (parseInt(h.berat) || 0) * 50 + (parseInt(h.sedang) || 0) * 30 + (parseInt(h.ringan) || 0) * 10 +
        (parseInt(f.faskes) || 0) * 60 + (parseInt(f.ibadah) || 0) * 20 + (parseInt(f.sekolah) || 0) * 25 +
        (parseInt(v.air_bersih) || 0) * 70 + (parseInt(v.listrik) || 0) * 50 + (parseInt(v.telkom) || 0) * 30 +
        (parseInt(v.irigasi) || 0) * 20 + (parseInt(v.jalan) || 0) * 60 + (parseInt(v.spbu) || 0) * 25 +
        (parseInt(l.sawah) || 0) * 5 + (parseInt(l.ternak) || 0) * 2;

    let level = 'LOW';
    if (score > 1000) level = 'CRITICAL';
    else if (score > 500) level = 'HIGH';
    else if (score > 200) level = 'MEDIUM';

    return { score, level };
};

// --- 2. CORE FUNCTIONS ---

// A. Ambil Semua Kejadian (Admin View)
exports.getIncidents = async (req, res) => {
    try {
        const query = `
            SELECT i.*,
            COALESCE((SELECT json_agg(a) FROM incident_actions a WHERE a.incident_id = i.id), '[]'::json) as actions,
            COALESCE((SELECT json_agg(ins) FROM incident_instructions ins WHERE ins.incident_id = i.id), '[]'::json) as instructions
            FROM incidents i
            ORDER BY i.priority_score DESC, i.created_at DESC`;

        const result = await pool.query(query);
        res.json(result.rows || []);
    } catch (err) {
        console.error("🔥 FETCH_ERROR:", err.message);
        res.status(500).json({ error: "Gagal mengambil data insiden" });
    }
};

// B. Buat Kejadian Baru (Public Intake)
exports.createIncident = async (req, res) => {
    const { title, disaster_type, latitude, longitude, reporter_name, whatsapp_number, description, region } = req.body;

    let determinedRegion = region;
    if (latitude && longitude) {
        const foundRegion = getRegencyByCoordinates(parseFloat(latitude), parseFloat(longitude));
        if (foundRegion) {
            determinedRegion = foundRegion;
        }
    }

    // Ambil path file jika ada upload
    const photo_path = req.file ? `uploads/${req.file.filename}` : null;

    // Set event_date to current timestamp for new reports
    const event_date = new Date();

    try {
        const query = `INSERT INTO incidents (title, disaster_type, latitude, longitude, status, region, reporter_name, whatsapp_number, description, event_date, photo_data) 
                       VALUES ($1, $2, $3, $4, 'REPORTED', $5, $6, $7, $8, $9, $10) RETURNING *`;
        const result = await pool.query(query, [title, disaster_type, parseFloat(latitude) || null, parseFloat(longitude) || null, determinedRegion, reporter_name, whatsapp_number, description, event_date, photo_path]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("🔥 CREATE_ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// C. Update Status Dasar & Logging (Flexible - handles various input formats)
exports.updateStatus = async (req, res) => {
    const { id } = req.params;
    const { status, note, updated_by, priority_score, priority_level, description, has_shelter } = req.body;
    const finalStatus = status?.toUpperCase() || 'REPORTED';

    // RBAC for REJECTED and VERIFIED status
    if (finalStatus === 'REJECTED' || finalStatus === 'VERIFIED') {
        verifyRole(req, ['ADMIN_PWNU', 'SUPER_ADMIN', 'COMMANDER', 'STAFF_PWNU']);
    }

    try {
        // Fetch incident details before updating status, if it's about to be completed
        let incidentDetails;
        if (finalStatus === 'COMPLETED') {
            const incidentRes = await pool.query('SELECT title, disaster_type, latitude, longitude, region, created_at, description FROM incidents WHERE id = $1', [parseInt(id)]);
            if (incidentRes.rows.length > 0) {
                incidentDetails = incidentRes.rows[0];
            }
        }

        // Build dynamic update query
        const updates = ['status = $1', 'updated_at = NOW()'];
        const values = [finalStatus];
        let paramIndex = 2;

        if (priority_score !== undefined) {
            updates.push(`priority_score = $${paramIndex++}`);
            values.push(priority_score);
        }
        if (priority_level !== undefined) {
            updates.push(`priority_level = $${paramIndex++}`);
            values.push(priority_level);
        }
        if (description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            values.push(description);
        }
        if (has_shelter !== undefined) {
            updates.push(`has_shelter = $${paramIndex++}`);
            values.push(has_shelter);
        }
        
        values.push(parseInt(id));

        await pool.query(`UPDATE incidents SET ${updates.join(', ')} WHERE id = $${paramIndex}`, values);

        // If status is COMPLETED, add to historical_disasters
        if (finalStatus === 'COMPLETED' && incidentDetails) {
            await pool.query(
                `INSERT INTO historical_disasters (region, disaster_type, event_date, latitude, longitude, "time")
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT DO NOTHING`, // Prevent duplicate entries if status is set to COMPLETED multiple times
                [
                    incidentDetails.region,
                    incidentDetails.disaster_type,
                    incidentDetails.event_date || incidentDetails.created_at, // Use actual event_date if available
                    incidentDetails.latitude,
                    incidentDetails.longitude,
                    new Date(incidentDetails.event_date || incidentDetails.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) // Extract time
                ]
            );
            console.log(`✅ Incident #${id} (type: ${incidentDetails.disaster_type}) added to historical data.`);
        }

        // Try to log but don't fail if table doesn't exist
        try {
            await pool.query(
                `INSERT INTO incident_logs (incident_id, previous_status, new_status, note, updated_by, updated_by_id)
                 VALUES ($1, (SELECT status FROM incidents WHERE id=$1), $2, $3, $4, $5)`,
                [id, finalStatus, note || 'System update', updated_by, req.user?.id]
            );
        } catch (logErr) { console.log("Log table may not exist:", logErr.message); }

        const io = req.app.get('socketio');
        if (io) {
            io.emit('emergency_broadcast', { 
                tier: 'SILENT', 
                incident_id: id, 
                title: 'Update Status', 
                message: `Incident #${id} -> ${finalStatus}` 
            });
        }
        res.json({ success: true });
    } catch (err) {
        console.error("🔥 STATUS_UPDATE_ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// D. Ambil Data Detail Assessment
exports.getAssessment = async (req, res) => {
    const { id } = req.params;
    verifyRole(req, ['ADMIN_PWNU', 'SUPER_ADMIN', 'COMMANDER', 'PCNU', 'ADMIN_PCNU', 'FIELD_STAFF', 'TENAGA_AHLI', 'STAFF_PWNU']);
    try {
        const result = await pool.query(
            `SELECT kecamatan, desa, alamat_spesifik, kondisi_mutakhir, 
             dampak_manusia, dampak_rumah, dampak_fasum, dampak_vital, dampak_lingkungan, needs_numeric 
             FROM incidents WHERE id = $1`, [parseInt(id)]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "Data not found" });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// E. Update Assessment (AI Processing) - Handles both frontend formats
exports.updateAssessment = async (req, res) => {
    const { id } = req.params;
    verifyRole(req, ['FIELD_STAFF', 'TENAGA_AHLI', 'ADMIN_PWNU', 'SUPER_ADMIN', 'COMMANDER', 'STAFF_PWNU']);
    const data = req.body || {};
    
    try {
        console.log("[ASSESSMENT] Received data for incident", id, ":", JSON.stringify(data).substring(0, 200));
        
        const score = data.priority_score || calculateAIScore(data).score || 0;
        const level = data.priority_level || calculateAIScore(data).level || 'LOW';

        // Handle event_date
        let eventDate = null;
        if (data.event_date) {
            try {
                eventDate = new Date(data.event_date).toISOString().split('T')[0];
            } catch (e) {
                eventDate = new Date().toISOString().split('T')[0];
            }
        } else {
            eventDate = new Date().toISOString().split('T')[0];
        }

        const query = `
            UPDATE incidents SET 
                kecamatan=$1, desa=$2, alamat_spesifik=$3, kondisi_mutakhir=$4, 
                dampak_manusia=$5, dampak_rumah=$6, dampak_fasum=$7, dampak_vital=$8, dampak_lingkungan=$9,
                priority_score=$10, priority_level=$11, needs_numeric=$12, description=$13,
                status='ASSESSED', event_date=$14, updated_at=NOW() 
            WHERE id=$15 RETURNING *`;

        const values = [
            data.kecamatan || null, 
            data.desa || null, 
            data.alamat_spesifik || null, 
            data.kondisi_mutakhir || data.description || null,
            JSON.stringify(data.dampak_manusia || {}), 
            JSON.stringify(data.dampak_rumah || {}),
            JSON.stringify(data.dampak_fasum || {}), 
            JSON.stringify(data.dampak_vital || {}),
            JSON.stringify(data.dampak_lingkungan || {}),
            score, 
            level, 
            JSON.stringify(data.needs_numeric || {}),
            data.description || null,
            eventDate,
            parseInt(id)
        ];

        console.log("[ASSESSMENT] Executing query with values:", values.map((v,i) => `${i}:${typeof v}:${String(v).substring(0,20)}`).join(', '));
        
        const result = await pool.query(query, values); 
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Incident not found" });
        }

        // Notifikasi Cerdas via Socket
        const io = req.app.get('socketio');
        if (io && result.rows.length > 0) {
            const updated = result.rows[0];
            let tier = score > 1000 ? 'CRITICAL' : score > 500 ? 'WARNING' : 'SILENT';
            io.emit('emergency_broadcast', {
                tier, incident_id: id, title: updated.title, region: updated.region, score, severity: level
            });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("🔥 ASSESSMENT_500_ERROR:", err.message);
        res.status(500).json({ error: "Gagal memproses assessment AI" });
    }
};

// F. Terbitkan Surat Perintah (SP)
exports.createInstruction = async (req, res) => {
    const { incident_id, pj_nama, pic_lapangan, tim_anggota, armada_detail, peralatan_detail, duration } = req.body;
    verifyRole(req, ['ADMIN_PWNU', 'SUPER_ADMIN', 'COMMANDER']);
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

        await pool.query("UPDATE incidents SET status = 'COMMANDED', updated_at = NOW() WHERE id = $1", [incident_id]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error("🔥 INSTRUCTION_ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// G. Catat Aksi Logistik/Lapangan
exports.createAction = async (req, res) => {
    const { incident_id, kluster, nama_kegiatan, jumlah_paket, penerima_manfaat } = req.body;
    verifyRole(req, ['ADMIN_PWNU', 'SUPER_ADMIN', 'COMMANDER', 'FIELD_STAFF', 'TENAGA_AHLI']);
    try {
        await pool.query(
            `INSERT INTO incident_actions (incident_id, kluster, nama_kegiatan, jumlah_paket, penerima_manfaat) 
             VALUES ($1, $2, $3, $4, $5)`,
            [incident_id, kluster, nama_kegiatan, jumlah_paket, penerima_manfaat]
        );
        await pool.query("UPDATE incidents SET status = 'ACTION', updated_at = NOW() WHERE id = $1", [incident_id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// H. Agregasi Data PDF (SITREP)
exports.getFullReport = async (req, res) => {
    const { id } = req.params;
    verifyRole(req, ['ADMIN_PWNU', 'SUPER_ADMIN', 'COMMANDER', 'PCNU', 'ADMIN_PCNU']);
    try {
        const [incident, instruction, actions] = await Promise.all([
            pool.query("SELECT * FROM incidents WHERE id = $1", [parseInt(id)]),
            pool.query("SELECT * FROM incident_instructions WHERE incident_id = $1", [parseInt(id)]),
            pool.query("SELECT * FROM incident_actions WHERE incident_id = $1 ORDER BY created_at ASC", [parseInt(id)])
        ]);
        
        res.json({ 
            incident: incident.rows[0], 
            instruction: instruction.rows[0], 
            actions: actions.rows 
        });
    } catch (err) {
        res.status(500).json({ error: "Gagal menyusun SITREP" });
    }
};

// I. Public Intelligence Access
exports.getPublicData = async (req, res) => {
    // This is public, no RBAC
    try {
        const query = `
            SELECT id, title, disaster_type, latitude, longitude, status, region, priority_level, created_at 
            FROM incidents 
            WHERE status != 'DRAFT' 
            ORDER BY created_at DESC`;
        const result = await pool.query(query);
        res.json(result.rows || []);
    } catch (err) {
        console.error("🔥 PUBLIC_DATA_ERROR:", err.message);
        res.status(500).json([]);
    }
};

// K. Get Incidents by Status (for Field Staff missions)
exports.getIncidentsByStatus = async (req, res) => {
    const { status } = req.params;
    verifyRole(req, ['ADMIN_PWNU', 'SUPER_ADMIN', 'COMMANDER', 'PCNU', 'ADMIN_PCNU', 'FIELD_STAFF', 'TENAGA_AHLI', 'RELAWAN']);
    try {
        const query = `
            SELECT i.*, 
            (SELECT json_agg(a) FROM incident_actions a WHERE a.incident_id = i.id) as actions
            FROM incidents i 
            WHERE i.status = $1
            ORDER BY i.priority_score DESC, i.created_at DESC`;
        const result = await pool.query(query, [status]);
        res.json(result.rows || []);
    } catch (err) {
        console.error("🔥 STATUS_FILTER_ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// J. HR Assignment (Relawan)
exports.assignResources = async (req, res) => {
    const { incident_id, volunteer_id } = req.body;
    verifyRole(req, ['ADMIN_PWNU', 'SUPER_ADMIN', 'COMMANDER']);
    try {
        await pool.query('BEGIN');
        await pool.query("UPDATE volunteers SET status_tugas = 'sedang_bertugas' WHERE id = $1", [volunteer_id]);
        await pool.query("INSERT INTO incident_resources (incident_id, volunteer_id) VALUES ($1, $2)", [incident_id, volunteer_id]);
        await pool.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
};

// L. Hapus Kejadian (Admin Only)
exports.deleteIncident = async (req, res) => {
    const { id } = req.params;
    verifyRole(req, ['ADMIN_PWNU', 'SUPER_ADMIN', 'COMMANDER']);
    try {
        // Central Audit
        await pool.query(
            `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id) 
             VALUES ($1, $2, $3, $4)`,
            [req.user.id, 'DELETE_INCIDENT', 'incidents', id]
        );

        await pool.query('DELETE FROM incidents WHERE id = $1', [parseInt(id)]);
        res.json({ success: true, message: "Insiden berhasil dihapus" });
    } catch (err) {
        console.error("🔥 DELETE_ERROR:", err.message);
        res.status(500).json({ error: "Gagal menghapus data insiden" });
    }
};

// M. Ambil Misi Saya (Khusus Relawan)
exports.getMyMissions = async (req, res) => {
    try {
        // Mengambil data pendaftaran relawan yang terhubung dengan user yang sedang login
        const query = `
            SELECT 
                vd.id as deployment_id, 
                vd.status as application_status, 
                vd.created_at as applied_at,
                i.id as incident_id, i.title, i.disaster_type, i.region, i.status as incident_status, i.priority_level
            FROM volunteer_deployments vd
            JOIN incidents i ON vd.incident_id = i.id
            JOIN volunteers v ON vd.volunteer_id = v.id
            WHERE v.user_id = $1
            ORDER BY vd.created_at DESC`;
            
        const result = await pool.query(query, [req.user.id]);
        res.json(result.rows || []);
    } catch (err) {
        console.error("🔥 FETCH_MY_MISSIONS_ERROR:", err.message);
        res.status(500).json({ error: "Gagal mengambil daftar misi Anda" });
    }
};

// N. Konfirmasi Kehadiran Relawan di Lokasi (GPS Based)
exports.confirmAttendance = async (req, res) => {
    const { incident_id, latitude, longitude } = req.body;
    const volunteer_id = req.user.volunteer.id; // Ambil ID relawan dari token

    if (!volunteer_id || !incident_id || !latitude || !longitude) {
        return res.status(400).json({ error: "Data tidak lengkap untuk konfirmasi kehadiran." });
    }

    try {
        // Catat kehadiran di tabel volunteer_deployments atau tabel baru (misal: volunteer_attendances)
        // Untuk saat ini, kita update status deployment menjadi 'attended'
        await pool.query(
            `UPDATE volunteer_deployments SET 
             status = 'attended', latitude = $1, longitude = $2, updated_at = NOW()
             WHERE volunteer_id = $3 AND incident_id = $4 AND status = 'approved'`,
            [latitude, longitude, volunteer_id, incident_id]
        );
        res.json({ success: true, message: "Kehadiran berhasil dikonfirmasi." });
    } catch (err) {
        console.error("🔥 CONFIRM_ATTENDANCE_ERROR:", err.message);
        res.status(500).json({ error: "Gagal mengkonfirmasi kehadiran." });
    }
};