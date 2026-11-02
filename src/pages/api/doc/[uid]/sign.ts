/**
 * POST /api/doc/:uid/sign
 *
 * Compliance checklist (US ESIGN Act / UETA):
 *  ✓ Intent to sign        — affirmative "Sign & Agree" button click
 *  ✓ Consent to e-records  — consentChecked flag required in body (checkbox on sign page)
 *  ✓ Association           — content hash ties the artifact to the signature event
 *  ✓ Attribution           — signerName + IP + userAgent + timestamp stored
 *  ✓ Retention             — full signed artifact (body + sig block + audit table)
 *                            baked inline into `content` at signing time
 */
import type { APIRoute } from 'astro';
import { createHash } from 'node:crypto';
import {
  getContact,
  extractPortal,
  setContactPortal,
  siteBaseUrl,
  type PortalDocument,
} from '../../../../lib/contactApi';
import { getTemplate, fillAndRenderTemplate } from '../../../../lib/documentTemplates';
import { getCompanyConfig, poweredByLabel } from '../../../../lib/companyConfig';
import { sendEmail, isEmailSendConfigured } from '../../../../lib/outbound';
import { brandedEmailHtml } from '../../../../lib/emailTemplates';
import { postToSystemAlertsThread } from '../../../../lib/adminAgentAlert';
import { serverEnv } from '../../../../lib/serverEnv';
import { checkInMemoryRateLimit } from '../../../../lib/inMemoryRateLimit';
import { clientIp } from '../../../../lib/clientIp';
import { buildSignatureBlock, fmtDateLong } from '../../../../lib/esignSignatureBlock';
import { hasDigitalSignature } from '../../../../lib/features';

export const prerender = false;

/** Fire-and-forget alert to the admin System alerts thread. */
async function notifyOperator(opts: {
  signerName: string;
  title: string;
  viewUrl: string;
  contactName: string;
}): Promise<void> {
  const msg = [
    'Document signed',
    `Contact: ${opts.contactName}`,
    `Signed by: ${opts.signerName}`,
    `Document: ${opts.title}`,
    opts.viewUrl,
  ].join('\n');
  await postToSystemAlertsThread({
    message: msg,
    autoRun: false,
    push: {
      title: `Signed: ${opts.title}`,
      body: `${opts.contactName} · ${opts.signerName}`,
      tag: 'doc-signed',
      url: '/admin?tab=documents',
    },
  }).catch(() => {});
}

function err(status: number, error: string): Response {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── route handler ──────────────────────────────────────────────────────────

export const POST: APIRoute = async ({ params, request }) => {
  if (!hasDigitalSignature()) {
    return err(403, 'Digital Signature is not enabled on this install');
  }

  const rate = checkInMemoryRateLimit(`doc-sign:${clientIp(request)}`, {
    windowMs: 10 * 60 * 1000,
    maxPerWindow: 15,
  });
  if (!rate.ok) {
    return err(429, 'Too many signing attempts. Please try again later.');
  }

  const uid = (params.uid ?? '').trim();
  if (!uid) return err(400, 'Missing uid');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err(400, 'Invalid JSON');
  }

  const raw = body as Record<string, unknown>;
  const templateSlug = typeof raw.template === 'string' ? raw.template.trim() : '';
  const signerName   = typeof raw.signerName === 'string' ? raw.signerName.trim() : '';
  const consentChecked = raw.consentChecked === true;

  if (!templateSlug)        return err(400, 'Missing template');
  if (signerName.length < 2) return err(400, 'signerName must be at least 2 characters');
  if (!consentChecked)       return err(400, 'Electronic-records consent is required');

  const tmpl = getTemplate(templateSlug);
  if (!tmpl) return err(400, `Unknown template "${templateSlug}"`);

  const contactRes = await getContact(uid);
  if (!contactRes.ok || contactRes.data.archived) return err(404, 'Contact not found');

  const portal = extractPortal(contactRes.data) ?? {};
  if (portal.enabled === false) return err(404, 'Contact not found');

  // ── Re-sign guard ──────────────────────────────────────────────────────────
  const existingDoc = (portal.documents ?? []).find((d) => d.template === templateSlug);
  if (existingDoc) {
    const viewUrl = `${siteBaseUrl(request)}/doc/${encodeURIComponent(uid)}/view/${existingDoc.id}`;
    return new Response(
      JSON.stringify({ ok: false, alreadySigned: true, docId: existingDoc.id, viewUrl }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── Capture audit metadata ─────────────────────────────────────────────────
  const ip        = clientIp(request);
  const userAgent = request.headers.get('user-agent')?.trim() ?? 'unknown';
  const signedAt  = new Date().toISOString();
  const consentAt = signedAt; // consent was recorded in the same request

  const company = await getCompanyConfig(request);

  // ── Fill template + hash ───────────────────────────────────────────────────
  const filledHtml  = await fillAndRenderTemplate(tmpl.markdown, contactRes.data, company);
  const contentHash = createHash('sha256').update(filledHtml, 'utf8').digest('hex');

  // ── Bake in signature block + audit table ──────────────────────────────────
  const docId = crypto.randomUUID();
  const sigBlock = buildSignatureBlock({
    docId,
    signerName,
    signedAt,
    consentAt,
    ip,
    userAgent,
    contentHash,
    companyName: company.name,
  });
  const fullContent = filledHtml + '\n' + sigBlock;

  const doc: PortalDocument = {
    id:          docId,
    template:    templateSlug,
    title:       tmpl.title,
    signedAt,
    signerName,
    content:     fullContent,
    ip,
    userAgent,
    consentAt,
    contentHash,
  };

  const merged = {
    ...portal,
    documents: [...(portal.documents ?? []), doc],
  };

  const saveRes = await setContactPortal(uid, merged);
  if (!saveRes.ok) return err(502, saveRes.error);

  const viewUrl = `${siteBaseUrl(request)}/doc/${encodeURIComponent(uid)}/view/${docId}`;
  const contact = contactRes.data;

  // ── Post-sign email to signer (fire and forget) ────────────────────────────
  if (contact.email && isEmailSendConfigured()) {
    const signerFirstName = (contact.name || signerName || '').split(/\s+/)[0] || 'there';
    sendEmail({
      to: contact.email,
      subject: `Your signed copy: ${tmpl.title}`,
      text: [
        `Hi ${contact.name},`,
        '',
        `You have electronically signed "${tmpl.title}".`,
        '',
        `View and download your signed copy here:`,
        viewUrl,
        '',
        `Signed by: ${signerName}`,
        `Date: ${fmtDateLong(signedAt)}`,
        `Document ID: ${docId}`,
        '',
        poweredByLabel(company),
      ].join('\n'),
      html: await brandedEmailHtml({
        firstName: signerFirstName,
        paragraphs: [`You have electronically signed "${tmpl.title}".`],
        cta: { label: 'View & download your signed copy', url: viewUrl },
        metaRows: [
          ['Signed by', signerName],
          ['Date', fmtDateLong(signedAt)],
          ['Document ID', docId],
        ],
      }),
    }).catch(() => {});
  }

  // ── Admin alert ───────────────────────────────────────────────────────────
  notifyOperator({
    signerName,
    title: tmpl.title,
    viewUrl,
    contactName: contact.name,
  }).catch(() => {});

  return new Response(
    JSON.stringify({ ok: true, docId, viewUrl }),
    { headers: { 'Content-Type': 'application/json' } }
  );
};
