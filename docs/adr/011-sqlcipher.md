# ADR-011: Encrypt the local database with SQLCipher

Status: accepted (2026-10-05, P5-03). Decided by the account owner: "evaluate
and implement".

## Context

The phone's SQLite database is the source of truth for the UI (rule 1) and
holds the household's full history: feeds, temperatures, medications and free
text, all Article 9 health data about a child. The DPIA (R2) named a lost or
stolen phone as the largest residual risk. The platform's file encryption
protects a locked phone, but not a phone with no passcode, an unlocked phone,
a device backup, or a forensic copy taken after unlock.

## Options

| Option                           | What it protects                                                                                    | Cost                                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Platform encryption only         | A locked phone with a passcode                                                                      | Nothing. It was the POC choice                                                                                                       |
| Encrypt sensitive columns in JS  | The columns chosen                                                                                  | Every query on those columns breaks (no `WHERE` and no index on ciphertext). Slow, and easy to miss a column                         |
| **SQLCipher** (expo-sqlite flag) | The whole file: tables, indexes, the outbox and refused ops. The file is ciphertext without its key | One config flag and a key in the keychain. About 5–15% slower on I/O, which a few thousand rows won't show. Needs one native rebuild |

## Decision

SQLCipher, through expo-sqlite's own `useSQLCipher` config plugin option. Nothing
is vendored and no new native module is needed.

- **The key:** 32 bytes from the OS secure random source (`expo-crypto`), kept
  as 64 hex characters in SecureStore under `moraki.db.key`. The accessibility
  is `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`: readable after the first unlock so
  background work can open the database, and never copied off the device by
  iCloud Keychain or a backup. The key is passed raw (`PRAGMA key =
"x'…'"`), so no passphrase derivation runs on each open.
- **The file:** a new name, `moraki-encrypted.db`. A database from before P5-03
  (`moraki.db`, plaintext) is converted once on first launch with
  `sqlcipher_export`, and the plaintext file is deleted only after the export
  finishes. If the app dies part way, both files exist on the next launch, so
  the encrypted one is discarded and the export runs again
  (`src/db/encryption.ts`, tested in `encryption.test.ts`).
- **A lost key:** a phone restored from a backup to a new device brings the
  file but not the key, which is the point of `THIS_DEVICE_ONLY`. The file can't
  be read, so it is deleted and a new database started. A signed-in phone pulls
  its household again. Entries that were never sent are lost. That is the price
  of a file nobody can read without the key, and it only affects entries made
  offline and never synced.
- **Web preview** keeps its in-memory sql.js stand-in (`client.web.ts`). Nothing
  is stored there.

## Consequences

- DPIA R2's residual risk drops from Medium to Low. What remains: an unlocked
  phone in someone else's hands shows the app as the parent sees it, and a
  removed caregiver keeps the copy on their own phone. No encryption can change
  either of those.
- Export compliance: SQLCipher uses AES-256 only to protect the user's own data
  on the device. Under Apple's export rules that use is exempt, so `app.json`
  keeps `ITSAppUsesNonExemptEncryption: false`. **The owner should confirm this
  reading** when answering the export compliance question in App Store
  Connect. If in doubt, answer "uses exempt encryption", not "none".
- The jest suite runs on sql.js and cannot exercise SQLCipher itself. The first
  real check is on a phone: install over an existing plaintext build and
  confirm the history survives; then do a fresh install; then delete the key
  (a reinstall does it) and confirm the app starts clean. That is P5-03's device
  check on the Waiting on device list.

Revisit when: expo-sqlite drops the SQLCipher option, or a performance profile
on the Android test phone shows SQLCipher costing more than a frame on the
history screen (P1-11's 60fps check).
