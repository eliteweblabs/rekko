import type { APIContext } from 'astro';
import { createContact, isContactApiConfigured } from '../../../lib/contactApi';
import {
  contactImportDisplayName,
  parseContactImportFile,
  parseContactImportIndices,
  pickContactsByIndices,
} from '../../../lib/contactImportParse';
import { requireDashboardUser } from '../../../lib/dashboardAuth';

export const prerender = false;

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

  const updateExisting = formData.get('updateExisting') === 'true';

  let content: string;
  try {
    content = await file.text();
  } catch {
    return json({ ok: false, error: 'Failed to read file' }, 400);
  }

  let parsedContacts = parseContactImportFile(content, file.name);
  if (parsedContacts.length === 0) {
    return json({ ok: false, error: 'No valid contacts found in file' }, 400);
  }

  const indices = parseContactImportIndices(formData.get('indices'));
  if (indices !== null) {
    if (indices.length === 0) {
      return json({ ok: false, error: 'Select at least one contact to import' }, 400);
    }
    parsedContacts = pickContactsByIndices(parsedContacts, indices);
  }

  const results = {
    total: parsedContacts.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
  };

  for (const contact of parsedContacts) {
    const name = contact.name?.trim();
    if (!name && !contact.email && !contact.phone) {
      results.skipped++;
      continue;
    }

    const displayName = contactImportDisplayName(contact);

    try {
      if (updateExisting && (contact.email || contact.phone)) {
        const createResult = await createContact({
          name: displayName,
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
          notes: contact.notes,
        });

        if (createResult.ok) {
          results.created++;
          void import('../../../lib/contactCraterSync')
            .then((m) => m.autoSyncContactToCrater(createResult.data))
            .catch(() => undefined);
        } else {
          results.errors.push(`${displayName}: ${createResult.error}`);
        }
      } else {
        const createResult = await createContact({
          name: displayName,
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
          notes: contact.notes,
        });

        if (createResult.ok) {
          results.created++;
          void import('../../../lib/contactCraterSync')
            .then((m) => m.autoSyncContactToCrater(createResult.data))
            .catch(() => undefined);
        } else {
          results.errors.push(`${displayName}: ${createResult.error}`);
        }
      }
    } catch (e) {
      results.errors.push(`${displayName}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return json({ ok: true, results }, 200);
}
