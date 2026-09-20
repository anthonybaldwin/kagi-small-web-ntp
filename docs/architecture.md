# Architecture

How the extension's pieces fit together. The extension is plain JavaScript with no build step — every file listed here ships as-is.

## Components

```
┌────────────────────┐   chrome.runtime.sendMessage   ┌─────────────────────┐
│ index.html/main.js │ ─────────────────────────────▶ │   background.js     │
│  (new tab page)    │ ◀───────────────────────────── │  (service worker)   │
└─────────┬──────────┘         sendResponse           └──────────┬──────────┘
          │ <iframe sandbox>                                     │ fetch / cache
          ▼                                                      ▼
┌────────────────────┐   postMessage('kagi-navigate') ┌─────────────────────┐
│  framed article    │ ─────────────────────────────▶ │  Kagi Atom feeds /  │
│  + block-focus.js  │        (frame breakout)        │  kagi.com/smallweb  │
└────────────────────┘                                └─────────────────────┘
```

- **`background.js`** — the MV3 service worker. Owns everything stateful: feed fetching and caching, Atom parsing, per-tab declarativeNetRequest rules, article info/history, bookmarks, reading list, appreciate, context menus, and the Bing redirect rule.
- **`main.js`** — the new tab page script. Reads settings, decides what to load, and either embeds it in a sandboxed iframe (focus blocking on) or navigates directly (focus blocking off).
- **`popup.js` / `popup.html`** — the toolbar popup. All settings UI plus the Categories / Feeds / History tabs and the per-article action icons (appreciate, bookmark, reading list).
- **`block-focus.js`** — a content script injected at `document_start` into the MAIN world of framed pages (and kagi.com statically). Blocks focus stealing for 2 seconds, strips `autofocus`, and relays link clicks / Escape presses to the NTP page for frame breakout.
- **`load-fonts.js`** — builds `@font-face` rules from `fonts/font.config.json` (variable and static fonts).

## New tab flow

1. `main.js` handles special query params first: `?restore=` (back-navigation to a previous article), `?q=` (Bing redirect → `chrome.search.query` against the default engine).
2. Otherwise it reads settings from `chrome.storage.sync` and builds one random pool (`buildPool`) from every enabled mode, then picks one entry:
   - **Small Web mode** (`smallWebEnabled`): contributes one entry per `selectedCategories` + `selectedFeeds` value (or a single "random Small Web" entry when both are empty).
     - *Category, default:* loads `kagi.com/smallweb?cat=<category>` (Kagi's own random-article frame).
     - *Category, direct mode* (`directMode`): asks the worker for a random entry from the cached Small Web feed filtered by that category, skipping the Kagi wrapper.
     - *Feed:* asks the worker for a random entry from that feed's cache (`loadFeedContent`). YouTube entries render as a local thumbnail card (embeds are blocked from `chrome-extension://` origins) — the video ID is whitelist-validated before it's interpolated anywhere.
   - **Kagi News mode** (`kagiNewsEnabled`): contributes one entry per slug in `kagiNewsCategories`, validated against a hardcoded whitelist (synced storage may hold values written by other extension versions). A news pick loads `https://news.kagi.com/<slug>/latest`.
   - **Custom URL** (`redirectToEnabled`, i.e. the pool is empty): loads `customUrl`, defaulting to `https://kagi.com`.
3. With focus blocking on, the page is embedded in `<iframe sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox">`. The sandbox deliberately omits `allow-top-navigation` — breakout only happens through the extension's own message handler.

## Iframe preparation and header stripping

Most sites send `X-Frame-Options` / CSP headers that block framing. Before the iframe loads, `background.js` (`prepareIframe`) installs a **session** declarativeNetRequest rule that:

- uses the **tab ID as the rule ID** (one rule per tab, no collisions, no bookkeeping maps),
- matches only `sub_frame` resources of that one tab for the article's hostname,
- removes `X-Frame-Options` and replaces CSP (kagi.com gets a stricter replacement than third-party articles).

It also registers a per-tab `block-focus.js` content script for the article's origin (skipped for kagi.com, which is covered by a static registration, and for XML/RSS URLs, where injection would destroy the browser's native XML rendering).

Everything is cleaned up (`cleanupTab`) when the tab closes, navigates away, or breaks out of the frame — so no site's framing protections are weakened for ordinary browsing.

## Frame breakout

Inside a frame, `block-focus.js` intercepts link clicks and the Escape key and posts `{type: 'kagi-navigate', url}` to the top window. `main.js` accepts the message **only if `e.origin` matches the framed page's origin** (a nested third-party frame cannot navigate the tab), pushes a `?restore=` history entry so Back returns to the same article, and navigates the whole tab to the URL — restoring full cookie/auth context.

## Article info and history

Whenever a new article is shown, the worker records `{url, title, source}`:

- **Per-tab** in `chrome.storage.session` (`articleUrl_<tabId>`) — survives service-worker restarts; drives the popup's action icons and the right-click context menu.
- **Persistent history** in `chrome.storage.local` (`articleHistory`) — capped at 100 entries, consecutive duplicates skipped, rendered by the popup's History tab grouped by date.

For category pages (which load through Kagi's `smallweb` frame), the worker discovers the actual article by walking the tab's frames on `webNavigation.onCompleted` and reading the inner frame's `document.title`.

## Feed caching

Feed endpoints (Small Web blogs, YouTube, GitHub, comics, appreciated) are fetched at most once per 3 hours per feed, cached in `chrome.storage.local` (`feedData`), and served randomly from cache. Entries wrapping their real URL as `kagi.com/smallweb?url=…` are unwrapped at parse time. The Atom parser is regex-based (no DOM in service workers) with single-pass XML entity decoding.

## Bing redirect

An optional dynamic declarativeNetRequest rule (ID 9999) redirects any `bing.com` main-frame URL carrying a `q=` parameter to the extension's own `index.html?q=<query>`, which forwards the query to the browser's default search engine via `chrome.search.query`. Hidden behind a devtools flag — see [settings.md](settings.md).

## Testing and CI

- `test/background.test.js` unit-tests the parsing/URL helpers (`decodeXmlEntities`, `unwrapSmallwebUrl`, `parseAtomEntries`, `youTubeVideoId`, …) against `test/chrome-mock.js`. The helpers are mirrored from `background.js` — keep them in sync when the parser changes.
- Typechecking is TypeScript 7 `tsc --noEmit` with `checkJs`: the codebase is typed entirely through JSDoc comments.
- `.github/workflows/ci.yml` runs `bun run typecheck` + `bun test` on pushes to `main` and all PRs; `.github/dependabot.yml` updates dev dependencies and Actions weekly.
