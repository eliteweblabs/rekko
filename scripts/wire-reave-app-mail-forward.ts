/**
 * Legacy reave.app mail → reave@rekko.studio (Resend receiving on rekko.studio apex).
 *
 * Replaces Proton apex MX with Cloudflare Email Routing + catch-all forward.
 * Does not change inbound.reave.app (Resend MX stays for direct inbound addresses).
 *
 * Run (needs CLOUDFLARE_API_TOKEN with Zone DNS + Email Routing edit):
 *   set -a && source .env && set +a && npm run wire:reave-app-mail-forward
 * Or:
 *   railway run --service reave -- npm run wire:reave-app-mail-forward
 */
import {
  cloudflareFindZone,
  cloudflareListDnsRecords,
  cloudflareDeleteDnsRecord,
  cloudflareUpsertDnsRecord,
} from '../src/lib/cloudflareClient.ts';
import { serverEnv } from '../src/lib/serverEnv.ts';

const CF_API = 'https://api.cloudflare.com/client/v4';
const APEX = 'reave.app';
const FORWARD_TO = (process.env.REAVE_APP_MAIL_FORWARD ?? 'reave@rekko.studio').trim().toLowerCase();
/** Apex MX hosts that must go before Email Routing (Proton legacy, Resend inbound on apex). */
const APEX_MX_TO_REMOVE =
  /protonmail\.ch$|inbound-smtp\.us-east-1\.amazonaws\.com|receive\.forge\.rmta\.net|\.rmta\.net$/i;
const APEX_SPF =
  'v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com ~all';

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
  let body: { success?: boolean; errors?: { code?: number; message: string }[]; result?: T };
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return { ok: false, error: 'Invalid JSON from Cloudflare' };
  }
  if (!res.ok || body.success === false) {
    const msg =
      body.errors?.map((e) => (e.code ? `[${e.code}] ${e.message}` : e.message)).join('; ') ||
      `HTTP ${res.status}`;
    return { ok: false, error: msg };
  }
  return { ok: true, data: body.result as T };
}

function isVerifiedDest(dest: { verified?: string | null; status?: string | null }): boolean {
  if (dest.status === 'verified') return true;
  if (dest.verified) return true;
  return false;
}

async function main() {
  const zone = await cloudflareFindZone(APEX);
  if (!zone.ok) throw new Error(zone.error);

  console.log(`[reave-app-mail] Target: *@${APEX} → ${FORWARD_TO}`);

  console.log('[reave-app-mail] 1/6 Remove legacy apex MX (Proton / apex Resend)');
  const listed = await cloudflareListDnsRecords(zone.data.id, { type: 'MX' });
  if (!listed.ok) throw new Error(listed.error);
  for (const mx of listed.data) {
    const name = mx.name.toLowerCase().replace(/\.$/, '');
    if (name !== APEX) continue;
    if (/\.mx\.cloudflare\.net$/i.test(mx.content)) continue;
    if (!APEX_MX_TO_REMOVE.test(mx.content)) {
      console.log(`[reave-app-mail] ℹ keeping apex MX → ${mx.content}`);
      continue;
    }
    const del = await cloudflareDeleteDnsRecord(zone.data.id, mx.id);
    if (!del.ok) throw new Error(`delete apex MX ${mx.content}: ${del.error}`);
    console.log(`[reave-app-mail] ✓ deleted apex MX → ${mx.content}`);
  }

  console.log('[reave-app-mail] 2/6 Enable Cloudflare Email Routing');
  const enable = await cfFetch<{ enabled?: boolean }>(`/zones/${zone.data.id}/email/routing/enable`, {
    method: 'POST',
  });
  if (!enable.ok) throw new Error(`enable routing: ${enable.error}`);
  console.log('[reave-app-mail] ✓ Email Routing enabled');

  const apexTxt = await cloudflareListDnsRecords(zone.data.id, { type: 'TXT' });
  if (apexTxt.ok) {
    const onApex = apexTxt.data.filter((r) => r.name.toLowerCase().replace(/\.$/, '') === APEX);
    const up = await cloudflareUpsertDnsRecord(
      zone.data.id,
      { type: 'TXT', name: APEX, content: APEX_SPF, ttl: 1, proxied: false },
      onApex,
    );
    if (up.ok) console.log('[reave-app-mail] ✓ apex SPF for Email Routing + Resend send');
    else console.warn('[reave-app-mail] ⚠ apex SPF:', up.error);
  }

  const accounts = await cfFetch<{ id: string }[]>('/accounts?per_page=5');
  if (!accounts.ok || !accounts.data?.length) throw new Error('Cloudflare account list failed');
  const accountId = accounts.data[0]!.id;

  console.log('[reave-app-mail] 3/6 Routing destination', FORWARD_TO);
  type Dest = { id: string; email: string; verified?: string | null; status?: string | null };
  const destList = await cfFetch<Dest[]>(`/accounts/${accountId}/email/routing/addresses`);
  if (!destList.ok) throw new Error(destList.error);
  let dest = (destList.data ?? []).find((d) => d.email.toLowerCase() === FORWARD_TO);
  if (!dest) {
    const created = await cfFetch<Dest>(`/accounts/${accountId}/email/routing/addresses`, {
      method: 'POST',
      body: JSON.stringify({ email: FORWARD_TO }),
    });
    if (!created.ok) throw new Error(`create destination: ${created.error}`);
    dest = created.data;
    console.log(
      `[reave-app-mail] ✓ added destination ${FORWARD_TO} — approve Cloudflare verify in that inbox, then re-run`,
    );
    process.exit(0);
  }
  if (!isVerifiedDest(dest)) {
    console.log(
      `[reave-app-mail] Destination ${FORWARD_TO} not verified — open that inbox and approve Cloudflare, then re-run`,
    );
    process.exit(0);
  }
  console.log(`[reave-app-mail] ✓ destination ${FORWARD_TO} verified`);

  console.log('[reave-app-mail] 4/6 Catch-all rule');
  type Rule = {
    id: string;
    name?: string;
    matchers?: { type?: string; field?: string; value?: string }[];
    actions?: { type?: string; value?: string[] }[];
  };
  const rules = await cfFetch<Rule[]>(`/zones/${zone.data.id}/email/routing/rules`);
  if (!rules.ok) throw new Error(rules.error);

  const catchAllBody = {
    name: `Catch-all → ${FORWARD_TO}`,
    enabled: true,
    matchers: [{ type: 'all' }],
    actions: [{ type: 'forward', value: [FORWARD_TO] }],
  };

  const catchAll = (rules.data ?? []).find((r) => r.matchers?.some((m) => m.type === 'all'));
  if (!catchAll) {
    const rule = await cfFetch<Rule>(`/zones/${zone.data.id}/email/routing/rules`, {
      method: 'POST',
      body: JSON.stringify(catchAllBody),
    });
    if (!rule.ok) throw new Error(`create catch-all: ${rule.error}`);
    console.log(`[reave-app-mail] ✓ catch-all → ${FORWARD_TO}`);
  } else {
    const forwardsTo = catchAll.actions?.find((a) => a.type === 'forward')?.value ?? [];
    const already =
      forwardsTo.length === 1 && forwardsTo[0]?.toLowerCase() === FORWARD_TO.toLowerCase();
    if (already) {
      console.log(`[reave-app-mail] ✓ catch-all already → ${FORWARD_TO} (${catchAll.id})`);
    } else {
      const updated = await cfFetch<Rule>(`/zones/${zone.data.id}/email/routing/rules/${catchAll.id}`, {
        method: 'PUT',
        body: JSON.stringify(catchAllBody),
      });
      if (updated.ok) {
        console.log(`[reave-app-mail] ✓ catch-all updated → ${FORWARD_TO}`);
      } else if (/2020|catch.?all/i.test(updated.error)) {
        console.log('[reave-app-mail] ⚠ Cloudflare blocked catch-all edit — deleting and recreating…');
        const del = await cfFetch<{ id: string }>(
          `/zones/${zone.data.id}/email/routing/rules/${catchAll.id}`,
          { method: 'DELETE' },
        );
        if (!del.ok) {
          console.error(
            `[reave-app-mail] Could not replace catch-all (${del.error}). In Cloudflare → Email Routing → reave.app, set catch-all to forward to ${FORWARD_TO}.`,
          );
          process.exit(1);
        }
        const recreated = await cfFetch<Rule>(`/zones/${zone.data.id}/email/routing/rules`, {
          method: 'POST',
          body: JSON.stringify(catchAllBody),
        });
        if (!recreated.ok) throw new Error(`recreate catch-all: ${recreated.error}`);
        console.log(`[reave-app-mail] ✓ catch-all recreated → ${FORWARD_TO}`);
      } else {
        throw new Error(`update catch-all: ${updated.error}`);
      }
    }
  }

  console.log('[reave-app-mail] 5/6 Confirm apex MX is Cloudflare Email Routing');
  const mxAfter = await cloudflareListDnsRecords(zone.data.id, { type: 'MX' });
  if (mxAfter.ok) {
    const apexMx = mxAfter.data.filter((r) => r.name.toLowerCase().replace(/\.$/, '') === APEX);
    for (const mx of apexMx) {
      console.log(`[reave-app-mail]   MX ${APEX} → ${mx.content} (prio ${mx.priority ?? '?'})`);
    }
    const hasCf = apexMx.some((mx) => /\.mx\.cloudflare\.net$/i.test(mx.content));
    if (!hasCf) {
      console.warn(
        '[reave-app-mail] ⚠ No route*.mx.cloudflare.net on apex yet — wait a minute or re-open Email Routing in the dashboard.',
      );
    }
  }

  console.log('[reave-app-mail] 6/6 inbound.reave.app unchanged (Resend receiving)');
  console.log(`
Done. Mail to any *@${APEX} should forward to ${FORWARD_TO} (rekko.studio Resend inbox).
Optional: BCC copy from ${FORWARD_TO} to inbox@inbound.rekko.studio for admin triage (see src/knowledge/email-rules.md).
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
