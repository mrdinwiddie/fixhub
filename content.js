(() => {
  let settings = {
    reviewerAvatars: false,
    scrapeReviewers: false,
    authorAvatar: false,
    hideAssignees: false,
    enableCache: false,
    ignoreUsers: '',
    ghToken: '',
  };

  function init() {
    chrome.storage.sync.get(Object.keys(settings), (data) => {
      Object.assign(settings, data);
      if (!settings.enableCache) {
        clearReviewerCache();
      }
      apply();
    });
  }

  // Listen for popup toggle messages
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'settingChanged') {
      settings[msg.key] = msg.value;
      if (msg.key === 'enableCache' && !msg.value) {
        clearReviewerCache();
      }
      apply();
    }
  });

  function apply() {
    applyHideAssignees();
    applyAuthorAvatars();
    applyReviewerAvatars();
  }

  // --- Hide assignees column ---
  function applyHideAssignees() {
    // The right-side columns live in .flex-shrink-0.col-4 per row.
    // The assignees column is a <span> containing .AvatarStack with
    // aria-label starting with "Assigned to".
    // Hide assignee cells in each row
    document.querySelectorAll('.AvatarStack-body[aria-label^="Assigned to"]').forEach((el) => {
      const cell = el.closest('span.ml-2');
      if (cell) {
        cell.classList.toggle('fh-hidden', settings.hideAssignees);
      }
    });

    // Hide the "Assignee" filter dropdown in the table header
    const assigneeMenu = document.getElementById('assignees-select-menu');
    if (assigneeMenu) {
      assigneeMenu.classList.toggle('fh-hidden', settings.hideAssignees);
    }
  }

  // --- Author avatars ---
  function applyAuthorAvatars() {
    document.querySelectorAll('.fh-author-avatar').forEach((el) => el.remove());

    document.querySelectorAll('.js-issue-row').forEach((row) => {
      const authorLink = row.querySelector('.opened-by a[data-hovercard-type="user"]');
      if (!authorLink) return;

      // Restore original text-only state
      if (authorLink.dataset.fhOriginal) {
        authorLink.textContent = authorLink.dataset.fhOriginal;
      }

      if (!settings.authorAvatar) return;

      const username = authorLink.textContent.trim();
      if (!username) return;

      // Save original text
      authorLink.dataset.fhOriginal = username;

      const img = document.createElement('img');
      img.src = `https://github.com/${username}.png?size=40`;
      img.alt = username;
      img.title = username;
      img.className = 'fh-avatar fh-author-avatar';

      authorLink.textContent = '';
      authorLink.appendChild(img);
      authorLink.appendChild(document.createTextNode(username));
    });
  }

  // --- Reviewer avatars ---
  let lastReviewerMethod = '';
  function applyReviewerAvatars() {
    const method = settings.scrapeReviewers ? 'scrape' : settings.reviewerAvatars ? 'api' : '';

    if (!method) {
      document.querySelectorAll('.fh-reviewer-col').forEach((el) => el.remove());
      const existingHeader = document.getElementById('fh-reviewers-header');
      if (existingHeader) existingHeader.remove();
      document.querySelectorAll('.js-issue-row').forEach((row) => {
        delete row.dataset.fhReviewersFetched;
      });
      lastReviewerMethod = '';
      return;
    }

    // If method changed, clear existing results and re-fetch
    if (method !== lastReviewerMethod) {
      document.querySelectorAll('.fh-reviewer-col').forEach((el) => el.remove());
      document.querySelectorAll('.js-issue-row').forEach((row) => {
        delete row.dataset.fhReviewersFetched;
      });
      lastReviewerMethod = method;
    }

    // Insert "Reviewers" header label at the end of the toolbar
    if (!document.getElementById('fh-reviewers-header')) {
      const toolbar = document.getElementById('js-issues-toolbar');
      if (toolbar) {
        const headerLabel = document.createElement('span');
        headerLabel.id = 'fh-reviewers-header';
        headerLabel.className = 'fh-reviewers-header-label';
        headerLabel.textContent = 'Reviewers';
        toolbar.appendChild(headerLabel);
      }
    }

    // Reviewer info is NOT in the PR list DOM — requires API call.
    // Works without a token for public repos (60 req/hr rate limit).

    // Detect owner/repo from the URL
    const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)\/pulls/);
    if (!match) return;
    const [, owner, repo] = match;

    const fetchPromises = [];

    document.querySelectorAll('.js-issue-row').forEach((row) => {
      if (row.dataset.fhReviewersFetched) return;
      row.dataset.fhReviewersFetched = '1';

      const flexContainer = row.querySelector(':scope > .d-flex');
      const prLink = row.querySelector('a[data-hovercard-type="pull_request"]');
      const href = prLink?.getAttribute('href');
      const prNumber = href?.split('/').pop();

      if (!prNumber || !flexContainer) {
        // Still insert empty placeholder for alignment
        if (flexContainer) insertReviewerCol(flexContainer, new Map());
        return;
      }

      const fetcher = settings.scrapeReviewers ? scrapeReviewers : fetchReviewers;
      const p = fetcher(owner, repo, prNumber).then((reviewerMap) => {
        insertReviewerCol(flexContainer, filterIgnored(reviewerMap));
      });
      fetchPromises.push(p);
    });

    // After all fetches, measure the longest username and set column width
    Promise.all(fetchPromises).then(() => updateReviewerColWidth());
  }

  function updateReviewerColWidth() {
    // Find the longest reviewer username on the page
    let longest = 0;
    document.querySelectorAll('.fh-reviewer-link').forEach((link) => {
      const name = link.textContent.trim();
      if (name.length > longest) longest = name.length;
    });

    if (longest === 0) return;

    // padding (24px) + avatar (30px) + gap (6px) + text (approx 7.2px per char at 12px font) + buffer
    const width = 24 + 30 + 6 + Math.ceil(longest * 7.2) + 8;
    document.documentElement.style.setProperty('--fh-reviewer-col-width', width + 'px');

    // Apply matching width to the header
    const header = document.getElementById('fh-reviewers-header');
    if (header) {
      header.style.width = width + 'px';
      header.style.minWidth = width + 'px';
      header.style.boxSizing = 'border-box';
    }
  }

  function insertReviewerCol(flexContainer, reviewerMap) {
    if (!flexContainer) return;

    const col = document.createElement('div');
    col.className = 'fh-reviewer-col';

    for (const [name, state] of reviewerMap) {
      const link = document.createElement('a');
      link.href = `/${name}`;
      link.className = 'Link--muted fh-reviewer-link';
      link.setAttribute('data-hovercard-type', 'user');
      link.setAttribute('data-hovercard-url', `/users/${name}/hovercard`);

      const img = document.createElement('img');
      img.src = `https://github.com/${name}.png?size=40`;
      img.alt = name;
      img.title = `${name} (${state})`;
      img.className = `fh-avatar fh-reviewer-avatar fh-review-${state}`;

      link.appendChild(img);
      link.appendChild(document.createTextNode(name));
      col.appendChild(link);
    }

    flexContainer.appendChild(col);
  }

  function getIgnoredUsers() {
    return new Set(
      (settings.ignoreUsers || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    );
  }

  function filterIgnored(reviewerMap) {
    const ignored = getIgnoredUsers();
    for (const name of reviewerMap.keys()) {
      if (ignored.has(name.toLowerCase()) || name.endsWith('[bot]')) reviewerMap.delete(name);
    }
    return reviewerMap;
  }

  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  function clearReviewerCache() {
    Object.keys(sessionStorage).forEach((k) => {
      if (k.startsWith('fh-reviewers')) sessionStorage.removeItem(k);
    });
  }

  function getCached(key) {
    if (!settings.enableCache) return null;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL) {
        sessionStorage.removeItem(key);
        return null;
      }
      return new Map(data);
    } catch (_) {
      return null;
    }
  }

  function setCache(key, reviewerMap) {
    if (!settings.enableCache) return;
    try {
      sessionStorage.setItem(key, JSON.stringify({
        data: [...reviewerMap.entries()],
        ts: Date.now(),
      }));
    } catch (_) {
      // Storage full or unavailable
    }
  }

  async function scrapeReviewers(owner, repo, number) {
    const cacheKey = `fh-reviewers:${owner}/${repo}#${number}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const reviewers = new Map();

    try {
      const res = await fetch(`https://github.com/${owner}/${repo}/pull/${number}`, {
        credentials: 'include',
      });
      if (!res.ok) return reviewers;

      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const form = doc.querySelector('.js-issue-sidebar-form[aria-label="Select reviewers"]');
      if (!form) { setCache(cacheKey, reviewers); return reviewers; }

      // Find all reviewer rows — each is a p.d-flex with a user hovercard span
      form.querySelectorAll('p.d-flex > span[data-assignee-name]').forEach((span) => {
        const username = span.dataset.assigneeName;
        if (!username) return;

        // Check if they have a review status link
        const row = span.closest('p.d-flex');
        const statusLink = row?.querySelector(`a[id="review-status-${username}"]`);

        let state = 'pending';
        if (statusLink) {
          const svg = statusLink.querySelector('svg');
          const cls = svg ? (svg.getAttribute('class') || '') : '';
          if (cls.includes('color-fg-success')) state = 'approved';
          else if (cls.includes('color-fg-danger')) state = 'changes_requested';
          else if (cls.includes('octicon-comment') || cls.includes('color-fg-muted')) state = 'commented';
          else if (cls.includes('color-fg-attention')) state = 'commented';
          else if (svg) state = 'commented';
        }

        reviewers.set(username, state);
      });

      setCache(cacheKey, reviewers);
    } catch (_) {
      // Ignore fetch errors
    }

    return reviewers;
  }

  async function fetchReviewers(owner, repo, number) {
    const cacheKey = `fh-reviewers:${owner}/${repo}#${number}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const headers = {};
    if (settings.ghToken) {
      headers.Authorization = `Bearer ${settings.ghToken}`;
    }

    // Map of login -> state: 'pending' | 'approved' | 'changes_requested' | 'commented'
    const reviewers = new Map();

    try {
      // Get submitted reviews (may have multiple per user, take latest)
      const reviewsRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${number}/reviews`,
        { headers }
      );
      if (reviewsRes.ok) {
        const reviews = await reviewsRes.json();
        for (const r of reviews) {
          const state = r.state.toLowerCase();
          // Skip "dismissed" reviews and the empty "pending" state from draft reviews
          if (state === 'dismissed' || (state === 'pending' && !r.body)) continue;
          // Later reviews override earlier ones
          reviewers.set(r.user.login, state);
        }
      }

      // Get pending requested reviewers (haven't submitted yet)
      const requestedRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${number}/requested_reviewers`,
        { headers }
      );
      if (requestedRes.ok) {
        const data = await requestedRes.json();
        for (const u of (data.users || [])) {
          // Only set pending if they haven't already submitted a review
          if (!reviewers.has(u.login)) {
            reviewers.set(u.login, 'pending');
          }
        }
      }

      setCache(cacheKey, reviewers);
    } catch (_) {
      // Ignore fetch errors
    }

    return reviewers;
  }

  // Run on initial load — wait for PR rows to appear
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-run on GitHub Turbo navigations
  document.addEventListener('turbo:load', init);

  // Observe for dynamically inserted PR rows (GitHub may load them after initial paint)
  let observerTimeout;
  const observer = new MutationObserver(() => {
    const newRows = document.querySelectorAll('.js-issue-row:not([data-fh-reviewers-fetched])');
    if (newRows.length === 0) return;
    clearTimeout(observerTimeout);
    observerTimeout = setTimeout(() => {
      applyHideAssignees();
      applyAuthorAvatars();
      // Only fetch reviewers for new rows (applyReviewerAvatars already skips fetched rows)
      if (settings.reviewerAvatars || settings.scrapeReviewers) {
        applyReviewerAvatars();
      }
    }, 100);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
