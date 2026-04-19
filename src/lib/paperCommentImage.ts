import type { SupabaseClient } from '@supabase/supabase-js';

export const PAPER_COMMENT_IMAGES_BUCKET = 'paper-comment-images';

const MAX_BYTES = 5 * 1024 * 1024;

export type UploadPaperCommentImageResult =
  | { url: string; path: string }
  | { error: string };

/** Upload an image for a paper comment; returns public URL and storage path (for rollback). */
export async function uploadPaperCommentImage(
  supabase: SupabaseClient,
  paperId: string,
  file: File
): Promise<UploadPaperCommentImageResult> {
  if (!file.type.startsWith('image/')) {
    return { error: 'Please choose an image file (JPEG, PNG, GIF, or WebP).' };
  }
  if (file.size > MAX_BYTES) {
    return { error: 'Image must be 5 MB or smaller.' };
  }
  const rawExt = file.name.split('.').pop()?.toLowerCase();
  const safeExt =
    rawExt && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(rawExt)
      ? rawExt === 'jpg'
        ? 'jpeg'
        : rawExt
      : 'jpeg';
  const path = `${paperId}/${crypto.randomUUID()}.${safeExt}`;
  const { error } = await supabase.storage
    .from(PAPER_COMMENT_IMAGES_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || `image/${safeExt}`,
    });
  if (error) {
    return { error: error.message };
  }
  const { data } = supabase.storage.from(PAPER_COMMENT_IMAGES_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function removePaperCommentImage(
  supabase: SupabaseClient,
  path: string
): Promise<void> {
  await supabase.storage.from(PAPER_COMMENT_IMAGES_BUCKET).remove([path]);
}
