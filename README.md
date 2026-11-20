# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/haodanxiao-jpg/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/haodanxiao-jpg/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: pre-token protocols ranked by expected value — the value if a token launches, times a fitted model's odds that it launches — where every term of both models had to lower a blind-test miss twice before it was allowed in.

The models ("radar-5", in `lib/model.ts`) are fitted on the sealed snapshot and re-derived on every run. Value: a size curve in log TVL (with a curvature term) over the traded protocols, plus only the terms that lower the typical miss in **both** a leave-one-out test and a walk-forward test — of family and category effects, 7-day growth, maturity, curvature and chain count, only maturity and curvature survived (typical miss ×3.34 leave-one-out, ×2.98 walk-forward); the losers stay printed on the dashboard, and a negative control — another row's growth — is included to prove the tests can say no. Odds: a logistic model on 645 protocols (years listed, log TVL, growth, chain count, and whether a same-name family member already has a token — the single strongest feature), scored out-of-sample by 10-fold and walk-forward Brier against the base rate (0.173 vs 0.250; 75.2% called right). Every row carries a calibrated P25–P75 range (on held-out protocols the stated 50% band actually held 50.8% of real caps), a rank range inside that band, and a farm verdict from a stated scenario (drop share × value × odds, pro-rata over a farmer pool, minus the plan's own fees) that the dashboard's slider recomputes live. A coverage ledger accounts for all 758 protocols — 198 ranked (all 40 watchlist protocols plus 158 early finds), the rest already trading, on record, or set aside by a named screen — and the dashboard's first screen shows the ledger, both test tables, the odds scores and a self-check strip the page computes about its own table, before the board itself.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=r37knv38&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
