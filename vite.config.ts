import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  define: {
    global: "globalThis",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/register": "http://localhost:10000",
      "/login": "http://localhost:10000",
      "/google-login": { target: "http://localhost:10000", changeOrigin: true },
      "/google-register-complete": {
        target: "http://localhost:10000",
        changeOrigin: true,
      },
      "/logout": "http://localhost:10000",
      "/profile": "http://localhost:10000",
      "/rooms": "http://localhost:10000",
      "/change-room-name": "http://localhost:10000",
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
