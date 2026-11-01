/**
 * ideogramClient.ts — server-side Ideogram image generation (Ideogram 3).
 *
 * Authentication: `Api-Key` header (never expose to the browser).
 * Image URLs from Ideogram expire — download or upload to the media library promptly.
 */

import { serverEnv } from './serverEnv';

const IDEOGRAM_BASE = 'https://api.ideogram.ai';
const DEFAULT_MODEL = 'ideogram-3';
const GENERATE_TIMEOUT_MS = 120_000;

export type IdeogramGenerateParams = {
  prompt: string;
  aspectRatio?: string;
  styleType?: string;
  numImages?: number;
};

export type IdeogramGeneratedImage = {
  url: string;
  prompt: string;
  resolution: string;
  isImageSafe: boolean;
  seed: number;
};

export type IdeogramGenerateResponse =
  | {
      ok: true;
      prompt: string;
      images: IdeogramGeneratedImage[];
      generationId?: string;
    }
  | { ok: false; error: string; status?: number; detail?: string };

export function isIdeogramConfigured(): boolean {
  return Boolean(serverEnv('IDEOGRAM_API_KEY')?.trim());
}

/** Map agent-friendly ratios (16:9, 1:1) to Ideogram v3 enums (16x9, 1x1). */
export function normalizeIdeogramAspectRatio(raw: string | undefined): string | undefined {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/:/g, 'x')
    .replace(/\s+/g, '');
  if (!s) return undefined;
  const allowed = new Set([
    'auto',
    '1x1',
    '1x2',
    '2x1',
    '1x3',
    '3x1',
    '9x16',
    '16x9',
    '10x16',
    '16x10',
    '2x3',
    '3x2',
    '3x4',
    '4x3',
    '4x5',
    '5x4',
  ]);
  if (allowed.has(s)) return s;
  return undefined;
}

function normalizeStyleType(raw: string | undefined): string | undefined {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return undefined;
  const aliases: Record<string, string> = {
    realistic: 'realistic',
    illustration: 'fiction',
    design: 'design',
    painting: 'stylized',
    '3d': 'general',
    render_3d: 'general',
    anime: 'stylized',
  };
  if (aliases[s]) return aliases[s];
  if (['auto', 'general', 'realistic', 'design', 'custom', 'fiction', 'stylized'].includes(s)) return s;
  return undefined;
}

export async function ideogramGenerateImages(params: IdeogramGenerateParams): Promise<IdeogramGenerateResponse> {
  const apiKey = serverEnv('IDEOGRAM_API_KEY')?.trim();
  if (!apiKey) {
    return { ok: false, error: 'IDEOGRAM_API_KEY is not set on this service' };
  }

  const prompt = String(params.prompt ?? '').trim();
  if (!prompt) return { ok: false, error: 'prompt is required' };

  const model = serverEnv('IDEOGRAM_MODEL')?.trim() || DEFAULT_MODEL;
  const aspectRatio = normalizeIdeogramAspectRatio(params.aspectRatio);
  const styleType = normalizeStyleType(params.styleType);
  const numImages = params.numImages != null ? Math.max(1, Math.min(8, Math.floor(params.numImages))) : 1;

  const form = new FormData();
  form.append('prompt', prompt);
  form.append('num_images', String(numImages));
  if (aspectRatio) form.append('aspect_ratio', aspectRatio);
  if (styleType) form.append('style_type', styleType);

  try {
    const response = await fetch(`${IDEOGRAM_BASE}/v2/image/generate/${model}`, {
      method: 'POST',
      headers: { 'Api-Key': apiKey },
      body: form,
      signal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
    });

    const text = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return {
        ok: false,
        error: `Ideogram API returned non-JSON (${response.status})`,
        status: response.status,
        detail: text.slice(0, 500),
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        error: `Ideogram API error: ${response.status} ${response.statusText}`,
        status: response.status,
        detail: typeof data.message === 'string' ? data.message : text.slice(0, 500),
      };
    }

    const rows = data.data;
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, error: 'No images returned from Ideogram API', detail: text.slice(0, 500) };
    }

    const images: IdeogramGeneratedImage[] = [];
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const item = row as Record<string, unknown>;
      const url = typeof item.url === 'string' ? item.url : '';
      if (!url) continue;
      images.push({
        url,
        prompt: typeof item.prompt === 'string' ? item.prompt : prompt,
        resolution: typeof item.resolution === 'string' ? item.resolution : '',
        isImageSafe: item.is_image_safe !== false,
        seed: typeof item.seed === 'number' ? item.seed : 0,
      });
    }

    if (!images.length) {
      return {
        ok: false,
        error: 'Ideogram returned no usable image URLs (safety filter or empty url)',
        detail: text.slice(0, 500),
      };
    }

    return {
      ok: true,
      prompt,
      images,
      generationId: typeof data.generation_id === 'string' ? data.generation_id : undefined,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Failed to generate image: ${msg}` };
  }
}

export function formatIdeogramGenerateResult(result: Extract<IdeogramGenerateResponse, { ok: true }>): string {
  return JSON.stringify({
    ok: true,
    prompt: result.prompt,
    generation_id: result.generationId,
    images: result.images.map((img) => ({
      url: img.url,
      resolution: img.resolution,
      seed: img.seed,
      is_image_safe: img.isImageSafe,
    })),
    count: result.images.length,
    note: 'Ideogram image links expire — use save_image_to_media or save_to_media on generate_image for permanent library URLs.',
  });
}

export type IdeogramDescribeResponse =
  | { ok: true; descriptions: string[]; descriptionId?: string }
  | { ok: false; error: string; status?: number; detail?: string };

type IdeogramImageJobResponse = IdeogramGenerateResponse;

function appendImageFile(form: FormData, field: string, buffer: Buffer, filename: string, mediaType: string) {
  const blob = new Blob([new Uint8Array(buffer)], { type: mediaType || 'application/octet-stream' });
  form.append(field, blob, filename);
}

function parseIdeogramImageRows(
  data: Record<string, unknown>,
  fallbackPrompt: string,
): IdeogramGeneratedImage[] {
  const rows = data.data;
  if (!Array.isArray(rows)) return [];
  const images: IdeogramGeneratedImage[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    const url = typeof item.url === 'string' ? item.url : '';
    if (!url) continue;
    images.push({
      url,
      prompt: typeof item.prompt === 'string' ? item.prompt : fallbackPrompt,
      resolution: typeof item.resolution === 'string' ? item.resolution : '',
      isImageSafe: item.is_image_safe !== false,
      seed: typeof item.seed === 'number' ? item.seed : 0,
    });
  }
  return images;
}

async function ideogramMultipartImageJob(
  path: string,
  buildForm: (form: FormData) => void,
  fallbackPrompt: string,
): Promise<IdeogramImageJobResponse> {
  const apiKey = serverEnv('IDEOGRAM_API_KEY')?.trim();
  if (!apiKey) {
    return { ok: false, error: 'IDEOGRAM_API_KEY is not set on this service' };
  }

  const form = new FormData();
  buildForm(form);

  try {
    const response = await fetch(`${IDEOGRAM_BASE}${path}`, {
      method: 'POST',
      headers: { 'Api-Key': apiKey },
      body: form,
      signal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
    });

    const text = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return {
        ok: false,
        error: `Ideogram API returned non-JSON (${response.status})`,
        status: response.status,
        detail: text.slice(0, 500),
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        error: `Ideogram API error: ${response.status} ${response.statusText}`,
        status: response.status,
        detail: typeof data.message === 'string' ? data.message : text.slice(0, 500),
      };
    }

    const images = parseIdeogramImageRows(data, fallbackPrompt);
    if (!images.length) {
      return { ok: false, error: 'No images returned from Ideogram API', detail: text.slice(0, 500) };
    }

    return {
      ok: true,
      prompt: fallbackPrompt,
      images,
      generationId: typeof data.generation_id === 'string' ? data.generation_id : undefined,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Ideogram request failed: ${msg}` };
  }
}

export type IdeogramRemixParams = {
  prompt: string;
  image: { buffer: Buffer; filename: string; mediaType: string };
  imageWeight?: number;
  numImages?: number;
  aspectRatio?: string;
};

export async function ideogramRemixImage(params: IdeogramRemixParams): Promise<IdeogramImageJobResponse> {
  const prompt = String(params.prompt ?? '').trim();
  if (!prompt) return { ok: false, error: 'prompt is required' };

  const numImages = params.numImages != null ? Math.max(1, Math.min(8, Math.floor(params.numImages))) : 1;
  const aspectRatio = normalizeIdeogramAspectRatio(params.aspectRatio);
  const imageWeight =
    params.imageWeight != null
      ? Math.max(1, Math.min(100, Math.floor(params.imageWeight)))
      : undefined;

  return ideogramMultipartImageJob(
    '/v2/image/remix/auto',
    (form) => {
      form.append('prompt', prompt);
      form.append('num_images', String(numImages));
      appendImageFile(form, 'image', params.image.buffer, params.image.filename, params.image.mediaType);
      if (aspectRatio) form.append('aspect_ratio', aspectRatio);
      if (imageWeight != null) form.append('image_weight', String(imageWeight));
    },
    prompt,
  );
}

export type IdeogramUpscaleParams = {
  image: { buffer: Buffer; filename: string; mediaType: string };
  upscaleFactor?: 'x2' | 'x4' | 'x8';
};

export async function ideogramUpscaleImage(params: IdeogramUpscaleParams): Promise<IdeogramImageJobResponse> {
  const factor = params.upscaleFactor ?? 'x2';
  return ideogramMultipartImageJob(
    '/v2/image/upscale/auto',
    (form) => {
      form.append('upscale_factor', factor);
      appendImageFile(form, 'image', params.image.buffer, params.image.filename, params.image.mediaType);
    },
    'upscale',
  );
}

export type IdeogramInpaintParams = {
  prompt: string;
  image: { buffer: Buffer; filename: string; mediaType: string };
  mask: { buffer: Buffer; filename: string; mediaType: string };
  numImages?: number;
  styleType?: string;
};

export async function ideogramInpaintImage(params: IdeogramInpaintParams): Promise<IdeogramImageJobResponse> {
  const prompt = String(params.prompt ?? '').trim();
  if (!prompt) return { ok: false, error: 'prompt is required' };

  const numImages = params.numImages != null ? Math.max(1, Math.min(8, Math.floor(params.numImages))) : 1;
  const styleType = normalizeStyleType(params.styleType);

  return ideogramMultipartImageJob(
    '/v2/image/inpaint/ideogram-3',
    (form) => {
      form.append('prompt', prompt);
      form.append('num_images', String(numImages));
      appendImageFile(form, 'image', params.image.buffer, params.image.filename, params.image.mediaType);
      appendImageFile(form, 'mask', params.mask.buffer, params.mask.filename, params.mask.mediaType);
      if (styleType) form.append('style_type', styleType);
    },
    prompt,
  );
}

export async function ideogramDescribeImage(image: {
  buffer: Buffer;
  filename: string;
  mediaType: string;
}): Promise<IdeogramDescribeResponse> {
  const apiKey = serverEnv('IDEOGRAM_API_KEY')?.trim();
  if (!apiKey) {
    return { ok: false, error: 'IDEOGRAM_API_KEY is not set on this service' };
  }

  const form = new FormData();
  appendImageFile(form, 'image', image.buffer, image.filename, image.mediaType);

  try {
    const response = await fetch(`${IDEOGRAM_BASE}/v2/image/describe/ideogram-3`, {
      method: 'POST',
      headers: { 'Api-Key': apiKey },
      body: form,
      signal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
    });

    const text = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return {
        ok: false,
        error: `Ideogram API returned non-JSON (${response.status})`,
        status: response.status,
        detail: text.slice(0, 500),
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        error: `Ideogram API error: ${response.status} ${response.statusText}`,
        status: response.status,
        detail: typeof data.message === 'string' ? data.message : text.slice(0, 500),
      };
    }

    const descriptions: string[] = [];
    const rows = data.descriptions;
    if (Array.isArray(rows)) {
      for (const row of rows) {
        if (row && typeof row === 'object' && typeof (row as { text?: unknown }).text === 'string') {
          descriptions.push(String((row as { text: string }).text));
        }
      }
    }

    if (!descriptions.length) {
      return { ok: false, error: 'No descriptions returned from Ideogram API', detail: text.slice(0, 500) };
    }

    return {
      ok: true,
      descriptions,
      descriptionId: typeof data.description_id === 'string' ? data.description_id : undefined,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Ideogram describe failed: ${msg}` };
  }
}
