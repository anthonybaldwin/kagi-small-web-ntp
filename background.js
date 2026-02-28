const ALL_CATEGORIES = [
    'ai', 'science', 'programming', 'diy', 'tech', 'hardware', 'infra', 'web',
    'health', 'art', 'essays', 'humanities', 'retro', 'photography', 'culture', 'gaming',
    'society', 'life', 'food', 'travel', 'politics', 'economy'
];

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(['smallWebEnabled', 'selectedCategories', 'customUrl'], (result) => {
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
        id: 'toggle-smallweb',
        title: 'Use Kagi Small Web for New Tab',
        type: 'checkbox',
        checked: false,
        contexts: ['all']
    });

    chrome.storage.sync.get(['smallWebEnabled'], (result) => {
        chrome.contextMenus.update('toggle-smallweb', {
            checked: result.smallWebEnabled || false
        });
    });
});

chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === 'toggle-smallweb') {
        chrome.storage.sync.set({ smallWebEnabled: info.checked });
    }
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.smallWebEnabled) {
        chrome.contextMenus.update('toggle-smallweb', {
            checked: changes.smallWebEnabled.newValue
        });
        updateIcon(changes.smallWebEnabled.newValue);
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
chrome.storage.sync.get(['smallWebEnabled'], (result) => {
    updateIcon(result.smallWebEnabled || false);
});
