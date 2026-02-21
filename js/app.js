// js/app.js

let state = {
  currentView: 'dashboard',
  trades: [], journalEntries: [], brokers: [],
  loading: true, syncing: false,
  filterAssetType: 'all', filterDirection: 'all',
  calendarDate: new Date(),
  showTradeModal: false, selectedTrade: null,
  csvParsed: null, csvImporting: false, csvProgress: 0,
};

// ── TOAST ────────────────────────────────────────────────
function toast(message, type = 'info', duration = 3500) {
  const icons = { success:'✅', error:'❌', info:'ℹ️', warn:'⚠️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${message}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ── BOOT ─────────────────────────────────────────────────
async function init() {
  state.loading = true; render();
  try {
    const [t, j, b] = await Promise.all([api.getTrades(), api.getJournal(), api.getBrokers()]);
    state.trades = t.data; state.journalEntries = j.data; state.brokers = b.data;
  } catch (err) { toast(`Could not reach server: ${err.message}`, 'error', 6000); }
  state.loading = false; render();
}

// ── STATS ─────────────────────────────────────────────────
function calcStats(trades) {
  const w = trades.filter(t=>t.pnl>0), l = trades.filter(t=>t.pnl<0);
  const tp = trades.reduce((s,t)=>s+Number(t.pnl),0);
  const tw = w.reduce((s,t)=>s+Number(t.pnl),0);
  const tl = Math.abs(l.reduce((s,t)=>s+Number(t.pnl),0));
  const aw = w.length ? tw/w.length : 0;
  const al = l.length ? tl/l.length : 0;
  return {
    totalTrades: trades.length, totalPnL: tp,
    winningTrades: w.length, losingTrades: l.length,
    winRate: trades.length ? ((w.length/trades.length)*100).toFixed(1) : '0.0',
    avgWin: aw, avgLoss: al,
    profitFactor: tl>0 ? (tw/tl).toFixed(2) : '—',
    rMultiple: al>0 ? (aw/al).toFixed(2) : '—'
  };
}

// ── RENDER ───────────────────────────────────────────────
function render() {
  const app = document.getElementById('app');
  const stats = calcStats(state.trades);
  const views = ['dashboard','trades','analytics','calendar','journal','import','brokers'];
  const icons = { dashboard:'📊',trades:'💹',analytics:'📈',calendar:'📅',journal:'📝',import:'📁',brokers:'🔌' };
  const labels = { dashboard:'Dashboard',trades:'Trades',analytics:'Analytics',calendar:'Calendar',journal:'Journal',import:'Import',brokers:'Brokers' };

  app.innerHTML = `
    <div class="app-container">
      <div class="sidebar">
        <div class="logo">TradeVault</div>
        ${views.map(v=>`<div class="nav-item ${state.currentView===v?'active':''}" onclick="changeView('${v}')">${icons[v]} ${labels[v]}</div>`).join('')}
        <div style="flex:1"></div>
        <div class="sync-status"><div class="sync-dot ${state.syncing?'syncing':''}"></div><span>${state.syncing?'Syncing…':'Live'}</span></div>
      </div>
      <div class="main-content">
        ${state.loading ? skeleton() : ''}
        ${!state.loading && state.currentView==='dashboard'  ? dashboard(stats) : ''}
        ${!state.loading && state.currentView==='trades'     ? trades() : ''}
        ${!state.loading && state.currentView==='analytics'  ? analytics(stats) : ''}
        ${!state.loading && state.currentView==='calendar'   ? calendar() : ''}
        ${!state.loading && state.currentView==='journal'    ? journal() : ''}
        ${!state.loading && state.currentView==='import'     ? importView() : ''}
        ${!state.loading && state.currentView==='brokers'    ? brokers() : ''}
      </div>
      ${state.showTradeModal ? tradeModal() : ''}
    </div>
  `;
}

function skeleton() {
  return `<h1 class="header">Loading…</h1>
    <div class="stats-grid">${[1,2,3,4].map(()=>'<div class="stat-card skeleton" style="height:110px"></div>').join('')}</div>
    <div class="card">${[1,2,3].map(()=>'<div class="skeleton" style="height:72px;margin-bottom:1rem;border-radius:8px"></div>').join('')}</div>`;
}

function statCard(label, value, sub, pos=null) {
  const color = pos===true ? 'var(--accent-green)' : pos===false ? 'var(--accent-red)' : 'inherit';
  return `<div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value" style="color:${color}">${value}</div><div class="stat-change">${sub}</div></div>`;
}

function empty(icon, title, sub) {
  return `<div class="empty-state"><div class="empty-state-icon">${icon}</div><h3>${title}</h3><p>${sub}</p></div>`;
}

// ── DASHBOARD ────────────────────────────────────────────
function dashboard(s) {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem">
      <h1 class="header" style="margin-bottom:0">Dashboard</h1>
      <button class="btn btn-primary" onclick="openAddTradeModal()">+ Add Trade</button>
    </div>
    <div class="stats-grid">
      ${statCard('Total P&L',`${s.totalPnL>=0?'+':''}$${s.totalPnL.toFixed(2)}`,`${s.winningTrades}W / ${s.losingTrades}L`,s.totalPnL>=0)}
      ${statCard('Win Rate',`${s.winRate}%`,`${s.totalTrades} trades`)}
      ${statCard('Avg Win',`$${s.avgWin.toFixed(2)}`,'Per winning trade',true)}
      ${statCard('Avg Loss',`$${s.avgLoss.toFixed(2)}`,'Per losing trade',false)}
      ${statCard('Profit Factor',s.profitFactor,'Wins / Losses ratio')}
      ${statCard('R-Multiple',s.rMultiple,'Avg win / avg loss')}
    </div>
    <div class="card">
      <div class="card-title">Recent Trades</div>
      ${state.trades.length===0 ? empty('📊','No trades yet','Click "+ Add Trade" to log your first trade') : state.trades.slice(0,5).map(t=>tradeCard(t,false)).join('')}
    </div>`;
}

// ── TRADES ───────────────────────────────────────────────
function trades() {
  const filtered = state.trades.filter(t =>
    (state.filterAssetType==='all'||t.asset_type===state.filterAssetType) &&
    (state.filterDirection==='all'||t.direction===state.filterDirection)
  );
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem">
      <h1 class="header" style="margin-bottom:0">Trade History</h1>
      <button class="btn btn-primary" onclick="openAddTradeModal()">+ Add Trade</button>
    </div>
    <div class="filter-bar">
      <select class="form-select" style="width:auto" onchange="updateFilter('assetType',this.value)">
        <option value="all">All Asset Types</option>
        ${['stock','forex','crypto','futures','options'].map(v=>`<option value="${v}" ${state.filterAssetType===v?'selected':''}>${v.charAt(0).toUpperCase()+v.slice(1)}</option>`).join('')}
      </select>
      <select class="form-select" style="width:auto" onchange="updateFilter('direction',this.value)">
        <option value="all">All Directions</option>
        <option value="long"  ${state.filterDirection==='long' ?'selected':''}>Long</option>
        <option value="short" ${state.filterDirection==='short'?'selected':''}>Short</option>
      </select>
      <span style="color:var(--text-secondary);font-size:0.85rem;margin-left:auto">${filtered.length} trade${filtered.length!==1?'s':''}</span>
    </div>
    <div class="card">
      ${filtered.length===0 ? empty('📊','No trades found','Try adjusting your filters') : filtered.map(t=>tradeCard(t,true)).join('')}
    </div>`;
}

function tradeCard(t, showDelete=false) {
  const pnl = Number(t.pnl), ep = Number(t.entry_price), xp = Number(t.exit_price);
  const dec = ep < 10 ? 4 : 2;
  return `
    <div class="trade-item" onclick="viewTrade('${t.id}')">
      <div class="trade-header">
        <div>
          <span class="trade-symbol">${t.symbol}</span>
          <span style="margin-left:0.75rem">
            <span class="badge badge-${t.direction}">${t.direction}</span>
            <span class="badge badge-${t.asset_type}" style="margin-left:0.4rem">${t.asset_type}</span>
            ${t.broker&&t.broker!=='manual'?`<span class="badge" style="margin-left:0.4rem;background:rgba(52,152,255,0.15);color:var(--accent-blue)">${t.broker}</span>`:''}
          </span>
        </div>
        <div style="display:flex;align-items:center;gap:0.75rem">
          <div class="trade-pnl" style="color:${pnl>=0?'var(--accent-green)':'var(--accent-red)'}">${pnl>=0?'+':''}$${pnl.toFixed(2)}</div>
          ${showDelete?`<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();doDeleteTrade('${t.id}')">✕</button>`:''}
        </div>
      </div>
      <div class="trade-meta">
        <div class="trade-meta-item">📅 ${t.exit_date?new Date(t.exit_date).toLocaleDateString():'—'}</div>
        ${t.strategy?`<div class="trade-meta-item">📊 ${t.strategy}</div>`:''}
        <div class="trade-meta-item">💰 $${ep.toFixed(dec)} → $${xp.toFixed(dec)}</div>
        <div class="trade-meta-item">📦 ${t.quantity}</div>
        ${t.market_conditions?`<div class="trade-meta-item">🌡️ ${t.market_conditions}</div>`:''}
      </div>
      ${t.notes?`<div style="margin-top:0.75rem;font-size:0.85rem;color:var(--text-secondary);font-style:italic">"${t.notes}"</div>`:''}
    </div>`;
}

// ── ANALYTICS ────────────────────────────────────────────
function analytics(s) {
  const sm = state.trades.reduce((a,t)=>{ const k=t.strategy||'Unknown'; if(!a[k]) a[k]={pnl:0,count:0,wins:0}; a[k].pnl+=Number(t.pnl); a[k].count++; if(t.pnl>0)a[k].wins++; return a; },{});
  const am = state.trades.reduce((a,t)=>{ a[t.asset_type]=(a[t.asset_type]||0)+1; return a; },{});
  return `
    <h1 class="header">Analytics</h1>
    <div class="stats-grid">
      ${statCard('Total Trades',s.totalTrades,'')}
      ${statCard('Win Rate',`${s.winRate}%`,'')}
      ${statCard('Profit Factor',s.profitFactor,'')}
      ${statCard('Total P&L',`${s.totalPnL>=0?'+':''}$${s.totalPnL.toFixed(2)}`,'',s.totalPnL>=0)}
    </div>
    <div class="card">
      <div class="card-title">By Strategy</div>
      ${!Object.keys(sm).length ? empty('📈','No data','Add trades with strategies') :
        Object.entries(sm).sort((a,b)=>b[1].pnl-a[1].pnl).map(([k,d])=>`
          <div class="trade-item" style="cursor:default">
            <div class="trade-header">
              <div class="trade-symbol">${k}</div>
              <div class="trade-pnl" style="color:${d.pnl>=0?'var(--accent-green)':'var(--accent-red)'}">${d.pnl>=0?'+':''}$${d.pnl.toFixed(2)}</div>
            </div>
            <div class="trade-meta">
              <div class="trade-meta-item">📊 ${d.count} trades</div>
              <div class="trade-meta-item">✅ ${d.wins} wins</div>
              <div class="trade-meta-item">📈 ${((d.wins/d.count)*100).toFixed(1)}% win rate</div>
            </div>
          </div>`).join('')}
    </div>
    <div class="card">
      <div class="card-title">Asset Distribution</div>
      ${Object.entries(am).map(([asset,count])=>{
        const pct=((count/state.trades.length)*100).toFixed(1);
        return `<div class="trade-item" style="cursor:default">
          <div class="trade-header"><span class="badge badge-${asset}">${asset}</span><div class="trade-symbol">${count} trades (${pct}%)</div></div>
          <div style="background:var(--bg-primary);height:8px;border-radius:4px;overflow:hidden;margin-top:0.75rem">
            <div style="background:var(--accent-green);height:100%;width:${pct}%;transition:width 0.3s"></div>
          </div></div>`;
      }).join('')}
    </div>`;
}

// ── CALENDAR ─────────────────────────────────────────────
function calendar() {
  const year=state.calendarDate.getFullYear(), month=state.calendarDate.getMonth();
  const monthName=state.calendarDate.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const dim=new Date(year,month+1,0).getDate(), sdow=new Date(year,month,1).getDay();

  const mt=state.trades.filter(t=>t.exit_date&&new Date(t.exit_date).getMonth()===month&&new Date(t.exit_date).getFullYear()===year);
  const tbd={};
  mt.forEach(t=>{ const d=new Date(t.exit_date).getDate(); (tbd[d]=tbd[d]||[]).push(t); });
  const dpnl={};
  Object.keys(tbd).forEach(d=>{ dpnl[d]=tbd[d].reduce((s,t)=>s+Number(t.pnl),0); });
  const jbd={};
  state.journalEntries.forEach(e=>{ const d=new Date(e.entry_date+'T12:00:00'); if(d.getMonth()===month&&d.getFullYear()===year)jbd[d.getDate()]=true; });

  const tdays=Object.keys(tbd).length;
  const wdays=Object.values(dpnl).filter(p=>p>0).length;
  const ldays=Object.values(dpnl).filter(p=>p<0).length;
  const tp=Object.values(dpnl).reduce((s,p)=>s+p,0);
  const avg=tdays>0?tp/tdays:0;

  const cells=[];
  for(let i=0;i<sdow;i++) cells.push('<div class="calendar-day empty"></div>');
  for(let day=1;day<=dim;day++){
    const pnl=dpnl[day]??null, ts=tbd[day]||[];
    let cls='calendar-day';
    if(ts.length) cls+=pnl>0?' profit':pnl<0?' loss':' breakeven';
    const ds=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    cells.push(`
      <div class="${cls}" onclick="viewCalendarDay('${ds}')">
        ${jbd[day]?'<div class="calendar-day-journal">📝</div>':''}
        <div class="calendar-day-number">${day}</div>
        ${ts.length?`<div class="calendar-day-pnl" style="color:${pnl>=0?'var(--accent-green)':'var(--accent-red)'}">${pnl>=0?'+':''}$${Math.abs(pnl).toFixed(0)}</div><div class="calendar-day-trades">${ts.length}t</div>`:''}
      </div>`);
  }

  return `
    <h1 class="header">Calendar</h1>
    <div class="card">
      <div class="calendar-stats">
        <div class="calendar-stat-item"><div class="calendar-stat-label">Monthly P&L</div><div class="calendar-stat-value" style="color:${tp>=0?'var(--accent-green)':'var(--accent-red)'}">${tp>=0?'+':''}$${tp.toFixed(2)}</div></div>
        <div class="calendar-stat-item"><div class="calendar-stat-label">Trading Days</div><div class="calendar-stat-value">${tdays}</div></div>
        <div class="calendar-stat-item"><div class="calendar-stat-label">Winning Days</div><div class="calendar-stat-value positive">${wdays}</div></div>
        <div class="calendar-stat-item"><div class="calendar-stat-label">Losing Days</div><div class="calendar-stat-value negative">${ldays}</div></div>
        <div class="calendar-stat-item"><div class="calendar-stat-label">Avg Daily</div><div class="calendar-stat-value" style="color:${avg>=0?'var(--accent-green)':'var(--accent-red)'}">$${avg.toFixed(2)}</div></div>
        <div class="calendar-stat-item"><div class="calendar-stat-label">Day Win Rate</div><div class="calendar-stat-value">${tdays?((wdays/tdays)*100).toFixed(1):0}%</div></div>
      </div>
    </div>
    <div class="calendar-container">
      <div class="calendar-header">
        <button class="calendar-nav-btn" onclick="changeCalendarMonth(-1)">‹</button>
        <div class="calendar-month-title">${monthName}</div>
        <button class="calendar-nav-btn" onclick="changeCalendarMonth(1)">›</button>
      </div>
      <div class="calendar-grid">
        ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="calendar-day-header">${d}</div>`).join('')}
        ${cells.join('')}
      </div>
    </div>`;
}

// ── JOURNAL ──────────────────────────────────────────────
function journal() {
  return `
    <h1 class="header">Journal</h1>
    <div class="card">
      <div class="card-title">New Entry</div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Date</label><input type="date" class="form-input" id="jdate" value="${new Date().toISOString().split('T')[0]}"></div>
      </div>
      <div class="form-group"><label class="form-label">Entry</label><textarea class="form-textarea" id="jcontent" placeholder="What did you learn? How did you feel?" style="min-height:140px"></textarea></div>
      <button class="btn btn-primary" id="jsave" onclick="doSaveJournal()">Save Entry</button>
    </div>
    <div class="card">
      <div class="card-title">Past Entries <span style="font-size:0.85rem;color:var(--text-secondary);font-weight:400">(${state.journalEntries.length})</span></div>
      ${!state.journalEntries.length ? empty('📝','No entries yet','Start documenting your trading journey') :
        state.journalEntries.map(e=>`
          <div class="journal-entry">
            <button class="journal-delete" onclick="doDeleteJournal('${e.id}')">✕</button>
            <div class="journal-date">${new Date(e.entry_date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
            <div class="journal-text">${e.content.replace(/\n/g,'<br>')}</div>
          </div>`).join('')}
    </div>
    <div class="card">
      <div class="card-title">Trade Notes</div>
      ${!state.trades.filter(t=>t.notes).length ? empty('💭','No trade notes','Add notes when logging trades') :
        state.trades.filter(t=>t.notes).map(t=>`
          <div class="journal-entry" style="border-left-color:${Number(t.pnl)>=0?'var(--accent-green)':'var(--accent-red)'}">
            <div class="journal-date">${t.symbol} • ${t.exit_date?new Date(t.exit_date).toLocaleDateString():'—'} <span style="margin-left:1rem;color:${Number(t.pnl)>=0?'var(--accent-green)':'var(--accent-red)'}">${Number(t.pnl)>=0?'+':''}$${Number(t.pnl).toFixed(2)}</span></div>
            <div class="journal-text">${t.notes}</div>
          </div>`).join('')}
    </div>`;
}

// ── IMPORT ───────────────────────────────────────────────
function importView() {
  const p=state.csvParsed;
  return `
    <h1 class="header">Import Trades</h1>
    <div class="card">
      <div class="card-title">Upload CSV</div>
      <div class="drop-zone" id="drop-zone"
        onclick="document.getElementById('csv-file').click()"
        ondragover="event.preventDefault();this.classList.add('dragover')"
        ondragleave="this.classList.remove('dragover')"
        ondrop="handleDrop(event)">
        <div style="font-size:3rem;margin-bottom:0.75rem">📁</div>
        <h3>Drop CSV here or click to browse</h3>
        <p>Preview shown before any data is saved</p>
        <input type="file" accept=".csv" id="csv-file" style="display:none" onchange="handleCSVFile(event)">
        <button class="btn btn-primary" style="margin-top:1.25rem" onclick="event.stopPropagation();document.getElementById('csv-file').click()">Choose File</button>
      </div>
      ${p ? csvPreview(p) : ''}
    </div>
    <div class="card">
      <div class="card-title">Expected Format</div>
      <div style="overflow-x:auto">
        <table class="csv-table">
          <thead><tr>${['symbol','asset_type','direction','entry_price','exit_price','quantity','entry_date','exit_date','strategy','commission'].map(h=>`<th>${h}</th>`).join('')}</tr></thead>
          <tbody><tr>${['AAPL','stock','long','178.50','182.30','100','2025-01-10','2025-01-10','Breakout','2.00'].map(v=>`<td>${v}</td>`).join('')}</tr></tbody>
        </table>
      </div>
      <div style="margin-top:1rem"><a href="${api.getSampleCSVUrl()}" class="btn btn-secondary btn-sm" download>⬇ Download Sample CSV</a></div>
    </div>`;
}

function csvPreview(p) {
  const valid=p.rows.filter(r=>!r._error).length, errs=p.rows.filter(r=>r._error).length;
  return `
    <div class="csv-preview">
      <div class="csv-preview-header">
        <span>📋 <strong>${p.rows.length}</strong> rows — <span class="positive">${valid} valid</span>${errs?` • <span class="negative">${errs} errors</span>`:''}</span>
        <div style="display:flex;gap:0.75rem">
          <button class="btn btn-secondary btn-sm" onclick="clearCSV()">Clear</button>
          <button class="btn btn-primary btn-sm" id="import-btn" onclick="doConfirmImport()" ${!valid?'disabled':''}>Import ${valid} Trade${valid!==1?'s':''}</button>
        </div>
      </div>
      <div class="csv-table-wrap">
        <table class="csv-table">
          <thead><tr><th>#</th><th>Symbol</th><th>Type</th><th>Dir</th><th>Entry</th><th>Exit</th><th>Qty</th><th>P&L</th><th>Status</th></tr></thead>
          <tbody>
            ${p.rows.slice(0,20).map((r,i)=>`
              <tr>
                <td style="color:var(--text-secondary)">${i+1}</td>
                <td>${r.symbol||'—'}</td><td>${r.asset_type||'—'}</td>
                <td class="${r.direction==='long'?'positive':'negative'}">${r.direction||'—'}</td>
                <td>${r.entry_price||'—'}</td><td>${r.exit_price||'—'}</td><td>${r.quantity||'—'}</td>
                <td class="${r.pnl>=0?'positive':'negative'}">${r.pnl!=null?(r.pnl>=0?'+':'')+'$'+r.pnl.toFixed(2):'—'}</td>
                <td class="${r._error?'row-error':'row-valid'}">${r._error||'✓'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        ${p.rows.length>20?`<p style="color:var(--text-secondary);font-size:0.8rem;margin-top:0.5rem">Showing first 20 of ${p.rows.length}</p>`:''}
      </div>
      ${state.csvImporting?`<div class="import-progress"><div class="progress-bar"><div class="progress-fill" style="width:${state.csvProgress}%"></div></div><div class="progress-text">Importing… ${state.csvProgress}%</div></div>`:''}
    </div>`;
}

// ── BROKERS ──────────────────────────────────────────────
function brokers() {
  const INFO = {
    alpaca:     { name:'Alpaca', icon:'🦙', desc:'US Stocks & Crypto. Free paper + live trading.' },
    binance:    { name:'Binance', icon:'🟡', desc:'Crypto. Requires API key + secret from Binance account.' },
    metatrader: { name:'MetaTrader 5', icon:'📉', desc:'Forex & CFDs. Requires MT5 server URL from your broker.' },
    ibkr:       { name:'Interactive Brokers', icon:'🏦', desc:'Coming soon — requires TWS Gateway.', disabled:true },
  };
  return `
    <h1 class="header">Broker Connections</h1>
    ${state.brokers.length ? `
      <div class="card">
        <div class="card-title">Connected</div>
        ${state.brokers.map(b=>`
          <div class="trade-item" style="cursor:default">
            <div class="trade-header">
              <div><span class="trade-symbol">${b.broker_name}</span>${b.account_id?`<span style="margin-left:0.75rem;color:var(--text-secondary);font-size:0.85rem">${b.account_id}</span>`:''}</div>
              <div style="display:flex;gap:0.75rem;align-items:center">
                ${b.last_sync?`<span style="font-size:0.75rem;color:var(--text-secondary)">Synced ${new Date(b.last_sync).toLocaleString()}</span>`:''}
                <button class="btn btn-primary btn-sm" onclick="doSyncBroker('${b.id}','${b.broker_name}')">🔄 Sync</button>
                <button class="btn btn-danger btn-sm" onclick="doDeleteBroker('${b.id}')">✕</button>
              </div>
            </div>
          </div>`).join('')}
      </div>` : ''}
    <div class="card">
      <div class="card-title">Add Broker</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem;margin-bottom:2rem">
        ${Object.entries(INFO).map(([k,b])=>`
          <div class="trade-item ${b.disabled?'':'broker-card'}" style="cursor:${b.disabled?'not-allowed':'pointer'};opacity:${b.disabled?.5:1}" ${!b.disabled?`onclick="showBrokerForm('${k}')"`:''}> 
            <div style="font-size:2rem;margin-bottom:0.5rem">${b.icon}</div>
            <div class="trade-symbol">${b.name}</div>
            <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:0.4rem">${b.desc}</div>
            ${b.disabled?'<div style="margin-top:0.5rem;font-size:0.75rem;color:var(--accent-yellow)">Coming Soon</div>':''}
          </div>`).join('')}
      </div>
      <div id="broker-form"></div>
    </div>
    <div class="card">
      <div class="card-title">ℹ️ How it Works</div>
      <p style="color:var(--text-secondary);font-size:0.875rem;line-height:1.7">Connect a broker, click Sync, and TradeVault fetches your completed trades via the broker's API. Duplicates are skipped automatically — sync as often as you like. API keys are stored on your Render server, never in the browser. For brokers without an API, export as CSV and use the Import tab.</p>
    </div>`;
}

function showBrokerForm(key) {
  const forms = {
    alpaca: `
      <h3 style="font-family:'Syne';font-weight:700;margin-bottom:1rem">🦙 Connect Alpaca</h3>
      <div class="form-row">
        <div class="form-group"><label class="form-label">API Key ID</label><input class="form-input" id="bk-key" placeholder="PKXXXXXXXX"></div>
        <div class="form-group"><label class="form-label">API Secret</label><input type="password" class="form-input" id="bk-secret"></div>
      </div>
      <div class="form-group"><label class="form-label">Mode</label><select class="form-select" id="bk-paper"><option value="true">Paper Trading</option><option value="false">Live Trading</option></select></div>`,
    binance: `
      <h3 style="font-family:'Syne';font-weight:700;margin-bottom:1rem">🟡 Connect Binance</h3>
      <div class="form-row">
        <div class="form-group"><label class="form-label">API Key</label><input class="form-input" id="bk-key" placeholder="Your Binance API key"></div>
        <div class="form-group"><label class="form-label">API Secret</label><input type="password" class="form-input" id="bk-secret"></div>
      </div>`,
    metatrader: `
      <h3 style="font-family:'Syne';font-weight:700;margin-bottom:1rem">📉 Connect MetaTrader 5</h3>
      <div class="form-row">
        <div class="form-group"><label class="form-label">API Token</label><input class="form-input" id="bk-key" placeholder="MT5 API token"></div>
        <div class="form-group"><label class="form-label">Account ID</label><input class="form-input" id="bk-account"></div>
      </div>
      <div class="form-group"><label class="form-label">MT5 Server URL</label><input class="form-input" id="bk-server" placeholder="https://mt5.yourbroker.com"></div>`
  };
  document.getElementById('broker-form').innerHTML = `
    <div style="background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:8px;padding:1.5rem">
      ${forms[key]||''}
      <div style="display:flex;gap:0.75rem;margin-top:1.25rem">
        <button class="btn btn-primary" onclick="doAddBroker('${key}')">Save Connection</button>
        <button class="btn btn-secondary" onclick="document.getElementById('broker-form').innerHTML=''">Cancel</button>
      </div>
    </div>`;
}

// ── TRADE MODAL ──────────────────────────────────────────
function tradeModal() {
  const t=state.selectedTrade, isView=!!t, d=t||{};
  const fmtDT=dt=>dt?new Date(dt).toISOString().slice(0,16):'';
  return `
    <div class="modal" onclick="closeTradeModal()">
      <div class="modal-content" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
          <h2 style="font-family:'Syne';font-size:1.75rem;font-weight:700">${isView?'Trade Details':'New Trade'}</h2>
          <button class="btn btn-secondary" onclick="closeTradeModal()">✕</button>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Symbol</label><input class="form-input" id="t-sym" placeholder="AAPL, EUR/USD…" value="${d.symbol||''}" ${isView?'disabled':''}></div>
          <div class="form-group"><label class="form-label">Asset Type</label><select class="form-select" id="t-at" ${isView?'disabled':''}>${['stock','forex','crypto','futures','options'].map(v=>`<option value="${v}" ${d.asset_type===v?'selected':''}>${v.charAt(0).toUpperCase()+v.slice(1)}</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">Direction</label><select class="form-select" id="t-dir" ${isView?'disabled':''}><option value="long" ${d.direction==='long'?'selected':''}>Long</option><option value="short" ${d.direction==='short'?'selected':''}>Short</option></select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Entry Price</label><input type="number" step="any" class="form-input" id="t-ep" value="${d.entry_price||''}" ${isView?'disabled':''}></div>
          <div class="form-group"><label class="form-label">Exit Price</label><input type="number" step="any" class="form-input" id="t-xp" value="${d.exit_price||''}" ${isView?'disabled':''}></div>
          <div class="form-group"><label class="form-label">Quantity</label><input type="number" step="any" class="form-input" id="t-qty" value="${d.quantity||''}" ${isView?'disabled':''}></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Stop Loss</label><input type="number" step="any" class="form-input" id="t-sl" value="${d.stop_loss||''}" ${isView?'disabled':''}></div>
          <div class="form-group"><label class="form-label">Take Profit</label><input type="number" step="any" class="form-input" id="t-tp" value="${d.take_profit||''}" ${isView?'disabled':''}></div>
          <div class="form-group"><label class="form-label">Commission</label><input type="number" step="any" class="form-input" id="t-com" value="${d.commission||0}" ${isView?'disabled':''}></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Entry Date/Time</label><input type="datetime-local" class="form-input" id="t-ed" value="${fmtDT(d.entry_date)}" ${isView?'disabled':''}></div>
          <div class="form-group"><label class="form-label">Exit Date/Time</label><input type="datetime-local" class="form-input" id="t-xd" value="${fmtDT(d.exit_date)}" ${isView?'disabled':''}></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Strategy</label><input class="form-input" id="t-strat" placeholder="Breakout, Trend Following…" value="${d.strategy||''}" ${isView?'disabled':''}></div>
          <div class="form-group"><label class="form-label">Market Conditions</label><input class="form-input" id="t-cond" placeholder="Bullish, Ranging…" value="${d.market_conditions||''}" ${isView?'disabled':''}></div>
        </div>
        <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" id="t-notes" placeholder="Reasoning, feelings, lessons…" ${isView?'disabled':''}>${d.notes||''}</textarea></div>
        ${isView ? `
          <div class="stat-card" style="margin-top:1rem;text-align:center">
            <div class="stat-label">Final P&L</div>
            <div class="stat-value" style="color:${Number(d.pnl)>=0?'var(--accent-green)':'var(--accent-red)'}">${Number(d.pnl)>=0?'+':''}$${Number(d.pnl).toFixed(2)}</div>
          </div>
          <div style="display:flex;gap:0.75rem;margin-top:1.5rem">
            <button class="btn btn-danger" onclick="doDeleteTrade('${d.id}');closeTradeModal()">Delete</button>
            <button class="btn btn-secondary" onclick="closeTradeModal()">Close</button>
          </div>` : `
          <div style="display:flex;gap:1rem;margin-top:1.5rem">
            <button class="btn btn-primary" id="save-btn" onclick="doSaveTrade()">Save Trade</button>
            <button class="btn btn-secondary" onclick="closeTradeModal()">Cancel</button>
          </div>`}
      </div>
    </div>`;
}

// ── EVENT HANDLERS ───────────────────────────────────────
function changeView(v)       { state.currentView=v; render(); }
function openAddTradeModal() { state.selectedTrade=null; state.showTradeModal=true; render(); }
function viewTrade(id)       { state.selectedTrade=state.trades.find(t=>String(t.id)===String(id)); state.showTradeModal=true; render(); }
function closeTradeModal()   { state.showTradeModal=false; state.selectedTrade=null; render(); }
function updateFilter(type,val) { if(type==='assetType')state.filterAssetType=val; else state.filterDirection=val; render(); }
function changeCalendarMonth(d) { const dt=new Date(state.calendarDate); dt.setMonth(dt.getMonth()+d); state.calendarDate=dt; render(); }

function viewCalendarDay(ds) {
  const date=new Date(ds);
  const dt=state.trades.filter(t=>t.exit_date&&new Date(t.exit_date).toDateString()===date.toDateString());
  if(dt.length) { const p=dt.reduce((s,t)=>s+Number(t.pnl),0); alert(`${dt.length} trade(s) on ${date.toLocaleDateString()}\n\n${dt.map(t=>`${t.symbol}: ${Number(t.pnl)>=0?'+':''}$${Number(t.pnl).toFixed(2)}`).join('\n')}\n\nDaily P&L: ${p>=0?'+':''}$${p.toFixed(2)}`); }
}

async function doSaveTrade() {
  const btn=document.getElementById('save-btn');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Saving…';}
  const sym=document.getElementById('t-sym').value;
  const ep=parseFloat(document.getElementById('t-ep').value);
  const xp=parseFloat(document.getElementById('t-xp').value);
  const qty=parseFloat(document.getElementById('t-qty').value);
  if(!sym||isNaN(ep)||isNaN(xp)||isNaN(qty)){toast('Symbol, prices, and quantity are required','error');if(btn){btn.disabled=false;btn.textContent='Save Trade';}return;}
  try {
    state.syncing=true;
    const res=await api.createTrade({
      symbol:sym, entry_price:ep, exit_price:xp, quantity:qty,
      asset_type:document.getElementById('t-at').value,
      direction:document.getElementById('t-dir').value,
      commission:parseFloat(document.getElementById('t-com').value)||0,
      entry_date:document.getElementById('t-ed').value||null,
      exit_date:document.getElementById('t-xd').value||null,
      stop_loss:parseFloat(document.getElementById('t-sl').value)||null,
      take_profit:parseFloat(document.getElementById('t-tp').value)||null,
      strategy:document.getElementById('t-strat').value||null,
      notes:document.getElementById('t-notes').value||null,
      market_conditions:document.getElementById('t-cond').value||null
    });
    state.trades.unshift(res.data); state.syncing=false;
    toast(`Saved — ${sym} ${res.data.pnl>=0?'+':''}$${Number(res.data.pnl).toFixed(2)}`,'success');
    closeTradeModal();
  } catch(err){state.syncing=false;toast(`Failed: ${err.message}`,'error');if(btn){btn.disabled=false;btn.textContent='Save Trade';}}
}

async function doDeleteTrade(id) {
  if(!confirm('Delete this trade?'))return;
  try { state.syncing=true; await api.deleteTrade(id); state.trades=state.trades.filter(t=>String(t.id)!==String(id)); state.syncing=false; toast('Trade deleted','info'); render(); }
  catch(err){state.syncing=false;toast(`Failed: ${err.message}`,'error');}
}

async function doSaveJournal() {
  const btn=document.getElementById('jsave');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Saving…';}
  const date=document.getElementById('jdate').value, content=document.getElementById('jcontent').value.trim();
  if(!date||!content){toast('Date and content required','error');if(btn){btn.disabled=false;btn.textContent='Save Entry';}return;}
  try {
    state.syncing=true;
    const res=await api.createJournal({entry_date:date,content});
    state.journalEntries.unshift(res.data); state.syncing=false;
    toast('Journal entry saved!','success'); render();
  } catch(err){state.syncing=false;toast(`Failed: ${err.message}`,'error');if(btn){btn.disabled=false;btn.textContent='Save Entry';}}
}

async function doDeleteJournal(id) {
  try { await api.deleteJournal(id); state.journalEntries=state.journalEntries.filter(e=>String(e.id)!==String(id)); toast('Entry deleted','info'); render(); }
  catch(err){toast(`Failed: ${err.message}`,'error');}
}

function handleDrop(e) { e.preventDefault(); document.getElementById('drop-zone').classList.remove('dragover'); const f=e.dataTransfer.files[0]; if(f?.name.endsWith('.csv'))uploadCSV(f); else toast('Please drop a .csv file','error'); }
function handleCSVFile(e) { uploadCSV(e.target.files[0]); }
async function uploadCSV(file) {
  const fd=new FormData(); fd.append('file',file);
  try { toast('Parsing CSV…','info',2000); const res=await api.previewCSV(fd); state.csvParsed=res.data; render(); }
  catch(err){toast(`Parse error: ${err.message}`,'error');}
}

async function doConfirmImport() {
  if(!state.csvParsed)return;
  const valid=state.csvParsed.rows.filter(r=>!r._error);
  state.csvImporting=true; state.csvProgress=10; render();
  try {
    state.csvProgress=50; render();
    const res=await api.confirmImport(valid);
    state.csvProgress=100;
    const fresh=await api.getTrades(); state.trades=fresh.data;
    state.csvParsed=null; state.csvImporting=false;
    toast(`Imported ${res.imported} trade${res.imported!==1?'s':''}!`,'success'); render();
  } catch(err){state.csvImporting=false;toast(`Import failed: ${err.message}`,'error');render();}
}

function clearCSV(){state.csvParsed=null;render();}

async function doAddBroker(key) {
  const api_key=document.getElementById('bk-key')?.value;
  const api_secret=document.getElementById('bk-secret')?.value;
  const account_id=document.getElementById('bk-account')?.value;
  if(!api_key){toast('API key is required','error');return;}
  try {
    const res=await api.addBroker({broker_name:key,api_key,api_secret,account_id});
    state.brokers.push(res.data); toast(`${key} connected!`,'success'); render();
  } catch(err){toast(`Failed: ${err.message}`,'error');}
}

async function doSyncBroker(id,name) {
  try {
    toast(`Syncing ${name}…`,'info',3000);
    const res=await api.syncBroker(id);
    if(res.imported>0){const fresh=await api.getTrades();state.trades=fresh.data;}
    const i=state.brokers.findIndex(b=>b.id===id);
    if(i>=0)state.brokers[i].last_sync=new Date().toISOString();
    toast(`Synced ${res.imported} trade${res.imported!==1?'s':''} from ${name}`,'success'); render();
  } catch(err){toast(`Sync failed: ${err.message}`,'error');}
}

async function doDeleteBroker(id) {
  if(!confirm('Remove this broker connection?'))return;
  try { await api.deleteBroker(id); state.brokers=state.brokers.filter(b=>b.id!==id); toast('Broker removed','info'); render(); }
  catch(err){toast(`Failed: ${err.message}`,'error');}
}

init();
