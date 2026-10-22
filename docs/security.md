# Security model

Keyhold encrypts secrets before they leave the browser. This document describes
what that does and does not protect against. It is not a formal audit.

## Assets

- Master password and account password.
- The random 256-bit vault data encryption key (DEK).
- Credential fields: application name, website URL, username, password, notes.
- Recovery key.
- Metadata: account email, record counts, timestamps, audit event types.

## Key hierarchy and formats

- **Credential encryption:** AES-256-GCM, random 96-bit IV per record.
- **Key derivation:** PBKDF2-SHA-256, 600,000 iterations, random 16-byte salt.
- **Data key:** 32 random bytes from `crypto.getRandomValues`.
- **Master wrap:** KEK derived from the master password encrypts the DEK; salt and
  iteration count are stored with the vault.
- **Recovery wrap:** a 20-byte random recovery key, Crockford-base32 encoded as
  32 characters in eight groups of four, derives a second KEK that wraps the
  same DEK. Input is canonicalized (case, separators, `O`→`0`, `I`/`L`→`1`).
- **Additional authenticated data:** every ciphertext is bound to
  `keyhold:v1:vault:<userId>`, `keyhold:v1:recovery:<userId>`, or
  `keyhold:v1:credential:<userId>:<credentialId>`. A row copied to another
  account or id fails authentication.
- **Plaintext payload:** a JSON object with the five credential fields is
  encrypted as one blob. The database indexes only ownership and timestamps.
- **Rotation:** changing the master password re-wraps the same DEK. Resetting
  with the recovery key also rotates the recovery key. The old master password
  and old recovery key stop working after the update.

The account password authenticates to Supabase. It does not derive any vault
key. Changing it does not change the master password.

## Where keys live

- **Web app:** the DEK is a `CryptoKey` in a React ref. Reloading or locking
  clears it. The auto-lock interval is configurable (1/5/10/30 minutes) and is
  stored in `localStorage`; the key itself is not persisted.
- **Extension service worker:** the DEK is held in memory and in
  `chrome.storage.session`, which is memory-backed, cleared on browser restart,
  and restricted to trusted extension contexts with `setAccessLevel`. A stored
  deadline enforces a 10-minute unlock window.
- **Content script:** never receives the DEK. It receives individual decrypted
  credentials only for a fill it requested from the popup, or a save prompt that
  contains the username and a masked password preview.
- **Unlock page:** sends the master password to the extension service worker,
  which derives the KEK locally. It is not sent to Supabase.

## Server-side controls

- Row-level security is enabled on `vaults`, `credentials`, and `vault_events`.
- Every policy compares `auth.uid()` to `user_id`; there is no service-role
  client in the web app or extension.
- A `security definer` guard verifies that a credential's `vault_id` belongs to
  the same `user_id`, and rejects ownership changes.
- Audit events are written by triggers. Direct inserts, updates, and deletes on
  `vault_events` are revoked from `authenticated`; only select is granted.
- `mark_credential_retrieved` updates only the caller's credential and writes a
  `retrieved` event.
- `delete_vault_data` deletes the caller's credentials, their generated audit
  rows, and the vault. Deleting a vault directly also cascades credentials, but
  audit rows are intentionally not linked by a foreign key.
- Ciphertext/IV length and KDF iteration bounds are enforced with checks.
- Deleting an account cascades to the vault, its credentials, and its audit
  rows. The audit trigger skips writing events for an account that is already
  gone, so the cascade never trips the `vault_events` foreign key.

Supabase still sees account email, record counts, row sizes, IP addresses, and
timing. Encrypted payloads can reveal approximate size. This is not a
zero-knowledge hosting claim.

### Accepted advisor findings

`supabase db advisors` reports two `authenticated_security_definer_function_executable`
findings for `public.delete_vault_data()` and `public.mark_credential_retrieved()`.
Both are accepted by design: they are meant to be callable by signed-in users,
they are granted to `authenticated` only, and each one re-checks
`auth.uid()` against the row it touches before doing any work. Neither reads
ciphertext, decrypts anything, or bypasses a policy. The functions were verified
against the live project, including a cross-user call, which was rejected.

No performance advisor findings are outstanding.

## Browser controls

- The web app sends a restrictive CSP and standard security headers
  (`X-Frame-Options: DENY`, `nosniff`, strict referrer policy, HSTS).
- The extension has a single-purpose MV3 service worker, no remote code, and no
  `eval`. Extension pages use `script-src 'self'`.
- The in-page panel is rendered in a closed shadow root with constructed styles,
  so page CSS and scripts cannot read or restyle it.
- Sites are enabled one origin at a time through `chrome.permissions.request`.
  There is no content script on sites the user has not enabled.
- Autofill matches the saved URL against the current origin using strict rules:
  exact scheme/host/port, plus a same-protocol `www.` ↔ bare-host redirect.
  Subdomains, lookalikes, protocol changes, and port changes do not match.
- Login capture only runs after a submit/continue action on a form with a single
  visible password field. Signup forms are excluded. A save prompt is only
  created after a navigation away or the password form disappearing, and is
  held for at most five minutes.
- “Never ask on this site” is stored locally per origin and stops capture
  before a candidate is retained.
- Saved passwords are revealed/copied only on explicit action. Clipboard copy
  attempts to clear after 30 seconds when the page is still open.

## Threats considered

| Threat | Mitigation | Residual risk |
| --- | --- | --- |
| Database dump or malicious server | Ciphertext only; keys derived client-side | Metadata, traffic analysis, future crypto breaks |
| Cross-account row access | RLS + ownership guard + AAD binding | A database owner can still deny service |
| Database tampering | AES-GCM authentication; AAD binds records | Rollback/replay of old ciphertext is not detected |
| Stolen master password | Recovery key separate; no server reset | Attacker with password can unlock |
| Stolen recovery key | Rotatable after use, but the key alone unlocks the vault | Treat the recovery key with the same care as the master password |
| XSS on the web app | CSP, React escaping, no `dangerouslySetInnerHTML` of user content | Same-origin XSS can read the DEK from memory |
| Malicious page | Isolated content script, closed shadow root, origin checks | A compromised browser or extension can read everything |
| Shoulder surfing / clipboard | Masked by default, explicit reveal/copy | Clipboard managers and other apps can observe |
| Phishing lookalike | Strict origin matching | User can still type credentials into a phishing form |
| Lost master + recovery key | None | Permanent data loss by design |

## Out of scope

- A compromised operating system, browser, extension, or password manager.
- Keyloggers, screen capture, memory scraping, or malicious accessibility tools.
- Server-side rollback attacks. Ciphertext is authenticated but the client does
  not pin record versions.
- Cross-origin iframes, service workers, native apps, and non-Chromium browsers.
- Multi-user sharing, team vaults, and account recovery by an administrator.
- MFA, passkeys, TOTP storage, breach monitoring, and import/export.

## Reporting

Do not open a public issue for a suspected vulnerability. Contact the project
owner privately with reproduction steps and affected versions.
