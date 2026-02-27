// All API calls — includes auth token in every request + timeout handling

function getToken()  { return localStorage.getItem('qr_token'); }
function getUser()   { return JSON.parse(localStorage.getItem('qr_user') || 'null'); }
function saveAuth(token, user) { localStorage.setItem('qr_token', token); localStorage.setItem('qr_user', JSON.stringify(user)); }
function clearAuth() { localStorage.removeItem('qr_token'); localStorage.removeItem('qr_user'); }
function redirectToLogin() {
  // Don't redirect if we're already on the auth page (prevents redirect loops)
  if (window.location.pathname === '/login' || window.location.pathname === '/auth.html') return;
  window.location.href = '/login';
}

// Fetch with a timeout — Render free tier can take 30-60s to cold start
async function request(method, path, body = null, timeoutMs = 35000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      signal: controller.signal,
    };
    const token = getToken();
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body)  opts.body = JSON.stringify(body);

    const res = await fetch(`${CONFIG.API_BASE}${path}`, opts);
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = { success: false, error: `HTTP ${res.status}` };
    }

    if (res.status === 401) {
      clearAuth();
      redirectToLogin();
      throw new Error('Session expired. Please log in again.');
    }

    if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Server is taking too long to respond. Render free tier may be waking up — please wait 30 seconds and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const api = {
  // Auth
  signup:               (data) => request('POST',   '/auth/signup', data),
  login:                (data) => request('POST',   '/auth/login',  data),
  googleLogin:          (data) => request('POST',   '/auth/google', data),
  me:                   ()     => request('GET',    '/auth/me'),
  resetPasswordRequest: (data) => request('POST',   '/auth/reset-password-request', data),
  resetPassword:        (data) => request('POST',   '/auth/reset-password', data),
  updateProfile:        (data) => request('PUT',    '/auth/profile', data),
  deleteAccount:        (data) => request('DELETE', '/auth/account', data),

  // Trades
  getTrades:   (params={}) => { const qs = new URLSearchParams(params).toString(); return request('GET', `/trades${qs ? '?' + qs : ''}`); },
  createTrade: (data)      => request('POST',   '/trades', data),
  updateTrade: (id, data)  => request('PUT',    `/trades/${id}`, data),
  deleteTrade: (id)        => request('DELETE', `/trades/${id}`),

  // Journal
  getJournal:    ()     => request('GET',    '/journal'),
  createJournal: (data) => request('POST',   '/journal', data),
  deleteJournal: (id)   => request('DELETE', `/journal/${id}`),

  // Import
  previewCSV: (fd) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    return fetch(`${CONFIG.API_BASE}/import/preview`, {
      method: 'POST', body: fd, credentials: 'include', signal: controller.signal,
      headers: { Authorization: `Bearer ${getToken()}` }
    }).then(async (r) => {
      let j = null;
      try {
        j = await r.json();
      } catch {
        j = { success: false, error: `HTTP ${r.status}` };
      }

      if (r.status === 401) {
        clearAuth();
        redirectToLogin();
        throw new Error('Session expired. Please log in again.');
      }

      if (!r.ok || !j.success) throw new Error(j.error || `HTTP ${r.status}`);
      return j;
    }).finally(() => clearTimeout(timer));
  },
  confirmImport:  (rows) => request('POST', '/import/confirm', { rows }),
  getSampleCSVUrl: ()   => `${CONFIG.API_BASE}/import/sample`,

  // Brokers
  getBrokers:   ()     => request('GET',    '/brokers'),
  addBroker:    (data) => request('POST',   '/brokers', data),
  deleteBroker: (id)   => request('DELETE', `/brokers/${id}`),
  syncBroker:   (id)   => request('POST',   `/brokers/${id}/sync`),

  // Health ping (used to pre-warm the server)
  ping: () => {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 60000);
    return fetch(`${CONFIG.API_BASE}/health`, { signal: ctrl.signal })
      .then(r => r.json()).catch(() => null);
  },
};

// ── AI STREAMING ──────────────────────────────────────────
// Calls a premium AI endpoint and streams back text word-by-word.
// onChunk(text) — called for each streamed token
// onDone()      — called when stream ends successfully
// onError(msg)  — called on error; msg === 'upgrade' means not premium
async function streamAI(endpoint, body, onChunk, onDone, onError) {
  try {
    const res = await fetch(`${CONFIG.API_BASE}${endpoint}`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${getToken()}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let err = { error: `HTTP ${res.status}` };
      try { err = await res.json(); } catch {}
      if (res.status === 401) { clearAuth(); redirectToLogin(); return; }
      if (res.status === 403 && err.upgrade) { onError('upgrade'); return; }
      onError(err.error || 'AI request failed');
      return;
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') { onDone(); return; }
        try {
          const json = JSON.parse(raw);
          if (json.text)  onChunk(json.text);
          if (json.error) { onError(json.error); return; }
        } catch {}
      }
    }
    onDone();
  } catch (err) {
    onError(err.message);
  }
}

window.streamAI = streamAI;

window.api = api;
window.getToken = getToken;
window.getUser  = getUser;
window.saveAuth = saveAuth;
window.clearAuth = clearAuth;
