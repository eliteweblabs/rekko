/**
 * Lux owner mail vs app mail — Stripe account verification expects a normal
 * business MX path, not apex → Resend Inbound (SES). See Stripe Support:
 * corporate addresses behind third-party mail often never get @stripe.com verify mail.
 *
 * Target architecture:
 *   felicia@lux.cleaning     → Cloudflare Email Routing → inbox@inbound.lux.cleaning (Resend)
 *   inbox@inbound.lux.cleaning / leads → Resend receiving on inbound.lux.cleaning only
 *   noreply@inbound.lux.cleaning     → Resend send (unchanged)
 *
 * Run: set -a && source .env && set +a && npx tsx scripts/fix-lux-stripe-owner-mail.ts
 */
import {
  cloudflareFindZone,
  cloudflareListDnsRecords,
  cloudflareDeleteDnsRecord,
  cloudflareUpsertDnsRecord,
} from '../src/lib/cloudflareClient.ts';
import { serverEnv } from '../src/lib/serverEnv.ts';
import {
  resendCreateDomain,
  resendGetDomainByName,
  syncResendDnsToCloudflare,
  resendEnsureInboundWebhook,
} from '../src/lib/resendDnsSync.ts';

const CF_API = 'https://api.cloudflare.com/client/v4';
const APEX = 'lux.cleaning';
const INBOUND = `inbound.${APEX}`;
const INBOX = `inbox@${INBOUND}`;
const OWNER = (process.env.OWNER_EMAIL ?? 'felicia@lux.cleaning').trim().toLowerCase();
/** When Resend is at domain limit, forward owner mail to a real mailbox (Stripe verify path). */
const OWNER_FORWARD =
  (process.env.OWNER_MAIL_FORWARD ?? 'ms.ftracy@gmail.com').trim().toLowerCase();
/** Legacy SES and current Resend Inbound MX hosts — must not sit on apex (Stripe verify). */
const APEX_FORBIDDEN_MX = /inbound-smtp\.us-east-1\.amazonaws\.com|receive\.forge\.rmta\.net|\.rmta\.net$/i;
const WEBHOOK = `https://${APEX}/api/email/inbound`;

async function cfFetch<T>(path: string, init?: RequestInit): Promise<
  { ok: true; data: T } | { ok: false; error: string }
> {
  const apiToken = serverEnv('CLOUDFLARE_API_TOKEN')?.trim();
  if (!apiToken) return { ok: false, error: 'CLOUDFLARE_API_TOKEN is not set' };
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const raw = await res.text();
  let body: { success?: boolean; errors?: { message: string }[]; result?: T };
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return { ok: false, error: 'Invalid JSON from Cloudflare' };
  }
  if (!res.ok || body.success === false) {
    const msg = body.errors?.map((e) => e.message).join('; ') || `HTTP ${res.status}`;
    return { ok: false, error: msg };
  }
  return { ok: true, data: body.result as T };
}

async function ensureResendInboundSubdomain(): Promise<'inbox' | 'forward'> {
  console.log('[lux-stripe-mail] 1/5 Resend inbound subdomain:', INBOUND);
  let domain = await resendGetDomainByName(INBOUND);
  if (!domain.ok) {
    const created = await resendCreateDomain(INBOUND);
    if (!created.ok) {
      if (/domain limit/i.test(created.error)) {
        console.log(
          `[lux-stripe-mail] ⚠ Resend domain limit — owner forward → ${OWNER_FORWARD} (set OWNER_MAIL_FORWARD to override)`,
        );
        return 'forward';
      }
      throw new Error(`Resend create ${INBOUND}: ${created.error}`);
    }
    console.log(`[lux-stripe-mail] ✓ created ${INBOUND}`);
    domain = await resendGetDomainByName(INBOUND);
    if (!domain.ok) throw new Error('Resend domain missing after create');
  } else {
    console.log(`[lux-stripe-mail] ✓ Resend domain ${domain.detail.name} (${domain.detail.status})`);
  }

  if (domain.detail.capabilities?.receiving !== 'enabled') {
    const key = serverEnv('RESEND_API_KEY')?.trim();
    if (!key) throw new Error('RESEND_API_KEY required');
    const res = await fetch(`https://api.resend.com/domains/${domain.detail.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ capabilities: { sending: 'enabled', receiving: 'enabled' } }),
    });
    if (!res.ok) console.warn('[lux-stripe-mail] ⚠ enable receiving:', await res.text());
    else console.log('[lux-stripe-mail] ✓ receiving enabled on', INBOUND);
  }

  const dns = await syncResendDnsToCloudflare(INBOUND);
  console.log(dns.ok ? `[lux-stripe-mail] ✓ DNS ${dns.summary?.split('\n')[0]}` : `[lux-stripe-mail] ⚠ DNS: ${dns.error}`);

  const hook = await resendEnsureInboundWebhook(WEBHOOK);
  if (!hook.ok) throw new Error(`Resend webhook: ${hook.error}`);
  console.log(`[lux-stripe-mail] ✓ webhook ${hook.created ? 'created' : 'reused'} → ${WEBHOOK}`);
  return 'inbox';
}

async function main() {
  const zone = await cloudflareFindZone(APEX);
  if (!zone.ok) throw new Error(zone.error);

  const routeMode = await ensureResendInboundSubdomain();
  const forwardTarget = routeMode === 'inbox' ? INBOX : OWNER_FORWARD;

  console.log('[lux-stripe-mail] 2/5 Remove apex Resend Inbound MX (Stripe-incompatible path)');
  const listed = await cloudflareListDnsRecords(zone.data.id, { type: 'MX' });
  if (!listed.ok) throw new Error(listed.error);
  for (const mx of listed.data) {
    const name = mx.name.toLowerCase().replace(/\.$/, '');
    if (name !== APEX) continue;
    if (/\.mx\.cloudflare\.net$/i.test(mx.content)) continue;
    if (!APEX_FORBIDDEN_MX.test(mx.content) && !/amazonaws\.com$/i.test(mx.content)) continue;
    const del = await cloudflareDeleteDnsRecord(zone.data.id, mx.id);
    if (!del.ok) throw new Error(`delete apex MX: ${del.error}`);
    console.log(`[lux-stripe-mail] ✓ deleted apex MX → ${mx.content}`);
  }

  console.log('[lux-stripe-mail] 3/5 Enable Cloudflare Email Routing on apex');
  const enable = await cfFetch<{ enabled?: boolean }>(`/zones/${zone.data.id}/email/routing/enable`, {
    method: 'POST',
  });
  if (!enable.ok) throw new Error(`enable routing: ${enable.error}`);
  console.log('[lux-stripe-mail] ✓ Email Routing enabled');

  const apexTxt = await cloudflareListDnsRecords(zone.data.id, { type: 'TXT' });
  if (apexTxt.ok) {
    const onApex = apexTxt.data.filter((r) => r.name.toLowerCase().replace(/\.$/, '') === APEX);
    const spf =
      'v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com ~all';
    const up = await cloudflareUpsertDnsRecord(
      zone.data.id,
      { type: 'TXT', name: APEX, content: spf, ttl: 1, proxied: false },
      onApex,
    );
    if (up.ok) console.log('[lux-stripe-mail] ✓ apex SPF for Email Routing');
    else console.warn('[lux-stripe-mail] ⚠ apex SPF:', up.error);
  }

  const accounts = await cfFetch<{ id: string }[]>('/accounts?per_page=5');
  if (!accounts.ok || !accounts.data?.length) throw new Error('Cloudflare account list failed');
  const accountId = accounts.data[0]!.id;

  console.log('[lux-stripe-mail] 4/5 Routing destination', forwardTarget);
  type Dest = { id: string; email: string; verified?: string };
  const destList = await cfFetch<Dest[]>(`/accounts/${accountId}/email/routing/addresses`);
  if (!destList.ok) throw new Error(destList.error);
  let dest = (destList.data ?? []).find((d) => d.email.toLowerCase() === forwardTarget.toLowerCase());
  if (!dest) {
    const created = await cfFetch<Dest>(`/accounts/${accountId}/email/routing/addresses`, {
      method: 'POST',
      body: JSON.stringify({ email: forwardTarget }),
    });
    if (!created.ok) throw new Error(`create destination: ${created.error}`);
    dest = created.data;
    console.log(
      `[lux-stripe-mail] ✓ added destination ${forwardTarget} — approve Cloudflare verify email in that inbox`,
    );
  } else {
    console.log(`[lux-stripe-mail] ✓ destination ${forwardTarget} (${dest.verified ?? 'verify pending'})`);
  }

  console.log('[lux-stripe-mail] 5/5 Rule', OWNER, '→', forwardTarget);
  type Rule = { id: string; matchers?: { value?: string }[] };
  const rules = await cfFetch<Rule[]>(`/zones/${zone.data.id}/email/routing/rules`);
  if (!rules.ok) throw new Error(rules.error);
  const existing = (rules.data ?? []).find((r) =>
    r.matchers?.some((m) => m.value?.toLowerCase() === OWNER),
  );
  const ruleBody = {
    name: routeMode === 'inbox' ? 'Owner → REΛVE Resend inbound' : 'Owner (Stripe/Clerk) → owner forward',
    enabled: true,
    matchers: [{ type: 'literal', field: 'to', value: OWNER }],
    actions: [{ type: 'forward', value: [forwardTarget] }],
  };
  if (!existing) {
    const rule = await cfFetch<Rule>(`/zones/${zone.data.id}/email/routing/rules`, {
      method: 'POST',
      body: JSON.stringify(ruleBody),
    });
    if (!rule.ok) throw new Error(`create rule: ${rule.error}`);
    console.log(`[lux-stripe-mail] ✓ ${OWNER} → ${forwardTarget}`);
  } else {
    const updated = await cfFetch<Rule>(`/zones/${zone.data.id}/email/routing/rules/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify(ruleBody),
    });
    if (!updated.ok) {
      if (/not verified/i.test(updated.error)) {
        console.log(
          `[lux-stripe-mail] ⚠ Cloudflare destination ${forwardTarget} not verified yet — open that inbox and approve Cloudflare's verification message, then re-run this script.`,
        );
      } else {
        throw new Error(`update rule: ${updated.error}`);
      }
    } else {
      console.log(`[lux-stripe-mail] ✓ updated ${OWNER} → ${forwardTarget} (${existing.id})`);
    }
  }

  console.log(`
Done. Apex MX is Cloudflare Email Routing (not Resend SES inbound).
Stripe still addresses ${OWNER}; delivery path is now a standard business MX (CF), then → ${forwardTarget}.
${routeMode === 'forward' ? 'Open that inbox for Stripe verify mail (same address in Stripe UI).' : 'REΛVE Inbox receives via ' + INBOX + '.'}
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
