// Token Launch Radar dashboard: renders window.RADAR (written by main.ts
// as ../data.js) with no framework, no fetch and no network. Three views
// (board, live tokens, the model) plus one detail view per protocol.
// View state lives in location.hash so a screenshot or a shared link can
// deep-link a view: #p=<slug>, #view=board&cat=Dexs, #view=live, #view=model.
(function () {
  var R = window.RADAR;
  var app = document.getElementById('app');
  var statsEl = document.getElementById('stats');
  if (!R) { app.innerHTML = '<div class="card"><h2>No data</h2><p>data.js was not found. Run main.ts first.</p></div>'; return; }

  function money(n) {
    if (n === null || n === undefined) return '—';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function pct(n) {
    if (n === null || n === undefined) return '—';
    var cls = n >= 0 ? 'pos' : 'neg';
    return '<span class="' + cls + '">' + (n >= 0 ? '+' : '') + n.toFixed(2) + '%</span>';
  }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ageText(days) { return days === null ? 'unknown' : days + 'd'; }

  document.getElementById('sub').textContent =
    R.scanned + ' protocols scanned · ' + R.pre_token + ' record no token · ' + R.board_size +
    ' ranked (' + R.early_size + ' beyond the watchlist) · snapshot as of ' + R.as_of + '.';

  var cards = [
    [R.scanned, 'protocols scanned'],
    [R.pre_token, 'record no token'],
    [R.board_size, 'ranked on the board'],
    [R.watchlist_size, 'watchlist protocols, all covered'],
    [R.early_size, 'early finds below the $50M floor'],
    [R.live_size, 'live tokens shown apart'],
  ];
  statsEl.innerHTML = cards.map(function (c) { return '<div class="stat"><b>' + c[0] + '</b><span>' + c[1] + '</span></div>'; }).join('');

  function parseHash() {
    var h = location.hash.replace(/^#/, '');
    var out = {};
    h.split('&').forEach(function (part) {
      if (!part) return;
      var kv = part.split('=');
      out[decodeURIComponent(kv[0])] = decodeURIComponent(kv.slice(1).join('=') || '');
    });
    if (out.p) return { view: 'detail', slug: out.p };
    return { view: out.view || 'board', cat: out.cat || '', chain: out.chain || '', scope: out.scope || 'all', q: out.q || '' };
  }
  function setHash(obj) {
    var parts = [];
    Object.keys(obj).forEach(function (k) { if (obj[k]) parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(obj[k])); });
    location.hash = parts.join('&');
  }

  var sortKey = 'implied_value_usd';
  var sortDir = -1;

  function render() {
    var state = parseHash();
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.view === state.view || (state.view === 'detail' && b.dataset.view === 'board'));
    });
    if (state.view === 'detail') return renderDetail(state.slug);
    if (state.view === 'live') return renderLive();
    if (state.view === 'model') return renderModel();
    return renderBoard(state);
  }

  function renderBoard(state) {
    var cats = [];
    var chains = [];
    R.rows.forEach(function (r) {
      if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
      r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
    });
    cats.sort(); chains.sort();
    var rows = R.rows.filter(function (r) {
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (state.scope === 'watchlist' && !r.watchlist) return false;
      if (state.scope === 'early' && r.watchlist) return false;
      if (state.q && (r.name + ' ' + r.slug).toLowerCase().indexOf(state.q.toLowerCase()) < 0) return false;
      return true;
    });
    rows = rows.slice().sort(function (a, b) {
      var av = a[sortKey], bv = b[sortKey];
      if (typeof av === 'string') return sortDir * av.localeCompare(bv);
      return sortDir * ((av || 0) - (bv || 0));
    });
    var cols = [
      ['rank', '#'], ['name', 'Protocol'], ['category', 'Category'], ['chains', 'Chains'],
      ['tvl_usd', 'TVL'], ['change_7d', '7d'], ['age_days', 'Age'], ['category_multiple', 'Multiple'], ['implied_value_usd', 'Implied value'],
    ];
    var head = cols.map(function (c) {
      var right = ['tvl_usd', 'change_7d', 'age_days', 'category_multiple', 'implied_value_usd', 'rank'].indexOf(c[0]) >= 0 ? ' class="num"' : '';
      return '<th data-key="' + c[0] + '"' + right + '>' + c[1] + '</th>';
    }).join('');
    var body = rows.map(function (r) {
      return '<tr class="row" data-slug="' + esc(r.slug) + '">' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><strong>' + esc(r.name) + '</strong><span class="badge ' + (r.watchlist ? 'watch' : 'early') + '">' + (r.watchlist ? 'watchlist' : 'early') + '</span><span class="slug">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + ageText(r.age_days) + '</td>' +
        '<td class="num">' + r.category_multiple.toFixed(2) + '×</td>' +
        '<td class="num"><strong>' + money(r.implied_value_usd) + '</strong></td></tr>';
    }).join('');
    app.innerHTML =
      '<div class="controls">' +
      '<input id="q" type="search" placeholder="Search name or slug…" value="' + esc(state.q || '') + '">' +
      '<select id="cat"><option value="">All categories</option>' + cats.map(function (c) { return '<option' + (c === state.cat ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<select id="chain"><option value="">All chains</option>' + chains.map(function (c) { return '<option' + (c === state.chain ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<button data-scope="all" class="' + (state.scope === 'all' ? 'on' : '') + '">All</button>' +
      '<button data-scope="watchlist" class="' + (state.scope === 'watchlist' ? 'on' : '') + '">Watchlist</button>' +
      '<button data-scope="early" class="' + (state.scope === 'early' ? 'on' : '') + '">Early</button>' +
      '<span class="count">' + rows.length + ' of ' + R.rows.length + ' rows — click a row for its detail and farm plan</span></div>' +
      '<table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';
    document.getElementById('q').addEventListener('input', function (e) { setHash({ view: 'board', cat: state.cat, chain: state.chain, scope: state.scope, q: e.target.value }); var el = document.getElementById('q'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
    document.getElementById('cat').addEventListener('change', function (e) { setHash({ view: 'board', cat: e.target.value, chain: state.chain, scope: state.scope }); });
    document.getElementById('chain').addEventListener('change', function (e) { setHash({ view: 'board', cat: state.cat, chain: e.target.value, scope: state.scope }); });
    app.querySelectorAll('[data-scope]').forEach(function (b) { b.addEventListener('click', function () { setHash({ view: 'board', cat: state.cat, chain: state.chain, scope: b.dataset.scope }); }); });
    app.querySelectorAll('th').forEach(function (th) { th.addEventListener('click', function () { var k = th.dataset.key; if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = k === 'name' || k === 'category' ? 1 : -1; } render(); }); });
    app.querySelectorAll('tr.row').forEach(function (tr) { tr.addEventListener('click', function () { setHash({ p: tr.dataset.slug }); }); });
  }

  function renderDetail(slug) {
    var r = null;
    R.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) { app.innerHTML = '<div class="card"><h2>Not on the board</h2><p>' + esc(slug) + ' is not a ranked row.</p></div>'; return; }
    var plan = r.farm_steps.map(function (s) {
      var m = s.match(/^(.*) Cost: (.*)\. Time: (.*)\.$/);
      if (!m) return '<li>' + esc(s) + '</li>';
      return '<li>' + esc(m[1]) + '<br><span class="slug">Cost: ' + esc(m[2]) + ' · Time: ' + esc(m[3]) + '</span></li>';
    }).join('');
    app.innerHTML =
      '<button class="back" id="back">← Back to the board</button>' +
      '<div class="detail"><p class="kicker">#' + r.rank + ' · ' + (r.watchlist ? 'WATCHLIST' : 'EARLY FIND') + '</p>' +
      '<h2>' + esc(r.name) + '</h2><p class="sub">' + esc(r.slug) + ' · ' + esc(r.category || 'uncategorised') + ' · ' + esc(r.chains.join(', ')) + '</p>' +
      '<div class="grid">' +
      '<div class="cell"><b>' + money(r.implied_value_usd) + '</b><span>implied value (model)</span></div>' +
      '<div class="cell"><b>' + money(r.tvl_usd) + '</b><span>TVL in the snapshot</span></div>' +
      '<div class="cell"><b>' + r.category_multiple.toFixed(4) + '×</b><span>category multiple, from ' + r.category_peers + ' traded peers</span></div>' +
      '<div class="cell"><b>' + ageText(r.age_days) + '</b><span>age · listed ' + esc(r.listed_at || 'unknown') + '</span></div></div>' +
      '<div class="formula">TVL × multiple × growth × maturity = implied<br>' +
      money(r.tvl_usd) + ' × ' + r.category_multiple.toFixed(4) + ' × ' + r.growth_multiplier.toFixed(4) + ' × ' + r.maturity_multiplier.toFixed(4) + ' = ' + money(r.implied_value_usd) + '</div>' +
      '<p class="explain">The multiple is the shrunk median market-cap / TVL of traded ' + esc(r.category || '') + ' protocols in this same snapshot. Growth uses the 7-day TVL change (' + (r.change_7d === null ? 'none reported' : r.change_7d.toFixed(2) + '%') + ', clamped), maturity rises with age up to three years. Change any peer in the snapshot and this number moves — that is the point of learning it instead of fixing it.</p>' +
      '<h3>A farm plan, if a token ever comes</h3><ol class="plan">' + plan + '</ol>' +
      '<p class="explain">Honesty note: this protocol records no token in the snapshot. Records no token is not proof it has none, and it is not a promise of an airdrop. The plan is ordinary product usage, sized from its TVL tier, in case usage is ever rewarded.</p></div>';
    document.getElementById('back').addEventListener('click', function () { setHash({ view: 'board' }); });
  }

  function renderLive() {
    var body = R.live.map(function (r, i) {
      return '<tr><td class="num">' + (i + 1) + '</td><td><strong>' + esc(r.name) + '</strong> <span class="slug">' + esc(r.symbol || '') + ' · ' + esc(r.slug) + '</span></td><td>' + esc(r.category || '—') + '</td><td>' + esc(r.chains.slice(0, 3).join(', ')) + '</td><td class="num">' + money(r.tvl_usd) + '</td><td class="num">' + pct(r.change_7d) + '</td><td class="num"><strong>' + money(r.mcap_usd) + '</strong></td></tr>';
    }).join('');
    app.innerHTML = '<div class="card"><h2>Live tokens, at the market\'s own values</h2><p>These protocols already trade, so the board never ranks them with a model number. They are shown apart, by market cap, because their category medians are exactly what the radar learns its multiples from.</p></div>' +
      '<table><thead><tr><th>#</th><th>Protocol</th><th>Category</th><th>Chains</th><th class="num">TVL</th><th class="num">7d</th><th class="num">Market cap</th></tr></thead><tbody>' + body + '</tbody></table>';
  }

  function renderModel() {
    var m = R.model;
    var cats = m.categories.map(function (c) {
      return '<tr><td>' + esc(c.category) + '</td><td class="num">' + c.peers + '</td><td class="num">' + (c.median_multiple === null ? '—' : c.median_multiple.toFixed(4) + '×') + '</td><td class="num"><strong>' + c.multiple.toFixed(4) + '×</strong></td></tr>';
    }).join('');
    app.innerHTML =
      '<div class="card"><h2>The model — radar-2</h2>' +
      '<p><code>implied = round(TVL × category_multiple × growth_multiplier × maturity_multiplier)</code></p>' +
      '<p>Category multiple: for each category, the median market-cap / TVL of its traded protocols in the snapshot, shrunk toward the global median of ' + m.global_median.toFixed(4) + '× with ' + m.shrink_peers + ' phantom peers, then clamped to [' + m.clamp_min + ', ' + m.clamp_max + ']. A category with no traded peer uses the global median. Growth: <code>1 + clamp(change_7d, -60, 120) / 100 × 0.5</code>, with no reported change counting as 0. Maturity: <code>0.6 + min(age_days, 1095) / 1095 × 0.4</code>, unknown age counting as 365 days. Rows sort by implied value, then TVL, then slug.</p>' +
      '<p>Screens for the ranked board: pre-token only (market cap, CoinGecko id and symbol all null), category not in {CEX, Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC}, no version marker at the end of the name, no whole word wrapped / staked / staking, and no exchange-name prefix. Every watchlist slug is force-included regardless. Source: ' + esc(R.source) + ' · as of ' + esc(R.as_of) + ' · watchlist floor ' + money(R.floor_usd) + '.</p></div>' +
      '<div class="card"><h2>Learned category multiples</h2><table><thead><tr><th>Category</th><th class="num">Traded peers</th><th class="num">Median</th><th class="num">Used (shrunk)</th></tr></thead><tbody>' + cats + '</tbody></table></div>';
  }

  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () { setHash({ view: b.dataset.view }); });
  });
  window.addEventListener('hashchange', render);
  render();
})();
