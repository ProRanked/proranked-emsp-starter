import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The browser app calls the eMSP API same-origin and Vite proxies it to the gateway —
// this sidesteps CORS in dev and keeps the publishable key out of cross-origin requests.
// Point VITE_EMSP_BASE_URL at the lab (default) or prod.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_EMSP_BASE_URL || 'https://api.phevnix.cloud';
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        '/emsp': { target, changeOrigin: true, secure: true },
      },
    },
  };
});
