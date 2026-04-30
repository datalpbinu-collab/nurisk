import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'NU Peduli Jawa Tengah',
        short_name: 'NU Peduli',
        description: 'Sistem Tanggap Bencana NU Peduli Jawa Tengah - Offline First',
        theme_color: '#006432',
        icons: []
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      }
    })
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      // Fix for react-leaflet module resolution
      'react-leaflet': 'react-leaflet'
    }
  }
});
