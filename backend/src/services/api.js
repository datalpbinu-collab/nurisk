import axios from 'axios';
import { Preferences } from '@capacitor/preferences';

const isLocal = window.location.hostname === 'localhost';
const BASE_URL = isLocal 
  ? 'http://localhost:7860' 
  : 'https://nupeduli-pusdatin-nu-backend.hf.space';

const api = axios.create({
  baseURL: `${BASE_URL}/api`, // Rute tunggal /api
  headers: { 'Content-Type': 'application/json' }
});

// Interceptor untuk menempelkan Token otomatis jika sudah login
api.interceptors.request.use(async (config) => {
  const saved = await Preferences.get({ key: 'userData' });
  if (saved.value) {
    const user = JSON.parse(saved.value);
    if (user.token) config.headers.Authorization = `Bearer ${user.token}`;
  }
  return config;
});

export default api;