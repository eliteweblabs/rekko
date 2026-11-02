/**
 * GET handler for text-only header wordmark PNG — /api/branding/logo-text.
 */
import type { APIContext } from 'astro';
import { brandingEtag, renderCompanyLogoTextWordmarkPng } from './brandImageRender';
import { brandingPngHttpResponse, resolveCachedBrandingPng } from './brandingPngResponse';
import { getStoredCompanyConfig } from './companyConfigStore';

export async function brandingLogoTextPngGet(context: APIContext): Promise<Response> {
  const { request, url } = context;
  const stored = await getStoredCompanyConfig();
  const etagInner = brandingEtag(stored, 640, 'logo-text');

  const body = await resolveCachedBrandingPng(etagInner, async () => {
    return renderCompanyLogoTextWordmarkPng(stored);
  });
  if (!body) {
    return new Response('Not found', { status: 404 });
  }

  return brandingPngHttpResponse(request, url, etagInner, body);
}
