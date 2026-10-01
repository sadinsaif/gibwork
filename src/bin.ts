#!/usr/bin/env node
import { createRequire } from 'node:module';
import { Command } from 'commander';
import { resolveRuntime, type GlobalOpts, type Runtime } from './commands/context.js';
import { EarnApiError } from './gibwork/service.js';
import { emitJsonError, errline, isJsonMode, c } from './util/logger.js';

import { discoverCmd } from './commands/discover.js';
import { trackCmd } from './commands/track.js';
import { untrackCmd } from './commands/untrack.js';
import { listCmd } from './commands/list.js';
import { showCmd } from './commands/show.js';
import { syncCmd } from './commands/sync.js';
import { reportCmd } from './commands/report.js';
import { exportCmd } from './commands/export.js';
import { watchCmd } from './commands/watch.js';
import { configCmd } from './commands/config.js';
import { doctorCmd } from './commands/doctor.js';

const require = createRequire(import.meta.url);
let version = '0.1.0';
try {
  version = (require('../package.json') as { version: string }).version;
} catch {
  /* keep fallback */
}

const collect = (val: string, prev: string[] = []): string[] => prev.concat([val]);

function reportError(rt: Runtime | null, err: unknown): void {
  const json = rt?.json ?? isJsonMode();
  if (err instanceof EarnApiError) {
    const extra = err.retryAfter ? ` (retry after ${err.retryAfter}s)` : '';
    if (json) emitJsonError(err.code, err.message + extra);
    else errline(c.red(`✗ ${err.code}: ${err.message}${extra}`));
  } else {
    const msg = err instanceof Error ? err.message : String(err);
    if (json) emitJsonError('ERROR', msg);
    else errline(c.red(`✗ ${msg}`));
  }
  process.exitCode = 1;
}

/** Build the runtime from merged globals and run a command body with uniform error handling. */
async function run(cmd: Command, body: (rt: Runtime) => Promise<void>): Promise<void> {
  let rt: Runtime | null = null;
  try {
    const globals = cmd.optsWithGlobals() as GlobalOpts;
    rt = resolveRuntime(globals);
    await body(rt);
  } catch (err) {
    reportError(rt, err);
  }
}

const program = new Command();

program
  .name('earn')
  .description(
    'A terminal bounty-hunter\'s ledger for Gibwork (gib.work).\n' +
      'Discover, track, and monitor Solana bounties from your shell. Read-only — no funds, no writes.',
  )
  .version(version, '-v, --version', 'print version')
  .option('--json', 'machine-readable JSON output on stdout', false)
  .option('-e, --env <environment>', 'gibwork environment: production | stage')
  .option('--timeout <ms>', 'request timeout in milliseconds');

program
  .command('discover')
  .description('discover available bounties across creators (live, read-only)')
  .option('-l, --limit <n>', 'results per page (1-100)')
  .option('-p, --pages <n>', 'how many pages to fetch (1-10)')
  .option('-t, --tag <tag>', 'require this tag (repeatable)', collect)
  .option('-s, --symbol <symbol>', 'only this reward token symbol (e.g. USDC)')
  .option('--min-reward <n>', 'minimum reward in native token units')
  .option('-q, --query <text>', 'match title or tags (substring)')
  .option('--sort <key>', 'score | reward | newest | oldest | competition')
  .option('--open', 'only bounties with open submission slots', false)
  .option('--exclude-premium', 'hide bounties that require a premium account', false)
  .action(function (this: Command, opts) {
    return run(this, (rt) => discoverCmd(opts, rt));
  });

program
  .command('track')
  .description('track a bounty by id or gib.work URL (fetches a live snapshot)')
  .argument('<id-or-url>', 'bounty UUID or https://gib.work/bounty/<id>')
  .option('-n, --note <text>', 'attach a private note')
  .action(function (this: Command, idOrUrl, opts) {
    return run(this, (rt) => trackCmd(idOrUrl, opts, rt));
  });

program
  .command('untrack')
  .description('stop tracking a bounty')
  .argument('<id-or-url>', 'bounty UUID or URL')
  .action(function (this: Command, idOrUrl) {
    return run(this, (rt) => untrackCmd(idOrUrl, rt));
  });

program
  .command('list')
  .alias('ls')
  .description('list tracked bounties (local, no network)')
  .option('--open', 'only show bounties that are still open', false)
  .action(function (this: Command, opts) {
    return run(this, (rt) => listCmd(opts, rt));
  });

program
  .command('show')
  .description('show one tracked bounty in detail')
  .argument('<id-or-url>', 'bounty UUID or URL')
  .option('--refresh', 'fetch a fresh snapshot and record changes', false)
  .option('--history', 'include full change history', false)
  .action(function (this: Command, idOrUrl, opts) {
    return run(this, (rt) => showCmd(idOrUrl, opts, rt));
  });

program
  .command('sync')
  .description('refresh all tracked bounties and record changes (throttled)')
  .option('--delay <ms>', 'delay between status calls (default 1100)')
  .action(function (this: Command, opts) {
    return run(this, (rt) => syncCmd(opts, rt));
  });

program
  .command('report')
  .description('summarize your tracked bounty pipeline')
  .action(function (this: Command) {
    return run(this, (rt) => reportCmd(rt));
  });

program
  .command('export')
  .description('export the tracked ledger as json | csv | md')
  .option('-f, --format <fmt>', 'json | csv | md', 'json')
  .option('-o, --out <file>', 'write to a file instead of stdout')
  .option('--open', 'only export bounties that are still open', false)
  .action(function (this: Command, opts) {
    return run(this, (rt) => exportCmd(opts, rt));
  });

program
  .command('watch')
  .description('poll one or more bounties and print changes as they happen')
  .argument('[ids...]', 'bounty ids/URLs (default: all tracked in this env)')
  .option('-i, --interval <secs>', 'seconds between polls (min 30)')
  .option('-c, --count <n>', 'stop after N polls (0 = run until Ctrl+C)')
  .action(function (this: Command, ids, opts) {
    return run(this, (rt) => watchCmd(ids, opts, rt));
  });

program
  .command('config')
  .description('view or change configuration')
  .argument('[action]', 'list | get | set | path', 'list')
  .argument('[key]', 'config key')
  .argument('[value]', 'new value (for set)')
  .action(function (this: Command, action, key, value) {
    return run(this, (rt) => configCmd(action, key, value, rt));
  });

program
  .command('doctor')
  .description('check environment, wallet, and live Gibwork connectivity')
  .action(function (this: Command) {
    return run(this, (rt) => doctorCmd(rt));
  });

program.parseAsync(process.argv).catch((err) => {
  reportError(null, err);
});
