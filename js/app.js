// ── SECURITY: HTML escape to prevent XSS ─────────────────
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── STATE ─────────────────────────────────────────────────
let state = {
  currentView: 'dashboard',
  trades: [], journalEntries: [], brokers: [],
  loading: true, syncing: false,
  filterAssetType: 'all', filterDirection: 'all',
  calendarDate: new Date(),
  showTradeModal: false, selectedTrade: null,
  showProfileModal: false,
  csvParsed: null, csvImporting: false, csvProgress: 0,
  // ── AI ──
  aiDebrief:  { loading: false, text: '', error: null, tradeId: null },
  aiPatterns: { loading: false, text: '', error: null, ran: false },
  showUpgradeModal: false,
};

// ── TOAST ─────────────────────────────────────────────────
function toast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  // Cap at 4 toasts — remove oldest if over limit
  while (container.children.length >= 4) container.firstChild.remove();
  const icons = { success:'✅', error:'❌', info:'ℹ️', warn:'⚠️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span style="flex-shrink:0">${icons[type]||'ℹ️'}</span><span>${esc(message)}</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}


// ── CUSTOM CONFIRM DIALOG ─────────────────────────────────
// Replaces native confirm()/prompt() which are blocked on mobile
function showConfirm(message, onConfirm, opts = {}) {
  const { confirmLabel = 'Confirm', confirmClass = 'btn-danger',
          requireInput = null, inputPlaceholder = '' } = opts;
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-msg">${esc(message)}</div>
      ${requireInput ? `<input class="form-input confirm-input" placeholder="${esc(inputPlaceholder)}" autocomplete="off">` : ''}
      <div class="confirm-actions">
        <button class="btn btn-secondary btn-sm confirm-cancel">Cancel</button>
        <button class="btn ${confirmClass} btn-sm confirm-ok">${esc(confirmLabel)}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const ok     = overlay.querySelector('.confirm-ok');
  const cancel = overlay.querySelector('.confirm-cancel');
  const input  = overlay.querySelector('.confirm-input');

  function close() { overlay.remove(); }
  cancel.onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };

  ok.onclick = () => {
    if (requireInput) {
      const val = (input?.value || '').trim();
      if (val !== requireInput) {
        input.style.borderColor = 'var(--accent-red)';
        input.placeholder = `Type exactly: ${requireInput}`;
        input.value = '';
        return;
      }
      close();
      onConfirm(val);
    } else {
      close();
      onConfirm();
    }
  };

  if (input) {
    input.focus();
    input.addEventListener('keydown', e => { if (e.key === 'Enter') ok.click(); });
  } else {
    // Allow Enter key even without an input
    overlay.addEventListener('keydown', e => { if (e.key === 'Enter') ok.click(); if (e.key === 'Escape') close(); });
    setTimeout(() => ok.focus(), 50);
  }
}

function showPrompt(message, onConfirm, placeholder = '') {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-msg">${esc(message)}</div>
      <input type="password" class="form-input confirm-input" placeholder="${esc(placeholder)}" autocomplete="current-password">
      <div class="confirm-actions">
        <button class="btn btn-secondary btn-sm confirm-cancel">Cancel</button>
        <button class="btn btn-danger btn-sm confirm-ok">Confirm</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const ok     = overlay.querySelector('.confirm-ok');
  const cancel = overlay.querySelector('.confirm-cancel');
  const input  = overlay.querySelector('.confirm-input');
  function close() { overlay.remove(); }
  cancel.onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  ok.onclick = () => { close(); onConfirm(input.value); };
  input.focus();
  input.addEventListener('keydown', e => { if (e.key === 'Enter') ok.click(); });
}

// ── PREMIUM HELPERS ───────────────────────────────────────
function isPremium() {
  return getUser()?.plan === 'premium';
}

function showUpgradeModal() {
  state.showUpgradeModal = true;
  render();
}

function closeUpgradeModal() {
  state.showUpgradeModal = false;
  render();
}

function upgradeModal() {
  return `
    <div class="modal" onclick="closeUpgradeModal()">
      <div class="modal-content upgrade-modal-content" onclick="event.stopPropagation()">
        <div class="upgrade-modal-header">
          <div class="upgrade-crown">👑</div>
          <h2 class="modal-title" style="margin-top:0.75rem">Quantario Premium</h2>
          <p style="color:var(--text-secondary);font-size:0.85rem;margin-top:0.35rem">Unlock AI-powered insights for your trading</p>
        </div>
        <div class="upgrade-features">
          <div class="upgrade-feature">
            <span class="upgrade-feature-icon">✨</span>
            <div>
              <div class="upgrade-feature-title">AI Trade Debrief</div>
              <div class="upgrade-feature-desc">Get a personalised coaching note after every trade, referencing your own stats</div>
            </div>
          </div>
          <div class="upgrade-feature">
            <span class="upgrade-feature-icon">📊</span>
            <div>
              <div class="upgrade-feature-title">Pattern Recognition</div>
              <div class="upgrade-feature-desc">AI scans all your trades and surfaces hidden strengths and weaknesses</div>
            </div>
          </div>
          <div class="upgrade-feature">
            <span class="upgrade-feature-icon">📝</span>
            <div>
              <div class="upgrade-feature-title">AI Journal Assistant</div>
              <div class="upgrade-feature-desc">Draft your daily journal entry from your trades in one click</div>
            </div>
          </div>
        </div>
        <div class="upgrade-price">
          <span class="upgrade-price-amount">$9.99</span>
          <span class="upgrade-price-period">/month</span>
        </div>
        <div style="text-align:center;color:var(--text-secondary);font-size:0.78rem;margin-bottom:1.25rem">
          Payments coming soon — join the waitlist to be notified
        </div>
        <button class="btn btn-primary btn-block" onclick="toast('You\'re on the waitlist! We\'ll notify you when Premium launches.','success',5000);closeUpgradeModal()">
          Join Waitlist
        </button>
        <button class="btn btn-secondary btn-block" style="margin-top:0.6rem" onclick="closeUpgradeModal()">Maybe Later</button>
      </div>
    </div>`;
}

// ── AI LOCKED BUTTON ──────────────────────────────────────
function aiLockedBtn(label) {
  return `<button class="btn btn-ai-locked btn-sm" onclick="showUpgradeModal()">
    <span class="crown-icon">👑</span> ${label}
  </button>`;
}
async function init() {
  state.loading = true; render();
  try {
    // Use allSettled so a single failing endpoint doesn't blank out the entire app
    const [t, j, b] = await Promise.allSettled([api.getTrades(), api.getJournal(), api.getBrokers()]);
    if (t.status === 'fulfilled') state.trades         = t.value.data;
    if (j.status === 'fulfilled') state.journalEntries = j.value.data;
    if (b.status === 'fulfilled') state.brokers        = b.value.data;
    if (t.status === 'rejected' && j.status === 'rejected' && b.status === 'rejected') {
      toast('Could not reach server. Check your connection.', 'error', 7000);
    }
  } catch (err) {
    toast('Could not reach server. Check your connection.', 'error', 7000);
  }
  state.loading = false; render();
}

// ── STATS ─────────────────────────────────────────────────
function calcStats(trades) {
  const w = trades.filter(t => t.pnl > 0);
  const l = trades.filter(t => t.pnl < 0);
  const tp = trades.reduce((s,t) => s + Number(t.pnl), 0);
  const tw = w.reduce((s,t) => s + Number(t.pnl), 0);
  const tl = Math.abs(l.reduce((s,t) => s + Number(t.pnl), 0));
  const aw = w.length ? tw / w.length : 0;
  const al = l.length ? tl / l.length : 0;
  return {
    totalTrades: trades.length, totalPnL: tp,
    winningTrades: w.length, losingTrades: l.length,
    winRate: trades.length ? ((w.length / trades.length) * 100).toFixed(1) : '0.0',
    avgWin: aw, avgLoss: al,
    profitFactor: tl > 0 ? (tw / tl).toFixed(2) : '—',
    rMultiple: al > 0 ? (aw / al).toFixed(2) : '—'
  };
}

// ── RENDER ────────────────────────────────────────────────
// SVG icon helpers
const NAV_ICONS = {
  dashboard: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  trades:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  analytics: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  calendar:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  journal:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  import:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  brokers:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
  profile:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
};

// Bottom nav tabs shown on mobile (most used 5)
const BOTTOM_NAV = ['dashboard','trades','analytics','journal','profile'];

function render() {
  const app = document.getElementById('app');
  const stats = calcStats(state.trades);
  const user = getUser() || {};

  app.innerHTML = `
    <div class="app-container">

      <!-- ── DESKTOP SIDEBAR ─── -->
      <div class="sidebar">
        <div class="logo">
          <div class="logo-icon"><svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="vg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#00d4ff"/><stop offset="100%" stop-color="#a3e635"/></linearGradient></defs><circle cx="16" cy="16" r="14" stroke="url(#vg)" stroke-width="2" fill="none"/><circle cx="16" cy="16" r="10" stroke="url(#vg)" stroke-width="1.2" fill="rgba(0,212,255,0.06)"/><line x1="2" y1="16" x2="6" y2="16" stroke="url(#vg)" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="5" r="1.5" fill="url(#vg)"/><circle cx="16" cy="27" r="1.5" fill="url(#vg)"/><circle cx="5" cy="16" r="1.5" fill="url(#vg)"/><circle cx="27" cy="16" r="1.5" fill="url(#vg)"/><rect x="9" y="19" width="2" height="4" rx="0.5" fill="#00d4ff"/><line x1="10" y1="18" x2="10" y2="19" stroke="#00d4ff" stroke-width="1"/><rect x="13" y="14" width="2" height="7" rx="0.5" fill="#a3e635"/><line x1="14" y1="12" x2="14" y2="14" stroke="#a3e635" stroke-width="1"/><rect x="17" y="16" width="2" height="5" rx="0.5" fill="#00d4ff"/><line x1="18" y1="14" x2="18" y2="16" stroke="#00d4ff" stroke-width="1"/><rect x="21" y="12" width="2" height="9" rx="0.5" fill="#a3e635"/><line x1="22" y1="10" x2="22" y2="12" stroke="#a3e635" stroke-width="1"/><polyline points="9,20 13,16 17,18 22,11" stroke="#a3e635" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></div>
          <div class="logo-text">Quan<span>tario</span></div>
        </div>
        <nav style="flex:1">
          <div class="nav-section-label">OVERVIEW</div>
          <button class="nav-item ${state.currentView === 'dashboard' ? 'active' : ''}" onclick="changeView('dashboard')"><span class="nav-icon">${NAV_ICONS.dashboard}</span>Dashboard</button>
          <div class="nav-section-label">TRADING</div>
          <button class="nav-item ${state.currentView === 'trades'    ? 'active' : ''}" onclick="changeView('trades')"   ><span class="nav-icon">${NAV_ICONS.trades}</span>Trades</button>
          <button class="nav-item ${state.currentView === 'analytics' ? 'active' : ''}" onclick="changeView('analytics')"><span class="nav-icon">${NAV_ICONS.analytics}</span>Analytics</button>
          <button class="nav-item ${state.currentView === 'calendar'  ? 'active' : ''}" onclick="changeView('calendar') "><span class="nav-icon">${NAV_ICONS.calendar}</span>Calendar</button>
          <div class="nav-section-label">TOOLS</div>
          <button class="nav-item ${state.currentView === 'journal'   ? 'active' : ''}" onclick="changeView('journal')  "><span class="nav-icon">${NAV_ICONS.journal}</span>Journal</button>
          <button class="nav-item ${state.currentView === 'import'    ? 'active' : ''}" onclick="changeView('import')   "><span class="nav-icon">${NAV_ICONS.import}</span>Import</button>
          <button class="nav-item ${state.currentView === 'brokers'   ? 'active' : ''}" onclick="changeView('brokers')  "><span class="nav-icon">${NAV_ICONS.brokers}</span>Brokers</button>
        </nav>
        <div class="sidebar-footer">
          <button class="sidebar-profile-btn" onclick="openProfileModal()">
            <div class="sidebar-avatar">${esc((user.name||'U').charAt(0).toUpperCase())}</div>
            <div class="sidebar-user-info">
              <div class="sidebar-user-name">${esc(user.name || 'User')}</div>
              <div class="sidebar-user-label">${esc(user.email || '')}</div>
            </div>
            <span class="sidebar-profile-icon">${NAV_ICONS.profile}</span>
          </button>
          <button class="btn btn-secondary btn-sm" style="width:100%;margin-top:0.5rem" onclick="handleLogout()">Logout</button>
          <div class="sync-status">
            <div class="sync-dot ${state.syncing ? 'syncing' : ''}"></div>
            <span>${state.syncing ? 'Syncing…' : 'Online'}</span>
          </div>
        </div>
      </div>

      <!-- ── MAIN CONTENT ─── -->
      <div class="main-content">
        <!-- Mobile top bar -->
        <div class="mobile-topbar">
          <div class="logo" style="margin-bottom:0">
            <div class="logo-icon" style="width:22px;height:22px"><svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="vgt" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#00d4ff"/><stop offset="100%" stop-color="#a3e635"/></linearGradient></defs><circle cx="16" cy="16" r="14" stroke="url(#vgt)" stroke-width="2" fill="none"/><circle cx="16" cy="16" r="10" stroke="url(#vgt)" stroke-width="1.2" fill="rgba(0,212,255,0.06)"/><line x1="2" y1="16" x2="6" y2="16" stroke="url(#vgt)" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="5" r="1.5" fill="url(#vgt)"/><circle cx="16" cy="27" r="1.5" fill="url(#vgt)"/><circle cx="5" cy="16" r="1.5" fill="url(#vgt)"/><circle cx="27" cy="16" r="1.5" fill="url(#vgt)"/><rect x="9" y="19" width="2" height="4" rx="0.5" fill="#00d4ff"/><rect x="13" y="14" width="2" height="7" rx="0.5" fill="#a3e635"/><rect x="17" y="16" width="2" height="5" rx="0.5" fill="#00d4ff"/><rect x="21" y="12" width="2" height="9" rx="0.5" fill="#a3e635"/><polyline points="9,20 13,16 17,18 22,11" stroke="#a3e635" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></div>
            <div class="logo-text" style="font-size:0.9rem">Quan<span>tario</span></div>
          </div>
          <div style="display:flex;align-items:center;gap:0.5rem">
            <div class="sync-dot ${state.syncing ? 'syncing' : ''}" style="width:8px;height:8px"></div>
            <button class="mobile-avatar" onclick="openProfileModal()">${esc((user.name||'U').charAt(0).toUpperCase())}</button>
          </div>
        </div>

        ${state.loading ? skeleton() : renderView(stats)}
      </div>

      <!-- ── MOBILE BOTTOM NAV ─── -->
      <nav class="bottom-nav">
        <button class="bottom-nav-item ${state.currentView === 'dashboard' ? 'active' : ''}" onclick="changeView('dashboard')">
          ${NAV_ICONS.dashboard}<span>Home</span>
        </button>
        <button class="bottom-nav-item ${state.currentView === 'trades' ? 'active' : ''}" onclick="changeView('trades')">
          ${NAV_ICONS.trades}<span>Trades</span>
        </button>
        <button class="bottom-nav-fab" onclick="openAddTradeModal()">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button class="bottom-nav-item ${state.currentView === 'analytics' ? 'active' : ''}" onclick="changeView('analytics')">
          ${NAV_ICONS.analytics}<span>Stats</span>
        </button>
        <button class="bottom-nav-item ${['journal','calendar','import','brokers'].includes(state.currentView) ? 'active' : ''}" onclick="toggleMobileMore()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
          <span>More</span>
        </button>
      </nav>

      ${state.showTradeModal   ? tradeModal()   : ''}
      ${state.showProfileModal ? profileModal() : ''}
      ${state.showUpgradeModal ? upgradeModal() : ''}
    </div>
  `;
}

function renderView(stats) {
  switch (state.currentView) {
    case 'dashboard':  return dashboard(stats);
    case 'trades':     return tradesView();
    case 'analytics':  return analytics(stats);
    case 'calendar':   return calendar();
    case 'journal':    return journal();
    case 'import':     return importView();
    case 'brokers':    return brokers();
    default:           return dashboard(stats);
  }
}

function skeleton() {
  return `
    <div class="page-header"><h1 class="header">Loading…</h1></div>
    <div class="stats-grid">
      ${[1,2,3,4].map(() => '<div class="stat-card skeleton" style="height:110px"></div>').join('')}
    </div>
    <div class="card">
      ${[1,2,3].map(() => '<div class="skeleton" style="height:72px;margin-bottom:0.875rem;border-radius:8px"></div>').join('')}
    </div>`;
}

function statCard(label, value, sub, positive = null) {
  const colorClass = positive === true ? 'positive' : positive === false ? 'negative' : '';
  return `
    <div class="stat-card">
      <div class="stat-label">${label}</div>
      <div class="stat-value ${colorClass}">${value}</div>
      <div class="stat-change">${sub}</div>
    </div>`;
}

function empty(icon, title, sub) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <h3>${title}</h3>
      <p>${sub}</p>
    </div>`;
}

// ── DASHBOARD ─────────────────────────────────────────────
function dashboard(s) {
  return `
    <div class="page-header">
      <h1 class="header">Dashboard</h1>
      <button class="btn btn-primary hide-mobile" onclick="openAddTradeModal()">+ Add Trade</button>
    </div>
    <div class="stats-grid">
      ${statCard('Total P&L', `${s.totalPnL >= 0 ? '+' : ''}$${s.totalPnL.toFixed(2)}`, `${s.winningTrades}W / ${s.losingTrades}L`, s.totalPnL >= 0)}
      ${statCard('Win Rate', `${s.winRate}%`, `${s.totalTrades} total trades`)}
      ${statCard('Avg Win', `$${s.avgWin.toFixed(2)}`, 'Per winning trade', true)}
      ${statCard('Avg Loss', `$${s.avgLoss.toFixed(2)}`, 'Per losing trade', false)}
      ${statCard('Profit Factor', s.profitFactor, 'Gross wins ÷ losses')}
      ${statCard('R-Multiple', s.rMultiple, 'Avg win ÷ avg loss')}
    </div>
    <div class="card">
      <div class="card-title">Recent Trades</div>
      ${state.trades.length === 0
        ? empty('📊', 'No trades yet', 'Tap the + button or click "Add Trade" to log your first trade')
        : state.trades.slice(0, 5).map(t => tradeCard(t, false)).join('')}
    </div>`;
}

// ── TRADES VIEW ───────────────────────────────────────────
function tradesView() {
  const filtered = state.trades.filter(t =>
    (state.filterAssetType === 'all' || t.asset_type === state.filterAssetType) &&
    (state.filterDirection  === 'all' || t.direction  === state.filterDirection)
  );
  return `
    <div class="page-header">
      <h1 class="header">Trade History</h1>
      <button class="btn btn-primary hide-mobile" onclick="openAddTradeModal()">+ Add Trade</button>
    </div>
    <div class="filter-bar">
      <div class="filter-chips">
        <button class="filter-chip ${state.filterAssetType === 'all'     ? 'active' : ''}" onclick="updateFilter('assetType','all')">All</button>
        ${['stock','forex','crypto','futures','options'].map(v =>
          `<button class="filter-chip ${state.filterAssetType === v ? 'active' : ''}" onclick="updateFilter('assetType','${v}')">${v.charAt(0).toUpperCase()+v.slice(1)}</button>`
        ).join('')}
      </div>
      <div class="filter-chips">
        <button class="filter-chip ${state.filterDirection === 'all'   ? 'active' : ''}" onclick="updateFilter('direction','all')">Both</button>
        <button class="filter-chip ${state.filterDirection === 'long'  ? 'active' : ''}" onclick="updateFilter('direction','long')">Long</button>
        <button class="filter-chip ${state.filterDirection === 'short' ? 'active' : ''}" onclick="updateFilter('direction','short')">Short</button>
      </div>
      <span class="filter-count">${filtered.length} trade${filtered.length !== 1 ? 's' : ''}</span>
    </div>
    <div class="card">
      ${filtered.length === 0
        ? empty('🔍', 'No trades found', 'Try adjusting your filters')
        : filtered.map(t => tradeCard(t, true)).join('')}
    </div>`;
}

function tradeCard(t, showDelete = false) {
  const pnl = Number(t.pnl);
  const ep  = Number(t.entry_price);
  const xp  = Number(t.exit_price);
  const dec = ep < 10 ? 4 : 2;
  const pnlColor = pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
  return `
    <div class="trade-item" onclick="viewTrade('${esc(t.id)}')">
      <div class="trade-header">
        <div class="trade-left">
          <span class="trade-symbol">${esc(t.symbol)}</span>
          <span class="trade-badges">
            <span class="badge badge-${t.direction}">${t.direction}</span>
            <span class="badge badge-${t.asset_type}">${t.asset_type}</span>
            ${t.broker && t.broker !== 'manual'
              ? `<span class="badge badge-broker">${esc(t.broker)}</span>`
              : ''}
          </span>
        </div>
        <div class="trade-right">
          <span class="trade-pnl ${pnl >= 0 ? 'positive' : 'negative'}">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}</span>
          ${showDelete
            ? `<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();doDeleteTrade('${esc(t.id)}')">✕</button>`
            : ''}
        </div>
      </div>
      <div class="trade-meta">
        <span class="trade-meta-item">📅 ${t.exit_date ? new Date(t.exit_date).toLocaleDateString() : '—'}</span>
        ${t.strategy ? `<span class="trade-meta-item">📋 ${esc(t.strategy)}</span>` : ''}
        <span class="trade-meta-item">💰 $${ep.toFixed(dec)} → $${xp.toFixed(dec)}</span>
        <span class="trade-meta-item">📦 ${t.quantity}</span>
        ${t.market_conditions ? `<span class="trade-meta-item">🌡️ ${esc(t.market_conditions)}</span>` : ''}
      </div>
      ${t.notes ? `<div class="trade-notes">${esc(t.notes)}</div>` : ''}
    </div>`;
}

// ── ANALYTICS ─────────────────────────────────────────────
function analytics(s) {
  const byStrategy = state.trades.reduce((acc, t) => {
    const k = t.strategy || 'No Strategy';
    if (!acc[k]) acc[k] = { pnl: 0, count: 0, wins: 0 };
    acc[k].pnl += Number(t.pnl);
    acc[k].count++;
    if (t.pnl > 0) acc[k].wins++;
    return acc;
  }, {});

  const byAsset = state.trades.reduce((acc, t) => {
    acc[t.asset_type] = (acc[t.asset_type] || 0) + 1;
    return acc;
  }, {});

  return `
    <div class="page-header"><h1 class="header">Analytics</h1></div>
    <div class="stats-grid">
      ${statCard('Total Trades', s.totalTrades, '')}
      ${statCard('Win Rate', `${s.winRate}%`, '')}
      ${statCard('Profit Factor', s.profitFactor, '')}
      ${statCard('Total P&L', `${s.totalPnL >= 0 ? '+' : ''}$${s.totalPnL.toFixed(2)}`, '', s.totalPnL >= 0)}
    </div>

    <!-- ── AI INSIGHTS ── -->
    <div class="card">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>✨ AI Pattern Insights</span>
        ${isPremium()
          ? `<button class="btn btn-ai btn-sm" id="ai-patterns-btn" onclick="doAIPatterns()">
               ${state.aiPatterns.loading
                 ? '<span class="spinner"></span> Analysing…'
                 : state.aiPatterns.ran ? '↺ Re-analyse' : 'Analyse My Trades'}
             </button>`
          : aiLockedBtn('Analyse My Trades')}
      </div>
      ${state.aiPatterns.text
        ? `<div class="ai-patterns-output" id="ai-patterns-text">${esc(state.aiPatterns.text).replace(/\n/g,'<br>')}</div>`
        : state.aiPatterns.loading
          ? `<div class="ai-patterns-output" id="ai-patterns-text"><span class="ai-cursor"></span></div>`
          : `<div class="ai-patterns-placeholder">
               ${isPremium()
                 ? `<div style="text-align:center;padding:2rem 1rem;color:var(--text-secondary)">
                      <div style="font-size:2rem;margin-bottom:0.75rem;opacity:0.4">📊</div>
                      <div style="font-size:0.85rem">Click "Analyse My Trades" to find hidden patterns in your data</div>
                    </div>`
                 : `<div style="text-align:center;padding:2rem 1rem;color:var(--text-secondary)">
                      <div style="font-size:2rem;margin-bottom:0.75rem;opacity:0.4">👑</div>
                      <div style="font-size:0.85rem">Upgrade to Premium to unlock AI pattern recognition</div>
                    </div>`}
             </div>`
      }
    </div>
    <div class="card">
      <div class="card-title">Performance by Strategy</div>
      ${!Object.keys(byStrategy).length
        ? empty('📈', 'No data yet', 'Add trades with strategy names to see breakdown')
        : Object.entries(byStrategy).sort((a, b) => b[1].pnl - a[1].pnl).map(([k, d]) => `
            <div class="trade-item" style="cursor:default">
              <div class="trade-header">
                <span class="trade-symbol">${esc(k)}</span>
                <span class="trade-pnl ${d.pnl >= 0 ? 'positive' : 'negative'}">${d.pnl >= 0 ? '+' : ''}$${d.pnl.toFixed(2)}</span>
              </div>
              <div class="trade-meta">
                <span class="trade-meta-item">📊 ${d.count} trades</span>
                <span class="trade-meta-item">✅ ${d.wins} wins</span>
                <span class="trade-meta-item">📈 ${((d.wins / d.count) * 100).toFixed(1)}% win rate</span>
              </div>
            </div>`).join('')}
    </div>
    <div class="card">
      <div class="card-title">Asset Distribution</div>
      ${!Object.keys(byAsset).length
        ? empty('📊', 'No data yet', 'Add trades to see asset breakdown')
        : Object.entries(byAsset).map(([asset, count]) => {
            const pct = ((count / state.trades.length) * 100).toFixed(1);
            return `
              <div class="trade-item" style="cursor:default;margin-bottom:0.875rem">
                <div class="trade-header" style="margin-bottom:0.5rem">
                  <span class="badge badge-${asset}">${asset}</span>
                  <span style="color:var(--text-secondary);font-size:0.82rem">${count} trades · ${pct}%</span>
                </div>
                <div class="progress-bar" style="margin-top:0">
                  <div class="progress-fill" style="width:${pct}%"></div>
                </div>
              </div>`;
          }).join('')}
    </div>`;
}

// ── CALENDAR ──────────────────────────────────────────────
function calendar() {
  const year  = state.calendarDate.getFullYear();
  const month = state.calendarDate.getMonth();
  const monthName  = state.calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDOW    = new Date(year, month, 1).getDay();

  // Group trades and journal entries by day
  const tradesByDay = {}, pnlByDay = {}, hasJournal = {};
  state.trades
    .filter(t => t.exit_date && new Date(t.exit_date).getMonth() === month && new Date(t.exit_date).getFullYear() === year)
    .forEach(t => {
      const d = new Date(t.exit_date).getDate();
      if (!tradesByDay[d]) tradesByDay[d] = [];
      tradesByDay[d].push(t);
      pnlByDay[d] = (pnlByDay[d] || 0) + Number(t.pnl);
    });
  state.journalEntries.forEach(e => {
    const d = new Date(e.entry_date + 'T12:00:00');
    if (d.getMonth() === month && d.getFullYear() === year) hasJournal[d.getDate()] = true;
  });

  const tradingDays = Object.keys(tradesByDay).length;
  const winDays     = Object.values(pnlByDay).filter(p => p > 0).length;
  const lossDays    = Object.values(pnlByDay).filter(p => p < 0).length;
  const monthPnL    = Object.values(pnlByDay).reduce((s, p) => s + p, 0);
  const avgDaily    = tradingDays > 0 ? monthPnL / tradingDays : 0;

  const cells = [];
  for (let i = 0; i < startDOW; i++) cells.push('<div class="calendar-day empty"></div>');
  for (let day = 1; day <= daysInMonth; day++) {
    const pnl = pnlByDay[day] ?? null;
    const ts  = tradesByDay[day] || [];
    let cls = 'calendar-day';
    if (ts.length) cls += pnl > 0 ? ' profit' : pnl < 0 ? ' loss' : ' breakeven';
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    cells.push(`
      <div class="${cls}" onclick="viewCalendarDay('${ds}')">
        ${hasJournal[day] ? '<div class="calendar-day-journal">📝</div>' : ''}
        <div class="calendar-day-number">${day}</div>
        ${ts.length ? `
          <div class="calendar-day-pnl ${pnl >= 0 ? 'positive' : 'negative'}">
            ${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toFixed(0)}
          </div>
          <div class="calendar-day-trades">${ts.length}t</div>` : ''}
      </div>`);
  }

  return `
    <div class="page-header"><h1 class="header">Calendar</h1></div>
    <div class="card">
      <div class="calendar-stats">
        <div class="calendar-stat-item">
          <div class="calendar-stat-label">Monthly P&L</div>
          <div class="calendar-stat-value" style="color:${monthPnL >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">
            ${monthPnL >= 0 ? '+' : ''}$${monthPnL.toFixed(2)}
          </div>
        </div>
        <div class="calendar-stat-item">
          <div class="calendar-stat-label">Trading Days</div>
          <div class="calendar-stat-value">${tradingDays}</div>
        </div>
        <div class="calendar-stat-item">
          <div class="calendar-stat-label">Green Days</div>
          <div class="calendar-stat-value positive">${winDays}</div>
        </div>
        <div class="calendar-stat-item">
          <div class="calendar-stat-label">Red Days</div>
          <div class="calendar-stat-value negative">${lossDays}</div>
        </div>
        <div class="calendar-stat-item">
          <div class="calendar-stat-label">Avg Daily</div>
          <div class="calendar-stat-value" style="color:${avgDaily >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">
            ${avgDaily >= 0 ? '+' : ''}$${Math.abs(avgDaily).toFixed(2)}
          </div>
        </div>
        <div class="calendar-stat-item">
          <div class="calendar-stat-label">Day Win Rate</div>
          <div class="calendar-stat-value">${tradingDays ? ((winDays / tradingDays) * 100).toFixed(1) : 0}%</div>
        </div>
      </div>
    </div>
    <div class="calendar-container">
      <div class="calendar-header">
        <button class="calendar-nav-btn" onclick="changeCalendarMonth(-1)">‹</button>
        <div class="calendar-month-title">${monthName}</div>
        <button class="calendar-nav-btn" onclick="changeCalendarMonth(1)">›</button>
      </div>
      <div class="calendar-grid">
        ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="calendar-day-header">${d}</div>`).join('')}
        ${cells.join('')}
      </div>
    </div>`;
}

// ── JOURNAL ───────────────────────────────────────────────
function journal() {
  const today = new Date().toISOString().split('T')[0];
  return `
    <div class="page-header"><h1 class="header">Journal</h1></div>
    <div class="card">
      <div class="card-title">New Entry</div>
      <div class="form-group">
        <label class="form-label">Date</label>
        <input type="date" class="form-input" id="jdate" value="${today}" style="max-width:220px">
      </div>
      <div class="form-group">
        <label class="form-label">Entry</label>
        <textarea class="form-textarea" id="jcontent" placeholder="What did you learn today? How did you execute? How did you feel?" style="min-height:140px"></textarea>
      </div>
      <div style="display:flex;gap:0.75rem;flex-wrap:wrap;align-items:center">
        <button class="btn btn-primary" id="jsave" onclick="doSaveJournal()">Save Entry</button>
        ${isPremium()
          ? `<button class="btn btn-ai btn-sm" id="ai-draft-btn" onclick="doAIJournalDraft()">✨ Draft from Today's Trades</button>`
          : aiLockedBtn("Draft from Today's Trades")}
      </div>
    </div>
    <div class="card">
      <div class="card-title">
        Past Entries
        <span class="card-title-count">${state.journalEntries.length}</span>
      </div>
      ${!state.journalEntries.length
        ? empty('📝', 'No entries yet', 'Start documenting your trading journey above')
        : state.journalEntries.map(e => `
            <div class="journal-entry">
              <button class="journal-delete" onclick="doDeleteJournal('${esc(e.id)}')" title="Delete entry">✕</button>
              <div class="journal-date">
                ${new Date(e.entry_date + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
              </div>
              <div class="journal-text">${esc(e.content).replace(/\n/g, '<br>')}</div>
            </div>`).join('')}
    </div>
    <div class="card">
      <div class="card-title">Trade Notes</div>
      ${!state.trades.filter(t => t.notes).length
        ? empty('💭', 'No trade notes', 'Add notes when logging trades')
        : state.trades.filter(t => t.notes).map(t => {
            const pnl = Number(t.pnl);
            const color = pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
            return `
              <div class="journal-entry" style="border-left-color:${color}">
                <div class="journal-date ${pnl >= 0 ? 'positive' : 'negative'}">
                  ${esc(t.symbol)} · ${t.exit_date ? new Date(t.exit_date).toLocaleDateString() : '—'}
                  <span style="margin-left:1rem">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}</span>
                </div>
                <div class="journal-text">${esc(t.notes)}</div>
              </div>`;
          }).join('')}
    </div>`;
}

// ── IMPORT ────────────────────────────────────────────────
function importView() {
  const p = state.csvParsed;
  return `
    <div class="page-header"><h1 class="header">Import Trades</h1></div>
    <div class="card">
      <div class="card-title">Upload CSV</div>
      <div class="drop-zone" id="drop-zone"
        onclick="document.getElementById('csv-file').click()"
        ondragover="event.preventDefault();this.classList.add('dragover')"
        ondragleave="this.classList.remove('dragover')"
        ondrop="handleDrop(event)">
        <div style="font-size:2.5rem;margin-bottom:0.75rem">📁</div>
        <h3>Drop CSV here or click to browse</h3>
        <p>Preview shown before any data is imported</p>
        <input type="file" accept=".csv" id="csv-file" style="display:none" onchange="handleCSVFile(event)">
        <button class="btn btn-primary" style="margin-top:1.25rem" onclick="event.stopPropagation();document.getElementById('csv-file').click()">
          Choose File
        </button>
      </div>
      ${p ? csvPreview(p) : ''}
    </div>
    <div class="card">
      <div class="card-title">Expected Format</div>
      <div class="csv-table-wrap">
        <table class="csv-table">
          <thead><tr>
            ${['symbol','asset_type','direction','entry_price','exit_price','quantity','entry_date','exit_date','strategy','commission'].map(h => `<th>${h}</th>`).join('')}
          </tr></thead>
          <tbody><tr>
            ${['AAPL','stock','long','178.50','182.30','100','2025-01-10','2025-01-10','Breakout','2.00'].map(v => `<td>${v}</td>`).join('')}
          </tr></tbody>
        </table>
      </div>
      <div style="margin-top:1rem">
        <a href="${api.getSampleCSVUrl()}" class="btn btn-secondary btn-sm" download>⬇ Download Sample CSV</a>
      </div>
    </div>`;
}

function csvPreview(p) {
  const valid = p.rows.filter(r => !r._error).length;
  const errs  = p.rows.filter(r => r._error).length;
  return `
    <div class="csv-preview">
      <div class="csv-preview-header">
        <span>
          📋 <strong>${p.rows.length}</strong> rows —
          <span class="positive">${valid} valid</span>
          ${errs ? ` · <span class="negative">${errs} errors</span>` : ''}
        </span>
        <div style="display:flex;gap:0.75rem">
          <button class="btn btn-secondary btn-sm" onclick="clearCSV()">Clear</button>
          <button class="btn btn-primary btn-sm" id="import-btn" onclick="doConfirmImport()" ${!valid ? 'disabled' : ''}>
            Import ${valid} Trade${valid !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
      <div class="csv-table-wrap">
        <table class="csv-table">
          <thead><tr>
            <th>#</th><th>Symbol</th><th>Type</th><th>Dir</th>
            <th>Entry</th><th>Exit</th><th>Qty</th><th>P&L</th><th>Status</th>
          </tr></thead>
          <tbody>
            ${p.rows.slice(0, 20).map((r, i) => `
              <tr>
                <td style="color:var(--text-secondary)">${i + 1}</td>
                <td>${esc(r.symbol || '—')}</td>
                <td>${esc(r.asset_type || '—')}</td>
                <td class="${r.direction === 'long' ? 'positive' : 'negative'}">${esc(r.direction || '—')}</td>
                <td>${r.entry_price || '—'}</td>
                <td>${r.exit_price || '—'}</td>
                <td>${r.quantity || '—'}</td>
                <td class="${r.pnl >= 0 ? 'positive' : 'negative'}">
                  ${r.pnl != null ? (r.pnl >= 0 ? '+' : '') + '$' + r.pnl.toFixed(2) : '—'}
                </td>
                <td class="${r._error ? 'row-error' : 'row-valid'}">${r._error ? esc(r._error) : '✓'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        ${p.rows.length > 20 ? `<p class="csv-more">Showing first 20 of ${p.rows.length} rows</p>` : ''}
      </div>
      ${state.csvImporting ? `
        <div style="margin-top:1rem">
          <div class="progress-bar"><div class="progress-fill" style="width:${state.csvProgress}%"></div></div>
          <div class="progress-text">Importing… ${state.csvProgress}%</div>
        </div>` : ''}
    </div>`;
}

// ── BROKERS ───────────────────────────────────────────────
function brokers() {
  const INFO = {
    alpaca:     { name:'Alpaca', icon:'🦙', desc:'US Stocks & Crypto. Free paper + live trading API.' },
    binance:    { name:'Binance', icon:'🟡', desc:'Crypto. Requires API key + secret from your Binance account.' },
    metatrader: { name:'MetaTrader 5', icon:'📉', desc:'Forex & CFDs. Requires MT5 API token from your broker.' },
    ibkr:       { name:'Interactive Brokers', icon:'🏦', desc:'Coming soon — requires TWS Gateway setup.', disabled: true },
  };

  return `
    <div class="page-header"><h1 class="header">Broker Connections</h1></div>
    ${state.brokers.length ? `
      <div class="card">
        <div class="card-title">Connected Brokers</div>
        ${state.brokers.map(b => `
          <div class="trade-item" style="cursor:default">
            <div class="trade-header">
              <div>
                <span class="trade-symbol">${esc(b.broker_name)}</span>
                ${b.account_id ? `<span class="broker-account">${esc(b.account_id)}</span>` : ''}
              </div>
              <div style="display:flex;gap:0.75rem;align-items:center">
                ${b.last_sync ? `<span class="broker-sync-time">Synced ${new Date(b.last_sync).toLocaleString()}</span>` : ''}
                <button class="btn btn-primary btn-sm" onclick="doSyncBroker('${esc(b.id)}','${esc(b.broker_name)}')">🔄 Sync</button>
                <button class="btn btn-danger btn-sm" onclick="doDeleteBroker('${esc(b.id)}')">✕</button>
              </div>
            </div>
          </div>`).join('')}
      </div>` : ''}
    <div class="card">
      <div class="card-title">Add Broker</div>
      <div class="broker-grid">
        ${Object.entries(INFO).map(([k, b]) => `
          <div class="trade-item ${b.disabled ? '' : 'broker-card'}"
            style="cursor:${b.disabled ? 'not-allowed' : 'pointer'};opacity:${b.disabled ? 0.5 : 1}"
            ${!b.disabled ? `onclick="showBrokerForm('${k}')"` : ''}>
            <div class="broker-icon">${b.icon}</div>
            <div class="broker-name">${b.name}</div>
            <div class="broker-desc">${b.desc}</div>
            ${b.disabled ? '<div class="broker-soon">Coming Soon</div>' : ''}
          </div>`).join('')}
      </div>
      <div id="broker-form"></div>
    </div>
    <div class="card">
      <div class="card-title">How It Works</div>
      <p style="color:var(--text-secondary);font-size:0.875rem;line-height:1.75">
        Connect a broker, click Sync, and Quantario fetches your completed trades automatically via the broker's API.
        Duplicates are skipped — sync as often as you like. Your API keys are stored securely on the server, never in the browser.
        For brokers without an API, export a CSV and use the Import tab.
      </p>
    </div>`;
}

function showBrokerForm(key) {
  const forms = {
    alpaca: `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">API Key ID</label>
          <input class="form-input" id="bk-key" placeholder="PKXXXXXXXXXXXXXXXX" autocomplete="off">
        </div>
        <div class="form-group">
          <label class="form-label">API Secret</label>
          <input type="password" class="form-input" id="bk-secret" autocomplete="off">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Mode</label>
        <select class="form-select" id="bk-paper" style="max-width:220px">
          <option value="true">Paper Trading</option>
          <option value="false">Live Trading</option>
        </select>
      </div>`,
    binance: `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">API Key</label>
          <input class="form-input" id="bk-key" placeholder="Your Binance API key" autocomplete="off">
        </div>
        <div class="form-group">
          <label class="form-label">API Secret</label>
          <input type="password" class="form-input" id="bk-secret" autocomplete="off">
        </div>
      </div>`,
    metatrader: `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">API Token</label>
          <input class="form-input" id="bk-key" placeholder="MT5 API token" autocomplete="off">
        </div>
        <div class="form-group">
          <label class="form-label">Account ID</label>
          <input class="form-input" id="bk-account" autocomplete="off">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">MT5 Server URL</label>
        <input class="form-input" id="bk-server" placeholder="https://mt5.yourbroker.com">
      </div>`
  };

  document.getElementById('broker-form').innerHTML = `
    <div class="broker-form-inner">
      <h3 class="broker-form-title">${INFO_ICONS[key] || ''} Connect ${key.charAt(0).toUpperCase() + key.slice(1)}</h3>
      ${forms[key] || ''}
      <div style="display:flex;gap:0.75rem;margin-top:1.25rem">
        <button class="btn btn-primary" onclick="doAddBroker('${key}')">Save Connection</button>
        <button class="btn btn-secondary" onclick="document.getElementById('broker-form').innerHTML=''">Cancel</button>
      </div>
    </div>`;
}

const INFO_ICONS = { alpaca:'🦙', binance:'🟡', metatrader:'📉' };

// ── TRADE MODAL ───────────────────────────────────────────
function tradeModal() {
  const t = state.selectedTrade;
  const isView = !!t;
  const d = t || {};
  const fmtDT = dt => dt ? new Date(dt).toISOString().slice(0, 16) : '';
  const assetTypes  = ['stock','forex','crypto','futures','options'];
  const pnl = Number(d.pnl);

  return `
    <div class="modal" onclick="closeTradeModal()">
      <div class="modal-content" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2 class="modal-title">${isView ? 'Trade Details' : 'New Trade'}</h2>
          <div style="display:flex;gap:0.5rem">
            ${isView ? `<button class="btn btn-secondary btn-sm" onclick="editCurrentTrade()">✏ Edit</button>` : ''}
            <button class="btn btn-secondary btn-sm" onclick="closeTradeModal()">✕ Close</button>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Symbol *</label>
            <input class="form-input" id="t-sym" placeholder="AAPL, EUR/USD, BTC…"
              value="${esc(d.symbol || '')}" ${isView ? 'disabled' : ''} autocomplete="off">
          </div>
          <div class="form-group">
            <label class="form-label">Asset Type</label>
            <select class="form-select" id="t-at" ${isView ? 'disabled' : ''}>
              ${assetTypes.map(v => `<option value="${v}" ${d.asset_type === v ? 'selected' : ''}>${v.charAt(0).toUpperCase() + v.slice(1)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Direction</label>
            <select class="form-select" id="t-dir" ${isView ? 'disabled' : ''}>
              <option value="long"  ${d.direction === 'long'  ? 'selected' : ''}>Long  (Buy)</option>
              <option value="short" ${d.direction === 'short' ? 'selected' : ''}>Short (Sell)</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Entry Price *</label>
            <input type="number" step="any" class="form-input" id="t-ep"
              value="${d.entry_price || ''}" ${isView ? 'disabled' : ''} placeholder="0.00">
          </div>
          <div class="form-group">
            <label class="form-label">Exit Price *</label>
            <input type="number" step="any" class="form-input" id="t-xp"
              value="${d.exit_price || ''}" ${isView ? 'disabled' : ''} placeholder="0.00">
          </div>
          <div class="form-group">
            <label class="form-label">Quantity *</label>
            <input type="number" step="any" class="form-input" id="t-qty"
              value="${d.quantity || ''}" ${isView ? 'disabled' : ''} placeholder="0">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Stop Loss</label>
            <input type="number" step="any" class="form-input" id="t-sl"
              value="${d.stop_loss || ''}" ${isView ? 'disabled' : ''} placeholder="Optional">
          </div>
          <div class="form-group">
            <label class="form-label">Take Profit</label>
            <input type="number" step="any" class="form-input" id="t-tp"
              value="${d.take_profit || ''}" ${isView ? 'disabled' : ''} placeholder="Optional">
          </div>
          <div class="form-group">
            <label class="form-label">Commission</label>
            <input type="number" step="any" class="form-input" id="t-com"
              value="${d.commission || 0}" ${isView ? 'disabled' : ''} placeholder="0.00">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Entry Date / Time</label>
            <input type="datetime-local" class="form-input" id="t-ed"
              value="${fmtDT(d.entry_date)}" ${isView ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label class="form-label">Exit Date / Time</label>
            <input type="datetime-local" class="form-input" id="t-xd"
              value="${fmtDT(d.exit_date)}" ${isView ? 'disabled' : ''}>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Strategy</label>
            <input class="form-input" id="t-strat" placeholder="Breakout, Trend Following, Scalp…"
              value="${esc(d.strategy || '')}" ${isView ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label class="form-label">Market Conditions</label>
            <input class="form-input" id="t-cond" placeholder="Bullish, Ranging, News…"
              value="${esc(d.market_conditions || '')}" ${isView ? 'disabled' : ''}>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea class="form-textarea" id="t-notes"
            placeholder="Your reasoning, emotions, lessons learned…"
            ${isView ? 'disabled' : ''}>${esc(d.notes || '')}</textarea>
        </div>

        ${isView ? `
          <div class="pnl-result" style="border-color:${pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">
            <div class="stat-label">Final P&L</div>
            <div class="stat-value" style="color:${pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">
              ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}
            </div>
          </div>

          <!-- ── AI DEBRIEF ── -->
          <div class="ai-debrief-section">
            <div class="ai-debrief-label">✨ AI Trade Debrief</div>
            ${isPremium() ? `
              <button class="btn btn-ai btn-sm" id="ai-debrief-btn"
                onclick="doAIDebrief('${esc(d.id)}')">
                ${state.aiDebrief.tradeId === d.id && state.aiDebrief.loading
                  ? '<span class="spinner"></span> Analysing…'
                  : state.aiDebrief.tradeId === d.id && state.aiDebrief.text
                    ? '↺ New Debrief'
                    : '✨ Get AI Debrief'}
              </button>
              ${state.aiDebrief.tradeId === d.id && (state.aiDebrief.text || state.aiDebrief.loading)
                ? `<div class="ai-debrief-card" id="ai-debrief-container">
                    <div class="ai-debrief-text" id="ai-debrief-text">${esc(state.aiDebrief.text)}</div>
                    ${state.aiDebrief.loading ? '<span class="ai-cursor"></span>' : ''}
                   </div>`
                : '<div class="ai-debrief-card" id="ai-debrief-container" style="display:none"><div class="ai-debrief-text" id="ai-debrief-text"></div></div>'
              }
            ` : aiLockedBtn('Get AI Debrief')}
          </div>

          <div class="modal-actions">
            <button class="btn btn-danger" onclick="doDeleteTrade('${esc(d.id)}')">Delete Trade</button>
            <button class="btn btn-secondary" onclick="closeTradeModal()">Close</button>
          </div>` : `
          <div class="modal-actions">
            <button class="btn btn-primary" id="save-btn" onclick="doSaveTrade()">Save Trade</button>
            <button class="btn btn-secondary" onclick="closeTradeModal()">Cancel</button>
          </div>`}
      </div>
    </div>`;
}

// ── NAVIGATION ────────────────────────────────────────────
function changeView(v) {
  state.currentView = v;
  document.getElementById('mobile-more-sheet')?.remove();
  render();
  // Scroll main content back to top
  const mc = document.querySelector('.main-content');
  if (mc) mc.scrollTop = 0;
  window.scrollTo(0, 0);
}
function openAddTradeModal()    { state.selectedTrade = null; state._editingTrade = null; state.showTradeModal = true; render(); }
function closeTradeModal()      { state.showTradeModal = false; state.selectedTrade = null; state._editingTrade = null; render(); }
function updateFilter(type, val){ type === 'assetType' ? state.filterAssetType = val : state.filterDirection = val; render(); }
function changeCalendarMonth(d) { const dt = new Date(state.calendarDate); dt.setMonth(dt.getMonth() + d); state.calendarDate = dt; render(); }

function editCurrentTrade() {
  // Re-open the currently viewed trade in edit mode
  if (!state.selectedTrade) return;
  const id = state.selectedTrade.id;
  const t  = state.trades.find(tr => String(tr.id) === String(id));
  if (!t) return;
  state.selectedTrade = null; // open in add-mode but pre-fill
  state.showTradeModal = true;
  state._editingTrade = t;    // store for prefill
  render();
  // pre-fill fields after render
  const fmtDT = dt => dt ? new Date(dt).toISOString().slice(0, 16) : '';
  requestAnimationFrame(() => {
    if (document.getElementById('t-sym'))   document.getElementById('t-sym').value   = t.symbol || '';
    if (document.getElementById('t-at'))    document.getElementById('t-at').value    = t.asset_type || 'stock';
    if (document.getElementById('t-dir'))   document.getElementById('t-dir').value   = t.direction || 'long';
    if (document.getElementById('t-ep'))    document.getElementById('t-ep').value    = t.entry_price || '';
    if (document.getElementById('t-xp'))    document.getElementById('t-xp').value    = t.exit_price  || '';
    if (document.getElementById('t-qty'))   document.getElementById('t-qty').value   = t.quantity    || '';
    if (document.getElementById('t-sl'))    document.getElementById('t-sl').value    = t.stop_loss   || '';
    if (document.getElementById('t-tp'))    document.getElementById('t-tp').value    = t.take_profit || '';
    if (document.getElementById('t-com'))   document.getElementById('t-com').value   = t.commission  || '';
    if (document.getElementById('t-ed'))    document.getElementById('t-ed').value    = fmtDT(t.entry_date);
    if (document.getElementById('t-xd'))    document.getElementById('t-xd').value    = fmtDT(t.exit_date);
    if (document.getElementById('t-strat')) document.getElementById('t-strat').value = t.strategy    || '';
    if (document.getElementById('t-cond'))  document.getElementById('t-cond').value  = t.market_conditions || '';
    if (document.getElementById('t-notes')) document.getElementById('t-notes').value = t.notes       || '';
    // Switch save button to update mode
    const btn = document.getElementById('save-btn');
    if (btn) { btn.textContent = 'Update Trade'; btn.onclick = () => doUpdateTrade(t.id); }
    // Update title
    const title = document.querySelector('.modal-title');
    if (title) title.textContent = 'Edit Trade';
  });
}

async function doUpdateTrade(id) {
  const btn = document.getElementById('save-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…'; }
  const sym = (document.getElementById('t-sym').value || '').trim().toUpperCase();
  const ep  = parseFloat(document.getElementById('t-ep').value);
  const xp  = parseFloat(document.getElementById('t-xp').value);
  const qty = parseFloat(document.getElementById('t-qty').value);
  if (!sym || isNaN(ep) || isNaN(xp) || isNaN(qty) || qty <= 0) {
    toast(!sym || isNaN(ep) || isNaN(xp) || isNaN(qty)
      ? 'Symbol, entry price, exit price and quantity are required'
      : 'Quantity must be greater than zero', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Update Trade'; }
    return;
  }
  try {
    state.syncing = true;
    const res = await api.updateTrade(id, {
      symbol:            sym,
      entry_price:       ep, exit_price: xp, quantity: qty,
      asset_type:        document.getElementById('t-at').value,
      direction:         document.getElementById('t-dir').value,
      commission:        parseFloat(document.getElementById('t-com').value) || 0,
      entry_date:        document.getElementById('t-ed').value  || null,
      exit_date:         document.getElementById('t-xd').value  || null,
      stop_loss:         parseFloat(document.getElementById('t-sl').value)   || null,
      take_profit:       parseFloat(document.getElementById('t-tp').value)   || null,
      strategy:          document.getElementById('t-strat').value || null,
      notes:             document.getElementById('t-notes').value || null,
      market_conditions: document.getElementById('t-cond').value  || null,
    });
    const idx = state.trades.findIndex(t => String(t.id) === String(id));
    if (idx >= 0) state.trades[idx] = res.data;
    state.syncing = false;
    toast(`${sym} updated!`, 'success');
    closeTradeModal();
  } catch (err) {
    state.syncing = false;
    toast(`Update failed: ${err.message}`, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Update Trade'; }
  }
}

function viewTrade(id) {
  state.selectedTrade = state.trades.find(t => String(t.id) === String(id)) || null;
  state.showTradeModal = true;
  render();
}

function viewCalendarDay(ds) {
  const date = new Date(ds + 'T12:00:00');
  const dayTrades = state.trades.filter(t =>
    t.exit_date && new Date(t.exit_date).toDateString() === date.toDateString()
  );
  if (!dayTrades.length) return;

  const totalPnL = dayTrades.reduce((s, t) => s + Number(t.pnl), 0);
  const dateLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  // Show a lightweight inline modal with trade list
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-box" style="max-width:440px;width:92vw">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <div>
          <div style="font-weight:700;font-size:1rem">${dateLabel}</div>
          <div style="font-size:0.82rem;color:var(--text-secondary)">${dayTrades.length} trade${dayTrades.length !== 1 ? 's' : ''}</div>
        </div>
        <span class="${totalPnL >= 0 ? 'positive' : 'negative'}" style="font-size:1.15rem;font-weight:800">
          ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}
        </span>
      </div>
      <div style="max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:0.5rem">
        ${dayTrades.map(t => {
          const pnl = Number(t.pnl);
          return `<div style="background:var(--bg-secondary);border-radius:8px;padding:0.6rem 0.75rem;cursor:pointer"
            onclick="this.closest('.confirm-overlay').remove();viewTrade('${esc(t.id)}')">
            <div style="display:flex;justify-content:space-between">
              <span style="font-weight:700">${esc(t.symbol)}</span>
              <span class="${pnl >= 0 ? 'positive' : 'negative'}">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}</span>
            </div>
            <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px">
              ${t.direction} · ${t.asset_type}${t.strategy ? ' · ' + esc(t.strategy) : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="confirm-actions" style="margin-top:1rem">
        <button class="btn btn-secondary btn-sm confirm-cancel">Close</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.confirm-cancel').onclick = () => overlay.remove();
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.remove(); });
}

// ── TRADE ACTIONS ─────────────────────────────────────────
async function doSaveTrade() {
  const btn = document.getElementById('save-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…'; }

  const sym  = (document.getElementById('t-sym').value || '').trim().toUpperCase();
  const ep   = parseFloat(document.getElementById('t-ep').value);
  const xp   = parseFloat(document.getElementById('t-xp').value);
  const qty  = parseFloat(document.getElementById('t-qty').value);

  if (!sym || isNaN(ep) || isNaN(xp) || isNaN(qty) || qty <= 0) {
    toast(!sym || isNaN(ep) || isNaN(xp) || isNaN(qty)
      ? 'Symbol, entry price, exit price and quantity are required'
      : 'Quantity must be greater than zero', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Save Trade'; }
    return;
  }

  try {
    state.syncing = true;
    const res = await api.createTrade({
      symbol:            sym,
      entry_price:       ep,
      exit_price:        xp,
      quantity:          qty,
      asset_type:        document.getElementById('t-at').value,
      direction:         document.getElementById('t-dir').value,
      commission:        parseFloat(document.getElementById('t-com').value) || 0,
      entry_date:        document.getElementById('t-ed').value  || null,
      exit_date:         document.getElementById('t-xd').value  || null,
      stop_loss:         parseFloat(document.getElementById('t-sl').value)   || null,
      take_profit:       parseFloat(document.getElementById('t-tp').value)   || null,
      strategy:          document.getElementById('t-strat').value || null,
      notes:             document.getElementById('t-notes').value || null,
      market_conditions: document.getElementById('t-cond').value  || null,
    });
    state.trades.unshift(res.data);
    state.syncing = false;
    toast(`${sym} saved — ${Number(res.data.pnl) >= 0 ? '+' : ''}$${Number(res.data.pnl).toFixed(2)}`, 'success');
    closeTradeModal();
  } catch (err) {
    state.syncing = false;
    toast(`Save failed: ${err.message}`, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Save Trade'; }
  }
}

async function doDeleteTrade(id) {
  showConfirm('Delete this trade? This cannot be undone.', async () => {
    try {
      state.syncing = true;
      await api.deleteTrade(id);
      state.trades = state.trades.filter(t => String(t.id) !== String(id));
      state.syncing = false;
      // Close the trade modal if the deleted trade was being viewed
      state.showTradeModal = false;
      state.selectedTrade  = null;
      toast('Trade deleted', 'info');
      render();
    } catch (err) {
      state.syncing = false;
      toast(`Delete failed: ${err.message}`, 'error');
    }
  });
}

// ── JOURNAL ACTIONS ───────────────────────────────────────
async function doSaveJournal() {
  const btn     = document.getElementById('jsave');
  const date    = document.getElementById('jdate').value;
  const content = document.getElementById('jcontent').value.trim();

  if (!date || !content) { toast('Date and content are required', 'error'); return; }

  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…'; }
  try {
    state.syncing = true;
    const res = await api.createJournal({ entry_date: date, content });
    state.journalEntries.unshift(res.data);
    state.syncing = false;
    toast('Journal entry saved!', 'success');
    render();
  } catch (err) {
    state.syncing = false;
    toast(`Save failed: ${err.message}`, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Save Entry'; }
  }
}

async function doDeleteJournal(id) {
  showConfirm('Delete this journal entry?', async () => {
    try {
      await api.deleteJournal(id);
      state.journalEntries = state.journalEntries.filter(e => String(e.id) !== String(id));
      toast('Entry deleted', 'info');
      render();
    } catch (err) {
      toast(`Delete failed: ${err.message}`, 'error');
    }
  });
}

// ── CSV IMPORT ────────────────────────────────────────────
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (f && f.name.endsWith('.csv')) {
    if (f.size > 5 * 1024 * 1024) { toast('CSV file must be smaller than 5 MB', 'error'); return; }
    uploadCSV(f);
  } else toast('Please drop a .csv file', 'error');
}

function handleCSVFile(e) {
  const f = e.target.files[0];
  if (!f) return;
  if (f.size > 5 * 1024 * 1024) { toast('CSV file must be smaller than 5 MB', 'error'); e.target.value = ''; return; }
  uploadCSV(f);
}

async function uploadCSV(file) {
  const fd = new FormData();
  fd.append('file', file);
  try {
    toast('Parsing CSV…', 'info', 2000);
    const res = await api.previewCSV(fd);
    state.csvParsed = res.data;
    render();
  } catch (err) {
    toast(`Parse error: ${err.message}`, 'error');
  }
}

async function doConfirmImport() {
  if (!state.csvParsed) return;
  const valid = state.csvParsed.rows.filter(r => !r._error);
  state.csvImporting = true; state.csvProgress = 10; render();
  try {
    state.csvProgress = 50; render();
    const res = await api.confirmImport(valid);
    state.csvProgress = 100;
    const fresh = await api.getTrades();
    state.trades = fresh.data;
    state.csvParsed = null;
    state.csvImporting = false;
    toast(`Imported ${res.imported} trade${res.imported !== 1 ? 's' : ''}!`, 'success');
    render();
  } catch (err) {
    state.csvImporting = false;
    toast(`Import failed: ${err.message}`, 'error');
    render();
  }
}

function clearCSV() { state.csvParsed = null; render(); }

// ── BROKER ACTIONS ────────────────────────────────────────
async function doAddBroker(key) {
  const api_key    = document.getElementById('bk-key')?.value?.trim();
  const api_secret = document.getElementById('bk-secret')?.value?.trim();
  const account_id = document.getElementById('bk-account')?.value?.trim();
  if (!api_key) { toast('API key is required', 'error'); return; }
  try {
    const res = await api.addBroker({ broker_name: key, api_key, api_secret, account_id });
    state.brokers.push(res.data);
    toast(`${key} connected successfully!`, 'success');
    render();
  } catch (err) {
    toast(`Connection failed: ${err.message}`, 'error');
  }
}

async function doSyncBroker(id, name) {
  toast(`Syncing ${name}…`, 'info', 3000);
  try {
    const res = await api.syncBroker(id);
    if (res.imported > 0) {
      const fresh = await api.getTrades();
      state.trades = fresh.data;
    }
    const idx = state.brokers.findIndex(b => b.id === id);
    if (idx >= 0) state.brokers[idx].last_sync = new Date().toISOString();
    toast(`Synced ${res.imported} trade${res.imported !== 1 ? 's' : ''} from ${name}`, 'success');
    render();
  } catch (err) {
    toast(`Sync failed: ${err.message}`, 'error');
  }
}

async function doDeleteBroker(id) {
  showConfirm('Remove this broker connection?', async () => {
    try {
      await api.deleteBroker(id);
      state.brokers = state.brokers.filter(b => b.id !== id);
      toast('Broker removed', 'info');
      render();
    } catch (err) {
      toast(`Delete failed: ${err.message}`, 'error');
    }
  }, { confirmLabel: 'Remove', confirmClass: 'btn-danger' });
}


// ── PROFILE MODAL ─────────────────────────────────────────
function openProfileModal()  { state.showProfileModal = true;  render(); }
function closeProfileModal() { state.showProfileModal = false; render(); }

function profileModal() {
  const user    = getUser() || {};
  const initial = (user.name || 'U').charAt(0).toUpperCase();
  const ps      = calcStats(state.trades); // compute once
  return `
    <div class="modal" onclick="closeProfileModal()">
      <div class="modal-content" style="max-width:520px" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2 class="modal-title">Profile & Settings</h2>
          <button class="btn btn-secondary btn-sm" onclick="closeProfileModal()">✕ Close</button>
        </div>

        <!-- Avatar + name -->
        <div class="profile-header">
          <div class="profile-avatar">${esc(initial)}</div>
          <div>
            <div class="profile-name">${esc(user.name || 'User')}</div>
            <div class="profile-email">${esc(user.email || '')}</div>
            <div class="profile-joined">Member since ${user.created_at ? new Date(user.created_at).toLocaleDateString('en-US',{month:'long',year:'numeric'}) : '—'}</div>
          </div>
        </div>

        <!-- Stats summary -->
        <div class="profile-stats">
          <div class="profile-stat">
            <div class="profile-stat-value">${state.trades.length}</div>
            <div class="profile-stat-label">Total Trades</div>
          </div>
          <div class="profile-stat">
            <div class="profile-stat-value">${state.journalEntries.length}</div>
            <div class="profile-stat-label">Journal Entries</div>
          </div>
          <div class="profile-stat">
            <div class="profile-stat-value ${ps.totalPnL >= 0 ? 'positive' : 'negative'}">
              ${ps.totalPnL >= 0 ? '+' : ''}$${ps.totalPnL.toFixed(0)}
            </div>
            <div class="profile-stat-label">Total P&L</div>
          </div>
          <div class="profile-stat">
            <div class="profile-stat-value">${ps.winRate}%</div>
            <div class="profile-stat-label">Win Rate</div>
          </div>
        </div>

        <!-- Divider -->
        <div class="profile-section-title">Edit Profile</div>

        <!-- Update name -->
        <div class="form-group">
          <label class="form-label">Display Name</label>
          <input class="form-input" id="profile-name" value="${esc(user.name || '')}" placeholder="Your name">
        </div>
        <div style="margin-bottom:1.5rem">
          <button class="btn btn-primary btn-sm" id="update-name-btn" onclick="doUpdateName()">Update Name</button>
        </div>

        <!-- Change password -->
        <div class="profile-section-title">Change Password</div>
        <div class="form-group">
          <label class="form-label">Current Password</label>
          <input type="password" class="form-input" id="profile-cur-pw" placeholder="Your current password" autocomplete="current-password">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">New Password</label>
            <input type="password" class="form-input" id="profile-new-pw" placeholder="Min 6 characters" autocomplete="new-password">
          </div>
          <div class="form-group">
            <label class="form-label">Confirm New Password</label>
            <input type="password" class="form-input" id="profile-confirm-pw" placeholder="Repeat new password" autocomplete="new-password">
          </div>
        </div>
        <div style="margin-bottom:1.5rem">
          <button class="btn btn-secondary btn-sm" id="update-pw-btn" onclick="doUpdatePassword()">Change Password</button>
        </div>

        <!-- Danger zone -->
        <div class="profile-section-title danger">Danger Zone</div>
        <div class="danger-zone">
          <div>
            <div style="font-weight:600;margin-bottom:0.25rem">Export My Data</div>
            <div style="font-size:0.8rem;color:var(--text-secondary)">Download all your trades as a CSV file</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="doExportData()">⬇ Export</button>
        </div>
        <div class="danger-zone" style="margin-top:0.75rem">
          <div>
            <div style="font-weight:600;margin-bottom:0.25rem;color:var(--accent-red)">Delete Account</div>
            <div style="font-size:0.8rem;color:var(--text-secondary)">Permanently delete your account and all data</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="doDeleteAccount()">Delete</button>
        </div>

      </div>
    </div>`;
}

async function doUpdateName() {
  const name = document.getElementById('profile-name').value.trim();
  if (!name) { toast('Name cannot be empty', 'error'); return; }
  const btn = document.getElementById('update-name-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  try {
    const res = await api.updateProfile({ name });
    saveAuth(res.token, res.user);
    toast('Name updated!', 'success');
    btn.disabled = false; btn.textContent = 'Update Name';
    render();
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false; btn.textContent = 'Update Name';
  }
}

async function doUpdatePassword() {
  const currentPassword = document.getElementById('profile-cur-pw').value;
  const newPassword     = document.getElementById('profile-new-pw').value;
  const confirm         = document.getElementById('profile-confirm-pw').value;
  if (!currentPassword || !newPassword) { toast('All password fields required', 'error'); return; }
  if (newPassword.length < 6) { toast('New password must be at least 6 characters', 'error'); return; }
  if (newPassword !== confirm) { toast('New passwords do not match', 'error'); return; }
  const btn = document.getElementById('update-pw-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  try {
    await api.updateProfile({ currentPassword, newPassword });
    toast('Password changed successfully!', 'success');
    document.getElementById('profile-cur-pw').value = '';
    document.getElementById('profile-new-pw').value = '';
    document.getElementById('profile-confirm-pw').value = '';
    btn.disabled = false; btn.textContent = 'Change Password';
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false; btn.textContent = 'Change Password';
  }
}

function doExportData() {
  if (!state.trades.length) { toast('No trades to export', 'warn'); return; }
  const headers = ['symbol','asset_type','direction','entry_price','exit_price','quantity','pnl','commission','entry_date','exit_date','strategy','market_conditions','notes','broker'];
  const rows = state.trades.map(t => headers.map(h => {
    const v = t[h] == null ? '' : String(t[h]);
    return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g,'""')}"` : v;
  }).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `quantario-export-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
  toast('Export downloaded!', 'success');
}

async function doDeleteAccount() {
  showConfirm(
    'This will permanently delete your account and all trade data. This cannot be undone.',
    () => {
      showPrompt('Enter your password to confirm deletion:', async (password) => {
        if (!password) return;
        try {
          await api.deleteAccount({ password, confirmText: 'DELETE' });
          toast('Account deleted. Goodbye!', 'info', 3000);
          setTimeout(() => { clearAuth(); window.location.href = '/login'; }, 2000);
        } catch (err) {
          toast(err.message, 'error');
        }
      }, 'Your password');
    },
    { confirmLabel: 'Continue', confirmClass: 'btn-danger',
      requireInput: 'DELETE', inputPlaceholder: 'Type DELETE to confirm' }
  );
}

// ── AI ACTIONS ────────────────────────────────────────────
function doAIDebrief(tradeId) {
  // Look up trade from state by ID — never deserialise user data from onclick attributes
  const trade = state.trades.find(t => String(t.id) === String(tradeId)) || state.selectedTrade;
  if (!trade) { toast('Trade not found', 'error'); return; }
  if (!isPremium()) { showUpgradeModal(); return; }

  state.aiDebrief = { loading: true, text: '', error: null, tradeId: trade.id };

  // Update button and container directly — no full re-render during streaming
  const btn       = document.getElementById('ai-debrief-btn');
  const container = document.getElementById('ai-debrief-container');
  const textEl    = document.getElementById('ai-debrief-text');

  if (btn)       { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Analysing…'; }
  if (container) { container.style.display = 'block'; }
  if (textEl)    { textEl.textContent = ''; }

  // Add blinking cursor
  if (container) {
    let cursor = container.querySelector('.ai-cursor');
    if (!cursor) { cursor = document.createElement('span'); cursor.className = 'ai-cursor'; container.appendChild(cursor); }
  }

  streamAI('/ai/debrief', { trade },
    (chunk) => {
      state.aiDebrief.text += chunk;
      if (textEl) textEl.textContent = state.aiDebrief.text;
    },
    () => {
      state.aiDebrief.loading = false;
      container?.querySelector('.ai-cursor')?.remove();
      if (btn) { btn.disabled = false; btn.innerHTML = '↺ New Debrief'; }
    },
    (err) => {
      state.aiDebrief.loading = false;
      container?.querySelector('.ai-cursor')?.remove();
      if (err === 'upgrade') { showUpgradeModal(); return; }
      if (textEl) textEl.textContent = '⚠️ ' + err;
      if (btn) { btn.disabled = false; btn.innerHTML = '✨ Get AI Debrief'; }
    }
  );
}

function doAIPatterns() {
  if (!isPremium()) { showUpgradeModal(); return; }

  state.aiPatterns = { loading: true, text: '', error: null, ran: true };

  const btn    = document.getElementById('ai-patterns-btn');
  const textEl = document.getElementById('ai-patterns-text');

  if (btn)    { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Analysing…'; }
  if (textEl) { textEl.innerHTML = '<span class="ai-cursor"></span>'; }

  let accumulated = '';

  streamAI('/ai/patterns', {},
    (chunk) => {
      accumulated += chunk;
      state.aiPatterns.text = accumulated;
      if (textEl) {
        textEl.innerHTML = esc(accumulated).replace(/\n/g, '<br>') + '<span class="ai-cursor"></span>';
      }
    },
    () => {
      state.aiPatterns.loading = false;
      if (textEl) textEl.innerHTML = esc(accumulated).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g,'<br>');
      if (btn)    { btn.disabled = false; btn.innerHTML = '↺ Re-analyse'; }
    },
    (err) => {
      state.aiPatterns.loading = false;
      state.aiPatterns.text = '';
      if (err === 'upgrade') { showUpgradeModal(); return; }
      toast(err, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = 'Analyse My Trades'; }
    }
  );
}

function doAIJournalDraft() {
  if (!isPremium()) { showUpgradeModal(); return; }

  const btn     = document.getElementById('ai-draft-btn');
  const textarea = document.getElementById('jcontent');

  if (!textarea) return;
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Drafting…'; }

  const existingText = textarea.value.trim();
  textarea.value = '';
  textarea.placeholder = 'AI is writing your draft…';

  let accumulated = '';

  streamAI('/ai/journal-draft', { existingText },
    (chunk) => {
      accumulated += chunk;
      textarea.value = accumulated;
      // Auto-scroll textarea to bottom
      textarea.scrollTop = textarea.scrollHeight;
    },
    () => {
      textarea.placeholder = 'What did you learn today? How did you execute? How did you feel?';
      if (btn) { btn.disabled = false; btn.innerHTML = '✨ Draft from Today\'s Trades'; }
      toast('Draft ready — edit it and save!', 'success');
    },
    (err) => {
      textarea.value = existingText;
      textarea.placeholder = 'What did you learn today? How did you execute? How did you feel?';
      if (err === 'upgrade') { showUpgradeModal(); return; }
      toast(err, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '✨ Draft from Today\'s Trades'; }
    }
  );
}

// ── AUTH ──────────────────────────────────────────────────
function handleLogout() {
  showConfirm('Log out of Quantario?', () => {
    clearAuth();
    window.location.href = '/login';
  }, { confirmLabel: 'Log out', confirmClass: 'btn-secondary' });
}

// ── MOBILE MORE SHEET ─────────────────────────────────────
function toggleMobileMore() {
  const existing = document.getElementById('mobile-more-sheet');
  if (existing) { existing.remove(); return; }
  const sheet = document.createElement('div');
  sheet.id = 'mobile-more-sheet';
  sheet.className = 'mobile-more-sheet';
  const items = [
    { id: 'journal',  label: 'Journal',  icon: NAV_ICONS.journal },
    { id: 'calendar', label: 'Calendar', icon: NAV_ICONS.calendar },
    { id: 'import',   label: 'Import',   icon: NAV_ICONS.import },
    { id: 'brokers',  label: 'Brokers',  icon: NAV_ICONS.brokers },
  ];
  sheet.innerHTML = `
    <div class="mobile-more-backdrop" onclick="this.parentElement.remove()"></div>
    <div class="mobile-more-content">
      <div class="mobile-more-handle"></div>
      <div class="mobile-more-title">More</div>
      <div class="mobile-more-grid">
        ${items.map(item => `
          <button class="mobile-more-item ${state.currentView === item.id ? 'active' : ''}"
            onclick="document.getElementById('mobile-more-sheet')?.remove(); changeView('${item.id}')">
            <span class="mobile-more-icon">${item.icon}</span>
            <span>${item.label}</span>
          </button>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(sheet);
}

// ── INIT ──────────────────────────────────────────────────
init();
