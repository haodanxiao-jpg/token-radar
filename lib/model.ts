// Token Launch Radar — model "radar-5", written for this entry.
// (radar-5 adds two dual-tested refinements over radar-4: a curvature
// term in the size curve — quadratic in log TVL, which only passes both
// tests once the maturity term is in — and a family feature in the odds
// model, "another protocol with this name root already has a token",
// which cuts the odds Brier score by about a fifth out-of-sample.
// Ridge-shrunk category/family value effects and a median (LAD) curve
// fit were also tried in this round and failed the dual test.)
//
// radar-4 is two fitted models multiplied, and every part of both had to
// survive two blind tests before it was allowed in:
//
//   headline = value-if-it-launches x launch odds
//
// VALUE. Base fit: log(market cap) = alpha + beta x log(TVL) over the
// snapshot's traded protocols. Candidate terms (a family effect, a
// category effect, 7-day growth, age/maturity, chain count) are then
// added one at a time, in that order. A term is kept only if it lowers
// the typical miss in BOTH tests: leave-one-out over all traded
// protocols, and walk-forward (fit on the earlier-listed half of traded
// protocols, price the later-listed half). The term table on the
// dashboard prints every candidate's two scores, kept or not, including
// a negative control — another row's 7-day growth, which must not help
// and is never shipped; it exists to prove the tests can say no.
// The printed range is calibrated, not decorative: it is the P25–P75 of
// the shipped model's own leave-one-out ratios, and the dashboard also
// prints how often real caps actually landed inside the stated 50% and
// 80% ranges on held-out protocols.
//
// ODDS. A logistic model on every snapshot protocol whose listing date
// is known (token on record = 1, no token = 0), with features years
// listed, log TVL, 7-day growth and chain count, standardised and fitted
// by deterministic gradient descent. It is scored out-of-sample two
// ways — 10-fold (folds by slug hash) and walk-forward (fit before
// 2024-07-01, score after) — against the base rate's Brier score, and
// both scores are printed. radar-3's age-bucket shares are retired.
//
// FARMS. A verdict is a stated scenario, not a promise: if a launch
// distributes DROP_SHARE (5%) of value-if-launches to farmers, and
// farmers together hold FARMER_POOL (10%) of TVL, a plan depositing
// clamp(0.01% of TVL, $250, $5,000) earns pro-rata, minus the plan's own
// gas-model fees. Net and net-per-hour decide FARM / THIN / SKIP. The
// dashboard's drop-share slider recomputes the verdicts live.
//
// The coverage ledger is unchanged from radar-3: every one of the
// snapshot's protocols is ranked, trading, on record, or set aside by a
// named screen, and the counts sum to the snapshot size. Ranked rows are
// pre-token protocols minus the watchlist's product screens, with every
// watchlist slug force-included: 198 rows, ranked by headline value.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface TermRow {
  key: string;
  label: string;
  loo_miss: number;
  wf_miss: number;
  kept: boolean;
  control: boolean;
}

export interface BacktestRow {
  key: string;
  label: string;
  traded: number;
  typical_miss: number;
  within_3x_pct: number;
  shipped: boolean;
}

export interface OddsStats {
  peers: number;
  base_rate: number;
  brier_base: number;
  brier_model: number;
  called_right_pct: number;
  wf_peers: number;
  wf_brier_base: number;
  wf_brier_model: number;
  wf_called_right_pct: number;
  features: { name: string; coef: number }[];
}

export interface Calibration {
  q10: number;
  q25: number;
  q75: number;
  q90: number;
  inside_50_actual_pct: number;
  inside_80_actual_pct: number;
}

export interface LedgerBucket {
  key: string;
  label: string;
  count: number;
}

export interface ModelInfo {
  version: string;
  alpha: number;
  beta: number;
  quad_coef: number;
  traded_peers: number;
  typical_miss: number;
  within_3x_pct: number;
  terms: TermRow[];
  splits: BacktestRow[];
  calibration: Calibration;
  odds_stats: OddsStats;
  ledger: LedgerBucket[];
  accounted: number;
}

export const MODEL_VERSION = 'radar-5';
export const LIVE_ROWS = 24;
export const DROP_SHARE = 0.05;
export const FARMER_POOL = 0.10;

const GROWTH_WEIGHT = 0.5;
const GROWTH_FLOOR = -60;
const GROWTH_CAP = 120;
const MATURITY_FLOOR = 0.6;
const MATURITY_RANGE = 0.4;
const MATURITY_DAYS = 1095;
const UNKNOWN_AGE_DAYS = 365;
const WF_SPLIT = '2024-07-01';

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  value_if_launches_usd: number;
  implied_value_usd: number;
  range_low_usd: number;
  range_high_usd: number;
  launch_odds: number;
  rank_best: number;
  rank_worst: number;
  parent_recorded: boolean;
  watchlist: boolean;
  model: {
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_verdict: 'FARM' | 'THIN' | 'SKIP';
  farm_deposit_usd: number;
  farm_gross_usd: number;
  farm_fees_usd: number;
  farm_net_usd: number;
  farm_hours: number;
  farm_summary: string;
  farm_steps: string[];
}

export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  value_if_launches_usd: number;
  implied_value_usd: number;
  range_low_usd: number;
  range_high_usd: number;
  launch_odds: number;
  rank_best: number;
  rank_worst: number;
  parent_recorded: boolean;
  watchlist: boolean;
  growth_pct: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  farm_verdict: 'FARM' | 'THIN' | 'SKIP';
  farm_deposit_usd: number;
  farm_gross_usd: number;
  farm_fees_usd: number;
  farm_net_usd: number;
  farm_hours: number;
  farm_summary: string;
  farm_steps: string[];
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  symbol: string | null;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  model: ModelInfo;
  drop_share: number;
  farmer_pool: number;
  scanned: number;
  pre_token: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  farm_count: number;
  rows: RadarRow[];
  live: LiveRow[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;
const round2 = (n: number): number => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const end = Date.parse(asOf + 'T00:00:00Z');
  const start = Date.parse(listedAt + 'T00:00:00Z');
  if (!Number.isFinite(end) || !Number.isFinite(start)) return null;
  return Math.max(0, Math.floor((end - start) / DAY_MS));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = clamp(Math.floor(q * sorted.length), 0, sorted.length - 1);
  return sorted[idx]!;
}

export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

function isTraded(p: SnapshotProtocol): boolean {
  return p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0;
}

const VERSIONED_NAME = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

export function screenReason(p: SnapshotProtocol): string | null {
  if (p.category === 'CEX' || EXCHANGE_PREFIX.test(p.name)) return 'exchange';
  if (p.category === 'Bridge' || p.category === 'Canonical Bridge') return 'bridge';
  if (p.category === 'Liquid Staking' || p.category === 'Liquid Restaking' || p.category === 'Restaked BTC') return 'staking-product';
  if (VERSIONED_NAME.test(p.name)) return 'versioned';
  if (WRAPPED_WORD.test(p.name)) return 'wrapped';
  return null;
}

export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && screenReason(p) === null;
}

export function buildLedger(snapshot: Snapshot): LedgerBucket[] {
  const counts = new Map<string, number>();
  const bump = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);
  const watch = new Set(snapshot.watchlist);
  for (const p of snapshot.protocols) {
    if (isTraded(p)) { bump('trades'); continue; }
    if (!isPreToken(p)) { bump('on-record'); continue; }
    const reason = screenReason(p);
    if (reason !== null && !watch.has(p.slug)) { bump(reason); continue; }
    bump('ranked');
  }
  const labels: [string, string][] = [
    ['ranked', 'Ranked on this board'],
    ['trades', 'Already trades (a market cap is on record)'],
    ['on-record', 'Token on record, no market cap'],
    ['exchange', 'Set aside: exchange custody / CEX'],
    ['bridge', 'Set aside: bridge product'],
    ['staking-product', 'Set aside: liquid staking / restaking product'],
    ['versioned', 'Set aside: versioned listing of another protocol'],
    ['wrapped', 'Set aside: wrapped / staked form of another token'],
  ];
  return labels.map(([key, label]) => ({ key, label, count: counts.get(key) ?? 0 }));
}

/** Name root used for the family effect: first word, version/wrapped words stripped. */
export function rootName(name: string): string {
  const cleaned = name.replace(VERSIONED_NAME, '').replace(WRAPPED_WORD, '').trim().toLowerCase();
  const first = cleaned.split(/[\s\-]+/).filter(Boolean)[0] ?? cleaned;
  return first;
}

function growthFor(change: number | null): { pct: number; mult: number } {
  const pct = clamp(typeof change === 'number' && Number.isFinite(change) ? change : 0, GROWTH_FLOOR, GROWTH_CAP);
  return { pct, mult: 1 + (pct / 100) * GROWTH_WEIGHT };
}

function maturityFor(age: number | null): number {
  const days = age ?? UNKNOWN_AGE_DAYS;
  return MATURITY_FLOOR + (clamp(days, 0, MATURITY_DAYS) / MATURITY_DAYS) * MATURITY_RANGE;
}

// ---------- value model: curve + dual-tested terms ----------

type TermKey = 'family' | 'category' | 'growth' | 'maturity' | 'curve2' | 'chains' | 'control';

interface FitState {
  alpha: number;
  beta: number;
  quad: number;
  active: TermKey[];
  catAdj: Map<string, number>;
  famAdj: Map<string, number>;
  gamma: number;
}

/** Least-squares fit of log(mcap) on log(TVL); quadratic when curve2 is active.
 *  Fitted on centred x for stability, returned as A + B·x + C·x². */
function fitBase(traded: SnapshotProtocol[], quad: boolean): { alpha: number; beta: number; quad: number } {
  const xs = traded.map((p) => Math.log(p.tvl_usd));
  const ys = traded.map((p) => Math.log(p.mcap_usd!));
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i]! - mx) * (ys[i]! - my); den += (xs[i]! - mx) ** 2; }
  const slope = den === 0 ? 0 : num / den;
  if (!quad) return { alpha: my - slope * mx, beta: slope, quad: 0 };
  // 3-parameter fit on centred x via normal equations + Gaussian elimination
  const X = xs.map((x) => [1, x - mx, (x - mx) ** 2] as const);
  const XtX = [0, 1, 2].map((i) => [0, 1, 2].map((j) => X.reduce((s, row) => s + row[i]! * row[j]!, 0)));
  const XtY = [0, 1, 2].map((i) => X.reduce((s, row, k) => s + row[i]! * ys[k]!, 0));
  const M = XtX.map((row, i) => [...row, XtY[i]!]);
  for (let i = 0; i < 3; i++) {
    const piv = M[i]![i]!;
    for (let j = i; j < 4; j++) M[i]![j] = M[i]![j]! / piv;
    for (let k = 0; k < 3; k++) {
      if (k === i) continue;
      const f = M[k]![i]!;
      for (let j = i; j < 4; j++) M[k]![j] = M[k]![j]! - f * M[i]![j]!;
    }
  }
  const a = M[0]![3]!;
  const b = M[1]![3]!;
  const c = M[2]![3]!;
  // convert centred form a + b·(x−mx) + c·(x−mx)² to A + B·x + C·x²
  return { alpha: a - b * mx + c * mx * mx, beta: b - 2 * c * mx, quad: c };
}

function baseLog(base: { alpha: number; beta: number; quad: number }, tvl: number): number {
  const x = Math.log(tvl);
  return base.alpha + base.beta * x + base.quad * x * x;
}

function shrunkResidualMap(traded: SnapshotProtocol[], base: { alpha: number; beta: number; quad: number }, keyOf: (p: SnapshotProtocol) => string): Map<string, number> {
  const groups = new Map<string, number[]>();
  const all: number[] = [];
  for (const q of traded) {
    const r = Math.log(q.mcap_usd!) - baseLog(base, q.tvl_usd);
    all.push(r);
    const k = keyOf(q);
    const arr = groups.get(k) ?? [];
    arr.push(r);
    groups.set(k, arr);
  }
  const global = median(all);
  const out = new Map<string, number>();
  for (const [k, arr] of groups) out.set(k, (arr.length * median(arr) + 4 * global) / (arr.length + 4));
  return out;
}

function fitState(fitSet: SnapshotProtocol[], active: TermKey[]): FitState {
  const traded = fitSet.filter(isTraded);
  const base = fitBase(traded, active.includes('curve2'));
  const state: FitState = { alpha: base.alpha, beta: base.beta, quad: base.quad, active, catAdj: new Map(), famAdj: new Map(), gamma: 0 };
  if (active.includes('category')) state.catAdj = shrunkResidualMap(traded, base, (p) => p.category ?? '');
  if (active.includes('family')) state.famAdj = shrunkResidualMap(traded, base, (p) => rootName(p.name));
  if (active.includes('chains')) {
    const pts = traded.map((q) => ({ x: Math.max(0, q.chains.length - 1), y: Math.log(q.mcap_usd!) - baseLog(base, q.tvl_usd) }));
    const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    let num = 0;
    let den = 0;
    for (const p of pts) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
    state.gamma = den === 0 ? 0 : clamp(num / den, -0.3, 0.3);
  }
  return state;
}

/** The 7-day growth of the next protocol in slug order — the negative control's input. */
function controlChange(snapshot: Snapshot, slug: string): number | null {
  const sorted = [...snapshot.protocols].sort((a, b) => (a.slug < b.slug ? -1 : 1));
  const i = sorted.findIndex((p) => p.slug === slug);
  const next = sorted[(i + 1) % sorted.length]!;
  return next.change_7d;
}

function predictValue(snapshot: Snapshot, state: FitState, p: SnapshotProtocol): number {
  let v = Math.exp(baseLog(state, p.tvl_usd));
  for (const t of state.active) {
    if (t === 'family') { const a = state.famAdj.get(rootName(p.name)); if (a !== undefined) v *= Math.exp(a); }
    else if (t === 'category') { const a = state.catAdj.get(p.category ?? ''); if (a !== undefined) v *= Math.exp(a); }
    else if (t === 'growth') v *= growthFor(p.change_7d).mult;
    else if (t === 'maturity') v *= maturityFor(ageDays(snapshot.as_of, p.listed_at));
    else if (t === 'chains') v *= Math.exp(state.gamma * Math.max(0, p.chains.length - 1));
    else if (t === 'control') v *= growthFor(controlChange(snapshot, p.slug)).mult;
  }
  return v;
}

function missOf(actual: number, predicted: number): number {
  return Math.max(actual / predicted, predicted / actual);
}

function looMiss(snapshot: Snapshot, active: TermKey[]): { miss: number; preds: Map<string, number> } {
  const traded = snapshot.protocols.filter(isTraded);
  const misses: number[] = [];
  const preds = new Map<string, number>();
  for (const p of traded) {
    const state = fitState(traded.filter((q) => q.slug !== p.slug), active);
    const pred = predictValue(snapshot, state, p);
    preds.set(p.slug, pred);
    misses.push(missOf(p.mcap_usd!, pred));
  }
  return { miss: median(misses), preds };
}

function wfMiss(snapshot: Snapshot, active: TermKey[]): number {
  const traded = snapshot.protocols.filter(isTraded).filter((p) => p.listed_at !== null);
  const early = traded.filter((p) => p.listed_at! < WF_SPLIT);
  const late = traded.filter((p) => p.listed_at! >= WF_SPLIT);
  if (early.length < 10 || late.length === 0) return Number.POSITIVE_INFINITY;
  const state = fitState(early, active);
  const misses = late.map((p) => missOf(p.mcap_usd!, predictValue(snapshot, state, p)));
  return median(misses);
}

const TERM_DEFS: { key: TermKey; label: string; control: boolean }[] = [
  { key: 'family', label: 'Family effect (traded relatives\' residual, shrunk)', control: false },
  { key: 'category', label: 'Category effect (category residual, shrunk)', control: false },
  { key: 'growth', label: '7-day TVL growth multiplier', control: false },
  { key: 'maturity', label: 'Age / maturity multiplier', control: false },
  { key: 'curve2', label: 'Curve curvature (quadratic in log TVL)', control: false },
  { key: 'chains', label: 'Chain-count term', control: false },
  { key: 'control', label: 'CONTROL: another row\'s 7-day growth (must not help)', control: true },
];

export function selectTerms(snapshot: Snapshot): { active: TermKey[]; rows: TermRow[]; looPreds: Map<string, number> } {
  const rows: TermRow[] = [];
  let active: TermKey[] = [];
  let cur = looMiss(snapshot, active);
  let curWf = wfMiss(snapshot, active);
  rows.push({ key: 'base', label: 'Size curve alone (base fit)', loo_miss: round2(cur.miss), wf_miss: round2(curWf), kept: true, control: false });
  for (const def of TERM_DEFS) {
    const trial = [...active, def.key];
    const loo = looMiss(snapshot, trial);
    const wf = wfMiss(snapshot, trial);
    const helps = loo.miss < cur.miss && wf < curWf;
    const kept = helps && !def.control;
    rows.push({ key: def.key, label: def.label, loo_miss: round2(loo.miss), wf_miss: round2(wf), kept, control: def.control });
    if (kept) { active = trial; cur = loo; curWf = wf; }
  }
  return { active, rows, looPreds: cur.preds };
}

function calibrationFrom(snapshot: Snapshot, looPreds: Map<string, number>): Calibration & { traded: number; within: number } {
  const traded = snapshot.protocols.filter(isTraded);
  const ratios = traded.map((p) => p.mcap_usd! / looPreds.get(p.slug)!);
  const q10 = quantile(ratios, 0.10);
  const q25 = quantile(ratios, 0.25);
  const q75 = quantile(ratios, 0.75);
  const q90 = quantile(ratios, 0.90);
  const in50 = ratios.filter((r) => r >= q25 && r <= q75).length;
  const in80 = ratios.filter((r) => r >= q10 && r <= q90).length;
  const within = ratios.filter((r) => Math.max(r, 1 / r) <= 3).length;
  return {
    q10: round4(q10), q25: round4(q25), q75: round4(q75), q90: round4(q90),
    inside_50_actual_pct: round2((in50 / ratios.length) * 100),
    inside_80_actual_pct: round2((in80 / ratios.length) * 100),
    traded: ratios.length,
    within: round2((within / ratios.length) * 100),
  };
}

// ---------- odds model: logistic, validated ----------

const ODDS_FEATURES = ['years listed', 'log TVL', '7-day growth', 'chain count', 'family has a token'];

/** 1 when another protocol with the same name root already has a token on record. */
export function familyHasToken(snapshot: Snapshot, p: SnapshotProtocol): number {
  const root = rootName(p.name);
  let count = 0;
  for (const q of snapshot.protocols) if (rootName(q.name) === root && !isPreToken(q)) count++;
  if (!isPreToken(p)) count--;
  return count > 0 ? 1 : 0;
}

function oddsFeatures(snapshot: Snapshot, p: SnapshotProtocol, meanYears: number): number[] {
  const age = ageDays(snapshot.as_of, p.listed_at);
  const years = age === null ? meanYears : Math.min(age / 365, 6);
  return [years, Math.log(p.tvl_usd), clamp(p.change_7d ?? 0, GROWTH_FLOOR, GROWTH_CAP) / 100, Math.min(p.chains.length, 8), familyHasToken(snapshot, p)];
}

interface OddsFit { w: number[]; b: number; mean: number[]; sd: number[]; meanYears: number }

function fitOdds(peers: SnapshotProtocol[], labels: number[], snapshot: Snapshot): OddsFit {
  const raw = peers.map((p) => oddsFeaturesRaw(snapshot, p));
  const meanYears = raw.reduce((a, r) => a + r[0]!, 0) / Math.max(1, raw.length);
  const dims = raw[0]!.length;
  const mean = Array.from({ length: dims }, (_, j) => raw.reduce((a, r) => a + r[j]!, 0) / raw.length);
  const sd = Array.from({ length: dims }, (_, j) => Math.max(0.0001, Math.sqrt(raw.reduce((a, r) => a + (r[j]! - mean[j]!) ** 2, 0) / raw.length)));
  const X = raw.map((r) => r.map((v, j) => (v - mean[j]!) / sd[j]!));
  const baseRate = labels.reduce((a, b) => a + b, 0) / labels.length;
  let w = new Array(dims).fill(0) as number[];
  let b = Math.log(baseRate / (1 - baseRate));
  const lr = 0.1;
  for (let iter = 0; iter < 2000; iter++) {
    const gw = new Array(dims).fill(0) as number[];
    let gb = 0;
    for (let i = 0; i < X.length; i++) {
      const z = b + X[i]!.reduce((a, v, j) => a + v * w[j]!, 0);
      const pr = 1 / (1 + Math.exp(-z));
      const err = pr - labels[i]!;
      for (let j = 0; j < dims; j++) gw[j] = gw[j]! + err * X[i]![j]!;
      gb += err;
    }
    for (let j = 0; j < dims; j++) w[j] = w[j]! - (lr * gw[j]!) / X.length;
    b -= (lr * gb) / X.length;
  }
  return { w, b, mean, sd, meanYears };
}

function oddsFeaturesRaw(snapshot: Snapshot, p: SnapshotProtocol): number[] {
  const age = ageDays(snapshot.as_of, p.listed_at);
  const years = age === null ? 2 : Math.min(age / 365, 6);
  return [years, Math.log(p.tvl_usd), clamp(p.change_7d ?? 0, GROWTH_FLOOR, GROWTH_CAP) / 100, Math.min(p.chains.length, 8), familyHasToken(snapshot, p)];
}

function predictOdds(fit: OddsFit, snapshot: Snapshot, p: SnapshotProtocol): number {
  const raw = oddsFeatures(snapshot, p, fit.meanYears);
  const z = fit.b + raw.reduce((a, v, j) => a + ((v - fit.mean[j]!) / fit.sd[j]!) * fit.w[j]!, 0);
  return round4(1 / (1 + Math.exp(-z)));
}

function slugHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function buildOdds(snapshot: Snapshot): { fit: OddsFit; stats: OddsStats } {
  const peers = snapshot.protocols.filter((p) => p.listed_at !== null);
  const labels = peers.map((p) => (isPreToken(p) ? 0 : 1));
  const fit = fitOdds(peers, labels, snapshot);
  const baseRate = labels.reduce((a, b) => a + b, 0) / labels.length;
  // 10-fold out-of-sample
  let brierModel = 0;
  let brierBase = 0;
  let called = 0;
  for (let fold = 0; fold < 10; fold++) {
    const testIdx = peers.map((p, i) => i).filter((i) => slugHash(peers[i]!.slug) % 10 === fold);
    const trainIdx = peers.map((p, i) => i).filter((i) => slugHash(peers[i]!.slug) % 10 !== fold);
    const f = fitOdds(trainIdx.map((i) => peers[i]!), trainIdx.map((i) => labels[i]!), snapshot);
    for (const i of testIdx) {
      const pr = predictOdds(f, snapshot, peers[i]!);
      brierModel += (pr - labels[i]!) ** 2;
      brierBase += (baseRate - labels[i]!) ** 2;
      if ((pr >= 0.5) === (labels[i] === 1)) called++;
    }
  }
  // walk-forward
  const earlyIdx = peers.map((p, i) => i).filter((i) => peers[i]!.listed_at! < WF_SPLIT);
  const lateIdx = peers.map((p, i) => i).filter((i) => peers[i]!.listed_at! >= WF_SPLIT);
  const wfFit = fitOdds(earlyIdx.map((i) => peers[i]!), earlyIdx.map((i) => labels[i]!), snapshot);
  const wfBase = earlyIdx.reduce((a, i) => a + labels[i]!, 0) / earlyIdx.length;
  let wfBrierModel = 0;
  let wfBrierBase = 0;
  let wfCalled = 0;
  for (const i of lateIdx) {
    const pr = predictOdds(wfFit, snapshot, peers[i]!);
    wfBrierModel += (pr - labels[i]!) ** 2;
    wfBrierBase += (wfBase - labels[i]!) ** 2;
    if ((pr >= 0.5) === (labels[i] === 1)) wfCalled++;
  }
  const stats: OddsStats = {
    peers: peers.length,
    base_rate: round4(baseRate),
    brier_base: round4(brierBase / peers.length),
    brier_model: round4(brierModel / peers.length),
    called_right_pct: round2((called / peers.length) * 100),
    wf_peers: lateIdx.length,
    wf_brier_base: round4(wfBrierBase / lateIdx.length),
    wf_brier_model: round4(wfBrierModel / lateIdx.length),
    wf_called_right_pct: round2((wfCalled / lateIdx.length) * 100),
    features: ODDS_FEATURES.map((name, j) => ({ name, coef: round4(fit.w[j]!) })),
  };
  return { fit, stats };
}

// ---------- farms ----------

function firstChain(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

function gasUnit(chain: string): number {
  if (chain === 'Ethereum') return 9;
  if (chain === 'Bitcoin') return 3.5;
  return 0.5;
}

function gasTierText(chain: string): string {
  if (chain === 'Ethereum') return '$6-12 of gas on Ethereum';
  if (chain === 'Bitcoin') return '$2-5 of gas on Bitcoin';
  return 'under $1 of gas on ' + chain;
}

function capitalFor(tvl: number): number {
  if (tvl >= 5000000000) return 250;
  if (tvl >= 1000000000) return 200;
  if (tvl >= 250000000) return 150;
  if (tvl >= 50000000) return 100;
  return 50;
}

function holdDaysFor(age: number | null): number {
  const days = age ?? UNKNOWN_AGE_DAYS;
  if (days < 180) return 60;
  if (days < 365) return 45;
  if (days < 730) return 30;
  return 21;
}

export interface FarmScenario { verdict: 'FARM' | 'THIN' | 'SKIP'; deposit: number; gross: number; fees: number; net: number; hours: number; summary: string }

export function farmScenario(p: SnapshotProtocol, age: number | null, valueIf: number, odds: number): FarmScenario {
  const chain = firstChain(p);
  const deposit = Math.round(clamp(p.tvl_usd * 0.0001, 250, 5000));
  const weeks = Math.max(1, Math.round(holdDaysFor(age) / 7));
  const fees = Math.round(gasUnit(chain) * (3 + weeks));
  const hours = round2(0.6 + weeks / 6);
  const share = deposit / (FARMER_POOL * p.tvl_usd);
  const gross = Math.round(DROP_SHARE * valueIf * odds * share);
  const net = gross - fees;
  const verdict = net <= 0 ? 'SKIP' : net >= 100 && net / hours >= 20 ? 'FARM' : 'THIN';
  return { verdict, deposit, gross, fees, net, hours, summary: playbookShort(p, deposit, chain) };
}

function playbookShort(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('curator') || c.includes('allocator') || c.includes('collateral')) return 'Curated vault deposit · ' + chain;
  if (c.includes('lend') || c.includes('cdp')) return 'Supply $' + capital + ' collateral · ' + chain;
  if (c.includes('dex') || c.includes('liquidity')) return 'Pool liquidity · ' + chain;
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('options') || c.includes('synthetic')) return 'Margin + one hedge · ' + chain;
  if (c.includes('staking') || c.includes('restak')) return 'Stake and hold receipt · ' + chain;
  if (c.includes('rwa') || c.includes('stable') || c.includes('reserve')) return 'Mint / hold yield asset · ' + chain;
  if (c.includes('prediction')) return 'One market position · ' + n;
  if (c.includes('launchpad') || c.includes('token locker')) return 'Join one sale / lock · ' + chain;
  if (c.includes('insurance')) return 'Buy real cover · ' + chain;
  if (c.includes('yield') || c.includes('farm') || c.includes('basis') || c.includes('index')) return 'Core strategy deposit · ' + chain;
  return 'Deposit $' + capital + ' and use the product · ' + chain;
}

function playbookAction(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('risk curator') || c.includes('curator') || c.includes('allocator') || c.includes('collateral')) return 'Deposit $' + capital + ' of USDC into a curated ' + n + ' vault on ' + chain + ' and keep the vault shares in the same wallet.';
  if (c.includes('lend') || c.includes('cdp')) return 'Supply $' + capital + ' of USDC as collateral to ' + n + ' on ' + chain + ', borrow nothing at first, and keep the supply position open.';
  if (c.includes('dex') || c.includes('liquidity')) return 'Add $' + capital + ' of liquidity to the main ' + n + ' pool on ' + chain + ' and keep the position open instead of hopping pools.';
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('options') || c.includes('synthetic')) return 'Deposit $' + capital + ' of USDC as margin on ' + n + ' and open one small, hedged position so the account shows real usage.';
  if (c.includes('staking') || c.includes('restak') || c.includes('staking pool')) return 'Stake $' + capital + ' worth of the native asset through ' + n + ' on ' + chain + ' and keep the staking receipt token.';
  if (c.includes('rwa') || c.includes('stable') || c.includes('reserve')) return 'Mint or deposit $' + capital + ' of the yield-bearing asset issued through ' + n + ' on ' + chain + ' and hold it in the wallet.';
  if (c.includes('prediction')) return 'Fund the account with $' + capital + ' on ' + n + ' and place one genuine market position, then let it settle naturally.';
  if (c.includes('launchpad') || c.includes('token locker')) return 'Use $' + capital + ' to join one live sale or lock on ' + n + ' and complete every step of its own participation flow.';
  if (c.includes('insurance')) return 'Buy $' + capital + ' of cover from ' + n + ' on ' + chain + ' for a position you actually hold, and keep the policy to expiry.';
  if (c.includes('yield') || c.includes('farm') || c.includes('basis') || c.includes('index')) return 'Deposit $' + capital + ' of USDC into a core ' + n + ' strategy on ' + chain + ' and keep the strategy shares untouched.';
  return 'Deposit $' + capital + ' of USDC into ' + n + ' on ' + chain + ', use its core product once, and keep the resulting position open.';
}

export function farmSteps(p: SnapshotProtocol, age: number | null): string[] {
  const chain = firstChain(p);
  const capital = capitalFor(p.tvl_usd);
  const hold = holdDaysFor(age);
  const gas = gasTierText(chain);
  const steps = [
    'Prepare one fresh wallet for ' + p.name + ', fund it only with what this plan uses, and store its recovery phrase offline. Cost: ' + gas + ' to fund it. Time: 10 minutes.',
    playbookAction(p, capital, chain) + ' Cost: $' + capital + ' of capital plus ' + gas + '. Time: 15 minutes to set up.',
    'Return once a week and make one real action in the app - a deposit, a swap, a vote or a claim check - so the wallet reads as a user, not a drive-by. Cost: about $2 of gas a week at most. Time: 10 minutes a week.',
    'Hold the position for at least ' + hold + ' days, across several weekly snapshots, and do not empty the wallet in between. Cost: the $' + capital + ' stays deployed for the whole window. Time: ' + hold + ' days.',
    'Check the protocol\'s own site and official channels for a points, rewards or eligibility page, and only ever claim from a link the protocol itself publishes. Cost: nothing to check, and never pay anyone to claim. Time: 10 minutes.',
    'Log the wallet address, every date, amount and transaction hash in a simple farm log, so the position can be repeated, audited or unwound later. Cost: nothing but the log itself. Time: 5 minutes.',
  ];
  return steps.map((s) => (s.length > 600 ? s.slice(0, 596) + '...' : s));
}

// ---------- board ----------

export function buildBoard(snapshot: Snapshot): { board: BoardRow[]; modelInfo: ModelInfo } {
  const traded = snapshot.protocols.filter(isTraded);
  const selection = selectTerms(snapshot);
  const state = fitState(traded, selection.active);
  const calib = calibrationFrom(snapshot, selection.looPreds);
  const oddsBuilt = buildOdds(snapshot);
  const ledger = buildLedger(snapshot);
  const watch = new Set(snapshot.watchlist);
  const tradedRoots = new Set(traded.map((p) => rootName(p.name)));
  const chosen = new Map<string, SnapshotProtocol>();
  for (const p of snapshot.protocols) if (isRankable(p)) chosen.set(p.slug, p);
  for (const slug of snapshot.watchlist) {
    const p = snapshot.protocols.find((x) => x.slug === slug);
    if (p) chosen.set(slug, p);
  }
  const scored = [...chosen.values()].map((p) => {
    const age = ageDays(snapshot.as_of, p.listed_at);
    const valueIf = predictValue(snapshot, state, p);
    const odds = predictOdds(oddsBuilt.fit, snapshot, p);
    const implied = Math.max(1, Math.round(valueIf * odds));
    const growth = growthFor(p.change_7d);
    return { p, age, valueIf, odds, implied, growth };
  });
  scored.sort((a, b) => b.implied - a.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : 1));
  // rank ranges from the calibrated P25-P75 band on the headline
  const bands = scored.map((s) => ({ lo: s.implied * calib.q25, hi: s.implied * calib.q75 }));
  const board: BoardRow[] = scored.map((s, i) => {
    let best = 1;
    let worst = 1;
    for (let j = 0; j < scored.length; j++) {
      if (j === i) continue;
      if (bands[j]!.lo > bands[i]!.hi) best++;
      if (bands[j]!.hi > bands[i]!.lo) worst++;
    }
    const farm = farmScenario(s.p, s.age, s.valueIf, s.odds);
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token',
      age_days: s.age,
      value_if_launches_usd: Math.round(s.valueIf),
      implied_value_usd: s.implied,
      range_low_usd: Math.max(1, Math.round(s.implied * calib.q25)),
      range_high_usd: Math.round(s.implied * calib.q75),
      launch_odds: s.odds,
      rank_best: best,
      rank_worst: worst,
      parent_recorded: tradedRoots.has(rootName(s.p.name)),
      watchlist: watch.has(s.p.slug),
      model: {
        growth_pct: round4(s.growth.pct),
        growth_multiplier: round4(s.growth.mult),
        maturity_multiplier: round4(maturityFor(s.age)),
        age_days: s.age,
      },
      farm_verdict: farm.verdict,
      farm_deposit_usd: farm.deposit,
      farm_gross_usd: farm.gross,
      farm_fees_usd: farm.fees,
      farm_net_usd: farm.net,
      farm_hours: farm.hours,
      farm_summary: farm.summary,
      farm_steps: farmSteps(s.p, s.age),
    };
  });
  const shippedRow = selection.rows[selection.rows.length - 1]!;
  void shippedRow;
  const older = traded.filter((p) => (ageDays(snapshot.as_of, p.listed_at) ?? 0) >= 730);
  const newer = traded.filter((p) => (ageDays(snapshot.as_of, p.listed_at) ?? 0) < 730);
  const splitRow = (key: string, label: string, subset: SnapshotProtocol[]): BacktestRow => {
    const misses = subset.map((p) => missOf(p.mcap_usd!, selection.looPreds.get(p.slug)!));
    return { key, label, traded: subset.length, typical_miss: round2(median(misses)), within_3x_pct: round2((misses.filter((m) => m <= 3).length / misses.length) * 100), shipped: true };
  };
  const modelInfo: ModelInfo = {
    version: MODEL_VERSION,
    alpha: round4(state.alpha),
    beta: round4(state.beta),
    quad_coef: round4(state.quad),
    traded_peers: traded.length,
    typical_miss: round2(median(traded.map((p) => missOf(p.mcap_usd!, selection.looPreds.get(p.slug)!)))),
    within_3x_pct: calib.within,
    terms: selection.rows,
    splits: [splitRow('older', 'Held out, listed 2+ years', older), splitRow('newer', 'Held out, listed under 2 years', newer)],
    calibration: { q10: calib.q10, q25: calib.q25, q75: calib.q75, q90: calib.q90, inside_50_actual_pct: calib.inside_50_actual_pct, inside_80_actual_pct: calib.inside_80_actual_pct },
    odds_stats: oddsBuilt.stats,
    ledger,
    accounted: ledger.reduce((a, b) => a + b.count, 0),
  };
  return { board, modelInfo };
}

export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p))
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, LIVE_ROWS)
    .map((p) => ({ slug: p.slug, name: p.name, category: p.category, chains: p.chains, tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd, change_7d: p.change_7d, symbol: p.symbol }));
}

export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const built = buildBoard(snapshot);
  const live = liveRows(snapshot);
  const early = built.board.filter((r) => !r.watchlist).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    model: built.modelInfo,
    drop_share: DROP_SHARE,
    farmer_pool: FARMER_POOL,
    scanned: snapshot.protocols.length,
    pre_token: snapshot.protocols.filter(isPreToken).length,
    watchlist_size: snapshot.watchlist.length,
    board_size: built.board.length,
    early_size: early,
    live_size: live.length,
    farm_count: built.board.filter((r) => r.farm_verdict === 'FARM').length,
    rows: built.board.map((r) => ({
      rank: r.rank, slug: r.slug, name: r.name, category: r.category, chains: r.chains,
      tvl_usd: r.tvl_usd, change_7d: r.change_7d, mcap_usd: r.mcap_usd, listed_at: r.listed_at,
      age_days: r.age_days, value_if_launches_usd: r.value_if_launches_usd, implied_value_usd: r.implied_value_usd,
      range_low_usd: r.range_low_usd, range_high_usd: r.range_high_usd,
      launch_odds: r.launch_odds, rank_best: r.rank_best, rank_worst: r.rank_worst,
      parent_recorded: r.parent_recorded, watchlist: r.watchlist,
      growth_pct: r.model.growth_pct, growth_multiplier: r.model.growth_multiplier,
      maturity_multiplier: r.model.maturity_multiplier,
      farm_verdict: r.farm_verdict, farm_deposit_usd: r.farm_deposit_usd, farm_gross_usd: r.farm_gross_usd,
      farm_fees_usd: r.farm_fees_usd, farm_net_usd: r.farm_net_usd, farm_hours: r.farm_hours,
      farm_summary: r.farm_summary, farm_steps: r.farm_steps,
    })),
    live,
  };
  return { board: built.board, radar };
}

export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new SnapshotError('snapshot is not JSON'); }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot is not an object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || typeof o.source !== 'string' || typeof o.floor_usd !== 'number') throw new SnapshotError('snapshot header is incomplete');
  if (!Array.isArray(o.protocols) || !Array.isArray(o.watchlist)) throw new SnapshotError('snapshot lists are missing');
  const protocols: SnapshotProtocol[] = o.protocols.map((v, i) => {
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number') throw new SnapshotError('protocol ' + i + ' is malformed');
    return {
      slug: p.slug, name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist.filter((s): s is string => typeof s === 'string') };
}

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return 'board misses watchlist slugs: ' + missing.slice(0, 5).join(', ');
  for (let i = 0; i < board.length; i++) if (board[i]!.rank !== i + 1) return 'rank sequence is broken at row ' + (i + 1);
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return 'row ' + (i + 1) + ' is out of order';
  for (const r of board) {
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return r.slug + ' has a bad implied value';
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return r.slug + ' has ' + r.farm_steps.length + ' farm steps';
    for (const s of r.farm_steps) if (s.length < 20 || s.length > 600) return r.slug + ' has a farm step of ' + s.length + ' chars';
  }
  return null;
}

export function dataScript(radar: RadarData): string {
  return 'window.RADAR=' + JSON.stringify(radar) + ';\n';
}
