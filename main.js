chrome.storage.sync.get(
    ['tabTakeoverEnabled', 'blockFocusEnabled', 'smallWebEnabled', 'selectedCategories', 'selectedFeeds', 'customUrl'],
    (result) => {
        if (result.tabTakeoverEnabled === false) {
            chrome.runtime.sendMessage({ action: 'restoreDefaultNTP' });
            return;
        }
        document.body.style.display = '';

        if (result.smallWebEnabled) {
            const cats = result.selectedCategories || [];
            const feeds = result.selectedFeeds || [];
            const options = [
                ...cats.map(c => ({ type: 'category', value: c })),
                ...feeds.map(f => ({ type: 'feed', value: f }))
            ];

            if (options.length === 0) {
                loadUrl('https://kagi.com/smallweb', result.blockFocusEnabled);
                return;
            }

            const pick = options[Math.floor(Math.random() * options.length)];

            if (pick.type === 'category') {
                loadUrl('https://kagi.com/smallweb?cat=' + pick.value, result.blockFocusEnabled);
            } else {
                // One message: fetch entry + prepare iframe + cache article info
                chrome.runtime.sendMessage({ action: 'loadFeedContent', feed: pick.value }, (response) => {
                    loadUrl(response?.url || 'https://kagi.com/smallweb', result.blockFocusEnabled);
                });
            }
        } else {
            const url = result.customUrl || 'https://kagi.com';
            chrome.runtime.sendMessage({ action: 'prepareIframe', url }, () => {
                loadUrl(url, result.blockFocusEnabled);
            });
        }
    }
);

function loadUrl(url, blockFocusEnabled) {
    if (blockFocusEnabled !== false) {
        const iframe = document.createElement('iframe');
        iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups';
        iframe.src = url;
        document.body.appendChild(iframe);

        // Any link click or Escape inside the iframe breaks out to the real page.
        // This restores full cookie/auth access and normal browsing.
        window.addEventListener('message', (e) => {
            if (e.data?.type === 'kagi-navigate' && e.data.url) {
                window.location.replace(e.data.url);
            }
        });
    } else {
        window.location.replace(url);
    }
}
