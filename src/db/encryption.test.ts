import {
  ENCRYPTED_DB,
  PLAIN_DB,
  isRawKey,
  keyPragma,
  openEncrypted,
  type DbFiles,
  type DbHandle,
  type KeyStore,
} from './encryption';

/**
 * A stand-in for the app's SQLite directory that behaves like SQLCipher where
 * it matters: a file has the key it was written with (null for plaintext), a
 * read with any other key fails, and `sqlcipher_export` copies the contents
 * into the attached file under the attached key.
 */
function fakeDisk(initial: Record<string, { key: string | null; rows: string[] }> = {}) {
  const disk = new Map(Object.entries(initial));
  const log: string[] = [];
  let failExport = false;

  type Handle = DbHandle & { name: string; key: string | null };
  const files: DbFiles<Handle> = {
    exists: (name) => disk.has(name),
    pathOf: (name) => `/data/SQLite/${name}`,
    remove: (name) => {
      log.push(`remove ${name}`);
      disk.delete(name);
    },
    open(name, key) {
      if (!disk.has(name)) disk.set(name, { key, rows: [] });
      let attached: { name: string; key: string } | null = null;
      return {
        name,
        key,
        closeSync: () => {},
        execSync(sql) {
          const file = disk.get(name)!;
          if (file.key !== key) throw new Error('file is not a database');
          const attach =
            /ATTACH DATABASE '\/data\/SQLite\/([^']+)' AS encrypted KEY "x'([0-9a-f]+)'"/.exec(sql);
          if (attach) attached = { name: attach[1]!, key: attach[2]! };
          if (sql.includes('sqlcipher_export')) {
            if (failExport) throw new Error('disk full');
            disk.set(attached!.name, { key: attached!.key, rows: [...file.rows] });
            log.push(`export ${name} -> ${attached!.name}`);
          }
        },
      };
    },
  };
  return {
    files,
    disk,
    log,
    failExportOnce: () => {
      failExport = true;
    },
    allowExport: () => {
      failExport = false;
    },
  };
}

function keychain(initial: string | null = null): KeyStore & { value: string | null } {
  const store = {
    value: initial,
    get: () => store.value,
    set: (key: string) => {
      store.value = key;
    },
  };
  return store;
}

const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);

describe('opening the encrypted database (P5-03)', () => {
  it('creates a key and an encrypted database on a fresh install', () => {
    const d = fakeDisk();
    const keys = keychain();
    const { db, outcome } = openEncrypted(d.files, keys, () => KEY_A);

    expect(outcome).toBe('created');
    expect(keys.value).toBe(KEY_A);
    expect(db.name).toBe(ENCRYPTED_DB);
    expect(d.disk.get(ENCRYPTED_DB)?.key).toBe(KEY_A);
    expect(d.disk.has(PLAIN_DB)).toBe(false);
  });

  it('opens the existing database with the stored key', () => {
    const d = fakeDisk({ [ENCRYPTED_DB]: { key: KEY_A, rows: ['feed'] } });
    const { outcome } = openEncrypted(d.files, keychain(KEY_A), () => KEY_B);

    expect(outcome).toBe('opened');
    expect(d.disk.get(ENCRYPTED_DB)?.rows).toEqual(['feed']);
  });

  it('converts a plaintext database once, keeping every row, and removes the plaintext file', () => {
    const d = fakeDisk({ [PLAIN_DB]: { key: null, rows: ['feed', 'diaper'] } });
    const keys = keychain();
    const { outcome } = openEncrypted(d.files, keys, () => KEY_A);

    expect(outcome).toBe('converted');
    expect(d.disk.get(ENCRYPTED_DB)).toEqual({ key: KEY_A, rows: ['feed', 'diaper'] });
    expect(d.disk.has(PLAIN_DB)).toBe(false);
    expect(d.log).toEqual([`export ${PLAIN_DB} -> ${ENCRYPTED_DB}`, `remove ${PLAIN_DB}`]);

    // The next launch just opens it.
    expect(openEncrypted(d.files, keys, () => KEY_B).outcome).toBe('opened');
  });

  it('keeps the plaintext file when the export fails, and finishes on the next launch', () => {
    const d = fakeDisk({ [PLAIN_DB]: { key: null, rows: ['feed'] } });
    const keys = keychain();
    d.failExportOnce();
    expect(() => openEncrypted(d.files, keys, () => KEY_A)).toThrow('disk full');
    expect(d.disk.get(PLAIN_DB)?.rows).toEqual(['feed']);

    d.allowExport();
    // A partial encrypted file from the failed run is replaced, not trusted.
    d.disk.set(ENCRYPTED_DB, { key: KEY_A, rows: [] });
    const { outcome } = openEncrypted(d.files, keys, () => KEY_B);
    expect(outcome).toBe('converted');
    expect(d.disk.get(ENCRYPTED_DB)).toEqual({ key: KEY_A, rows: ['feed'] });
    expect(d.disk.has(PLAIN_DB)).toBe(false);
  });

  it('starts again when the key is gone, since the file can no longer be read', () => {
    const d = fakeDisk({ [ENCRYPTED_DB]: { key: KEY_A, rows: ['feed'] } });
    const keys = keychain(null);
    const { outcome } = openEncrypted(d.files, keys, () => KEY_B);

    expect(outcome).toBe('reset_unreadable');
    expect(keys.value).toBe(KEY_B);
    expect(d.disk.get(ENCRYPTED_DB)).toEqual({ key: KEY_B, rows: [] });
  });

  it('starts again when the stored key does not open the file', () => {
    const d = fakeDisk({ [ENCRYPTED_DB]: { key: KEY_A, rows: ['feed'] } });
    const { outcome } = openEncrypted(d.files, keychain(KEY_B), () => KEY_B);

    expect(outcome).toBe('reset_unreadable');
    expect(d.disk.get(ENCRYPTED_DB)).toEqual({ key: KEY_B, rows: [] });
  });

  it('refuses a key that is not 256 bits of hex', () => {
    expect(() => openEncrypted(fakeDisk().files, keychain(), () => 'short')).toThrow();
    expect(isRawKey(KEY_A)).toBe(true);
    expect(isRawKey(`${KEY_A}'; DROP TABLE events; --`)).toBe(false);
    expect(() => keyPragma('nope')).toThrow();
    expect(keyPragma(KEY_A)).toBe(`PRAGMA key = "x'${KEY_A}'";`);
  });
});
