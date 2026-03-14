'use strict';

const STORAGE_KEY = 'phdPendingSnippet';
const CONFIG_KEY = 'phdSupabaseConfig';

let constructs = [];
let models = [];
let pending = null;
let config = null;

function show(el, show = true) {
  el.classList.toggle('hidden', !show);
}
function setStatus(msg, isError = false) {
  const status = document.getElementById('status');
  status.textContent = msg;
  status.style.color = isError ? '#b91c1c' : '';
}

function extractDoi(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.trim().match(/doi\.org\/(10\.\S+)/i) || url.trim().match(/^(10\.\d+\/\S+)/);
  return m ? m[1].replace(/#.*$/, '').trim() : null;
}
function extractArxivId(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.trim().match(/arxiv\.org\/(?:abs|pdf)\/([a-z\-]*(?:\d{4}\.\d{4,5})(?:v\d+)?)/i);
  return m ? m[1].replace(/v\d+$/, '') : null;
}
function canonicalDoiUrl(doi) {
  return doi ? `https://doi.org/${doi}` : null;
}

async function fetchMetadata(url) {
  const doi = extractDoi(url) || pending?.doi;
  if (doi) {
    try {
      const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const msg = data?.message;
      if (!msg) return null;
      const title = (Array.isArray(msg.title) ? msg.title[0] : msg.title) || '';
      const authorList = msg.author || [];
      const authors = authorList
        .map((a) => [a.family, a.given].filter(Boolean).join(', '))
        .filter(Boolean)
        .join('; ');
      const dateParts = msg.published?.['date-parts']?.[0] ?? msg['published-print']?.['date-parts']?.[0] ?? msg['published-online']?.['date-parts']?.[0];
      const year = dateParts?.[0] != null ? String(dateParts[0]) : '';
      const container = msg['container-title'];
      const journal = Array.isArray(container) && container[0] ? String(container[0]) : '';
      return { title, authors, year, journal };
    } catch {
      return null;
    }
  }
  const arxivId = extractArxivId(url);
  if (arxivId) {
    try {
      const res = await fetch(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(arxivId)}`, {
        headers: { Accept: 'application/atom+xml' },
      });
      if (!res.ok) return null;
      const xml = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'application/xml');
      const entry = doc.querySelector('entry');
      if (!entry) return null;
      const titleEl = entry.querySelector('title');
      const title = titleEl?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      const authorEls = entry.querySelectorAll('author name');
      const authors = Array.from(authorEls).map((el) => el.textContent?.trim() ?? '').filter(Boolean).join('; ');
      const published = entry.querySelector('published')?.textContent ?? '';
      const year = published ? String(new Date(published).getFullYear()) : '';
      return { title, authors, year, journal: '' };
    } catch {
      return null;
    }
  }
  return null;
}

function supabaseHeaders() {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

async function findPaperByUrl(url, doiUrl) {
  const base = config.supabaseUrl.replace(/\/$/, '') + '/rest/v1';
  const urls = [url];
  if (doiUrl && doiUrl !== url) urls.push(doiUrl);
  for (const u of urls) {
    const res = await fetch(`${base}/saved_papers?url=eq.${encodeURIComponent(u)}&select=id`, {
      headers: supabaseHeaders(),
    });
    if (!res.ok) throw new Error('Failed to check paper');
    const data = await res.json();
    if (data && data[0]) return data[0].id;
  }
  return null;
}

async function createPaper(url, meta, doiUrl) {
  const finalUrl = doiUrl || url;
  const body = {
    url: finalUrl,
    title: meta?.title || pending?.title || null,
    authors: meta?.authors || null,
    year: meta?.year || null,
    journal: meta?.journal || null,
    status: 'Not read',
    golden: false,
    tags: [],
  };
  const base = config.supabaseUrl.replace(/\/$/, '') + '/rest/v1';
  const res = await fetch(`${base}/saved_papers`, {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Failed to create paper');
  }
  const data = await res.json();
  const id = Array.isArray(data) ? data[0]?.id : data?.id;
  if (!id) throw new Error('No paper id returned');
  return id;
}

async function createSnippet(paperId, content, constructIds, modelIds, notes) {
  const base = config.supabaseUrl.replace(/\/$/, '') + '/rest/v1';
  const body = {
    paper_id: paperId,
    content: content.trim(),
    construct_id: constructIds[0] || null,
    model_id: modelIds[0] || null,
    construct_ids: constructIds,
    model_ids: modelIds,
    notes: notes?.trim() || null,
    tags: [],
  };
  const res = await fetch(`${base}/snippets`, {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Failed to create snippet');
  }
  return true;
}

async function loadDropdowns() {
  try {
    const [cRes, mRes] = await Promise.all([
      fetch(chrome.runtime.getURL('constructs.json')),
      fetch(chrome.runtime.getURL('models.json')),
    ]);
    constructs = await cRes.json();
    models = await mRes.json();
  } catch (e) {
    console.error(e);
    return;
  }
  const constructSelect = document.getElementById('construct-select');
  const modelSelect = document.getElementById('model-select');
  constructSelect.innerHTML = constructs.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
  modelSelect.innerHTML = models.map((m) => `<option value="${m.id}">${m.name}</option>`).join('');
}

function renderPaperDisplay() {
  const el = document.getElementById('paper-display');
  if (!pending) {
    el.textContent = 'No selection or page data. Use "Save to PhD Manager" from the context menu after selecting text.';
    return;
  }
  const doiUrl = pending.doi ? canonicalDoiUrl(pending.doi) : null;
  const urlToShow = doiUrl || pending.url;
  let text = urlToShow;
  if (pending.title) text = pending.title + ' — ' + urlToShow;
  el.textContent = text;
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('error') === 'no-selection') {
    document.getElementById('snippet-content').placeholder = 'Select text on the article page, then right‑click → Save to PhD Manager.';
  }

  const stored = await chrome.storage.local.get([CONFIG_KEY, STORAGE_KEY]);
  config = stored[CONFIG_KEY] || null;
  pending = stored[STORAGE_KEY] || null;

  if (!config?.supabaseUrl?.trim() || !config?.anonKey?.trim()) {
    show(document.getElementById('config-warning'), true);
  }
  await loadDropdowns();
  renderPaperDisplay();
  if (pending?.selection) {
    document.getElementById('snippet-content').value = pending.selection;
  }
}

document.getElementById('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const saveBtn = document.getElementById('save-btn');
  const errorEl = document.getElementById('error');
  const successEl = document.getElementById('success');
  show(errorEl, false);
  show(successEl, false);

  if (!config?.supabaseUrl?.trim() || !config?.anonKey?.trim()) {
    show(errorEl, true);
    errorEl.textContent = 'Set Supabase URL and anon key in extension options.';
    return;
  }
  if (!pending?.url) {
    show(errorEl, true);
    errorEl.textContent = 'No page URL. Use the context menu on an article page after selecting text.';
    return;
  }

  const content = document.getElementById('snippet-content').value.trim();
  if (!content) {
    show(errorEl, true);
    errorEl.textContent = 'Snippet text is required.';
    return;
  }

  const constructSelect = document.getElementById('construct-select');
  const modelSelect = document.getElementById('model-select');
  const constructIds = Array.from(constructSelect.selectedOptions).map((o) => o.value);
  const modelIds = Array.from(modelSelect.selectedOptions).map((o) => o.value);
  const notes = document.getElementById('notes').value.trim() || null;

  saveBtn.disabled = true;
  setStatus('Saving…');

  try {
    const doiUrl = pending.doi ? canonicalDoiUrl(pending.doi) : null;
    let paperId = await findPaperByUrl(pending.url, doiUrl);
    if (!paperId) {
      setStatus('Creating paper…');
      const meta = await fetchMetadata(pending.url);
      paperId = await createPaper(pending.url, meta, doiUrl);
    }
    setStatus('Creating snippet…');
    await createSnippet(paperId, content, constructIds, modelIds, notes);
    await chrome.storage.local.remove(STORAGE_KEY);
    show(successEl, true);
    successEl.textContent = 'Snippet saved. You can close this tab.';
    setStatus('');
    document.getElementById('form').reset();
    document.getElementById('snippet-content').value = content;
  } catch (err) {
    show(errorEl, true);
    errorEl.textContent = err.message || 'Something went wrong.';
    setStatus('', true);
  } finally {
    saveBtn.disabled = false;
  }
});

init();
