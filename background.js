const ALL_CATEGORIES = [
    'ai', 'science', 'programming', 'diy', 'tech', 'hardware', 'infra', 'web',
    'health', 'art', 'essays', 'humanities', 'retro', 'photography', 'culture', 'gaming',
    'society', 'life', 'food', 'travel', 'politics', 'economy'
];

const ALL_FEEDS = ['blogs', 'appreciated', 'youtube', 'github', 'comics'];

/**
 * A parsed Atom feed entry.
 *
 * @typedef {object} FeedEntry
 * @property {string} title
 * @property {string} url
 * @property {string[]} categories
 */

/**
 * One feed's cached entries in chrome.storage.local.
 *
 * @typedef {object} FeedSlot
 * @property {FeedEntry[]} entries
 * @property {number} fetchedAt
 */

/**
 * What the popup and context menu know about the article in a tab.
 *
 * @typedef {object} ArticleInfo
 * @property {string} url
 * @property {string} [title]
 * @property {string | null} [source]
 */

/**
 * The subset of chrome.storage.sync this worker reads.
 *
 * @typedef {object} Settings
 * @property {boolean} [tabTakeoverEnabled]
 * @property {boolean} [blockFocusEnabled]
 * @property {boolean} [smallWebEnabled]
 * @property {boolean} [bingRedirectEnabled]
 * @property {string[]} [selectedCategories]
 * @property {string[]} [selectedFeeds]
 * @property {string} [customUrl]
 */

// Single-pass decode so already-escaped sequences like "&amp;lt;" come out
// as the literal "&lt;" instead of being double-decoded to "<".
/** @type {Record<string, string>} */
const XML_NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** @param {string} s */
function decodeXmlEntities(s) {
    return s.replace(/&(amp|lt|gt|quot|apos|#\d+|#[xX][0-9a-fA-F]+);/g, (match, /** @type {string} */ body) => {
        // The regex only matches the five named entities, so the lookup hits.
        if (body[0] !== '#') return /** @type {string} */ (XML_NAMED_ENTITIES[body]);
        const hex = body[1] === 'x' || body[1] === 'X';
        const code = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
        if (code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF)) return match;
        return String.fromCodePoint(code);
    });
}

const FEED_ENDPOINTS = {
    blogs:       'https://kagi.com/api/v1/smallweb/feed/?nso',
    youtube:     'https://kagi.com/api/v1/smallweb/feed/?yt',
    github:      'https://kagi.com/api/v1/smallweb/feed/?gh',
    comics:      'https://kagi.com/api/v1/smallweb/feed/?comic',
    appreciated: 'https://kagi.com/smallweb/appreciated'
};

const SMALLWEB_BASE = 'https://kagi.com/smallweb';

// Feed entries (especially "appreciated") may wrap the real URL as
// https://kagi.com/smallweb?url=ACTUAL — strip the wrapper so we
// load the article directly and never show the /smallweb frame.
/** @param {string} url */
function unwrapSmallwebUrl(url) {
    try {
        const u = new URL(url);
        if (u.hostname === 'kagi.com' && u.pathname === '/smallweb') {
            const inner = u.searchParams.get('url');
            if (inner && /^https?:\/\//.test(inner)) return inner;
        }
    } catch (e) {}
    return url;
}

// ═══════════════════════════════════════
// FEED CACHING
// ═══════════════════════════════════════

/**
 * @param {string} xml
 * @returns {FeedEntry[]}
 */
function parseAtomEntries(xml) {
    /** @type {FeedEntry[]} */
    const entries = [];
    let pos = 0;
    while (true) {
        const start = xml.indexOf('<entry', pos);
        if (start === -1) break;
        const end = xml.indexOf('</entry>', start);
        if (end === -1) break;
        const block = xml.slice(start, end);
        pos = end + 8;

        // Prefer rel="alternate" links (the actual article) over rel="self" (the feed URL)
        const altHref = block.match(/rel="alternate"[^>]*href="(https:\/\/[^"]+)"/)
            || block.match(/href="(https:\/\/[^"]+)"[^>]*rel="alternate"/);
        const href = altHref || block.match(/href="(https:\/\/[^"]+)"/);
        const titleTag = block.match(/<title[^>]*>([^<]+)<\/title>/);
        /** @type {string[]} */
        const cats = [];
        const catRe = /<category[^>]+term="([^"]+)"/g;
        let catMatch;
        while ((catMatch = catRe.exec(block))) cats.push(/** @type {string} */ (catMatch[1]));
        if (href) {
            entries.push({
                title: decodeXmlEntities(titleTag?.[1] || 'Untitled'),
                // hrefs are XML attribute values — "&amp;" etc. must be decoded
                // or URLs with query strings break when fetched.
                url: unwrapSmallwebUrl(decodeXmlEntities(/** @type {string} */ (href[1]))),
                categories: cats
            });
        }
    }
    return entries;
}

/**
 * @param {keyof typeof FEED_ENDPOINTS} feedName
 * @returns {Promise<FeedEntry | null>}
 */
async function getRandomFeedEntry(feedName) {
    const CACHE_KEY = 'feedData';
    const THREE_HOURS = 3 * 60 * 60 * 1000;

    const stored = await chrome.storage.local.get(CACHE_KEY);
    const all = /** @type {Record<string, FeedSlot | undefined>} */ (stored[CACHE_KEY] || {});
    const slot = all[feedName];

    /** @type {FeedEntry[]} */
    let entries;
    if (slot && slot.entries.length > 0 && (Date.now() - slot.fetchedAt) < THREE_HOURS) {
        entries = slot.entries;
    } else {
        try {
            const res = await fetch(FEED_ENDPOINTS[feedName]);
            if (!res.ok) throw new Error(String(res.status));
            entries = parseAtomEntries(await res.text());
            all[feedName] = { entries, fetchedAt: Date.now() };
            await chrome.storage.local.set({ [CACHE_KEY]: all });
        } catch (e) {
            entries = slot?.entries || [];
        }
    }

    if (entries.length === 0) return null;
    const entry = entries[Math.floor(Math.random() * entries.length)];
    if (!entry) return null;
    // Unwrap cached entries that predate the parse-time fix
    entry.url = unwrapSmallwebUrl(entry.url);
    return entry;
}

// ═══════════════════════════════════════
// IFRAME PREPARATION
// ═══════════════════════════════════════

// YouTube embeds don't work from chrome-extension:// origins, so main.js
// renders a thumbnail card instead — this extracts the video ID for it.
// The ID is interpolated into thumbnail URLs and inline styles on the NTP
// page, so only accept real YouTube hosts and URL-safe-base64 IDs.
/** @param {string} url */
function youTubeVideoId(url) {
    let id = null;
    try {
        const u = new URL(url);
        if (u.hostname === 'youtube.com' || u.hostname.endsWith('.youtube.com')) {
            id = u.searchParams.get('v') || u.pathname.match(/\/(?:shorts|embed)\/([^/?]+)/)?.[1];
        } else if (u.hostname === 'youtu.be') {
            id = u.pathname.slice(1).split('/')[0];
        }
    } catch (e) {}
    return id && /^[A-Za-z0-9_-]{5,20}$/.test(id) ? id : null;
}

// One function for all header stripping. Uses tabId as rule ID
// so each tab gets its own rule — no collisions, no tracking Maps.
// URLs that look like feeds/XML — skip content script injection so the
// browser can render them natively (XML tree view or XSLT stylesheet).
/** @param {string} url */
function isXmlUrl(url) {
    const path = new URL(url).pathname.toLowerCase();
    return /\.(xml|rss|atom|feed)$/.test(path) || /\/(feed|rss|atom)\/?$/.test(path);
}

/**
 * @param {string} url
 * @param {number} tabId
 */
async function prepareIframe(url, tabId) {
    const urlObj = new URL(url);
    const isKagi = urlObj.hostname === 'kagi.com';

    // Always clear any per-tab script left over from a previous article
    // (NTP refresh reuses the tab without a cleanup-triggering navigation).
    const scriptId = 'block-focus-' + tabId;
    await chrome.scripting.unregisterContentScripts({ ids: [scriptId] }).catch(() => {});

    // Header stripping is session-scoped to this tab's sub_frames only —
    // including for kagi.com — so no site's framing protections are ever
    // weakened for requests originating from ordinary web pages.
    await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [tabId],
        addRules: [{
            id: tabId,
            priority: 1,
            action: {
                type: 'modifyHeaders',
                responseHeaders: [
                    { header: 'X-Frame-Options', operation: 'remove' },
                    { header: 'Content-Security-Policy', operation: 'set', value: isKagi
                        ? "object-src 'none'; base-uri 'self';"
                        : "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; object-src 'none';" }
                ]
            },
            condition: {
                urlFilter: '||' + urlObj.hostname,
                resourceTypes: ['sub_frame'],
                tabIds: [tabId]
            }
        }]
    });

    // kagi.com is covered by the statically registered block-focus script;
    // registering a second copy would double-inject and break focus restore.
    if (isKagi) return;

    // Skip content script for XML/RSS — injecting into XML documents
    // destroys the browser's native XML tree view and XSLT rendering.
    if (!isXmlUrl(url)) {
        await chrome.scripting.registerContentScripts([{
            id: scriptId,
            matches: [urlObj.origin + '/*'],
            js: ['block-focus.js'],
            runAt: 'document_start',
            world: 'MAIN',
            allFrames: true
        }]);
    }
}

/** @param {number} tabId */
function cleanupTab(tabId) {
    chrome.storage.session.remove('articleUrl_' + tabId);
    chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId] });
    chrome.scripting.unregisterContentScripts({ ids: ['block-focus-' + tabId] }).catch(() => {});
    setContextMenu(false);
}

// ═══════════════════════════════════════
// ARTICLE INFO (session storage — survives SW restarts)
// ═══════════════════════════════════════

/**
 * @param {number} tabId
 * @param {string} url
 * @param {string} [title]
 * @param {string | null} [source]
 */
async function setArticleInfo(tabId, url, title, source) {
    await chrome.storage.session.set({ ['articleUrl_' + tabId]: { url, title, source } });
    // Show context menu if this is the active tab
    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.id === tabId) await setContextMenu(true);
    } catch (e) {}
    // Append to persistent history (max 50, dedup consecutive)
    try {
        const HISTORY_KEY = 'articleHistory';
        const MAX = 100;
        const stored = await chrome.storage.local.get(HISTORY_KEY);
        const history = /** @type {Array<ArticleInfo & { timestamp: number }>} */ (
            stored[HISTORY_KEY] || []
        );
        if (history.length === 0 || history[0]?.url !== url) {
            history.unshift({ url, title, source, timestamp: Date.now() });
            if (history.length > MAX) history.length = MAX;
            await chrome.storage.local.set({ [HISTORY_KEY]: history });
        }
    } catch (e) {}
}

/**
 * @param {number} tabId
 * @returns {Promise<ArticleInfo | null>}
 */
async function getArticleInfo(tabId) {
    const stored = await chrome.storage.session.get('articleUrl_' + tabId);
    return /** @type {ArticleInfo | null} */ (stored['articleUrl_' + tabId] || null);
}

// ═══════════════════════════════════════
// CONTEXT MENU
// ═══════════════════════════════════════

/** @param {boolean} visible */
function setContextMenu(visible) {
    return /** @type {Promise<void>} */ (new Promise(resolve => {
        chrome.contextMenus.removeAll(() => {
            if (visible) {
                chrome.contextMenus.create({ id: 'bookmark-article', title: 'Bookmark this', contexts: ['page', 'frame', 'link'] });
                chrome.contextMenus.create({ id: 'add-to-reading-list', title: 'Add to Reading List', contexts: ['page', 'frame', 'link'] });
                chrome.contextMenus.create({ id: 'appreciate-post', title: 'Appreciate this', contexts: ['page', 'frame', 'link'] });
            }
            resolve();
        });
    }));
}

/**
 * Show/hide context menu based on whether this tab has article info
 *
 * @param {number} tabId
 */
async function updateContextMenuForTab(tabId) {
    const info = await getArticleInfo(tabId);
    await setContextMenu(!!info);
}

// ═══════════════════════════════════════
// BOOKMARKS & APPRECIATE
// ═══════════════════════════════════════

/**
 * @param {string} parentId
 * @param {string} name
 */
async function getOrCreateFolder(parentId, name) {
    const children = await chrome.bookmarks.getChildren(parentId);
    return children.find(b => b.title === name && !b.url)
        || await chrome.bookmarks.create({ parentId, title: name });
}

/** @param {string | null} [source] */
async function getBookmarkFolder(source) {
    const tree = await chrome.bookmarks.getTree();
    const root = tree[0]?.children ?? [];
    // Look for existing Small Web folder in preferred order before creating one
    const otherBookmarks = root.find(b => /other bookmarks/i.test(b.title));
    const bookmarksBar = root.find(b => /bookmarks bar/i.test(b.title));
    const searchOrder = [bookmarksBar, otherBookmarks, root[0]].filter(
        /** @returns {b is chrome.bookmarks.BookmarkTreeNode} */ (b) => Boolean(b)
    );

    let swFolder = null;
    for (const parent of searchOrder) {
        const children = await chrome.bookmarks.getChildren(parent.id);
        const found = children.find(b => b.title === 'Small Web' && !b.url);
        if (found) { swFolder = found; break; }
    }
    if (!swFolder) {
        const defaultParent = searchOrder[0];
        if (!defaultParent) throw new Error('No bookmark root to create the Small Web folder in');
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

/** @param {string} url */
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

// Top-level navigation: clean up stale state.
// For our own extension pages (NTP refresh), clear old article info so the
// new article gets recorded. For external pages, keep info if navigating
// to the article itself (e.g. YouTube card click).
chrome.webNavigation.onCommitted.addListener(async (details) => {
    if (details.frameId === 0 && details.url.startsWith('chrome-extension://')) {
        // NTP refresh — don't cleanup here; main.js reads the previous
        // article info for back-button history, then the new article's
        // setArticleInfo overwrites it naturally.
        return;
    }
    if (details.frameId === 0) {
        const info = await getArticleInfo(details.tabId);
        if (info && info.url === details.url) {
            // Keep article info + context menu when navigating to the article
            // itself (iframe breakout, YouTube card) — but the header rule and
            // injected script are no longer needed once the frame is gone.
            chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [details.tabId] });
            chrome.scripting.unregisterContentScripts({ ids: ['block-focus-' + details.tabId] }).catch(() => {});
            await setContextMenu(true);
        } else {
            cleanupTab(details.tabId);
        }
    }
});

// Category pages: discover the article inside kagi.com/smallweb
chrome.webNavigation.onCompleted.addListener(async (details) => {
    if (!details.url.startsWith('https://kagi.com/smallweb')) return;

    const tab = await chrome.tabs.get(details.tabId).catch(() => null);
    if (!tab?.active) return;

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
    if (tab?.id === undefined) return;
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
        if (url && title) {
            try { await chrome.readingList.addEntry({ url, title, hasBeenRead: false }); } catch (e) {}
        }
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
    // Captured once: handlers below run async, after `sender` narrowing is lost.
    const senderTabId = sender.tab?.id;

    if (msg.action === 'restoreDefaultNTP' && senderTabId !== undefined) {
        chrome.tabs.update(senderTabId, { url: 'chrome://new-tab-page' });
    }

    // Combined: fetch feed entry + prepare iframe + cache article info
    if (msg.action === 'loadFeedContent' && senderTabId !== undefined) {
        (async () => {
            try {
                const entry = await getRandomFeedEntry(msg.feed);
                if (!entry) { sendResponse({ url: null }); return; }
                await setArticleInfo(senderTabId, entry.url, entry.title, 'feed/' + msg.feed);
                const ytId = youTubeVideoId(entry.url);
                if (!ytId) {
                    await prepareIframe(entry.url, senderTabId);
                }
                console.log('[Kagi NTP] source: feed/' + msg.feed + ' | URL:', entry.url);
                sendResponse({ url: entry.url, title: entry.title, youtube: !!ytId, videoId: ytId });
            } catch (e) {
                sendResponse({ url: null });
            }
        })();
        return true;
    }

    // Category from blogs feed (direct article, no Kagi frame)
    if (msg.action === 'loadCategoryFromFeed' && senderTabId !== undefined) {
        (async () => {
            try {
                const entry = await getRandomFeedEntry('blogs');
                if (!entry) { sendResponse({ url: null }); return; }
                // Filter by category if specified
                if (msg.category) {
                    const stored = await chrome.storage.local.get('feedData');
                    const cached = /** @type {Record<string, FeedSlot | undefined> | undefined} */ (stored.feedData);
                    const all = cached?.blogs?.entries || [];
                    const filtered = all.filter(e => e.categories && e.categories.includes(msg.category));
                    if (filtered.length === 0) { sendResponse({ url: null }); return; }
                    const pick = filtered[Math.floor(Math.random() * filtered.length)];
                    if (!pick) { sendResponse({ url: null }); return; }
                    const url = unwrapSmallwebUrl(pick.url);
                    await setArticleInfo(senderTabId, url, pick.title, 'cat/' + msg.category);
                    await prepareIframe(url, senderTabId);
                    console.log('[Kagi NTP] source: cat/' + msg.category + ' | URL:', url);
                    sendResponse({ url, title: pick.title });
                } else {
                    await setArticleInfo(senderTabId, entry.url, entry.title, 'feed/blogs');
                    await prepareIframe(entry.url, senderTabId);
                    console.log('[Kagi NTP] source: feed/blogs (no category) | URL:', entry.url);
                    sendResponse({ url: entry.url, title: entry.title });
                }
            } catch (e) {
                sendResponse({ url: null });
            }
        })();
        return true;
    }

    // Prepare iframe for custom URL
    if (msg.action === 'prepareIframe' && senderTabId !== undefined) {
        prepareIframe(msg.url, senderTabId)
            .then(() => sendResponse({ ready: true }))
            .catch(() => sendResponse({ ready: false }));
        return true;
    }

    // Popup reads article info
    if (msg.action === 'getArticleInfo') {
        const tabId = msg.tabId || senderTabId;
        getArticleInfo(tabId).then(info => sendResponse(info));
        return true;
    }

    if (msg.action === 'getHistory') {
        chrome.storage.local.get('articleHistory', (stored) => {
            sendResponse(stored.articleHistory || []);
        });
        return true;
    }

    if (msg.action === 'clearHistory') {
        chrome.storage.local.remove('articleHistory', () => sendResponse({ success: true }));
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

    if (msg.action === 'searchDefault' && senderTabId !== undefined) {
        chrome.search.query({ text: msg.query, tabId: senderTabId });
    }
});

// ═══════════════════════════════════════
// BING/CORTANA → DEFAULT SEARCH ENGINE
// ═══════════════════════════════════════

const BING_REDIRECT_RULE_ID = 9999;

/** @param {boolean} enabled */
async function setBingRedirect(enabled) {
    if (enabled) {
        const extUrl = chrome.runtime.getURL('index.html');
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [BING_REDIRECT_RULE_ID],
            addRules: [{
                id: BING_REDIRECT_RULE_ID,
                priority: 2,
                action: {
                    type: 'redirect',
                    redirect: {
                        regexSubstitution: extUrl + '?q=\\1'
                    }
                },
                condition: {
                    regexFilter: '^https?://(?:www\\.)?bing\\.com/.*[?&]q=([^&]*)',
                    resourceTypes: ['main_frame']
                }
            }]
        });
    } else {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [BING_REDIRECT_RULE_ID]
        });
    }
}

// ═══════════════════════════════════════
// INIT & ICON
// ═══════════════════════════════════════

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(
        ['tabTakeoverEnabled', 'blockFocusEnabled', 'smallWebEnabled', 'selectedCategories', 'selectedFeeds', 'customUrl', 'bingRedirectEnabled'],
        (/** @type {Settings} */ result) => {
            const defaults = {};
            if (result.tabTakeoverEnabled === undefined) defaults.tabTakeoverEnabled = true;
            if (result.blockFocusEnabled === undefined) defaults.blockFocusEnabled = true;
            if (result.smallWebEnabled === undefined) defaults.smallWebEnabled = false;
            if (result.selectedCategories === undefined) defaults.selectedCategories = ALL_CATEGORIES;
            if (result.selectedFeeds === undefined) defaults.selectedFeeds = ALL_FEEDS;
            if (result.customUrl === undefined) defaults.customUrl = '';
            if (Object.keys(defaults).length > 0) chrome.storage.sync.set(defaults);
            setBingRedirect(result.bingRedirectEnabled || false);
        }
    );
    /** @type {Array<keyof typeof FEED_ENDPOINTS>} */ (Object.keys(FEED_ENDPOINTS))
        .forEach(name => getRandomFeedEntry(name));
});

chrome.runtime.onStartup.addListener(() => {
    chrome.storage.sync.get(['selectedFeeds', 'bingRedirectEnabled'], (/** @type {Settings} */ result) => {
        if (result.selectedFeeds === undefined) {
            chrome.storage.sync.set({ selectedFeeds: ALL_FEEDS });
        }
        setBingRedirect(result.bingRedirectEnabled || false);
    });
    /** @type {Array<keyof typeof FEED_ENDPOINTS>} */ (Object.keys(FEED_ENDPOINTS))
        .forEach(name => getRandomFeedEntry(name));
});

// Focus-blocking script for kagi.com (header rules are added per-tab in prepareIframe)
chrome.storage.sync.get(['blockFocusEnabled'], (/** @type {Settings} */ result) => {
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
    if (changes.bingRedirectEnabled) {
        setBingRedirect(Boolean(changes.bingRedirectEnabled.newValue));
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

/** @param {boolean} enabled */
async function updateIcon(enabled) {
    if (enabled) {
        chrome.action.setIcon({
            path: { 16: 'icons/icon16.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' }
        });
        return;
    }
    const sizes = [16, 48, 128];
    /** @type {Record<number, ImageData>} */
    const imageData = {};
    for (const size of sizes) {
        const resp = await fetch('icons/icon' + size + '.png');
        const blob = await resp.blob();
        const bitmap = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(size, size);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(bitmap, 0, 0);
        const data = ctx.getImageData(0, 0, size, size);
        const px = data.data;
        // Indices are always in range — RGBA data length is a multiple of 4.
        for (let i = 0; i < px.length; i += 4) {
            const r = px[i] ?? 0, g = px[i + 1] ?? 0, b = px[i + 2] ?? 0;
            const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            px[i] = gray; px[i + 1] = gray; px[i + 2] = gray;
            px[i + 3] = Math.round((px[i + 3] ?? 0) * 0.5);
        }
        imageData[size] = data;
    }
    chrome.action.setIcon({ imageData });
}

chrome.storage.sync.get(['tabTakeoverEnabled'], (/** @type {Settings} */ result) => {
    updateIcon(result.tabTakeoverEnabled !== false);
});
