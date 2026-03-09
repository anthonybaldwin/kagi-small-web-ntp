const CATEGORY_GROUPS = [
    {
        label: 'Tech & Science',
        categories: [
            { slug: 'ai', emoji: '\u2728', name: 'AI' },
            { slug: 'science', emoji: '\u269B\uFE0F', name: 'Science' },
            { slug: 'programming', emoji: '\uD83E\uDDE9', name: 'Programming' },
            { slug: 'diy', emoji: '\uD83D\uDEE0\uFE0F', name: 'DIY & Making' },
            { slug: 'tech', emoji: '\uD83D\uDCF1', name: 'Technology' },
            { slug: 'hardware', emoji: '\uD83C\uDF9B\uFE0F', name: 'Hardware' },
            { slug: 'infra', emoji: '\uD83D\uDEE1\uFE0F', name: 'Sysadmin & Security' },
            { slug: 'web', emoji: '\uD83D\uDD78\uFE0F', name: 'Web & Internet' },
        ]
    },
    {
        label: 'Culture & Creative',
        categories: [
            { slug: 'health', emoji: '\uD83C\uDFC3', name: 'Health & Fitness' },
            { slug: 'art', emoji: '\uD83C\uDF0A', name: 'Art & Design' },
            { slug: 'essays', emoji: '\uD83E\uDEB6', name: 'Essays' },
            { slug: 'humanities', emoji: '\uD83C\uDFFA', name: 'Humanities' },
            { slug: 'retro', emoji: '\uD83D\uDCBE', name: 'Retro' },
            { slug: 'photography', emoji: '\uD83C\uDF04', name: 'Photography' },
            { slug: 'culture', emoji: '\uD83C\uDFAD', name: 'Pop Culture' },
            { slug: 'gaming', emoji: '\uD83D\uDD79\uFE0F', name: 'Gaming' },
        ]
    },
    {
        label: 'Life & World',
        categories: [
            { slug: 'society', emoji: '\uD83D\uDC65', name: 'Society' },
            { slug: 'life', emoji: '\u2600\uFE0F', name: 'Life & Personal' },
            { slug: 'food', emoji: '\uD83E\uDDD1\u200D\uD83C\uDF73', name: 'Food & Drink' },
            { slug: 'travel', emoji: '\u2708\uFE0F', name: 'Travel & Outdoors' },
            { slug: 'politics', emoji: '\uD83C\uDFA4', name: 'Politics' },
            { slug: 'economy', emoji: '\uD83C\uDFB2', name: 'Economy' },
        ]
    }
];

const container = document.getElementById('categoriesContainer');
const tabTakeoverToggle = document.getElementById('tabTakeoverToggle');
const blockFocusToggle = document.getElementById('blockFocusToggle');
const blockFocusToggleRow = document.getElementById('blockFocusToggleRow');
const toggle = document.getElementById('smallWebToggle');
const smallWebToggleRow = document.getElementById('smallWebToggleRow');
const urlSection = document.getElementById('urlSection');
const customUrlInput = document.getElementById('customUrl');
let selectedCategories = new Set();

function buildUI() {
    container.innerHTML = '';
    CATEGORY_GROUPS.forEach((group, i) => {
        if (i > 0) {
            const divider = document.createElement('div');
            divider.className = 'divider';
            container.appendChild(divider);
        }

        const groupEl = document.createElement('div');
        groupEl.className = 'cat-group';

        const header = document.createElement('div');
        header.className = 'cat-group-header';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'cat-group-label';
        labelSpan.textContent = group.label;

        const actionsSpan = document.createElement('span');
        actionsSpan.className = 'cat-group-actions';

        const allBtn = document.createElement('button');
        allBtn.dataset.action = 'all';
        allBtn.textContent = 'All';

        const noneBtn = document.createElement('button');
        noneBtn.dataset.action = 'none';
        noneBtn.textContent = 'None';

        actionsSpan.appendChild(allBtn);
        actionsSpan.appendChild(noneBtn);
        header.appendChild(labelSpan);
        header.appendChild(actionsSpan);
        groupEl.appendChild(header);

        allBtn.addEventListener('click', () => {
            group.categories.forEach(cat => selectedCategories.add(cat.slug));
            updateCheckboxes();
            save();
        });
        noneBtn.addEventListener('click', () => {
            group.categories.forEach(cat => selectedCategories.delete(cat.slug));
            updateCheckboxes();
            save();
        });

        const grid = document.createElement('div');
        grid.className = 'cat-grid';

        group.categories.forEach(cat => {
            const label = document.createElement('label');
            label.className = 'cat-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.slug = cat.slug;
            checkbox.checked = selectedCategories.has(cat.slug);

            const nameSpan = document.createElement('span');
            nameSpan.className = 'cat-name';
            nameSpan.textContent = cat.emoji + ' ' + cat.name;

            label.appendChild(checkbox);
            label.appendChild(nameSpan);

            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    selectedCategories.add(cat.slug);
                } else {
                    selectedCategories.delete(cat.slug);
                }
                save();
            });
            grid.appendChild(label);
        });

        groupEl.appendChild(grid);
        container.appendChild(groupEl);
    });

    updateSections();
}

function updateCheckboxes() {
    container.querySelectorAll('input[data-slug]').forEach(cb => {
        cb.checked = selectedCategories.has(cb.dataset.slug);
    });
}

function updateSections() {
    const takeoverOn = tabTakeoverToggle.checked;
    const smallWebOn = toggle.checked;

    // When tab takeover is off, disable everything below it
    blockFocusToggleRow.classList.toggle('disabled', !takeoverOn);
    smallWebToggleRow.classList.toggle('disabled', !takeoverOn);
    container.classList.toggle('visible', takeoverOn && smallWebOn);
    urlSection.classList.toggle('visible', takeoverOn && !smallWebOn);
}

function save() {
    chrome.storage.sync.set({ selectedCategories: [...selectedCategories] });
}

tabTakeoverToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ tabTakeoverEnabled: tabTakeoverToggle.checked });
    updateSections();
});

blockFocusToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ blockFocusEnabled: blockFocusToggle.checked });
});

toggle.addEventListener('change', () => {
    chrome.storage.sync.set({ smallWebEnabled: toggle.checked });
    // Auto-enable focus blocking the first time Small Web is turned on
    if (toggle.checked) {
        chrome.storage.sync.get(['blockFocusAutoEnabled'], (result) => {
            if (!result.blockFocusAutoEnabled) {
                chrome.storage.sync.set({ blockFocusEnabled: true, blockFocusAutoEnabled: true });
                blockFocusToggle.checked = true;
            }
        });
    }
    updateSections();
});

customUrlInput.addEventListener('blur', () => {
    chrome.storage.sync.set({ customUrl: customUrlInput.value.trim() });
});

customUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        customUrlInput.blur();
    }
});

chrome.storage.sync.get(['tabTakeoverEnabled', 'blockFocusEnabled', 'smallWebEnabled', 'selectedCategories', 'customUrl'], (result) => {
    tabTakeoverToggle.checked = result.tabTakeoverEnabled !== false;
    blockFocusToggle.checked = result.blockFocusEnabled !== false;
    toggle.checked = result.smallWebEnabled || false;
    selectedCategories = new Set(result.selectedCategories || []);
    customUrlInput.value = result.customUrl ?? '';
    buildUI();

    // Bookmark star: show if active tab is on Small Web
    if (result.tabTakeoverEnabled !== false && result.smallWebEnabled) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) return;
            // Get all frames in the tab to find the Small Web iframe URL
            chrome.webNavigation.getAllFrames({ tabId: tabs[0].id }, (frames) => {
                // Find the article iframe inside Small Web (not the smallweb page itself)
                const articleFrame = frames && frames.find(f =>
                    f.parentFrameId !== -1 &&
                    !f.url.startsWith('chrome-extension://') &&
                    !f.url.startsWith('https://kagi.com/smallweb') &&
                    !f.url.startsWith('about:')
                );
                if (!articleFrame) return;

                const frameUrl = articleFrame.url;
                const star = document.getElementById('bookmarkStar');
                let bookmarkId = null;

                function updateStar() {
                    chrome.bookmarks.search({ url: frameUrl }, (results) => {
                        const exact = results.filter(b => b.url === frameUrl);
                        bookmarkId = exact.length > 0 ? exact[0].id : null;
                        star.src = bookmarkId ? 'icons/star-filled.svg' : 'icons/star-empty.svg';
                        star.classList.toggle('active', !!bookmarkId);
                        star.title = bookmarkId ? 'Remove bookmark' : 'Bookmark this page';
                    });
                }

                star.addEventListener('click', async () => {
                    if (bookmarkId) {
                        chrome.bookmarks.remove(bookmarkId, () => updateStar());
                    } else {
                        // Get or create Small Web folder, then bookmark
                        const tree = await chrome.bookmarks.getTree();
                        const root = tree[0].children;
                        const otherBookmarks = root.find(b => /other bookmarks/i.test(b.title));
                        const bookmarksBar = root.find(b => /bookmarks bar/i.test(b.title));
                        const parentId = (otherBookmarks || bookmarksBar || tree[0]).id;
                        const children = await chrome.bookmarks.getChildren(parentId);
                        const folder = children.find(b => b.title === 'Small Web' && !b.url)
                            || await chrome.bookmarks.create({ parentId, title: 'Small Web' });
                        chrome.bookmarks.create({ parentId: folder.id, title: tabs[0].title || frameUrl, url: frameUrl }, () => updateStar());
                    }
                });

                star.style.display = 'block';
                updateStar();
            });
        });
    }
});
