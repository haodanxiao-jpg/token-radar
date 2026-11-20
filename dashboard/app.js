// Token Launch Radar dashboard (radar-4): renders window.RADAR with no
// framework, no fetch and no network. First screen: the coverage ledger,
// the dual-test term table the value model had to pass, the odds model's
// out-of-sample scores, then a self-check strip the page computes about
// itself, then the board. The drop-share slider recomputes farm verdicts
// live from each row's own numbers. Views: board, live, method & tests,
// and one detail per protocol. State in location.hash.
(function () {
  var R = window.RADAR;
  var app = document.getElementById('app');
  if (!R) { app.innerHTML = '<div class="card"><h2>No data</h2><p>data.js was not found. Run main.ts first.</p></div>'; return; }
  var M = R.model;
  var O = M.odds_stats;
  var dropPct = Math.round(R.drop_share * 100);
  var TERM_SHORT = { family: 'family effect', category: 'category effect', growth: 'growth', maturity: 'maturity', chains: 'chain count' };
  var keptTerms = M.terms.filter(function (t) { return t.kept && t.key !== 'base'; });

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
  function farmFor(r, drop) {
    var gross = Math.round(drop * r.value_if_launches_usd * r.launch_odds * (r.farm_deposit_usd / (R.farmer_pool * r.tvl_usd)));
    var net = gross - r.farm_fees_usd;
    var verdict = net <= 0 ? 'SKIP' : net >= 100 && net / r.farm_hours >= 20 ? 'FARM' : 'THIN';
    return { gross: gross, net: net, verdict: verdict };
  }

  document.getElementById('snapline').textContent = 'DEFILLAMA SNAPSHOT ' + R.as_of;
  document.getElementById('sub').innerHTML =
    '<b>' + R.scanned + ' protocols read.</b> ' + R.board_size + ' ranked with no token yet · ' +
    R.live_size + ' biggest already trade and are set aside · every other protocol is accounted for in the ledger below, none dropped silently.';
  document.getElementById('formula').innerHTML =
    'headline = e<sup>' + M.alpha.toFixed(2) + ' + ' + M.beta.toFixed(2) + '·ln(TVL)</sup>' +
    keptTerms.map(function (t) { return ' × ' + (TERM_SHORT[t.key] || t.key); }).join('') +
    ' × launch odds<br><span style="color:#93a7b8">value miss ×' + M.typical_miss.toFixed(2) + ' held out · odds called right ' + O.called_right_pct.toFixed(0) + '% out-of-sample</span>';

  var top = R.rows[0];
  var cards = [
    [R.board_size, 'ranked, no token yet'],
    [M.accounted + '/' + R.scanned, 'protocols accounted for'],
    ['×' + M.typical_miss.toFixed(2), 'value model held-out miss'],
    [O.called_right_pct.toFixed(1) + '%', 'odds called right, 10-fold'],
    [R.farm_count, 'plans FARM at a ' + dropPct + '% drop'],
    [money(top.implied_value_usd), 'top expected value: ' + top.name],
  ];
  document.getElementById('stats').innerHTML = cards.map(function (c) { return '<div class="stat"><b>' + c[0] + '</b><span>' + c[1] + '</span></div>'; }).join('');

  var COLORS = { ranked: '#3ddc97', trades: '#57a8ff', 'on-record': '#5b7186', exchange: '#ffc857', bridge: '#c792ea', 'staking-product': '#7f8c98', versioned: '#a1887f', wrapped: '#90a4ae' };
  var SHORT = { ranked: 'ranked on this board', trades: 'already trades', 'on-record': 'token on record, no cap', exchange: 'aside: exchange custody', bridge: 'aside: bridges', 'staking-product': 'aside: staking products', versioned: 'aside: versioned listings', wrapped: 'aside: wrapped / staked forms' };
  var stack = M.ledger.map(function (b) { return '<div style="width:' + (b.count / M.accounted * 100) + '%;background:' + COLORS[b.key] + '" title="' + esc(b.label) + ': ' + b.count + '"></div>'; }).join('');
  var legend = M.ledger.map(function (b) { return '<span style="white-space:nowrap"><i style="background:' + COLORS[b.key] + '"></i><b>' + b.count + '</b> ' + esc(SHORT[b.key] || b.label) + '</span>'; }).join(' · ');
  var termRows = M.terms.map(function (t) {
    var state = t.key === 'base' ? '<span class="ship">base</span>' : t.control ? '<span class="rej">control</span>' : t.kept ? '<span class="ship">kept</span>' : '<span class="rej">rejected</span>';
    return '<tr><td>' + esc(t.label.split('(')[0]) + '</td><td class="num">×' + t.loo_miss.toFixed(2) + '</td><td class="num">×' + t.wf_miss.toFixed(2) + '</td><td>' + state + '</td></tr>';
  }).join('');
  var C = M.calibration;
  var coefMax = Math.max.apply(null, O.features.map(function (f) { return Math.abs(f.coef); }));
  var coefs = O.features.map(function (f) {
    return '<div class="coefrow"><span>' + esc(f.name) + '</span><div class="coefbar"><div style="width:' + Math.round(Math.abs(f.coef) / coefMax * 100) + '%;background:' + (f.coef >= 0 ? 'var(--blue)' : 'var(--red)') + '"></div></div><b>' + (f.coef >= 0 ? '+' : '') + f.coef.toFixed(2) + '</b></div>';
  }).join('');
  document.getElementById('panels').innerHTML =
    '<div class="panel"><h3>Coverage ledger — <b>' + M.accounted + ' of ' + R.scanned + '</b> placed</h3><div class="stack">' + stack + '</div><div class="legend">' + legend + '</div></div>' +
    '<div class="panel"><h3>Value model — a term ships only if it lowers the miss in both tests</h3><table class="mini"><tr><th>term, added in order</th><th class="num">leave-one-out</th><th class="num">walk-forward</th><th></th></tr>' + termRows + '</table>' +
    '<p class="note">Range calibration, held out: stated 50% range held ' + C.inside_50_actual_pct.toFixed(1) + '% of real caps · stated 80% held ' + C.inside_80_actual_pct.toFixed(1) + '%.</p></div>' +
    '<div class="panel"><h3>Launch odds — fitted on ' + O.peers + ' protocols, scored blind</h3>' + coefs +
    '<p class="note">Brier, 10-fold: model ' + O.brier_model.toFixed(3) + ' vs base rate ' + O.brier_base.toFixed(3) + ' · called right ' + O.called_right_pct.toFixed(1) + '%<br>Walk-forward: model ' + O.wf_brier_model.toFixed(3) + ' vs base ' + O.wf_brier_base.toFixed(3) + ' · called right ' + O.wf_called_right_pct.toFixed(1) + '%</p></div>';

  function selfCheck() {
    var rows = R.rows;
    var seq = rows.every(function (r, i) { return r.rank === i + 1; });
    var ordered = rows.every(function (r, i) { return i === 0 || r.implied_value_usd <= rows[i - 1].implied_value_usd; });
    var total = rows.reduce(function (a, r) { return a + r.implied_value_usd; }, 0);
    var watch = rows.filter(function (r) { return r.watchlist; }).length;
    var ledgerSum = M.ledger.reduce(function (a, b) { return a + b.count; }, 0);
    var parts = [
      'this table = data.js',
      rows.length + ' rows drawn = ' + R.board_size + ' written',
      seq ? 'ranks 1–' + rows.length + ' in order' : 'rank sequence broken',
      ordered ? 'values never rise down the board' : 'values out of order',
      'total expected ' + money(total) + ' = the sum of every row',
      'watchlist ' + watch + ' of ' + R.watchlist_size + ' ranked',
      'ledger ' + ledgerSum + ' of ' + R.scanned + ' protocols',
    ];
    return '<div class="checks">✓ ' + parts.join(' &nbsp;·&nbsp; ✓ ') + '</div>';
  }

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
    var drop = dropPct / 100;
    var rows = R.rows.filter(function (r) {
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (state.verdict && farmFor(r, drop).verdict !== state.verdict) return false;
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
      ['age_days', 'No token for', 1], ['value_if_launches_usd', 'Value if launches', 1], ['launch_odds', 'Odds', 1],
      ['implied_value_usd', 'Expected value', 1], ['farm_verdict', 'Verdict', 0], ['farm_summary', 'Farm plan', 0],
    ];
    var head = cols.map(function (c) { return '<th data-key="' + c[0] + '"' + (c[2] ? ' class="num"' : '') + '>' + c[1] + '</th>'; }).join('');
    var body = rows.map(function (r) {
      var f = farmFor(r, drop);
      return '<tr class="row" data-slug="' + esc(r.slug) + '">' +
        '<td class="num">' + r.rank + '<span class="range">' + r.rank_best + '–' + r.rank_worst + '</span></td>' +
        '<td><strong>' + esc(r.name) + '</strong><span class="badge ' + (r.watchlist ? 'watch' : 'early') + '">' + (r.watchlist ? 'watchlist' : 'early') + '</span>' + (r.parent_recorded ? '<span class="badge parent">parent has a token</span>' : '') + '<span class="slug">' + esc(r.category || '—') + ' · ' + esc(r.slug) + '</span></td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + ageText(r.age_days) + '</td>' +
        '<td class="num">' + money(r.value_if_launches_usd) + '</td>' +
        '<td class="num"><span class="oddcell"><span class="oddmini"><div style="width:' + Math.round(r.launch_odds * 100) + '%"></div></span>' + Math.round(r.launch_odds * 100) + '%</span></td>' +
        '<td class="num"><strong>' + money(r.implied_value_usd) + '</strong><span class="range">' + money(r.range_low_usd) + ' – ' + money(r.range_high_usd) + '</span></td>' +
        '<td><span class="verdict v-' + f.verdict + '">' + f.verdict + '</span><span class="range">net ' + (f.net < 0 ? '−$' + Math.abs(f.net) : '+$' + f.net) + '</span></td>' +
        '<td><span class="farm"><b>' + esc(r.farm_summary) + '</b><br>on $' + r.farm_deposit_usd.toLocaleString('en-US') + ' · $' + r.farm_fees_usd + ' fees · ' + r.farm_hours + ' h</span></td></tr>';
    }).join('');
    app.innerHTML = selfCheck() +
      '<div class="controls" style="margin-top:12px">' +
      '<input id="q" type="search" placeholder="Search name or slug…" value="' + esc(state.q || '') + '">' +
      '<select id="cat"><option value="">All categories</option>' + cats.map(function (c) { return '<option' + (c === state.cat ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<select id="chain"><option value="">All chains</option>' + chains.map(function (c) { return '<option' + (c === state.chain ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<select id="verdict"><option value="">Any verdict</option>' + ['FARM', 'THIN', 'SKIP'].map(function (v) { return '<option' + (v === state.verdict ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select>' +
      '<button data-scope="all" class="' + (state.scope === 'all' ? 'on' : '') + '">All</button>' +
      '<button data-scope="watchlist" class="' + (state.scope === 'watchlist' ? 'on' : '') + '">Watchlist</button>' +
      '<button data-scope="early" class="' + (state.scope === 'early' ? 'on' : '') + '">Early</button>' +
      '<label class="count">if a launch drops <b id="droplabel" style="color:var(--mint)">' + dropPct + '%</b> of value to farmers <input id="drop" type="range" min="1" max="14" step="1" value="' + dropPct + '"></label>' +
      '<span class="count">' + rows.length + ' of ' + R.rows.length + ' rows · ranges are the calibrated P25–P75 · small figures under ranks are rank ranges inside that band</span></div>' +
      '<table class="board"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';
    document.getElementById('q').addEventListener('input', function (e) { setHash({ view: 'board', cat: state.cat, chain: state.chain, scope: state.scope, verdict: state.verdict, q: e.target.value }); var el = document.getElementById('q'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
    document.getElementById('cat').addEventListener('change', function (e) { setHash({ view: 'board', cat: e.target.value, chain: state.chain, scope: state.scope, verdict: state.verdict }); });
    document.getElementById('chain').addEventListener('change', function (e) { setHash({ view: 'board', cat: state.cat, chain: e.target.value, scope: state.scope, verdict: state.verdict }); });
    document.getElementById('verdict').addEventListener('change', function (e) { setHash({ view: 'board', cat: state.cat, chain: state.chain, scope: state.scope, verdict: e.target.value }); });
    document.getElementById('drop').addEventListener('input', function (e) { document.getElementById('droplabel').textContent = e.target.value + '%'; });
    document.getElementById('drop').addEventListener('change', function (e) { dropPct = parseInt(e.target.value, 10); render(); });
    app.querySelectorAll('[data-scope]').forEach(function (b) { b.addEventListener('click', function () { setHash({ view: 'board', cat: state.cat, chain: state.chain, scope: b.dataset.scope, verdict: state.verdict }); }); });
    app.querySelectorAll('th').forEach(function (th) { th.addEventListener('click', function () { var k = th.dataset.key; if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = k === 'name' || k === 'farm_verdict' ? 1 : -1; } render(); }); });
    app.querySelectorAll('tr.row').forEach(function (tr) { tr.addEventListener('click', function () { setHash({ p: tr.dataset.slug }); }); });
  }

  function renderDetail(slug) {
    var r = null;
    R.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) { app.innerHTML = '<div class="card"><h2>Not on the board</h2><p>' + esc(slug) + ' is not a ranked row.</p></div>'; return; }
    var f = farmFor(r, R.drop_share);
    var plan = r.farm_steps.map(function (s) {
      var m = s.match(/^(.*) Cost: (.*)\. Time: (.*)\.$/);
      if (!m) return '<li>' + esc(s) + '</li>';
      return '<li>' + esc(m[1]) + '<br><span class="slug">Cost: ' + esc(m[2]) + ' · Time: ' + esc(m[3]) + '</span></li>';
    }).join('');
    var termLine = keptTerms.map(function (t) { return TERM_SHORT[t.key] || t.key; }).join(' × ');
    app.innerHTML =
      '<button class="back" id="back">← Back to the board</button>' +
      '<div class="detail"><p class="kicker">#' + r.rank + ' (RANK RANGE ' + r.rank_best + '–' + r.rank_worst + ' INSIDE THE CALIBRATED BAND) · ' + (r.watchlist ? 'WATCHLIST' : 'EARLY FIND') + ' · NO TOKEN FOR ' + ageText(r.age_days).toUpperCase() + '</p>' +
      '<h2>' + esc(r.name) + '</h2><p class="sub">' + esc(r.slug) + ' · ' + esc(r.category || 'uncategorised') + ' · ' + esc(r.chains.join(', ')) + (r.parent_recorded ? ' · a protocol with this name root already has a token' : '') + '</p>' +
      '<div class="grid">' +
      '<div class="cell"><b>' + money(r.implied_value_usd) + '</b><span>expected value: value if it launches × odds</span></div>' +
      '<div class="cell"><b>' + money(r.value_if_launches_usd) + '</b><span>value if a token launches</span></div>' +
      '<div class="cell"><b>' + Math.round(r.launch_odds * 100) + '%</b><span>launch odds, fitted odds model</span></div>' +
      '<div class="cell"><b>' + money(r.range_low_usd) + ' – ' + money(r.range_high_usd) + '</b><span>calibrated P25–P75 range on expected value</span></div></div>' +
      '<div class="formula">value = e<sup>' + M.alpha.toFixed(4) + ' + ' + M.beta.toFixed(4) + ' × ln(TVL)</sup>' + (termLine ? ' × ' + esc(termLine) : '') + '<br>' +
      '= ' + money(r.value_if_launches_usd) + ' if it launches · × ' + Math.round(r.launch_odds * 100) + '% odds = ' + money(r.implied_value_usd) + ' expected</div>' +
      '<p class="explain">The curve is fitted on the ' + M.traded_peers + ' traded protocols in this snapshot. Terms ship only if they lower the typical miss in both a leave-one-out test and a walk-forward test (shipped model: ×' + M.typical_miss.toFixed(2) + ', ' + M.within_3x_pct.toFixed(1) + '% within 3×). The odds model is a logistic fit on ' + O.peers + ' protocols, called right ' + O.called_right_pct.toFixed(1) + '% out-of-sample against a ' + Math.round(O.base_rate * 100) + '% base rate. The range is calibrated: on held-out protocols the stated 50% band actually held ' + C.inside_50_actual_pct.toFixed(1) + '% of real caps.</p>' +
      '<h3>Farm plan — verdict <span class="verdict v-' + f.verdict + '">' + f.verdict + '</span> <span class="farm">' + esc(r.farm_summary) + '</span></h3>' +
      '<p class="explain">Scenario at the board\'s default ' + dropPct + '% drop: if a launch distributes ' + Math.round(R.drop_share * 100) + '% of value-if-launches to farmers and farmers together hold ' + Math.round(R.farmer_pool * 100) + '% of TVL, a $' + r.farm_deposit_usd.toLocaleString('en-US') + ' plan earns about $' + f.gross + ' gross, pays $' + r.farm_fees_usd + ' of fees, nets ' + (f.net < 0 ? '−$' + Math.abs(f.net) : '+$' + f.net) + ' over about ' + r.farm_hours + ' hours. Move the board\'s slider and the verdict moves — it is arithmetic on a stated guess, not a forecast.</p>' +
      '<ol class="plan">' + plan + '</ol>' +
      '<p class="explain">Honesty note: this protocol records no token in the snapshot. Records no token is not proof it has none, and it is not a promise of an airdrop.</p></div>';
    document.getElementById('back').addEventListener('click', function () { setHash({ view: 'board' }); });
  }

  function renderLive() {
    var body = R.live.map(function (r, i) {
      return '<tr><td class="num">' + (i + 1) + '</td><td><strong>' + esc(r.name) + '</strong> <span class="slug">' + esc(r.symbol || '') + ' · ' + esc(r.slug) + '</span></td><td>' + esc(r.category || '—') + '</td><td>' + esc(r.chains.slice(0, 3).join(', ')) + '</td><td class="num">' + money(r.tvl_usd) + '</td><td class="num">' + pct(r.change_7d) + '</td><td class="num"><strong>' + money(r.mcap_usd) + '</strong></td></tr>';
    }).join('');
    app.innerHTML = '<div class="card"><h2>Already trades, at the market\'s own values</h2><p>These protocols already have tokens, so the board never ranks them with a model number. They are shown apart, by market cap — and they are the fitting set: the size curve is learned from the traded protocols, and the odds model from every protocol whose outcome is known.</p></div>' +
      '<table class="board"><thead><tr><th>#</th><th>Protocol</th><th>Category</th><th>Chains</th><th class="num">TVL</th><th class="num">7d</th><th class="num">Market cap</th></tr></thead><tbody>' + body + '</tbody></table>';
  }

  function renderModel() {
    var tt = M.terms.map(function (t) {
      return '<tr><td>' + esc(t.label) + '</td><td class="num">×' + t.loo_miss.toFixed(2) + '</td><td class="num">×' + t.wf_miss.toFixed(2) + '</td><td>' + (t.key === 'base' ? 'base fit' : t.control ? 'control — never ships' : t.kept ? '<span class="ship">kept</span>' : 'rejected') + '</td></tr>';
    }).join('');
    var sp = M.splits.map(function (s) { return '<tr><td>' + esc(s.label) + ' (shipped model, leave-one-out)</td><td class="num">×' + s.typical_miss.toFixed(2) + '</td><td class="num">' + s.within_3x_pct.toFixed(1) + '% within 3×</td><td>' + s.traded + ' priced</td></tr>'; }).join('');
    var led = M.ledger.map(function (b) { return '<tr><td>' + esc(b.label) + '</td><td class="num">' + b.count + '</td></tr>'; }).join('');
    var co = O.features.map(function (f) { return '<tr><td>' + esc(f.name) + '</td><td class="num">' + (f.coef >= 0 ? '+' : '') + f.coef.toFixed(4) + '</td></tr>'; }).join('');
    app.innerHTML =
      '<div class="card"><h2>The models — radar-4</h2>' +
      '<p><code>headline = value-if-launches × launch odds</code>. Value: <code>exp(' + M.alpha.toFixed(4) + ' + ' + M.beta.toFixed(4) + ' × ln(TVL))</code> fitted by least squares over the ' + M.traded_peers + ' traded protocols, times the terms that survived both tests below. Odds: a logistic model (years listed, log TVL, 7-day growth, chain count) fitted on ' + O.peers + ' protocols with known listing dates. Rows sort by headline, then TVL, then slug.</p>' +
      '<p>Screens for the ranked board: pre-token only (market cap, CoinGecko id and symbol all null), category not in {CEX, Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC}, no version marker at the end of the name, no whole word wrapped / staked / staking, no exchange-name prefix. Every watchlist slug is force-included. Source: ' + esc(R.source) + ' · as of ' + esc(R.as_of) + ' · watchlist floor ' + money(R.floor_usd) + '.</p></div>' +
      '<div class="card"><h2>Term selection — two blind tests, both must improve</h2><p>Leave-one-out: each traded protocol priced by a fit made without it. Walk-forward: fit on traded protocols listed before 2024-07-01, price those listed after. A term ships only if the typical miss falls in both. The control uses another row\'s growth on purpose: a test that cannot reject it would prove nothing.</p>' +
      '<table class="board"><thead><tr><th>Term, added in order</th><th class="num">Leave-one-out miss</th><th class="num">Walk-forward miss</th><th>Decision</th></tr></thead><tbody>' + tt + sp + '</tbody></table>' +
      '<p>Range calibration from the shipped model\'s leave-one-out ratios: P25 ×' + C.q25.toFixed(2) + ' · P75 ×' + C.q75.toFixed(2) + ' · P10 ×' + C.q10.toFixed(2) + ' · P90 ×' + C.q90.toFixed(2) + '. On held-out protocols, real caps landed inside the stated 50% band ' + C.inside_50_actual_pct.toFixed(1) + '% of the time and inside the stated 80% band ' + C.inside_80_actual_pct.toFixed(1) + '% of the time.</p></div>' +
      '<div class="card"><h2>Odds model — out-of-sample scores</h2>' +
      '<table class="board"><thead><tr><th>Test</th><th class="num">Model Brier</th><th class="num">Base-rate Brier</th><th class="num">Called right</th></tr></thead><tbody>' +
      '<tr><td>10-fold (folds by slug hash), ' + O.peers + ' protocols</td><td class="num">' + O.brier_model.toFixed(4) + '</td><td class="num">' + O.brier_base.toFixed(4) + '</td><td class="num">' + O.called_right_pct.toFixed(1) + '%</td></tr>' +
      '<tr><td>Walk-forward (fit before 2024-07-01), ' + O.wf_peers + ' protocols</td><td class="num">' + O.wf_brier_model.toFixed(4) + '</td><td class="num">' + O.wf_brier_base.toFixed(4) + '</td><td class="num">' + O.wf_called_right_pct.toFixed(1) + '%</td></tr></tbody></table>' +
      '<table class="board"><thead><tr><th>Feature</th><th class="num">Coefficient (standardised)</th></tr></thead><tbody>' + co + '</tbody></table></div>' +
      '<div class="card"><h2>Coverage ledger — all ' + R.scanned + ' protocols</h2><table class="board"><thead><tr><th>Bucket</th><th class="num">Count</th></tr></thead><tbody>' + led + '</tbody></table></div>' +
      '<div class="card"><h2>Farm scenario</h2><p>A verdict is arithmetic on a stated guess: a launch distributes ' + Math.round(R.drop_share * 100) + '% of value-if-launches to farmers; farmers together hold ' + Math.round(R.farmer_pool * 100) + '% of TVL; a plan deposits clamp(0.01% of TVL, $250, $5,000) and earns pro-rata, minus gas-model fees (Ethereum $9, Bitcoin $3.50, other chains $0.50 per action; setup, weekly actions over the hold window, exit). FARM needs net ≥ $100 and ≥ $20/hour; THIN is any other positive net; SKIP is a loss. The board\'s slider re-runs this arithmetic at other drop shares.</p></div>';
  }

  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () { setHash({ view: b.dataset.view }); });
  });
  window.addEventListener('hashchange', render);
  render();
})();
