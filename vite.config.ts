import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0", // Permite que Replit se conecte
    port: 5173,
    strictPort: true,
    allowedHosts: true, // Ignora los bloqueos de seguridad de dominios
  },
});
