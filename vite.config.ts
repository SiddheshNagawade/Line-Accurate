import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Inject build timestamp so the service worker cache version is unique per build.
  define: {
    __BUILD_ID__: JSON.stringify(`v${Date.now()}`),
  },
  build: {
    // `vendor-three` is intentionally route-deferred (landing animation), so keep
    // warning threshold aligned with that isolated chunk size.
    chunkSizeWarningLimit: 760,
    // Aggressive code splitting for better caching & parallel loading
    rollupOptions: {
      input: {
        main: './index.html',
        'service-worker': './src/service-worker.ts',
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react';
            if (id.includes('/react-router-dom/')) return 'vendor-router';
            if (id.includes('/lucide-react/')) return 'vendor-ui';
            if (id.includes('/jspdf/')) return 'vendor-pdf';
            if (id.includes('/three/')) return 'vendor-three';
            if (id.includes('/@react-three/fiber/') || id.includes('/its-fine/') || id.includes('/react-reconciler/')) return 'vendor-r3f';
            if (id.includes('/react-use-measure/')) return 'vendor-measure';
          }
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
