export const KAB_JATENG = [
  "Semarang", "Demak", "Kudus", "Pati", "Jepara", "Rembang", "Blora", "Grobogan",
  "Boyolali", "Solo", "Sukoharjo", "Wonogiri", "Karanganyar", "Sragen", "Klaten",
  "Magelang", "Temanggung", "Wonosobo", "Purworejo", "Kebumen", "Cilacap",
  "Banyumas", "Purbalingga", "Banjarnegara", "Batang", "Pekalongan", "Pemalang",
  "Tegal", "Brebes", "Kendal", "Salatiga"
];

export const DISASTER_TYPES = [
  "Banjir",
  "Banjir Bandang",
  "Cuaca Ekstrim",
  "Gelombang Ekstrim dan Abrasi",
  "Gempabumi",
  "Kebakaran Hutan dan Lahan",
  "Kekeringan",
  "Letusan Gunung Api",
  "Tanah Longsor",
  "Tsunami",
  "Likuefaksi"
];

export const normalizeStatus = (status) => (status || 'REPORTED').toUpperCase();
export const NEED_CATEGORIES = [
  { id: 'sembako', label: 'Sembako', unit: 'Paket' },
  { id: 'selimut', label: 'Selimut/Tikar', unit: 'Pcs' },
  { id: 'medis', label: 'Obat-obatan', unit: 'Paket' },
  { id: 'bayi', label: 'Susu & Popok', unit: 'Paket' },
  { id: 'air', label: 'Air Bersih', unit: 'Tangki' },
];