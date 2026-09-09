// popup.js — Phase 1.16 sẽ implement đầy đủ
// Stub: enable button when tab is active

document.getElementById('link-options')?.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
