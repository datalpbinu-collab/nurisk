import { create } from 'zustand';
import api from '../services/api';

export const useAnalyticsStore = create((set, get) => ({
  dashboardStats: null,
  responseMetrics: [],
  incidentsByDimension: [],
  volunteerPerformance: [],
  kpis: null,
  isLoading: false,
  
  setDashboardStats: (stats) => set({ dashboardStats: stats }),
  setResponseMetrics: (metrics) => set({ responseMetrics: metrics }),
  setIncidentsByDimension: (data) => set({ incidentsByDimension: data }),
  setVolunteerPerformance: (data) => set({ volunteerPerformance: data }),
  setKPIs: (kpis) => set({ kpis: kpis }),
  setLoading: (loading) => set({ isLoading: loading }),
  
  fetchDashboardStats: async (params = {}) => {
    set({ isLoading: true });
    try {
      const queryString = new URLSearchParams(params).toString();
      const res = await api.get(`/analytics/dashboard?${queryString}`);
      set({ dashboardStats: res.data });
    } catch (err) {
      console.error('Fetch dashboard stats error:', err);
    } finally {
      set({ isLoading: false });
    }
  },
  
  fetchResponseMetrics: async (startDate, endDate) => {
    try {
      const res = await api.get(`/analytics/response-metrics?start_date=${startDate}&end_date=${endDate}`);
      set({ responseMetrics: res.data });
    } catch (err) {
      console.error('Fetch response metrics error:', err);
    }
  },
  
  fetchIncidentsByDimension: async (dimension, startDate, endDate) => {
    try {
      const res = await api.get(`/analytics/incidents-by?dimension=${dimension}&start_date=${startDate}&end_date=${endDate}`);
      set({ incidentsByDimension: res.data });
    } catch (err) {
      console.error('Fetch incidents by dimension error:', err);
    }
  },
  
  fetchVolunteerPerformance: async (region) => {
    try {
      const res = await api.get(`/analytics/volunteers/performance?region=${region || ''}`);
      set({ volunteerPerformance: res.data });
    } catch (err) {
      console.error('Fetch volunteer performance error:', err);
    }
  },
  
  fetchKPIs: async (year, month) => {
    try {
      const res = await api.get(`/analytics/kpis?year=${year || new Date().getFullYear()}&month=${month || ''}`);
      set({ kpis: res.data });
    } catch (err) {
      console.error('Fetch KPIs error:', err);
    }
  },
  
  downloadSITREP: async (incidentId) => {
    try {
      const res = await api.get(`/analytics/incidents/${incidentId}/sitrep`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `SITREP_INC-${incidentId}_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download SITREP error:', err);
      throw err;
    }
  },
  
  uploadMedia: async (file, incidentId, type = 'photo') => {
    const formData = new FormData();
    formData.append('file', file);
    if (incidentId) formData.append('incident_id', incidentId.toString());
    formData.append('type', type);
    
    try {
      const res = await api.post('/reports/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data;
    } catch (err) {
      console.error('Upload media error:', err);
      throw err;
    }
  },
  
  getMedia: async (incidentId) => {
    try {
      const res = await api.get(`/reports/media/${incidentId}`);
      return res.data;
    } catch (err) {
      console.error('Get media error:', err);
      return [];
    }
  }
}));

export default useAnalyticsStore;