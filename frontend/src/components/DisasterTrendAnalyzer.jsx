import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { parse } from 'papaparse';
import * as XLSX from 'xlsx';
import api from '../services/api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { KAB_JATENG, DISASTER_TYPES } from '../utils/constants';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

ChartJS.register(
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const getDisasterColor = (type) => {
  if (!type) return '#9ca3af'; // Default gray
  
  const t = type.toLowerCase().trim();
  
  // Banjir - Blue
  if (t.includes('banjir') && t.includes('bandang')) return '#0891b2';
  if (t.includes('banjir')) return '#2563eb';
  
  // Tanah Longsor - Red (includes 'longsor', 'tanah', 'tanah gerak')
  if (t.includes('longsor') || t.includes('tanah')) return '#dc2626';
  
  // Gempabumi - Yellow (includes 'gemp', 'gempa', 'gempa bumi')
  if (t.includes('gemp') || t.includes('gempa')) return '#ca8a04';
  
  // Kebakaran - Orange (includes 'kebakaran', 'karhutla')
  if (t.includes('kebakaran') || t.includes('karhutla')) return '#ea580c';
  
  // Angin Putting Beliung - Violet (includes 'puting', 'angin')
  if (t.includes('puting') || t.includes('angin')) return '#7c3aed';
  
  // Letusan Gunung Api - Green (includes 'gunung', 'letusan')
  if (t.includes('gunung') || t.includes('letusan')) return '#16a34a';
  
  // Kekeringan - Gray
  if (t.includes('kekeringan')) return '#4b5563';
  
  // Tsunami - Teal
  if (t.includes('tsunami')) return '#0d9488';
  
  // Cuaca Ekstrim - Pink
  if (t.includes('cuaca')) return '#e11d48';
  
  // Likuefaksi - Sky
  if (t.includes('likuefaksi')) return '#0ea5e9';
  
  return '#9ca3af'; // Default gray for Others
};

// Adjust prediction based on Central Java seasonal patterns
const adjustPredictionBySeason = (disasterType, targetMonth, originalPrediction) => {
  if (!disasterType || !targetMonth) return originalPrediction;
  
  const t = disasterType.toLowerCase().trim();
  const month = parseInt(targetMonth);
  
  // Central Java seasons:
  // Rainy: Nov (11), Dec (12), Jan (1), Feb (2), Mar (3)
  // Dry: Jun (6), Jul (7), Aug (8), Sep (9)
  // Transition: Apr (4), May (5), Oct (10)
  
  const isRainySeason = [11, 12, 1, 2, 3].includes(month);
  const isDrySeason = [6, 7, 8, 9].includes(month);
  
  let multiplier = 1.0;
  
  // Rain-related disasters: Banjir, Longsor, Tanah Gerak
  if (t.includes('banjir') || t.includes('longsor') || t.includes('tanah')) {
    if (isRainySeason) multiplier = 2.0; // Double in rainy season
    else if (isDrySeason) multiplier = 0.3; // Much lower in dry season
    else multiplier = 0.7; // Slightly lower in transition
  }
  
  // Fire-related disasters: Kebakaran, Karhutla
  if (t.includes('kebakaran') || t.includes('karhutla')) {
    if (isDrySeason) multiplier = 3.0; // Triple in dry season
    else if (isRainySeason) multiplier = 0.1; // Very low in rainy season
    else multiplier = 0.5; // Lower in transition
  }
  
  // Wind-related: Angin Putting Beliung (can happen year-round but more in transition)
  if (t.includes('puting') || t.includes('angin')) {
    if ([4, 5, 10].includes(month)) multiplier = 1.5; // Higher in transition
    else multiplier = 1.0;
  }
  
  // Drought: Kekeringan (builds up in dry season)
  if (t.includes('kekeringan')) {
    if (isDrySeason) multiplier = 2.5;
    else if (isRainySeason) multiplier = 0.1;
    else multiplier = 0.5;
  }
  
  // Earthquake, Tsunami, Likuefaksi: Not season-dependent
  if (t.includes('gemp') || t.includes('gempa') || t.includes('tsunami') || t.includes('likuefaksi')) {
    multiplier = 1.0; // No seasonal adjustment
  }
  
  return originalPrediction * multiplier;
};

const DisasterTrendAnalyzer = ({ onBack, user }) => {
  const [csvData, setCsvData] = useState([]);
  const [monthlyTrends, setMonthlyTrends] = useState([]);
  const [yearlyTrends, setYearlyTrends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [predictiveInsights, setPredictiveInsights] = useState({ // State untuk menyimpan hasil prediksi
    monthly: { predictions: {}, nextPeriod: '' }, 
    yearly: { predictions: {}, nextPeriod: '' } 
  });
  const [backendForecast, setBackendForecast] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [allHistoricalData, setAllHistoricalData] = useState([]);
  const [dataPage, setDataPage] = useState(1);
  const [totalData, setTotalData] = useState(0);
  const fileInputRef = useRef(null);
  const [selectedRegion, setSelectedRegion] = useState(() => localStorage.getItem('disasterTrendRegion') || 'all'); // Filter region
  const [selectedDisasterType, setSelectedDisasterType] = useState(() => localStorage.getItem('disasterTrendDisasterType') || 'all'); // Filter jenis bencana

  // Refs untuk menyimpan metadata prediksi yang digunakan dalam hook useMemo Chart
  const monthlyPredictionsRef = useRef({ predictions: {}, nextPeriod: '' });
  const yearlyPredictionsRef = useRef({ predictions: {}, nextPeriod: '' });

  const calculateMovingAverage = (data, windowSize) => {
    if (data.length < windowSize) return data.map(() => null);
    const movingAverages = [];
    for (let i = 0; i < data.length; i++) {
      if (i < windowSize - 1) {
        movingAverages.push(null);
      } else {
        const sum = data.slice(i - windowSize + 1, i + 1).reduce((acc, val) => acc + val, 0);
        movingAverages.push(sum / windowSize);
      }
    }
    return movingAverages;
  };

// --- FETCH TRENDS FROM BACKEND ---
  // Dipindahkan ke atas untuk memperbaiki error "Cannot access before initialization"
  const fetchTrends = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedRegion !== 'all') params.append('region', selectedRegion);
      if (selectedDisasterType !== 'all') params.append('disaster_type', selectedDisasterType);
      params.append('page', dataPage);
      params.append('limit', 50);
      params.append('include_sources', 'true'); // Include data from reports and scrapers
      
       const [mRes, yRes, fRes, allRes] = await Promise.all([
          api.get(`/historical-data/trends?period=monthly&${params.toString()}`),
          api.get(`/historical-data/trends?period=yearly&${params.toString()}`),
          api.get(`/historical-data/forecast?region=${selectedRegion}`),
          api.get(`/historical-data/data?${params.toString()}`) // Mengambil semua data historis untuk tabel
        ]);
      
      // Filter out invalid years (like 1905)
      const filterInvalidYears = (data) => {
        return (data || []).filter(item => {
          if (!item.period) return false;
          const year = parseInt(item.period.substring(0, 4));
          return year >= 2022 && year <= 2026;
        });
      };
      
      setMonthlyTrends((filterInvalidYears(mRes.data) || []).map(item => ({
        ...item,
        count: parseInt(item.count) || 0
      })));
      setYearlyTrends((filterInvalidYears(yRes.data) || []).map(item => ({
        ...item,
        count: parseInt(item.count) || 0
      })));
      setBackendForecast(fRes.data);
      setAllHistoricalData(allRes.data.data || []);
      setTotalData(allRes.data.total || 0);
    } catch (err) {
      console.error("Sync Error:", err);
      setError("Gagal memuat tren data dari sistem.");
    } finally {
      setLoading(false);
    }
  }, [selectedRegion, selectedDisasterType, dataPage]);

  // --- FILE UPLOAD HANDLER ---
  const handleFileUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setError('');

    // Helper functions for Excel date/time conversion
    const excelSerialToDate = (serial) => {
      if (serial === null || serial === undefined || serial === '') return '';
      
      // Handle Date object from Excel
      if (serial instanceof Date) {
        const y = serial.getFullYear();
        const m = String(serial.getMonth()+1).padStart(2,'0');
        const d = String(serial.getDate()).padStart(2,'0');
        return `${y}-${m}-${d}`;
      }
      
      if (typeof serial === 'string') {
        // Already YYYY-MM-DD format
        if (serial.includes('-') && serial.length >= 10) {
          return serial.substring(0,10).split('T')[0];
        }
        // Handle DD/MM/YYYY (Indonesian format) - like 11/01/2026
        if (serial.includes('/')) {
          const parts = serial.split('/');
          if (parts.length === 3 && parts[2].length === 4) {
            const day = parts[0];
            const month = parts[1];
            const year = parts[2].split(' ')[0];
            return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
          }
        }
      }
      
      // Handle Excel serial number
      const num = parseFloat(serial);
      if (isNaN(num)) return '';
      
      const excelEpoch = new Date(1899,11,30);
      const date = new Date(excelEpoch.getTime() + num * 86400000);
      const y = date.getFullYear();
      const m = String(date.getMonth()+1).padStart(2,'0');
      const d = String(date.getDate()).padStart(2,'0');
      return `${y}-${m}-${d}`;
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

    const processAndUpload = async (rawData) => {
      const formattedData = rawData.map(row => {
        // Normalisasi key (case-insensitive & trim spasi)
        const cleanRow = Object.keys(row).reduce((acc, key) => {
          acc[key.toLowerCase().trim()] = row[key];
          return acc;
        }, {});

        // Convert Excel serial date
        const tanggalRaw = cleanRow['tanggal kejadian'] || cleanRow['tanggal'] || cleanRow['date'] || cleanRow['event_date'] || '';
        const tanggal = excelSerialToDate(tanggalRaw); // Returns YYYY-MM-DD string
        
        // Convert Excel time serial
        const jamRaw = String(cleanRow['jam kejadian'] || cleanRow['jam'] || cleanRow['time'] || '');
        const jam = excelTimeSerialToStr(jamRaw) || jamRaw;

        // ... other code ...

        // Combine date and time (format: YYYY-MM-DD HH:MM:SS)
        // Pastikan tanggal bersih tanpa timezone - hanya ambil YYYY-MM-DD
        const cleanDate = tanggal.toString().substring(0, 10); // Ambil hanya YYYY-MM-DD
        let event_date = cleanDate;
        if (jam && jam.trim() !== '') {
          const timeFormatted = jam.includes(':') ? jam.substring(0, 5) : `${jam}:00`;
          event_date = `${cleanDate}T${timeFormatted}:00`; // ISO format tanpa timezone
        }

        return {
          region,
          disaster_type: cleanRow['jenis bencana'] || cleanRow['jenis kejadian'] || cleanRow['disaster_type'] || 'Lainnya',
          event_date,
          time: jam,
          latitude: lat,
          longitude: lng,
        };
      }).filter(row => row.region && row.disaster_type && row.event_date);

      if (formattedData.length === 0) {
        setError("Data tidak valid. Gunakan kolom: Kab / Kota, Jenis Bencana, Tanggal, Jam");
        setLoading(false);
        return;
      }

       try {
         const response = await api.post('historical-data/upload', { data: formattedData });
         setCsvData(formattedData); // Trigger re-fetch trends
         fetchTrends(); // Refresh data grafik dan tabel
         alert(`Berhasil! ${response.data.totalProcessed || formattedData.length} data diupload.${response.data.skipped > 0 ? ` (${response.data.skipped} dilewati)` : ''}`);
       } catch (err) {
         setError(`Gagal upload: ${err.response?.data?.error || err.message}`);
       } finally {
         setLoading(false);
       }
    };

       if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
       const reader = new FileReader();
       reader.onload = (e) => {
         try {
           const data = new Uint8Array(e.target.result);
           const workbook = XLSX.read(data, { type: 'array' }); // Remove cellDates
           const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
          
          if (jsonData.length > 5000) {
            if (!window.confirm(`File berisi ${jsonData.length} baris data. Upload akan diproses dalam batch. Lanjutkan?`)) {
              setLoading(false);
              return;
            }
          }
          
          processAndUpload(jsonData);
        } catch (err) {
          setError("Gagal membaca file Excel. Pastikan format file benar.");
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processAndUpload(results.data),
        error: (err) => { setError(err.message); setLoading(false); }
      });
    }
  }, [fetchTrends]);

  const handleDelete = async (id) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus data ini secara permanen?")) return;
    
    setLoading(true);
    try {
      await api.delete(`/historical-data/${id}`);
      alert("Data berhasil dihapus dari sistem.");
      fetchTrends(); // Refresh data grafik dan tabel
    } catch (err) {
      alert("Gagal menghapus data: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // --- EFFECT HOOKS ---
  useEffect(() => { localStorage.setItem('disasterTrendRegion', selectedRegion); }, [selectedRegion]);
  useEffect(() => { localStorage.setItem('disasterTrendDisasterType', selectedDisasterType); }, [selectedDisasterType]);
  useEffect(() => { setDataPage(1); }, [selectedRegion, selectedDisasterType]); // Reset page when filters change
  useEffect(() => { fetchTrends(); }, [fetchTrends, csvData]); // Re-fetch when filters or CSV data changes

// --- PREDICTIVE INSIGHTS (Use Backend Forecast) ---
  useEffect(() => {
    if (backendForecast && backendForecast.predictions) {
      setPredictiveInsights(prev => ({
        ...prev,
        monthly: { 
          predictions: backendForecast.predictions, 
          nextPeriod: backendForecast.period || 'Bulan Depan' 
        }
      }));
      monthlyPredictionsRef.current = { 
        predictions: backendForecast.predictions, 
        nextPeriod: backendForecast.period || 'Bulan Depan' 
      };
    }
  }, [backendForecast]);

  // --- EXPORT TO CSV ---
  const exportToCsv = useCallback((data, filename, additionalInfo = {}) => {
    if (!data || data.length === 0) return alert('Tidak ada data.');
    setExporting(true);
    try {
      const now = new Date();
      const downloadTime = now.toLocaleString('id-ID', { 
        dateStyle: 'full', 
        timeStyle: 'long',
        timeZone: 'Asia/Jakarta'
      });
      
      const regionText = selectedRegion === 'all' ? 'Semua Wilayah' : selectedRegion;
      const disasterText = selectedDisasterType === 'all' ? 'Semua Jenis Bencana' : selectedDisasterType;
      
      // Metadata rows
      const metadata = [
        ['Sumber Data', 'PUSDATIN - Sistem Analisis Trend Bencana Jawa Tengah'],
        ['Waktu Unduh', downloadTime],
        ['Wilayah', regionText],
        ['Jenis Bencana', disasterText],
        ['Total Data', data.length],
        ...(additionalInfo.notes ? [['Keterangan', additionalInfo.notes]] : []),
        [], // Empty row as separator
        ['DATA:']
      ];
      
      const headers = Object.keys(data[0]);
      const csvRows = [
        ...metadata.map(row => row.map(cell => `"${cell}"`).join(',')),
        headers.map(header => `"${header}"`).join(','),
        ...data.map(row => headers.map(header => `"${String(row[header] || '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', filename);
      link.click();
    } catch (e) {
      alert("Gagal ekspor.");
    } finally {
      setExporting(false);
    }
  }, [selectedRegion, selectedDisasterType]);

  // Export Monthly Predictions with seasonal adjustment
  const exportMonthlyPredictions = useCallback(() => {
    const now = new Date();
    const nextMonth = now.getMonth() + 2;
    const targetMonth = nextMonth > 12 ? 1 : nextMonth;
    
    const data = Array.from(new Set(monthlyTrends.map(item => item.disaster_type))).map(type => {
      const originalCount = parseFloat(predictiveInsights.monthly.predictions[type]) || 0;
      const adjustedCount = adjustPredictionBySeason(type, targetMonth, originalCount);
      
      let riskLevel = 'Rendah';
      if (adjustedCount > 5) riskLevel = 'Tinggi';
      else if (adjustedCount > 2) riskLevel = 'Sedang';
      
      return {
        'Jenis Bencana': type,
        'Prediksi Awal': originalCount.toFixed(2),
        'Prediksi Disesuaikan Musim': adjustedCount.toFixed(2),
        'Tingkat Risiko': riskLevel,
        'Bulan Target': `Bulan ${targetMonth}`,
        'Keterangan': `Disesuaikan musim Jawa Tengah (${targetMonth >= 11 || targetMonth <= 3 ? 'Hujan' : targetMonth >= 6 && targetMonth <= 9 ? 'Kemarau' : 'Transisi'})`
      };
    });
    
    exportToCsv(data, `probabilitas_bulanan_${now.toISOString().slice(0,10)}.csv`, {
      notes: `Probabilitas Ancaman Bulanan - Prediksi bulan depan (Bulan ${targetMonth}) disesuaikan dengan pola musim Jawa Tengah`
    });
  }, [monthlyTrends, predictiveInsights, exportToCsv]);

  // Export to PDF
  const exportToPdf = useCallback((data, title, columns, additionalInfo = {}) => {
    if (!data || data.length === 0) return alert('Tidak ada data.');
    setExporting(true);
    try {
      const doc = new jsPDF();
      const now = new Date();
      const downloadTime = now.toLocaleString('id-ID', { 
        dateStyle: 'full', 
        timeStyle: 'long',
        timeZone: 'Asia/Jakarta'
      });
      
      const regionText = selectedRegion === 'all' ? 'Semua Wilayah' : selectedRegion;
      const disasterText = selectedDisasterType === 'all' ? 'Semua Jenis Bencana' : selectedDisasterType;
      
      // Header
      doc.setFontSize(16);
      doc.text('PUSDATIN - Sistem Analisis Trend Bencana Jawa Tengah', 14, 20);
      
      doc.setFontSize(10);
      doc.text(`Sumber Data: PUSDATIN - Sistem Analisis Trend Bencana Jawa Tengah`, 14, 30);
      doc.text(`Waktu Unduh: ${downloadTime}`, 14, 36);
      doc.text(`Wilayah: ${regionText}`, 14, 42);
      doc.text(`Jenis Bencana: ${disasterText}`, 14, 48);
      doc.text(`Total Data: ${data.length}`, 14, 54);
      
      if (additionalInfo.notes) {
        doc.text(`Keterangan: ${additionalInfo.notes}`, 14, 60);
      }
      
      // Table
      const tableData = data.map(row => columns.map(col => String(row[col] || '')));
      const headers = columns.map(col => col);
      
      doc.autoTable({
        head: [headers],
        body: tableData,
        startY: additionalInfo.notes ? 66 : 60,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 100, 50] } // Green header
      });
      
      doc.save(`${title}_${now.toISOString().slice(0,10)}.pdf`);
    } catch (e) {
      alert("Gagal ekspor PDF.");
    } finally {
      setExporting(false);
    }
  }, [selectedRegion, selectedDisasterType]);

  // --- CHART DATA PREPARATION ---
  const monthlyChartData = useMemo(() => {
    const uniquePeriods = [...new Set(monthlyTrends.map(item => item.period))].sort();
    const uniqueDisasterTypes = [...new Set(monthlyTrends.map(item => item.disaster_type))];
    const datasets = [];

    uniqueDisasterTypes.forEach(type => {
      const dataForType = monthlyTrends.filter(item => item.disaster_type === type);
      const counts = uniquePeriods.map(period => dataForType.find(d => d.period === period)?.count || 0);
      
      datasets.push({
        label: `${type} (Kejadian)`,
        data: counts,
        borderColor: getDisasterColor(type),
        backgroundColor: getDisasterColor(type) + '40', // Semi-transparent fill
        tension: 0.3,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 5,
      });
    });
    return { labels: uniquePeriods, datasets };
  }, [monthlyTrends, getDisasterColor]);

  const yearlyChartData = useMemo(() => {
    const uniquePeriods = [...new Set(yearlyTrends.map(item => item.period))].sort();
    const uniqueDisasterTypes = [...new Set(yearlyTrends.map(item => item.disaster_type))];
    const datasets = [];

    uniqueDisasterTypes.forEach(type => {
      const dataForType = yearlyTrends.filter(item => item.disaster_type === type);
      const counts = uniquePeriods.map(period => dataForType.find(d => d.period === period)?.count || 0);

      datasets.push({
        label: `${type} (Kejadian)`,
        data: counts,
        backgroundColor: getDisasterColor(type),
        borderRadius: 8,
      });

      // Moving Average (e.g., 2-year moving average)
      const countsOnly = uniquePeriods.map(period => dataForType.find(d => d.period === period)?.count || 0);
      const movingAverageData = calculateMovingAverage(countsOnly, 2);
      if (movingAverageData.some(val => val !== null)) {
        datasets.push({
          label: `${type} (MA 2 Tahun)`,
          data: movingAverageData,
          borderColor: getDisasterColor(type) + '80',
          borderDash: [5, 5], // Dashed line for average
          backgroundColor: 'transparent',
          type: 'line', // Force line type for average on bar chart
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0,
        });
      }

      // Simple average line for this disaster type
      const totalCount = countsOnly.reduce((sum, val) => sum + val, 0);
      const average = countsOnly.length > 0 ? totalCount / countsOnly.length : 0;
      if (average > 0) {
        datasets.push({
          label: `${type} (Rata-rata Historis)`,
          data: uniquePeriods.map(() => average),
          borderColor: getDisasterColor(type) + '30',
          borderDash: [2, 2],
          backgroundColor: 'transparent',
          type: 'line',
          tension: 0,
        });
      }
    });

    return { labels: uniquePeriods, datasets };
  }, [yearlyTrends, calculateMovingAverage, getDisasterColor]);



  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
    },
    scales: { // Default scales for Line/Bar, can be overridden
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Jumlah Kejadian'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Periode'
        }
      }
    }
  };

  return (
    <div className="p-4 md:p-10 space-y-8 animate-in fade-in duration-500 font-sans">
      <div className="flex justify-between items-center border-b-2 border-slate-100 pb-6">
        <h2 className="text-2xl md:text-3xl font-black text-[#006432] uppercase italic tracking-tighter">
          Disaster Trend Analyzer
        </h2>
        {onBack && (
          <button onClick={onBack} className="text-[10px] font-bold text-slate-400 uppercase hover:underline">
            â† Kembali
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-[10px] font-black uppercase tracking-widest animate-pulse">
          âš ï¸ {error}
        </div>
      )}

      {/* Upload Section */}
      {['ADMIN_PWNU', 'SUPER_ADMIN', 'STAFF_PWNU'].includes(user?.role?.toUpperCase()) && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-50 space-y-6">
          <h3 className="text-lg font-black text-slate-800 uppercase italic">Upload Data Historis</h3>
          <p className="text-sm text-slate-500">
            Format: <code className="bg-slate-100 p-1 rounded">Kab / Kota, Jenis Bencana, Tanggal Kejadian, Jam Kejadian</code>
            <br />
            Contoh: <code className="bg-slate-100 p-1 rounded">Kudus, Longsor, 11/01/2026, 13:30</code>
          </p>
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <input
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileUpload}
              ref={fileInputRef}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#006432] file:text-white hover:file:bg-green-700"
            />
            <button 
              onClick={downloadTemplate}
              className="shrink-0 bg-slate-100 text-[#006432] px-6 py-2.5 rounded-full font-black text-[10px] shadow-sm hover:bg-slate-200 transition-all uppercase flex items-center gap-2 border border-slate-200"
            >
              <i className="fas fa-download"></i> Unduh Template
            </button>
          </div>
          {loading && <p className="text-blue-500">Processing CSV and uploading...</p>}
          {error && <p className="text-red-500">{error}</p>}
        </div>
      )}

      {/* New Filter Section */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 space-y-4">
        <h3 className="text-lg font-black text-slate-800 uppercase italic">Filter Tren</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Kota/Kabupaten</label>
            <select
              value={selectedRegion}
              onChange={(e) => {
                setSelectedRegion(e.target.value);
                localStorage.setItem('disasterTrendRegion', e.target.value);
              }}
              className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold shadow-inner border-none outline-none focus:ring-2 ring-nu-green"
            >
              <option value="all">Semua Wilayah</option>
              {KAB_JATENG.map((region) => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Jenis Bencana</label>
            <select
              value={selectedDisasterType}
              onChange={(e) => {
                setSelectedDisasterType(e.target.value);
                localStorage.setItem('disasterTrendDisasterType', e.target.value);
              }}
              className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold shadow-inner border-none outline-none focus:ring-2 ring-nu-green"
            >
              <option value="all">Semua Jenis</option>
              {DISASTER_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedRegion('all');
                setSelectedDisasterType('all');
                localStorage.removeItem('disasterTrendRegion');
                localStorage.removeItem('disasterTrendDisasterType');
              }}
              className="w-full p-4 bg-slate-100 hover:bg-slate-200 rounded-2xl text-xs font-bold text-slate-600 uppercase transition-all"
            >
              Reset Filter
            </button>
          </div>
        </div>
      </div>
      
      {/* All Historical Data Table */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-50 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-800 uppercase italic">Data Historis Tersimpan</h3>
          <span className="text-sm text-slate-500">Total: {totalData} data</span>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-full divide-y divide-slate-200">
             <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Kota/Kabupaten</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Jenis Bencana</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tanggal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Jam</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Sumber</th>
                {user?.role?.toUpperCase() === 'SUPER_ADMIN' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider text-center">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {allHistoricalData.map((item, index) => (
                <tr key={item.id || index} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    {((dataPage - 1) * 50) + index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-medium">{item.region}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className="px-2 py-1 rounded-full text-xs font-bold"
                      style={{
                        backgroundColor: getDisasterColor(item.disaster_type) + '20',
                        color: getDisasterColor(item.disaster_type)
                      }}
                    >
                      {item.disaster_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {item.event_date ? new Date(item.event_date).toLocaleDateString('id-ID') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {item.event_date ? new Date(item.event_date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      item.source === 'report' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {item.source === 'report' ? 'Laporan Masyarakat' : 'Data Historis'}
                    </span>
                  </td>
                  {user?.role?.toUpperCase() === 'SUPER_ADMIN' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-all"
                        title="Hapus Data"
                      >
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {allHistoricalData.length === 0 && (
                <tr>
                  <td colSpan={user?.role?.toUpperCase() === 'SUPER_ADMIN' ? "7" : "6"} className="px-6 py-8 text-center text-sm text-slate-400">
                    Belum ada data historis. Silakan upload file CSV/Excel.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalData > 50 && (
          <div className="flex items-center justify-between pt-4">
            <button
              onClick={() => setDataPage(p => Math.max(1, p - 1))}
              disabled={dataPage === 1}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50"
            >
              ← Sebelumnya
            </button>
            <span className="text-sm text-slate-600">
              Halaman {dataPage} dari {Math.ceil(totalData / 50)}
            </span>
            <button
              onClick={() => setDataPage(p => p + 1)}
              disabled={dataPage >= Math.ceil(totalData / 50)}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50"
            >
              Selanjutnya →
            </button>
          </div>
        )}

        <div className="flex justify-end mt-4 gap-2">
          <button 
            onClick={() => exportToCsv(allHistoricalData.slice(0, 1000), 'data_historis.csv')} 
            disabled={exporting} 
            className="bg-[#006432] text-white px-4 py-2 rounded-lg text-sm font-black uppercase shadow-md hover:bg-green-700 transition-all"
          >
            {exporting ? 'Mengekspor...' : 'Export CSV'}
          </button>
          <button 
            onClick={() => exportToPdf(
              allHistoricalData.slice(0, 1000).map(item => ({
                'No': ((dataPage - 1) * 50) + allHistoricalData.indexOf(item) + 1,
                'Wilayah': item.region,
                'Jenis Bencana': item.disaster_type,
                'Tanggal': item.event_date ? new Date(item.event_date).toLocaleDateString('id-ID') : '-',
                'Jam': item.event_date ? new Date(item.event_date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'
              })), 
              'data_historis', 
              ['No', 'Wilayah', 'Jenis Bencana', 'Tanggal', 'Jam'],
              { notes: 'Data Historis Tersimpan - PUSDATIN' }
            )} 
            disabled={exporting} 
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-black uppercase shadow-md hover:bg-red-700 transition-all"
          >
            {exporting ? 'Mengekspor...' : 'Export PDF'}
          </button>
        </div>
      </div>
      
      {/* Monthly Chart Section */}
      {monthlyTrends.length > 0 && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-50 space-y-6">
          <h3 className="text-lg font-black text-slate-800 uppercase italic">Tren Bencana Bulanan</h3>
          <div className="h-72 w-full">
            <Line data={monthlyChartData} options={{...chartOptions, scales: { y: { beginAtZero: true }, x: { title: { display: true, text: 'Bulan' }}} }} />
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={() => exportToCsv(monthlyTrends, 'monthly_disaster_trends.csv')} disabled={exporting} className="bg-[#006432] text-white px-4 py-2 rounded-lg text-sm font-black uppercase shadow-md hover:bg-green-700 transition-all">
              {exporting ? 'Mengekspor...' : 'Export Monthly Data'}
            </button>
          </div>
        </div>
      )}

      {/* Probabilitas Ancaman Tahunan - Combined Card */}
      {yearlyTrends.length > 0 && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-50 space-y-6">
          <h3 className="text-lg font-black text-slate-800 uppercase italic">Probabilitas Ancaman Tahunan</h3>
          <p className="text-sm text-slate-500">Berdasarkan Tren Data Kejadian 2022-2026 (tahun ini akan berubah berdasarkan data kejadian yang diunggah)</p>
          
          {/* Yearly Chart */}
          <div className="h-72 w-full">
            <Bar data={yearlyChartData} options={{...chartOptions, scales: { y: { beginAtZero: true }, x: { title: { display: true, text: 'Tahun' }}} }} />
          </div>
          
          {/* Predictive Insights Table */}
          {(Object.keys(predictiveInsights.yearly.predictions).length > 0) && (
            <div className="mt-6 border-t pt-6">
              <h4 className="text-md font-black text-slate-700 uppercase mb-4">Potensi Ancaman</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Kejadian</th>
                      {yearlyTrends.length > 0 && [...new Set(yearlyTrends.map(item => item.period))].sort().map(year => (
                        <th key={year} className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">{year}</th>
                      ))}
                      <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">Potensi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(predictiveInsights.yearly.predictions).map(([type, count]) => {
                      const numCount = parseFloat(count) || 0;
                      let riskLevel = 'Rendah';
                      let riskColor = 'bg-green-100 text-green-800';
                      if (numCount > 50) { riskLevel = 'Tinggi'; riskColor = 'bg-red-100 text-red-800'; }
                      else if (numCount > 20) { riskLevel = 'Sedang'; riskColor = 'bg-yellow-100 text-yellow-800'; }
                      
                      return (
                        <tr key={type} className="border-t">
                          <td className="px-4 py-3">
                            <span className="font-semibold" style={{ color: getDisasterColor(type) }}>{type}</span>
                          </td>
                          {yearlyTrends.length > 0 && [...new Set(yearlyTrends.map(item => item.period))].sort().map(year => {
                            const yearData = yearlyTrends.find(item => item.disaster_type === type && item.period === year);
                            return (
                              <td key={year} className="px-4 py-3 text-center text-sm font-medium">
                                {yearData ? yearData.count : '-'}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${riskColor}`}>
                              {riskLevel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          <div className="flex justify-end mt-4 gap-2">
            <button onClick={() => exportToCsv(yearlyTrends, 'yearly_disaster_trends.csv')} disabled={exporting} className="bg-[#006432] text-white px-4 py-2 rounded-lg text-sm font-black uppercase shadow-md hover:bg-green-700 transition-all">
              {exporting ? 'Mengekspor...' : 'Export CSV'}
            </button>
            <button onClick={() => exportToPdf(yearlyTrends, 'yearly_disaster_trends', ['disaster_type', 'period', 'count'], {
              notes: 'Probabilitas Ancaman Tahunan - Data tren tahunan 2022-2026'
            })} disabled={exporting} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-black uppercase shadow-md hover:bg-red-700 transition-all">
              {exporting ? 'Mengekspor...' : 'Export PDF'}
            </button>
          </div>
        </div>
      )}



      {/* Probabilitas Ancaman Bulanan */}
      {monthlyTrends.length > 0 && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-50 space-y-6 mt-8">
          <h3 className="text-lg font-black text-slate-800 uppercase italic">Probabilitas Ancaman Bulanan</h3>
          <p className="text-sm text-slate-500">Berdasarkan Tren Data Kejadian 2022-2026, disesuaikan dengan musim Jawa Tengah (Hujan: Nov-Mar, Kemarau: Jun-Sep)</p>
          
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Kejadian</th>
                  {Array.from(new Set(monthlyTrends.map(item => item.period.split('-')[0]))).sort().map(year => (
                    <th key={year} className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">{year}</th>
                  ))}
                  <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">Potensi Bulan Depan</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(new Set(monthlyTrends.map(item => item.disaster_type))).map(type => {
                  // Get next month from prediction period
                  let nextMonth = new Date().getMonth() + 2;
                  if (nextMonth > 12) nextMonth = 1;
                  if (predictiveInsights.monthly.nextPeriod) {
                    const parts = predictiveInsights.monthly.nextPeriod.split('-');
                    if (parts.length === 2) nextMonth = parseInt(parts[1]);
                  }
                  
                  const originalCount = parseFloat(predictiveInsights.monthly.predictions[type]) || 0;
                  const adjustedCount = adjustPredictionBySeason(type, nextMonth, originalCount);
                  
                  let riskLevel = 'Rendah';
                  let riskColor = 'bg-green-100 text-green-800';
                  if (adjustedCount > 5) { riskLevel = 'Tinggi'; riskColor = 'bg-red-100 text-red-800'; }
                  else if (adjustedCount > 2) { riskLevel = 'Sedang'; riskColor = 'bg-yellow-100 text-yellow-800'; }
  
                  return (
                    <tr key={type} className="border-t">
                      <td className="px-4 py-3">
                        <span className="font-semibold" style={{ color: getDisasterColor(type) }}>{type}</span>
                      </td>
                      {Array.from(new Set(monthlyTrends.map(item => item.period.split('-')[0]))).sort().map(year => {
                        // Sum all months in this year for this disaster type
                        const yearData = monthlyTrends.filter(item => 
                          item.disaster_type === type && item.period.startsWith(year)
                        );
                        const total = yearData.reduce((sum, item) => sum + (item.count || 0), 0);
                        return (
                          <td key={year} className="px-4 py-3 text-center text-sm font-medium">
                            {total > 0 ? total : '-'}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${riskColor}`}>
                          {riskLevel}
                        </span>
                        <div className="text-[9px] text-slate-400 mt-1">
                          {originalCount.toFixed(1)} → {adjustedCount.toFixed(1)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="text-[9px] text-slate-400 italic space-y-1">
            <p>*Prediksi bulan depan disesuaikan dengan musim: Karhutla tinggi di kemarau, Banjir/Longsor tinggi di hujan</p>
            <p>*Angka: Prediksi awal → Setelah disesuaikan musim</p>
          </div>
          
          <div className="flex justify-end mt-4 gap-2">
            <button 
              onClick={exportMonthlyPredictions} 
              disabled={exporting} 
              className="bg-[#006432] text-white px-4 py-2 rounded-lg text-sm font-black uppercase shadow-md hover:bg-green-700 transition-all"
            >
              {exporting ? 'Mengekspor...' : 'Export CSV'}
            </button>
            <button 
              onClick={() => {
                const now = new Date();
                const nextMonth = now.getMonth() + 2;
                const targetMonth = nextMonth > 12 ? 1 : nextMonth;
                const data = Array.from(new Set(monthlyTrends.map(item => item.disaster_type))).map(type => {
                  const originalCount = parseFloat(predictiveInsights.monthly.predictions[type]) || 0;
                  const adjustedCount = adjustPredictionBySeason(type, targetMonth, originalCount);
                  let riskLevel = 'Rendah';
                  if (adjustedCount > 5) riskLevel = 'Tinggi';
                  else if (adjustedCount > 2) riskLevel = 'Sedang';
                  return {
                    'Jenis Bencana': type,
                    'Prediksi Awal': originalCount.toFixed(2),
                    'Prediksi Disesuaikan Musim': adjustedCount.toFixed(2),
                    'Tingkat Risiko': riskLevel,
                    'Bulan Target': `Bulan ${targetMonth}`
                  };
                });
                exportToPdf(data, 'probabilitas_bulanan', ['Jenis Bencana', 'Prediksi Awal', 'Prediksi Disesuaikan Musim', 'Tingkat Risiko', 'Bulan Target'], {
                  notes: `Probabilitas Ancaman Bulanan - Prediksi bulan depan (Bulan ${targetMonth}) disesuaikan dengan pola musim Jawa Tengah`
                });
              }}
              disabled={exporting} 
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-black uppercase shadow-md hover:bg-red-700 transition-all"
            >
              {exporting ? 'Mengekspor...' : 'Export PDF'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

const downloadTemplate = () => {
  const data = [
    {
      'Kota/Kabupaten': 'Kudus',
      'Jenis Bencana': 'Longsor',
      'Tanggal Kejadian': '11/01/2026',
      'Jam Kejadian': '13:30'
    }
  ];
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
  XLSX.writeFile(workbook, "Format_Data_Historis_Pusdatin.xlsx");
};

export default DisasterTrendAnalyzer;
