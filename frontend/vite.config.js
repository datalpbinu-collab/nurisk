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
      'react-leaflet': 'react-leaflet'
    }
  },
  // ─── Dev Server Config ────────────────────────────────────────────────────
  server: {
    port: 5173,
    host: true, // Bisa diakses dari luar (misal via HP di LAN yang sama)
    proxy: {
      // Semua request ke /api/ diteruskan ke backend Docker
      '/api': {
        target: 'http://localhost:7860',
        changeOrigin: true,
        secure: false,
      },
      // WebSocket socket.io juga di-proxy
      '/socket.io': {
        target: 'http://localhost:7860',
        ws: true,
        changeOrigin: true,
      }
    }
  }
});

