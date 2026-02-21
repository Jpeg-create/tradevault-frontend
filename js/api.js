// js/api.js
// All HTTP calls to the backend live here.
// Uses CONFIG.API_BASE from config.js so it always hits the right server.

async function request(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${CONFIG.API_BASE}${path}`, opts);
  const json = await res.json();

  if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

const api = {
  // Trades
  getTrades:   (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/trades${qs ? '?' + qs : ''}`);
  },
  createTrade: (data)     => request('POST',   '/trades', data),
  updateTrade: (id, data) => request('PUT',    `/trades/${id}`, data),
  deleteTrade: (id)       => request('DELETE', `/trades/${id}`),
  getStats:    ()         => request('GET',    '/trades/stats/summary'),

  // Journal
  getJournal:    ()     => request('GET',    '/journal'),
  createJournal: (data) => request('POST',   '/journal', data),
  deleteJournal: (id)   => request('DELETE', `/journal/${id}`),

  // Import
  previewCSV: (formData) =>
    fetch(`${CONFIG.API_BASE}/import/preview`, { method: 'POST', body: formData, credentials: 'include' })
      .then(r => r.json())
      .then(j => { if (!j.success) throw new Error(j.error); return j; }),
  confirmImport: (rows) => request('POST', '/import/confirm', { rows }),
  getSampleCSVUrl: ()   => `${CONFIG.API_BASE}/import/sample`,

  // Brokers
  getBrokers:   ()     => request('GET',    '/brokers'),
  addBroker:    (data) => request('POST',   '/brokers', data),
  deleteBroker: (id)   => request('DELETE', `/brokers/${id}`),
  syncBroker:   (id)   => request('POST',   `/brokers/${id}/sync`),
  testBroker:   (data) => request('POST',   '/brokers/test', data),

  // Health
  health: () => request('GET', '/health')
};

window.api = api;
