const query = new URLSearchParams(location.search).get('q');
if (query) {
    chrome.runtime.sendMessage({ action: 'searchDefault', query });
} else {
    history.back();
}
