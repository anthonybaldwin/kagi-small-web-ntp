# Kagi Small Web NTP

A Chrome extension that replaces your new tab page with [Kagi Small Web](https://github.com/kagisearch/smallweb?tab=readme-ov-file#kagi-small-web), [Kagi News](https://news.kagi.com) (or both, pooled), or a custom URL (defaults to [Kagi](https://kagi.com)).

<!-- Update images -->
<!--
<img width="33%" src="https://github.com/user-attachments/assets/74e7b580-4ab8-4fcc-8911-288f6c15da4d" /> <img width="33%" src="https://github.com/user-attachments/assets/6d55a8e1-8d79-44af-8dfd-38111922fbf8" /> <img width="33%" src="https://github.com/user-attachments/assets/f4644c45-e79f-4b3e-adf3-74145e4a1594" />

  <details>
    <summary><h4>Quickly bookmark frame source while on <code>https://kagi.com/smallweb*</code> pages</h4></summary>
    <div>
      <h5>Star in pop-up</h5>
      <img width="238" height="59" alt="CleanShot 2026-03-10 at 19 32 43" src="https://github.com/user-attachments/assets/bacf4138-a639-45e4-906d-e71bdcdddeb4" />
     <h5>Context menu (right click on the page)</h5>
      <img width="250" height="27" alt="CleanShot 2026-03-10 at 19 31 33" src="https://github.com/user-attachments/assets/a824632a-5290-46dd-96c9-1ec166f02c5e" />
    </div>
  </details>
-->

## Features

- **New tab override** — replaces Chrome's new tab with Small Web articles, Kagi News, or a custom URL (below)
- **Small Web mode (Categories & Feeds)** — each new tab loads a random article from your selected categories and/or feeds
- **Kagi News mode** — each new tab opens the latest [Kagi News](https://news.kagi.com) for a random pick from your selected news categories (World, USA, Business, Technology, Science, Sports, Gaming, On This Day)
- **Pooled modes** — Small Web and Kagi News can be on together; every selected category, feed, and news category goes into one random pool
- **Redirect mode** — each new tab opens a custom URL of your choice (defaults to Kagi)
- **Category picker** — choose from 22 Small Web categories across Tech & Science, Culture & Creative, and Life & World
- **Feed support** — browse Small Web, Appreciated, Videos (YouTube), Code (GitHub), and Comics feeds from Kagi's public Atom endpoints
- **Focus blocking** — loads content in a sandboxed iframe to keep focus in the address bar; click any link or press Escape to break out to the real page
- **History tab** — the last 100 articles you've been shown, grouped by date, with bookmark / reading-list / appreciate actions on every row
- **Back-button history** — after breaking out of the frame, the browser Back button returns you to the same article (not a new random one)
- **Bookmark organization** — bookmarks are saved to `Small Web/cat/<category>` or `Small Web/feed/<feed>` subfolders
- **Reading list** — add articles to Chrome's built-in reading list from the popup or context menu
- **Appreciate** — send appreciation to Kagi Small Web authors directly from the popup or context menu
- **Context menu** — right-click to bookmark, add to reading list, or appreciate the current article

## Install

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder

## Usage

Click the extension icon in the toolbar to open the settings popup:

1. **Override New Tab** — master toggle for the extension
2. **Focus in address bar** — loads content in an iframe so you can immediately type a URL; click any link or press Escape to navigate directly to the page
3. Pick what new tabs open:
   - **Categories & Feeds** — Small Web mode; shows the Categories and Feeds tabs
   - **Kagi News** — shows the news category picker; each new tab opens `news.kagi.com/<category>/latest`
   - **Redirect to** — shows the custom URL field

   Categories & Feeds and Kagi News can both be on: each new tab draws one entry at random from every selected Small Web category, feed, and news category combined. Redirect to is exclusive — turning it on turns the other two off, and vice versa.

### Categories vs Feeds (Small Web mode)

- **Categories** load `kagi.com/smallweb?cat=<category>` which shows a random article from that category through Kagi's interface
- **Feeds** fetch from Kagi's Atom feed API (cached for 3 hours) and load the article directly in an iframe (with header stripping for framing compatibility)
- **Disable Kagi frame** — optional; loads category articles straight from the Small Web feed (filtered by category) instead of through the `kagi.com/smallweb` wrapper

When both categories and feeds are selected, each new tab randomly picks from the combined pool. YouTube videos from the Videos feed render as a thumbnail card with a play button (YouTube embeds don't work from extension pages); clicking play navigates to the real video.

### Popup Icons

When viewing a Small Web article or feed page, three action icons appear in the popup header:

- **Heart** — appreciate the article on Kagi Small Web
- **Star** — bookmark to your Small Web folder (organized by category/feed)
- **Book** — add to Chrome's reading list

### History

The **History** tab in the popup lists the last 100 articles you've been shown, grouped by date labels (Today, Yesterday, …). Each row has the same star / book / heart actions, and a **Clear** button wipes the list.

### Keyboard

- **Escape** — break out of the iframe and navigate directly to the page (restores full cookie/auth access)

### Hidden: Bing redirect

An optional toggle redirects Bing/Cortana searches (any `bing.com` URL with a `q=` parameter) to your default search engine. It's hidden by default; to show it, open the popup, inspect it (right-click → Inspect), and in the devtools console run:

```js
localStorage.setItem('show-redirect-bing', 'true')
```

## Security

- Feed pages are loaded in sandboxed iframes that cannot navigate your browser on their own
- Header modifications (`X-Frame-Options`/CSP stripping) are session rules scoped to sub-frames of the specific new tab — including for kagi.com — and are cleaned up when you break out of the frame, navigate away, or close the tab; no site's framing protections are weakened for requests made by ordinary web pages
- Frame break-out messages are only accepted from the framed page's own origin, so nested third-party frames cannot navigate the tab
- The focus-blocking helper script deactivates itself in frames that are not embedded by the extension's new tab page
- News category slugs read from synced storage are validated against a known-slug whitelist before being interpolated into URLs
- Clicking any link or pressing Escape breaks out of the iframe, restoring full browser functionality

## Development

The extension is plain JavaScript (no build step — the folder loads unpacked as-is), typed via JSDoc comments and checked with TypeScript 7's `checkJs`. [Bun](https://bun.sh) runs the tests.

```sh
bun install          # install dev dependencies
bun test             # run the test suite (test/)
bun run typecheck    # tsc --noEmit over the JSDoc-typed sources
```

CI (GitHub Actions) runs the typecheck and tests on every push to `main` and every pull request. Dependabot keeps npm dev dependencies and GitHub Actions up to date weekly.

See [`docs/architecture.md`](docs/architecture.md) for how the pieces fit together and [`docs/settings.md`](docs/settings.md) for every storage key and hidden setting. Guidance for AI coding agents lives in [`CLAUDE.md`](CLAUDE.md).

## Fonts

This extension ships with [Pixelify Sans](https://github.com/nicholasglazer/pixelify-sans) (SIL Open Font License), a retro pixel font.

To swap fonts, drop font files into `fonts/` and edit `fonts/font.config.json`. Variable fonts (single file, weight range) and static fonts (one file per weight) are both supported:

```json
// Variable font
{
    "family": "Pixelify Sans",
    "file": "PixelifySans-Variable.ttf",
    "variable": true
}

// Static fonts
{
    "family": "Lufga",
    "prefix": "Lufga"
}
```

Static font files should be named `{prefix}-{Weight}.ttf` (e.g. `Lufga-Regular.ttf`, `Lufga-Bold.ttf`). Weights are detected automatically.

## Attributions & Trademarks

- **Kagi** — This extension uses the [Kagi Small Web](https://kagi.com/smallweb) API and links to [Kagi News](https://news.kagi.com). Kagi logos, Small Web badges, and the "Use Kagi" GIF (`icons/`) are property of [Kagi Inc.](https://kagi.com) This extension is not affiliated with or endorsed by Kagi Inc.
- **Microsoft** — "Bing" and "Cortana" are trademarks of Microsoft Corporation. This extension is not affiliated with or endorsed by Microsoft.
- **Pixelify Sans** — bundled font licensed under the [SIL Open Font License 1.1](fonts/OFL.txt). See [nicholasglazer/pixelify-sans](https://github.com/nicholasglazer/pixelify-sans).
