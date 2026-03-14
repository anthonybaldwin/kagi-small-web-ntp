// Back button: restore param means user pressed Back — redirect straight to the article
const restoreUrl = new URLSearchParams(window.location.search).get('restore');
if (restoreUrl) {
    window.location.replace(restoreUrl);
}

if (!restoreUrl) chrome.storage.sync.get(
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
                    if (response?.youtube && result.blockFocusEnabled !== false) {
                        showYouTubeCard(response.url, response.title, response.videoId);
                    } else {
                        loadUrl(response?.url || 'https://kagi.com/smallweb', result.blockFocusEnabled);
                    }
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

function showYouTubeCard(url, title, videoId) {
    const thumbUrl = 'https://img.youtube.com/vi/' + videoId + '/maxresdefault.jpg';
    document.body.style.cssText = 'margin:0;background:#0f0f10;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui,sans-serif;overflow:hidden;';

    // Full-bleed blurred background
    const bg = document.createElement('div');
    bg.style.cssText = 'position:fixed;inset:-20px;background:url(' + thumbUrl + ') center/cover no-repeat;filter:blur(30px) brightness(0.3);z-index:0;';
    const card = document.createElement('a');
    card.href = url;
    card.style.cssText = 'display:block;text-decoration:none;position:relative;max-width:1200px;width:95%;z-index:1;';

    const img = document.createElement('img');
    img.src = 'https://img.youtube.com/vi/' + videoId + '/maxresdefault.jpg';
    img.style.cssText = 'width:100%;display:block;border-radius:16px;';
    img.onerror = () => { img.src = 'https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg'; };

    // Official YouTube play button SVG (red rounded rect + white triangle)
    const ns = 'http://www.w3.org/2000/svg';
    const playSvg = document.createElementNS(ns, 'svg');
    playSvg.setAttribute('viewBox', '0 0 68 48');
    playSvg.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);cursor:pointer;width:min(10vw,100px);height:auto;transition:transform 0.15s ease;';
    card.onmouseenter = () => { rect.setAttribute('fill', '#ff0000'); playSvg.style.transform = 'translate(-50%,-50%) scale(1.1)'; };
    card.onmouseleave = () => { rect.setAttribute('fill', 'rgba(255,0,0,0.85)'); playSvg.style.transform = 'translate(-50%,-50%) scale(1)'; };
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('width', '68');
    rect.setAttribute('height', '48');
    rect.setAttribute('rx', '14');
    rect.setAttribute('fill', 'rgba(255,0,0,0.85)');
    const tri = document.createElementNS(ns, 'path');
    tri.setAttribute('d', 'M27 14l18 10-18 10z');
    tri.setAttribute('fill', 'white');
    playSvg.appendChild(rect);
    playSvg.appendChild(tri);

    // Title bar
    const bar = document.createElement('div');
    bar.style.cssText = 'position:absolute;bottom:0;left:0;right:0;padding:20px 24px;background:linear-gradient(transparent,rgba(0,0,0,0.8));border-radius:0 0 16px 16px;color:#fff;display:flex;align-items:center;gap:12px;';
    const ytLogo = document.createElement('img');
    ytLogo.src = 'https://www.youtube.com/s/desktop/logo/yt_logo_mono_dark.svg';
    ytLogo.style.cssText = 'height:16px;opacity:0.9;flex-shrink:0;';
    ytLogo.onerror = () => { ytLogo.style.display = 'none'; };
    const titleEl = document.createElement('div');
    titleEl.textContent = title || 'YouTube Video';
    titleEl.style.cssText = 'font-size:16px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    bar.appendChild(ytLogo);
    bar.appendChild(titleEl);

    card.appendChild(img);
    card.appendChild(playSvg);
    card.appendChild(bar);
    document.body.appendChild(bg);
    document.body.appendChild(card);
}

function loadUrl(url, blockFocusEnabled) {
    if (blockFocusEnabled !== false) {
        const iframe = document.createElement('iframe');
        iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups';
        iframe.src = url;
        document.body.appendChild(iframe);

        // Link clicks and Escape break out of the iframe.
        window.addEventListener('message', (e) => {
            if (e.data?.type === 'kagi-navigate' && e.data.url) {
                // Push the original article URL into our NTP's history so Back restores it
                history.pushState(null, '', 'index.html?restore=' + encodeURIComponent(iframe.src));
                window.location.href = e.data.url;
            }
        });

        // Subtle hint for feed pages (not kagi.com which handles framing natively)
        if (!url.startsWith('https://kagi.com/')) {
            const hint = document.createElement('div');
            hint.textContent = 'Viewing in iframe \u2014 press Esc or click any link to open directly';
            hint.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);padding:8px 14px;background:rgba(140,207,205,0.9);color:#0f0f10;font:12px/1 system-ui,sans-serif;font-weight:600;border-radius:8px;z-index:9999;transition:opacity 0.5s;pointer-events:none;';
            document.body.appendChild(hint);
            setTimeout(() => { hint.style.opacity = '0'; }, 10000);
            setTimeout(() => { hint.remove(); }, 10500);
        }
    } else {
        window.location.replace(url);
    }
}
