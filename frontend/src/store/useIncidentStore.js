import { create } from 'zustand';

export const useIncidentStore = create((set) => ({
  incidents: [],
  selectedIncident: null,
  isLoading: false,
  error: null,
  
  setIncidents: (incidents) => set({ incidents }),
  setSelectedIncident: (incident) => set({ selectedIncident: incident }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  
  addIncident: (incident) => set((state) => ({
    incidents: [...state.incidents, incident]
  })),
  
  updateIncident: (id, updates) => set((state) => ({
    incidents: state.incidents.map(inc => 
      inc.id === id ? { ...inc, ...updates } : inc
    )
  })),
  
  removeIncident: (id) => set((state) => ({
    incidents: state.incidents.filter(inc => inc.id !== id)
  })),
  
  clearError: () => set({ error: null })
}));

export default useIncidentStore;