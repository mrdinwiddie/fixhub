const KEYS = ['reviewerAvatars', 'authorAvatar', 'hideAssignees'];
const TOKEN_KEY = 'ghToken';

document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  chrome.storage.sync.get([...KEYS, TOKEN_KEY], (data) => {
    for (const key of KEYS) {
      document.getElementById(key).checked = !!data[key];
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
