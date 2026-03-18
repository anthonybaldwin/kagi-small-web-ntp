# Kagi Small Web NTP

A Chrome extension that replaces your new tab page with [Kagi Small Web](https://github.com/kagisearch/smallweb?tab=readme-ov-file#kagi-small-web) or a custom URL (defaults to [Kagi](https://kagi.com)).

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

- **New tab override** — opens Kagi Small Web or Kagi every time you open a new tab
- **Small Web mode** — when enabled, each new tab loads a random article from your selected categories and/or feeds
- **Category picker** — choose from 22 categories across Tech & Science, Culture & Creative, and Life & World
- **Feed support** — browse Small Web, Appreciated, Videos (YouTube), Code (GitHub), and Comics feeds from Kagi's public Atom endpoints
- **Focus blocking** — loads content in a sandboxed iframe to keep focus in the address bar; click any link or press Escape to break out to the real page
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

1. **Override New Tab page** — master toggle for the extension
2. **Keep focus in address bar** — loads content in an iframe so you can immediately type a URL; click any link or press Escape to navigate directly to the page
3. **Open Small Web on New Tab** — when enabled, shows the Categories and Feeds tabs

### Categories vs Feeds

- **Categories** load `kagi.com/smallweb?cat=<category>` which shows a random article from that category through Kagi's interface
- **Feeds** fetch from Kagi's Atom feed API and load the article directly in an iframe (with header stripping for framing compatibility)

When both are selected, each new tab randomly picks from the combined pool.

### Popup Icons

When viewing a Small Web article or feed page, three action icons appear in the popup header:

- **Heart** — appreciate the article on Kagi Small Web
- **Star** — bookmark to your Small Web folder (organized by category/feed)
- **Book** — add to Chrome's reading list

### Keyboard

- **Escape** — break out of the iframe and navigate directly to the page (restores full cookie/auth access)

## Security

- Feed pages are loaded in sandboxed iframes that cannot navigate your browser
- Header modifications are scoped to the specific new tab and cleaned up when you navigate away or close the tab
- Clicking any link breaks out of the iframe, restoring full browser functionality

## Fonts

This extension ships with [Plus Jakarta Sans](https://github.com/tokotype/PlusJakartaSans) (SIL Open Font License). Kagi uses [Lufga](https://ladd-design.com/family/lufga/), which requires a license.

To swap fonts, drop `.ttf` files into `fonts/` and edit `fonts/font.config.json`:

```json
{
    "family": "Lufga",
    "prefix": "Lufga"
}
```

Font files should be named `{prefix}-{Weight}.ttf` (e.g. `Lufga-Regular.ttf`, `Lufga-Bold.ttf`). Weights are detected automatically.

## Attributions & Trademarks

- **Kagi** — This extension uses the [Kagi Small Web](https://kagi.com/smallweb) API. Kagi logos, Small Web badges, and the "Use Kagi" GIF (`icons/`) are property of [Kagi Inc.](https://kagi.com) This extension is not affiliated with or endorsed by Kagi Inc.
- **Microsoft** — "Bing" and "Cortana" are trademarks of Microsoft Corporation. This extension is not affiliated with or endorsed by Microsoft.
- **Plus Jakarta Sans** — bundled font licensed under the [SIL Open Font License 1.1](fonts/OFL.txt). See [tokotype/PlusJakartaSans](https://github.com/tokotype/PlusJakartaSans).
