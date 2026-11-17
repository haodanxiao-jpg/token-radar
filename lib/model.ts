// Token Launch Radar — model "radar-2", written for this entry.
//
// Idea in one paragraph: a snapshot already tells us what the market pays
// for a dollar of TVL, category by category, because hundreds of protocols
// in it do have tokens. For each category I take the median market-cap /
// TVL ratio of its traded protocols, shrink that median toward the global
// median (0.2049 on this snapshot) with four phantom peers so a category
// with a single traded peer does not inherit that peer's whole valuation,
// clamp the result into [0.02, 3.0], and then value a pre-token protocol
// as TVL x category multiple, adjusted by a mild growth factor from its
// 7-day TVL change and a maturity factor from its age. Nothing is
// hand-picked per protocol: one function scores every row, and the
// dashboard prints the learned multiples so anyone can audit them.
//
// Formula, stated once here and again on the dashboard's model view:
//   implied = round(TVL x category_multiple x growth_multiplier x maturity_multiplier)
//   growth_multiplier   = 1 + clamp(change_7d, -60, 120) / 100 x 0.5
//   maturity_multiplier = 0.6 + min(age_days, 1095) / 1095 x 0.4
//
// Who gets ranked: a protocol that records no token at all (market cap,
// CoinGecko id and symbol all null), minus the product screens the
// watchlist itself uses — no CEX / bridge / liquid-staking style
// categories, no versioned names, no wrapped/staked/staking names, no
// exchange-prefixed names. Every watchlist slug is force-included on top
// of those screens. On the sealed snapshot that yields 198 rows:
// the 40 watchlist protocols plus 158 early ones found below its floor.

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

export interface CategoryMultiple {
  category: string;
  peers: number;
  median_multiple: number | null;
  multiple: number;
}

export interface ModelInfo {
  version: string;
  global_median: number;
  shrink_peers: number;
  clamp_min: number;
  clamp_max: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  categories: CategoryMultiple[];
}

export const MODEL_VERSION = 'radar-2';
export const LIVE_ROWS = 24;

const SHRINK_PEERS = 4;
const CLAMP_MIN = 0.02;
const CLAMP_MAX = 3.0;
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
  watchlist: boolean;
  model: {
    category_multiple: number;
    category_peers: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
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
  watchlist: boolean;
  category_multiple: number;
  category_peers: number;
  growth_pct: number;
  growth_multiplier: number;
  maturity_multiplier: number;
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

/** Learn one multiple per category from the snapshot's traded protocols. */
export function learnMultiples(snapshot: Snapshot): { globalMedian: number; byCategory: Map<string, CategoryMultiple> } {
  const all: number[] = [];
  const perCategory = new Map<string, number[]>();
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    all.push(ratio);
    const key = p.category ?? 'Uncategorised';
    const list = perCategory.get(key);
    if (list) list.push(ratio); else perCategory.set(key, [ratio]);
  }
  const globalMedian = all.length > 0 ? median(all) : 0;
  const byCategory = new Map<string, CategoryMultiple>();
  const categories = new Set<string>();
  for (const p of snapshot.protocols) categories.add(p.category ?? 'Uncategorised');
  for (const category of categories) {
    const peers = perCategory.get(category) ?? [];
    if (peers.length === 0) {
      byCategory.set(category, { category, peers: 0, median_multiple: null, multiple: round4(clamp(globalMedian, CLAMP_MIN, CLAMP_MAX)) });
      continue;
    }
    const med = median(peers);
    const shrunk = (peers.length * med + SHRINK_PEERS * globalMedian) / (peers.length + SHRINK_PEERS);
    byCategory.set(category, { category, peers: peers.length, median_multiple: round4(med), multiple: round4(clamp(shrunk, CLAMP_MIN, CLAMP_MAX)) });
  }
  return { globalMedian, byCategory };
}

export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

const SCREENED_CATEGORIES = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);
const VERSIONED_NAME = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

export function passesScreens(p: SnapshotProtocol): boolean {
  if (p.category !== null && SCREENED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED_NAME.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && passesScreens(p);
}

function growthFor(change: number | null): { pct: number; mult: number } {
  const pct = clamp(typeof change === 'number' && Number.isFinite(change) ? change : 0, GROWTH_FLOOR, GROWTH_CAP);
  return { pct, mult: 1 + (pct / 100) * GROWTH_WEIGHT };
}

function maturityFor(age: number | null): number {
  const days = age ?? UNKNOWN_AGE_DAYS;
  return MATURITY_FLOOR + (clamp(days, 0, MATURITY_DAYS) / MATURITY_DAYS) * MATURITY_RANGE;
}

function firstChain(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

function gasTier(chain: string): string {
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

/** The category playbook's opening action for a protocol. */
function playbookAction(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('risk curator') || c.includes('curator') || c.includes('allocator') || c.includes('collateral')) {
    return 'Deposit $' + capital + ' of USDC into a curated ' + n + ' vault on ' + chain + ' and keep the vault shares in the same wallet.';
  }
  if (c.includes('lend') || c.includes('cdp')) {
    return 'Supply $' + capital + ' of USDC as collateral to ' + n + ' on ' + chain + ', borrow nothing at first, and keep the supply position open.';
  }
  if (c.includes('dex') || c.includes('liquidity')) {
    return 'Add $' + capital + ' of liquidity to the main ' + n + ' pool on ' + chain + ' and keep the position open instead of hopping pools.';
  }
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('options') || c.includes('synthetic')) {
    return 'Deposit $' + capital + ' of USDC as margin on ' + n + ' and open one small, hedged position so the account shows real usage.';
  }
  if (c.includes('staking') || c.includes('restak') || c.includes('staking pool')) {
    return 'Stake $' + capital + ' worth of the native asset through ' + n + ' on ' + chain + ' and keep the staking receipt token.';
  }
  if (c.includes('rwa') || c.includes('stable') || c.includes('reserve')) {
    return 'Mint or deposit $' + capital + ' of the yield-bearing asset issued through ' + n + ' on ' + chain + ' and hold it in the wallet.';
  }
  if (c.includes('prediction')) {
    return 'Fund the account with $' + capital + ' on ' + n + ' and place one genuine market position, then let it settle naturally.';
  }
  if (c.includes('launchpad') || c.includes('token locker')) {
    return 'Use $' + capital + ' to join one live sale or lock on ' + n + ' and complete every step of its own participation flow.';
  }
  if (c.includes('insurance')) {
    return 'Buy $' + capital + ' of cover from ' + n + ' on ' + chain + ' for a position you actually hold, and keep the policy to expiry.';
  }
  if (c.includes('yield') || c.includes('farm') || c.includes('basis') || c.includes('index')) {
    return 'Deposit $' + capital + ' of USDC into a core ' + n + ' strategy on ' + chain + ' and keep the strategy shares untouched.';
  }
  return 'Deposit $' + capital + ' of USDC into ' + n + ' on ' + chain + ', use its core product once, and keep the resulting position open.';
}

/** Six farm steps per protocol, each in the gate's "action Cost: .. Time: .." form. */
export function farmSteps(p: SnapshotProtocol, age: number | null): string[] {
  const chain = firstChain(p);
  const capital = capitalFor(p.tvl_usd);
  const hold = holdDaysFor(age);
  const gas = gasTier(chain);
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
  const learned = learnMultiples(snapshot);
  const watch = new Set(snapshot.watchlist);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const p of snapshot.protocols) if (isRankable(p)) chosen.set(p.slug, p);
  for (const slug of snapshot.watchlist) {
    const p = snapshot.protocols.find((x) => x.slug === slug);
    if (p) chosen.set(slug, p);
  }
  const scored = [...chosen.values()].map((p) => {
    const entry = learned.byCategory.get(p.category ?? 'Uncategorised')!;
    const growth = growthFor(p.change_7d);
    const age = ageDays(snapshot.as_of, p.listed_at);
    const maturity = maturityFor(age);
    const implied = Math.max(1, Math.round(p.tvl_usd * entry.multiple * growth.mult * maturity));
    return { p, entry, growth, age, maturity, implied };
  });
  scored.sort((a, b) => b.implied - a.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : 1));
  const board: BoardRow[] = scored.map((s, i) => ({
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
    watchlist: watch.has(s.p.slug),
    model: {
      category_multiple: s.entry.multiple,
      category_peers: s.entry.peers,
      growth_pct: round4(s.growth.pct),
      growth_multiplier: round4(s.growth.mult),
      maturity_multiplier: round4(s.maturity),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age),
  }));
  const categories = [...learned.byCategory.values()].sort((a, b) => (a.category < b.category ? -1 : 1));
  const modelInfo: ModelInfo = {
    version: MODEL_VERSION,
    global_median: round4(learned.globalMedian),
    shrink_peers: SHRINK_PEERS,
    clamp_min: CLAMP_MIN,
    clamp_max: CLAMP_MAX,
    growth_weight: GROWTH_WEIGHT,
    growth_floor: GROWTH_FLOOR,
    growth_cap: GROWTH_CAP,
    maturity_floor: MATURITY_FLOOR,
    maturity_range: MATURITY_RANGE,
    maturity_days: MATURITY_DAYS,
    unknown_age_days: UNKNOWN_AGE_DAYS,
    categories,
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
    rows: built.board.map((r) => ({
      rank: r.rank, slug: r.slug, name: r.name, category: r.category, chains: r.chains,
      tvl_usd: r.tvl_usd, change_7d: r.change_7d, mcap_usd: r.mcap_usd, listed_at: r.listed_at,
      age_days: r.age_days, implied_value_usd: r.implied_value_usd, watchlist: r.watchlist,
      category_multiple: r.model.category_multiple, category_peers: r.model.category_peers,
      growth_pct: r.model.growth_pct, growth_multiplier: r.model.growth_multiplier,
      maturity_multiplier: r.model.maturity_multiplier, farm_steps: r.farm_steps,
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
