import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
  // Electron needs this for proper asset resolution
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // Externalize Node.js modules used by copilot-sdk (runs in Electron main process)
      external: ['@github/copilot-sdk'],
    }
  },
  server: {
    port: 5173,
    // Don't auto-open browser when running with Electron
    open: false
  },
  optimizeDeps: {
    include: ['react-resizable-panels'],
    exclude: ['@github/copilot-sdk'],
    esbuildOptions: {
      target: 'esnext'
    }
  }
});
