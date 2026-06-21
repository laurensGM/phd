const DB_NAME = 'phd-manager-offline';
const DB_VERSION = 1;
const STORE = 'papers';
export const OFFLINE_PAPERS_CHANGED_EVENT = 'phd-offline-papers-changed';

export function notifyOfflinePapersChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(OFFLINE_PAPERS_CHANGED_EVENT));
  }
}

export interface OfflinePaperRecord {
  id: string;
  url: string;
  secondary_url: string | null;
  motivation: string | null;
  tags: string[];
  title: string | null;
  authors: string | null;
  year: string | null;
  journal: string | null;
  citations: number | null;
  status: string;
  golden: boolean;
  created_at: string;
}

export interface OfflineSummaryRecord {
  id?: string;
  paper_id: string;
  problem?: string | null;
  claims?: string | null;
  method?: string | null;
  results?: string | null;
  discussion?: string | null;
  limitations?: string | null;
  future_research?: string | null;
  conclusion?: string | null;
  abstract?: string | null;
  key_claims?: string | null;
  academic_constructs?: string | null;
  introduction?: string | null;
  methods?: string | null;
  results_and_discussion?: string | null;
  limitations_and_future_research?: string | null;
  results_section?: string | null;
  discussion_section?: string | null;
  conclusion_section?: string | null;
  limitations_section?: string | null;
  future_research_section?: string | null;
  narration_url?: string | null;
  narration_content_hash?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OfflinePaperBundle {
  paperId: string;
  paper: OfflinePaperRecord;
  summary: OfflineSummaryRecord | null;
  savedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'paperId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open offline database'));
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const result = fn(store);
        tx.oncomplete = () => {
          db.close();
          if (result instanceof IDBRequest) {
            resolve(result.result as T);
          } else {
            resolve(undefined);
          }
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error('Offline storage transaction failed'));
        };
      })
  );
}

export async function saveOfflinePaper(bundle: OfflinePaperBundle): Promise<void> {
  await runTransaction('readwrite', (store) => store.put(bundle));
  notifyOfflinePapersChanged();
}

export async function getOfflinePaper(paperId: string): Promise<OfflinePaperBundle | null> {
  const result = await runTransaction<OfflinePaperBundle | undefined>('readonly', (store) =>
    store.get(paperId)
  );
  return result ?? null;
}

export async function listOfflinePapers(): Promise<OfflinePaperBundle[]> {
  const result = await runTransaction<OfflinePaperBundle[]>('readonly', (store) => store.getAll());
  return (result ?? []).sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
}

export async function isOfflinePaperSaved(paperId: string): Promise<boolean> {
  const bundle = await getOfflinePaper(paperId);
  return bundle != null;
}

export async function removeOfflinePaper(paperId: string): Promise<void> {
  await runTransaction('readwrite', (store) => store.delete(paperId));
}
