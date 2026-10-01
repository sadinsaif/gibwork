# examples

Real output captured from `earn` running against the Gibwork **production** API (and the local ledger). Nothing here is hand-written or mocked.

| File | How it was produced |
| --- | --- |
| [`discover.json`](discover.json) | `earn discover --limit 10 --json` — live discovery of 10 available bounties |
| [`ledger-export.json`](ledger-export.json) | `earn export --format json` — the tracked ledger |
| [`ledger-export.csv`](ledger-export.csv) | `earn export --format csv` — spreadsheet-ready (note RFC-4180 quoting of the comma in a title) |
| [`ledger-export.md`](ledger-export.md) | `earn export --format md` — a Markdown table with links |

## A full session

Captured verbatim (ANSI colors stripped). The only value that will differ on your machine is the ephemeral wallet's public key.

```text
$ earn doctor
earn doctor
  ✓ node >= 22       v24.19.0
  ✓ home writable    C:\Users\you\AppData\Roaming\earn
  ✓ wallet           ephemeral-read-only · CrTGYQaHGsrrL1Vjbj4o23tPBg3F3gdcsj9YacyvJqde (…\earn\read-only-key.json)
  ✓ gibwork api      reachable · 10 available bounties (production)

All checks passed. You are ready to go.

$ earn discover --limit 10
SCORE  REWARD       SUBS     AGE      TITLE                               ID
─────  ───────────  ───────  ───────  ──────────────────────────────────  ────────────────────────────────────
98     30 USDC      1/30     2h ago   Invite a UGC Creator to Gibwork a…  7bfb8aeb-560c-41ae-9dc8-70f65326b59f
93     100 USDC     16/150   10h ago  Create an X thread and IronVaults…  25ab1f78-6afd-4e59-aa89-10e9c19fe304
80     125 USDC     58/5000  6d ago   Invite Users, Earn Points, and Cl…  d8c7530d-b3b1-4c5b-80ef-a71a0e804ce7
...
19     1000 USDC    5        22d ago  Gibwork Developer Hackathon Bounty  1052f22d-3f87-4b1d-b0d7-71a60679e7fa

10 of 10 bounties shown · sorted by score · score is earn's local heuristic (freshness+scarcity), not a Gibwork field.
Track one with:  earn track <ID>

$ earn track 1052f22d-3f87-4b1d-b0d7-71a60679e7fa --note "the bounty earn is built for"
Fetching bounty 1052f22d… from Gibwork (production)…
✓ Now tracking: Gibwork Developer Hackathon Bounty
  reward   1000 USDC  (~$1000)
  status   CREATED (open)
  subs     5 pending / 0 approved / 0 rejected
  https://gib.work/bounty/1052f22d-3f87-4b1d-b0d7-71a60679e7fa

$ earn list
STATUS  REWARD     SUBS    DEADLINE    SYNCED   TITLE                               ID
──────  ─────────  ──────  ──────────  ───────  ──────────────────────────────────  ────────────────────────────────────
open    1000 USDC  5/0/0   2026-10-30  12m ago  Gibwork Developer Hackathon Bounty  1052f22d-3f87-4b1d-b0d7-71a60679e7fa
open    100 USDC   16/0/0  2026-10-14  12m ago  Create an X thread and IronVaults…  25ab1f78-6afd-4e59-aa89-10e9c19fe304
open    125 USDC   58/0/0  2026-10-14  12m ago  Invite Users, Earn Points, and Cl…  d8c7530d-b3b1-4c5b-80ef-a71a0e804ce7

3 bounty(ies) tracked · SUBS = pending/approved/rejected · refresh with earn sync

$ earn sync
Syncing 3 bounty(ies) from Gibwork (production)…
  = Gibwork Developer Hackathon Bounty
  = Create an X thread and IronVaults vault
  = Invite Users, Earn Points, and Climb the Leaderboard

✓ Synced 3 · 0 changed

$ earn report
earn — bounty pipeline report
generated 2026-10-01T02:41:12.827Z

  tracked      3  (3 open / 0 closed)
  submissions  79 pending · 0 approved · 0 rejected  (across tracked bounties)

  Reward pools by token
    1225 USDC  × 3 bounty(ies)  (~$1225)

  Status breakdown
    CREATED      3

  Upcoming deadlines
    2026-10-14  14d left  Create an X thread and IronVaults vault
    2026-10-14  14d left  Invite Users, Earn Points, and Climb the Leaderboard
    2026-10-30  30d left  Gibwork Developer Hackathon Bounty

  Note: Gibwork does not expose a participant's own payout history,
  so this summarizes the bounties you track, not personal earnings.
```
