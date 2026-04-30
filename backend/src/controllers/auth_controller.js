const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Secret Key untuk Enkripsi Token (Gunakan .env jika ada)
const JWT_SECRET = process.env.JWT_SECRET || 'PUSDATIN_JATENG_SECRET_2024';

// --- 1. FUNGSI DAFTAR (REGISTER) ---
exports.register = async (req, res) => {
    // Ambil data lengkap sesuai kebutuhan PRD & PersonnelPortal.jsx
    const { 
        full_name,
        username,
        password,
        role,
        region,
        secret_key
    } = req.body;

    if (!username || !password || !full_name || !region) {
        return res.status(400).json({ success: false, error: "DATA PENDAFTARAN TIDAK LENGKAP" });
    }

    // Monitoring Data Taktis
    console.log("=== [AUTH] DEBUG PENDAFTARAN ===");
    console.log("User:", username, "| Role:", role, "| Region:", region);
    console.log("Key Dikirim:", secret_key);
    console.log("================================");

    try {
        const inputKey = (secret_key || "").trim();
        const serverKeyPWNU = (process.env.SECRET_KEY_PWNU || "PWNU_JATENG_BOSS").trim();
        const serverKeyPCNU = (process.env.SECRET_KEY_PCNU || "PCNU_JATENG_MEMBER").trim();

        // VALIDASI OTORITAS - All roles that require secret_key
        const roleRequirement = {
            'ADMIN_PWNU': serverKeyPWNU,
            'PWNU': serverKeyPWNU,
            'ADMIN_PCNU': serverKeyPCNU,
            'STAFF_PWNU': serverKeyPWNU,
            'STAFF_PCNU': serverKeyPCNU
        };

        if (roleRequirement[role] && inputKey !== roleRequirement[role]) {
            return res.status(401).json({ success: false, error: `KODE OTORITAS ${role} TIDAK VALID!` });
        }
        // RELAWAN and FIELD_STAFF don't need secret_key

        // Hashing Password (Keamanan Standar Industri)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const lowerUsername = username.toLowerCase().trim();

        // Simpan ke Database
        const result = await pool.query(
            `INSERT INTO users (full_name, region, username, password, role) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [full_name, region, lowerUsername, hashedPassword, role]
        );

        console.log(`✅ [AUTH] User Registered Successfully: ${lowerUsername}`);
        res.status(201).json({ 
            success: true, 
            message: "Pendaftaran Berhasil! Silakan Masuk.",
            userId: result.rows[0].id 
        });

    } catch (err) {
        console.error("🔥 [AUTH] REGISTRATION ERROR:", err);
        
        if (err.code === '23505') { // PostgreSQL Unique Violation
            return res.status(409).json({ success: false, error: "USERNAME SUDAH TERDAFTAR" });
        }
        
        res.status(500).json({ success: false, error: "INTERNAL SERVER ERROR PADA DATABASE" });
    }
};

// --- 2. FUNGSI MASUK (LOGIN) ---
exports.login = async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ success: false, error: "Username dan Password wajib diisi" });
    }

    const lowerUsername = username.toLowerCase().trim();

    try {
        // Cari user di database
        const result = await pool.query("SELECT * FROM users WHERE username = $1", [lowerUsername]);
        
        if (result.rows.length === 0) {
            console.log(`❌ [AUTH] Login Failed: User ${lowerUsername} not found`);
            return res.status(401).json({ success: false, error: "Akun tidak ditemukan" });
        }

        const user = result.rows[0];

        // LOGIKA HANDSHAKE: Cek apakah password di DB adalah Bcrypt atau Plain Text (Bypass Data Lama)
        let isMatch = false;
        if (user.password.startsWith('$2') || user.password.length > 30) {
            // Jika format hash bcrypt
            isMatch = await bcrypt.compare(password, user.password);
        } else {
            // Jika data lama/manual yang belum dihash
            console.warn(`⚠️ [AUTH] User ${lowerUsername} using unsecure plain-text password!`);
            isMatch = (password === user.password);
        }

        if (!isMatch) {
            console.log(`❌ [AUTH] Login Failed: Incorrect password for ${lowerUsername}`);
            return res.status(401).json({ success: false, error: "Password salah" });
        }

        // Ambil data profil volunteer jika ada (Penting untuk Relawan & Field Staff)
        const volResult = await pool.query("SELECT * FROM volunteers WHERE user_id = $1", [user.id]);

        // GENERATE JWT TOKEN (Penting untuk Session Management di Frontend)
        const token = jwt.sign(
            { id: user.id, role: user.role, region: user.region },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log(`✅ [AUTH] Login Success: ${lowerUsername} [${user.role}]`);
        
        // Kirim Respon Lengkap (User + Token)
        res.status(200).json({ 
            success: true, 
            message: "Login Berhasil",
            token: token,
            user: { 
                id: user.id, 
                full_name: user.full_name, 
                role: user.role, 
                region: user.region,
                volunteer: volResult.rows[0] || null
            }
        });

    } catch (err) {
        console.error("🔥 [AUTH] LOGIN ERROR:", err.message);
        res.status(500).json({ success: false, error: "Terjadi kesalahan internal pada server" });
    }
};