const KEYS = ['reviewerAvatars', 'scrapeReviewers', 'authorAvatar', 'hideAssignees', 'showReviewerNames', 'enableCache', 'copyFeedback', 'includeCollapsed'];
const TEXT_KEYS = ['ignoreUsers'];
const TOKEN_KEY = 'ghToken';

document.addEventListener('DOMContentLoaded', () => {
  const updateCollapsedRowVisibility = () => {
    document.getElementById('includeCollapsedRow').classList.toggle(
      'hidden', !document.getElementById('copyFeedback').checked
    );
  };

  // Load saved settings
  chrome.storage.sync.get([...KEYS, ...TEXT_KEYS, TOKEN_KEY], (data) => {
    for (const key of KEYS) {
      document.getElementById(key).checked = !!data[key];
    }
    updateCollapsedRowVisibility();
    for (const key of TEXT_KEYS) {
      if (data[key] != null) document.getElementById(key).value = data[key];
    }
    if (data[TOKEN_KEY]) {
      document.getElementById(TOKEN_KEY).value = data[TOKEN_KEY];
    }
  });

  // Toggle handlers
  for (const key of KEYS) {
    document.getElementById(key).addEventListener('change', (e) => {
      const val = e.target.checked;
      chrome.storage.sync.set({ [key]: val });
      notifyTab({ type: 'settingChanged', key, value: val });
      if (key === 'copyFeedback') updateCollapsedRowVisibility();
    });
  }

  // Text field handlers
  for (const key of TEXT_KEYS) {
    let timeout;
    document.getElementById(key).addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        chrome.storage.sync.set({ [key]: e.target.value });
        notifyTab({ type: 'settingChanged', key, value: e.target.value });
      }, 500);
    });
  }

  // Token handler
  let tokenTimeout;
  document.getElementById(TOKEN_KEY).addEventListener('input', (e) => {
    clearTimeout(tokenTimeout);
    tokenTimeout = setTimeout(() => {
      chrome.storage.sync.set({ [TOKEN_KEY]: e.target.value });
    }, 500);
  });
});

function notifyTab(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {});
    }
  });
}
