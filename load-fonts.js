// Auto-load fonts from fonts/font.config.json.
// Set "family" (display name) and "prefix" (filename prefix).
// The loader registers fonts for the weights bundled in fonts/.
(async function () {
    const WEIGHTS = [
        ['Regular', 400],
        ['Medium', 500],
        ['SemiBold', 600],
        ['Bold', 700]
    ];

    try {
        const resp = await fetch(chrome.runtime.getURL('fonts/font.config.json'));
        const config = await resp.json();
        const family = config.family;
        const prefix = config.prefix;

        for (const [suffix, weight] of WEIGHTS) {
            try {
                const url = chrome.runtime.getURL(`fonts/${prefix}-${suffix}.ttf`);
                const face = new FontFace(family, `url('${url}')`, {
                    weight: String(weight),
                    style: 'normal'
                });
                await face.load();
                document.fonts.add(face);
            } catch (e) {
                // Font file doesn't exist for this weight — skip
            }
        }

        document.documentElement.style.setProperty('--font-family', `'${family}'`);
    } catch (e) {
        // Falls back to system-ui via CSS var default
    }
})();
