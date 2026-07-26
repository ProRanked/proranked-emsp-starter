import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The browser app calls the eMSP API same-origin and Vite proxies it to the gateway —
// this sidesteps CORS in dev and keeps the publishable key out of cross-origin requests.
// Point VITE_EMSP_BASE_URL at the lab (default) or prod.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_EMSP_BASE_URL || 'https://api.phevnix.cloud';
  // The brand is applied to the DOM at runtime, but index.html is what a crawler, a link preview and
  // the first paint see — so bake the name in at build time too. Without this a white-labelled
  // deployment still shows "Voltway" in the tab, in bookmarks and in every shared link.
  const brandName = env.VITE_BRAND_NAME || 'Voltway';
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'brand-index-html',
        transformIndexHtml: (html) => html.replaceAll('%BRAND_NAME%', brandName),
      },
    ],
    server: {
      port: 5173,
      proxy: {
        '/emsp': { target, changeOrigin: true, secure: true },
      },
    },
  };
});
