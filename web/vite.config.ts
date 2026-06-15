import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const edition = process.env.VITE_EDITION === "premium" ? "premium" : "community"

export default defineConfig({
  base: "/",
  plugins: [react()],
  build: {
    outDir: `dist-${edition}`,
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:12789',
        changeOrigin: true,
      },
      '/v1beta': {
        target: 'http://localhost:12789',
        changeOrigin: true,
      },
      '/v1': {
        target: 'http://localhost:12789',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:12789',
        changeOrigin: true,
      },
    },
  },
})
