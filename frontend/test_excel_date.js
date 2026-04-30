const XLSX = require('xlsx');

// Create test Excel with Excel serial date (46033 = Dec 30, 1899 + 46033 days ≈ 2026-01-15)
// and time serial (0.5625 = 13.5 hours = 13:30:00)
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([
  ['kota/kabupaten', 'jenis bencana', 'tanggal kejadian', 'jam kejadian'],
  ['Semarang', 'Banjir', 46033, 0.5625]
]);
XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
XLSX.writeFile(wb, 'test_upload.xlsx');
console.log('Test Excel created: test_upload.xlsx');
