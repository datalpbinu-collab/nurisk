export const getIncidentConfig = (type) => {
  const map = {
    'Banjir': { icon: 'fa-house-flood-water', color: '#3b82f6', label: 'BAN' },
    'Tanah Longsor': { icon: 'fa-hill-rockslide', color: '#92400e', label: 'LON' },
    'Kebakaran': { icon: 'fa-fire', color: '#ef4444', label: 'KEB' },
    'Angin Kencang': { icon: 'fa-wind', color: '#0d9488', label: 'ANG' },
    'Gempa Bumi': { icon: 'fa-house-crack', color: '#d97706', label: 'GEM' },
    'Erupsi': { icon: 'fa-volcano', color: '#450a0a', label: 'ERU' },
    'Kekeringan': { icon: 'fa-sun-dust', color: '#eab308', label: 'KEK' },
    'Kecelakaan / SAR': { icon: 'fa-truck-medical', color: '#7c3aed', label: 'SAR' },
  };

  return map[type] || { icon: 'fa-circle-exclamation', color: '#64748b', label: 'ETC' };
};