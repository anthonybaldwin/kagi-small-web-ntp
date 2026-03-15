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

const FEED_TYPES = [
    { slug: 'blogs', emoji: '\uD83D\uDCDD', name: 'Blogs' },
    { slug: 'appreciated', emoji: '\u2B50', name: 'Appreciated' },
    { slug: 'youtube', emoji: '\uD83C\uDFAC', name: 'Videos' },
    { slug: 'github', emoji: '\uD83D\uDCBB', name: 'Code' },
    { slug: 'comics', emoji: '\uD83C\uDFA8', name: 'Comics' },
];

const container = document.getElementById('categoriesContainer');
const feedsContainer = document.getElementById('feedsContainer');
const tabBar = document.getElementById('tabBar');
const tabBtns = tabBar.querySelectorAll('.tab-btn');
const tabTakeoverToggle = document.getElementById('tabTakeoverToggle');
const blockFocusToggle = document.getElementById('blockFocusToggle');
const blockFocusToggleRow = document.getElementById('blockFocusToggleRow');
const toggle = document.getElementById('smallWebToggle');
const smallWebToggleRow = document.getElementById('smallWebToggleRow');
const directModeToggle = document.getElementById('directModeToggle');
const directModeRow = document.getElementById('directModeRow');
const urlSection = document.getElementById('urlSection');
const customUrlInput = document.getElementById('customUrl');
let selectedCategories = new Set();
let selectedFeeds = new Set();
let activeTab = 'categories';

// ── Tab switching ──
function updateTabCounts() {
    tabBtns.forEach(btn => {
        if (btn.dataset.tab === 'categories') {
            btn.textContent = 'Categories (' + selectedCategories.size + ')';
        } else {
            btn.textContent = 'Feeds (' + selectedFeeds.size + ')';
        }
    });
}

function switchTab(tab) {
    activeTab = tab;
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
    container.classList.toggle('visible', activeTab === 'categories');
    feedsContainer.classList.toggle('visible', activeTab === 'feeds');
    chrome.storage.local.set({ lastPopupTab: activeTab });
}

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ── Build Categories UI ──
function buildUI() {
    container.replaceChildren();
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

    buildFeedsUI();
    updateTabCounts();
    // Sync tab button states with activeTab (may have been restored from storage)
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
    updateSections();
}

// ── Build Feeds UI ──
function buildFeedsUI() {
    feedsContainer.replaceChildren();

    const groupEl = document.createElement('div');
    groupEl.className = 'cat-group';

    const header = document.createElement('div');
    header.className = 'cat-group-header';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'cat-group-label';
    labelSpan.textContent = 'Feed Types';

    const actionsSpan = document.createElement('span');
    actionsSpan.className = 'cat-group-actions';

    const allBtn = document.createElement('button');
    allBtn.textContent = 'All';
    const noneBtn = document.createElement('button');
    noneBtn.textContent = 'None';

    actionsSpan.appendChild(allBtn);
    actionsSpan.appendChild(noneBtn);
    header.appendChild(labelSpan);
    header.appendChild(actionsSpan);
    groupEl.appendChild(header);

    allBtn.addEventListener('click', () => {
        FEED_TYPES.forEach(f => selectedFeeds.add(f.slug));
        updateFeedCheckboxes();
        saveFeeds();
    });
    noneBtn.addEventListener('click', () => {
        selectedFeeds.clear();
        updateFeedCheckboxes();
        saveFeeds();
    });

    const grid = document.createElement('div');
    grid.className = 'cat-grid';

    FEED_TYPES.forEach(feed => {
        const label = document.createElement('label');
        label.className = 'cat-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.feed = feed.slug;
        checkbox.checked = selectedFeeds.has(feed.slug);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'cat-name';
        nameSpan.textContent = feed.emoji + ' ' + feed.name;

        label.appendChild(checkbox);
        label.appendChild(nameSpan);

        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                selectedFeeds.add(feed.slug);
            } else {
                selectedFeeds.delete(feed.slug);
            }
            saveFeeds();
        });
        grid.appendChild(label);
    });

    groupEl.appendChild(grid);
    feedsContainer.appendChild(groupEl);
}

function updateCheckboxes() {
    container.querySelectorAll('input[data-slug]').forEach(cb => {
        cb.checked = selectedCategories.has(cb.dataset.slug);
    });
}

function updateFeedCheckboxes() {
    feedsContainer.querySelectorAll('input[data-feed]').forEach(cb => {
        cb.checked = selectedFeeds.has(cb.dataset.feed);
    });
}

function updateSections() {
    const takeoverOn = tabTakeoverToggle.checked;
    const smallWebOn = toggle.checked;

    blockFocusToggleRow.classList.toggle('disabled', !takeoverOn);
    smallWebToggleRow.classList.toggle('disabled', !takeoverOn);
    directModeRow.classList.toggle('disabled', !takeoverOn || !smallWebOn);

    const showTabs = takeoverOn && smallWebOn;
    tabBar.classList.toggle('visible', showTabs);

    if (showTabs) {
        container.classList.toggle('visible', activeTab === 'categories');
        feedsContainer.classList.toggle('visible', activeTab === 'feeds');
    } else {
        container.classList.remove('visible');
        feedsContainer.classList.remove('visible');
    }
    urlSection.classList.toggle('visible', takeoverOn && !smallWebOn);
}

function save() {
    chrome.storage.sync.set({ selectedCategories: [...selectedCategories] });
    updateTabCounts();
}

function saveFeeds() {
    chrome.storage.sync.set({ selectedFeeds: [...selectedFeeds] });
    updateTabCounts();
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

directModeToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ directMode: directModeToggle.checked });
});

customUrlInput.addEventListener('blur', () => {
    const val = customUrlInput.value.trim();
    if (val && !/^https?:\/\//.test(val)) {
        customUrlInput.value = 'https://' + val;
    }
    chrome.storage.sync.set({ customUrl: customUrlInput.value.trim() });
});

customUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        customUrlInput.blur();
    }
});

// ── Init ──
chrome.storage.sync.get(['tabTakeoverEnabled', 'blockFocusEnabled', 'smallWebEnabled', 'directMode', 'selectedCategories', 'selectedFeeds', 'customUrl'], (result) => {
    tabTakeoverToggle.checked = result.tabTakeoverEnabled !== false;
    blockFocusToggle.checked = result.blockFocusEnabled !== false;
    toggle.checked = result.smallWebEnabled || false;
    directModeToggle.checked = result.directMode || false;
    selectedCategories = new Set(result.selectedCategories || []);
    selectedFeeds = new Set(result.selectedFeeds || []);
    customUrlInput.value = result.customUrl ?? '';

    // Pick the right tab: restore last used, or auto-switch to feeds if categories are empty
    chrome.storage.local.get(['lastPopupTab'], (local) => {
        if (selectedCategories.size === 0 && selectedFeeds.size > 0) {
            activeTab = 'feeds';
        } else if (local.lastPopupTab) {
            activeTab = local.lastPopupTab;
        }
        buildUI();

    // ── Action icons: ask background for the cached article info ──
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return;
        chrome.runtime.sendMessage({ action: 'getArticleInfo', tabId: tabs[0].id }, (info) => {
            if (info?.url) {
                setupActionIcons(tabs[0].id, info);
            }
        });
    });

    function setupActionIcons(tabId, article) {
        const articleUrl = article.url;
        const knownTitle = article.title;

        // ── Bookmark Star ──
        const star = document.getElementById('bookmarkStar');
        let bookmarkId = null;

        function updateStar() {
            chrome.bookmarks.search({ url: articleUrl }, (results) => {
                const exact = results.filter(b => b.url === articleUrl);
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
                // Delegate to background which knows how to create the right subfolder
                chrome.runtime.sendMessage({
                    action: 'bookmarkArticle',
                    url: articleUrl,
                    title: knownTitle || articleUrl,
                    source: article.source
                }, () => updateStar());
            }
        });

        star.style.display = 'block';
        updateStar();

        // ── Reading List Book ──
        const bookBtn = document.getElementById('readingListBtn');
        let inReadingList = false;

        async function updateBook() {
            try {
                const entries = await chrome.readingList.query({ url: articleUrl });
                inReadingList = entries.length > 0;
            } catch (e) {
                inReadingList = false;
            }
            bookBtn.src = inReadingList ? 'icons/book-filled.svg' : 'icons/book-empty.svg';
            bookBtn.classList.toggle('active', inReadingList);
            bookBtn.title = inReadingList ? 'Remove from Reading List' : 'Add to Reading List';
        }

        bookBtn.addEventListener('click', async () => {
            if (inReadingList) {
                try { await chrome.readingList.removeEntry({ url: articleUrl }); } catch (e) {}
            } else {
                const title = knownTitle || articleUrl;
                try { await chrome.readingList.addEntry({ url: articleUrl, title, hasBeenRead: false }); } catch (e) {}
            }
            updateBook();
        });

        bookBtn.style.display = 'block';
        updateBook();

        // ── Appreciate Heart ──
        const heartBtn = document.getElementById('appreciateBtn');
        let appreciated = false;

        heartBtn.addEventListener('click', async () => {
            if (appreciated) return;
            chrome.runtime.sendMessage({ action: 'appreciatePost', url: articleUrl }, (response) => {
                if (response?.success) {
                    appreciated = true;
                    heartBtn.src = 'icons/heart-filled.svg';
                    heartBtn.classList.add('active');
                    heartBtn.title = 'Appreciated!';
                }
            });
        });

        heartBtn.style.display = 'block';
    }
    }); // chrome.storage.local.get
});
