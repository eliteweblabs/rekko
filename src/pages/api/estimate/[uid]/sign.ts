/**
 * POST /api/estimate/:uid/sign
 *
 * E-sign a Crater estimate (Option A): store signed artifact on the contact portal,
 * then mark the estimate ACCEPTED in Crater via accept-signed.
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
import { getCompanyConfig, poweredByLabel } from '../../../../lib/companyConfig';
import { sendEmail, isEmailSendConfigured } from '../../../../lib/outbound';
import { brandedEmailHtml } from '../../../../lib/emailTemplates';
import { postToSystemAlertsThread } from '../../../../lib/adminAgentAlert';
import { checkInMemoryRateLimit } from '../../../../lib/inMemoryRateLimit';
import { clientIp } from '../../../../lib/clientIp';
import { hasDigitalSignature } from '../../../../lib/features';
import { buildSignatureBlock, fmtDateLong } from '../../../../lib/esignSignatureBlock';
import {
  craterAcceptSignedEstimate,
  craterGetEstimateByHash,
  isCraterConfigured,
} from '../../../../lib/craterClient';
import { renderEstimateSignHtml } from '../../../../lib/estimateSignHtml';

export const prerender = false;

function err(status: number, error: string): Response {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ params, request }) => {
  if (!hasDigitalSignature()) {
    return err(403, 'Digital Signature is not enabled on this install');
  }
  if (!isCraterConfigured()) {
    return err(503, 'Crater Financial is not configured');
  }

  const rate = checkInMemoryRateLimit(`estimate-sign:${clientIp(request)}`, {
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
  const uniqueHash = typeof raw.uniqueHash === 'string' ? raw.uniqueHash.trim() : '';
  const signerName = typeof raw.signerName === 'string' ? raw.signerName.trim() : '';
  const consentChecked = raw.consentChecked === true;

  if (!uniqueHash) return err(400, 'Missing uniqueHash');
  if (signerName.length < 2) return err(400, 'signerName must be at least 2 characters');
  if (!consentChecked) return err(400, 'Electronic-records consent is required');

  const contactRes = await getContact(uid);
  if (!contactRes.ok || contactRes.data.archived) return err(404, 'Contact not found');

  const portal = extractPortal(contactRes.data) ?? {};
  if (portal.enabled === false) return err(404, 'Contact not found');

  const craterRes = await craterGetEstimateByHash(uniqueHash, uid);
  if (!craterRes.ok) {
    const status = craterRes.status === 410 ? 410 : craterRes.status === 404 ? 404 : 502;
    return err(status, craterRes.error);
  }

  const payload = craterRes.data.payload;
  const estimateId = payload.crater.estimate_id;
  const title = `Estimate ${payload.estimate.estimate_number}`;

  const existingDoc = (portal.documents ?? []).find(
    (d) => d.estimateUniqueHash === uniqueHash || d.craterEstimateId === estimateId,
  );
  if (existingDoc) {
    const viewUrl = `${siteBaseUrl(request)}/doc/${encodeURIComponent(uid)}/view/${existingDoc.id}`;
    return new Response(
      JSON.stringify({ ok: false, alreadySigned: true, docId: existingDoc.id, viewUrl }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (payload.estimate.signature_view_url && payload.estimate.status === 'ACCEPTED') {
    return new Response(
      JSON.stringify({
        ok: false,
        alreadySigned: true,
        viewUrl: payload.estimate.signature_view_url,
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const ip = clientIp(request);
  const userAgent = request.headers.get('user-agent')?.trim() ?? 'unknown';
  const signedAt = new Date().toISOString();
  const consentAt = signedAt;

  const company = await getCompanyConfig(request);
  const filledHtml = renderEstimateSignHtml(payload);
  const contentHash = createHash('sha256').update(filledHtml, 'utf8').digest('hex');

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
    id: docId,
    template: 'crater-estimate',
    title,
    signedAt,
    signerName,
    content: fullContent,
    ip,
    userAgent,
    consentAt,
    contentHash,
    estimateUniqueHash: uniqueHash,
    craterEstimateId: estimateId,
  };

  const viewUrl = `${siteBaseUrl(request)}/doc/${encodeURIComponent(uid)}/view/${docId}`;

  const acceptRes = await craterAcceptSignedEstimate(estimateId, {
    contact_uid: uid,
    signer_name: signerName,
    signed_at: signedAt,
    signature_doc_id: docId,
    signature_view_url: viewUrl,
  });
  if (!acceptRes.ok) {
    return err(502, acceptRes.error);
  }

  const merged = {
    ...portal,
    documents: [...(portal.documents ?? []), doc],
  };

  const saveRes = await setContactPortal(uid, merged);
  if (!saveRes.ok) {
    return err(502, saveRes.error);
  }

  const contact = contactRes.data;

  if (contact.email && isEmailSendConfigured()) {
    const signerFirstName = (contact.name || signerName || '').split(/\s+/)[0] || 'there';
    sendEmail({
      to: contact.email,
      subject: `Your signed copy: ${title}`,
      text: [
        `Hi ${contact.name},`,
        '',
        `You have electronically signed "${title}".`,
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
        paragraphs: [`You have electronically signed "${title}".`],
        cta: { label: 'View & download your signed copy', url: viewUrl },
        metaRows: [
          ['Signed by', signerName],
          ['Date', fmtDateLong(signedAt)],
          ['Document ID', docId],
        ],
      }),
    }).catch(() => {});
  }

  const alertMsg = [
    'Estimate signed',
    `Contact: ${contact.name}`,
    `Signed by: ${signerName}`,
    `${title} · #${payload.estimate.estimate_number}`,
    viewUrl,
  ].join('\n');
  postToSystemAlertsThread({
    message: alertMsg,
    autoRun: false,
    push: {
      title: `Signed: ${title}`,
      body: `${contact.name} · ${signerName}`,
      tag: 'estimate-signed',
      url: '/admin?tab=documents',
    },
  }).catch(() => {});

  return new Response(JSON.stringify({ ok: true, docId, viewUrl }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
