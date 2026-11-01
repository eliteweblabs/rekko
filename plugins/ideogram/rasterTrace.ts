/**
 * Raster → SVG tracing for Ideogram logo concepts (Potrace + sharp preprocess).
 */

import { promisify } from 'node:util';
import potrace from 'potrace';
import sharp from 'sharp';
import { BRAND_SVG_MAX_CHARS, sanitizeInlineSvg } from '../../src/lib/brandSvg';

const traceAsync = promisify(potrace.trace.bind(potrace)) as (
  input: Buffer,
  params?: Record<string, unknown>,
) => Promise<string>;

export type RasterTraceParams = {
  threshold?: number;
  turdSize?: number;
  optTolerance?: number;
  color?: string;
  background?: string;
  /** Longest edge cap before tracing (keeps SVG size reasonable). */
  maxDimension?: number;
};

export async function traceRasterBufferToSvg(
  buffer: Buffer,
  params: RasterTraceParams = {},
): Promise<
  | { ok: true; svg: string; sizeBytes: number }
  | { ok: false; error: string; fallbackHint?: string }
> {
  const maxDim = params.maxDimension ?? 768;
  let pipeline = sharp(buffer).rotate().flatten({ background: '#ffffff' });
  const meta = await pipeline.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w > 0 && h > 0 && Math.max(w, h) > maxDim) {
    pipeline = pipeline.resize({
      width: w >= h ? maxDim : undefined,
      height: h > w ? maxDim : undefined,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  const png = await pipeline.png().toBuffer();

  const threshold = params.threshold ?? 128;
  try {
    const rawSvg = await traceAsync(png, {
      threshold,
      turdSize: params.turdSize ?? 2,
      optTolerance: params.optTolerance ?? 0.2,
      color: params.color ?? '#000000',
      background: params.background ?? 'transparent',
    });
    const sanitized = sanitizeInlineSvg(String(rawSvg));
    if (!sanitized) {
      return {
        ok: false,
        error: 'Traced SVG failed sanitization or exceeds the 200 KB branding limit',
        fallbackHint:
          'Apply the raster with set_company_branding_from_media, or regenerate a flatter logo (white background, 1–2 colors).',
      };
    }
    const sizeBytes = Buffer.byteLength(sanitized, 'utf8');
    if (sizeBytes > BRAND_SVG_MAX_CHARS) {
      return {
        ok: false,
        error: `Traced SVG too large (${sizeBytes} bytes; max ${BRAND_SVG_MAX_CHARS})`,
        fallbackHint: 'Use apply_generated_logo_to_company with use_raster_fallback true, or a simpler concept.',
      };
    }
    return { ok: true, svg: sanitized, sizeBytes };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Potrace trace failed',
    };
  }
}
