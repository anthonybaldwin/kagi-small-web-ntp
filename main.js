// Check settings and load Kagi or Kagi Small Web in a full-viewport iframe
chrome.storage.sync.get(['tabTakeoverEnabled', 'blockFocusEnabled', 'smallWebEnabled', 'selectedCategories', 'customUrl'], (result) => {
    if (result.tabTakeoverEnabled === false) {
        chrome.runtime.sendMessage({ action: 'restoreDefaultNTP' });
        return;
    }
    document.body.style.display = '';

    let url;
    if (result.smallWebEnabled) {
        const cats = result.selectedCategories || [];
        if (cats.length > 0) {
            const randomCat = cats[Math.floor(Math.random() * cats.length)];
            url = 'https://kagi.com/smallweb?cat=' + randomCat;
        } else {
            url = 'https://kagi.com/smallweb';
        }
    } else {
        url = result.customUrl || 'https://kagi.com';
    }

    if (result.blockFocusEnabled !== false) {
        // Iframe mode: load in iframe with focus blocking
        const iframe = document.createElement('iframe');
        iframe.src = url;
        document.body.appendChild(iframe);
    } else {
        // Direct mode: navigate straight to the URL
        window.location.replace(url);
    }
});
