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
  theme: localStorage.getItem('q_theme') || 'dark',
  goals: JSON.parse(localStorage.getItem('q_goals') || 'null') || { daily: '', weekly: '', monthly: '' },
  showOnboarding: !localStorage.getItem('q_onboarded'),
  onboardingStep: 1,
  // ── AI ──
  aiDebrief:  { loading: false, text: '', error: null, tradeId: null },
  aiPatterns: { loading: false, text: '', error: null, ran: false },
  showUpgradeModal: false,
};

// Apply theme immediately
(function() {
  var t = localStorage.getItem('q_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
  if (document.body) document.body.setAttribute('data-theme', t);
})();

function toggleTheme() {
  var next = state.theme === 'dark' ? 'light' : 'dark';
  state.theme = next;
  localStorage.setItem('q_theme', next);
  document.documentElement.setAttribute('data-theme', next);
  document.body.setAttribute('data-theme', next);
  render();
}

function themeToggleBtn() {
  var isDark = state.theme === 'dark';
  var icon = isDark
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> Light Mode'
    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> Dark Mode';
  return '<button class="btn-theme-toggle btn-sm" style="width:100%;margin-top:0.5rem" onclick="toggleTheme()">' + icon + '</button>';
}

function themeIconBtn() {
  var isDark = state.theme === 'dark';
  var icon = isDark
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  return '<button class="btn-icon-theme" onclick="toggleTheme()" title="Toggle theme">' + icon + '</button>';
}

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
        input.style.borderColor = 'var(--red)';
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
  profile:     `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  goals:       `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  riskcalc:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="12" y2="18"/></svg>`,
  leaderboard: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="12" width="6" height="10"/><rect x="9" y="7" width="6" height="15"/><rect x="16" y="3" width="6" height="19"/></svg>`,
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
          <div class="logo-icon"><svg width="34" height="34" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="qlogo" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FF6535"/><stop offset="100%" stop-color="#FF2D6B"/></linearGradient></defs><circle cx="16" cy="16" r="14" stroke="url(#qlogo)" stroke-width="2.5" fill="none"/><circle cx="16" cy="16" r="5" fill="url(#qlogo)" opacity="0.10"/><circle cx="16" cy="16" r="2.2" fill="url(#qlogo)"/><circle cx="16" cy="4.5" r="1.8" fill="url(#qlogo)"/><circle cx="16" cy="27.5" r="1.8" fill="url(#qlogo)"/><circle cx="4.5" cy="16" r="1.8" fill="url(#qlogo)"/><circle cx="27.5" cy="16" r="1.8" fill="url(#qlogo)"/></svg></div>
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
          <button class="nav-item ${state.currentView === 'journal'     ? 'active' : ''}" onclick="changeView('journal')    "><span class="nav-icon">${NAV_ICONS.journal}</span>Journal</button>
          <button class="nav-item ${state.currentView === 'import'      ? 'active' : ''}" onclick="changeView('import')     "><span class="nav-icon">${NAV_ICONS.import}</span>Import</button>
          <button class="nav-item ${state.currentView === 'brokers'     ? 'active' : ''}" onclick="changeView('brokers')    "><span class="nav-icon">${NAV_ICONS.brokers}</span>Brokers</button>
          <div class="nav-section-label">MORE</div>
          <button class="nav-item ${state.currentView === 'goals'       ? 'active' : ''}" onclick="changeView('goals')      "><span class="nav-icon">${NAV_ICONS.goals}</span>Goals</button>
          <button class="nav-item ${state.currentView === 'riskcalc'    ? 'active' : ''}" onclick="changeView('riskcalc')   "><span class="nav-icon">${NAV_ICONS.riskcalc}</span>Risk Calc</button>
          <button class="nav-item ${state.currentView === 'leaderboard' ? 'active' : ''}" onclick="changeView('leaderboard')"><span class="nav-icon">${NAV_ICONS.leaderboard}</span>Leaderboard</button>
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
          ${themeToggleBtn()}
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
            <div class="logo-icon" style="width:22px;height:22px"><svg width="28" height="28" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="qlogot" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FF6535"/><stop offset="100%" stop-color="#FF2D6B"/></linearGradient></defs><circle cx="16" cy="16" r="14" stroke="url(#qlogot)" stroke-width="2.5" fill="none"/><circle cx="16" cy="16" r="5" fill="url(#qlogot)" opacity="0.10"/><circle cx="16" cy="16" r="2.2" fill="url(#qlogot)"/><circle cx="16" cy="4.5" r="1.8" fill="url(#qlogot)"/><circle cx="16" cy="27.5" r="1.8" fill="url(#qlogot)"/><circle cx="4.5" cy="16" r="1.8" fill="url(#qlogot)"/><circle cx="27.5" cy="16" r="1.8" fill="url(#qlogot)"/></svg></div>
            <div class="logo-text" style="font-size:0.9rem">Quan<span>tario</span></div>
          </div>
          <div style="display:flex;align-items:center;gap:0.5rem">
            ${themeIconBtn()}
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
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="qlogot" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FF6535"/><stop offset="100%" stop-color="#FF2D6B"/></linearGradient></defs><circle cx="16" cy="16" r="14" stroke="url(#qlogot)" stroke-width="2.5" fill="none"/><circle cx="16" cy="16" r="5" fill="url(#qlogot)" opacity="0.10"/><circle cx="16" cy="16" r="2.2" fill="url(#qlogot)"/><circle cx="16" cy="4.5" r="1.8" fill="url(#qlogot)"/><circle cx="16" cy="27.5" r="1.8" fill="url(#qlogot)"/><circle cx="4.5" cy="16" r="1.8" fill="url(#qlogot)"/><circle cx="27.5" cy="16" r="1.8" fill="url(#qlogot)"/></svg>
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
      ${state.showOnboarding && !state.loading ? onboardingModal() : ''}
    </div>
  `;
}

function renderView(stats) {
  switch (state.currentView) {
    case 'dashboard':   return dashboard(stats);
    case 'trades':      return tradesView();
    case 'analytics':   return analytics(stats);
    case 'calendar':    return calendar();
    case 'journal':     return journal();
    case 'import':      return importView();
    case 'brokers':     return brokers();
    case 'goals':       return goalsView(stats);
    case 'riskcalc':    return riskCalcView();
    case 'leaderboard': return leaderboardView(stats);
    default:            return dashboard(stats);
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
  const pnlColor = pnl >= 0 ? 'var(--orange)' : 'var(--red)';
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
          <div class="calendar-stat-value" style="color:${monthPnL >= 0 ? 'var(--orange)' : 'var(--red)'}">
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
          <div class="calendar-stat-value" style="color:${avgDaily >= 0 ? 'var(--orange)' : 'var(--red)'}">
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
            const color = pnl >= 0 ? 'var(--orange)' : 'var(--red)';
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
          <div class="pnl-result" style="border-color:${pnl >= 0 ? 'var(--orange)' : 'var(--red)'}">
            <div class="stat-label">Final P&L</div>
            <div class="stat-value" style="color:${pnl >= 0 ? 'var(--orange)' : 'var(--red)'}">
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
          return `<div style="background:var(--bg-surface);border-radius:8px;padding:0.6rem 0.75rem;cursor:pointer"
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
    // Backend returns `imported` (number of new trades inserted)
    const count = res.imported ?? res.inserted ?? 0;
    if (count > 0) {
      const fresh = await api.getTrades();
      state.trades = fresh.data;
    }
    const idx = state.brokers.findIndex(b => b.id === id);
    if (idx >= 0) state.brokers[idx].last_sync = new Date().toISOString();
    toast(`Synced ${count} new trade${count !== 1 ? 's' : ''} from ${name}`, count > 0 ? 'success' : 'info');
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
            <div style="font-weight:600;margin-bottom:0.25rem;color:var(--red)">Delete Account</div>
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
    { id: 'journal',     label: 'Journal',     icon: NAV_ICONS.journal },
    { id: 'calendar',    label: 'Calendar',    icon: NAV_ICONS.calendar },
    { id: 'import',      label: 'Import',      icon: NAV_ICONS.import },
    { id: 'brokers',     label: 'Brokers',     icon: NAV_ICONS.brokers },
    { id: 'goals',       label: 'Goals',       icon: NAV_ICONS.goals },
    { id: 'riskcalc',    label: 'Risk Calc',   icon: NAV_ICONS.riskcalc },
    { id: 'leaderboard', label: 'Leaderboard', icon: NAV_ICONS.leaderboard },
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

// ═══════════════════════════════════════════════════════════════════
// NEW DASHBOARD — sparklines · sessions · weekly calendar
// ═══════════════════════════════════════════════════════════════════

// Override the old dashboard() function
(function() {

// ── Tiny SVG sparkline ────────────────────────────────────────────
function sparkline(values, color, height) {
  height = height || 48;
  if (!values || values.length < 2) {
    return '<svg width="100%" height="' + height + '"></svg>';
  }
  var W = 160, H = height;
  var min = Math.min.apply(null, values);
  var max = Math.max.apply(null, values);
  var range = max - min || 1;
  var pts = values.map(function(v, i) {
    var x = (i / (values.length - 1) * W).toFixed(1);
    var y = (H - 8 - ((v - min) / range) * (H - 16)).toFixed(1);
    return x + ',' + y;
  });
  var linePath = 'M ' + pts.join(' L ');
  var fillPath = 'M 0,' + H + ' L ' + pts.join(' L ') + ' L ' + W + ',' + H + ' Z';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" preserveAspectRatio="none" style="display:block">'
    + '<defs><linearGradient id="spk-' + color.replace('#','') + '" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.25"/>'
    + '<stop offset="100%" stop-color="' + color + '" stop-opacity="0"/>'
    + '</linearGradient></defs>'
    + '<path d="' + fillPath + '" fill="url(#spk-' + color.replace('#','') + ')"/>'
    + '<path d="' + linePath + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
    + '</svg>';
}

// ── Build sparkline data from trades ─────────────────────────────
function buildSparklineData(trades) {
  var sorted = trades.filter(function(t) { return t.exit_date; })
    .sort(function(a, b) { return new Date(a.exit_date) - new Date(b.exit_date); });

  var cumPnL = 0, cumPnLSeries = [];
  var winRateSeries = [], wins = 0;
  var avgWinSeries = [], totalWinAmt = 0, winCount = 0;
  var avgLossSeries = [], totalLossAmt = 0, lossCount = 0;

  sorted.forEach(function(t) {
    var pnl = Number(t.pnl);
    cumPnL += pnl;
    cumPnLSeries.push(cumPnL);

    if (pnl > 0) { wins++; totalWinAmt += pnl; winCount++; }
    if (pnl < 0) { totalLossAmt += Math.abs(pnl); lossCount++; }

    winRateSeries.push(sorted.length > 0 ? (wins / (cumPnLSeries.length)) * 100 : 0);
    avgWinSeries.push(winCount > 0 ? totalWinAmt / winCount : 0);
    avgLossSeries.push(lossCount > 0 ? totalLossAmt / lossCount : 0);
  });

  return { cumPnLSeries, winRateSeries, avgWinSeries, avgLossSeries };
}

// ── Trading sessions ──────────────────────────────────────────────
function buildSessionStats(trades) {
  var sessions = {
    london:  { name: 'London',   flag: '🇬🇧', tz: 'GMT +0', open: 8,  close: 17 },
    newYork: { name: 'New York', flag: '🇺🇸', tz: 'GMT +2', open: 13, close: 22 },
    asia:    { name: 'Asia',     flag: '🔴',  tz: 'GMT +2', open: 0,  close: 9  },
    outside: { name: 'Outside',  flag: '⏰',  tz: 'No timezone', open: -1, close: -1 },
  };

  Object.values(sessions).forEach(function(s) {
    s.trades = 0; s.wins = 0; s.pnl = 0;
  });

  trades.forEach(function(t) {
    if (!t.entry_date) { sessions.outside.trades++; if (Number(t.pnl) > 0) sessions.outside.wins++; sessions.outside.pnl += Number(t.pnl); return; }
    var h = new Date(t.entry_date).getHours();
    var sess = sessions.outside;
    if (h >= 8 && h < 17)  sess = sessions.london;
    else if (h >= 13 && h < 22) sess = sessions.newYork;
    else if (h < 9 || h >= 23) sess = sessions.asia;
    sess.trades++;
    if (Number(t.pnl) > 0) sess.wins++;
    sess.pnl += Number(t.pnl);
  });

  return sessions;
}

// ── Weekly calendar ───────────────────────────────────────────────
function buildWeeklyCalendar(trades, year, month) {
  var pnlByDay = {};
  trades.filter(function(t) {
    if (!t.exit_date) return false;
    var d = new Date(t.exit_date);
    return d.getFullYear() === year && d.getMonth() === month;
  }).forEach(function(t) {
    var d = new Date(t.exit_date).getDate();
    pnlByDay[d] = (pnlByDay[d] || 0) + Number(t.pnl);
  });

  var daysInMonth = new Date(year, month + 1, 0).getDate();
  // Build week buckets (Sun-Sat)
  var weeks = [];
  var currentWeek = { days: [], pnl: 0, label: '' };
  var startDOW = new Date(year, month, 1).getDay();

  // pad start
  for (var p = 0; p < startDOW; p++) currentWeek.days.push(null);

  for (var day = 1; day <= daysInMonth; day++) {
    currentWeek.days.push({ day: day, pnl: pnlByDay[day] !== undefined ? pnlByDay[day] : null });
    if (pnlByDay[day] !== undefined) currentWeek.pnl += pnlByDay[day];
    var dow = new Date(year, month, day).getDay();
    if (dow === 6 || day === daysInMonth) {
      weeks.push(currentWeek);
      currentWeek = { days: [], pnl: 0, label: '' };
    }
  }

  weeks.forEach(function(w, i) { w.label = 'Week ' + (i + 1); });
  return { weeks: weeks, pnlByDay: pnlByDay };
}

// ── New dashboard function ────────────────────────────────────────
window.dashboard = function(s) {
  var spark = buildSparklineData(state.trades);
  var sessions = buildSessionStats(state.trades);
  var now = state.calendarDate;
  var year = now.getFullYear();
  var month = now.getMonth();
  var monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  var cal = buildWeeklyCalendar(state.trades, year, month);

  // Stat cards with sparklines
  function sparkCard(label, value, colorClass, sparkData, sparkColor, sub) {
    return '<div class="dash-stat-card">'
      + '<div class="dash-stat-header">'
      + '<div class="dash-stat-label">' + label + '</div>'
      + '</div>'
      + '<div class="dash-stat-value ' + (colorClass || '') + '">' + value + '</div>'
      + (sub ? '<div class="dash-stat-sub">' + sub + '</div>' : '')
      + '<div class="dash-sparkline">'
      + sparkline(sparkData.length >= 2 ? sparkData : null, sparkColor, 44)
      + '</div>'
      + '</div>';
  }

  // Session card
  function sessionCard(sess, key) {
    var wr = sess.trades > 0 ? ((sess.wins / sess.trades) * 100).toFixed(2) : '0.00';
    var pnlPos = sess.pnl >= 0;
    return '<div class="session-card">'
      + '<div class="session-header">'
      + '<span class="session-flag">' + sess.flag + '</span>'
      + '<div class="session-name-wrap">'
      + '<div class="session-name">' + sess.name + '</div>'
      + '<div class="session-tz">' + sess.tz + '</div>'
      + '</div>'
      + (sess.open >= 0 ? '<div class="session-time">' + String(sess.open).padStart(2,'0') + ':01 ' + (sess.open < 12 ? 'AM' : 'PM') + '</div>' : '')
      + '</div>'
      + '<div class="session-stats">'
      + '<div class="session-row">'
      + '<span class="session-lbl">Profit</span>'
      + '<span class="session-pnl ' + (pnlPos ? 'positive' : 'negative') + '">'
      + (pnlPos ? '+' : '') + (sess.pnl * 100 / Math.max(1, Math.abs(sess.pnl) + 0.01)).toFixed(2) + '%'
      + '</span>'
      + '</div>'
      + '<div class="session-bottom">'
      + '<div><div class="session-stat-lbl">Total Trades</div><div class="session-stat-val">' + sess.trades + '</div></div>'
      + '<div><div class="session-stat-lbl">Win Rate</div><div class="session-stat-val">' + wr + '%</div></div>'
      + '</div>'
      + '</div>'
      + '</div>';
  }

  // Weekly row
  function weekRow(w, i) {
    var pnlPos = w.pnl >= 0;
    var hasData = w.days.some(function(d) { return d && d.pnl !== null; });
    var cls = 'weekly-row' + (hasData ? (pnlPos ? ' week-profit' : ' week-loss') : '');
    return '<div class="' + cls + '">'
      + '<div class="week-label">' + w.label + '</div>'
      + '<div class="week-pnl ' + (hasData ? (pnlPos ? 'positive' : 'negative') : '') + '">'
      + (hasData ? (pnlPos ? '+' : '') + '$' + w.pnl.toFixed(2) : '$0.00')
      + '</div>'
      + '</div>';
  }

  // Monthly calendar grid (compact)
  var dayHeaders = '<div class="mcal-grid">'
    + ['Su','Mo','Tu','We','Th','Fr','Sa'].map(function(d) {
        return '<div class="mcal-dh">' + d + '</div>';
      }).join('');
  var startDOW2 = new Date(year, month, 1).getDay();
  var daysInMonth2 = new Date(year, month + 1, 0).getDate();
  for (var p2 = 0; p2 < startDOW2; p2++) dayHeaders += '<div class="mcal-day empty"></div>';
  for (var d2 = 1; d2 <= daysInMonth2; d2++) {
    var pnl2 = cal.pnlByDay[d2];
    var cls2 = 'mcal-day' + (pnl2 !== undefined ? (pnl2 > 0 ? ' mcal-profit' : pnl2 < 0 ? ' mcal-loss' : ' mcal-be') : '');
    var ds2 = year + '-' + String(month+1).padStart(2,'0') + '-' + String(d2).padStart(2,'0');
    dayHeaders += '<div class="' + cls2 + '" onclick="viewCalendarDay(\'' + ds2 + '\')">'
      + '<div class="mcal-num">' + d2 + '</div>'
      + (pnl2 !== undefined ? '<div class="mcal-pnl ' + (pnl2 >= 0 ? 'positive' : 'negative') + '">'
          + (pnl2 >= 0 ? '+' : '') + '$' + Math.abs(pnl2).toFixed(0) + '</div>' : '')
      + '</div>';
  }
  dayHeaders += '</div>';

  return '<div class="page-header">'
    + '<h1 class="header">Dashboard</h1>'
    + '<button class="btn btn-primary hide-mobile" onclick="openAddTradeModal()">+ Add Trade</button>'
    + '</div>'

    // ── Stat cards row ──
    + '<div class="dash-stats-row">'
    + sparkCard('NET P&L',
        (s.totalPnL >= 0 ? '+' : '') + '$' + s.totalPnL.toFixed(2),
        s.totalPnL >= 0 ? 'positive' : 'negative',
        spark.cumPnLSeries, s.totalPnL >= 0 ? '#30D158' : '#FF3B30',
        s.winningTrades + 'W / ' + s.losingTrades + 'L')
    + sparkCard('Day Win',
        s.winRate + '%',
        '',
        spark.winRateSeries, '#2196F3',
        s.totalTrades + ' total trades')
    + sparkCard('AVG Win Trade',
        '$' + s.avgWin.toFixed(2),
        'positive',
        spark.avgWinSeries, '#30D158',
        'Per winning trade')
    + sparkCard('AVG Loss Trade',
        '$' + s.avgLoss.toFixed(2),
        'negative',
        spark.avgLossSeries, '#FF3B30',
        'Per losing trade')
    + '</div>'

    // ── Sessions ──
    + '<div class="card dash-section">'
    + '<div class="dash-section-title">Sessions</div>'
    + '<div class="sessions-grid">'
    + sessionCard(sessions.london, 'london')
    + sessionCard(sessions.newYork, 'newYork')
    + sessionCard(sessions.asia, 'asia')
    + sessionCard(sessions.outside, 'outside')
    + '</div>'
    + '</div>'

    // ── Weekly + Calendar ──
    + '<div class="dash-bottom-row">'

    + '<div class="card dash-section dash-weekly">'
    + '<div class="dash-section-header">'
    + '<button class="dash-cal-nav" onclick="changeCalendarMonth(-1)">&#8249;</button>'
    + '<span class="dash-section-title">' + monthName + '</span>'
    + '<button class="dash-cal-nav" onclick="changeCalendarMonth(1)">&#8250;</button>'
    + '</div>'
    + '<div class="weekly-rows">'
    + cal.weeks.map(weekRow).join('')
    + '</div>'
    + '</div>'

    + '<div class="card dash-section dash-cal-section">'
    + '<div class="mcal-header">'
    + '<div class="mcal-stat"><div class="mcal-stat-val">' + Object.keys(cal.pnlByDay).length + '</div><div class="mcal-stat-lbl">Trading Days</div></div>'
    + '<div class="mcal-stat"><div class="mcal-stat-val">' + s.winRate + '%</div><div class="mcal-stat-lbl">Win rate</div></div>'
    + '</div>'
    + dayHeaders
    + '</div>'

    + '</div>' // dash-bottom-row

    // ── Recent trades ──
    + '<div class="card">'
    + '<div class="card-title">Recent Trades</div>'
    + (state.trades.length === 0
        ? empty('📊', 'No trades yet', 'Click "+ Add Trade" to log your first trade')
        : state.trades.slice(0, 5).map(function(t) { return tradeCard(t, false); }).join(''))
    + '</div>';
};

})(); // end IIFE

// ═══════════════════════════════════════════════════════════════════
// SCREENSHOT HELPERS
// ═══════════════════════════════════════════════════════════════════
var _ssFile = null;

function handleScreenshotDrop(e) {
  e.preventDefault();
  var drop = document.getElementById('ss-drop');
  if (drop) drop.classList.remove('drag-over');
  var file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) previewScreenshot(file);
  else toast('Please drop an image file', 'error');
}

function handleScreenshotFile(e) {
  var file = e.target.files[0];
  if (file) previewScreenshot(file);
}

function previewScreenshot(file) {
  if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); return; }
  _ssFile = file;
  var reader = new FileReader();
  reader.onload = function(ev) {
    var img = document.getElementById('ss-preview-img');
    var wrap = document.getElementById('ss-preview-wrap');
    var placeholder = document.getElementById('ss-placeholder');
    if (img) img.src = ev.target.result;
    if (wrap) wrap.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function clearScreenshot() {
  _ssFile = null;
  var wrap = document.getElementById('ss-preview-wrap');
  var placeholder = document.getElementById('ss-placeholder');
  var fileInput = document.getElementById('ss-file');
  if (wrap) wrap.style.display = 'none';
  if (placeholder) placeholder.style.display = 'block';
  if (fileInput) fileInput.value = '';
}

document.addEventListener('paste', function(e) {
  if (!state.showTradeModal || state.selectedTrade) return;
  var items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (var i = 0; i < items.length; i++) {
    if (items[i].type.startsWith('image/')) {
      var file = items[i].getAsFile();
      if (file) previewScreenshot(file);
      break;
    }
  }
});

// ═══════════════════════════════════════════════════════════════════
// ONBOARDING
// ═══════════════════════════════════════════════════════════════════
function dismissOnboarding() {
  localStorage.setItem('q_onboarded', '1');
  state.showOnboarding = false;
  render();
}

function nextOnboardingStep() {
  if (state.onboardingStep < 3) { state.onboardingStep++; render(); }
  else dismissOnboarding();
}

function onboardingModal() {
  var step = state.onboardingStep;
  var dotHtml = [1,2,3].map(function(i) {
    var cls = i === step ? 'onboarding-dot active' : (i < step ? 'onboarding-dot done' : 'onboarding-dot');
    return '<div class="' + cls + '"></div>';
  }).join('');

  var content = '';
  var cta = '';
  var skipBtn = '';

  if (step === 1) {
    content = '<div class="onboarding-icon"><svg width="52" height="52" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="obl" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FF6535"/><stop offset="100%" stop-color="#FF2D6B"/></linearGradient></defs><circle cx="16" cy="16" r="14" stroke="url(#obl)" stroke-width="2.5" fill="none"/><circle cx="16" cy="16" r="5" fill="url(#obl)" opacity="0.12"/><circle cx="16" cy="16" r="2.2" fill="url(#obl)"/><circle cx="16" cy="4.5" r="1.8" fill="url(#obl)"/><circle cx="16" cy="27.5" r="1.8" fill="url(#obl)"/><circle cx="4.5" cy="16" r="1.8" fill="url(#obl)"/><circle cx="27.5" cy="16" r="1.8" fill="url(#obl)"/></svg></div>'
      + '<h2 class="onboarding-heading">Welcome to Quantario</h2>'
      + '<div class="onboarding-sub">Your professional trading journal. Let\'s get you set up in 2 minutes.</div>';
    cta = '<button class="btn btn-primary" style="width:100%" onclick="nextOnboardingStep()">Get Started →</button>';
    skipBtn = '<button class="btn btn-secondary" style="width:100%;margin-top:0.5rem" onclick="dismissOnboarding()">Skip setup</button>';
  } else if (step === 2) {
    content = '<div class="onboarding-icon" style="font-size:2.8rem">📊</div>'
      + '<h2 class="onboarding-heading">How do you want to add trades?</h2>'
      + '<div class="onboarding-options">'
      + '<div class="onboarding-option" onclick="changeView(\'import\');dismissOnboarding()">'
      + '<div class="oo-icon">📁</div><div><div class="oo-title">CSV Import</div><div class="oo-desc">Upload a file from your broker</div></div><div class="oo-arrow">→</div>'
      + '</div>'
      + '<div class="onboarding-option" onclick="changeView(\'brokers\');dismissOnboarding()">'
      + '<div class="oo-icon">🔌</div><div><div class="oo-title">Connect Broker</div><div class="oo-desc">Auto-sync with Alpaca or Binance</div></div><div class="oo-arrow">→</div>'
      + '</div>'
      + '<div class="onboarding-option" onclick="openAddTradeModal();dismissOnboarding()">'
      + '<div class="oo-icon">✏️</div><div><div class="oo-title">Manual Entry</div><div class="oo-desc">Log your first trade now</div></div><div class="oo-arrow">→</div>'
      + '</div>'
      + '</div>';
    skipBtn = '<button class="btn btn-secondary" style="width:100%;margin-top:0.75rem" onclick="nextOnboardingStep()">Skip for now</button>';
  } else {
    content = '<div class="onboarding-icon" style="font-size:2.8rem">🎯</div>'
      + '<h2 class="onboarding-heading">Set your first P&L target</h2>'
      + '<p style="color:var(--text-secondary);font-size:0.83rem;margin-bottom:1.25rem">Traders with goals outperform those without. Even rough numbers help.</p>'
      + '<div class="form-group"><label class="form-label">Daily Target ($)</label><input class="form-input" id="ob-daily" placeholder="e.g. 200"></div>'
      + '<div class="form-group"><label class="form-label">Weekly Target ($)</label><input class="form-input" id="ob-weekly" placeholder="e.g. 1000"></div>'
      + '<div class="form-group"><label class="form-label">Monthly Target ($)</label><input class="form-input" id="ob-monthly" placeholder="e.g. 4000"></div>';
    cta = '<button class="btn btn-primary" style="width:100%" onclick="'
      + 'var d=document.getElementById(\'ob-daily\').value||\'\';\n'
      + 'var w=document.getElementById(\'ob-weekly\').value||\'\';\n'
      + 'var m=document.getElementById(\'ob-monthly\').value||\'\';\n'
      + 'state.goals={daily:d,weekly:w,monthly:m};\n'
      + 'localStorage.setItem(\'q_goals\',JSON.stringify(state.goals));\n'
      + 'dismissOnboarding();\n'
      + '">Save &amp; Start Trading</button>';
    skipBtn = '<button class="btn btn-secondary" style="width:100%;margin-top:0.5rem" onclick="dismissOnboarding()">Skip</button>';
  }

  return '<div class="modal onboarding-backdrop">'
    + '<div class="modal-content onboarding-modal" onclick="event.stopPropagation()">'
    + '<div class="onboarding-dots">' + dotHtml + '</div>'
    + content
    + '<div class="onboarding-actions">' + cta + skipBtn + '</div>'
    + '<button class="onboarding-close" onclick="dismissOnboarding()">&#x2715;</button>'
    + '</div></div>';
}

// ═══════════════════════════════════════════════════════════════════
// GOALS VIEW
// ═══════════════════════════════════════════════════════════════════
function goalsView(stats) {
  var goals = state.goals;
  var today = new Date().toDateString();
  var wsStart = new Date();
  wsStart.setDate(wsStart.getDate() - wsStart.getDay());
  var msStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  var todayPnL  = state.trades.filter(function(t) { return t.exit_date && new Date(t.exit_date).toDateString() === today; }).reduce(function(s,t) { return s+Number(t.pnl); }, 0);
  var weekPnL   = state.trades.filter(function(t) { return t.exit_date && new Date(t.exit_date) >= wsStart; }).reduce(function(s,t) { return s+Number(t.pnl); }, 0);
  var monthPnL2 = state.trades.filter(function(t) { return t.exit_date && new Date(t.exit_date) >= msStart; }).reduce(function(s,t) { return s+Number(t.pnl); }, 0);

  function goalCard(label, current, target) {
    var t = parseFloat(target);
    var hasTarget = !isNaN(t) && t > 0;
    var pct = hasTarget ? Math.max(0, Math.min(100, (current / t) * 100)) : 0;
    var reached = hasTarget && current >= t;
    return '<div class="goal-card' + (reached ? ' goal-reached' : '') + '">'
      + (reached ? '<div class="goal-badge">✓ Reached!</div>' : '')
      + '<div class="goal-period">' + label + '</div>'
      + '<div class="goal-current ' + (current >= 0 ? 'positive' : 'negative') + '">' + (current >= 0 ? '+' : '') + '$' + current.toFixed(2) + '</div>'
      + (hasTarget
          ? '<div class="goal-target">Target: $' + t.toFixed(0) + '</div>'
            + '<div class="progress-bar" style="margin-top:0.75rem"><div class="progress-fill" style="width:' + pct.toFixed(0) + '%"></div></div>'
            + '<div class="goal-pct">' + pct.toFixed(0) + '% of goal</div>'
          : '<div class="goal-no-target">No target set</div>')
      + '</div>';
  }

  return '<div class="page-header"><h1 class="header">Goals &amp; Targets</h1></div>'
    + '<div class="goals-grid">'
    + goalCard('Today', todayPnL, goals.daily)
    + goalCard('This Week', weekPnL, goals.weekly)
    + goalCard('This Month', monthPnL2, goals.monthly)
    + '</div>'
    + '<div class="card" style="margin-top:1.5rem">'
    + '<div class="card-title">🎯 Edit Targets</div>'
    + '<div class="form-row">'
    + '<div class="form-group"><label class="form-label">Daily ($)</label><input class="form-input" id="g-daily" value="' + esc(goals.daily) + '" placeholder="e.g. 200"></div>'
    + '<div class="form-group"><label class="form-label">Weekly ($)</label><input class="form-input" id="g-weekly" value="' + esc(goals.weekly) + '" placeholder="e.g. 1000"></div>'
    + '<div class="form-group"><label class="form-label">Monthly ($)</label><input class="form-input" id="g-monthly" value="' + esc(goals.monthly) + '" placeholder="e.g. 4000"></div>'
    + '</div>'
    + '<button class="btn btn-primary btn-sm" onclick="saveGoals()">Save Targets</button>'
    + '</div>';
}

function saveGoals() {
  state.goals = {
    daily:   document.getElementById('g-daily')  ? document.getElementById('g-daily').value  : '',
    weekly:  document.getElementById('g-weekly') ? document.getElementById('g-weekly').value : '',
    monthly: document.getElementById('g-monthly')? document.getElementById('g-monthly').value: '',
  };
  localStorage.setItem('q_goals', JSON.stringify(state.goals));
  toast('Goals saved!', 'success');
  render();
}

// ═══════════════════════════════════════════════════════════════════
// RISK CALCULATOR
// ═══════════════════════════════════════════════════════════════════
var _rcState = { accountSize:'', riskPct:'1', entryPrice:'', stopLoss:'', takeProfit:'', direction:'long', result:null };

function riskCalcView() {
  var rc = _rcState;
  var r = rc.result;

  return '<div class="page-header"><h1 class="header">Risk Calculator</h1></div>'
    + '<div class="riskcalc-layout">'
    + '<div class="card riskcalc-inputs">'
    + '<div class="card-title">⚙️ Position Parameters</div>'
    + '<div class="form-group"><label class="form-label">Account Size ($) *</label><input type="number" class="form-input" id="rc-acc" placeholder="e.g. 10000" value="' + esc(rc.accountSize) + '"></div>'
    + '<div class="form-group"><label class="form-label" style="display:flex;justify-content:space-between"><span>Risk Per Trade (%)</span><span class="rc-pct-badge" id="rc-pct-lbl">' + (rc.riskPct||'1') + '%</span></label>'
    + '<input type="range" class="form-range" id="rc-rpct" min="0.1" max="5" step="0.1" value="' + (rc.riskPct||'1') + '" oninput="document.getElementById(\'rc-pct-lbl\').textContent=this.value+\'%\'">'
    + '<div class="rc-range-labels"><span>0.1%</span><span>1%</span><span>2%</span><span>3%</span><span>5%</span></div></div>'
    + '<div class="form-row">'
    + '<div class="form-group"><label class="form-label">Direction</label><select class="form-select" id="rc-dir"><option value="long"' + (rc.direction==='long'?' selected':'') + '>Long</option><option value="short"' + (rc.direction==='short'?' selected':'') + '>Short</option></select></div>'
    + '<div class="form-group"><label class="form-label">Entry Price *</label><input type="number" step="any" class="form-input" id="rc-ep" value="' + esc(rc.entryPrice) + '" placeholder="0.00"></div>'
    + '</div>'
    + '<div class="form-row">'
    + '<div class="form-group"><label class="form-label">Stop Loss *</label><input type="number" step="any" class="form-input" id="rc-sl" value="' + esc(rc.stopLoss) + '" placeholder="0.00"></div>'
    + '<div class="form-group"><label class="form-label">Take Profit</label><input type="number" step="any" class="form-input" id="rc-tp" value="' + esc(rc.takeProfit||'') + '" placeholder="Optional"></div>'
    + '</div>'
    + '<button class="btn btn-primary" style="width:100%" onclick="doRiskCalc()">Calculate</button>'
    + '</div>'
    + '<div class="riskcalc-results">'
    + (r
      ? '<div class="rc-result-card rc-primary"><div class="rc-result-label">Position Size</div><div class="rc-result-value">' + r.posSize.toFixed(r.posSize < 10 ? 4 : 2) + '</div><div class="rc-result-sub">units / shares</div></div>'
        + '<div class="rc-result-card"><div class="rc-result-label">Max Risk</div><div class="rc-result-value negative">-$' + r.riskAmt.toFixed(2) + '</div><div class="rc-result-sub">' + rc.riskPct + '% of account</div></div>'
        + '<div class="rc-result-card"><div class="rc-result-label">Stop Distance</div><div class="rc-result-value">' + r.slDist.toFixed(4) + '</div><div class="rc-result-sub">price points</div></div>'
        + (r.rr ? '<div class="rc-result-card ' + (parseFloat(r.rr) >= 2 ? 'rc-good' : parseFloat(r.rr) < 1 ? 'rc-bad' : '') + '"><div class="rc-result-label">Risk/Reward</div><div class="rc-result-value">1 : ' + r.rr + '</div><div class="rc-result-sub">' + (parseFloat(r.rr) >= 2 ? '✓ Good' : parseFloat(r.rr) < 1 ? '⚠ Poor' : 'OK') + '</div></div>' : '')
        + (r.potential ? '<div class="rc-result-card rc-good"><div class="rc-result-label">Potential Profit</div><div class="rc-result-value positive">+$' + r.potential + '</div><div class="rc-result-sub">if TP hit</div></div>' : '')
      : '<div class="rc-empty"><div style="font-size:2.5rem;margin-bottom:1rem;opacity:0.3">🧮</div><div style="font-size:0.9rem;font-weight:700;margin-bottom:0.4rem">Results appear here</div><div style="font-size:0.78rem;color:var(--text-muted)">Fill the form and click Calculate</div></div>'
    )
    + '</div>'
    + '</div>';
}

function doRiskCalc() {
  var acc  = parseFloat(document.getElementById('rc-acc') ? document.getElementById('rc-acc').value : 0);
  var rPct = parseFloat(document.getElementById('rc-rpct') ? document.getElementById('rc-rpct').value : 0);
  var ep   = parseFloat(document.getElementById('rc-ep') ? document.getElementById('rc-ep').value : 0);
  var sl   = parseFloat(document.getElementById('rc-sl') ? document.getElementById('rc-sl').value : 0);
  var tp   = parseFloat(document.getElementById('rc-tp') ? document.getElementById('rc-tp').value : 0) || null;
  var dir  = document.getElementById('rc-dir') ? document.getElementById('rc-dir').value : 'long';

  _rcState.accountSize = acc; _rcState.riskPct = rPct; _rcState.entryPrice = ep;
  _rcState.stopLoss = sl; _rcState.takeProfit = tp; _rcState.direction = dir;

  if (!acc || !rPct || !ep || !sl) { toast('Fill in all required fields', 'warn'); return; }
  var riskAmt = acc * (rPct / 100);
  var slDist = Math.abs(ep - sl);
  if (slDist === 0) { toast('Stop loss cannot equal entry', 'error'); return; }
  var posSize = riskAmt / slDist;
  var tpDist = tp ? Math.abs(tp - ep) : null;
  var rr = tpDist ? (tpDist / slDist).toFixed(2) : null;
  var potential = tpDist ? (posSize * tpDist).toFixed(2) : null;
  _rcState.result = { riskAmt: riskAmt, slDist: slDist, posSize: posSize, rr: rr, potential: potential };
  render();
}

// ═══════════════════════════════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════════════════════════════
function leaderboardView(stats) {
  var user = getUser() || {};
  var initial = (user.name || 'U').charAt(0).toUpperCase();

  var rawPlayers = [
    { name:'Marcus T.',   winRate:73, totalPnL:28400, trades:184, profitFactor:2.8, badge:'🔥' },
    { name:'Sarah K.',    winRate:68, totalPnL:19200, trades:221, profitFactor:2.4, badge:'⚡' },
    { name:'Daniel R.',   winRate:65, totalPnL:14800, trades:156, profitFactor:3.1, badge:'💎' },
    { name:'Alex M.',     winRate:62, totalPnL:11200, trades:98,  profitFactor:1.9, badge:'🌟' },
    { name:'Jordan C.',   winRate:61, totalPnL:9800,  trades:143, profitFactor:1.7, badge:'' },
    { name: esc(user.name||'You'), winRate: parseFloat(stats.winRate)||0, totalPnL: parseFloat(stats.totalPnL)||0, trades: state.trades.length, profitFactor: parseFloat(stats.profitFactor)||1, badge:'', isYou:true },
  ];

  var maxPnL = Math.max.apply(null, rawPlayers.map(function(p) { return Math.max(0, p.totalPnL); })) || 1;
  var leaderData = rawPlayers.map(function(p) {
    var score = (p.winRate/100)*40 + Math.min(p.profitFactor/3,1)*30 + (Math.max(0,p.totalPnL)/maxPnL)*30;
    return Object.assign({}, p, { score: score });
  }).sort(function(a,b) { return b.score - a.score; }).map(function(p,i) { return Object.assign({}, p, { rank: i+1 }); });

  var you = leaderData.find(function(p) { return p.isYou; });

  var rowsHtml = leaderData.map(function(p) {
    var medals = ['🥇','🥈','🥉'];
    return '<div class="lb-row' + (p.isYou ? ' lb-row-you' : '') + '">'
      + '<div class="lb-col-rank">' + (p.rank <= 3 ? '<span class="lb-medal">' + medals[p.rank-1] + '</span>' : '<span class="lb-rank-num">#' + p.rank + '</span>') + '</div>'
      + '<div class="lb-col-name"><div class="lb-row-avatar">' + p.name.charAt(0) + '</div><div><div class="lb-row-name">' + (p.isYou ? '<strong>You</strong>' : p.name) + ' ' + p.badge + '</div></div></div>'
      + '<div class="lb-col-pnl ' + (p.totalPnL >= 0 ? 'positive' : 'negative') + '">' + (p.totalPnL >= 0 ? '+' : '') + '$' + p.totalPnL.toLocaleString() + '</div>'
      + '<div class="lb-col-wr">' + p.winRate + '%</div>'
      + '<div class="lb-col-score hide-mobile">' + p.score.toFixed(1) + '</div>'
      + '</div>';
  }).join('');

  return '<div class="page-header"><h1 class="header">Leaderboard</h1><span class="lb-beta-tag">Beta</span></div>'
    + '<div class="card lb-profile-card">'
    + '<div class="lb-profile-top"><div class="lb-avatar">' + initial + '</div><div><div class="lb-profile-name">' + esc(user.name||'You') + '</div><div class="lb-profile-handle">@' + esc((user.email||'').split('@')[0]||'trader') + '</div></div><div class="lb-profile-rank">#' + (you ? you.rank : '—') + '</div></div>'
    + '<div class="lb-profile-stats">'
    + '<div class="lb-pstat"><div class="lb-pval ' + (stats.totalPnL >= 0 ? 'positive' : 'negative') + '">' + (stats.totalPnL >= 0 ? '+' : '') + '$' + parseFloat(stats.totalPnL).toFixed(0) + '</div><div class="lb-plbl">P&L</div></div>'
    + '<div class="lb-pstat"><div class="lb-pval">' + stats.winRate + '%</div><div class="lb-plbl">Win Rate</div></div>'
    + '<div class="lb-pstat"><div class="lb-pval">' + state.trades.length + '</div><div class="lb-plbl">Trades</div></div>'
    + '<div class="lb-pstat"><div class="lb-pval">' + stats.profitFactor + '</div><div class="lb-plbl">Prof. Factor</div></div>'
    + '</div>'
    + '<div style="display:flex;gap:0.75rem;margin-top:1rem">'
    + '<button class="btn btn-secondary btn-sm" onclick="toast(\'Public profile sharing coming soon!\',\'info\')">🔗 Share Profile</button>'
    + '</div></div>'
    + '<div class="card" style="margin-top:1.25rem"><div class="card-title">🏆 Top Traders This Month</div>'
    + '<div class="lb-table">'
    + '<div class="lb-thead"><div class="lb-th lb-col-rank">Rank</div><div class="lb-th lb-col-name">Trader</div><div class="lb-th lb-col-pnl">P&L</div><div class="lb-th lb-col-wr">Win Rate</div><div class="lb-th lb-col-score hide-mobile">Score</div></div>'
    + rowsHtml
    + '</div>'
    + '<div style="text-align:center;margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border);font-size:0.73rem;color:var(--text-muted)">🚧 Live community leaderboard coming soon</div>'
    + '</div>';
}

// ═══════════════════════════════════════════════════════════════════
// ANALYTICS WITH CHARTS
// ═══════════════════════════════════════════════════════════════════
(function() {
  window.analytics = function(s) {
    var sorted = state.trades.filter(function(t) { return t.exit_date; })
      .sort(function(a,b) { return new Date(a.exit_date) - new Date(b.exit_date); });

    var cumulative = 0;
    var equity = sorted.map(function(t) {
      cumulative += Number(t.pnl);
      return { date: new Date(t.exit_date), pnl: Number(t.pnl), cum: cumulative };
    });

    var wins2   = state.trades.filter(function(t) { return Number(t.pnl) > 0; }).length;
    var losses2 = state.trades.filter(function(t) { return Number(t.pnl) < 0; }).length;
    var be2     = state.trades.filter(function(t) { return Number(t.pnl) === 0; }).length;

    var byStrategy = state.trades.reduce(function(acc, t) {
      var k = t.strategy || 'No Strategy';
      if (!acc[k]) acc[k] = { pnl: 0, count: 0, wins: 0 };
      acc[k].pnl += Number(t.pnl); acc[k].count++;
      if (t.pnl > 0) acc[k].wins++;
      return acc;
    }, {});

    var byAsset = state.trades.reduce(function(acc, t) {
      acc[t.asset_type] = (acc[t.asset_type] || 0) + 1;
      return acc;
    }, {});

    // SVG equity curve
    function equityCurve() {
      if (equity.length < 2) return '<div style="display:flex;align-items:center;justify-content:center;height:160px;color:var(--text-muted);font-size:0.8rem;flex-direction:column;gap:0.5rem"><div style="font-size:2rem;opacity:0.25">📈</div>Log 2+ trades to see equity curve</div>';
      var W=600,H=160,PL=50,PR=16,PT=12,PB=28;
      var vals = equity.map(function(p){return p.cum;});
      var minV = Math.min.apply(null, [0].concat(vals));
      var maxV = Math.max.apply(null, [0].concat(vals));
      var range = maxV - minV || 1;
      var plotW = W-PL-PR, plotH = H-PT-PB;
      var toX = function(i){ return PL + i/(equity.length-1)*plotW; };
      var toY = function(v){ return PT + plotH - (v-minV)/range*plotH; };
      var zeroY = toY(0);
      var lastVal = equity[equity.length-1].cum;
      var color = lastVal >= 0 ? 'var(--green)' : 'var(--red)';
      var pts = equity.map(function(p,i){ return toX(i).toFixed(1)+','+toY(p.cum).toFixed(1); });
      var linePath = 'M '+pts.join(' L ');
      var fillPath = 'M '+toX(0).toFixed(1)+','+zeroY.toFixed(1)+' L '+pts.join(' L ')+' L '+toX(equity.length-1).toFixed(1)+','+zeroY.toFixed(1)+' Z';
      var yLabels = [minV, minV+range*0.5, maxV].map(function(v){return {val:v, y:toY(v)};});
      var xSamples = [0, Math.floor(equity.length/2), equity.length-1].map(function(i){
        return { label: equity[i].date.toLocaleDateString('en-US',{month:'short',day:'numeric'}), x: toX(i) };
      });
      var gradId = lastVal >= 0 ? 'eq-pos' : 'eq-neg';
      var gradColor = lastVal >= 0 ? 'rgba(48,209,88,' : 'rgba(255,59,48,';
      var svg = '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:160px;display:block;overflow:visible" preserveAspectRatio="none">';
      svg += '<defs><linearGradient id="'+gradId+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+gradColor+'0.2)"/><stop offset="100%" stop-color="'+gradColor+'0)"/></linearGradient></defs>';
      yLabels.forEach(function(l){
        svg += '<line x1="'+PL+'" y1="'+l.y.toFixed(1)+'" x2="'+(W-PR)+'" y2="'+l.y.toFixed(1)+'" stroke="var(--border)" stroke-width="0.8" stroke-dasharray="3,3"/>';
        svg += '<text x="'+(PL-6)+'" y="'+(l.y+4).toFixed(1)+'" text-anchor="end" fill="var(--text-muted)" font-size="9" font-family="JetBrains Mono,monospace">'+(l.val>=0?'+':'')+'$'+Math.round(l.val)+'</text>';
      });
      svg += '<line x1="'+PL+'" y1="'+zeroY.toFixed(1)+'" x2="'+(W-PR)+'" y2="'+zeroY.toFixed(1)+'" stroke="var(--border-bright)" stroke-width="1"/>';
      svg += '<path d="'+fillPath+'" fill="url(#'+gradId+')"/>';
      svg += '<path d="'+linePath+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      svg += '<circle cx="'+toX(0).toFixed(1)+'" cy="'+toY(equity[0].cum).toFixed(1)+'" r="3.5" fill="'+color+'" opacity="0.6"/>';
      svg += '<circle cx="'+toX(equity.length-1).toFixed(1)+'" cy="'+toY(lastVal).toFixed(1)+'" r="4.5" fill="'+color+'"/>';
      xSamples.forEach(function(x){
        svg += '<text x="'+x.x.toFixed(1)+'" y="'+(H-4)+'" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="JetBrains Mono,monospace">'+x.label+'</text>';
      });
      svg += '</svg>';
      return svg;
    }

    // Donut
    function donut() {
      var total = state.trades.length;
      if (!total) return '<div style="font-size:0.75rem;color:var(--text-muted);text-align:center;padding:2rem">No trades yet</div>';
      var cx=60,cy=60,r=46,sw=14,circ=2*Math.PI*r;
      var wArc=circ*(wins2/total), lArc=circ*(losses2/total);
      var gap = total > 1 ? 2 : 0;
      return '<svg viewBox="0 0 120 120" width="120" height="120" style="flex-shrink:0">'
        +'<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="var(--bg-overlay)" stroke-width="'+sw+'"/>'
        +(wins2>0?'<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="var(--green)" stroke-width="'+sw+'" stroke-linecap="round" stroke-dasharray="'+(wArc-gap)+' '+(circ-wArc+gap)+'" stroke-dashoffset="'+(circ*0.25)+'" opacity="0.9"/>'  :'')
        +(losses2>0?'<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="var(--red)" stroke-width="'+sw+'" stroke-linecap="round" stroke-dasharray="'+(lArc-gap)+' '+(circ-lArc+gap)+'" stroke-dashoffset="'+(circ*0.25-wArc+gap)+'" opacity="0.9"/>'  :'')
        +'<text x="'+cx+'" y="'+(cy-6)+'" text-anchor="middle" fill="var(--text-primary)" font-size="14" font-weight="800" font-family="Plus Jakarta Sans,sans-serif">'+total+'</text>'
        +'<text x="'+cx+'" y="'+(cy+10)+'" text-anchor="middle" fill="var(--text-muted)" font-size="8" font-family="Plus Jakarta Sans,sans-serif">trades</text>'
        +'</svg>';
    }

    // Strategy table
    var stratRows = Object.entries(byStrategy).sort(function(a,b){return b[1].pnl-a[1].pnl;}).map(function(entry){
      var k=entry[0], d=entry[1];
      var allPnl = Object.values(byStrategy).map(function(x){return Math.abs(x.pnl);});
      var maxPnl2 = Math.max.apply(null, allPnl) || 1;
      var barW = (Math.abs(d.pnl)/maxPnl2*100).toFixed(1);
      var wr = ((d.wins/d.count)*100).toFixed(0);
      return '<div class="strat-row">'
        +'<div class="strat-td strat-name">'+esc(k)+'</div>'
        +'<div class="strat-td '+(d.pnl>=0?'positive':'negative')+'">'+(d.pnl>=0?'+':'')+'$'+d.pnl.toFixed(0)+'</div>'
        +'<div class="strat-td" style="color:var(--text-secondary)">'+d.count+'</div>'
        +'<div class="strat-td" style="color:var(--text-secondary)">'+wr+'%</div>'
        +'<div class="strat-td strat-bar-cell"><div class="strat-bar" style="width:'+barW+'%;background:'+(d.pnl>=0?'var(--green)':'var(--red)')+'"></div></div>'
        +'</div>';
    }).join('');

    // Asset rows
    var assetRows = Object.entries(byAsset).sort(function(a,b){return b[1]-a[1];}).map(function(entry){
      var asset=entry[0], count=entry[1];
      var pct = ((count/state.trades.length)*100).toFixed(1);
      return '<div style="margin-bottom:0.85rem">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem">'
        +'<span class="badge badge-'+asset+'">'+asset+'</span>'
        +'<span style="color:var(--text-secondary);font-size:0.75rem;font-family:\'JetBrains Mono\',monospace">'+count+' · '+pct+'%</span>'
        +'</div>'
        +'<div class="progress-bar"><div class="progress-fill" style="width:'+pct+'%"></div></div>'
        +'</div>';
    }).join('');

    return '<div class="page-header"><h1 class="header">Analytics</h1></div>'
      +'<div class="stats-grid">'
      +statCard('Total Trades', s.totalTrades, '')
      +statCard('Win Rate', s.winRate+'%', wins2+'W · '+losses2+'L')
      +statCard('Profit Factor', s.profitFactor, '')
      +statCard('Total P&L', (s.totalPnL>=0?'+':'')+'$'+s.totalPnL.toFixed(2), '', s.totalPnL>=0)
      +'</div>'
      +'<div class="card"><div class="chart-card-header"><div><div class="card-title">Equity Curve</div><div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.2rem">Cumulative P&L</div></div>'
      +(equity.length>=2?'<div class="chart-stat-val '+(s.totalPnL>=0?'positive':'negative')+'">'+(s.totalPnL>=0?'+':'')+'$'+s.totalPnL.toFixed(2)+'</div>':'')
      +'</div><div class="chart-wrap">'+equityCurve()+'</div></div>'
      +'<div class="charts-row">'
      +'<div class="card chart-half"><div class="card-title">Win / Loss</div><div class="donut-wrap">'+donut()
        +'<div class="donut-legend">'
        +'<div class="donut-leg"><span class="donut-dot" style="background:var(--green)"></span><span class="donut-lbl">Win</span><span class="donut-val">'+wins2+'</span></div>'
        +'<div class="donut-leg"><span class="donut-dot" style="background:var(--red)"></span><span class="donut-lbl">Loss</span><span class="donut-val">'+losses2+'</span></div>'
        +'<div class="donut-leg donut-divider"></div>'
        +'<div class="donut-leg"><span class="donut-lbl">Win Rate</span><span class="donut-val">'+s.winRate+'%</span></div>'
        +'<div class="donut-leg"><span class="donut-lbl">Avg Win</span><span class="donut-val positive">+$'+s.avgWin.toFixed(0)+'</span></div>'
        +'<div class="donut-leg"><span class="donut-lbl">Avg Loss</span><span class="donut-val negative">-$'+Math.abs(s.avgLoss).toFixed(0)+'</span></div>'
        +'</div></div></div>'
      +'<div class="card chart-half"><div class="card-title" style="display:flex;justify-content:space-between;align-items:center"><span>✨ AI Pattern Insights</span>'
        +(isPremium()?'<button class="btn btn-ai btn-sm" id="ai-patterns-btn" onclick="doAIPatterns()">'+(state.aiPatterns.loading?'<span class="spinner"></span> Analysing…':state.aiPatterns.ran?'↺ Re-analyse':'Analyse Trades')+'</button>':aiLockedBtn('Analyse Trades'))
        +'</div>'
        +(state.aiPatterns.text?'<div class="ai-patterns-output" id="ai-patterns-text">'+esc(state.aiPatterns.text).replace(/\n/g,'<br>')+'</div>'
          :state.aiPatterns.loading?'<div class="ai-patterns-output" id="ai-patterns-text"><span class="ai-cursor"></span></div>'
          :'<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem 1rem;color:var(--text-secondary);text-align:center;min-height:120px"><div style="font-size:2rem;margin-bottom:0.75rem;opacity:0.3">'+(isPremium()?'📊':'👑')+'</div><div style="font-size:0.78rem">'+(isPremium()?'Click "Analyse Trades" to find patterns':'Upgrade to unlock AI pattern recognition')+'</div></div>')
        +'</div>'
      +'</div>'
      +(Object.keys(byStrategy).length?'<div class="card"><div class="card-title">Performance by Strategy</div><div class="strategy-table"><div class="strat-thead"><div class="strat-th">Strategy</div><div class="strat-th">P&L</div><div class="strat-th">Trades</div><div class="strat-th">Win %</div><div class="strat-th">Bar</div></div>'+stratRows+'</div></div>':'')
      +(Object.keys(byAsset).length?'<div class="card"><div class="card-title">Asset Distribution</div>'+assetRows+'</div>':'');
  };
})();
