import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "fs";
import path from "path";
import { componentTagger } from "lovable-tagger";

const appPackageVersion =
  process.env.npm_package_version ||
  JSON.parse(fs.readFileSync(path.resolve(__dirname, "package.json"), "utf8")).version;

// Plugin to stub out @mediapipe/tasks-vision imports
const mediapipeStubPlugin = (): Plugin => ({
  name: "mediapipe-stub",
  resolveId(id) {
    if (id === "@mediapipe/tasks-vision") {
      return "\0mediapipe-stub";
    }
  },
  load(id) {
    if (id === "\0mediapipe-stub") {
      return `
        export const FilesetResolver = { forVisionTasks: () => Promise.resolve({}) };
        export const FaceLandmarker = { createFromOptions: () => Promise.resolve({}) };
        export default { FilesetResolver, FaceLandmarker };
      `;
    }
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Use relative paths for Electron file:// protocol
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appPackageVersion),
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true, // Allow all Replit preview URLs
    port: 5000,
  },
  plugins: [
    react(),
    mediapipeStubPlugin(),
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
    include: ["react", "react-dom", "react/jsx-runtime", "pdfjs-dist"],
    exclude: ["@mediapipe/tasks-vision"],
    esbuildOptions: {
      target: "esnext",
    },
  },
  build: {
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
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei', 'three-csg-ts'],
          'ui-vendor': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast'
          ],
          'pdf-vendor': ['jspdf', 'jspdf-autotable', 'docx', 'dxf-writer'],
          'drawing-vendor': ['paper', 'makerjs', 'opentype.js', '@jscad/modeling'],
        },
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Minify for production
    minify: 'esbuild',
    target: 'esnext',
    // Skip per-chunk gzip reporting — adds 10-30s on a large bundle for a
    // log line that doesn't affect the artifact. Same dist/ output either way.
    reportCompressedSize: false,
  },
}));
