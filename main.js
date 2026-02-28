// Check settings and redirect to Kagi or Kagi Small Web with a random category
chrome.storage.sync.get(['smallWebEnabled', 'selectedCategories', 'customUrl'], (result) => {
    if (result.smallWebEnabled) {
        const cats = result.selectedCategories || [];
        if (cats.length > 0) {
            const randomCat = cats[Math.floor(Math.random() * cats.length)];
            window.location.replace('https://kagi.com/smallweb?cat=' + randomCat);
        } else {
            window.location.replace('https://kagi.com/smallweb');
        }
    } else {
        const url = result.customUrl;
        window.location.replace(url || 'https://kagi.com');
    }
});
