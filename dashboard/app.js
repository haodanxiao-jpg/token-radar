// Token Launch Radar dashboard (radar-3): renders window.RADAR with no
// framework, no fetch and no network. First screen: the coverage ledger
// (every protocol in the snapshot accounted for), the held-out test the
// model had to pass, and the launch-odds table — then the board itself.
// Views: board, live tokens, method & tests, plus one detail per protocol.
// State lives in location.hash: #p=<slug>, #view=board&cat=Dexs, #view=model.
(function () {
  var R = window.RADAR;
  var app = document.getElementById('app');
  if (!R) { app.innerHTML = '<div class="card"><h2>No data</h2><p>data.js was not found. Run main.ts first.</p></div>'; return; }
  var M = R.model;

  function money(n) {
    if (n === null || n === undefined) return '—';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function pct(n) {
    if (n === null || n === undefined) return '—';
    return '<span class="' + (n >= 0 ? 'pos' : 'neg') + '">' + (n >= 0 ? '+' : '') + n.toFixed(1) + '%</span>';
  }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ageText(days) {
    if (days === null) return 'unknown';
    if (days < 365) return days + ' d';
    return (days / 365).toFixed(1) + ' y';
  }

  document.getElementById('snapline').textContent = 'DEFILLAMA SNAPSHOT ' + R.as_of;
  document.getElementById('sub').innerHTML =
    '<b>' + R.scanned + ' protocols read.</b> ' + R.board_size + ' ranked with no token yet · ' +
    R.live_size + ' biggest already trade and are set aside · every other protocol is accounted for in the ledger below, none dropped silently.';
  document.getElementById('formula').innerHTML =
    'implied = e<sup>' + M.alpha.toFixed(2) + ' + ' + M.beta.toFixed(2) + '·ln(TVL)</sup> × growth × maturity<br>' +
    '<span style="color:#93a7b8">fitted on ' + M.traded_peers + ' traded protocols · held-out miss ×' + M.typical_miss.toFixed(2) + '</span>';

  var cards = [
    [R.board_size, 'ranked, no token yet'],
    [M.accounted + '/' + R.scanned, 'protocols accounted for'],
    ['×' + M.typical_miss.toFixed(2), 'typical held-out miss'],
    [M.within_3x_pct.toFixed(1) + '%', 'held out, priced within 3×'],
    [R.watchlist_size + '/' + R.watchlist_size, 'watchlist on the board'],
    [R.farm_count, 'plans that pass on cost (FARM)'],
  ];
  document.getElementById('stats').innerHTML = cards.map(function (c) { return '<div class="stat"><b>' + c[0] + '</b><span>' + c[1] + '</span></div>'; }).join('');

  var COLORS = { ranked: '#3ddc97', trades: '#57a8ff', 'on-record': '#5b7186', exchange: '#ffc857', bridge: '#c792ea', 'staking-product': '#7f8c98', versioned: '#a1887f', wrapped: '#90a4ae' };
  var stack = M.ledger.map(function (b) { return '<div style="width:' + (b.count / M.accounted * 100) + '%;background:' + COLORS[b.key] + '" title="' + esc(b.label) + ': ' + b.count + '"></div>'; }).join('');
  var SHORT = { ranked: 'ranked on this board', trades: 'already trades', 'on-record': 'token on record, no cap', exchange: 'aside: exchange custody', bridge: 'aside: bridges', 'staking-product': 'aside: staking products', versioned: 'aside: versioned listings', wrapped: 'aside: wrapped / staked forms' };
  var legend = M.ledger.map(function (b) { return '<span style="white-space:nowrap"><i style="background:' + COLORS[b.key] + '"></i><b>' + b.count + '</b> ' + esc(SHORT[b.key] || b.label) + '</span>'; }).join(' · ');
  var bt = M.backtest.map(function (b) {
    return '<tr><td>' + (b.shipped ? '<span class="ship">● shipped</span> ' : '') + esc(b.label.split('(')[0]) + '</td><td class="num">×' + b.typical_miss.toFixed(2) + '</td><td class="num">' + b.within_3x_pct.toFixed(0) + '%</td></tr>';
  }).join('');
  var splits = M.splits.map(function (s) { return s.label.replace('Held out, ', '') + ' ×' + s.typical_miss.toFixed(2) + ' / ' + s.within_3x_pct.toFixed(0) + '%'; }).join(' · ');
  var odds = M.odds.map(function (o) {
    return '<div class="oddrow"><span>' + esc(o.label) + '</span><div class="oddbar"><div style="width:' + Math.round(o.odds * 100) + '%"></div></div><b>' + Math.round(o.odds * 100) + '%</b></div>';
  }).join('');
  document.getElementById('panels').innerHTML =
    '<div class="panel"><h3>Coverage ledger — <b>' + M.accounted + ' of ' + R.scanned + '</b> placed</h3><div class="stack">' + stack + '</div><div class="legend">' + legend + '</div></div>' +
    '<div class="panel"><h3>Held-out test — each traded protocol priced by a fit that never saw it</h3><table class="mini"><tr><th>candidate model</th><th class="num">typical miss</th><th class="num">within 3×</th></tr>' + bt + '</table><p class="note">Splits for the shipped model: ' + splits + '. A category adjustment was also fitted and rejected — it made the held-out miss worse.</p></div>' +
    '<div class="panel"><h3>Launch odds — share that have a token, by age</h3>' + odds + '<p class="note">Read off the snapshot itself. The board prints an odds-adjusted value beside the implied value; it never ranks by it.</p></div>';

  function parseHash() {
    var h = location.hash.replace(/^#/, '');
    var out = {};
    h.split('&').forEach(function (part) {
      if (!part) return;
      var kv = part.split('=');
      out[decodeURIComponent(kv[0])] = decodeURIComponent(kv.slice(1).join('=') || '');
    });
    if (out.p) return { view: 'detail', slug: out.p };
    return { view: out.view || 'board', cat: out.cat || '', chain: out.chain || '', scope: out.scope || 'all', verdict: out.verdict || '', q: out.q || '' };
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
      if (state.verdict && r.farm_verdict !== state.verdict) return false;
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
      ['rank', '#', 0], ['name', 'Protocol', 0], ['tvl_usd', 'TVL', 1], ['change_7d', '7d', 1],
      ['age_days', 'No token for', 1], ['implied_value_usd', 'Implied value', 1], ['launch_odds', 'Odds', 1],
      ['adjusted_value_usd', 'Odds-adj.', 1], ['farm_verdict', 'Verdict', 0], ['farm_summary', 'Farm plan', 0],
    ];
    var head = cols.map(function (c) { return '<th data-key="' + c[0] + '"' + (c[2] ? ' class="num"' : '') + '>' + c[1] + '</th>'; }).join('');
    var body = rows.map(function (r) {
      return '<tr class="row" data-slug="' + esc(r.slug) + '">' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><strong>' + esc(r.name) + '</strong><span class="badge ' + (r.watchlist ? 'watch' : 'early') + '">' + (r.watchlist ? 'watchlist' : 'early') + '</span><span class="slug">' + esc(r.category || '—') + ' · ' + esc(r.slug) + '</span></td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + ageText(r.age_days) + '</td>' +
        '<td class="num"><strong>' + money(r.implied_value_usd) + '</strong><span class="range">' + money(r.range_low_usd) + ' – ' + money(r.range_high_usd) + '</span></td>' +
        '<td class="num">' + Math.round(r.launch_odds * 100) + '%</td>' +
        '<td class="num">' + money(r.adjusted_value_usd) + '</td>' +
        '<td><span class="verdict v-' + r.farm_verdict + '">' + r.farm_verdict + '</span></td>' +
        '<td><span class="farm"><b>' + esc(r.farm_summary) + '</b><br>$' + r.farm_fees_usd + ' fees · ' + r.farm_hours + ' h</span></td></tr>';
    }).join('');
    app.innerHTML =
      '<div class="controls">' +
      '<input id="q" type="search" placeholder="Search name or slug…" value="' + esc(state.q || '') + '">' +
      '<select id="cat"><option value="">All categories</option>' + cats.map(function (c) { return '<option' + (c === state.cat ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<select id="chain"><option value="">All chains</option>' + chains.map(function (c) { return '<option' + (c === state.chain ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<select id="verdict"><option value="">Any verdict</option>' + ['FARM', 'THIN', 'SKIP'].map(function (v) { return '<option' + (v === state.verdict ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select>' +
      '<button data-scope="all" class="' + (state.scope === 'all' ? 'on' : '') + '">All</button>' +
      '<button data-scope="watchlist" class="' + (state.scope === 'watchlist' ? 'on' : '') + '">Watchlist</button>' +
      '<button data-scope="early" class="' + (state.scope === 'early' ? 'on' : '') + '">Early</button>' +
      '<span class="count">' + rows.length + ' of ' + R.rows.length + ' rows — ranges are the model\'s own held-out miss, ×' + M.typical_miss.toFixed(2) + ' each way</span></div>' +
      '<table class="board"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';
    document.getElementById('q').addEventListener('input', function (e) { setHash({ view: 'board', cat: state.cat, chain: state.chain, scope: state.scope, verdict: state.verdict, q: e.target.value }); var el = document.getElementById('q'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
    document.getElementById('cat').addEventListener('change', function (e) { setHash({ view: 'board', cat: e.target.value, chain: state.chain, scope: state.scope, verdict: state.verdict }); });
    document.getElementById('chain').addEventListener('change', function (e) { setHash({ view: 'board', cat: state.cat, chain: e.target.value, scope: state.scope, verdict: state.verdict }); });
    document.getElementById('verdict').addEventListener('change', function (e) { setHash({ view: 'board', cat: state.cat, chain: state.chain, scope: state.scope, verdict: e.target.value }); });
    app.querySelectorAll('[data-scope]').forEach(function (b) { b.addEventListener('click', function () { setHash({ view: 'board', cat: state.cat, chain: state.chain, scope: b.dataset.scope, verdict: state.verdict }); }); });
    app.querySelectorAll('th').forEach(function (th) { th.addEventListener('click', function () { var k = th.dataset.key; if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = k === 'name' || k === 'farm_verdict' ? 1 : -1; } render(); }); });
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
      '<div class="detail"><p class="kicker">#' + r.rank + ' · ' + (r.watchlist ? 'WATCHLIST' : 'EARLY FIND') + ' · NO TOKEN FOR ' + ageText(r.age_days).toUpperCase() + '</p>' +
      '<h2>' + esc(r.name) + '</h2><p class="sub">' + esc(r.slug) + ' · ' + esc(r.category || 'uncategorised') + ' · ' + esc(r.chains.join(', ')) + '</p>' +
      '<div class="grid">' +
      '<div class="cell"><b>' + money(r.implied_value_usd) + '</b><span>implied value, size-curve model</span></div>' +
      '<div class="cell"><b>' + money(r.range_low_usd) + ' – ' + money(r.range_high_usd) + '</b><span>range: the held-out miss, ×' + M.typical_miss.toFixed(2) + ' each way</span></div>' +
      '<div class="cell"><b>' + money(r.adjusted_value_usd) + '</b><span>odds-adjusted: implied × ' + Math.round(r.launch_odds * 100) + '% launch odds at this age</span></div>' +
      '<div class="cell"><b>' + money(r.tvl_usd) + '</b><span>TVL in the snapshot · 7d ' + (r.change_7d === null ? 'n/a' : r.change_7d.toFixed(1) + '%') + '</span></div></div>' +
      '<div class="formula">implied = e<sup>' + M.alpha.toFixed(4) + ' + ' + M.beta.toFixed(4) + ' × ln(TVL)</sup> × growth × maturity<br>' +
      '= e<sup>' + M.alpha.toFixed(2) + ' + ' + M.beta.toFixed(2) + ' × ln(' + r.tvl_usd.toLocaleString('en-US') + ')</sup> × ' + r.growth_multiplier.toFixed(4) + ' × ' + r.maturity_multiplier.toFixed(4) + ' = ' + money(r.implied_value_usd) + '</div>' +
      '<p class="explain">The curve is fitted on the ' + M.traded_peers + ' protocols in this snapshot that already trade, and it was chosen because it beat the flat and category multiples on a leave-one-out test (typical miss ×' + M.typical_miss.toFixed(2) + ', ' + M.within_3x_pct.toFixed(1) + '% within 3×). The range is that same miss applied to this row — wide, because pricing unlaunched tokens is wide. Launch odds are the share of protocols of this age that have a token on record in the snapshot.</p>' +
      '<h3>Farm plan — verdict <span class="verdict v-' + r.farm_verdict + '">' + r.farm_verdict + '</span> <span class="farm">' + esc(r.farm_summary) + ' · about $' + r.farm_fees_usd + ' of fees · about ' + r.farm_hours + ' hours of your time</span></h3>' +
      '<p class="explain">The verdict is cost-side only: FARM when the plan\'s own fees are under 3% of the capital it deploys, THIN under 8%, SKIP above that. It says nothing about whether a reward will exist.</p>' +
      '<ol class="plan">' + plan + '</ol>' +
      '<p class="explain">Honesty note: this protocol records no token in the snapshot. Records no token is not proof it has none, and it is not a promise of an airdrop.</p></div>';
    document.getElementById('back').addEventListener('click', function () { setHash({ view: 'board' }); });
  }

  function renderLive() {
    var body = R.live.map(function (r, i) {
      return '<tr><td class="num">' + (i + 1) + '</td><td><strong>' + esc(r.name) + '</strong> <span class="slug">' + esc(r.symbol || '') + ' · ' + esc(r.slug) + '</span></td><td>' + esc(r.category || '—') + '</td><td>' + esc(r.chains.slice(0, 3).join(', ')) + '</td><td class="num">' + money(r.tvl_usd) + '</td><td class="num">' + pct(r.change_7d) + '</td><td class="num"><strong>' + money(r.mcap_usd) + '</strong></td></tr>';
    }).join('');
    app.innerHTML = '<div class="card"><h2>Already trades, at the market\'s own values</h2><p>These protocols already have tokens, so the board never ranks them with a model number. They are shown apart, by market cap — and they are the fitting set: the size curve on the board is learned from exactly these traded protocols.</p></div>' +
      '<table class="board"><thead><tr><th>#</th><th>Protocol</th><th>Category</th><th>Chains</th><th class="num">TVL</th><th class="num">7d</th><th class="num">Market cap</th></tr></thead><tbody>' + body + '</tbody></table>';
  }

  function renderModel() {
    var bt = M.backtest.map(function (b) {
      return '<tr><td>' + esc(b.label) + '</td><td class="num">' + b.traded + '</td><td class="num">×' + b.typical_miss.toFixed(2) + '</td><td class="num">' + b.within_3x_pct.toFixed(1) + '%</td><td>' + (b.shipped ? '<span class="ship">shipped</span>' : 'rejected') + '</td></tr>';
    }).join('');
    var sp = M.splits.map(function (s) { return '<tr><td>' + esc(s.label) + '</td><td class="num">' + s.traded + '</td><td class="num">×' + s.typical_miss.toFixed(2) + '</td><td class="num">' + s.within_3x_pct.toFixed(1) + '%</td><td></td></tr>'; }).join('');
    var led = M.ledger.map(function (b) { return '<tr><td>' + esc(b.label) + '</td><td class="num">' + b.count + '</td></tr>'; }).join('');
    var od = M.odds.map(function (o) { return '<tr><td>' + esc(o.label) + '</td><td class="num">' + o.protocols + '</td><td class="num">' + o.tokened + '</td><td class="num">' + Math.round(o.odds * 100) + '%</td></tr>'; }).join('');
    app.innerHTML =
      '<div class="card"><h2>The model — radar-3</h2>' +
      '<p><code>implied = round( exp(' + M.alpha.toFixed(4) + ' + ' + M.beta.toFixed(4) + ' × ln(TVL)) × growth × maturity )</code>, fitted by least squares over the ' + M.traded_peers + ' traded protocols in the snapshot. Growth: <code>1 + clamp(change_7d, -60, 120)/100 × 0.5</code> (no reported change counts as 0). Maturity: <code>0.6 + min(age_days, 1095)/1095 × 0.4</code> (unknown age counts as 365 days). Rows sort by implied value, then TVL, then slug. The previous model (radar-2, category multiples) is kept in the test below as a candidate — and it loses.</p>' +
      '<p>Screens for the ranked board: pre-token only (market cap, CoinGecko id and symbol all null), category not in {CEX, Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC}, no version marker at the end of the name, no whole word wrapped / staked / staking, no exchange-name prefix. Every watchlist slug is force-included. Source: ' + esc(R.source) + ' · as of ' + esc(R.as_of) + ' · watchlist floor ' + money(R.floor_usd) + '.</p></div>' +
      '<div class="card"><h2>Held-out test — leave-one-out on the traded protocols</h2><p>Each traded protocol is priced by a fit made without it, then compared with its real market cap. Typical miss is the median of max(actual/predicted, predicted/actual). This test is recomputed from the snapshot on every run.</p>' +
      '<table class="board"><thead><tr><th>Candidate</th><th class="num">Priced</th><th class="num">Typical miss</th><th class="num">Within 3×</th><th>Decision</th></tr></thead><tbody>' + bt + sp + '</tbody></table></div>' +
      '<div class="card"><h2>Coverage ledger — all ' + R.scanned + ' protocols</h2><table class="board"><thead><tr><th>Bucket</th><th class="num">Count</th></tr></thead><tbody>' + led + '</tbody></table></div>' +
      '<div class="card"><h2>Launch odds by age</h2><table class="board"><thead><tr><th>Age bucket</th><th class="num">Protocols</th><th class="num">With a token</th><th class="num">Share</th></tr></thead><tbody>' + od + '</tbody></table></div>';
  }

  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () { setHash({ view: b.dataset.view }); });
  });
  window.addEventListener('hashchange', render);
  render();
})();
