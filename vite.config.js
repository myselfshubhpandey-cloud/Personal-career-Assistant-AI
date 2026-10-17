import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const repositoryName = 'Personal-career-Assistant-AI';
const base = process.env.GITHUB_ACTIONS === 'true' ? `/${repositoryName}/` : '/';

// Production-only Content Security Policy: the app may only talk to the free job feeds it
// uses, and the only outside script allowed is Greenhouse's official JSONP job API.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' https://boards-api.greenhouse.io",
  "connect-src 'self' https://boards-api.greenhouse.io https://api.ashbyhq.com https://remotive.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const securityHeaders = {
  name: 'career-studio-csp',
  apply: 'build',
  transformIndexHtml(html) {
    return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}" />\n    <meta name="referrer" content="no-referrer" />`);
  },
};

export default defineConfig({
  base,
  plugins: [
    react(),
    securityHeaders,
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'Career Studio',
        short_name: 'Career Studio',
        description: 'A private, local-first workspace for planning your next career move.',
        theme_color: '#173b32',
        background_color: '#f7f8f4',
        display: 'standalone',
        orientation: 'any',
        start_url: base,
        scope: base,
        icons: [
          { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{css,html,ico,js,png,svg,webmanifest,woff2}'],
      },
    }),
  ],
});
