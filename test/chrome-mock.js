// Minimal Chrome extension API mock for testing background.js logic
export function createChromeMock() {
    // The mock stands in for a large API surface, so the stores stay loosely
    // typed — the tests, not the compiler, pin down their shapes.
    /** @type {Record<string, any>} */
    const sessionStore = {};
    /** @type {Record<string, any>} */
    const localStore = {};
    /** @type {Record<string, any>} */
    const syncStore = {};
    /** @type {any[]} */
    const sessionRules = [];
    /** @type {any[]} */
    const registeredScripts = [];
    /** @type {any[]} */
    const contextMenus = [];
    /** @type {Record<string, Function[]>} */
    const listeners = {};

    /** @param {string} event */
    function addListener(event) {
        const queue = listeners[event] ?? (listeners[event] = []);
        return { addListener: (/** @type {Function} */ fn) => queue.push(fn) };
    }

    /**
     * @param {string} event
     * @param {...any} args
     */
    function fireEvent(event, ...args) {
        (listeners[event] || []).forEach(fn => fn(...args));
    }

    const mock = {
        storage: {
            session: {
                get: async (/** @type {string | string[] | Record<string, any>} */ key) => {
                    if (typeof key === 'string') return { [key]: sessionStore[key] };
                    /** @type {Record<string, any>} */
                    const result = {};
                    for (const k of (Array.isArray(key) ? key : Object.keys(key))) {
                        if (sessionStore[k] !== undefined) result[k] = sessionStore[k];
                    }
                    return result;
                },
                set: async (/** @type {Record<string, any>} */ obj) => { Object.assign(sessionStore, obj); },
                remove: async (/** @type {string} */ key) => { delete sessionStore[key]; },
            },
            local: {
                get: async (/** @type {string | string[]} */ key) => {
                    if (typeof key === 'string') return { [key]: localStore[key] };
                    /** @type {Record<string, any>} */
                    const result = {};
                    for (const k of (Array.isArray(key) ? key : [key])) {
                        if (localStore[k] !== undefined) result[k] = localStore[k];
                    }
                    return result;
                },
                set: async (/** @type {Record<string, any>} */ obj) => { Object.assign(localStore, obj); },
            },
            sync: {
                get: (/** @type {string | string[]} */ keys, /** @type {Function} */ cb) => {
                    /** @type {Record<string, any>} */
                    const result = {};
                    for (const k of (Array.isArray(keys) ? keys : [keys])) {
                        if (syncStore[k] !== undefined) result[k] = syncStore[k];
                    }
                    if (cb) cb(result);
                    return Promise.resolve(result);
                },
                set: (/** @type {Record<string, any>} */ obj, /** @type {Function} */ cb) => { Object.assign(syncStore, obj); if (cb) cb(); },
            },
            onChanged: addListener('storage.onChanged'),
        },
        declarativeNetRequest: {
            updateSessionRules: async (/** @type {{ removeRuleIds?: number[], addRules?: any[] }} */ { removeRuleIds = [], addRules = [] } = {}) => {
                for (const id of removeRuleIds) {
                    const idx = sessionRules.findIndex(r => r.id === id);
                    if (idx !== -1) sessionRules.splice(idx, 1);
                }
                sessionRules.push(...addRules);
            },
            getSessionRules: async () => [...sessionRules],
        },
        scripting: {
            registerContentScripts: async (/** @type {any[]} */ scripts) => {
                for (const s of scripts) {
                    const idx = registeredScripts.findIndex(r => r.id === s.id);
                    if (idx !== -1) throw new Error('Script already registered: ' + s.id);
                    registeredScripts.push(s);
                }
            },
            unregisterContentScripts: async (/** @type {{ ids: string[] }} */ { ids }) => {
                let found = false;
                for (const id of ids) {
                    const idx = registeredScripts.findIndex(r => r.id === id);
                    if (idx !== -1) { registeredScripts.splice(idx, 1); found = true; }
                }
                if (!found) throw new Error('Nonexistent script ID');
            },
            executeScript: async () => [{ result: 'Mock Page Title' }],
        },
        contextMenus: {
            removeAll: (/** @type {Function} */ cb) => { contextMenus.length = 0; if (cb) cb(); },
            create: (/** @type {any} */ opts) => { contextMenus.push(opts); },
        },
        tabs: {
            query: async (/** @type {any} */ q) => [{ id: 1, active: true }],
            get: async (/** @type {number} */ tabId) => ({ id: tabId, active: true }),
            update: async () => {},
            onActivated: addListener('tabs.onActivated'),
            onUpdated: addListener('tabs.onUpdated'),
            onRemoved: addListener('tabs.onRemoved'),
        },
        webNavigation: {
            getAllFrames: async () => [],
            onCompleted: addListener('webNavigation.onCompleted'),
            onCommitted: addListener('webNavigation.onCommitted'),
        },
        runtime: {
            onInstalled: addListener('runtime.onInstalled'),
            onStartup: addListener('runtime.onStartup'),
            onMessage: addListener('runtime.onMessage'),
            sendMessage: async () => {},
            id: 'test-extension-id',
        },
        action: {
            setIcon: async () => {},
        },
        bookmarks: {
            getTree: async () => [{ children: [{ id: '1', title: 'Bookmarks Bar', children: [] }] }],
            getChildren: async () => [],
            create: async (/** @type {any} */ opts) => ({ id: 'new', ...opts }),
            search: (/** @type {any} */ opts, /** @type {Function} */ cb) => { if (cb) cb([]); },
            remove: async () => {},
        },
        readingList: {
            query: async () => [],
            addEntry: async () => {},
            removeEntry: async () => {},
        },
    };

    return {
        mock,
        sessionStore,
        localStore,
        syncStore,
        sessionRules,
        registeredScripts,
        contextMenus,
        fireEvent,
    };
}
