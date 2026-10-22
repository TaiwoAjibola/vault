# Browser extension

Keyhold ships as a Manifest V3 extension for Chrome and Edge. It shares the
vault format with the web app but has its own sign-in, unlock, and lock state.

## Build

```bash
cp extension/.env.example extension/.env
# SUPABASE_URL, SUPABASE_ANON_KEY, KEYHOLD_APP_URL
npm run extension:build
```

The build writes `extension/dist/` with:

- `manifest.json` (host permissions filled in from the Supabase and app URLs)
- `background.js` — service worker
- `content.js` / `content.css` — in-page panel
- `popup.html`, `popup.js`, `popup.css`
- `unlock.html`, `unlock.js`, `unlock.css`
- generated icons

`npm run extension:watch` rebuilds the JS on change. Reload the extension from
`chrome://extensions` after each build.

## Load

1. Open `chrome://extensions` or `edge://extensions`.
2. Turn on Developer mode.
3. **Load unpacked** → choose `extension/dist`.

Pin Keyhold to the toolbar. The popup is the only surface that can enable a site
or perform a manual save.

## Use

1. Open the popup and sign in with the Keyhold account email and password.
2. Unlock with the vault master password. The unlock lasts 10 minutes.
3. On the current site, choose **Enable**. Chrome asks for access to that
   origin only. The page gets the Keyhold badge and login form detection.
4. Open the popup on a site with saved logins, then **Fill** or **Copy**.
   The in-page badge also lists matching logins when the vault is unlocked.
5. To save a new login, use **Save a login manually** in the popup, or sign in
   normally and accept Keyhold's **Save this login?** prompt after the page
   changes.
6. **Turn off** removes the site registration and requests removal of the origin
   permission. **Never ask to save on this site** keeps the badge but suppresses
   save prompts.

The in-page badge opens a panel with matching logins, a save prompt when one is
pending, the current lock state, and a link to the web vault. On a locked vault
it offers **Unlock Keyhold**, which opens the extension unlock page in a tab.

## What gets injected

No content script is declared in the static manifest. A site is registered only
after an explicit permission grant:

```text
chrome.permissions.request({ origins: ["https://site.example/*"] })
chrome.scripting.registerContentScripts({
  matches: ["https://site.example/*"],
  js: ["content.js"],
  css: ["content.css"]
})
```

The background script re-registers saved sites on startup and removes
registrations whose permission was revoked or that are no longer in the saved
site list. Only the top frame is used.

## Login detection and prompts

The content script looks for a visible form with exactly one password field and
a nearby username/email field. Submitting the form (or pressing Enter) reports
the candidate to the service worker. The worker waits for the page to navigate
or the password field to disappear before creating a prompt. A visible error
alert cancels the candidate.

- Signup forms (two password fields or new-account copy) are ignored.
- If an account already exists for the same origin and username, the prompt
  becomes **Update saved login?**.
- Prompts and captured candidates are held in service-worker memory and expire
  after five minutes. Locking or signing out clears them.
- Passwords are never written to `storage.local` and no prompt is queued in
  persistent storage.
- Save prompts are heuristic. Confirm the site and username before saving.

## Popup states

| State | What you can do |
| --- | --- |
| Signed out | Sign in with the account password |
| Locked | Unlock with the master password; open the web vault |
| Unlocked, site off | Enable the origin; manual save |
| Unlocked, site on | Fill, copy, manual save, never-ask, turn off |
| No website tab | Open the web vault; popup still shows lock state |

Clipboard copy writes the secret from the popup and tries to clear it after 30
seconds while the popup remains alive. Other clipboard managers may retain it.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Session state, per-site registrations, never-ask list |
| `activeTab` | Read the active tab URL after you click the toolbar button |
| `scripting` | Register/execute the content script on enabled origins |
| `clipboardWrite` | Copy passwords from the popup |
| Optional host permissions | Per-origin access, requested only when you enable a site |
| Supabase/app host permissions | Auth and vault REST calls; baked in at build time |

There is no `tabs`, `history`, `cookies`, or `<all_urls>` static access. Optional
host patterns are requested one origin at a time.

## Session and lock behavior

- Supabase access/refresh tokens and the DEK live in `chrome.storage.session`
  with `TRUSTED_CONTEXTS` access. Content scripts cannot read them.
- The unlock deadline is absolute: 10 minutes after unlock. Every background
  operation checks it and clears the cache when it has passed.
- Signing in again clears any previous vault cache before starting the session.
- Closing the browser clears session storage. Locking clears the in-memory
  credential cache and notifies open tabs.

## Troubleshooting

**The badge does not appear**

- Confirm the popup shows the site as enabled and the vault is unlocked.
- Reload the page after enabling the first time.
- Check `chrome://extensions` → Keyhold → Errors for content-script errors.

**Fill says to reload the page**

The tab may have been open before the extension was enabled or updated. Reload,
then try again.

**The extension cannot reach Supabase**

Rebuild with the same `SUPABASE_URL` used by the web app. The host permission is
generated during the build; changing the URL requires a rebuild and reload.

**The unlock page says the vault is locked again**

Unlocks expire after 10 minutes. Reopen the popup and unlock again; the pending
save prompt is cleared when the vault locks.

**Site access disappeared**

The origin permission may have been removed in browser settings. Enable the site
again from the popup.

## Automated coverage

`npm run test:e2e` exercises the extension end to end in Chromium: it stands up an
in-memory Supabase (`tests/e2e/mock-supabase.mjs`) and a demo login page, builds a
throwaway bundle against them, and then verifies sign-in, vault unlock, site
activation, content-script injection, the save prompt, sealed credential storage,
origin matching, credential fill, retrieval auditing, and locking.

The test bundle opens the content script's shadow root so assertions can reach the
panel; the shipped bundle keeps it closed.

### Against a live project

`npm run test:e2e:live` runs the same journey against a real Supabase project and
a real account, and additionally verifies server-side state with `psql`: the
credential row exists, the stored payload is ciphertext rather than plaintext,
`last_retrieved_at` was written, and audit events exist.

```bash
export KEYHOLD_LIVE_SUPABASE_URL="https://<project-ref>.supabase.co"
export KEYHOLD_LIVE_ANON_KEY="<publishable key>"
export KEYHOLD_LIVE_DB_ENV=/path/to/db.env   # optional, enables the psql checks
export QA_EMAIL="you@example.com"
export QA_PASSWORD="<account password>"
export QA_MASTER="<vault master password>"
npm run test:e2e:live
```

The account needs a vault already (create it in the web app first). The live
suite writes real rows: delete the test credential afterwards.
