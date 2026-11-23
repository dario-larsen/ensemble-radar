// Ensemble Radar's plain dashboard. It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, a filterable table, a per-protocol detail view with the five signal
// bars and the model's own arithmetic, and the live-token table the multiples are calibrated from.
// No network: every byte it shows is in data.js. Hash-routed, so a link opens one state:
// #p=<slug> a protocol's detail, #q= search, #category=, #chain=, #regime=, #sort=, #tab=pre|live.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  app.setAttribute('aria-busy', 'false');
  var state = { q: '', category: 'all', chain: 'all', regime: 'all', sort: 'implied', dir: -1, tab: 'pre', selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // The model in one function: the page recomputes a row from the snapshot figures and checks the
  // number board.json carries, so the page's code and the board's data are visibly the same arithmetic.
  function impliedOf(row) {
    return Math.max(1, Math.round(row.tvl_usd * row.model.multiple * row.model.momentum_multiplier * row.model.tenure_multiplier * row.model.reach_multiplier));
  }

  function uniq(list) {
    var seen = {};
    var out = [];
    list.forEach(function (v) { if (!seen[v]) { seen[v] = true; out.push(v); } });
    return out.sort();
  }
  var categories = uniq(DATA.rows.map(function (r) { return r.category || '(no category)'; }));
  var chains = uniq(DATA.rows.reduce(function (a, r) { return a.concat(r.chains); }, []));
  var regimes = ['breakout', 'heating', 'steady', 'cooling', 'fading', 'unknown'];

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q') !== null) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('regime')) state.regime = params.get('regime');
    if (params.get('sort')) state.sort = params.get('sort');
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('p')) state.selected = params.get('p');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.regime !== 'all') params.set('regime', state.regime);
    if (state.sort !== 'implied') params.set('sort', state.sort);
    if (state.tab !== 'pre') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (window.location.hash.replace(/^#/, '') !== next) {
      history.replaceState(null, '', next ? '#' + next : window.location.pathname + window.location.search);
    }
  }

  function filteredRows() {
    var rows = DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || '(no category)') !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (state.regime !== 'all' && r.regime !== state.regime) return false;
      if (state.q) {
        var q = state.q.toLowerCase();
        if (r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0 && (r.category || '').toLowerCase().indexOf(q) < 0) return false;
      }
      return true;
    });
    var key = state.sort;
    var dir = state.dir;
    rows.sort(function (a, b) {
      var va, vb;
      if (key === 'tvl') { va = a.tvl_usd; vb = b.tvl_usd; }
      else if (key === 'growth') { va = a.change_7d === null ? -9999 : a.change_7d; vb = b.change_7d === null ? -9999 : b.change_7d; }
      else if (key === 'age') { va = a.age_days === null ? -1 : a.age_days; vb = b.age_days === null ? -1 : b.age_days; }
      else if (key === 'ensemble') { va = a.signals.ensemble; vb = b.signals.ensemble; }
      else { va = a.implied_value_usd; vb = b.implied_value_usd; }
      return (va - vb) * dir || (a.slug < b.slug ? -1 : 1);
    });
    return rows;
  }

  function signalBars(s) {
    var vals = [s.scale, s.multiple, s.momentum, s.tenure, s.reach];
    return '<span class="bars" title="scale ' + s.scale + ' · multiple ' + s.multiple + ' · momentum ' + s.momentum + ' · tenure ' + s.tenure + ' · reach ' + s.reach + '">' +
      vals.map(function (v) { return '<i style="height:' + Math.max(3, Math.round(v / 100 * 22)) + 'px"></i>'; }).join('') + '</span>';
  }

  function sortBtn(label, key) {
    var arrow = state.sort === key ? (state.dir === -1 ? ' ↓' : ' ↑') : '';
    return '<button data-sort="' + key + '">' + label + arrow + '</button>';
  }

  function renderControls() {
    var c = document.getElementById('controls');
    c.innerHTML =
      '<input type="search" id="q" placeholder="Search name, slug or category…" value="' + esc(state.q) + '" aria-label="Search">' +
      '<select id="fcat" aria-label="Category"><option value="all">All categories</option>' +
        categories.map(function (x) { return '<option value="' + esc(x) + '"' + (state.category === x ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>' +
      '<select id="fchain" aria-label="Chain"><option value="all">All chains</option>' +
        chains.map(function (x) { return '<option value="' + esc(x) + '"' + (state.chain === x ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>' +
      '<select id="fregime" aria-label="Regime"><option value="all">All regimes</option>' +
        regimes.map(function (x) { return '<option value="' + x + '"' + (state.regime === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select>' +
      '<select id="fsort" aria-label="Sort by">' +
        [['implied', 'Implied value'], ['ensemble', 'Ensemble score'], ['tvl', 'TVL'], ['growth', '7d growth'], ['age', 'Age']].map(function (o) {
          return '<option value="' + o[0] + '"' + (state.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('') + '</select>' +
      '<span class="tabs"><button class="tab" id="tab-pre" aria-pressed="' + (state.tab === 'pre') + '">Pre-token board</button>' +
      '<button class="tab" id="tab-live" aria-pressed="' + (state.tab === 'live') + '">Already trading</button></span>';
    document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; state.selected = null; writeHash(); render(); });
    document.getElementById('fcat').addEventListener('change', function (e) { state.category = e.target.value; writeHash(); render(); });
    document.getElementById('fchain').addEventListener('change', function (e) { state.chain = e.target.value; writeHash(); render(); });
    document.getElementById('fregime').addEventListener('change', function (e) { state.regime = e.target.value; writeHash(); render(); });
    document.getElementById('fsort').addEventListener('change', function (e) { state.sort = e.target.value; state.dir = -1; writeHash(); render(); });
    document.getElementById('tab-pre').addEventListener('click', function () { state.tab = 'pre'; writeHash(); render(); });
    document.getElementById('tab-live').addEventListener('click', function () { state.tab = 'live'; writeHash(); render(); });
  }

  function renderStats(rows) {
    var total = DATA.rows.reduce(function (n, r) { return n + r.implied_value_usd; }, 0);
    var shown = state.tab === 'live' ? DATA.live.length : rows.length;
    document.getElementById('stats').innerHTML =
      '<span class="chip"><b>' + shown + '</b> of ' + DATA.rows.length + ' board rows</span>' +
      '<span class="chip">watchlist <b>' + DATA.watchlist_size + '/' + DATA.watchlist_size + '</b> covered</span>' +
      '<span class="chip">early rows below the floor: <b>' + DATA.early_size + '</b></span>' +
      '<span class="chip">global category multiple <b>×' + DATA.global_multiple.toFixed(3) + '</b></span>' +
      '<span class="chip">board implied value <b>' + fmtUsd(total) + '</b></span>';
  }

  function renderDetail() {
    var box = document.getElementById('detail');
    if (!state.selected) { box.innerHTML = ''; return; }
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === state.selected) row = r; });
    if (!row) { box.innerHTML = ''; return; }
    var recomputed = impliedOf(row);
    var match = recomputed === row.implied_value_usd ? 'matches board.json' : 'differs from board.json';
    var cal = null;
    DATA.calibration.forEach(function (x) { if (x.category === (row.category || '(no category)')) cal = x; });
    var sig = row.signals;
    var sigRows = [['Scale', sig.scale, 'log TVL across the board'], ['Multiple', sig.multiple, 'category multiple across the board'],
      ['Momentum', sig.momentum, '7d change, −60%…+150%'], ['Tenure', sig.tenure, 'age with no token, to 3y'], ['Reach', sig.reach, 'chains, to 8']]
      .map(function (s) {
        return '<div class="sigrow"><span>' + s[0] + '</span><span class="bar"><i style="width:' + s[1] + '%"></i></span><b>' + s[1].toFixed(1) + '</b></div>';
      }).join('');
    box.innerHTML = '<section class="detail" aria-label="Protocol detail">' +
      '<button class="closebtn" id="dclose">Close ✕</button>' +
      '<h2><span class="ranktag">RANK ' + row.rank + '</span>' + esc(row.name) + '</h2>' +
      '<p class="dmeta">' + esc(row.category || 'no category') + ' · ' + esc(row.chains.join(', ') || 'no chains listed') +
      ' · TVL ' + fmtUsd(row.tvl_usd) + ' · 7d ' + fmtPct(row.change_7d) + ' · age ' + fmtAge(row.age_days) +
      ' · regime <span class="regime ' + row.regime + '">' + row.regime + '</span> · records no token</p>' +
      '<div class="dgrid"><div class="dbox"><h3>Five signals — ensemble ' + sig.ensemble.toFixed(1) + ' / 100</h3>' + sigRows + '</div>' +
      '<div class="dbox"><h3>Implied value arithmetic</h3><p class="math">' +
      'TVL ' + fmtUsd(row.tvl_usd) + ' × multiple <b>×' + row.model.multiple.toFixed(3) + '</b>' +
      (cal ? ' (' + cal.peers + ' live peer' + (cal.peers === 1 ? '' : 's') + (cal.fallback ? ', global fallback' : '') + ')' : '') +
      '<br>× momentum <b>×' + row.model.momentum_multiplier.toFixed(3) + '</b> (' + fmtPct(row.model.growth_pct) + ' over 7d)' +
      '<br>× tenure <b>×' + row.model.tenure_multiplier.toFixed(3) + '</b> (' + fmtAge(row.age_days) + ' with no token)' +
      '<br>× reach <b>×' + row.model.reach_multiplier.toFixed(3) + '</b> (' + row.chains.length + ' chain' + (row.chains.length === 1 ? '' : 's') + ')' +
      '<br>= implied value <b>' + fmtUsd(row.implied_value_usd) + '</b>' +
      '<br><span style="color:var(--muted)">Page recomputes ' + fmtUsd(recomputed) + ' — ' + match + '.</span></p></div>' +
      '<div class="dbox"><h3>Farm plan — seven steps</h3><ol class="farm">' +
      row.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol></div></div></section>';
    document.getElementById('dclose').addEventListener('click', function () { state.selected = null; writeHash(); render(); });
  }

  function renderTable(rows) {
    var w = document.getElementById('tablewrap');
    if (state.tab === 'live') { w.innerHTML = ''; renderLive(); return; }
    document.getElementById('livewrap').innerHTML = '';
    if (rows.length === 0) { w.innerHTML = '<div class="empty">No protocols match this filter. Clear the search or widen the filters.</div>'; return; }
    var html = '<table><thead><tr><th class="num">' + sortBtn('#', 'implied') + '</th><th>Protocol</th><th>Chains</th>' +
      '<th class="num">' + sortBtn('TVL', 'tvl') + '</th><th class="num">' + sortBtn('7d', 'growth') + '</th>' +
      '<th class="num">' + sortBtn('Age', 'age') + '</th><th>Regime</th><th class="num">' + sortBtn('Ensemble', 'ensemble') + '</th>' +
      '<th class="num">' + sortBtn('Implied value', 'implied') + '</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var pct = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var cls = r.change_7d === null ? '' : (r.change_7d >= 0 ? 'pos' : 'neg');
      html += '<tr data-slug="' + esc(r.slug) + '"' + (state.selected === r.slug ? ' class="sel"' : '') + '>' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><b>' + esc(r.name) + '</b><span class="sub">' + esc(r.category || 'no category') + ' · ' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num ' + cls + '">' + pct + '</td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td>' +
        '<td><span class="regime ' + r.regime + '">' + r.regime + '</span></td>' +
        '<td class="num"><span class="score">' + r.signals.ensemble.toFixed(1) + '</span> ' + signalBars(r.signals) + '</td>' +
        '<td class="num"><b>' + fmtUsd(r.implied_value_usd) + '</b></td></tr>';
    });
    html += '</tbody></table>';
    w.innerHTML = html;
    w.querySelectorAll('th button').forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-sort');
        if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; }
        writeHash(); render();
      });
    });
    w.querySelectorAll('tbody tr').forEach(function (tr) {
      tr.addEventListener('click', function () {
        state.selected = tr.getAttribute('data-slug');
        writeHash(); render();
        document.getElementById('detail').scrollIntoView({ block: 'nearest' });
      });
    });
  }

  function renderLive() {
    var w = document.getElementById('livewrap');
    var html = '<p style="color:var(--muted)">Protocols whose token already trades, at the market\u2019s own value — never mixed into the ranking. Their mcap/TVL ratios are the calibration set for the category multiples above.</p>' +
      '<div class="tablewrap"><table><thead><tr><th>Protocol</th><th>Category</th><th class="num">TVL</th><th class="num">Market cap</th><th class="num">mcap / TVL</th><th class="num">7d</th></tr></thead><tbody>';
    DATA.live.forEach(function (r) {
      html += '<tr><td><b>' + esc(r.name) + '</b><span class="sub">' + esc(r.slug) + '</span></td><td>' + esc(r.category || 'no category') + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td><td class="num">' + fmtUsd(r.mcap_usd) + '</td>' +
        '<td class="num">' + (r.mcap_tvl_ratio === null ? 'n/a' : '×' + r.mcap_tvl_ratio.toFixed(3)) + '</td>' +
        '<td class="num">' + fmtPct(r.change_7d) + '</td></tr>';
    });
    html += '</tbody></table></div>';
    w.innerHTML = html;
  }

  var firstRender = true;
  function render() {
    renderControls();
    var rows = filteredRows();
    renderStats(rows);
    renderDetail();
    renderTable(rows);
    var q = document.getElementById('q');
    if (q && document.activeElement !== q) q.value = state.q;
    if (firstRender) {
      firstRender = false;
      if (state.selected) {
        var d = document.getElementById('detail');
        if (d && d.firstChild) d.scrollIntoView();
      }
    }
  }

  readHash();
  render();
  window.addEventListener('hashchange', function () { readHash(); render(); });

  var meta = document.getElementById('meta');
  meta.innerHTML = 'Snapshot <b>' + esc(DATA.as_of) + '</b><br>Board <b>' + DATA.board_size + ' rows</b> · model <b>' + esc(DATA.model_version) + '</b><br>Floor <b>' + fmtUsd(DATA.floor_usd) + '</b>';
  document.getElementById('foot-model').textContent = 'Model ' + DATA.model_version + ': growth clamped ' + DATA.model.growth_floor + '%…' + DATA.model.growth_cap + '% at weight ' + DATA.model.growth_weight + '; tenure ' + DATA.model.tenure_floor + ' + ' + DATA.model.tenure_range + ' over ' + DATA.model.tenure_days + ' days; reach +' + (DATA.model.reach_step * 100) + '% per chain to ' + DATA.model.reach_cap + '; multiples clamped ×' + DATA.model.multiple_floor + '…×' + DATA.model.multiple_cap + '; ' + DATA.model.min_peers + ' live peers to calibrate a category, else the global median ×' + DATA.global_multiple.toFixed(3) + '.';
})();
