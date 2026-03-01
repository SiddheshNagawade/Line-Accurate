import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Aggressive code splitting for better caching & parallel loading
    rollupOptions: {
      input: {
        main: './index.html',
        'service-worker': './src/service-worker.ts',
      },
      output: {
        manualChunks: {
          // Vendor chunks—split large deps for independent caching
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-ui': ['lucide-react'],
          'vendor-pdf': ['jspdf'],
        },
        // Use content hashing for long-term cache busting
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    // Minify aggressively
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console logs in production
        passes: 3, // Multiple passes for better compression
      },
      format: {
        comments: false,
      },
    },
    // Inline small assets (<4KB) to reduce HTTP requests
    assetsInlineLimit: 4096,
    // Report compression metrics
    reportCompressedSize: true,
    // Preload critical chunks
    cssCodeSplit: true,
    sourcemap: false, // Disable source maps in production for smaller files
  },
  // Optimize dependencies upfront
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'lucide-react'],
  },
});
