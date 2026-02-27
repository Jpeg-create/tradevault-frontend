const CONFIG = {
  // Backend URL — change the production URL if you redeploy to a new Render service
  API_BASE: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : 'https://tradevault-backend-xnpg.onrender.com/api',

  // ── GOOGLE SIGN IN ────────────────────────────────────────
  // To enable Google Sign In:
  //  1. Go to https://console.cloud.google.com → APIs & Services → Credentials
  //  2. Create "OAuth 2.0 Client ID" → Web application
  //  3. Add your Vercel URL to "Authorized JavaScript origins"
  //     e.g. https://your-app.vercel.app
  //  4. Copy the Client ID and paste it below (replace YOUR_GOOGLE_CLIENT_ID)
  //  5. Set the same value as GOOGLE_CLIENT_ID in your Render backend env vars
  GOOGLE_CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID',
};

window.CONFIG = CONFIG;
