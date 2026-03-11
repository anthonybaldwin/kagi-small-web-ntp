# Kagi Small Web NTP

A Chrome extension that replaces your new tab page with Kagi Small Web (`https://kagi.com/smallweb`) or custom URL (defaults to [Kagi](https://kagi.com)). More [here](https://github.com/kagisearch/smallweb?tab=readme-ov-file#kagi-small-web).

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
