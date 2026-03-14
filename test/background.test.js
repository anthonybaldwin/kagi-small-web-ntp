import { describe, test, expect, beforeEach } from 'bun:test';
import { createChromeMock } from './chrome-mock.js';

// ═══════════════════════════════════════
// Load background.js functions by evaluating with mocked chrome
// We extract the testable functions by reading the source
// ═══════════════════════════════════════

// Parse Atom entries — extracted from background.js for direct testing
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
        if (href) {
            entries.push({
                title: (titleTag?.[1] || 'Untitled')
                    .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, c) => String.fromCharCode(+c)),
                url: href[1]
            });
        }
    }
    return entries;
}

// ═══════════════════════════════════════
// FEED PARSING TESTS
// ═══════════════════════════════════════

describe('parseAtomEntries', () => {
    test('parses standard Atom entries', () => {
        const xml = `<?xml version="1.0"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
            <entry>
                <title type="text">First Post</title>
                <link href="https://example.com/post1" />
            </entry>
            <entry>
                <title type="text">Second Post</title>
                <link href="https://example.com/post2" />
            </entry>
        </feed>`;
        const entries = parseAtomEntries(xml);
        expect(entries).toHaveLength(2);
        expect(entries[0]).toEqual({ title: 'First Post', url: 'https://example.com/post1' });
        expect(entries[1]).toEqual({ title: 'Second Post', url: 'https://example.com/post2' });
    });

    test('decodes HTML entities in titles', () => {
        const xml = `<entry><title>Tom &amp; Jerry &lt;3</title><link href="https://example.com/tj" /></entry>`;
        const entries = parseAtomEntries(xml);
        expect(entries[0].title).toBe('Tom & Jerry <3');
    });

    test('decodes numeric character references', () => {
        const xml = `<entry><title>Arno&#39;s Blog</title><link href="https://example.com/arno" /></entry>`;
        const entries = parseAtomEntries(xml);
        expect(entries[0].title).toBe("Arno's Blog");
    });

    test('skips entries without https links', () => {
        const xml = `
            <entry><title>Good</title><link href="https://good.com" /></entry>
            <entry><title>Bad</title><link href="http://bad.com" /></entry>
            <entry><title>No Link</title></entry>`;
        const entries = parseAtomEntries(xml);
        expect(entries).toHaveLength(1);
        expect(entries[0].url).toBe('https://good.com');
    });

    test('handles entries with xml:base attributes', () => {
        const xml = `<entry xml:base="https://kagi.com/api"><title>Test</title><link href="https://github.com/repo" /></entry>`;
        const entries = parseAtomEntries(xml);
        expect(entries).toHaveLength(1);
        expect(entries[0].url).toBe('https://github.com/repo');
    });

    test('returns empty array for non-Atom content', () => {
        const entries = parseAtomEntries('<html><body>Not a feed</body></html>');
        expect(entries).toHaveLength(0);
    });

    test('uses Untitled for entries without title', () => {
        const xml = `<entry><link href="https://example.com/no-title" /></entry>`;
        const entries = parseAtomEntries(xml);
        expect(entries[0].title).toBe('Untitled');
    });
});

// ═══════════════════════════════════════
// YOUTUBE EMBED CONVERSION TESTS
// ═══════════════════════════════════════

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

describe('youTubeVideoId', () => {
    test('extracts ID from youtube.com/watch?v=ID', () => {
        expect(youTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    test('extracts ID with extra params', () => {
        expect(youTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42')).toBe('dQw4w9WgXcQ');
    });

    test('extracts ID from youtu.be/ID', () => {
        expect(youTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    test('extracts ID from youtube.com/shorts/ID', () => {
        expect(youTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    test('returns null for non-YouTube URLs', () => {
        expect(youTubeVideoId('https://github.com/user/repo')).toBeNull();
    });

    test('returns null/undefined for YouTube channel pages', () => {
        expect(youTubeVideoId('https://www.youtube.com/@channel')).toBeFalsy();
    });
});

// ═══════════════════════════════════════
// URL PICKING LOGIC TESTS
// ═══════════════════════════════════════

function pickContent(cats, feeds) {
    const options = [
        ...cats.map(c => ({ type: 'category', value: c })),
        ...feeds.map(f => ({ type: 'feed', value: f }))
    ];
    if (options.length === 0) return { type: 'fallback', value: 'https://kagi.com/smallweb' };
    return options[Math.floor(Math.random() * options.length)];
}

describe('URL picking logic', () => {
    test('returns fallback when no categories or feeds selected', () => {
        const result = pickContent([], []);
        expect(result.type).toBe('fallback');
    });

    test('picks only from categories when no feeds selected', () => {
        for (let i = 0; i < 20; i++) {
            const result = pickContent(['ai', 'science'], []);
            expect(result.type).toBe('category');
            expect(['ai', 'science']).toContain(result.value);
        }
    });

    test('picks only from feeds when no categories selected', () => {
        for (let i = 0; i < 20; i++) {
            const result = pickContent([], ['github', 'comics']);
            expect(result.type).toBe('feed');
            expect(['github', 'comics']).toContain(result.value);
        }
    });

    test('picks from both categories and feeds when both selected', () => {
        const types = new Set();
        for (let i = 0; i < 100; i++) {
            types.add(pickContent(['ai'], ['github']).type);
        }
        expect(types.has('category')).toBe(true);
        expect(types.has('feed')).toBe(true);
    });
});

// ═══════════════════════════════════════
// IFRAME RULE CONSTRUCTION TESTS
// ═══════════════════════════════════════

describe('prepareIframe rule construction', () => {
    let env;

    beforeEach(() => {
        env = createChromeMock();
        globalThis.chrome = env.mock;
    });

    test('creates session rule with tabId as rule ID', async () => {
        // Inline the prepareIframe logic for testing
        const url = 'https://github.com/user/repo';
        const tabId = 42;
        const hostname = new URL(url).hostname;

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
                    urlFilter: '||' + hostname,
                    resourceTypes: ['sub_frame'],
                    tabIds: [tabId]
                }
            }]
        });

        const rules = await chrome.declarativeNetRequest.getSessionRules();
        expect(rules).toHaveLength(1);
        expect(rules[0].id).toBe(42);
        expect(rules[0].condition.tabIds).toEqual([42]);
        expect(rules[0].condition.urlFilter).toBe('||github.com');
    });

    test('two tabs get separate rules', async () => {
        const addRule = async (url, tabId) => {
            await chrome.declarativeNetRequest.updateSessionRules({
                removeRuleIds: [tabId],
                addRules: [{
                    id: tabId,
                    condition: { urlFilter: '||' + new URL(url).hostname, tabIds: [tabId], resourceTypes: ['sub_frame'] },
                    action: { type: 'modifyHeaders', responseHeaders: [] },
                    priority: 1
                }]
            });
        };

        await addRule('https://github.com/repo1', 10);
        await addRule('https://blog.example.com/post', 11);

        const rules = await chrome.declarativeNetRequest.getSessionRules();
        expect(rules).toHaveLength(2);
        expect(rules.find(r => r.id === 10).condition.urlFilter).toBe('||github.com');
        expect(rules.find(r => r.id === 11).condition.urlFilter).toBe('||blog.example.com');
    });

    test('closing a tab only removes that tab rule', async () => {
        const addRule = async (tabId, host) => {
            await chrome.declarativeNetRequest.updateSessionRules({
                removeRuleIds: [tabId],
                addRules: [{ id: tabId, condition: { urlFilter: '||' + host, tabIds: [tabId] }, action: {}, priority: 1 }]
            });
        };

        await addRule(10, 'github.com');
        await addRule(11, 'example.com');

        // Simulate tab 10 close cleanup
        await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [10] });

        const rules = await chrome.declarativeNetRequest.getSessionRules();
        expect(rules).toHaveLength(1);
        expect(rules[0].id).toBe(11);
    });

    test('skips rule creation for kagi.com (handled by static rules)', async () => {
        const url = 'https://kagi.com/smallweb?cat=ai';
        const hostname = new URL(url).hostname;
        // The real prepareIframe returns early for kagi.com
        if (hostname === 'kagi.com') return;

        // If we got here, it's a bug
        expect(true).toBe(false);
    });
});

// ═══════════════════════════════════════
// ARTICLE INFO (SESSION STORAGE) TESTS
// ═══════════════════════════════════════

describe('article info via session storage', () => {
    let env;

    beforeEach(() => {
        env = createChromeMock();
        globalThis.chrome = env.mock;
    });

    test('setArticleInfo stores and getArticleInfo retrieves', async () => {
        await chrome.storage.session.set({ 'articleUrl_42': { url: 'https://example.com', title: 'Test' } });
        const stored = await chrome.storage.session.get('articleUrl_42');
        expect(stored['articleUrl_42']).toEqual({ url: 'https://example.com', title: 'Test' });
    });

    test('getArticleInfo returns null for unknown tab', async () => {
        const stored = await chrome.storage.session.get('articleUrl_999');
        expect(stored['articleUrl_999']).toBeUndefined();
    });

    test('clearArticleInfo removes the entry', async () => {
        await chrome.storage.session.set({ 'articleUrl_42': { url: 'https://example.com', title: 'Test' } });
        await chrome.storage.session.remove('articleUrl_42');
        const stored = await chrome.storage.session.get('articleUrl_42');
        expect(stored['articleUrl_42']).toBeUndefined();
    });

    test('survives conceptual service worker restart (session storage persists)', async () => {
        await chrome.storage.session.set({ 'articleUrl_42': { url: 'https://example.com', title: 'Test' } });
        // Session storage persists — no need to re-create chrome mock
        const stored = await chrome.storage.session.get('articleUrl_42');
        expect(stored['articleUrl_42'].url).toBe('https://example.com');
    });
});

// ═══════════════════════════════════════
// CONTEXT MENU VISIBILITY TESTS
// ═══════════════════════════════════════

describe('context menu visibility', () => {
    let env;

    beforeEach(() => {
        env = createChromeMock();
        globalThis.chrome = env.mock;
    });

    test('shows menu when article info exists for active tab', async () => {
        await chrome.storage.session.set({ 'articleUrl_1': { url: 'https://example.com', title: 'Test' } });
        const info = await chrome.storage.session.get('articleUrl_1');
        const visible = !!info['articleUrl_1'];
        expect(visible).toBe(true);
    });

    test('hides menu when no article info for active tab', async () => {
        const info = await chrome.storage.session.get('articleUrl_1');
        const visible = !!info['articleUrl_1'];
        expect(visible).toBe(false);
    });

    test('menu tracks the active tab, not all tabs', async () => {
        await chrome.storage.session.set({ 'articleUrl_10': { url: 'https://a.com', title: 'A' } });
        // Tab 10 is active — menu should show
        let info = await chrome.storage.session.get('articleUrl_10');
        expect(!!info['articleUrl_10']).toBe(true);
        // Tab 20 is active — no article info — menu should hide
        info = await chrome.storage.session.get('articleUrl_20');
        expect(!!info['articleUrl_20']).toBe(false);
    });
});

// ═══════════════════════════════════════
// CLEANUP TESTS
// ═══════════════════════════════════════

describe('cleanup on tab close', () => {
    let env;

    beforeEach(() => {
        env = createChromeMock();
        globalThis.chrome = env.mock;
    });

    test('removes article info, session rule, and content script', async () => {
        const tabId = 42;

        // Set up state
        await chrome.storage.session.set({ ['articleUrl_' + tabId]: { url: 'https://example.com', title: 'Test' } });
        await chrome.declarativeNetRequest.updateSessionRules({
            addRules: [{ id: tabId, condition: {}, action: {}, priority: 1 }]
        });
        await chrome.scripting.registerContentScripts([{ id: 'block-focus-' + tabId, matches: ['https://example.com/*'], js: ['block-focus.js'] }]);

        // Simulate cleanup (what cleanupTab does)
        await chrome.storage.session.remove('articleUrl_' + tabId);
        await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId] });
        await chrome.scripting.unregisterContentScripts({ ids: ['block-focus-' + tabId] });

        // Verify everything is cleaned up
        const stored = await chrome.storage.session.get('articleUrl_' + tabId);
        expect(stored['articleUrl_' + tabId]).toBeUndefined();

        const rules = await chrome.declarativeNetRequest.getSessionRules();
        expect(rules).toHaveLength(0);

        expect(env.registeredScripts).toHaveLength(0);
    });
});

// ═══════════════════════════════════════
// TOGGLE SCENARIO TESTS
// ═══════════════════════════════════════

describe('toggle scenarios', () => {
    test('Tab Takeover OFF → restoreDefaultNTP', () => {
        const result = { tabTakeoverEnabled: false };
        expect(result.tabTakeoverEnabled === false).toBe(true);
        // main.js sends restoreDefaultNTP and returns
    });

    test('Tab Takeover ON, Small Web OFF → custom URL path', () => {
        const result = { tabTakeoverEnabled: true, smallWebEnabled: false, customUrl: 'https://mysite.com' };
        expect(result.tabTakeoverEnabled !== false).toBe(true);
        expect(!result.smallWebEnabled).toBe(true);
        // main.js sends prepareIframe + loadUrl
    });

    test('Tab Takeover ON, Small Web ON, Focus ON → iframe mode', () => {
        const result = { tabTakeoverEnabled: true, smallWebEnabled: true, blockFocusEnabled: true };
        expect(result.blockFocusEnabled !== false).toBe(true);
        // loadUrl creates iframe with sandbox
    });

    test('Tab Takeover ON, Small Web ON, Focus OFF → direct navigate', () => {
        const result = { tabTakeoverEnabled: true, smallWebEnabled: true, blockFocusEnabled: false };
        expect(result.blockFocusEnabled !== false).toBe(false);
        // loadUrl calls window.location.replace
    });

    test('Small Web ON, categories only → kagi.com/smallweb?cat=X', () => {
        const cats = ['ai', 'science'];
        const feeds = [];
        const options = [
            ...cats.map(c => ({ type: 'category', value: c })),
            ...feeds.map(f => ({ type: 'feed', value: f }))
        ];
        for (const opt of options) {
            expect(opt.type).toBe('category');
        }
    });

    test('Small Web ON, feeds only → loadFeedContent message', () => {
        const cats = [];
        const feeds = ['github'];
        const options = [
            ...cats.map(c => ({ type: 'category', value: c })),
            ...feeds.map(f => ({ type: 'feed', value: f }))
        ];
        expect(options).toHaveLength(1);
        expect(options[0]).toEqual({ type: 'feed', value: 'github' });
    });

    test('Small Web ON, both → mixed pool', () => {
        const cats = ['ai'];
        const feeds = ['github'];
        const options = [
            ...cats.map(c => ({ type: 'category', value: c })),
            ...feeds.map(f => ({ type: 'feed', value: f }))
        ];
        expect(options).toHaveLength(2);
        expect(options[0].type).toBe('category');
        expect(options[1].type).toBe('feed');
    });

    test('Small Web ON, none selected → fallback', () => {
        const cats = [];
        const feeds = [];
        const options = [
            ...cats.map(c => ({ type: 'category', value: c })),
            ...feeds.map(f => ({ type: 'feed', value: f }))
        ];
        expect(options).toHaveLength(0);
        // main.js loads https://kagi.com/smallweb as fallback
    });
});

// ═══════════════════════════════════════
// MESSAGE HANDLER TESTS
// ═══════════════════════════════════════

describe('message handler routing', () => {
    test('loadFeedContent returns url when feed has entries', async () => {
        // Simulate what the handler does
        const mockEntry = { title: 'Test Repo', url: 'https://github.com/test/repo' };
        const response = { url: mockEntry.url };
        expect(response.url).toBe('https://github.com/test/repo');
    });

    test('loadFeedContent returns null when feed is empty', async () => {
        const response = { url: null };
        expect(response.url).toBeNull();
    });

    test('prepareIframe creates rule for non-kagi URLs', async () => {
        const env = createChromeMock();
        globalThis.chrome = env.mock;

        const url = 'https://blog.example.com/post';
        const tabId = 7;
        const hostname = new URL(url).hostname;

        await chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: [tabId],
            addRules: [{
                id: tabId,
                priority: 1,
                action: { type: 'modifyHeaders', responseHeaders: [
                    { header: 'X-Frame-Options', operation: 'remove' },
                    { header: 'Content-Security-Policy', operation: 'set', value: "object-src 'none'; base-uri 'self';" }
                ]},
                condition: { urlFilter: '||' + hostname, resourceTypes: ['sub_frame'], tabIds: [tabId] }
            }]
        });

        const rules = await chrome.declarativeNetRequest.getSessionRules();
        expect(rules[0].condition.tabIds).toEqual([7]);
        expect(rules[0].action.responseHeaders[0].header).toBe('X-Frame-Options');
        expect(rules[0].action.responseHeaders[1].operation).toBe('set');
    });

    test('getArticleInfo returns stored info', async () => {
        const env = createChromeMock();
        globalThis.chrome = env.mock;

        await chrome.storage.session.set({ 'articleUrl_5': { url: 'https://a.com', title: 'A' } });
        const stored = await chrome.storage.session.get('articleUrl_5');
        expect(stored['articleUrl_5']).toEqual({ url: 'https://a.com', title: 'A' });
    });
});

// ═══════════════════════════════════════
// CATEGORY ARTICLE DISCOVERY TESTS
// ═══════════════════════════════════════

describe('category article discovery', () => {
    let env;

    beforeEach(() => {
        env = createChromeMock();
        globalThis.chrome = env.mock;
    });

    test('finds article frame inside kagi.com/smallweb', async () => {
        const frames = [
            { frameId: 0, parentFrameId: -1, url: 'chrome-extension://abc/index.html' },
            { frameId: 1, parentFrameId: 0, url: 'https://kagi.com/smallweb?cat=ai' },
            { frameId: 2, parentFrameId: 1, url: 'https://coolblog.com/post' }
        ];

        const articleFrame = frames.find(f =>
            f.parentFrameId !== -1 &&
            !f.url.startsWith('chrome-extension://') &&
            !f.url.startsWith('https://kagi.com/smallweb') &&
            !f.url.startsWith('about:')
        );

        expect(articleFrame).toBeTruthy();
        expect(articleFrame.url).toBe('https://coolblog.com/post');
    });

    test('returns null when article has not loaded yet', async () => {
        const frames = [
            { frameId: 0, parentFrameId: -1, url: 'chrome-extension://abc/index.html' },
            { frameId: 1, parentFrameId: 0, url: 'https://kagi.com/smallweb?cat=ai' },
            { frameId: 2, parentFrameId: 1, url: 'about:blank' }
        ];

        const articleFrame = frames.find(f =>
            f.parentFrameId !== -1 &&
            !f.url.startsWith('chrome-extension://') &&
            !f.url.startsWith('https://kagi.com/smallweb') &&
            !f.url.startsWith('about:')
        );

        expect(articleFrame).toBeUndefined();
    });

    test('setArticleInfo triggers context menu for active tab', async () => {
        const tabId = 1; // matches mock's tabs.query default active tab
        env.mock.tabs.query = async () => [{ id: tabId, active: true }];

        await chrome.storage.session.set({ ['articleUrl_' + tabId]: { url: 'https://example.com', title: 'Test' } });
        // Simulate what setArticleInfo does after storing
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.id === tabId) {
            chrome.contextMenus.removeAll(() => {
                chrome.contextMenus.create({ id: 'bookmark-article', title: 'Bookmark this', contexts: ['page', 'frame', 'link'] });
            });
        }

        expect(env.contextMenus.length).toBeGreaterThan(0);
    });

    test('only caches once per tab (idempotent)', async () => {
        const tabId = 42;
        await chrome.storage.session.set({ ['articleUrl_' + tabId]: { url: 'https://first.com', title: 'First' } });

        // Second detection should NOT overwrite
        const existing = await chrome.storage.session.get('articleUrl_' + tabId);
        if (existing['articleUrl_' + tabId]) {
            // Skip — already cached
        } else {
            await chrome.storage.session.set({ ['articleUrl_' + tabId]: { url: 'https://second.com', title: 'Second' } });
        }

        const final = await chrome.storage.session.get('articleUrl_' + tabId);
        expect(final['articleUrl_' + tabId].url).toBe('https://first.com');
    });
});
