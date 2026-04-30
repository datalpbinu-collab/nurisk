const pool = require('../config/database');
const path = require('path');

// jspdf loaded dynamically
let jsPDF;
let jsPDFAutoTable;
try {
  jsPDF = require('jspdf');
  jsPDFAutoTable = require('jspdf-autotable');
} catch (e) {
  console.warn('jsPDF not available, PDF generation disabled');
}

const verifyRole = (req, allowedRoles) => {
    const userRole = req.user?.role?.toUpperCase().replace(/\s/g, '_');
    if (!userRole || !allowedRoles.includes(userRole)) throw new Error(`Forbidden: Role ${req.user.role} is not allowed.`);
};

// --- DASHBOARD KPIs ---
exports.getDashboardStats = async (req, res) => {
    const { start_date, end_date, region } = req.query;
    try {
        const params = [];
        let paramIdx = 1;

        const incidentQuery = `SELECT
            COUNT(*) as total_incidents,
            COUNT(*) FILTER (WHERE status = 'REPORTED') as reported,
            COUNT(*) FILTER (WHERE status = 'VERIFIED') as verified,
            COUNT(*) FILTER (WHERE status = 'ASSESSED') as assessed,
            COUNT(*) FILTER (WHERE status = 'COMMANDED') as commanded,
            COUNT(*) FILTER (WHERE status = 'ACTION') as in_action,
            COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
            COUNT(*) FILTER (WHERE priority_level = 'CRITICAL') as critical,
            COALESCE(AVG(priority_score), 0) as avg_priority
         FROM incidents WHERE 1=1`;

        const volunteerQuery = `SELECT
            COUNT(*) as total_volunteers,
            COUNT(*) FILTER (WHERE status = 'approved') as active,
            COUNT(*) FILTER (WHERE status = 'pending') as pending
         FROM volunteers`;

        const assetQuery = `SELECT
            COALESCE(SUM(quantity), 0) as total_items,
            COUNT(*) as total_types
         FROM asset_inventories WHERE status = 'available'`;

        let incidentFilter = '';
        if (start_date && end_date) {
            incidentFilter += ` AND created_at >= $${paramIdx++} AND created_at <= $${paramIdx++}`;
            params.push(start_date, end_date);
        }

        if (region) {
            incidentFilter += ` AND region = $${paramIdx++}`;
            params.push(region);
        }

        const finalIncidentQuery = incidentQuery + incidentFilter;

        const incidents = await pool.query(finalIncidentQuery, params.length > 0 ? params : undefined);
        
        const volunteers = await pool.query(volunteerQuery);
        const assets = await pool.query(assetQuery);

        res.json({
            incidents: incidents.rows[0] || { total_incidents: 0, reported: 0, verified: 0, assessed: 0, commanded: 0, in_action: 0, completed: 0, critical: 0, avg_priority: 0 },
            volunteers: volunteers.rows[0] || { total_volunteers: 0, active: 0, pending: 0 },
            assets: assets.rows[0] || { total_items: 0, total_types: 0 }
        });
    } catch (err) {
        console.error("Dashboard stats error:", err);
        res.status(500).json({ error: err.message });
    }
};

// --- AUDIT LOGS ---
exports.getAuditLogs = async (req, res) => {
    verifyRole(req, ['SUPER_ADMIN', 'ADMIN_PWNU']); // Hanya super admin dan admin PWNU yang bisa melihat audit logs

    const { limit = 20, page = 1, actor_id, action, entity_type, entity_id, start_date, end_date } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE 1=1';
    const queryParams = [];
    let paramIndex = 1;

    if (actor_id) {
        whereClause += ` AND al.actor_id = $${paramIndex++}`;
        queryParams.push(parseInt(actor_id));
    }
    if (action) {
        whereClause += ` AND al.action ILIKE $${paramIndex++}`;
        queryParams.push(`%${action}%`);
    }
    if (entity_type) {
        whereClause += ` AND al.entity_type ILIKE $${paramIndex++}`;
        queryParams.push(`%${entity_type}%`);
    }
    if (entity_id) {
        whereClause += ` AND al.entity_id = $${paramIndex++}`;
        queryParams.push(parseInt(entity_id));
    }
    if (start_date) {
        whereClause += ` AND al.created_at >= $${paramIndex++}`;
        queryParams.push(start_date);
    }
    if (end_date) {
        whereClause += ` AND al.created_at <= $${paramIndex++}`;
        queryParams.push(end_date);
    }

    try {
        const totalCountResult = await pool.query(
            `SELECT COUNT(*) FROM audit_logs al ${whereClause}`,
            queryParams
        );
        const total = parseInt(totalCountResult.rows[0].count);

        const limitVal = parseInt(limit);
        const offsetVal = offset;

        const result = await pool.query(
            `SELECT 
                al.id, 
                al.actor_id, 
                u.full_name as actor_name, 
                u.role as actor_role,
                al.action, 
                al.entity_type, 
                al.entity_id, 
                al.payload, 
                al.created_at
             FROM audit_logs al
             LEFT JOIN users u ON al.actor_id = u.id
             ${whereClause}
             ORDER BY al.created_at DESC
             LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...queryParams, limitVal, offsetVal]
        );

        res.json({
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            data: result.rows
        });
    } catch (err) {
        console.error("Audit logs error:", err);
        res.status(500).json({ error: err.message });
    }
};

// --- RESPONSE TIME METRICS ---
exports.getResponseMetrics = async (req, res) => {
    const { start_date, end_date } = req.query;
    try {
        const start = start_date || '2020-01-01';
        const end = end_date || new Date().toISOString().split('T')[0];

        const result = await pool.query(
            `SELECT
                id, title, status, priority_score, created_at, updated_at,
                COALESCE(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600, 0) as hours_to_update
             FROM incidents
             WHERE created_at >= $1 AND created_at <= $2
             ORDER BY created_at DESC
             LIMIT 100`,
            [start, end]
        );
        res.json(result.rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- INCIDENTS BY TYPE/REGION ---
exports.getIncidentsByDimension = async (req, res) => {
    const { dimension, start_date, end_date } = req.query;
    try {
        const groupBy = (dimension === 'region') ? 'region' : 'disaster_type';
        const start = start_date || '2020-01-01';
        const end = end_date || new Date().toISOString().split('T')[0];
        
        const result = await pool.query(
            `SELECT ${groupBy}, COUNT(*) as count, COALESCE(AVG(priority_score), 0) as avg_score
             FROM incidents
             WHERE created_at >= '${start}' AND created_at <= '${end}'
             GROUP BY ${groupBy}
             ORDER BY count DESC
             LIMIT 50`
        );
        res.json(result.rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- VOLUNTEER PERFORMANCE SUMMARY ---
exports.getVolunteerPerformance = async (req, res) => {
    const { region, limit = 10 } = req.query;
    try {
        const regionFilter = region ? `AND v.regency = '${region.replace(/'/g, "''")}'` : '';
        
        const result = await pool.query(`
            SELECT 
                v.id, 
                COALESCE(v.full_name, u.full_name, 'Unknown') as full_name, 
                COALESCE(v.expertise, '-') as expertise, 
                COALESCE(v.regency, '-') as regency,
                COALESCE(COUNT(vp.id), 0) as missions_completed,
                COALESCE(SUM(vp.hours_worked)::int, 0) as total_hours,
                COALESCE(AVG(vp.rating)::numeric(3,2), 0) as avg_rating
             FROM volunteers v
             LEFT JOIN users u ON v.user_id = u.id
             LEFT JOIN volunteer_performance vp ON v.id = vp.volunteer_id
             WHERE 1=1 ${regionFilter}
             GROUP BY v.id, u.full_name, v.full_name, v.expertise, v.regency
             ORDER BY missions_completed DESC
             LIMIT ${parseInt(limit) || 10}
        `);
        
        console.log('[ANALYTICS] Volunteer performance query executed, rows:', result.rows.length);
        res.json(result.rows || []);
    } catch (err) {
        console.error("Volunteer performance error:", err);
        res.status(500).json({ error: err.message });
    }
};

// --- GENERATE SITEP REPORT (SITREP) PDF ---
exports.generateSITREP = async (req, res) => {
    if (!jsPDF) return res.status(503).json({ error: 'PDF generation not available. Install jspdf package.' });
    
    const { incident_id } = req.params;
    try {
        const incident = await pool.query(`SELECT * FROM incidents WHERE id = $1`, [parseInt(incident_id)]);
        if (incident.rows.length === 0) return res.status(404).json({ error: 'Incident not found' });

        const i = incident.rows[0];
        
        // Get related data
        const instruction = await pool.query(
            `SELECT * FROM incident_instructions WHERE incident_id = $1`,
            [parseInt(incident_id)]
        );
        
        const actions = await pool.query(
            `SELECT * FROM incident_actions WHERE incident_id = $1 ORDER BY created_at ASC`,
            [parseInt(incident_id)]
        );
        
        const volunteers = await pool.query(
            `SELECT v.full_name, v.phone, v.expertise, vd.status as deployment_status, vd.available_from
             FROM volunteer_deployments vd
             JOIN volunteers v ON vd.volunteer_id = v.id
             WHERE vd.incident_id = $1`,
            [parseInt(incident_id)]
        );
        
        const assets = await pool.query(
            `SELECT a.name, a.quantity, a.unit, a.category, t.type as transaction_type
             FROM asset_transactions t
             JOIN asset_inventories a ON t.asset_id = a.id
             WHERE t.incident_id = $1`,
            [parseInt(incident_id)]
        );
        
        const shelter = await pool.query(
            `SELECT * FROM shelters WHERE incident_id = $1`,
            [parseInt(incident_id)] // Ambil instruksi terbaru
        );
        
        const logs = await pool.query(
            `SELECT * FROM incident_logs WHERE incident_id = $1 ORDER BY created_at DESC`,
            [parseInt(incident_id)]
        );
        
        // Create PDF
        const doc = new jsPDF();
        
        // ============ HEADER ============
        doc.setFillColor(0, 100, 50); // NU Green
        doc.rect(0, 0, 210, 35, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text('SITUATION REPORT (SITREP)', 105, 15, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`PUSDATIN NU PEDULI JATENG`, 105, 25, { align: 'center' });
        
        // ============ INCIDENT INFO ============
        let yPos = 45;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('INFORMASI INSIDEN', 14, yPos);
        
        yPos += 10;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        
        // Table-style data
        const infoData = [
            ['Kode Insiden', `INC-${i.id}`],
            ['Judul', i.title || 'N/A'],
            ['Jenis Bencana', i.disaster_type || 'N/A'],
            ['Wilayah', i.region || 'N/A'],
            ['Kecamatan', i.kecamatan || 'N/A'],
            ['Desa', i.desa || 'N/A'],
            ['Status', i.status || 'REPORTED'],
            ['Skor Prioritas', String(i.priority_score || 0)],
            ['Tingkat Prioritas', i.priority_level || 'LOW'],
            ['Koordinat', `${i.latitude}, ${i.longitude}`],
            ['Sumber', i.is_ai_generated ? 'AI Scraper' : 'Manual'],
            ['Tanggal Kejadian', i.event_date ? new Date(i.event_date).toLocaleDateString('id-ID') : 'N/A'],
            ['Jam Kejadian', i.event_date ? new Date(i.event_date).toLocaleTimeString('id-ID') : 'N/A']
        ];
        
        infoData.forEach(([label, value]) => {
            doc.setFont('helvetica', 'bold');
            doc.text(`${label}:`, 14, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(String(value), 60, yPos);
            yPos += 7;
        });
        
        // Description
        yPos += 5;
        doc.setFont('helvetica', 'bold');
        doc.text('Deskripsi:', 14, yPos);
        yPos += 7;
        doc.setFont('helvetica', 'normal');
        const descLines = doc.splitTextToSize(i.description || 'Tidak ada deskripsi', 180);
        descLines.forEach(line => {
            doc.text(line, 14, yPos);
            yPos += 6;
        });
        
        // ============ DAMAGE ASSESSMENT ============
        if (i.dampak_manusia || i.dampak_rumah || i.dampak_fasum) {
            yPos += 10;
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('PENILAIAN DAMPAK', 14, yPos);
            yPos += 10;
            doc.setFontSize(10);
            
            const damageData = [];
            
            if (i.dampak_manusia) {
                const manusia = typeof i.dampak_manusia === 'string' ? JSON.parse(i.dampak_manusia) : i.dampak_manusia;
                damageData.push(['Dampak Manusia', JSON.stringify(manusia).replace(/[{}"]/g, ' ')]);
            }
            if (i.dampak_rumah) {
                const rumah = typeof i.dampak_rumah === 'string' ? JSON.parse(i.dampak_rumah) : i.dampak_rumah;
                damageData.push(['Dampak Rumah', JSON.stringify(rumah).replace(/[{}"]/g, ' ')]);
            }
            
            damageData.forEach(([label, value]) => {
                doc.setFont('helvetica', 'bold');
                doc.text(label + ':', 14, yPos);
                doc.setFont('helvetica', 'normal');
                doc.text(value, 60, yPos);
                yPos += 6;
            });
        }
        
        // ============ TIMELINE & ACTIONS ============
        yPos += 10;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('TIMELINE & TINDAKAN', 14, yPos);
        yPos += 8;
        
        if (actions.rows.length > 0) {
            const actionRows = actions.rows.map((a, idx) => [
                String(idx + 1),
                new Date(a.created_at).toLocaleString('id-ID'),
                a.kluster || '-',
                a.nama_kegiatan || '-',
                a.jumlah_paket || '-'
            ]);
            
            if (jsPDFAutoTable) {
                doc.autoTable({
                    startY: yPos,
                    head: [['#', 'Waktu', 'Kluster', 'Nama Kegiatan', 'Paket']],
                    body: actionRows,
                    theme: 'striped',
                    headStyles: { fillColor: [0, 100, 50] },
                    margin: { left: 14 }
                });
                yPos = doc.lastAutoTable.finalY + 15;
            } else {
                actionRows.forEach(row => {
                    doc.setFontSize(9);
                    doc.text(row.join(' | '), 14, yPos);
                    yPos += 6;
                });
                yPos += 10;
            }
        } else {
            doc.setFontSize(10);
            doc.text('Belum ada tindakan tercatat.', 14, yPos);
            yPos += 10;
        }
        
        // ============ DEPLOYED VOLUNTEERS ============
        if (yPos > 200) {
            doc.addPage();
            yPos = 20;
        }
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('RELAWAN TERLIBAT', 14, yPos);
        yPos += 8;
        
        if (volunteers.rows.length > 0) {
            const volRows = volunteers.rows.map(v => [
                v.full_name || '-',
                v.phone || '-',
                v.expertise || '-',
                v.deployment_status || '-'
            ]);
            
            if (jsPDFAutoTable) {
                doc.autoTable({
                    startY: yPos,
                    head: [['Nama', 'Telepon', ' Expertise', 'Status']],
                    body: volRows,
                    theme: 'striped',
                    headStyles: { fillColor: [0, 100, 50] },
                    margin: { left: 14 }
                });
                yPos = doc.lastAutoTable.finalY + 15;
            } else {
                volRows.forEach(row => {
                    doc.setFontSize(9);
                    doc.text(row.join(' | '), 14, yPos);
                    yPos += 6;
                });
                yPos += 10;
            }
        } else {
            doc.setFontSize(10);
            doc.text('Belum ada relawan bertugas.', 14, yPos);
            yPos += 10;
        }
        
        // ============ RESOURCES ============
        if (yPos > 220) {
            doc.addPage();
            yPos = 20;
        }
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('SUMBER DAYA', 14, yPos);
        yPos += 8;
        
        if (assets.rows.length > 0) {
            const assetRows = assets.rows.map(a => [
                a.name || '-',
                String(a.quantity || 0),
                a.unit || 'unit',
                a.category || '-'
            ]);
            
            if (jsPDFAutoTable) {
                doc.autoTable({
                    startY: yPos,
                    head: [['Aset', 'Jumlah', 'Satuan', 'Kategori']],
                    body: assetRows,
                    theme: 'striped',
                    headStyles: { fillColor: [0, 100, 50] },
                    margin: { left: 14 }
                });
                yPos = doc.lastAutoTable.finalY + 15;
            } else {
                assetRows.forEach(row => {
                    doc.setFontSize(9);
                    doc.text(row.join(' | '), 14, yPos);
                    yPos += 6;
                });
                yPos += 10;
            }
        } else {
            doc.setFontSize(10);
            doc.text('Belum ada sumber daya digunakan.', 14, yPos);
            yPos += 10;
        }
        
        // ============ SHELTER ============
        if (shelter.rows.length > 0) {
            yPos += 5;
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('POSKO/ SHELTER', 14, yPos);
            yPos += 8;
            
            shelter.rows.forEach(s => {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.text(`- ${s.name} (${s.region})`, 14, yPos);
                doc.text(`  Status: ${s.status} | Pengungsi: ${s.refugee_count}`, 20, yPos + 6);
                yPos += 14;
            });
        }
        
        // ============ INSTRUCTION ============
        if (instruction.rows.length > 0) {
            yPos += 5;
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('SURAT PERINTAH (SP)', 14, yPos);
            yPos += 8;
            
            const ins = instruction.rows[0];
            doc.setFontSize(10);
            doc.text(`Nomor SP: ${ins.nomor_sp || 'N/A'}`, 14, yPos);
            yPos += 7;
            doc.text(`Penanggung Jawab: ${ins.pj_nama || 'N/A'}`, 14, yPos);
            yPos += 7;
            doc.text(`PIC Lapangan: ${ins.pic_lapangan || 'N/A'}`, 14, yPos);
            yPos += 7;
            doc.text(`Tim: ${ins.tim_anggota || 'N/A'}`, 14, yPos);
            yPos += 7;
            doc.text(`Armada: ${ins.armada_detail || 'N/A'}`, 14, yPos);
            yPos += 7;
            doc.text(`Peralatan: ${ins.peralatan_detail || 'N/A'}`, 14, yPos);
            yPos += 7;
            doc.text(`Durasi: ${ins.duration || 'N/A'}`, 14, yPos);
            yPos += 15;
        }
        
        // ============ FOOTER ============
        const pageCount = doc.internal.getNumberOfPages();
        for (let page = 1; page <= pageCount; page++) {
            doc.setPage(page);
            doc.setFontSize(9);
            doc.setTextColor(128, 128, 128);
            doc.text(
                `Generated: ${new Date().toLocaleString('id-ID')} | Page ${page} of ${pageCount}`,
                105, 292,
                { align: 'center' }
            );
            doc.text(
                'PUSDATIN NU PEDULI JATENG - Sistem Informasi Tanggap Bencana',
                105, 298,
                { align: 'center' }
            );
        }
        
        // Send PDF
        const pdfOutput = doc.output('arraybuffer');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=SITREP_${incident_id}_${Date.now()}.pdf`);
        res.send(Buffer.from(pdfOutput));
        
        console.log(`[SITREP] Generated for incident ${incident_id}`);
    } catch (err) {
        console.error("SITREP generation error:", err);
        res.status(500).json({ error: err.message });
    }
};

// --- MONTHLY/YEARLY KPIs ---
exports.getKPIs = async (req, res) => {
    const { year, month } = req.query;
    try {
        const currentYear = year || new Date().getFullYear();
        const currentMonth = month;
        
        let startDate, endDate;
        
        if (currentMonth) {
            startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
            endDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`;
        } else {
            startDate = `${currentYear}-01-01`;
            endDate = `${currentYear}-12-31`;
        }
        
        const incidents = await pool.query(
            `SELECT COALESCE(status, 'none') as status, COUNT(*) as total 
             FROM incidents 
             WHERE created_at >= '${startDate}' AND created_at <= '${endDate}'
             GROUP BY status`
        );
        
        const responseTime = await pool.query(
            `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600), 0) as avg_hours
             FROM incidents 
             WHERE status = 'COMPLETED' AND created_at >= '${startDate}' AND created_at <= '${endDate}'`
        );
        
        const volunteers = await pool.query(
            `SELECT COUNT(*) as new_volunteers 
             FROM volunteers 
             WHERE created_at >= '${startDate}' AND created_at <= '${endDate}'`
        );
        
        const assets = await pool.query(
            `SELECT COALESCE(SUM(quantity), 0) as deployed 
             FROM asset_transactions 
             WHERE type = 'dispatch' AND created_at >= '${startDate}' AND created_at <= '${endDate}'`
        );
        
        res.json({
            period: { startDate, endDate },
            incidents: incidents.rows || [],
            avgResponseHours: parseFloat(responseTime.rows[0]?.avg_hours || 0).toFixed(2),
            newVolunteers: volunteers.rows[0]?.new_volunteers || 0,
            assetsDeployed: assets.rows[0]?.deployed || 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- BUILDING ASSESSMENT STATS ---
exports.getBuildingStats = async (req, res) => {
    try {
        const total = await pool.query(`SELECT COUNT(*) as count FROM building_assessments`);
        const completed = await pool.query(`SELECT COUNT(*) as count FROM building_assessments WHERE completed = true`);
        const avgScore = await pool.query(`SELECT COALESCE(AVG(total_score), 0) as avg FROM building_assessments WHERE completed = true`);
        const highResilient = await pool.query(`SELECT COUNT(*) as count FROM building_assessments WHERE total_score >= 80 AND completed = true`);
        const mediumResilient = await pool.query(`SELECT COUNT(*) as count FROM building_assessments WHERE total_score >= 60 AND total_score < 80 AND completed = true`);
        const lowResilient = await pool.query(`SELECT COUNT(*) as count FROM building_assessments WHERE total_score < 60 AND completed = true`);
        const byFungsi = await pool.query(`SELECT fungsi, COUNT(*) as count FROM building_assessments GROUP BY fungsi`);
        
        res.json({
            total: parseInt(total.rows[0]?.count || 0),
            completed: parseInt(completed.rows[0]?.count || 0),
            avgScore: avgScore.rows[0]?.avg || 0,
            highResilient: parseInt(highResilient.rows[0]?.count || 0),
            mediumResilient: parseInt(mediumResilient.rows[0]?.count || 0),
            lowResilient: parseInt(lowResilient.rows[0]?.count || 0),
            byFungsi: byFungsi.rows || []
        });
    } catch (err) {
        console.error("Building stats error:", err);
        res.status(500).json({ error: err.message });
    }
};