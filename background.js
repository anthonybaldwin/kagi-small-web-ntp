const ALL_CATEGORIES = [
    'ai', 'science', 'programming', 'diy', 'tech', 'hardware', 'infra', 'web',
    'health', 'art', 'essays', 'humanities', 'retro', 'photography', 'culture', 'gaming',
    'society', 'life', 'food', 'travel', 'politics', 'economy'
];

const ALL_FEEDS = ['blogs', 'appreciated', 'youtube', 'github', 'comics'];

function decodeXmlEntities(s) {
    return s
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(+c));
}

const FEED_ENDPOINTS = {
    blogs:       'https://kagi.com/api/v1/smallweb/feed/?nso',
    youtube:     'https://kagi.com/api/v1/smallweb/feed/?yt',
    github:      'https://kagi.com/api/v1/smallweb/feed/?gh',
    comics:      'https://kagi.com/api/v1/smallweb/feed/?comic',
    appreciated: 'https://kagi.com/smallweb/appreciated'
};

const SMALLWEB_BASE = 'https://kagi.com/smallweb';

// ═══════════════════════════════════════
// FEED CACHING
// ═══════════════════════════════════════

function parseAtomEntries(xml) {
    const entries = [];
    let pos = 0;
    while (true) {
        const start = xml.indexOf('<entry', pos);
        if (start === -1) break;
        const end = xml.indexOf('</entry>', start);
        if (end === -1) break;
        const block = xml.slice(start, end);
        pos = end + 8;

        const href = block.match(/href="(https:\/\/[^"]+)"/);
        const titleTag = block.match(/<title[^>]*>([^<]+)<\/title>/);
        const cats = [];
        const catRe = /<category[^>]+term="([^"]+)"/g;
        let catMatch;
        while ((catMatch = catRe.exec(block))) cats.push(catMatch[1]);
        if (href) {
            entries.push({
                title: decodeXmlEntities(titleTag?.[1] || 'Untitled'),
                url: href[1],
                categories: cats
            });
        }
    }
    return entries;
}

async function getRandomFeedEntry(feedName) {
    const CACHE_KEY = 'feedData';
    const THREE_HOURS = 3 * 60 * 60 * 1000;

    const stored = await chrome.storage.local.get(CACHE_KEY);
    const all = stored[CACHE_KEY] || {};
    const slot = all[feedName];

    let entries;
    if (slot && slot.entries.length > 0 && (Date.now() - slot.fetchedAt) < THREE_HOURS) {
        entries = slot.entries;
    } else {
        try {
            const res = await fetch(FEED_ENDPOINTS[feedName]);
            if (!res.ok) throw new Error(res.status);
            entries = parseAtomEntries(await res.text());
            all[feedName] = { entries, fetchedAt: Date.now() };
            await chrome.storage.local.set({ [CACHE_KEY]: all });
        } catch (e) {
            entries = slot?.entries || [];
        }
    }

    if (entries.length === 0) return null;
    return entries[Math.floor(Math.random() * entries.length)];
}

// ═══════════════════════════════════════
// IFRAME PREPARATION
// ═══════════════════════════════════════

// YouTube embeds don't work from chrome-extension:// origins directly,
// but our youtube.html wrapper page hosts the embed from our extension origin.
function youTubeVideoId(url) {
    try {
        const u = new URL(url);
        if (u.hostname.includes('youtube.com')) {
            return u.searchParams.get('v') || u.pathname.match(/\/(?:shorts|embed)\/([^/?]+)/)?.[1];
        }
        if (u.hostname === 'youtu.be') {
            return u.pathname.slice(1).split('/')[0];
        }
    } catch (e) {}
    return null;
}

// One function for all header stripping. Uses tabId as rule ID
// so each tab gets its own rule — no collisions, no tracking Maps.
async function prepareIframe(url, tabId) {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'kagi.com') return; // static rules.json handles kagi.com

    const scriptId = 'block-focus-' + tabId;
    await chrome.scripting.unregisterContentScripts({ ids: [scriptId] }).catch(() => {});

    await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [tabId],
        addRules: [{
            id: tabId,
            priority: 1,
            action: {
                type: 'modifyHeaders',
                responseHeaders: [
                    { header: 'X-Frame-Options', operation: 'remove' },
                    { header: 'Content-Security-Policy', operation: 'set', value: "object-src 'none'; base-uri 'self';" }
                ]
            },
            condition: {
                urlFilter: '||' + urlObj.hostname,
                resourceTypes: ['sub_frame'],
                tabIds: [tabId]
            }
        }]
    });

    await chrome.scripting.registerContentScripts([{
        id: scriptId,
        matches: [urlObj.origin + '/*'],
        js: ['block-focus.js'],
        runAt: 'document_start',
        world: 'MAIN',
        allFrames: true
    }]);
}

function cleanupTab(tabId) {
    chrome.storage.session.remove('articleUrl_' + tabId);
    chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId] });
    chrome.scripting.unregisterContentScripts({ ids: ['block-focus-' + tabId] }).catch(() => {});
    setContextMenu(false);
}

// ═══════════════════════════════════════
// ARTICLE INFO (session storage — survives SW restarts)
// ═══════════════════════════════════════

async function setArticleInfo(tabId, url, title, source) {
    await chrome.storage.session.set({ ['articleUrl_' + tabId]: { url, title, source } });
    // Show context menu if this is the active tab
    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.id === tabId) await setContextMenu(true);
    } catch (e) {}
}

async function getArticleInfo(tabId) {
    const stored = await chrome.storage.session.get('articleUrl_' + tabId);
    return stored['articleUrl_' + tabId] || null;
}

// ═══════════════════════════════════════
// CONTEXT MENU
// ═══════════════════════════════════════

function setContextMenu(visible) {
    return new Promise(resolve => {
        chrome.contextMenus.removeAll(() => {
            if (visible) {
                chrome.contextMenus.create({ id: 'bookmark-article', title: 'Bookmark this', contexts: ['page', 'frame', 'link'] });
                chrome.contextMenus.create({ id: 'add-to-reading-list', title: 'Add to Reading List', contexts: ['page', 'frame', 'link'] });
                chrome.contextMenus.create({ id: 'appreciate-post', title: 'Appreciate this', contexts: ['page', 'frame', 'link'] });
            }
            resolve();
        });
    });
}

// Show/hide context menu based on whether this tab has article info
async function updateContextMenuForTab(tabId) {
    const info = await getArticleInfo(tabId);
    await setContextMenu(!!info);
}

// ═══════════════════════════════════════
// BOOKMARKS & APPRECIATE
// ═══════════════════════════════════════

async function getOrCreateFolder(parentId, name) {
    const children = await chrome.bookmarks.getChildren(parentId);
    return children.find(b => b.title === name && !b.url)
        || await chrome.bookmarks.create({ parentId, title: name });
}

async function getBookmarkFolder(source) {
    const tree = await chrome.bookmarks.getTree();
    const root = tree[0].children;
    // Look for existing Small Web folder in preferred order before creating one
    const otherBookmarks = root.find(b => /other bookmarks/i.test(b.title));
    const bookmarksBar = root.find(b => /bookmarks bar/i.test(b.title));
    const searchOrder = [bookmarksBar, otherBookmarks, root[0]].filter(Boolean);

    let swFolder = null;
    for (const parent of searchOrder) {
        const children = await chrome.bookmarks.getChildren(parent.id);
        const found = children.find(b => b.title === 'Small Web' && !b.url);
        if (found) { swFolder = found; break; }
    }
    if (!swFolder) {
        const defaultParent = searchOrder[0];
        swFolder = await chrome.bookmarks.create({ parentId: defaultParent.id, title: 'Small Web' });
    }

    if (!source) return swFolder;

    // source is "cat/ai" or "feed/github" → create subfolders
    const parts = source.split('/');
    let folder = swFolder;
    for (const part of parts) {
        folder = await getOrCreateFolder(folder.id, part);
    }
    return folder;
}

async function appreciatePost(url) {
    try {
        const formData = new FormData();
        formData.append('url', url);
        formData.append('emoji', '\uD83D\uDC4D');
        const response = await fetch(SMALLWEB_BASE + '/favorite', {
            method: 'POST', body: formData, credentials: 'include'
        });
        return response.ok;
    } catch (e) {
        return false;
    }
}

// ═══════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════

// Tab activated: update context menu from session storage
chrome.tabs.onActivated.addListener(({ tabId }) => {
    updateContextMenuForTab(tabId);
});

// Tab closed: clean up everything for that tab
chrome.tabs.onRemoved.addListener((tabId) => {
    cleanupTab(tabId);
});

// Top-level navigation away from our NTP: clean up
chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId === 0 && !details.url.startsWith('chrome-extension://')) {
        cleanupTab(details.tabId);
    }
});

// Category pages: discover the article inside kagi.com/smallweb
chrome.webNavigation.onCompleted.addListener(async (details) => {
    if (!details.url.startsWith('https://kagi.com/smallweb')) return;

    const tab = await chrome.tabs.get(details.tabId).catch(() => null);
    if (!tab?.active) return;

    // Only cache once per tab
    if (await getArticleInfo(details.tabId)) return;

    const frames = await chrome.webNavigation.getAllFrames({ tabId: details.tabId });
    const articleFrame = frames?.find(f =>
        f.parentFrameId !== -1 &&
        !f.url.startsWith('chrome-extension://') &&
        !f.url.startsWith('https://kagi.com/smallweb') &&
        !f.url.startsWith('about:')
    );
    if (!articleFrame) return;

    let title = articleFrame.url;
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: details.tabId, frameIds: [articleFrame.frameId] },
            func: () => document.title
        });
        if (results?.[0]?.result) title = results[0].result;
    } catch (e) {}

    // Extract category from the kagi.com/smallweb URL (e.g. ?cat=ai)
    try {
        const cat = new URL(details.url).searchParams.get('cat');
        await setArticleInfo(details.tabId, articleFrame.url, title, cat ? 'cat/' + cat : null);
    } catch (e) {
        await setArticleInfo(details.tabId, articleFrame.url, title);
    }
});

// ═══════════════════════════════════════
// CONTEXT MENU CLICK HANDLERS
// ═══════════════════════════════════════

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const article = await getArticleInfo(tab.id);

    if (info.menuItemId === 'bookmark-article') {
        const folder = await getBookmarkFolder(article?.source);
        if (info.linkUrl) {
            await chrome.bookmarks.create({ parentId: folder.id, title: info.selectionText || info.linkUrl, url: info.linkUrl });
        } else {
            const url = article?.url || info.frameUrl || info.pageUrl;
            const title = article?.title || url;
            await chrome.bookmarks.create({ parentId: folder.id, title, url });
        }
    }

    if (info.menuItemId === 'add-to-reading-list') {
        const url = info.linkUrl || article?.url || info.frameUrl || info.pageUrl;
        const title = info.selectionText || article?.title || url;
        try { await chrome.readingList.addEntry({ url, title, hasBeenRead: false }); } catch (e) {}
    }

    if (info.menuItemId === 'appreciate-post') {
        const url = info.linkUrl || article?.url || info.frameUrl || info.pageUrl;
        if (url) await appreciatePost(url);
    }
});

// ═══════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'restoreDefaultNTP' && sender.tab) {
        chrome.tabs.update(sender.tab.id, { url: 'chrome://new-tab-page' });
    }

    // Combined: fetch feed entry + prepare iframe + cache article info
    if (msg.action === 'loadFeedContent' && sender.tab) {
        (async () => {
            try {
                const entry = await getRandomFeedEntry(msg.feed);
                if (!entry) { sendResponse({ url: null }); return; }
                await setArticleInfo(sender.tab.id, entry.url, entry.title, 'feed/' + msg.feed);
                const ytId = youTubeVideoId(entry.url);
                if (!ytId) {
                    await prepareIframe(entry.url, sender.tab.id);
                }
                sendResponse({ url: entry.url, title: entry.title, youtube: !!ytId, videoId: ytId });
            } catch (e) {
                sendResponse({ url: null });
            }
        })();
        return true;
    }

    // Category from blogs feed (direct article, no Kagi frame)
    if (msg.action === 'loadCategoryFromFeed' && sender.tab) {
        (async () => {
            try {
                const entry = await getRandomFeedEntry('blogs');
                if (!entry) { sendResponse({ url: null }); return; }
                // Filter by category if specified
                if (msg.category) {
                    const stored = await chrome.storage.local.get('feedData');
                    const all = stored.feedData?.blogs?.entries || [];
                    const filtered = all.filter(e => e.categories && e.categories.includes(msg.category));
                    if (filtered.length === 0) { sendResponse({ url: null }); return; }
                    const pick = filtered[Math.floor(Math.random() * filtered.length)];
                    await setArticleInfo(sender.tab.id, pick.url, pick.title, 'cat/' + msg.category);
                    await prepareIframe(pick.url, sender.tab.id);
                    sendResponse({ url: pick.url, title: pick.title });
                } else {
                    await setArticleInfo(sender.tab.id, entry.url, entry.title, 'feed/blogs');
                    await prepareIframe(entry.url, sender.tab.id);
                    sendResponse({ url: entry.url, title: entry.title });
                }
            } catch (e) {
                sendResponse({ url: null });
            }
        })();
        return true;
    }

    // Prepare iframe for custom URL
    if (msg.action === 'prepareIframe' && sender.tab) {
        prepareIframe(msg.url, sender.tab.id)
            .then(() => sendResponse({ ready: true }))
            .catch(() => sendResponse({ ready: false }));
        return true;
    }

    // Popup reads article info
    if (msg.action === 'getArticleInfo') {
        getArticleInfo(msg.tabId)
            .then(info => sendResponse(info));
        return true;
    }

    if (msg.action === 'bookmarkArticle') {
        (async () => {
            const folder = await getBookmarkFolder(msg.source);
            await chrome.bookmarks.create({ parentId: folder.id, title: msg.title, url: msg.url });
            sendResponse({ success: true });
        })();
        return true;
    }

    if (msg.action === 'appreciatePost') {
        appreciatePost(msg.url).then(ok => sendResponse({ success: ok }));
        return true;
    }
});

// ═══════════════════════════════════════
// INIT & ICON
// ═══════════════════════════════════════

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(
        ['tabTakeoverEnabled', 'blockFocusEnabled', 'smallWebEnabled', 'selectedCategories', 'selectedFeeds', 'customUrl'],
        (result) => {
            const defaults = {};
            if (result.tabTakeoverEnabled === undefined) defaults.tabTakeoverEnabled = true;
            if (result.blockFocusEnabled === undefined) defaults.blockFocusEnabled = true;
            if (result.smallWebEnabled === undefined) defaults.smallWebEnabled = false;
            if (result.selectedCategories === undefined) defaults.selectedCategories = ALL_CATEGORIES;
            if (result.selectedFeeds === undefined) defaults.selectedFeeds = ALL_FEEDS;
            if (result.customUrl === undefined) defaults.customUrl = '';
            if (Object.keys(defaults).length > 0) chrome.storage.sync.set(defaults);
        }
    );
    Object.keys(FEED_ENDPOINTS).forEach(name => getRandomFeedEntry(name));
});

chrome.runtime.onStartup.addListener(() => {
    chrome.storage.sync.get(['selectedFeeds'], (result) => {
        if (result.selectedFeeds === undefined) {
            chrome.storage.sync.set({ selectedFeeds: ALL_FEEDS });
        }
    });
    Object.keys(FEED_ENDPOINTS).forEach(name => getRandomFeedEntry(name));
});

// Focus-blocking script for kagi.com (static rules.json handles headers)
chrome.storage.sync.get(['blockFocusEnabled'], (result) => {
    if (result.blockFocusEnabled !== false) {
        chrome.scripting.registerContentScripts([{
            id: 'block-focus-kagi',
            matches: ['https://kagi.com/*'],
            js: ['block-focus.js'],
            runAt: 'document_start',
            world: 'MAIN',
            allFrames: true
        }]).catch(() => {}); // already registered
    }
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.tabTakeoverEnabled) {
        updateIcon(changes.tabTakeoverEnabled.newValue !== false);
    }
    if (changes.blockFocusEnabled) {
        if (changes.blockFocusEnabled.newValue !== false) {
            chrome.scripting.registerContentScripts([{
                id: 'block-focus-kagi',
                matches: ['https://kagi.com/*'],
                js: ['block-focus.js'],
                runAt: 'document_start',
                world: 'MAIN',
                allFrames: true
            }]).catch(() => {});
        } else {
            chrome.scripting.unregisterContentScripts({ ids: ['block-focus-kagi'] }).catch(() => {});
        }
    }
});

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
        const resp = await fetch('icons/icon' + size + '.png');
        const blob = await resp.blob();
        const bitmap = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(size, size);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        const data = ctx.getImageData(0, 0, size, size);
        const px = data.data;
        for (let i = 0; i < px.length; i += 4) {
            const gray = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
            px[i] = gray; px[i + 1] = gray; px[i + 2] = gray;
            px[i + 3] = Math.round(px[i + 3] * 0.5);
        }
        imageData[size] = data;
    }
    chrome.action.setIcon({ imageData });
}

chrome.storage.sync.get(['tabTakeoverEnabled'], (result) => {
    updateIcon(result.tabTakeoverEnabled !== false);
});
