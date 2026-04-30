const pool = require('../config/database');

/**
 * PUSDATIN AI ORCHESTRATOR - GEOLOGICAL & NEWS INTELLIGENCE
 * ============================================================
 * FUNGSI:
 * 1. Fake Report Rejection (Filter Hoax/Spam)
 * 2. Severity Analysis (Scoring Bencana & Geologi)
 * 3. AI Summarizer (Perangkum narasi MAGMA/Berita)
 * 4. Smart Deduplication (Anti-Tumpang Tindih)
 * 5. Lifecycle Management (pending→verified→resolved)
 * 6. Update Detection (Same incident detection)
 */

// ============================================================
// 1. FAKE REPORT DETECTION & REJECTION
// ============================================================
const FAKE_PATTERNS = [
    /hoax|bohong| palsu|fake/i,
    /donasi|donor|bantuan.*uang|transfer.*rekening/i,
    / kliklink| klikaja|bonus.*gratis/i,
    /info.*Tidak.*Resmi|berita.*Tidak.*diverifikasi/i,
    /^$/,
    /^$/,
    /test|testing| coba/i,
    /^\s*$|^undefined$|^null$/i,
];

// Suspicious sources that often contain fake news
const SUSPICIOUS_SOURCES = [
    'anonymous',
    'unknown',
    'user',
    'guest',
];

const isFakeReport = (intel) => {
    const text = (intel.title || '') + ' ' + (intel.raw_content || '');
    
    // Check for fake patterns
    for (const pattern of FAKE_PATTERNS) {
        if (pattern.test(text)) {
            return { fake: true, reason: pattern.toString() };
        }
    }
    
    // Check if title is too short or empty
    if (!intel.title || intel.title.length < 5) {
        return { fake: true, reason: 'Title too short' };
    }
    
    // Check required fields
    if (!intel.lat || !intel.lng || intel.lat === 0 || intel.lng === 0) {
        return { fake: true, reason: 'Invalid coordinates' };
    }
    
    return { fake: false };
};

// ============================================================
// 2. AI SEVERITY ANALYSIS (Weighting System)
// ============================================================
const analyzeSeverity = (text, category, statusLevel) => {
    let score = 0;
    const t = text.toLowerCase();

    if (category === 'Gunung Api') {
        if (statusLevel.includes('IV') || statusLevel.toLowerCase().includes('awas')) score += 1200;
        else if (statusLevel.includes('III') || statusLevel.toLowerCase().includes('siaga')) score += 700;
        else if (statusLevel.includes('II') || statusLevel.toLowerCase().includes('waspada')) score += 300;
    }

    if (t.includes('tsunami') || t.includes('likuefaksi')) score += 500;
    if (t.includes('bandang') || t.includes('letusan')) score += 300;
    if (t.includes('meninggal') || t.includes('tewas')) score += 100;
    if (t.includes('hilang')) score += 80;
    if (t.includes('luka') || t.includes('sakit')) score += 40;
    if (t.includes('mengungsi') || t.includes('pengungsi')) score += 30;
    if (t.includes('terdampak')) score += 10;

    if (t.includes('rusak berat') || t.includes('ambruk') || t.includes('hancur')) score += 50;
    if (t.includes('putus') || t.includes('lumpuh')) score += 60;

    let level = 'LOW';
    if (score > 1000) level = 'CRITICAL';
    else if (score > 500) level = 'HIGH';
    else if (score > 200) level = 'MEDIUM';

    return { score, level };
};

// ============================================================
// 3. AI SUMMARIZER
// ============================================================
const generateSummary = (rawContent, category) => {
    if (!rawContent) return "Ringkasan informasi belum tersedia.";
    
    let summary = rawContent
        .replace(/<\/?[^>]+(>|$)/g, "")
        .substring(0, 250);

    if (category === 'Gunung Api') {
        return `[INTEL ANALYST]: ${summary}... Harap patuhi radius aman yang ditetapkan PVMBG.`;
    }
    return `[INTEL NEWS]: ${summary}...`;
};

// ============================================================
// 4. GEOSPATIAL UTILS
// ============================================================
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    try {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    } catch (e) {
        return 999; // Return large distance on error
    }
};

// ============================================================
// 5. FIND SAME INCIDENT (Update Detection)
// ============================================================
const findSameIncident = async (intel, maxDistance = 25) => {
    // Check recent incidents of same category within distance
    const recent = await pool.query(
        `SELECT * FROM incidents 
         WHERE disaster_type = $1 
         AND status NOT IN ('completed', 'resolved')
         AND created_at > NOW() - INTERVAL '72 hours'
         ORDER BY created_at DESC`,
        [intel.category]
    );

    for (const inc of recent.rows) {
        const dist = calculateDistance(
            intel.lat, intel.lng,
            parseFloat(inc.latitude || 0),
            parseFloat(inc.longitude || 0)
        );
        
        if (dist <= maxDistance) {
            return inc;
        }
    }
    return null;
};

// ============================================================
// 6. UPDATE EXISTING INCIDENT
// ============================================================
const updateIncident = async (incidentId, intel, aiSummary, aiStats) => {
    await pool.query(
        `UPDATE incidents SET 
            title = $1,
            description = COALESCE($2, description),
            priority_score = GREATEST(priority_score, $3),
            priority_level = CASE 
                WHEN $3 > priority_score THEN $4
                ELSE priority_level
            END,
            kondisi_mutakhir = $5,
            updated_at = NOW()
        WHERE id = $6`,
        [
            intel.title,
            aiSummary,
            aiStats.level === 'CRITICAL' ? aiStats.score : Math.max(aiStats.score, 0),
            aiStats.level,
            `Updated: ${new Date().toISOString()} - ${intel.raw_content?.substring(0, 100) || ''}`,
            incidentId
        ]
    );
};

// ============================================================
// 7. CREATE NEW INCIDENT
// ============================================================
const createIncident = async (intel, aiSummary, aiStats) => {
    const result = await pool.query(
        `INSERT INTO incidents (
            title, disaster_type, latitude, longitude, region,
            status, priority_score, priority_level, description,
            is_ai_generated, source_url
        ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, TRUE, $9)
        RETURNING id`,
        [
            intel.title,
            intel.category,
            intel.lat,
            intel.lng,
            intel.region,
            aiStats.score,
            aiStats.level,
            aiSummary,
            intel.url
        ]
    );
    return result.rows[0].id;
};

// ============================================================
// 8. MARK INCIDENT AS VERIFIED
// ============================================================
const verifyIncident = async (incidentId) => {
    await pool.query(
        `UPDATE incidents SET status = 'verified', updated_at = NOW() WHERE id = $1`,
        [incidentId]
    );
};

// ============================================================
// 9. RESOLVE INCIDENT (Lifecycle)
// ============================================================
const resolveIncident = async (incidentId) => {
    await pool.query(
        `UPDATE incidents SET status = 'resolved', updated_at = NOW() WHERE id = $1`,
        [incidentId]
    );
};

// ============================================================
// MAIN ORCHESTRATOR
// ============================================================
exports.processDeduplication = async (intel) => {
    try {
        // Validate required fields
        if (!intel || !intel.title || !intel.category) {
            console.log("[AI-ORCHESTRATOR] Invalid intel data - missing required fields");
            return { action: 'rejected', reason: 'Invalid intel data' };
        }

        // 1. Fake Report Rejection
        const fakeCheck = isFakeReport(intel);
        if (fakeCheck.fake) {
            console.log(`[AI-ORCHESTRATOR] REJECTED: ${fakeCheck.reason}`);
            return { action: 'rejected', reason: fakeCheck.reason };
        }

        const aiSummary = generateSummary(intel.raw_content, intel.category);
        const aiStats = analyzeSeverity(
            intel.title + " " + (intel.raw_content || ""),
            intel.category,
            intel.status_level || ""
        );

        // 2. Special Logic for Volcano (by name)
        if (intel.category === 'Gunung Api') {
            const existing = await pool.query(
                `SELECT * FROM incidents 
                 WHERE disaster_type = 'Gunung Api' AND region = $1`,
                [intel.region]
            );

            if (existing.rows.length > 0) {
                await updateIncident(existing.rows[0].id, intel, aiSummary, aiStats);
                console.log(`[AI-ORCHESTRATOR] Updated volcano: ${intel.region}`);
                return { action: 'updated_volcano', id: existing.rows[0].id };
            }
        }

        // 3. Find same incident for update
        const existingIncident = await findSameIncident(intel);
        
        if (existingIncident) {
            // Update existing incident with new info
            await updateIncident(existingIncident.id, intel, aiSummary, aiStats);
            
            // Auto-verify if it's a reliable source
            const isReliableSource = ['BMKG', 'MAGMA Indonesia', 'Antara'].includes(intel.source);
            if (isReliableSource) {
                await verifyIncident(existingIncident.id);
                console.log(`[AI-ORCHESTRATOR] Updated & Verified: ${existingIncident.id}`);
            }
            
            return { action: 'updated', id: existingIncident.id };
        }

        // 4. Create new incident
        const newId = await createIncident(intel, aiSummary, aiStats);
        
        // Auto-verify from reliable sources
        const isReliableSource = ['BMKG', 'MAGMA Indonesia', 'Antara'].includes(intel.source);
        if (isReliableSource) {
            await verifyIncident(newId);
            console.log(`[AI-ORCHESTRATOR] Created & Verified: ${newId}`);
        }
        
        return { action: 'created', id: newId };

    } catch (e) {
        console.error("[AI-ORCHESTRATOR] Critical Error:", e.message);
        return { action: 'error', message: e.message };
    }
};

// ============================================================
// EXPORT LIFECYCLE FUNCTIONS
// ============================================================
exports.verifyIncident = verifyIncident;
exports.resolveIncident = resolveIncident;
exports.isFakeReport = isFakeReport;
exports.findSameIncident = findSameIncident;
exports.updateIncident = updateIncident;
exports.analyzeSeverity = analyzeSeverity;
exports.generateSummary = generateSummary;
exports.calculateDistance = calculateDistance;