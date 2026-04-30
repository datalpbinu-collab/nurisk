const pool = require('../config/database');

// Helper function to get data from multiple sources
const getIntegratedData = async (baseQuery, baseParams, periodFormat, includeReports = true, includeScrapers = true) => {
  let integratedQuery = baseQuery;
  let integratedParams = [...baseParams];
  let paramIndex = baseParams.length + 1;
  
  // Add data from public reports (laporan masyarakat)
  if (includeReports) {
    const reportsQuery = `
      SELECT TO_CHAR(created_at, '${periodFormat}') AS period, 
             disaster_type, 
             COUNT(*)::INTEGER AS count,
             'report' as source
      FROM reports 
      WHERE EXTRACT(YEAR FROM created_at) BETWEEN 2022 AND 2026
    `;
    // This would need to be merged in application logic, not SQL UNION due to different table structures
  }
  
  // For now, we'll keep it simple: just historical_disasters table
  // In production, you'd want to create a view or use UNION queries
  
  return integratedQuery;
};

// Upload
exports.uploadHistoricalData = async (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: "No data" });
    
    try {
        let inserted = 0;
        for (const row of data) {
            if (!row.region || !row.disaster_type || !row.event_date) continue;
            await pool.query(
                'INSERT INTO historical_disasters (region, disaster_type, event_date) VALUES ($1,$2,$3)',
                [row.region, row.disaster_type, row.event_date]
            );
            inserted++;
        }
        res.json({ success: true, totalProcessed: inserted, skipped: data.length - inserted });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

// Trends
exports.getDisasterTrends = async (req, res) => {
    try {
        const { period, region, disaster_type } = req.query;
        // Determine period format based on query parameter
        const periodFormat = period === 'yearly' ? 'YYYY' : 'YYYY-MM';
        
        let query = `SELECT TO_CHAR(event_date, '${periodFormat}') AS period, disaster_type, COUNT(*)::INTEGER AS count FROM historical_disasters WHERE EXTRACT(YEAR FROM event_date) BETWEEN 2022 AND 2026`;
        const params = [];
        let paramIndex = 1;
        
        if (region && region !== 'all') {
            params.push(region);
            query += ` AND region = $${paramIndex++}`;
        }
        if (disaster_type && disaster_type !== 'all') {
            params.push(disaster_type);
            query += ` AND disaster_type = $${paramIndex++}`;
        }
        
        query += ` GROUP BY period, disaster_type ORDER BY period`;        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (e) {
        console.error("Trend query error:", e);
        res.status(500).json({ error: e.message });
    }
};

// All Data - shows data from historical_disasters only (reports table doesn't have region column)
exports.getAllHistoricalData = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page-1) * limit;
        const { region, disaster_type } = req.query;
        
        // Base query for historical_disasters
        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        
        if (region && region !== 'all') {
            params.push(region);
            whereClause += ` AND region = $${paramIndex++}`;
        }
        if (disaster_type && disaster_type !== 'all') {
            params.push(disaster_type);
            whereClause += ` AND disaster_type = $${paramIndex++}`;
        }
        
        const dataQuery = `SELECT *, 'historical' as source FROM historical_disasters ${whereClause} ORDER BY event_date DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        const countQuery = `SELECT COUNT(*) FROM historical_disasters ${whereClause}`;
        
        const queryParams = [...params, limit, offset];
        const countParams = [...params];
        
        const data = await pool.query(dataQuery, queryParams);
        const count = await pool.query(countQuery, countParams);
        
        res.json({ data: data.rows, total: parseInt(count.rows[0].count), page });
    } catch (e) {
        console.error("Get all data error:", e);
        res.status(500).json({ error: e.message });
    }
};

// Delete
exports.deleteHistoricalData = async (req, res) => {
    try {
        await pool.query('DELETE FROM historical_disasters WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Forecast
exports.getPredictiveForecast = async (req, res) => {
    try {
        const { region } = req.query;
        let whereClause = 'WHERE EXTRACT(YEAR FROM event_date) BETWEEN 2022 AND 2026';
        const params = [];
        
        if (region && region !== 'all') {
            params.push(region);
            whereClause += ` AND region = $${params.length}`;
        }
        
        // Get monthly trends for prediction
        const result = await pool.query(
            `SELECT TO_CHAR(event_date, 'YYYY-MM') AS period, disaster_type, COUNT(*)::INTEGER AS count 
             FROM historical_disasters ${whereClause}
             GROUP BY period, disaster_type 
             ORDER BY period`,
            params
        );
        
        // Simple prediction: use average of last 3 months for each disaster type
        const predictions = {};
        const disasterTypes = [...new Set(result.rows.map(r => r.disaster_type))];
        
        disasterTypes.forEach(type => {
            const typeData = result.rows.filter(r => r.disaster_type === type);
            const last3 = typeData.slice(-3);
            const sum = last3.reduce((acc, item) => acc + (parseInt(item.count) || 0), 0);
            const avg = sum / (last3.length || 1);
            // Return as proper number (max 2 decimal)
            predictions[type] = Math.round(avg * 100) / 100 || 0;
        });
        
        // Get next period (next month)
        const allPeriods = [...new Set(result.rows.map(r => r.period))].sort();
        let nextPeriod = '2026-02'; // Default
        if (allPeriods.length > 0) {
            const lastPeriod = allPeriods[allPeriods.length - 1];
            const [year, month] = lastPeriod.split('-').map(Number);
            const nextMonth = month === 12 ? 1 : month + 1;
            const nextYear = month === 12 ? year + 1 : year;
            nextPeriod = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
        }
        
        res.json({ predictions, period: nextPeriod });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Map
exports.getHistoricalMapData = async (req, res) => {
    try {
        const { region, disaster_type, start_date, end_date } = req.query;
        let query = 'SELECT * FROM historical_disasters WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        
        if (region && region !== 'all') {
            params.push(region);
            query += ` AND region = $${paramIndex++}`;
        }
        if (disaster_type && disaster_type !== 'all') {
            params.push(disaster_type);
            query += ` AND disaster_type = $${paramIndex++}`;
        }
        if (start_date) {
            params.push(start_date);
            query += ` AND event_date >= $${paramIndex++}`;
        }
        if (end_date) {
            params.push(end_date);
            query += ` AND event_date <= $${paramIndex++}`;
        }
        
        query += ' ORDER BY event_date DESC LIMIT 500';
        
        const result = await pool.query(query, params);
        
        // Add coordinates based on region (since table doesn't have lat/long columns)
        const regionCoords = {
            'BANYUMAS': [-7.434, 109.251],
            'BATANG': [-6.919, 109.871],
            'BLORA': [-6.970, 111.415],
            'BOYOLALI': [-7.532, 110.593],
            'BREBES': [-6.873, 108.988],
            'CILACAP': [-7.716, 109.017],
            'DEMAK': [-6.896, 110.630],
            'GROBOGAN': [-7.100, 110.989],
            'JEPARA': [-6.588, 110.668],
            'KARANGANYAR': [-7.577, 110.938],
            'KEBUMEN': [-7.635, 109.684],
            'KLATEN': [-7.727, 110.590],
            'KUDUS': [-6.805, 110.840],
            'MAGELANG': [-7.471, 110.217],
            'PATI': [-6.765, 111.165],
            'PEKALONGAN': [-6.887, 109.668],
            'PEMALANG': [-6.817, 109.653],
            'PURBALINGGA': [-7.383, 109.381],
            'PURWOREJO': [-7.716, 109.925],
            'REMBANG': [-6.707, 111.337],
            'SALATIGA': [-7.330, 110.507],
            'SEMARANG': [-7.005, 110.438],
            'SRAGEN': [-7.416, 110.967],
            'SUKOHARJO': [-7.680, 110.783],
            'TEGAL': [-6.881, 109.125],
            'TEMANGGUNG': [-7.313, 110.167],
            'WONOGIRI': [-7.793, 110.929],
            'WONOSOBO': [-7.625, 109.883],
        };
        
        const dataWithCoords = result.rows.map(row => {
            if (row.region && regionCoords[row.region]) {
                return {
                    ...row,
                    latitude: regionCoords[row.region][0],
                    longitude: regionCoords[row.region][1]
                };
            }
            return row;
        }).filter(row => row.latitude && row.longitude);
        
        res.json(dataWithCoords);
    } catch (e) {
        console.error("Map data error:", e);
        res.status(500).json({ error: e.message });
    }
};
