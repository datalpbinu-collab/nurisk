import * as XLSX from 'xlsx';

// Create test Excel with Excel serial date (46033) and time (0.5625)
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([
  ['kota/kabupaten', 'jenis bencana', 'tanggal kejadian', 'jam kejadian'],
  ['Semarang', 'Banjir', 46033, 0.5625]
]);
XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
XLSX.writeFile(wb, 'test_upload.xlsx');
console.log('Test Excel created: test_upload.xlsx');

// Now read it back to simulate frontend parsing
const wb2 = XLSX.readFile('test_upload.xlsx');
const data = XLSX.utils.sheet_to_json(wb2.Sheets['Sheet1']);
console.log('Parsed data:', JSON.stringify(data, null, 2));
