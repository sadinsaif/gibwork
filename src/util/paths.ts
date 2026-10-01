import os from 'node:os';
import path from 'node:path';

/**
 * Resolve the earn home directory where the ledger and the ephemeral
 * read-only keypair live. Honors EARN_HOME, otherwise uses a per-OS
 * conventional location (mirroring how the official Gibwork CLI picks
 * its config dir).
 */
export function earnHome(): string {
  const override = process.env.EARN_HOME?.trim();
  if (override) return path.resolve(override);

  const platform = process.platform;
  if (platform === 'win32') {
    const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(base, 'earn');
  }
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'earn');
  }
  const xdg = process.env.XDG_CONFIG_HOME?.trim();
  const base = xdg && xdg.length > 0 ? xdg : path.join(os.homedir(), '.config');
  return path.join(base, 'earn');
}

export function configPath(): string {
  return path.join(earnHome(), 'config.json');
}

export function ledgerPath(): string {
  return path.join(earnHome(), 'ledger.json');
}

export function ephemeralKeyPath(): string {
  return path.join(earnHome(), 'read-only-key.json');
}
