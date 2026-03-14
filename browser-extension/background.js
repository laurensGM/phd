'use strict';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'phd-save-snippet',
    title: 'Save to PhD Manager',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'phd-save-snippet' || !tab?.id) return;

  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      func: () => ({
        url: window.location.href,
        title: document.title || '',
        selection: (window.getSelection() && window.getSelection().toString()) || '',
        doi: (() => {
          const meta = document.querySelector('meta[name="citation_doi"], meta[name="dc.identifier"]');
          if (meta && meta.getAttribute('content')) return meta.getAttribute('content').trim();
          const href = window.location.href;
          const m = href.match(/doi\.org\/(10\.\S+)/i) || href.match(/\/(10\.\d{4,}\/[^\s#?]+)/);
          return m ? m[1].replace(/#.*$/, '').replace(/\?.*$/, '').trim() : null;
        })(),
      }),
    },
    (results) => {
      if (chrome.runtime.lastError || !results?.[0]?.result) {
        chrome.tabs.create({ url: chrome.runtime.getURL('save-snippet.html?error=no-selection') });
        return;
      }
      const { url, title, selection, doi } = results[0].result;
      chrome.storage.local.set({ phdPendingSnippet: { url, title, selection, doi } }, () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('save-snippet.html') });
      });
    }
  );
});
