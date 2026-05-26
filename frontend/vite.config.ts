import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// In Docker: VITE_API_TARGET=http://backend:4000
// Local dev: uses localhost:4000
const API_TARGET = process.env['VITE_API_TARGET'] ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          ui: [
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            'lucide-react',
          ],
          charts: ['recharts'],
          i18n: ['i18next', 'i18next-browser-languagedetector', 'react-i18next'],
          realtime: ['socket.io-client', 'axios', 'zustand'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/uploads': { target: API_TARGET, changeOrigin: true },
      '/socket.io': { target: API_TARGET, changeOrigin: true, ws: true },
    },
  },
});
