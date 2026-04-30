const fs = require('fs');
const path = require('path');
const pool = require('../src/config/database');
require('dotenv').config();

/**
 * PUSDATIN NU PEDULI - SEEDER DATA HISTORIS
 * -----------------------------------------------------------
 * Script ini mengimpor data dari file CSV ke database PostgreSQL.
 * Format CSV yang diharapkan:
 * region,disaster_type,event_date,latitude,longitude
 */

async function importData() {
    // Path ke file CSV (letakkan di root folder backend)
    const filePath = path.join(__dirname, '../data_historis.csv');

    if (!fs.existsSync(filePath)) {
        console.error('❌ File data_historis.csv tidak ditemukan di root backend.');
        process.exit(1);
    }

    console.log('[SYSTEM] Membaca file CSV...');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Parsing Header (Asumsi baris pertama adalah header)
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const dataLines = lines.slice(1);

    console.log(`[SYSTEM] Menemukan ${dataLines.length} baris data. Melakukan migrasi...`);

    let successCount = 0;
    let errorCount = 0;

    for (const line of dataLines) {
        const values = line.split(',').map(v => v.trim());
        const record = {};
        headers.forEach((header, index) => {
            record[header] = values[index];
        });

        try {
            await pool.query(
                `INSERT INTO historical_disasters (region, disaster_type, event_date, latitude, longitude)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    record.region, 
                    record.disaster_type, 
                    record.event_date, 
                    record.latitude ? parseFloat(record.latitude) : null, 
                    record.longitude ? parseFloat(record.longitude) : null
                ]
            );
            successCount++;
        } catch (err) {
            console.error(`[ERROR] Gagal pada baris: ${line} -> ${err.message}`);
            errorCount++;
        }
    }

    console.log(`\n✅ PROSES SELESAI\nBerhasil: ${successCount}\nGagal: ${errorCount}`);
    await pool.end(); // Tutup koneksi agar script selesai
    process.exit(0);
}

importData().catch(err => {
    console.error('FATAL ERROR:', err);
    process.exit(1);
});