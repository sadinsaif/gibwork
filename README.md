# earn — a terminal bounty-hunter's ledger for Gibwork

`earn` is a **command-line tool** that turns [Gibwork](https://gib.work) bounty hunting into a scriptable, keyboard-driven workflow. Discover open Solana bounties, track the ones you care about in a local ledger, and get notified when they change — all from your shell, with machine-readable output for scripts and CI.

It is built directly on the **official [`@gibwork/sdk`](https://www.npmjs.com/package/@gibwork/sdk)** and talks to the real Gibwork production API. There is **no web UI, no browser, and no server** — just a CLI and a local JSON ledger.

> **Why this is not "just another web app":** Gibwork's own product is a website. A bounty hunter working across dozens of bounties has no terminal-native way to triage, track, diff, and report on them. `earn` fills that gap — it's an operations/automation tool for power users and scripts, the kind of thing you pipe into `jq`, run in a cron job, or wire into a dashboard export.

---

## Table of contents

- [What it does](#what-it-does)
- [Why it qualifies as a CLI use case](#why-it-qualifies-as-a-cli-use-case)
- [How the Gibwork integration is real](#how-the-gibwork-integration-is-real)
- [Requirements](#requirements)
- [Install & build](#install--build)
- [Zero-config: the ephemeral read-only wallet](#zero-config-the-ephemeral-read-only-wallet)
- [Environment variables](#environment-variables)
- [Commands](#commands)
- [Sample output](#sample-output)
- [The opportunity score (transparent heuristic)](#the-opportunity-score-transparent-heuristic)
- [JSON output & scripting](#json-output--scripting)
- [Scope & honest limitations](#scope--honest-limitations)
- [Rate limits](#rate-limits)
- [Where data is stored](#where-data-is-stored)
- [Security](#security)
- [Project layout](#project-layout)
- [License](#license)

---

## What it does

| Capability | Command |
| --- | --- |
| **Discover** open bounties across all creators, with filters, sorting, and a local opportunity score | `earn discover` |
| **Track** a bounty in a local ledger (stores a live snapshot) | `earn track <id>` |
| **List** everything you track (offline) | `earn list` |
| **Show** one bounty in detail, optionally refreshing it | `earn show <id> --refresh` |
| **Sync** every tracked bounty and record what changed since last time | `earn sync` |
| **Watch** bounties and print changes as they happen | `earn watch <id...>` |
| **Report** on your pipeline (reward pools, deadlines, competition) | `earn report` |
| **Export** your ledger as JSON, CSV, or Markdown | `earn export --format md` |
| **Doctor** — verify environment, wallet, and live connectivity | `earn doctor` |

## Why it qualifies as a CLI use case

- **Terminal-native, no frontend.** Every feature is a subcommand. Output is a formatted table for humans (on `stderr`) or a stable JSON envelope for machines (on `stdout`).
- **Solves a real workflow problem.** Serious bounty hunters track many bounties at once. The website shows you one bounty at a time and forgets everything the moment you close the tab. `earn` gives you a persistent, diffable, exportable ledger and change tracking — a genuine operations tool.
- **Composable.** `earn discover --json | jq`, `earn export --format csv > bounties.csv`, `earn sync` in a cron job, `earn report --json` into a dashboard. It behaves like a Unix citizen.
- **The SDK is the core, not a decoration.** Discovery and tracking are *entirely* powered by the official Gibwork SDK. Remove the SDK and there is no product.

## How the Gibwork integration is real

`earn` uses only documented, real surfaces of the official SDK — nothing is mocked, stubbed, or faked:

| earn feature | Real SDK call |
| --- | --- |
| `discover` | [`client.tasks.listAvailable({ page, limit })`](https://www.npmjs.com/package/@gibwork/sdk) |
| `track`, `show --refresh`, `sync`, `watch` | `client.tasks.get(taskId)` |
| `doctor` connectivity probe | `client.tasks.listAvailable({ page: 1, limit: 1 })` |

Authentication is exactly what the SDK requires: a Solana keypair that **signs an authentication message** for each request (via `@solana/web3.js` and the SDK's `createGibworkClient`). Discovery and task-detail reads are free and do **not** require the wallet to hold any SOL or tokens — which is why `earn` can auto-generate a throwaway read-only key and work with zero setup.

Everything in this README's [Sample output](#sample-output) section was captured from live calls to the Gibwork **production** API.

## Requirements

- **Node.js >= 22** (uses native `fetch` and modern ESM). Tested on Node 24.
- A terminal. That's it — no wallet funding, no API key, no account signup needed for the read-only features.

## Install & build

```bash
# 1. Clone and enter the project
git clone https://github.com/sadinsaif/gibwork.git
cd gibwork

# 2. Install dependencies
npm install

# 3. Build (TypeScript -> dist/)
npm run build

# 4a. Run directly...
node dist/bin.js --help

# 4b. ...or link it as a global `earn` command
npm link
earn --help
```

> The examples below use `earn`. If you didn't `npm link`, substitute `node dist/bin.js` for `earn`.

Verify everything works, including live connectivity:

```bash
earn doctor
```

## Zero-config: the ephemeral read-only wallet

The Gibwork SDK authenticates by signing messages with a Solana keypair. For **read-only** discovery and task reads, that key never needs any funds.

So on first run, if you haven't provided a key, `earn` **generates an ephemeral keypair**, stores it with owner-only permissions (`0600`), and reuses it on subsequent runs. This means a reviewer can clone the repo and run `earn discover` immediately — **no wallet, no funding, no configuration**.

If you'd rather use your own wallet (e.g. so reads are associated with your account), set `GIBWORK_PRIVATE_KEY` or `GIBWORK_KEYPAIR_PATH` (see below).

## Environment variables

All variables are **optional**. See [`.env.example`](.env.example).

| Variable | Purpose | Default |
| --- | --- | --- |
| `GIBWORK_PRIVATE_KEY` | Your Solana private key (base58 string, or JSON byte array). Used to sign auth messages. | *(auto-generated ephemeral key)* |
| `GIBWORK_KEYPAIR_PATH` | Path to a Solana keypair JSON file (e.g. `~/.config/solana/id.json`). Alternative to the above. | *(unset)* |
| `EARN_ENVIRONMENT` | `production` or `stage`. | `production` |
| `EARN_TIMEOUT_MS` | Request timeout in milliseconds. | `20000` |
| `EARN_HOME` | Override where the ledger, config, and read-only key are stored. | per-OS config dir |

Per-invocation flags `--env`, `--timeout`, and `--json` override config for a single run.

## Commands

Global options (valid on any command): `--json`, `--env <production|stage>`, `--timeout <ms>`.

### `earn discover`
Discover available bounties across all creators (live, read-only).

```
-l, --limit <n>        results per page (1-100)
-p, --pages <n>        how many pages to fetch (1-10)
-t, --tag <tag>        require this tag (repeatable)
-s, --symbol <symbol>  only this reward token (e.g. USDC)
    --min-reward <n>   minimum reward in native token units
-q, --query <text>     match title or tags (substring)
    --sort <key>       score | reward | newest | oldest | competition
    --open             only bounties with open submission slots
    --exclude-premium  hide bounties that require a premium account
```

```bash
earn discover --sort reward --symbol USDC --min-reward 100
earn discover --query "developer" --json | jq '.data.bounties[].url'
```

### `earn track <id-or-url>`
Track a bounty by UUID or `https://gib.work/bounty/<id>` URL. Fetches and stores a live snapshot.

```bash
earn track 1052f22d-3f87-4b1d-b0d7-71a60679e7fa --note "my pick"
earn track https://gib.work/bounty/1052f22d-3f87-4b1d-b0d7-71a60679e7fa
```

### `earn list` (alias `ls`)
List tracked bounties from the local ledger (no network). `--open` filters to still-open bounties.

### `earn show <id-or-url>`
Show one tracked bounty in detail. `--refresh` fetches a fresh snapshot and records any changes; `--history` prints the full change log.

### `earn sync`
Refresh **all** tracked bounties for the current environment and record what changed. Throttled to respect rate limits; writes progress incrementally so an interruption never loses data. `--delay <ms>` tunes the pause between calls (default `1100`).

### `earn watch [ids...]`
Poll one or more bounties (default: all tracked in this env) and print changes as they happen. `--interval <secs>` (min 30), `--count <n>` to stop after N polls (0 = until Ctrl+C).

### `earn report`
Summarize your tracked pipeline: open/closed counts, reward pools by token, status breakdown, upcoming deadlines, and recently changed bounties.

### `earn export`
Export the ledger. `--format json|csv|md`, `--out <file>` (default stdout), `--open` to export only open bounties.

### `earn config`
`earn config` (list) · `earn config get <key>` · `earn config set <key> <value>` · `earn config path`.
Keys: `environment`, `timeoutMs`, `defaultLimit`.

### `earn doctor`
Check Node version, that the data dir is writable, wallet resolution (public key only — never the secret), and **live Gibwork connectivity**.

## Sample output

> Captured live against the Gibwork **production** API.

```text
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
```

```text
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

See [`examples/`](examples/) for full captured JSON, CSV, and Markdown exports.

## The opportunity score (transparent heuristic)

The `SCORE` column in `discover` is **computed locally by earn** — Gibwork does not provide a ranking. The formula uses only real API fields and is fully documented so you can trust it or ignore it:

- **Freshness** (55%): newer bounties score higher (exponential decay, ~14-day scale).
- **Scarcity** (45%): less competition scores higher — remaining submission slots when the bounty caps submissions, otherwise `1 / (1 + totalSubmissions)`.
- A **closed** bounty always scores 0.

Reward **value** is deliberately *not* folded into the score: discovery responses carry no USD price, and comparing raw token amounts across different mints (USDC vs SOL vs BONK) would be misleading. Sort by reward explicitly with `--sort reward` if that's what you want. The implementation lives in [`src/core/score.ts`](src/core/score.ts).

## JSON output & scripting

Add `--json` to any command for a stable envelope on **stdout** (human progress/warnings go to **stderr**, so pipes stay clean):

```json
{ "ok": true, "data": { "...": "..." } }
{ "ok": false, "error": { "code": "API_ERROR", "message": "..." } }
```

```bash
# Highest-reward open USDC bounties, as a table of url + reward
earn discover --symbol USDC --open --json \
  | jq -r '.data.bounties | sort_by(-.rewardHuman)[] | "\(.rewardHuman)\tUSDC\t\(.url)"'

# CSV of your tracked ledger for a spreadsheet
earn export --format csv > my-bounties.csv
```

## Scope & honest limitations

`earn` is intentionally **read-only**. It never creates, submits to, approves, rejects, refunds, or funds anything — there is no code path that moves money or writes to Gibwork. This keeps it safe to run, safe to review, and usable with a throwaway key.

Two honesty notes about what the Gibwork API does and does not expose, so nothing here is misleading:

1. **No personal earnings/payout history.** The SDK does not expose a *participant's* own submission review or payout outcomes. So `earn report` summarizes the **bounties you track** (your opportunity pipeline), not money you've personally earned. We do not fabricate an earnings number.
2. **`asset.amount` is the original reward pool**, not the remaining balance, and the API returns it as a base-unit **string** (even where the SDK's types say `number`). `earn` parses it defensively and converts using the token's `decimals`. See [`src/util/amount.ts`](src/util/amount.ts).

## Rate limits

Gibwork documents ~30 requests/min for discovery and ~60/min for status reads. `earn` throttles multi-page discovery and `sync`/`watch` loops accordingly, and honors a `retryAfter` hint from the API when present.

## Where data is stored

A single directory (override with `EARN_HOME`):

- **Windows:** `%APPDATA%\earn`
- **macOS:** `~/Library/Application Support/earn`
- **Linux:** `$XDG_CONFIG_HOME/earn` or `~/.config/earn`

Contents: `ledger.json` (your tracked bounties + change history), `config.json`, and `read-only-key.json` (the ephemeral key, `0600`). Run `earn config path` to print the exact locations.

## Security

- The ephemeral key is stored with `0600` permissions and is **git-ignored**. Private keys are **never logged or printed** — `doctor` shows only the public key.
- You can delete the data directory at any time; `earn` regenerates what it needs.
- No funded or write operations exist in the codebase, so running `earn` cannot spend anything.

## Project layout

```
src/
  bin.ts              # CLI entrypoint (commander wiring)
  gibwork/service.ts  # the only module that talks to @gibwork/sdk
  wallet/manager.ts   # key resolution + ephemeral read-only key
  store/ledger.ts     # local JSON ledger (atomic writes)
  core/               # snapshot mapping, scoring, filtering, diffing, reporting
  export/             # json / csv / md renderers
  commands/           # one file per subcommand
  util/               # paths, amount parsing, config, logging, formatting
```

## License

[MIT](LICENSE)
