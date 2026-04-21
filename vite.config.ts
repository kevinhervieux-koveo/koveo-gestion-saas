import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';
export default defineConfig({
  plugins: [react(), runtimeErrorOverlay()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'client', 'src'),
      '@shared': path.resolve(import.meta.dirname, 'shared'),
      '@assets': path.resolve(import.meta.dirname, 'attached_assets'),
    },
  },
  root: path.resolve(import.meta.dirname, 'client'),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || (id.includes('/react/') && !id.includes('react-'))) return 'vendor-react';
            if (id.includes('@radix-ui')) return 'vendor-ui';
            if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('/zod/')) return 'vendor-forms';
            if (id.includes('@tanstack/react-query')) return 'vendor-query';
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) return 'vendor-charts';
            if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) return 'vendor-utils';
            if (id.includes('date-fns')) return 'vendor-date-fns';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('cmdk')) return 'vendor-cmdk';
            if (id.includes('dompurify') || id.includes('isomorphic-dompurify') || id.includes('purify')) return 'vendor-sanitize';
            if (id.includes('marked')) return 'vendor-markdown';
            if (id.includes('wouter')) return 'vendor-router';
            if (id.includes('embla-carousel')) return 'vendor-carousel';
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('input-otp')) return 'vendor-otp';
            if (id.includes('react-day-picker')) return 'vendor-datepicker';
            if (id.includes('react-resizable-panels')) return 'vendor-panels';
            if (id.includes('vaul')) return 'vendor-drawer';
            if (id.includes('sonner')) return 'vendor-sonner';
          }
        },
      },
    },
    // Default Vite warning limit. Kept explicit so chunk-size regressions
    // are surfaced loudly during build.
    chunkSizeWarningLimit: 500,
  },
  server: {
    host: '0.0.0.0',
    fs: {
      strict: true,
      deny: ['**/.*'],
    },
  },
});
