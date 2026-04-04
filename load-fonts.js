// Auto-load fonts from fonts/font.config.json.
// Supports both variable fonts (single file, weight range) and
// static fonts (one file per weight).
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

        if (config.variable && config.file) {
            // Variable font: single file covers all weights
            const url = chrome.runtime.getURL('fonts/' + config.file);
            const face = new FontFace(family, "url('" + url + "')", {
                weight: '400 700',
                style: 'normal'
            });
            await face.load();
            document.fonts.add(face);
        } else {
            // Static fonts: one file per weight
            const prefix = config.prefix;
            for (const [suffix, weight] of WEIGHTS) {
                try {
                    const url = chrome.runtime.getURL('fonts/' + prefix + '-' + suffix + '.ttf');
                    const face = new FontFace(family, "url('" + url + "')", {
                        weight: String(weight),
                        style: 'normal'
                    });
                    await face.load();
                    document.fonts.add(face);
                } catch (e) {
                    // Font file doesn't exist for this weight — skip
                }
            }
        }

        document.documentElement.style.setProperty('--font-family', "'" + family + "'");
    } catch (e) {
        // Falls back to system-ui via CSS var default
    }
})();
