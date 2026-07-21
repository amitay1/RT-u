import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "fs";
import path from "path";
import { componentTagger } from "lovable-tagger";

const appPackageVersion =
  process.env.npm_package_version ||
  JSON.parse(fs.readFileSync(path.resolve(__dirname, "package.json"), "utf8")).version;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Keep inactive legacy assets outside the RT/PT web and desktop builds.
  publicDir: path.resolve(__dirname, "./public/rtpt"),
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appPackageVersion),
  },
  server: {
    host: "127.0.0.1",
    allowedHosts: ["127.0.0.1", "localhost"],
    port: 5000,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "jspdf", "jspdf-autotable"],
    esbuildOptions: {
      target: "esnext",
    },
  },
  build: {
    // Keep RT/PT artifacts physically separate from the legacy shared workspace.
    outDir: path.resolve(__dirname, "./rtpt-dist"),
    // A release must never retain stale assets from the legacy shared workspace.
    emptyOutDir: true,
    commonjsOptions: {
      include: [/node_modules/],
      exclude: ["@mediapipe/tasks-vision"],
    },
    // Optimize bundle size
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks for better caching
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast'
          ],
          'pdf-vendor': ['jspdf', 'jspdf-autotable'],
        },
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Minify for production
    minify: 'esbuild',
    target: 'esnext',
    // Skip per-chunk gzip reporting — adds 10-30s on a large bundle for a
    // log line that doesn't affect the artifact. Same rtpt-dist/ output either way.
    reportCompressedSize: false,
  },
}));
