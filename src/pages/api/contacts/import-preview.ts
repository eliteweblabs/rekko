import type { APIContext } from 'astro';
import {
  contactImportDisplayName,
  parseContactImportFile,
} from '../../../lib/contactImportParse';
import { requireDashboardUser } from '../../../lib/dashboardAuth';
import { isContactApiConfigured } from '../../../lib/contactApi';

export const prerender = false;

const PREVIEW_CAP = 5000;

export async function POST(context: APIContext): Promise<Response> {
  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const auth = await requireDashboardUser(context);
  if (auth instanceof Response) return auth;

  if (!isContactApiConfigured()) {
    return json({ ok: false, error: 'CONTACT_API_BASE_URL is not configured' }, 503);
  }

  let formData: FormData;
  try {
    formData = await context.request.formData();
  } catch {
    return json({ ok: false, error: 'Invalid form data' }, 400);
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return json({ ok: false, error: 'file is required' }, 400);
  }

  let content: string;
  try {
    content = await file.text();
  } catch {
    return json({ ok: false, error: 'Failed to read file' }, 400);
  }

  const parsed = parseContactImportFile(content, file.name);
  if (parsed.length === 0) {
    return json({ ok: false, error: 'No valid contacts found in file' }, 400);
  }

  const truncated = parsed.length > PREVIEW_CAP;
  const slice = truncated ? parsed.slice(0, PREVIEW_CAP) : parsed;

  const contacts = slice.map((row, index) => ({
    index,
    name: contactImportDisplayName(row),
    email: row.email?.trim() || null,
    phone: row.phone?.trim() || null,
    company: row.company?.trim() || null,
  }));

  return json({
    ok: true,
    fileName: file.name,
    total: parsed.length,
    truncated,
    contacts,
  });
}
