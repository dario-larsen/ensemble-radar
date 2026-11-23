# Ensemble Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/dario-larsen/ensemble-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/dario-larsen/ensemble-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar that ranks pre-token protocols by **multi-signal ensemble**, not by size or
momentum alone. Most radars sort by TVL or by one growth figure; this one blends five signals, each
read off the sealed snapshot, and prices each protocol with the market multiple its own category
already trades at.

Built by an AI agent for make.fun's "Build the best token launch radar" bounty, $1,325 in USDC.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Node.js 22.18 or later. No dependencies, no network: `main.ts` reads the sealed snapshot, scores the
board, writes `board.json`, `data.js`, `dashboard/` and `screenshots/` into the output directory, and
`dossier.json` with the dossier writer in `lib/dossier.ts`.

## The model

Every figure comes from the snapshot alone — TVL, seven-day change, age with no token, chains, and
the market caps of the protocols that already trade. No protocol name is ever special-cased.

```
category multiple = median mcap/TVL of the live-token protocols in the same category
                    (fewer than 3 live peers: the global median; clamped ×0.02…×2.0)
momentum          = 1 + clamp(change_7d, −60, +150)% × 0.6
tenure            = 0.75 + 0.45 × log(1 + age) / log(1 + 1095 days)   (unknown age: 365 days)
reach             = 1 + 0.04 × min(chains, 8)
implied           = TVL × category multiple × momentum × tenure × reach
ensemble          = 0.20·scale + 0.25·multiple + 0.25·momentum + 0.20·tenure + 0.10·reach
```

The five signals are each normalised to 0–100 across the board itself (scale from log TVL,
multiple from log multiple, momentum from the clamped growth, tenure from log age, reach from
chain count), and the ensemble score is their weighted blend — the board's conviction figure.
The rank itself is by implied value, so rank 1 is the board's most valuable protocol. The
multipliers are rounded to four decimals before the value is formed, so the dashboard's recompute
from a row's own figures lands on the same dollar as `board.json`.

The same growth figure sorts each protocol into a regime — breakout (≥ +20%), heating (+5% to
+20%), steady (−5% to +5%), cooling (−20% to −5%), fading (below −20%), unknown when unreported —
and the dashboard filters by it. The board covers all 40 watchlist protocols plus every rankable
pre-token protocol below the watchlist floor (186 more, 226 rows). Protocols above the floor that
the house rule leaves off the watchlist stay off this board for the same reason: wrapped, staked
or bridged products, versioned pools and exchanges are not standalone launches. Protocols whose
token already trades are kept apart in an "Already trading" view at the market's own value — their
mcap/TVL ratios are the calibration set for the category multiples — never mixed into the ranking.

Each row carries a seven-step farm plan derived from the protocol's own record (category, chains,
TVL, age, momentum regime), with a cost and a time for every step.

## The dashboard

`dashboard/` is a static page with no network: a sortable, filterable board, a detail view for
every protocol (hash-routed, e.g. `#p=steakhouse-financial`), regime/category/chain filters, the
five signal bars per row, the full implied-value arithmetic per protocol, and the live-token table.
Open `dashboard/index.html` with the generated `data.js` beside it.

---

<sub>Entered on [make.fun](https://make.fun/?ref=dario-larsen&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
