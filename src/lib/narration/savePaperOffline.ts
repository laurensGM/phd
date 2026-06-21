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

export interface SavePaperOfflineResult {
  ok: boolean;
  audioSaved: boolean;
}

/** Store paper + summary in IndexedDB; cache narration MP3 when available. */
export async function savePaperForOffline({
  paper,
  summary,
}: SavePaperOfflineInput): Promise<SavePaperOfflineResult> {
  const bundle: OfflinePaperBundle = {
    paperId: paper.id,
    paper,
    summary,
    savedAt: new Date().toISOString(),
  };
  await saveOfflinePaper(bundle);

  if (!summary?.narration_url) {
    return { ok: true, audioSaved: false };
  }

  await cacheNarrationAudio(summary.narration_url);
  const audioSaved = await isNarrationCached(summary.narration_url);
  return { ok: true, audioSaved };
}
