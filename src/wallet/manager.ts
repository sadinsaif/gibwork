import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Keypair } from '@solana/web3.js';
import { ephemeralKeyPath, earnHome } from '../util/paths.js';

const require = createRequire(import.meta.url);

export type WalletMode = 'ephemeral-read-only' | 'env-private-key' | 'env-keypair-file';

export interface ResolvedWallet {
  /** Private key in a form the Gibwork SDK accepts: a JSON array string of secret-key bytes. */
  privateKey: string;
  publicKey: string;
  mode: WalletMode;
  /** For ephemeral mode, the file the key was stored in. */
  source?: string;
}

/**
 * Resolve a wallet for signing read-only Gibwork requests.
 *
 * earn NEVER performs funded or write operations, so this wallet only
 * ever signs authentication messages for read endpoints. It does not
 * need to hold any SOL or tokens.
 *
 * Resolution order (mirrors the official Gibwork CLI credential order):
 *   1. GIBWORK_PRIVATE_KEY  (base58 string, or JSON array of 32/64 bytes)
 *   2. GIBWORK_KEYPAIR_PATH (path to a Solana keypair JSON file)
 *   3. Auto-generated ephemeral read-only key (persisted 0600)
 */
export function resolveWallet(): ResolvedWallet {
  const rawKey = process.env.GIBWORK_PRIVATE_KEY?.trim();
  if (rawKey) {
    const kp = keypairFromUnknown(rawKey);
    return {
      privateKey: JSON.stringify(Array.from(kp.secretKey)),
      publicKey: kp.publicKey.toBase58(),
      mode: 'env-private-key',
    };
  }

  const keyPath = process.env.GIBWORK_KEYPAIR_PATH?.trim();
  if (keyPath) {
    const kp = keypairFromFile(keyPath);
    return {
      privateKey: JSON.stringify(Array.from(kp.secretKey)),
      publicKey: kp.publicKey.toBase58(),
      mode: 'env-keypair-file',
      source: keyPath,
    };
  }

  return loadOrCreateEphemeral();
}

function loadOrCreateEphemeral(): ResolvedWallet {
  const p = ephemeralKeyPath();
  if (fs.existsSync(p)) {
    try {
      const kp = keypairFromFile(p);
      return {
        privateKey: JSON.stringify(Array.from(kp.secretKey)),
        publicKey: kp.publicKey.toBase58(),
        mode: 'ephemeral-read-only',
        source: p,
      };
    } catch {
      // Corrupt file — regenerate below.
    }
  }

  fs.mkdirSync(earnHome(), { recursive: true });
  const kp = Keypair.generate();
  const bytes = JSON.stringify(Array.from(kp.secretKey));
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, bytes, { mode: 0o600 });
  fs.renameSync(tmp, p);
  try {
    fs.chmodSync(p, 0o600);
  } catch {
    // chmod is a no-op / best-effort on some Windows setups.
  }
  return {
    privateKey: bytes,
    publicKey: kp.publicKey.toBase58(),
    mode: 'ephemeral-read-only',
    source: p,
  };
}

function keypairFromFile(filePath: string): Keypair {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Keypair file not found: ${filePath}`);
  }
  const contents = fs.readFileSync(filePath, 'utf8').trim();
  return keypairFromUnknown(contents);
}

/** Accept a JSON byte array (32 or 64 bytes) or a base58 secret key string. */
function keypairFromUnknown(value: string): Keypair {
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    const arr = JSON.parse(trimmed) as number[];
    if (!Array.isArray(arr) || (arr.length !== 64 && arr.length !== 32)) {
      throw new Error('Keypair JSON array must contain 32 or 64 byte values');
    }
    const bytes = Uint8Array.from(arr);
    return arr.length === 64 ? Keypair.fromSecretKey(bytes) : Keypair.fromSeed(bytes);
  }
  // base58 — decode via bs58 (a transitive dep of the SDK).
  return keypairFromBase58(trimmed);
}

function keypairFromBase58(b58: string): Keypair {
  // bs58 is available as a transitive dependency of @gibwork/sdk.
  const bs58 = require('bs58') as { default?: { decode(s: string): Uint8Array }; decode?(s: string): Uint8Array };
  const decode = bs58.decode ?? bs58.default?.decode;
  if (!decode) throw new Error('Unable to load bs58 decoder');
  const bytes = decode(b58);
  if (bytes.length === 64) return Keypair.fromSecretKey(bytes);
  if (bytes.length === 32) return Keypair.fromSeed(bytes);
  throw new Error('base58 secret key must decode to 32 or 64 bytes');
}
