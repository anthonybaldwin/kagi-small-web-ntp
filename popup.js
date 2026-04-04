const CATEGORY_GROUPS = [
    {
        label: 'Tech & Science',
        categories: [
            { slug: 'ai', emoji: '\u2728', name: 'AI' },
            { slug: 'science', emoji: '\uD83E\uDDEA', name: 'Science' },
            { slug: 'programming', emoji: '\uD83D\uDC8E', name: 'Programming' },
            { slug: 'diy', emoji: '\uD83E\uDE84', name: 'DIY & Making' },
            { slug: 'tech', emoji: '\uD83D\uDDA5\uFE0F', name: 'Technology' },
            { slug: 'hardware', emoji: '\uD83D\uDDC3\uFE0F', name: 'Hardware' },
            { slug: 'infra', emoji: '\uD83D\uDD12', name: 'Sysadmin & Security' },
            { slug: 'web', emoji: '\uD83C\uDF10', name: 'Web & Internet' },
        ]
    },
    {
        label: 'Culture & Creative',
        categories: [
            { slug: 'health', emoji: '\uD83C\uDF3F', name: 'Health & Fitness' },
            { slug: 'art', emoji: '\uD83C\uDFA8', name: 'Art & Design' },
            { slug: 'essays', emoji: '\u270D\uFE0F', name: 'Essays' },
            { slug: 'humanities', emoji: '\uD83C\uDFDB\uFE0F', name: 'Humanities' },
            { slug: 'retro', emoji: '\uD83D\uDCFA', name: 'Retro' },
            { slug: 'photography', emoji: '\uD83D\uDCF7', name: 'Photography' },
            { slug: 'culture', emoji: '\uD83C\uDFAC', name: 'Pop Culture' },
            { slug: 'gaming', emoji: '\uD83C\uDFAE', name: 'Gaming' },
        ]
    },
    {
        label: 'Life & World',
        categories: [
            { slug: 'society', emoji: '\uD83D\uDC65', name: 'Society' },
            { slug: 'life', emoji: '\uD83C\uDF1F', name: 'Life & Personal' },
            { slug: 'food', emoji: '\uD83C\uDF72', name: 'Food & Drink' },
            { slug: 'travel', emoji: '\uD83C\uDFD5\uFE0F', name: 'Travel & Outdoors' },
            { slug: 'politics', emoji: '\uD83C\uDFDB\uFE0F', name: 'Politics' },
            { slug: 'economy', emoji: '\uD83D\uDCC8', name: 'Economy' },
        ]
    }
];

const FEED_TYPES = [
    { slug: 'blogs', name: 'Blogs' },
    { slug: 'appreciated', name: 'Appreciated' },
    { slug: 'youtube', name: 'Videos' },
    { slug: 'github', name: 'Code' },
    { slug: 'comics', name: 'Comics' },
];

const container = document.getElementById('categoriesContainer');
const feedsContainer = document.getElementById('feedsContainer');
const historyContainer = document.getElementById('historyContainer');
const tabBar = document.getElementById('tabBar');
const tabBtns = tabBar.querySelectorAll('.tab-btn');
const tabTakeoverToggle = document.getElementById('tabTakeoverToggle');
const blockFocusToggle = document.getElementById('blockFocusToggle');
const blockFocusToggleRow = document.getElementById('blockFocusToggleRow');
const toggle = document.getElementById('smallWebToggle');
const smallWebToggleRow = document.getElementById('smallWebToggleRow');
const directModeToggle = document.getElementById('directModeToggle');
const directModeRow = document.getElementById('directModeRow');
const bingRedirectToggle = document.getElementById('bingRedirectToggle');
const bingRedirectRow = document.getElementById('bingRedirectRow');
const urlSection = document.getElementById('urlSection');
const customUrlInput = document.getElementById('customUrl');

// Show Bing/Cortana redirect toggle only on Windows
if (navigator.userAgent.includes('Windows')) {
    bingRedirectRow.style.display = '';
}
let selectedCategories = new Set();
let selectedFeeds = new Set();
let activeTab = 'categories';

// ── Tab switching ──
function updateTabCounts() {
    tabBtns.forEach(btn => {
        if (btn.dataset.tab === 'categories') {
            btn.textContent = 'Categories (' + selectedCategories.size + ')';
        } else if (btn.dataset.tab === 'feeds') {
            btn.textContent = 'Feeds (' + selectedFeeds.size + ')';
        }
    });
}

function switchTab(tab) {
    activeTab = tab;
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
    container.classList.toggle('visible', activeTab === 'categories');
    feedsContainer.classList.toggle('visible', activeTab === 'feeds');
    historyContainer.classList.toggle('visible', activeTab === 'history');
    if (activeTab === 'history') buildHistoryUI();
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

        const pills = document.createElement('div');
        pills.className = 'feed-pills';

        group.categories.forEach(cat => {
            const label = document.createElement('label');
            label.className = 'feed-pill' + (selectedCategories.has(cat.slug) ? ' active' : '');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.slug = cat.slug;
            checkbox.checked = selectedCategories.has(cat.slug);

            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(cat.emoji + ' ' + cat.name));

            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    selectedCategories.add(cat.slug);
                } else {
                    selectedCategories.delete(cat.slug);
                }
                label.classList.toggle('active', checkbox.checked);
                save();
            });
            pills.appendChild(label);
        });

        groupEl.appendChild(pills);
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

    const pills = document.createElement('div');
    pills.className = 'feed-pills';

    FEED_TYPES.forEach(feed => {
        const label = document.createElement('label');
        label.className = 'feed-pill' + (selectedFeeds.has(feed.slug) ? ' active' : '');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.feed = feed.slug;
        checkbox.checked = selectedFeeds.has(feed.slug);

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(feed.name));

        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                selectedFeeds.add(feed.slug);
            } else {
                selectedFeeds.delete(feed.slug);
            }
            label.classList.toggle('active', checkbox.checked);
            saveFeeds();
        });
        pills.appendChild(label);
    });

    groupEl.appendChild(pills);
    feedsContainer.appendChild(groupEl);
}

// ── Build History UI ──
function buildHistoryUI() {
    chrome.runtime.sendMessage({ action: 'getHistory' }, (history) => {
        historyContainer.replaceChildren();

        const header = document.createElement('div');
        header.className = 'history-header';

        const label = document.createElement('span');
        label.className = 'history-header-label';
        label.textContent = 'Recent Articles';

        header.appendChild(label);

        if (history.length > 0) {
            const clearBtn = document.createElement('button');
            clearBtn.className = 'history-clear';
            clearBtn.textContent = 'Clear';
            clearBtn.addEventListener('click', () => {
                chrome.runtime.sendMessage({ action: 'clearHistory' }, () => buildHistoryUI());
            });
            header.appendChild(clearBtn);
        }

        historyContainer.appendChild(header);

        if (history.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'history-empty';
            empty.textContent = 'No articles viewed yet';
            historyContainer.appendChild(empty);
            return;
        }

        history.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'history-item';

            const link = document.createElement('a');
            link.className = 'history-item-link';
            link.href = item.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = item.title || item.url;
            link.title = item.url;

            const actions = document.createElement('div');
            actions.className = 'history-item-actions';

            // Bookmark
            const star = document.createElement('img');
            star.className = 'history-action';
            star.src = 'icons/star-empty.svg';
            star.title = 'Bookmark';
            chrome.bookmarks.search({ url: item.url }, (results) => {
                const exact = results.filter(b => b.url === item.url);
                if (exact.length > 0) {
                    star.src = 'icons/star-filled.svg';
                    star.classList.add('done');
                    star.title = 'Bookmarked';
                }
            });
            star.addEventListener('click', () => {
                chrome.bookmarks.search({ url: item.url }, (results) => {
                    const exact = results.filter(b => b.url === item.url);
                    if (exact.length > 0) {
                        chrome.bookmarks.remove(exact[0].id, () => {
                            star.src = 'icons/star-empty.svg';
                            star.classList.remove('done');
                            star.title = 'Bookmark';
                        });
                    } else {
                        chrome.runtime.sendMessage({
                            action: 'bookmarkArticle',
                            url: item.url,
                            title: item.title || item.url,
                            source: item.source
                        }, () => {
                            star.src = 'icons/star-filled.svg';
                            star.classList.add('done');
                            star.title = 'Bookmarked';
                        });
                    }
                });
            });

            // Reading List
            const book = document.createElement('img');
            book.className = 'history-action';
            book.src = 'icons/book-empty.svg';
            book.title = 'Add to Reading List';
            (async () => {
                try {
                    const entries = await chrome.readingList.query({ url: item.url });
                    if (entries.length > 0) {
                        book.src = 'icons/book-filled.svg';
                        book.classList.add('done');
                        book.title = 'In Reading List';
                    }
                } catch (e) {}
            })();
            book.addEventListener('click', async () => {
                try {
                    const entries = await chrome.readingList.query({ url: item.url });
                    if (entries.length > 0) {
                        await chrome.readingList.removeEntry({ url: item.url });
                        book.src = 'icons/book-empty.svg';
                        book.classList.remove('done');
                        book.title = 'Add to Reading List';
                    } else {
                        await chrome.readingList.addEntry({ url: item.url, title: item.title || item.url, hasBeenRead: false });
                        book.src = 'icons/book-filled.svg';
                        book.classList.add('done');
                        book.title = 'In Reading List';
                    }
                } catch (e) {}
            });

            // Appreciate
            const heart = document.createElement('img');
            heart.className = 'history-action';
            heart.src = 'icons/heart-empty.svg';
            heart.title = 'Appreciate';
            heart.addEventListener('click', () => {
                chrome.runtime.sendMessage({ action: 'appreciatePost', url: item.url }, (response) => {
                    if (response?.success) {
                        heart.src = 'icons/heart-filled.svg';
                        heart.classList.add('done');
                        heart.title = 'Appreciated!';
                    }
                });
            });

            actions.appendChild(star);
            actions.appendChild(book);
            actions.appendChild(heart);
            row.appendChild(link);
            row.appendChild(actions);
            historyContainer.appendChild(row);
        });
    });
}

function updateCheckboxes() {
    container.querySelectorAll('input[data-slug]').forEach(cb => {
        cb.checked = selectedCategories.has(cb.dataset.slug);
        cb.closest('.feed-pill')?.classList.toggle('active', cb.checked);
    });
}

function updateFeedCheckboxes() {
    feedsContainer.querySelectorAll('input[data-feed]').forEach(cb => {
        cb.checked = selectedFeeds.has(cb.dataset.feed);
        cb.closest('.feed-pill')?.classList.toggle('active', cb.checked);
    });
}

function updateSections() {
    const takeoverOn = tabTakeoverToggle.checked;

    // When Override New Tab is off, visually uncheck dependent toggles
    // Stash real state on the element so we can restore without extra storage calls
    if (!takeoverOn) {
        blockFocusToggle._real = blockFocusToggle._real ?? blockFocusToggle.checked;
        toggle._real = toggle._real ?? toggle.checked;
        directModeToggle._real = directModeToggle._real ?? directModeToggle.checked;
        blockFocusToggle.checked = false;
        toggle.checked = false;
        directModeToggle.checked = false;
    } else if ('_real' in blockFocusToggle) {
        blockFocusToggle.checked = blockFocusToggle._real;
        toggle.checked = toggle._real;
        directModeToggle.checked = directModeToggle._real;
        delete blockFocusToggle._real;
        delete toggle._real;
        delete directModeToggle._real;
    }

    const smallWebOn = toggle.checked;

    blockFocusToggleRow.classList.toggle('disabled', !takeoverOn);
    smallWebToggleRow.classList.toggle('disabled', !takeoverOn);
    directModeRow.classList.toggle('disabled', !takeoverOn || !smallWebOn);

    const showTabs = takeoverOn && smallWebOn;
    tabBar.classList.toggle('visible', showTabs);

    if (showTabs) {
        container.classList.toggle('visible', activeTab === 'categories');
        feedsContainer.classList.toggle('visible', activeTab === 'feeds');
        historyContainer.classList.toggle('visible', activeTab === 'history');
        if (activeTab === 'history') buildHistoryUI();
    } else {
        container.classList.remove('visible');
        feedsContainer.classList.remove('visible');
        historyContainer.classList.remove('visible');
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

bingRedirectToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ bingRedirectEnabled: bingRedirectToggle.checked });
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
chrome.storage.sync.get(['tabTakeoverEnabled', 'blockFocusEnabled', 'smallWebEnabled', 'directMode', 'bingRedirectEnabled', 'selectedCategories', 'selectedFeeds', 'customUrl'], (result) => {
    tabTakeoverToggle.checked = result.tabTakeoverEnabled !== false;
    blockFocusToggle.checked = result.blockFocusEnabled !== false;
    toggle.checked = result.smallWebEnabled || false;
    directModeToggle.checked = result.directMode || false;
    bingRedirectToggle.checked = result.bingRedirectEnabled || false;
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
