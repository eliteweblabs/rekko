import type { APIContext } from 'astro';
import { getCompanyConfig } from '../../../../lib/companyConfig';
import {
  clearStoredCompanyLogoText,
  setStoredCompanyConfig,
  setStoredCompanyLogoText,
} from '../../../../lib/companyConfigStore';
import { parseCompanyBrandUpload } from '../../../../lib/companyLogo';
import {
  archiveSvgUploadToMediaLibrary,
  archiveUploadToMediaLibrary,
} from '../../../../lib/mediaLibrary';
import { requireDashboardUser } from '../../../../lib/dashboardAuth';
import { jsonResponse } from '../../../../lib/apiResponse';

export const prerender = false;

export async function POST(context: APIContext): Promise<Response> {
  const auth = await requireDashboardUser(context);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  let form: FormData;
  try {
    form = await context.request.formData();
  } catch {
    return jsonResponse({ error: 'Expected multipart form data' }, 400);
  }

  const file = form.get('logoText') ?? form.get('logo');
  if (!(file instanceof File) || !file.size) {
    return jsonResponse({ error: 'Missing logo text file' }, 400);
  }

  const parsed = await parseCompanyBrandUpload(file);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, 400);

  const ok =
    parsed.kind === 'svg'
      ? await setStoredCompanyConfig({
          logoTextSvg: parsed.svg,
          logoTextData: null,
          logoTextMediaType: null,
        })
      : await setStoredCompanyLogoText({
          dataBase64: parsed.dataBase64,
          mediaType: parsed.mediaType,
        });
  if (!ok) return jsonResponse({ error: 'Failed to save logo text' }, 500);

  if (parsed.kind === 'svg') {
    await archiveSvgUploadToMediaLibrary({
      filename: file.name.trim() || undefined,
      svg: parsed.svg,
      uploadedBy: userId,
    });
  } else {
    await archiveUploadToMediaLibrary({
      filename: file.name.trim() || undefined,
      mediaType: parsed.mediaType,
      dataBase64: parsed.dataBase64,
      uploadedBy: userId,
    });
  }

  const company = await getCompanyConfig(context.request);
  return jsonResponse({ ok: true, company });
}

export async function DELETE(context: APIContext): Promise<Response> {
  const auth = await requireDashboardUser(context);
  if (auth instanceof Response) return auth;

  const ok = await clearStoredCompanyLogoText();
  if (!ok) return jsonResponse({ error: 'Failed to remove logo text' }, 500);

  const company = await getCompanyConfig(context.request);
  return jsonResponse({ ok: true, company });
}
