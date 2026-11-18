# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/haodanxiao-jpg/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/haodanxiao-jpg/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: pre-token protocols ranked by an implied value from a size curve fitted on the snapshot's own traded peers — a model that had to pass a held-out test before it was allowed to price anything.

The model ("radar-3", in `lib/model.ts`) fits log(market cap) = α + β·log(TVL) by least squares over the snapshot's traded protocols and values each pre-token protocol as exp(α + β·ln TVL) × growth multiplier × maturity multiplier. It was chosen by a leave-one-out test, recomputed from the snapshot on every run: each traded protocol is priced by a fit that never saw it, and the size curve's typical miss (×3.45, 45.3% within 3×) beats both the flat multiple (×5.17) and the previous category-multiple model (×5.27) — those losing candidates stay on the dashboard, in the open. Every board row carries a range as wide as that measured miss, a launch-odds figure read off the snapshot by age bucket with an odds-adjusted value beside the headline, and a cost-side farm verdict (FARM / THIN / SKIP from the plan's own fees and hours). A coverage ledger accounts for all 758 protocols in the snapshot — 198 ranked (all 40 watchlist protocols plus 158 early finds), the rest already trading, on record, or set aside by a named screen — and the static dashboard (`dashboard/`) shows the ledger, the test and the odds on its first screen, then the board with search, filters and sorting, a detail view per protocol, and the live tokens set apart at market value.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=r37knv38&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
