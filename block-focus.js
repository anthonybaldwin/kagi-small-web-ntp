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
})();
