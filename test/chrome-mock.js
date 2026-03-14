// Minimal Chrome extension API mock for testing background.js logic
export function createChromeMock() {
    const sessionStore = {};
    const localStore = {};
    const syncStore = {};
    const sessionRules = [];
    const registeredScripts = [];
    const contextMenus = [];
    const listeners = {};

    function addListener(event) {
        if (!listeners[event]) listeners[event] = [];
        return { addListener: (fn) => listeners[event].push(fn) };
    }

    function fireEvent(event, ...args) {
        (listeners[event] || []).forEach(fn => fn(...args));
    }

    const mock = {
        storage: {
            session: {
                get: async (key) => {
                    if (typeof key === 'string') return { [key]: sessionStore[key] };
                    const result = {};
                    for (const k of (Array.isArray(key) ? key : Object.keys(key))) {
                        if (sessionStore[k] !== undefined) result[k] = sessionStore[k];
                    }
                    return result;
                },
                set: async (obj) => { Object.assign(sessionStore, obj); },
                remove: async (key) => { delete sessionStore[key]; },
            },
            local: {
                get: async (key) => {
                    if (typeof key === 'string') return { [key]: localStore[key] };
                    const result = {};
                    for (const k of (Array.isArray(key) ? key : [key])) {
                        if (localStore[k] !== undefined) result[k] = localStore[k];
                    }
                    return result;
                },
                set: async (obj) => { Object.assign(localStore, obj); },
            },
            sync: {
                get: (keys, cb) => {
                    const result = {};
                    for (const k of (Array.isArray(keys) ? keys : [keys])) {
                        if (syncStore[k] !== undefined) result[k] = syncStore[k];
                    }
                    if (cb) cb(result);
                    return Promise.resolve(result);
                },
                set: (obj, cb) => { Object.assign(syncStore, obj); if (cb) cb(); },
            },
            onChanged: addListener('storage.onChanged'),
        },
        declarativeNetRequest: {
            updateSessionRules: async ({ removeRuleIds = [], addRules = [] } = {}) => {
                for (const id of removeRuleIds) {
                    const idx = sessionRules.findIndex(r => r.id === id);
                    if (idx !== -1) sessionRules.splice(idx, 1);
                }
                sessionRules.push(...addRules);
            },
            getSessionRules: async () => [...sessionRules],
        },
        scripting: {
            registerContentScripts: async (scripts) => {
                for (const s of scripts) {
                    const idx = registeredScripts.findIndex(r => r.id === s.id);
                    if (idx !== -1) throw new Error('Script already registered: ' + s.id);
                    registeredScripts.push(s);
                }
            },
            unregisterContentScripts: async ({ ids }) => {
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
            removeAll: (cb) => { contextMenus.length = 0; if (cb) cb(); },
            create: (opts) => { contextMenus.push(opts); },
        },
        tabs: {
            query: async (q) => [{ id: 1, active: true }],
            get: async (tabId) => ({ id: tabId, active: true }),
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
            create: async (opts) => ({ id: 'new', ...opts }),
            search: (opts, cb) => { if (cb) cb([]); },
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
