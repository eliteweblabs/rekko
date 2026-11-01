/**
 * Resolve image bytes for Ideogram multipart requests (URL, base64, or media library id).
 */

import { fetchRemoteMediaBytes, storeGetMediaByRef } from '../../src/lib/mediaLibrary';

export type ResolvedIdeogramImage = {
  buffer: Buffer;
  mediaType: string;
  filename: string;
};

function decodeDataBase64(raw: string): Buffer | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const payload = trimmed.replace(/^data:[^;]+;base64,/, '').trim();
  if (!payload) return null;
  try {
    const buf = Buffer.from(payload, 'base64');
    return buf.length ? buf : null;
  } catch {
    return null;
  }
}

function filenameFromMediaType(mediaType: string, fallbackBase: string): string {
  const type = mediaType.trim().toLowerCase();
  const ext =
    type === 'image/jpeg'
      ? 'jpg'
      : type === 'image/webp'
        ? 'webp'
        : type === 'image/gif'
          ? 'gif'
          : 'png';
  const base = fallbackBase.replace(/\.[a-z0-9]+$/i, '') || 'image';
  return `${base}.${ext}`;
}

export async function resolveIdeogramImageInput(args: {
  url?: string;
  image_url?: string;
  media_id?: string;
  data_base64?: string;
  filename?: string;
}): Promise<{ ok: true; image: ResolvedIdeogramImage } | { ok: false; error: string }> {
  const dataBase64 = String(args.data_base64 ?? '').trim();
  if (dataBase64) {
    const buffer = decodeDataBase64(dataBase64);
    if (!buffer) return { ok: false, error: 'Invalid data_base64' };
    const mediaType = dataBase64.startsWith('data:')
      ? dataBase64.slice(5, dataBase64.indexOf(';')).trim().toLowerCase() || 'image/png'
      : 'image/png';
    return {
      ok: true,
      image: {
        buffer,
        mediaType,
        filename: args.filename?.trim() || filenameFromMediaType(mediaType, 'upload'),
      },
    };
  }

  const mediaId = String(args.media_id ?? '').trim();
  if (mediaId) {
    const record = await storeGetMediaByRef(mediaId);
    if (!record) return { ok: false, error: 'media_id not found in the media library' };
    if (!record.mediaType.startsWith('image/')) {
      return { ok: false, error: 'media_id must reference an image file' };
    }
    return {
      ok: true,
      image: {
        buffer: Buffer.from(record.dataBase64, 'base64'),
        mediaType: record.mediaType,
        filename: record.filename || filenameFromMediaType(record.mediaType, 'library'),
      },
    };
  }

  const url = String(args.url ?? args.image_url ?? '').trim();
  if (url) {
    const fetched = await fetchRemoteMediaBytes(url);
    if (!fetched) return { ok: false, error: 'Could not download image from url' };
    return {
      ok: true,
      image: {
        buffer: fetched.buffer,
        mediaType: fetched.mediaType,
        filename: args.filename?.trim() || filenameFromMediaType(fetched.mediaType, 'remote'),
      },
    };
  }

  return { ok: false, error: 'Provide url, media_id, or data_base64 for the image' };
}
