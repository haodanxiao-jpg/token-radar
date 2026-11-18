// Token Launch Radar — model "radar-3", written for this entry.
//
// What changed from radar-2, and why: radar-2 valued a pre-token protocol
// at TVL x a category multiple. Before shipping radar-3 I tested that
// model the way it should be tested — leave-one-out on the snapshot's own
// traded protocols, each one priced by a fit that never saw it — and it
// was weak: a typical miss of about x5, and only about a third of held-out
// protocols priced within 3x. A size curve does better on the same test,
// so radar-3 prices with a size curve and keeps the test on the page:
//
//   fit:      log(market cap) = alpha + beta x log(TVL), fitted by least
//             squares over the snapshot's traded protocols (mcap > 0)
//   implied:  exp(alpha + beta x log(TVL)) x growth x maturity, where
//             growth   = 1 + clamp(change_7d, -60, 120)/100 x 0.5
//             maturity = 0.6 + min(age_days, 1095)/1095 x 0.4
//   range:    implied / miss to implied x miss, where "miss" is the
//             shipped model's own typical held-out miss — the range is
//             exactly as wide as the model has earned, no narrower.
//
// Two more things the snapshot itself teaches, both shown, neither hidden
// inside the headline number: a launch-odds table (the share of protocols
// that have a token, by age bucket — an odds-adjusted value is printed
// beside the implied value, never substituted for it), and a coverage
// ledger that accounts for every one of the snapshot's protocols:
// ranked, already trading, token on record, or set aside with the screen
// that set it aside. A category adjustment to the curve was also tested
// and rejected: it made the held-out miss worse, so it is not in the
// model. The backtest table on the dashboard prints all of these numbers
// from the snapshot at run time; nothing is hard-coded.
//
// Who gets ranked is unchanged from radar-2: pre-token protocols (market
// cap, CoinGecko id and symbol all null) minus the watchlist's own
// product screens, with every watchlist slug force-included: 198 rows.

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

export interface BacktestRow {
  key: string;
  label: string;
  traded: number;
  typical_miss: number;
  within_3x_pct: number;
  shipped: boolean;
}

export interface OddsBucket {
  label: string;
  min_days: number;
  protocols: number;
  tokened: number;
  odds: number;
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
  traded_peers: number;
  typical_miss: number;
  within_3x_pct: number;
  backtest: BacktestRow[];
  splits: BacktestRow[];
  odds: OddsBucket[];
  ledger: LedgerBucket[];
  accounted: number;
}

export const MODEL_VERSION = 'radar-3';
export const LIVE_ROWS = 24;

const GROWTH_WEIGHT = 0.5;
const GROWTH_FLOOR = -60;
const GROWTH_CAP = 120;
const MATURITY_FLOOR = 0.6;
const MATURITY_RANGE = 0.4;
const MATURITY_DAYS = 1095;
const UNKNOWN_AGE_DAYS = 365;

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
  implied_value_usd: number;
  range_low_usd: number;
  range_high_usd: number;
  launch_odds: number;
  adjusted_value_usd: number;
  watchlist: boolean;
  model: {
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_verdict: 'FARM' | 'THIN' | 'SKIP';
  farm_fees_usd: number;
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
  implied_value_usd: number;
  range_low_usd: number;
  range_high_usd: number;
  launch_odds: number;
  adjusted_value_usd: number;
  watchlist: boolean;
  growth_pct: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  farm_verdict: 'FARM' | 'THIN' | 'SKIP';
  farm_fees_usd: number;
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

export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

function isTraded(p: SnapshotProtocol): boolean {
  return p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0;
}

const SCREENED_CATEGORIES = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);
const VERSIONED_NAME = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** The first screen a pre-token protocol fails, or null when it is ranked. */
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

/** Every protocol in exactly one bucket; the counts sum to the snapshot size. */
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

function growthFor(change: number | null): { pct: number; mult: number } {
  const pct = clamp(typeof change === 'number' && Number.isFinite(change) ? change : 0, GROWTH_FLOOR, GROWTH_CAP);
  return { pct, mult: 1 + (pct / 100) * GROWTH_WEIGHT };
}

function maturityFor(age: number | null): number {
  const days = age ?? UNKNOWN_AGE_DAYS;
  return MATURITY_FLOOR + (clamp(days, 0, MATURITY_DAYS) / MATURITY_DAYS) * MATURITY_RANGE;
}

function fitCurve(traded: SnapshotProtocol[]): { alpha: number; beta: number } {
  const xs = traded.map((p) => Math.log(p.tvl_usd));
  const ys = traded.map((p) => Math.log(p.mcap_usd!));
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i]! - mx) * (ys[i]! - my); den += (xs[i]! - mx) ** 2; }
  const beta = den === 0 ? 0 : num / den;
  return { alpha: my - beta * mx, beta };
}

function curvePrice(fit: { alpha: number; beta: number }, tvl: number): number {
  return Math.exp(fit.alpha + fit.beta * Math.log(tvl));
}

type Pricer = (fitSet: SnapshotProtocol[], p: SnapshotProtocol, asOf: string) => number;

const priceFlat: Pricer = (fitSet, p, asOf) => {
  const ratios = fitSet.filter(isTraded).map((q) => q.mcap_usd! / q.tvl_usd);
  const g = growthFor(p.change_7d);
  return p.tvl_usd * clamp(median(ratios), 0.02, 3.0) * g.mult * maturityFor(ageDays(asOf, p.listed_at));
};

const priceCategory: Pricer = (fitSet, p, asOf) => {
  const traded = fitSet.filter(isTraded);
  const all = traded.map((q) => q.mcap_usd! / q.tvl_usd);
  const global = median(all);
  const peers = traded.filter((q) => q.category === p.category).map((q) => q.mcap_usd! / q.tvl_usd);
  const multiple = peers.length === 0 ? global : (peers.length * median(peers) + 4 * global) / (peers.length + 4);
  const g = growthFor(p.change_7d);
  return p.tvl_usd * clamp(multiple, 0.02, 3.0) * g.mult * maturityFor(ageDays(asOf, p.listed_at));
};

const priceCurve: Pricer = (fitSet, p, asOf) => {
  const fit = fitCurve(fitSet.filter(isTraded));
  const g = growthFor(p.change_7d);
  return curvePrice(fit, p.tvl_usd) * g.mult * maturityFor(ageDays(asOf, p.listed_at));
};

/** Leave-one-out test of one pricer on the traded protocols (optionally a subset). */
function backtestOne(snapshot: Snapshot, pricer: Pricer, subset: SnapshotProtocol[] | null): { traded: number; typical_miss: number; within_3x_pct: number } {
  const traded = snapshot.protocols.filter(isTraded);
  const targets = subset ?? traded;
  const misses: number[] = [];
  for (const p of targets) {
    const fitSet = traded.filter((q) => q.slug !== p.slug);
    const predicted = pricer(fitSet, p, snapshot.as_of);
    if (!(predicted > 0)) continue;
    misses.push(Math.max(p.mcap_usd! / predicted, predicted / p.mcap_usd!));
  }
  return {
    traded: misses.length,
    typical_miss: round2(median(misses)),
    within_3x_pct: round2((misses.filter((m) => m <= 3).length / misses.length) * 100),
  };
}

export function runBacktests(snapshot: Snapshot): { rows: BacktestRow[]; splits: BacktestRow[] } {
  const mk = (key: string, label: string, pricer: Pricer, shipped: boolean): BacktestRow => {
    const r = backtestOne(snapshot, pricer, null);
    return { key, label, traded: r.traded, typical_miss: r.typical_miss, within_3x_pct: r.within_3x_pct, shipped };
  };
  const rows = [
    mk('flat', 'Flat multiple: TVL x global median cap/TVL (radar-1 style)', priceFlat, false),
    mk('category', 'Category multiples, shrunk (radar-2, the previous model)', priceCategory, false),
    mk('curve', 'Size curve x growth x maturity (radar-3, shipped)', priceCurve, true),
  ];
  const traded = snapshot.protocols.filter(isTraded);
  const older = traded.filter((p) => (ageDays(snapshot.as_of, p.listed_at) ?? 0) >= 730);
  const newer = traded.filter((p) => (ageDays(snapshot.as_of, p.listed_at) ?? 0) < 730);
  const split = (key: string, label: string, subset: SnapshotProtocol[]): BacktestRow => {
    const r = backtestOne(snapshot, priceCurve, subset);
    return { key, label, traded: r.traded, typical_miss: r.typical_miss, within_3x_pct: r.within_3x_pct, shipped: true };
  };
  const splits = [split('older', 'Held out, listed 2+ years', older), split('newer', 'Held out, listed under 2 years', newer)];
  return { rows, splits };
}

/** The share of protocols that have any token on record, by age bucket. */
export function launchOdds(snapshot: Snapshot): OddsBucket[] {
  const defs: [string, number, number][] = [
    ['under 6 months', 0, 182],
    ['6-12 months', 182, 365],
    ['1-2 years', 365, 730],
    ['2-3 years', 730, 1095],
    ['3+ years', 1095, Number.MAX_SAFE_INTEGER],
  ];
  return defs.map(([label, min, max]) => {
    const group = snapshot.protocols.filter((p) => {
      const a = ageDays(snapshot.as_of, p.listed_at);
      return a !== null && a >= min && a < max;
    });
    const tokened = group.filter((p) => !isPreToken(p)).length;
    return { label, min_days: min, protocols: group.length, tokened, odds: group.length === 0 ? 0 : round4(tokened / group.length) };
  });
}

export function oddsForAge(odds: OddsBucket[], age: number | null): number {
  if (age === null) {
    const all = odds.reduce((a, b) => a + b.protocols, 0);
    const tok = odds.reduce((a, b) => a + b.tokened, 0);
    return all === 0 ? 0 : round4(tok / all);
  }
  for (let i = odds.length - 1; i >= 0; i--) if (age >= odds[i]!.min_days) return odds[i]!.odds;
  return odds[0]!.odds;
}

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

/** Cost-side farm economics: what the plan itself costs, in fees and hours. */
export function farmEconomics(p: SnapshotProtocol, age: number | null): { verdict: 'FARM' | 'THIN' | 'SKIP'; fees: number; hours: number; summary: string } {
  const chain = firstChain(p);
  const capital = capitalFor(p.tvl_usd);
  const hold = holdDaysFor(age);
  const weeks = Math.max(1, Math.round(hold / 7));
  const fees = Math.round(gasUnit(chain) * (3 + weeks));
  const hours = round2(0.6 + weeks / 6);
  const share = fees / capital;
  const verdict = share <= 0.03 ? 'FARM' : share <= 0.08 ? 'THIN' : 'SKIP';
  return { verdict, fees, hours, summary: playbookShort(p, capital, chain) };
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

/** Six farm steps per protocol, each in the gate's "action Cost: .. Time: .." form. */
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

export function buildBoard(snapshot: Snapshot): { board: BoardRow[]; modelInfo: ModelInfo } {
  const traded = snapshot.protocols.filter(isTraded);
  const fit = fitCurve(traded);
  const tests = runBacktests(snapshot);
  const shipped = tests.rows.find((r) => r.shipped)!;
  const odds = launchOdds(snapshot);
  const ledger = buildLedger(snapshot);
  const watch = new Set(snapshot.watchlist);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const p of snapshot.protocols) if (isRankable(p)) chosen.set(p.slug, p);
  for (const slug of snapshot.watchlist) {
    const p = snapshot.protocols.find((x) => x.slug === slug);
    if (p) chosen.set(slug, p);
  }
  const scored = [...chosen.values()].map((p) => {
    const growth = growthFor(p.change_7d);
    const age = ageDays(snapshot.as_of, p.listed_at);
    const maturity = maturityFor(age);
    const implied = Math.max(1, Math.round(curvePrice(fit, p.tvl_usd) * growth.mult * maturity));
    const o = oddsForAge(odds, age);
    return { p, growth, age, maturity, implied, odds: o };
  });
  scored.sort((a, b) => b.implied - a.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : 1));
  const miss = shipped.typical_miss;
  const board: BoardRow[] = scored.map((s, i) => {
    const econ = farmEconomics(s.p, s.age);
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
      implied_value_usd: s.implied,
      range_low_usd: Math.max(1, Math.round(s.implied / miss)),
      range_high_usd: Math.round(s.implied * miss),
      launch_odds: s.odds,
      adjusted_value_usd: Math.round(s.implied * s.odds),
      watchlist: watch.has(s.p.slug),
      model: {
        growth_pct: round4(s.growth.pct),
        growth_multiplier: round4(s.growth.mult),
        maturity_multiplier: round4(s.maturity),
        age_days: s.age,
      },
      farm_verdict: econ.verdict,
      farm_fees_usd: econ.fees,
      farm_hours: econ.hours,
      farm_summary: econ.summary,
      farm_steps: farmSteps(s.p, s.age),
    };
  });
  const modelInfo: ModelInfo = {
    version: MODEL_VERSION,
    alpha: round4(fit.alpha),
    beta: round4(fit.beta),
    traded_peers: traded.length,
    typical_miss: shipped.typical_miss,
    within_3x_pct: shipped.within_3x_pct,
    backtest: tests.rows,
    splits: tests.splits,
    odds,
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
      age_days: r.age_days, implied_value_usd: r.implied_value_usd,
      range_low_usd: r.range_low_usd, range_high_usd: r.range_high_usd,
      launch_odds: r.launch_odds, adjusted_value_usd: r.adjusted_value_usd, watchlist: r.watchlist,
      growth_pct: r.model.growth_pct, growth_multiplier: r.model.growth_multiplier,
      maturity_multiplier: r.model.maturity_multiplier,
      farm_verdict: r.farm_verdict, farm_fees_usd: r.farm_fees_usd, farm_hours: r.farm_hours,
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
