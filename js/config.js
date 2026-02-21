// js/config.js
// ─────────────────────────────────────────────────────────
// THIS IS THE ONLY FILE YOU NEED TO CHANGE WHEN YOU DEPLOY.
//
// After you deploy the backend to Render, you will get a URL like:
//   https://tradevault-backend.onrender.com
//
// Replace the RENDER_URL value below with your actual Render URL.
// Then push to GitHub — Vercel will auto-redeploy with the new URL.
// ─────────────────────────────────────────────────────────

const CONFIG = {
  // During local development this points to your local backend.
  // In production (Vercel), change this to your Render URL.
  API_BASE: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'           // ← local dev
    : 'https://tradevault-backend-xnpg.onrender.com/api'  // ← 🚨 REPLACE THIS after deploying to Render
};

window.CONFIG = CONFIG;
