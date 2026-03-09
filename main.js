// Check settings and load Kagi or Kagi Small Web in a full-viewport iframe
chrome.storage.sync.get(['smallWebEnabled', 'selectedCategories', 'customUrl'], (result) => {
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

    const iframe = document.createElement('iframe');
    iframe.src = url;
    document.body.appendChild(iframe);
});
