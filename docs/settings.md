# Settings & storage reference

Every setting the extension stores, where it lives, and what reads it.

## `chrome.storage.sync` (synced across browsers)

| Key | Type | Default | Meaning |
|---|---|---|---|
| `tabTakeoverEnabled` | boolean | `true` | Master switch. Off = new tabs go to Chrome's default NTP (and the toolbar icon grays out). |
| `blockFocusEnabled` | boolean | `true` | Focus blocking: load content in a sandboxed iframe so the address bar keeps focus. Off = navigate the tab directly. |
| `smallWebEnabled` | boolean | `false` | Small Web mode (Categories & Feeds). Mutually exclusive with `kagiNewsEnabled` and `redirectToEnabled`. |
| `kagiNewsEnabled` | boolean | `false` | Kagi News mode: new tabs open `news.kagi.com/<slug>/latest`. Mutually exclusive with the other two modes. |
| `redirectToEnabled` | boolean | `false` | Redirect mode: new tabs open `customUrl`. Mutually exclusive with the other two modes. |
| `directMode` | boolean | `false` | "Disable Kagi frame": load category articles straight from the Small Web feed (filtered by category) instead of the `kagi.com/smallweb` wrapper. Only meaningful in Small Web mode. |
| `selectedCategories` | string[] | all 22 | Small Web categories in the random pool (`ai`, `science`, `programming`, `diy`, `tech`, `hardware`, `infra`, `web`, `health`, `art`, `essays`, `humanities`, `retro`, `photography`, `culture`, `gaming`, `society`, `life`, `food`, `travel`, `politics`, `economy`). |
| `selectedFeeds` | string[] | all 5 | Feeds in the random pool: `blogs`, `appreciated`, `youtube`, `github`, `comics`. |
| `kagiNewsCategories` | string[] | `['world']` when empty | News slugs in the random pool: `world`, `usa`, `business`, `tech`, `science`, `sports`, `gaming`, `onthisday`. Validated against this whitelist in `main.js` before use — unknown values from other extension versions are ignored. |
| `customUrl` | string | `''` (→ `https://kagi.com`) | URL opened in Redirect mode. The popup auto-prefixes `https://` on blur. |
| `bingRedirectEnabled` | boolean | `false` | Redirect Bing/Cortana searches to the default search engine (see hidden settings below). |

The popup enforces that exactly one of `smallWebEnabled` / `kagiNewsEnabled` / `redirectToEnabled` is on while the master toggle is on.

## `chrome.storage.local` (this machine only)

| Key | Type | Meaning |
|---|---|---|
| `feedData` | `Record<feed, {entries, fetchedAt}>` | Parsed Atom feed cache, refreshed at most every 3 hours per feed. Stale cache is served if a refresh fails. |
| `articleHistory` | `Array<{url, title, source, timestamp}>` | The History tab's data: last 100 articles shown, newest first, consecutive duplicates skipped. Cleared via the popup's Clear button. |

## `chrome.storage.session` (cleared when the browser closes)

| Key | Type | Meaning |
|---|---|---|
| `articleUrl_<tabId>` | `{url, title, source}` | What article a tab is showing. Drives the popup's action icons, the context menu, and back-button restore. Removed on tab close/cleanup. |

`source` is `cat/<category>` or `feed/<feed>` and determines the bookmark subfolder (`Small Web/cat/ai`, `Small Web/feed/github`, …).

## Hidden settings (popup `localStorage`)

Open the popup, right-click → Inspect, and run in the devtools console:

| Key | Effect |
|---|---|
| `localStorage.setItem('show-redirect-bing', 'true')` | Shows the "Redirect Bing" toggle in the popup footer. |
| `localStorage.setItem('redirect-bing', 'true')` | Turns the Bing redirect on directly (works even while the toggle is hidden). Mirrored to/from `bingRedirectEnabled` in synced storage. |

When enabled, a dynamic declarativeNetRequest rule (ID 9999) redirects any `bing.com` main-frame request with a `q=` parameter to the extension's NTP, which forwards the query to your default search engine via `chrome.search.query`.

## Message actions (`chrome.runtime.sendMessage`)

`background.js` is the single message hub. Actions:

| Action | Sender | Purpose |
|---|---|---|
| `loadFeedContent` | NTP | Random entry from a feed: caches article info, prepares the iframe (or flags YouTube for the thumbnail card), returns `{url, title, youtube, videoId}`. |
| `loadCategoryFromFeed` | NTP | Direct-mode category pick from the cached blogs feed. |
| `prepareIframe` | NTP | Install the per-tab header-strip rule + focus script for an arbitrary URL. |
| `getArticleInfo` | popup/NTP | Read `articleUrl_<tabId>`. |
| `getHistory` / `clearHistory` | popup | Read / wipe `articleHistory`. |
| `bookmarkArticle` | popup | Bookmark into the `Small Web/<source>` folder. |
| `appreciatePost` | popup | POST appreciation to `kagi.com/smallweb/favorite`. |
| `searchDefault` | NTP | Forward a Bing-redirect query to the default search engine. |
| `restoreDefaultNTP` | NTP | Send the tab to `chrome://new-tab-page` when the master toggle is off. |
