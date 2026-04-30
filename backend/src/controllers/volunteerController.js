const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'PUSDATIN_JATENG_SECRET_2024';

const verifyRole = (req, allowedRoles) => {
    const userRole = req.user?.role?.toUpperCase().replace(/\s/g, '_');
    if (!userRole || !allowedRoles.includes(userRole)) throw new Error(`Forbidden: Role ${req.user.role} is not allowed.`);
};

exports.register = async (req, res) => {
    const { full_name, email, password, phone, role, region } = req.body;
    try {
        const hashed = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO users (full_name, email, password_hash, phone, role, region, status) 
             VALUES ($1, $2, $3, $4, $5, $6, 'active') RETURNING id, full_name, email, role, region`,
            [full_name, email, hashed, phone, role || 'VOLUNTEER', region]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
        
        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
        
        const token = jwt.sign({ id: user.id, role: user.role, region: user.region }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role, region: user.region } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- 1. AVAILABILITY SCHEDULE ---
exports.setAvailability = async (req, res) => {
    const { volunteer_id, date, shift_start, shift_end, status } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO volunteer_schedules (volunteer_id, date, shift_start, shift_end, status)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [volunteer_id, date, shift_start, shift_end, status || 'available']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getAvailability = async (req, res) => {
    const { volunteer_id, start_date, end_date } = req.query;
    try {
        let query = `SELECT * FROM volunteer_schedules WHERE 1=1`;
        const params = [];
        if (volunteer_id) { params.push(volunteer_id); query += ` AND volunteer_id = $${params.length}`; }
        if (start_date) { params.push(start_date); query += ` AND date >= $${params.length}`; }
        if (end_date) { params.push(end_date); query += ` AND date <= $${params.length}`; }
        query += ` ORDER BY date ASC`;
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- 2. SKILL MATCHING ---
exports.getNearbyVolunteers = async (req, res) => {
    const { lat, lng, expertise, region, status } = req.query;
    const userRole = req.user?.role?.toUpperCase().replace(/\s/g, '_');
    const userRegion = req.user?.region?.toLowerCase();

    try {
        let query = `
            SELECT v.*, u.full_name, u.role, u.region as user_region
            FROM volunteers v
            JOIN users u ON v.user_id = u.id
            WHERE v.status = COALESCE($1, 'approved') 
        `;
        const params = [status || 'approved'];

        // RBAC: PCNU/Field Staff only see their region's volunteers
        if (['PCNU', 'ADMIN_PCNU', 'STAFF_PCNU', 'FIELD_STAFF', 'TENAGA_AHLI'].includes(userRole)) {
            params.push(userRegion);
            query += ` AND LOWER(v.regency) = $${params.length}`;
        } else if (region) { // PWNU/SuperAdmin can filter by region
            params.push(region);
            query += ` AND v.regency = $${params.length}`;
        }
        
        if (expertise) {
            params.push(expertise);
            query += ` AND v.expertise LIKE $${params.length}`;
        }
        
        query += ` ORDER BY v.id LIMIT 50`;
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.json([]);
    }
};

exports.matchVolunteers = async (req, res) => {
    const { incident_id, required_expertise } = req.body;
    verifyRole(req, ['ADMIN_PWNU', 'SUPER_ADMIN', 'COMMANDER']);
    try {
        const required = required_expertise.split(',').map(e => e.trim());
        let results = [];
        
        for (const skill of required) {
            const result = await pool.query(
                `SELECT v.*, u.full_name, u.region as user_region
                 FROM volunteers v
                 JOIN users u ON v.user_id = u.id
                 WHERE v.status = 'approved' AND v.expertise LIKE $1
                 ORDER BY RANDOM() LIMIT 10`,
                [`%${skill}%`]
            );
            results = [...results, ...result.rows];
        }
        
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- 3. CERTIFICATIONS ---
exports.addCertification = async (req, res) => {
    const { volunteer_id, name, issued_date, expiry_date, certificate_number, document_url } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO certifications (volunteer_id, name, issued_date, expiry_date, certificate_number, document_url)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [volunteer_id, name, issued_date, expiry_date, certificate_number, document_url]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getCertifications = async (req, res) => {
    const { volunteer_id } = req.params;
    try {
        const result = await pool.query(
            `SELECT * FROM certifications WHERE volunteer_id = $1 ORDER BY expiry_date ASC`,
            [volunteer_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- 4. PERFORMANCE TRACKING ---
exports.logPerformance = async (req, res) => {
    const { volunteer_id, incident_id, hours_worked, missions_completed, rating, notes } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO volunteer_performance (volunteer_id, incident_id, hours_worked, missions_completed, rating, notes)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [volunteer_id, incident_id, hours_worked, missions_completed, rating, notes]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getPerformance = async (req, res) => {
    const { volunteer_id } = req.params;
    try {
        const result = await pool.query(
            `SELECT vp.*, i.title as incident_title
             FROM volunteer_performance vp
             LEFT JOIN incidents i ON vp.incident_id = i.id
             WHERE vp.volunteer_id = $1
             ORDER BY vp.created_at DESC`,
            [volunteer_id]
        );
        
        const summary = await pool.query(
            `SELECT 
                COUNT(*) as total_missions,
                SUM(hours_worked) as total_hours,
                AVG(rating) as avg_rating
             FROM volunteer_performance
             WHERE volunteer_id = $1`,
            [volunteer_id]
        );
        
        res.json({ performance: result.rows, summary: summary.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- 5. PROFILE MANAGEMENT ---
exports.updateProfile = async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    try {
        const result = await pool.query(
            `UPDATE volunteers SET 
                phone = $1, birth_date = $2, gender = $3, blood_type = $4,
                regency = $5, district = $6, village = $7, detail_address = $8,
                latitude = $9, longitude = $10, medical_history = $11, expertise = $12, experience = $13
             WHERE id = $14 RETURNING *`,
            [data.phone, data.birth_date, data.gender, data.blood_type, data.regency, data.district, data.village, 
             data.detail_address, data.latitude, data.longitude, data.medical_history, data.expertise, data.experience, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- 6. ATTENDANCE / CHECK-IN ---
exports.checkIn = async (req, res) => {
    const { volunteer_id, latitude, longitude } = req.body;
    try {
        const result = await pool.query(
            `UPDATE volunteers SET latitude = $1, longitude = $2, last_location = NOW() WHERE id = $3 RETURNING *`,
            [latitude, longitude, volunteer_id]
        );
        res.json({ success: true, location: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 7. Relawan mendaftar kesediaan (Apply dari RelawanTactical.jsx)
exports.applyDuty = async (req, res) => {
    const { volunteer_id, incident_id, available_from, available_until, note } = req.body;
    verifyRole(req, ['RELAWAN', 'VOLUNTEER', 'REL_AWAN']); // Only volunteers can apply
    try {
        const result = await pool.query(
            `INSERT INTO volunteer_deployments (volunteer_id, incident_id, available_from, available_until, note)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [volunteer_id, incident_id, available_from, available_until, note]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 8. Ambil pendaftar untuk Instruksi (InstructionView.jsx)
exports.getApplicantsByIncident = async (req, res) => {
    const { incident_id } = req.params;
    verifyRole(req, ['ADMIN_PWNU', 'SUPER_ADMIN', 'COMMANDER', 'PCNU', 'ADMIN_PCNU']);
    try {
        const result = await pool.query(
            `SELECT vd.*, u.full_name, u.region 
             FROM volunteer_deployments vd
             JOIN users u ON vd.volunteer_id = u.id
             WHERE vd.incident_id = $1`,
            [incident_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 8b. Approve/Reject Deployment (CompleteView.jsx)
exports.approveDeployment = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    verifyRole(req, ['ADMIN_PWNU', 'SUPER_ADMIN', 'COMMANDER']);
    try {
        await pool.query(
            "UPDATE volunteer_deployments SET status = $1 WHERE id = $2",
            [status, id]
        );
        res.json({ success: true, message: `Deployment ${status}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 9. Get Nearby Volunteers (from CompleteView.jsx)
exports.getNearbyVolunteersOld = async (req, res) => {
    const { lat, lng, expertise } = req.query;
    // This is an old route, likely replaced by getNearbyVolunteers, but adding RBAC for safety
    verifyRole(req, ['ADMIN_PWNU', 'SUPER_ADMIN', 'COMMANDER', 'PCNU', 'ADMIN_PCNU', 'FIELD_STAFF', 'TENAGA_AHLI']);
    try {
        const result = await pool.query(
            `SELECT * FROM volunteers WHERE status = 'approved' ORDER BY id LIMIT 50`
        );
        res.json(result.rows);
    } catch (err) {
        res.json([]);
    }
};

// 10. Create Volunteer Profile
exports.createVolunteerProfile = async (req, res) => {
    const data = req.body;
    try {
        // If user_id not provided, try to find user by full_name or create without user_id
        let userId = data.user_id;
        if (!userId && data.full_name) {
            const userResult = await pool.query(
                `SELECT id FROM users WHERE full_name = $1 LIMIT 1`,
                [data.full_name]
            );
            if (userResult.rows.length > 0) {
                userId = userResult.rows[0].id;
            }
        }
        
        const result = await pool.query(
            `INSERT INTO volunteers (user_id, full_name, phone, birth_date, gender, blood_type, regency, district, village, detail_address, latitude, longitude, medical_history, expertise, experience) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
            [userId, data.full_name, data.phone, data.birth_date, data.gender, data.blood_type, data.regency, data.district, data.village, data.detail_address, data.latitude, data.longitude, data.medical_history, data.expertise, data.experience]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[VOLUNTEER] Create profile error:', err.message);
        res.status(500).json({ error: err.message });
    }
};
// --- 11. LOCATION SYNC (Background Geolocation) ---
exports.syncLocation = async (req, res) => {
    const { locations } = req.body;
    verifyRole(req, ['RELAWAN', 'VOLUNTEER', 'REL_AWAN', 'FIELD_STAFF', 'TENAGA_AHLI']); // Only field personnel can sync location
    try {
        if (!locations || !Array.isArray(locations)) {
            return res.status(400).json({ error: 'Invalid data' });
        }
        
        for (const loc of locations) {
            await pool.query(
                `UPDATE volunteers 
                 SET latitude = $1, longitude = $2, last_location = NOW() 
                 WHERE id = $3`,
                [loc.latitude, loc.longitude, loc.volunteer_id]
            );
        }
        
        res.json({ success: true, synced: locations.length });
    } catch (err) {
        console.error('[LOCATION] Sync error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// --- 12. UPDATE LAST LOCATION ---
exports.updateLocation = async (req, res) => {
    const { volunteer_id, latitude, longitude, status } = req.body;
    verifyRole(req, ['RELAWAN', 'VOLUNTEER', 'REL_AWAN', 'FIELD_STAFF', 'TENAGA_AHLI']); // Only field personnel can update location
    try {
        await pool.query(
            `UPDATE volunteers 
             SET latitude = $1, longitude = $2, last_location = NOW(), status = COALESCE($3, status)
             WHERE id = $4`,
            [latitude, longitude, status, volunteer_id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};