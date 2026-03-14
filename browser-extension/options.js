'use strict';

const CONFIG_KEY = 'phdSupabaseConfig';

document.getElementById('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = document.getElementById('supabase-url').value.trim();
  const anonKey = document.getElementById('anon-key').value.trim();
  await chrome.storage.local.set({ [CONFIG_KEY]: { supabaseUrl: url, anonKey } });
  const saved = document.getElementById('saved');
  saved.style.display = 'inline';
  setTimeout(() => { saved.style.display = 'none'; }, 2000);
});

chrome.storage.local.get([CONFIG_KEY], (stored) => {
  const c = stored[CONFIG_KEY];
  if (c) {
    document.getElementById('supabase-url').value = c.supabaseUrl || '';
    document.getElementById('anon-key').value = c.anonKey || '';
  }
});
