# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/haodanxiao-jpg/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/haodanxiao-jpg/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: pre-token protocols ranked by an implied value learned from the snapshot's own traded peers, each with a farm plan.

The model ("radar-2", in `lib/model.ts`) learns, for each category, the median market-cap / TVL multiple of that category's traded protocols in the sealed snapshot, shrinks it toward the global median with four phantom peers, clamps it to [0.02, 3.0], and values each pre-token protocol as TVL × category multiple × growth multiplier × maturity multiplier. The ranked board covers all 40 watchlist protocols plus 158 early finds below the watchlist floor — 198 rows — and the static dashboard (`dashboard/`) shows the board with search, filters and sorting, a detail view per protocol with its formula and six-step farm plan, the live tokens set apart at market value, and the full learned multiples table.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=r37knv38&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
