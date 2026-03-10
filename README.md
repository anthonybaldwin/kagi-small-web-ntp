# Kagi Small Web NTP

A Chrome extension that replaces your new tab page with Kagi Small Web (`https://kagi.com/smallweb`) or custom URL (defaults to [Kagi](https://kagi.com)). More [here](https://github.com/kagisearch/smallweb?tab=readme-ov-file#kagi-small-web).

<!-- img -->     <!-- img -->     <!-- img -->

  <details>
    <summary><h4>Bookmark while on <code>https://kagi.com/smallweb*</code> pages</h4></summary>
    <div>
      <h5>Pop-up</h5>
           <!-- img -->
     <h5>Context menu (right click)</h5>
     <!-- img -->
    </div>
  </details>

## Features

- **New tab override** — opens Kagi Small Web or Kagi every time you open a new tab
- **Small Web mode** — when enabled, each new tab loads a random article from your selected categories
- **Category picker** — choose from 22 categories across Tech & Science, Culture & Creative, and Life & World
- **Right-click toggle** — quickly enable/disable Small Web mode from the context menu

## Install

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder

## Usage

Click the extension icon in the toolbar to open the settings popup. Toggle Small Web mode on, pick the categories you're interested in, and every new tab will take you somewhere new.

You can also right-click anywhere and toggle **Use Kagi Small Web for New Tab** from the context menu.

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
