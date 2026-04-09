import axios from "axios";
import { Preferences } from '@capacitor/preferences';

const api = axios.create({
  // URL Backend Online Anda
  baseURL: "https://nupeduli-pusdatin-nu-backend.hf.space", 
  headers: {
    "Content-Type": "application/json",
  }
});

// --- ENGINE PINTAR: ATTACH TOKEN OTOMATIS ---
// Setiap kali aplikasi memanggil data (incidents, news, dll), 
// fungsi ini akan otomatis mengambil token dari memori HP dan mengirimnya ke server.
api.interceptors.request.use(
  async (config) => {
    try {
      const { value } = await Preferences.get({ key: 'userToken' });
      if (value) {
        config.headers.Authorization = `Bearer ${value}`;
      }
    } catch (e) {
      // Jika di web browser standar, gunakan localStorage sebagai cadangan
      const token = localStorage.getItem('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;