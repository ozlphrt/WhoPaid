import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/WhoPaid/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg', 'icons/*.png'],
      manifest: {
        name: 'WhoPaid — Group Expense Sharing',
        short_name: 'WhoPaid',
        description: 'Fast, mobile-first multi-currency group expense tracker for trips and friends.',
        theme_color: '#101217',
        background_color: '#101217',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/WhoPaid/',
        start_url: '/WhoPaid/',
        icons: [
          {
            src: '/WhoPaid/icons/icon-192.png?v=20260820',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/WhoPaid/icons/icon-512.png?v=20260820',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // FX data is cached by src/lib/fx.ts only after it has been parsed and
        // validated. Workbox should not intercept third-party API requests.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          'vendor-icons': ['lucide-react']
        }
      }
    }
  }
});
