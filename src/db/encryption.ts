/**
 * The local database is encrypted with SQLCipher (P5-03, ADR-011). The DPIA's
 * largest residual risk was a lost phone: the platform encrypts the disk, but
 * a plaintext SQLite file is readable to anything that gets past the lock
 * screen, a backup or a forensic copy. With SQLCipher the file is ciphertext,
 * and its key lives in the keychain (iOS) or Keystore (Android).
 *
 * This file is the decision logic only: which file to open, with which key,
 * and how an old plaintext database becomes an encrypted one. The native calls
 * are behind {@link DbFiles} and {@link KeyStore}, so the decisions are tested
 * in jest while the SQLCipher build itself can only be tested on a phone.
 */

/** Before P5-03 the database was this plaintext file. */
export const PLAIN_DB = 'moraki.db';
/** From P5-03 on, the encrypted one. A new name, so a half-done conversion is never mistaken for a finished one. */
export const ENCRYPTED_DB = 'moraki-encrypted.db';

/** The SQLite handle, as far as this file needs it. */
export type DbHandle = {
  execSync(sql: string): void;
  closeSync(): void;
};

/** The database files in the app's SQLite directory. */
export type DbFiles<H extends DbHandle> = {
  exists(name: string): boolean;
  /** Absolute path, for ATTACH. */
  pathOf(name: string): string;
  /** Opens a database; with a key, `PRAGMA key` is the first statement it runs. */
  open(name: string, key: string | null): H;
  remove(name: string): void;
};

/** Where the database key is kept: SecureStore on the phone. */
export type KeyStore = {
  get(): string | null;
  set(key: string): void;
};

/** What happened on open; never anything about the data itself. */
export type OpenOutcome = 'opened' | 'created' | 'converted' | 'reset_unreadable';

/** A 256-bit key as 64 hex characters: SQLCipher's raw key form, `x'...'`. */
export function isRawKey(key: string): boolean {
  return /^[0-9a-f]{64}$/.test(key);
}

const keyLiteral = (key: string) => `"x'${key}'"`;

/**
 * Opens the encrypted database, creating its key on first use and converting
 * a pre-P5-03 plaintext database into it once.
 *
 * - The plaintext file is removed only after the export finished. If the app
 *   dies half way, both files exist on the next launch; the encrypted one may
 *   be incomplete, so it is removed and the export runs again.
 * - If the key is gone (a phone restored without its keychain) the encrypted
 *   file can't be read by anyone. It is removed and a new database started:
 *   a signed-in phone pulls its household again; entries never sent are lost,
 *   which is the price of the file being unreadable without the key.
 */
export function openEncrypted<H extends DbHandle>(
  files: DbFiles<H>,
  keys: KeyStore,
  newKey: () => string,
): { db: H; outcome: OpenOutcome } {
  let key = keys.get();
  let outcome: OpenOutcome = 'opened';

  if (key === null || !isRawKey(key)) {
    if (files.exists(ENCRYPTED_DB)) {
      files.remove(ENCRYPTED_DB);
      outcome = 'reset_unreadable';
    }
    key = newKey();
    if (!isRawKey(key)) throw new Error('newKey must return 64 lowercase hex characters');
    keys.set(key);
  }

  if (files.exists(PLAIN_DB)) {
    if (files.exists(ENCRYPTED_DB)) files.remove(ENCRYPTED_DB);
    const plain = files.open(PLAIN_DB, null);
    try {
      plain.execSync(
        `ATTACH DATABASE '${files.pathOf(ENCRYPTED_DB).replace(/'/g, "''")}' AS encrypted KEY ${keyLiteral(key)};`,
      );
      plain.execSync(`SELECT sqlcipher_export('encrypted');`);
      plain.execSync('DETACH DATABASE encrypted;');
    } finally {
      plain.closeSync();
    }
    files.remove(PLAIN_DB);
    outcome = 'converted';
  } else if (!files.exists(ENCRYPTED_DB) && outcome === 'opened') {
    outcome = 'created';
  }

  const db = files.open(ENCRYPTED_DB, key);
  try {
    // The first read is where a wrong key shows: "file is not a database".
    db.execSync('SELECT count(*) FROM sqlite_master;');
  } catch {
    db.closeSync();
    files.remove(ENCRYPTED_DB);
    return { db: files.open(ENCRYPTED_DB, key), outcome: 'reset_unreadable' };
  }
  return { db, outcome };
}

/** The statement that unlocks a SQLCipher database; run before anything else. */
export function keyPragma(key: string): string {
  if (!isRawKey(key)) throw new Error('not a raw SQLCipher key');
  return `PRAGMA key = ${keyLiteral(key)};`;
}
