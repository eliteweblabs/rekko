/**
 * GET /api/clients/[uid]/emails — inbound mail for one contact (preview list).
 */
import type { APIContext } from 'astro';
import { getContact } from '../../../../lib/contactApi';
import { requireDashboardUser } from '../../../../lib/dashboardAuth';
import { jsonResponse } from '../../../../lib/apiResponse';
import { requireEmailInboxEnabled } from '../../../../lib/emailInboxFeature';
import {
  storeListEmailInboxForContact,
  toEmailInboxListRecord,
  type EmailInboxRecord,
} from '../../../../lib/emailInboxStore';
import { inboxListExcerpt } from '../../../../lib/emailBody';

export const prerender = false;

function enrichContactEmailEvent(event: EmailInboxRecord) {
  const excerpt = inboxListExcerpt(event);
  return {
    ...toEmailInboxListRecord(event),
    bodySnippet: excerpt,
    summary: excerpt || event.summary,
  };
}

export async function GET(context: APIContext): Promise<Response> {
  const auth = await requireDashboardUser(context);
  if (auth instanceof Response) return auth;

  const inboxOff = requireEmailInboxEnabled();
  if (inboxOff) return inboxOff;

  const uid = context.params.uid?.trim() || '';
  if (!uid) return jsonResponse({ ok: false, error: 'uid required' }, 400);

  const limitRaw = context.url.searchParams.get('limit');
  const limit = Math.min(Math.max(Number(limitRaw) || 100, 1), 500);
  const emailOverride = context.url.searchParams.get('email')?.trim() || '';

  const contactRes = await getContact(uid);
  if (!contactRes.ok) {
    return jsonResponse(
      { ok: false, error: contactRes.error || 'Contact not found' },
      contactRes.status && contactRes.status >= 400 ? contactRes.status : 404,
    );
  }

  const contactEmail = emailOverride || String(contactRes.data.email || '').trim();
  const events = await storeListEmailInboxForContact(uid, contactEmail, limit);

  return jsonResponse({
    ok: true,
    events: events.map((e) => enrichContactEmailEvent(e)),
  });
}
