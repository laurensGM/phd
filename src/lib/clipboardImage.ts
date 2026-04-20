const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

/**
 * Return the first pasted image file from clipboard data, if present.
 * Supports both clipboardData.items and clipboardData.files.
 */
export function extractImageFileFromClipboard(clipboardData: DataTransfer | null): File | null {
  if (!clipboardData) return null;

  for (const item of Array.from(clipboardData.items ?? [])) {
    if (item.kind !== 'file') continue;
    const file = item.getAsFile();
    if (file && ALLOWED_IMAGE_TYPES.has(file.type)) {
      return file;
    }
  }

  for (const file of Array.from(clipboardData.files ?? [])) {
    if (ALLOWED_IMAGE_TYPES.has(file.type)) {
      return file;
    }
  }

  return null;
}
