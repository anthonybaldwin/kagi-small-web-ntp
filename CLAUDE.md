# CLAUDE.md

Guidance for AI coding agents (Claude Code and others) working in this repository.

## What this is

A Manifest V3 Chrome extension that replaces the new tab page with Kagi Small Web articles, Kagi News, or a custom URL. Plain JavaScript, no build step — the repo root loads directly via "Load unpacked". There is no bundler, no framework, and no `dist/` output; the `.js` files in the root are the shipped code.

## Commands

```sh
bun install          # dev dependencies only (@types/bun, @types/chrome, typescript)
bun test             # run test/ with bun:test
bun run typecheck    # tsc --noEmit (TypeScript 7, checkJs over JSDoc types)
```

Both `bun test` and `bun run typecheck` must pass before pushing — CI (`.github/workflows/ci.yml`) runs exactly these two steps on every PR and push to `main`.

## Architecture

| File | Runs where | Role |
|---|---|---|
| `background.js` | MV3 service worker | Feed fetching/caching, Atom parsing, per-tab header-strip rules, article history, bookmarks/reading-list/appreciate, context menus, Bing redirect rule, message hub |
| `main.js` | New tab page (`index.html`) | Reads settings, picks a mode (Small Web / Kagi News / custom URL), loads content in a sandboxed iframe or navigates directly, back-button restore logic, YouTube thumbnail card |
| `popup.js` / `popup.html` | Toolbar popup | All settings UI: mode toggles, category/feed/news pickers, History tab, article action icons |
| `block-focus.js` | Content script, MAIN world, `document_start` | Suppresses focus stealing so the omnibar keeps focus; relays link clicks / Escape to the NTP via `postMessage` for frame breakout |
| `load-fonts.js` / `fonts/` | Popup + NTP | Font loading driven by `fonts/font.config.json` |
| `test/` | bun:test | Unit tests for the parsing/URL helpers with a `chrome` API mock (`test/chrome-mock.js`) |

Communication is `chrome.runtime.sendMessage` with an `action` field; `background.js` has the single `onMessage` handler (actions: `loadFeedContent`, `loadCategoryFromFeed`, `prepareIframe`, `getArticleInfo`, `getHistory`, `clearHistory`, `bookmarkArticle`, `appreciatePost`, `searchDefault`, `restoreDefaultNTP`).

See `docs/architecture.md` for the full data flow and `docs/settings.md` for every storage key.

## Conventions

- **Types are JSDoc, checked by `tsc`.** `tsconfig.json` sets `checkJs` + `strict` + `noUncheckedIndexedAccess` under TypeScript 7. Type new code with `@param` / `@returns` / `@typedef` / inline `@type` casts, matching the existing style. Do not add `.ts` files or a build step. Note TS7 no longer auto-includes `node_modules/@types` — global type packages must be listed in `tsconfig.json` `"types"`.
- **No dependencies at runtime.** Only devDependencies. Don't introduce runtime npm packages; the extension ships as raw files.
- **Comment style:** comments explain constraints the code can't (security scoping, Chrome API quirks, sync requirements) — not what the next line does.

## Invariants to keep in sync

These are duplicated across files on purpose (the extension has no shared-module build); when you change one side, change the other:

- **News slugs:** `NEWS_SLUGS` in `main.js` must match `NEWS_CATEGORIES` in `popup.js`. Slugs are interpolated into `https://news.kagi.com/<slug>/latest`, so `main.js` whitelists them — never trust slugs read from synced storage.
- **Parser helpers:** `decodeXmlEntities`, `unwrapSmallwebUrl`, and `parseAtomEntries` in `test/background.test.js` mirror `background.js`. Update both when the parser changes.
- **Mode exclusivity:** exactly one of `smallWebEnabled` / `kagiNewsEnabled` / `redirectToEnabled` is on while `tabTakeoverEnabled` is on. `popup.js` enforces this; `main.js` checks `smallWebEnabled` first, then `kagiNewsEnabled`, then falls through to the custom URL.

## Security rules (do not weaken)

- Header stripping (`X-Frame-Options` / CSP) uses **session** rules scoped to `sub_frame` resources of one specific `tabId`, and is removed on tab close, navigation away, and frame breakout. Never register a global or `main_frame` header-stripping rule, and never leave kagi.com header modifications un-scoped.
- Frame-breakout `message` events are only accepted when `e.origin` equals the framed page's origin, and `kagi-navigate` URLs must match `/^https?:\/\//`. Keep both checks.
- `block-focus.js` must keep its top-origin guard (`ancestorOrigins` check) so it deactivates in frames not embedded by the extension's own NTP.
- Anything interpolated into URLs or inline styles from external data (news slugs, YouTube video IDs, feed URLs) gets validated first — see `youTubeVideoId` and the `NEWS_SLUGS` whitelist for the pattern.

## Docs to update with changes

- `README.md` — user-facing features, usage, security summary
- `docs/architecture.md` and `docs/settings.md` — internals, storage keys, message actions
- `manifest.json` `version` — bump for user-visible changes
