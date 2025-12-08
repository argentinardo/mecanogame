import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use relative paths for itch.io compatibility
  base: './',
  server: {
    open: 'chrome', // Automatically open Chrome on server start
  },
  build: {
    // Increase chunk size warning limit (default is 500kB)
    chunkSizeWarningLimit: 1000, // 1MB
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching and smaller initial load
        manualChunks: {
          // Phaser is the largest dependency (~1.5MB), separate it
          'phaser': ['phaser'],
          // React ecosystem
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
})

