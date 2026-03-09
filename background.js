const ALL_CATEGORIES = [
    'ai', 'science', 'programming', 'diy', 'tech', 'hardware', 'infra', 'web',
    'health', 'art', 'essays', 'humanities', 'retro', 'photography', 'culture', 'gaming',
    'society', 'life', 'food', 'travel', 'politics', 'economy'
];

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(['tabTakeoverEnabled', 'blockFocusEnabled', 'smallWebEnabled', 'selectedCategories', 'customUrl'], (result) => {
        if (result.tabTakeoverEnabled === undefined) {
            chrome.storage.sync.set({ tabTakeoverEnabled: true });
        }
        if (result.blockFocusEnabled === undefined) {
            chrome.storage.sync.set({ blockFocusEnabled: true });
        }
        if (result.smallWebEnabled === undefined) {
            chrome.storage.sync.set({ smallWebEnabled: false });
        }
        if (result.selectedCategories === undefined) {
            chrome.storage.sync.set({ selectedCategories: ALL_CATEGORIES });
        }
        if (result.customUrl === undefined) {
            chrome.storage.sync.set({ customUrl: '' });
        }
    });

    chrome.contextMenus.create({
        id: 'add-to-smallweb',
        title: 'Kagi Small Web — Bookmark this',
        contexts: ['page', 'link'],
        visible: false
    });
});

// Show/hide context menu based on whether the active tab is a Small Web page
function updateContextMenuVisibility(tab) {
    const isSmallWeb = tab?.url?.startsWith('https://kagi.com/smallweb') ||
        tab?.url?.startsWith('chrome-extension://') ||
        tab?.pendingUrl?.startsWith('chrome-extension://');
    chrome.contextMenus.update('add-to-smallweb', { visible: !!isSmallWeb });
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs.get(tabId, updateContextMenuVisibility);
});

chrome.tabs.onUpdated.addListener((_tabId, _info, tab) => {
    if (tab.active) updateContextMenuVisibility(tab);
});

const SMALLWEB_FOLDER_NAME = 'Small Web';

async function getOrCreateSmallWebFolder() {
    // Find "Other Bookmarks" by getting the root tree
    const tree = await chrome.bookmarks.getTree();
    const root = tree[0].children;
    const otherBookmarks = root.find(b => /other bookmarks/i.test(b.title));
    const bookmarksBar = root.find(b => /bookmarks bar/i.test(b.title));
    const parentId = (otherBookmarks || bookmarksBar || tree[0]).id;
    const children = await chrome.bookmarks.getChildren(parentId);
    const existing = children.find(b => b.title === SMALLWEB_FOLDER_NAME && !b.url);
    if (existing) return existing;
    return chrome.bookmarks.create({ parentId, title: SMALLWEB_FOLDER_NAME });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'add-to-smallweb') {
        const folder = await getOrCreateSmallWebFolder();
        const url = info.linkUrl || info.frameUrl || info.pageUrl;
        const title = info.linkUrl ? info.selectionText || url : tab.title || url;
        await chrome.bookmarks.create({ parentId: folder.id, title, url });
    }
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.tabTakeoverEnabled) {
        updateIcon(changes.tabTakeoverEnabled.newValue !== false);
    }
});

// Gray out toolbar icon when Small Web is disabled
async function updateIcon(enabled) {
    if (enabled) {
        chrome.action.setIcon({
            path: { 16: 'icons/icon16.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' }
        });
        return;
    }

    const sizes = [16, 48, 128];
    const imageData = {};
    for (const size of sizes) {
        const resp = await fetch(`icons/icon${size}.png`);
        const blob = await resp.blob();
        const bitmap = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(size, size);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        const data = ctx.getImageData(0, 0, size, size);
        const px = data.data;
        for (let i = 0; i < px.length; i += 4) {
            const gray = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
            px[i] = gray;
            px[i + 1] = gray;
            px[i + 2] = gray;
            px[i + 3] = Math.round(px[i + 3] * 0.5);
        }
        imageData[size] = data;
    }
    chrome.action.setIcon({ imageData });
}

// Set initial icon state on startup
chrome.storage.sync.get(['tabTakeoverEnabled'], (result) => {
    updateIcon(result.tabTakeoverEnabled !== false);
});

// Handle redirect to default NTP when tab takeover is disabled
chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.action === 'restoreDefaultNTP' && sender.tab) {
        chrome.tabs.update(sender.tab.id, { url: 'chrome://new-tab-page' });
    }
});

// Dynamically register block-focus content scripts and header-stripping rules
// for iframe mode. When focus blocking is off, none of this is needed since
// we navigate directly to the URL instead of using an iframe.
const KAGI_SCRIPT_ID = 'block-focus-kagi';
const CUSTOM_URL_SCRIPT_ID = 'block-focus-custom-url';
const CUSTOM_URL_RULE_ID = 2;

async function updateFocusBlockingRules(blockFocusEnabled, customUrl) {
    // Remove dynamic rules and scripts first
    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [CUSTOM_URL_RULE_ID]
    });
    // Unregister individually to avoid errors if one doesn't exist
    for (const id of [KAGI_SCRIPT_ID, CUSTOM_URL_SCRIPT_ID]) {
        try { await chrome.scripting.unregisterContentScripts({ ids: [id] }); } catch (e) {}
    }

    // Kagi.com header stripping is handled by static rules.json (always active
    // for sub_frame requests — harmless when not using iframe mode).
    // We only dynamically manage content scripts and custom URL header rules.

    if (!blockFocusEnabled) return;

    // Register focus-blocking content script for kagi.com
    await chrome.scripting.registerContentScripts([{
        id: KAGI_SCRIPT_ID,
        matches: ['https://kagi.com/*'],
        js: ['block-focus.js'],
        runAt: 'document_start',
        world: 'MAIN',
        allFrames: true
    }]);

    // Register custom URL rules if set and not kagi.com
    if (!customUrl) return;
    try {
        const url = new URL(customUrl);
        if (url.hostname === 'kagi.com') return;

        await chrome.declarativeNetRequest.updateDynamicRules({
            addRules: [{
                id: CUSTOM_URL_RULE_ID,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [
                        { header: 'X-Frame-Options', operation: 'remove' },
                        { header: 'Content-Security-Policy', operation: 'remove' }
                    ]
                },
                condition: {
                    urlFilter: '||' + url.hostname,
                    resourceTypes: ['sub_frame']
                }
            }]
        });

        await chrome.scripting.registerContentScripts([{
            id: CUSTOM_URL_SCRIPT_ID,
            matches: [url.origin + '/*'],
            js: ['block-focus.js'],
            runAt: 'document_start',
            world: 'MAIN',
            allFrames: true
        }]);
    } catch (e) {}
}

// Register on startup
chrome.storage.sync.get(['blockFocusEnabled', 'customUrl'], (result) => {
    updateFocusBlockingRules(result.blockFocusEnabled !== false, result.customUrl || '');
});

// Re-register when settings change
chrome.storage.onChanged.addListener((changes) => {
    if (changes.blockFocusEnabled || changes.customUrl) {
        chrome.storage.sync.get(['blockFocusEnabled', 'customUrl'], (result) => {
            updateFocusBlockingRules(result.blockFocusEnabled !== false, result.customUrl || '');
        });
    }
});
