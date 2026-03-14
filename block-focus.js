// Block all focus-stealing during page load. Runs at document_start in MAIN world.
(function () {
    const BLOCK_MS = 2000;

    // 1. Override .focus() on all relevant prototypes so script calls are no-ops
    const prototypes = [HTMLElement.prototype, HTMLInputElement.prototype, HTMLTextAreaElement.prototype];
    const originals = prototypes.map(p => p.focus);
    prototypes.forEach(p => { p.focus = function () {}; });

    // 2. Strip autofocus attributes as elements are added to the DOM
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType === 1) {
                    if (node.hasAttribute('autofocus')) node.removeAttribute('autofocus');
                    node.querySelectorAll?.('[autofocus]').forEach(el => el.removeAttribute('autofocus'));
                }
            }
        }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // 3. Once the page has loaded, blur and push focus to the omnibar
    window.addEventListener('load', () => {
        if (document.activeElement && document.activeElement !== document.body) {
            document.activeElement.blur();
        }
        window.blur();
    });

    // Restore everything after the blocking window
    setTimeout(() => {
        prototypes.forEach((p, i) => { p.focus = originals[i]; });
        observer.disconnect();
    }, BLOCK_MS);

    // When inside an iframe, intercept navigation to break out of the sandbox.
    // Link clicks navigate the top-level page (restoring full cookies/auth).
    // Escape key does the same for the current page.
    if (window.top !== window) {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (!link) return;
            if (link.target === '_blank') return; // let popups open normally
            if (!link.href.startsWith('http')) return;
            e.preventDefault();
            e.stopPropagation();
            window.top.postMessage({ type: 'kagi-navigate', url: link.href }, '*');
        }, true);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                window.top.postMessage({ type: 'kagi-navigate', url: window.location.href }, '*');
            }
        });
    }
})();
