import axios from 'axios';

const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    console.log('[API] Using VITE_API_URL:', import.meta.env.VITE_API_URL);
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && window.Capacitor) {
    // For Capacitor apps, use the actual host
    const host = window.location.hostname;
    const port = window.location.port || 7860;
    const url = `http://${host}:${port}/api/`;
    console.log('[API] Using Capacitor URL:', url);
    return url;
  }
  const url = 'http://localhost:7860/api/';
  console.log('[API] Using default URL:', url);
  return url;
};

const baseURL = getBaseURL();
console.log('[API] Base URL:', baseURL);

const api = axios.create({
  baseURL: baseURL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 300000 // 5 minutes for large file uploads
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || localStorage.getItem('pusdatin_token');
    console.log('[API Request]', config.method?.toUpperCase(), config.url, 'token:', token ? 'yes' : 'no');
    if (token && token !== 'undefined' && token !== 'null') {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    console.log('[API Response]', response.status, response.config?.url);
    return response;
  },
  (error) => {
    console.error('[API Error]', error.code, error.message, error.response?.status, error.config?.url);
    // Ignore 401 for public endpoints (only exact public GET endpoints)
    const publicEndpoints = ['/chat', '/incidents', '/reports', '/historical-data/map'];
    const url = error.config?.url || '';
    const isPublicEndpoint = publicEndpoints.some(ep => {
      // Match exact endpoint or endpoint at start, not subpaths like /incidents/6/assessment
      return url === ep || url.startsWith(ep + '?') || (ep === '/incidents' && url === '/incidents');
    });
    
    if (error.response?.status === 401 && isPublicEndpoint) {
      console.log('[API] Public endpoint 401, returning empty data');
      return Promise.resolve({ data: [] });
    }
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register') {
        localStorage.removeItem('pusdatin_logged_in');
        localStorage.removeItem('pusdatin_user');
        localStorage.removeItem('token');
        console.log('[API] 401 on protected route, clearing auth');
      }
    }
    return Promise.reject(error);
  }
);

export default api;