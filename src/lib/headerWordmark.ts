/** Which admin wordmark slot renders in the site header — full logo vs text-only. */

export const HEADER_WORDMARK_IDS = ['logo', 'logoText'] as const;
export type HeaderWordmarkId = (typeof HEADER_WORDMARK_IDS)[number];

export const DEFAULT_HEADER_WORDMARK: HeaderWordmarkId = 'logo';

export function normalizeHeaderWordmark(raw: string | null | undefined): HeaderWordmarkId {
  const id = String(raw || '')
    .trim()
    .toLowerCase();
  if (id === 'logotext' || id === 'logo_text' || id === 'logo-text' || id === 'text') return 'logoText';
  return DEFAULT_HEADER_WORDMARK;
}

export function isHeaderWordmarkId(raw: string | null | undefined): boolean {
  const id = String(raw || '')
    .trim()
    .toLowerCase();
  if (!id) return false;
  return id === 'logo' || id === 'logotext' || id === 'logo_text' || id === 'logo-text' || id === 'text';
}
