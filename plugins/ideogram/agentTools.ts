/**
 * Ideogram agent tools — generation, refinement, and media/project workflow.
 *
 * Feature-gated via `ideogram` + IDEOGRAM_API_KEY (plugin `configured`).
 */

import { getAgentContext } from '../../src/lib/agentContext';
import {
  formatIdeogramGenerateResult,
  ideogramDescribeImage,
  ideogramGenerateImages,
  ideogramInpaintImage,
  ideogramRemixImage,
  ideogramUpscaleImage,
  isIdeogramConfigured,
  normalizeIdeogramAspectRatio,
} from '../../src/lib/ideogramClient';
import { hasIdeogramImageGen } from '../../src/lib/features';
import {
  MEDIA_LIBRARY_CATEGORY_IDEOGRAM,
  storeImportRemoteImageToMediaLibrary,
  storeListMedia,
} from '../../src/lib/mediaLibrary';
import { isSafeWorkSlug, storeReadWork } from '../../src/lib/workStore';
import { storeAddProjectFile } from '../../src/lib/projectFiles';
import type { AgentToolDef, AgentToolModule, ToolContext } from '../../src/lib/agentTools/types';
import { resolveIdeogramImageInput } from './imageInput';

const SOCIAL_FORMAT_RATIOS: Record<string, string> = {
  square: '1x1',
  portrait: '9x16',
  story: '9x16',
  landscape: '16x9',
  feed: '4x5',
  wide: '16x9',
  pin: '2x3',
};

async function saveUrlsToMediaLibrary(
  urls: string[],
  opts: { altText?: string; slug?: string; filenamePrefix?: string },
): Promise<{ saved: Array<{ url: string; id: string; publicUrl: string; slug: string | null }>; errors: string[] }> {
  const ctx = getAgentContext();
  const saved: Array<{ url: string; id: string; publicUrl: string; slug: string | null }> = [];
  const errors: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]?.trim();
    if (!url) continue;
    const filename =
      urls.length > 1 && opts.filenamePrefix
        ? `${opts.filenamePrefix}-${i + 1}`
        : opts.filenamePrefix;
    const result = await storeImportRemoteImageToMediaLibrary({
      url,
      altText: opts.altText,
      slug: i === 0 ? opts.slug : undefined,
      filename,
      uploadedBy: ctx.userId ?? null,
      category: MEDIA_LIBRARY_CATEGORY_IDEOGRAM,
    });
    if (!result.ok) {
      errors.push(result.error);
      continue;
    }
    saved.push({
      url,
      id: result.item.id,
      publicUrl: result.item.publicUrl,
      slug: result.item.slug,
    });
  }
  return { saved, errors };
}

async function handle_generate_image(
  args: Record<string, unknown>,
  _ctx: ToolContext,
): Promise<string> {
  if (!isIdeogramConfigured()) {
    return JSON.stringify({ error: 'IDEOGRAM_API_KEY is not set on this service' });
  }

  const prompt = String(args.prompt ?? '').trim();
  if (!prompt) return JSON.stringify({ error: 'prompt is required' });

  const style = args.style ? String(args.style).trim() : undefined;
  const aspectRatio = args.aspect_ratio ? String(args.aspect_ratio).trim() : undefined;
  const numImages = args.num_images != null ? Number(args.num_images) : undefined;
  const saveToMedia = args.save_to_media === true || args.save_to_media === 'true';

  const result = await ideogramGenerateImages({
    prompt,
    aspectRatio,
    styleType: style,
    numImages: Number.isFinite(numImages) ? numImages : undefined,
  });

  if (!result.ok) {
    return JSON.stringify({
      error: result.error,
      status: result.status,
      detail: result.detail,
    });
  }

  if (!saveToMedia) {
    return formatIdeogramGenerateResult(result);
  }

  const altText = String(args.alt_text ?? prompt).trim();
  const slug = args.slug ? String(args.slug).trim() : undefined;
  const { saved, errors } = await saveUrlsToMediaLibrary(
    result.images.map((img) => img.url),
    { altText, slug, filenamePrefix: 'ideogram' },
  );

  return JSON.stringify({
    ok: true,
    prompt: result.prompt,
    generation_id: result.generationId,
    images: result.images.map((img, i) => ({
      temporary_url: img.url,
      resolution: img.resolution,
      seed: img.seed,
      is_image_safe: img.isImageSafe,
      media: saved[i] ?? null,
    })),
    count: result.images.length,
    media_saved: saved.length,
    media_errors: errors.length ? errors : undefined,
  });
}

async function handle_generate_image_variations(
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<string> {
  const num = args.num_images != null ? Number(args.num_images) : 4;
  return handle_generate_image({ ...args, num_images: num }, ctx);
}

async function handle_remix_image(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const prompt = String(args.prompt ?? '').trim();
  if (!prompt) return JSON.stringify({ error: 'prompt is required' });

  const resolved = await resolveIdeogramImageInput({
    url: String(args.url ?? args.image_url ?? ''),
    media_id: String(args.media_id ?? args.image_media_id ?? ''),
    data_base64: String(args.data_base64 ?? args.image_base64 ?? ''),
    filename: String(args.filename ?? ''),
  });
  if (!resolved.ok) return JSON.stringify({ error: resolved.error });

  const imageWeight = args.image_weight != null ? Number(args.image_weight) : undefined;
  const numImages = args.num_images != null ? Number(args.num_images) : undefined;
  const aspectRatio = args.aspect_ratio ? String(args.aspect_ratio).trim() : undefined;

  const result = await ideogramRemixImage({
    prompt,
    image: resolved.image,
    imageWeight: Number.isFinite(imageWeight) ? imageWeight : undefined,
    numImages: Number.isFinite(numImages) ? numImages : undefined,
    aspectRatio,
  });

  if (!result.ok) {
    return JSON.stringify({ error: result.error, status: result.status, detail: result.detail });
  }
  return formatIdeogramGenerateResult(result);
}

async function handle_upscale_image(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const resolved = await resolveIdeogramImageInput({
    url: String(args.url ?? args.image_url ?? ''),
    media_id: String(args.media_id ?? ''),
    data_base64: String(args.data_base64 ?? ''),
    filename: String(args.filename ?? ''),
  });
  if (!resolved.ok) return JSON.stringify({ error: resolved.error });

  const rawFactor = String(args.upscale_factor ?? 'x2').trim().toLowerCase();
  const upscaleFactor = rawFactor === 'x4' || rawFactor === 'x8' ? rawFactor : 'x2';

  const result = await ideogramUpscaleImage({
    image: resolved.image,
    upscaleFactor,
  });

  if (!result.ok) {
    return JSON.stringify({ error: result.error, status: result.status, detail: result.detail });
  }
  return formatIdeogramGenerateResult(result);
}

async function handle_edit_image(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const prompt = String(args.prompt ?? '').trim();
  if (!prompt) return JSON.stringify({ error: 'prompt is required' });

  const image = await resolveIdeogramImageInput({
    url: String(args.url ?? args.image_url ?? ''),
    media_id: String(args.media_id ?? args.image_media_id ?? ''),
    data_base64: String(args.data_base64 ?? args.image_base64 ?? ''),
    filename: String(args.filename ?? ''),
  });
  if (!image.ok) return JSON.stringify({ error: image.error });

  const mask = await resolveIdeogramImageInput({
    url: String(args.mask_url ?? ''),
    media_id: String(args.mask_media_id ?? ''),
    data_base64: String(args.mask_base64 ?? ''),
    filename: String(args.mask_filename ?? 'mask.png'),
  });

  if (mask.ok) {
    const style = args.style ? String(args.style).trim() : undefined;
    const numImages = args.num_images != null ? Number(args.num_images) : undefined;
    const result = await ideogramInpaintImage({
      prompt,
      image: image.image,
      mask: mask.image,
      styleType: style,
      numImages: Number.isFinite(numImages) ? numImages : undefined,
    });
    if (!result.ok) {
      return JSON.stringify({ error: result.error, status: result.status, detail: result.detail });
    }
    return formatIdeogramGenerateResult(result);
  }

  return handle_remix_image(args, _ctx);
}

async function handle_describe_image(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const resolved = await resolveIdeogramImageInput({
    url: String(args.url ?? args.image_url ?? ''),
    media_id: String(args.media_id ?? ''),
    data_base64: String(args.data_base64 ?? ''),
    filename: String(args.filename ?? ''),
  });
  if (!resolved.ok) return JSON.stringify({ error: resolved.error });

  const result = await ideogramDescribeImage(resolved.image);
  if (!result.ok) {
    return JSON.stringify({ error: result.error, status: result.status, detail: result.detail });
  }

  return JSON.stringify({
    ok: true,
    description_id: result.descriptionId,
    descriptions: result.descriptions,
    prompt_suggestion: result.descriptions[0],
  });
}

async function handle_save_image_to_media(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const url = String(args.url ?? args.image_url ?? '').trim();
  if (!url) return JSON.stringify({ error: 'url is required' });

  const altText = args.alt_text ? String(args.alt_text).trim() : undefined;
  const slug = args.slug ? String(args.slug).trim() : undefined;
  const filename = args.filename ? String(args.filename).trim() : undefined;

  const result = await storeImportRemoteImageToMediaLibrary({
    url,
    altText,
    slug,
    filename,
    uploadedBy: getAgentContext().userId ?? null,
    category: MEDIA_LIBRARY_CATEGORY_IDEOGRAM,
  });

  if (!result.ok) return JSON.stringify({ error: result.error });
  return JSON.stringify({
    ok: true,
    id: result.item.id,
    slug: result.item.slug,
    publicUrl: result.item.publicUrl,
    url: result.item.url,
    filename: result.item.filename,
  });
}

async function handle_save_image_to_project(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const slug = String(args.slug ?? '').trim();
  if (!slug || !isSafeWorkSlug(slug)) return JSON.stringify({ error: 'valid project slug is required' });
  const doc = await storeReadWork(slug);
  if (!doc) return JSON.stringify({ error: 'project not found', slug });

  const resolved = await resolveIdeogramImageInput({
    url: String(args.url ?? args.image_url ?? ''),
    media_id: String(args.media_id ?? ''),
    data_base64: String(args.data_base64 ?? ''),
    filename: String(args.filename ?? 'ideogram.png'),
  });
  if (!resolved.ok) return JSON.stringify({ error: resolved.error });

  const ctx = getAgentContext();
  const saved = await storeAddProjectFile(slug, {
    filename: resolved.image.filename,
    mediaType: resolved.image.mediaType,
    dataBase64: resolved.image.buffer.toString('base64'),
    uploadedBy: ctx.userId ?? null,
    source: 'agent',
    sourceRef: ctx.threadId ?? null,
    skipMediaArchive: Boolean(args.skip_media_archive),
  });

  if (!saved.ok) return JSON.stringify({ error: saved.error });
  return JSON.stringify({
    ok: true,
    slug: doc.slug,
    title: doc.title,
    file: saved.file,
  });
}

async function handle_list_generated_images(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const limit = args.limit != null ? Math.max(1, Math.min(100, Math.floor(Number(args.limit)))) : 40;
  const query = String(args.query ?? args.prompt ?? '').trim().toLowerCase();

  let items = await storeListMedia({ limit: 200, category: MEDIA_LIBRARY_CATEGORY_IDEOGRAM });
  if (query) {
    items = items.filter((item) => {
      const hay = `${item.altText ?? ''} ${item.filename} ${item.slug ?? ''}`.toLowerCase();
      return hay.includes(query);
    });
  }
  items = items.slice(0, limit);

  return JSON.stringify({
    ok: true,
    count: items.length,
    images: items.map((item) => ({
      id: item.id,
      slug: item.slug,
      filename: item.filename,
      alt_text: item.altText,
      publicUrl: item.publicUrl,
      created_at: item.createdAt,
    })),
    note: 'Lists Ideogram saves in the media library (category ideogram). Use save_image_to_media or generate_image with save_to_media.',
  });
}

async function handle_generate_logo_concepts(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const brief = String(args.prompt ?? args.brand ?? '').trim();
  if (!brief) return JSON.stringify({ error: 'prompt or brand is required' });

  const prompt = `Professional logo concept, vector-friendly, minimal brand mark on clean background: ${brief}`;
  return handle_generate_image(
    {
      ...args,
      prompt,
      style: args.style ?? 'design',
      aspect_ratio: args.aspect_ratio ?? '1x1',
      num_images: args.num_images ?? 4,
    },
    ctx,
  );
}

async function handle_generate_social_post_image(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const prompt = String(args.prompt ?? '').trim();
  if (!prompt) return JSON.stringify({ error: 'prompt is required' });

  const format = String(args.format ?? 'square').trim().toLowerCase();
  const aspectRatio =
    args.aspect_ratio != null
      ? String(args.aspect_ratio).trim()
      : SOCIAL_FORMAT_RATIOS[format] ?? '1x1';

  const normalized = normalizeIdeogramAspectRatio(aspectRatio) ?? '1x1';
  const socialPrompt = `Social media post graphic, polished and legible at mobile size: ${prompt}`;

  return handle_generate_image(
    {
      ...args,
      prompt: socialPrompt,
      aspect_ratio: normalized,
      style: args.style ?? 'design',
    },
    ctx,
  );
}

const IMAGE_SOURCE_PROPS = {
  url: {
    type: 'string',
    description: 'Public HTTPS URL of the source image (e.g. temporary Ideogram URL).',
  },
  media_id: {
    type: 'string',
    description: 'Media library id or slug for an existing image.',
  },
  data_base64: {
    type: 'string',
    description: 'Base64 image bytes (optionally data: URL).',
  },
  filename: {
    type: 'string',
    description: 'Optional filename hint when uploading bytes.',
  },
};

export const ideogramAgentTools: AgentToolModule = {
  id: 'ideogram',
  enabled: () => hasIdeogramImageGen(),
  definitions(_ctx: ToolContext): AgentToolDef[] {
    return [
      {
        type: 'function',
        function: {
          name: 'generate_image',
          description:
            'Generate AI images via Ideogram (Ideogram 3). Returns temporary URLs unless save_to_media is true. Requires ideogram module + IDEOGRAM_API_KEY.',
          parameters: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description:
                  'Detailed description of the image — style, composition, mood, and subject.',
              },
              style: {
                type: 'string',
                description:
                  'Optional: realistic, design, fiction, stylized, general, auto (REALISTIC/DESIGN/ILLUSTRATION aliases work).',
              },
              aspect_ratio: {
                type: 'string',
                description: 'Optional: 1x1, 16x9, 9x16, 4x3, etc. Colon form (16:9) accepted.',
              },
              num_images: { type: 'number', description: 'Variations to generate (1–8, default 1).' },
              save_to_media: {
                type: 'boolean',
                description:
                  'When true, downloads each result into the media library and returns permanent publicUrl values.',
              },
              alt_text: {
                type: 'string',
                description: 'Alt text when save_to_media is true (defaults to prompt).',
              },
              slug: {
                type: 'string',
                description: 'Optional media library slug for the first saved image.',
              },
            },
            required: ['prompt'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'generate_image_variations',
          description: 'Generate multiple Ideogram variations from one prompt (default 4 images).',
          parameters: {
            type: 'object',
            properties: {
              prompt: { type: 'string' },
              style: { type: 'string' },
              aspect_ratio: { type: 'string' },
              num_images: { type: 'number', description: 'Default 4.' },
              save_to_media: { type: 'boolean' },
              alt_text: { type: 'string' },
            },
            required: ['prompt'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'remix_image',
          description: 'Remix an existing image with a new prompt (Ideogram remix/auto).',
          parameters: {
            type: 'object',
            properties: {
              prompt: { type: 'string' },
              ...IMAGE_SOURCE_PROPS,
              image_weight: {
                type: 'number',
                description: '1–100 — how closely to follow the source image (default API behavior).',
              },
              num_images: { type: 'number' },
              aspect_ratio: { type: 'string' },
            },
            required: ['prompt'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'upscale_image',
          description: 'Upscale an image 2×, 4×, or 8× via Ideogram.',
          parameters: {
            type: 'object',
            properties: {
              ...IMAGE_SOURCE_PROPS,
              upscale_factor: { type: 'string', description: 'x2 (default), x4, or x8.' },
            },
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'edit_image',
          description:
            'Edit an image: inpaint when mask_* is provided (black mask region = repaint); otherwise remix with prompt.',
          parameters: {
            type: 'object',
            properties: {
              prompt: { type: 'string' },
              ...IMAGE_SOURCE_PROPS,
              mask_url: { type: 'string' },
              mask_media_id: { type: 'string' },
              mask_base64: { type: 'string' },
              mask_filename: { type: 'string' },
              style: { type: 'string' },
              num_images: { type: 'number' },
              image_weight: { type: 'number' },
              aspect_ratio: { type: 'string' },
            },
            required: ['prompt'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'describe_image',
          description: 'Generate a natural-language caption / prompt suggestion from an uploaded image.',
          parameters: {
            type: 'object',
            properties: { ...IMAGE_SOURCE_PROPS },
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'save_image_to_media',
          description:
            'Download a temporary image URL (e.g. from generate_image) into the permanent media library.',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'HTTPS image URL to import.' },
              alt_text: { type: 'string' },
              slug: { type: 'string', description: 'Optional public slug (/api/media/{slug}).' },
              filename: { type: 'string' },
            },
            required: ['url'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'save_image_to_project',
          description: 'Attach an image (URL, media library id, or base64) to a project file repo.',
          parameters: {
            type: 'object',
            properties: {
              slug: { type: 'string', description: 'Project slug.' },
              ...IMAGE_SOURCE_PROPS,
              skip_media_archive: {
                type: 'boolean',
                description: 'When true, do not also copy into the media library.',
              },
            },
            required: ['slug'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'list_generated_images',
          description:
            'Browse Ideogram images previously saved to the media library (by prompt text or date order).',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Filter by alt text, filename, or slug.' },
              limit: { type: 'number', description: 'Max rows (default 40, max 100).' },
            },
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'generate_logo_concepts',
          description: 'Generate logo concept images (design style, square, multiple variations).',
          parameters: {
            type: 'object',
            properties: {
              prompt: { type: 'string', description: 'Brand name or creative brief.' },
              brand: { type: 'string', description: 'Alias for prompt.' },
              num_images: { type: 'number' },
              save_to_media: { type: 'boolean' },
              alt_text: { type: 'string' },
            },
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'generate_social_post_image',
          description:
            'Generate a social post graphic with preset aspect ratios: square, portrait/story, landscape/wide, feed (4:5), pin.',
          parameters: {
            type: 'object',
            properties: {
              prompt: { type: 'string' },
              format: {
                type: 'string',
                description: 'square | portrait | story | landscape | wide | feed | pin',
              },
              aspect_ratio: { type: 'string', description: 'Override format preset.' },
              style: { type: 'string' },
              save_to_media: { type: 'boolean' },
              alt_text: { type: 'string' },
            },
            required: ['prompt'],
            additionalProperties: false,
          },
        },
      },
    ];
  },
  handlers: {
    generate_image: handle_generate_image,
    generate_image_variations: handle_generate_image_variations,
    remix_image: handle_remix_image,
    upscale_image: handle_upscale_image,
    edit_image: handle_edit_image,
    describe_image: handle_describe_image,
    save_image_to_media: handle_save_image_to_media,
    save_image_to_project: handle_save_image_to_project,
    list_generated_images: handle_list_generated_images,
    generate_logo_concepts: handle_generate_logo_concepts,
    generate_social_post_image: handle_generate_social_post_image,
  },
};
