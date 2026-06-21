import { cacheNarrationAudio, isNarrationCached } from './narrationCache';
import {
  saveOfflinePaper,
  type OfflinePaperBundle,
  type OfflinePaperRecord,
  type OfflineSummaryRecord,
} from '../offlinePaperStore';

interface SavePaperOfflineInput {
  paper: OfflinePaperRecord;
  summary: OfflineSummaryRecord | null;
}

/** Cache narration MP3 + paper/summary in IndexedDB for offline reading. */
export async function savePaperForOffline({
  paper,
  summary,
}: SavePaperOfflineInput): Promise<boolean> {
  if (summary?.narration_url) {
    await cacheNarrationAudio(summary.narration_url);
    if (!(await isNarrationCached(summary.narration_url))) {
      return false;
    }
  }

  const bundle: OfflinePaperBundle = {
    paperId: paper.id,
    paper,
    summary,
    savedAt: new Date().toISOString(),
  };
  await saveOfflinePaper(bundle);
  return true;
}
