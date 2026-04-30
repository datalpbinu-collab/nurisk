// Test Excel date conversion logic
const excelSerialToDate = (serial) => {
  if (serial === null || serial === undefined || serial === '') return '';
  const num = parseFloat(serial);
  if (isNaN(num)) return serial;
  const excelEpoch = new Date(1899, 11, 30);
  const date = new Date(excelEpoch.getTime() + num * 86400000);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
};

const excelTimeSerialToStr = (val) => {
  if (!val) return '';
  const num = parseFloat(val);
  if (isNaN(num) || num >= 1) return val;
  const totalSeconds = Math.round(num * 86400);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
};

// Test cases
console.log('Test 1 - Excel date serial 46033:');
console.log('  Result:', excelSerialToDate(46033));
console.log('  Expected: ~2026-01-15 (depends on Excel epoch)');

console.log('\nTest 2 - Excel time serial 0.5625:');
console.log('  Result:', excelTimeSerialToStr(0.5625));
console.log('  Expected: 13:30:00');

console.log('\nTest 3 - Regular date string:');
console.log('  Result:', excelSerialToDate('2026-01-15'));
console.log('  Expected: 2026-01-15');

console.log('\nTest 4 - Regular time string:');
console.log('  Result:', excelTimeSerialToStr('13:30'));
console.log('  Expected: 13:30');
