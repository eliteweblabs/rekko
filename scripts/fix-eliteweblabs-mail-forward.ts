/**
 * Remove reave.app from sen@eliteweblabs.com inbound path.
 * Priority-0 rule: sen@eliteweblabs.com → thomas@inbound.rekko.studio (Resend receiving).
 *
 * Cloudflare API cannot edit the zone catch-all rule (code 2020); change or disable
 * "Catch-all to get@reave.app" in the dashboard if you want all @eliteweblabs mail on rekko.
 *
 * Run: set -a && source .env && set +a && npx tsx scripts/fix-eliteweblabs-mail-forward.ts
 */
import { cloudflareFindZone } from '../src/lib/cloudflareClient.ts';
import { serverEnv } from '../src/lib/serverEnv.ts';

const CF_API = 'https://api.cloudflare.com/client/v4';
const ZONE_NAME = 'eliteweblabs.com';
const OWNER = 'sen@eliteweblabs.com';
const FORWARD_TO = (process.env.ELITEWEBLABS_MAIL_FORWARD ?? 'thomas@inbound.rekko.studio')
  .trim()
  .toLowerCase();

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

async function main() {
  const zone = await cloudflareFindZone(ZONE_NAME);
  if (!zone.ok) throw new Error(zone.error);

  const accounts = await cfFetch<{ id: string }[]>('/accounts?per_page=5');
  if (!accounts.ok || !accounts.data?.length) throw new Error('Cloudflare account list failed');
  const accountId = accounts.data[0]!.id;

  type Dest = { id: string; email: string; verified?: string | null; status?: string };
  const destList = await cfFetch<Dest[]>(`/accounts/${accountId}/email/routing/addresses`);
  if (!destList.ok) throw new Error(destList.error);
  let dest = (destList.data ?? []).find((d) => d.email.toLowerCase() === FORWARD_TO);
  if (!dest) {
    const created = await cfFetch<Dest>(`/accounts/${accountId}/email/routing/addresses`, {
      method: 'POST',
      body: JSON.stringify({ email: FORWARD_TO }),
    });
    if (!created.ok) throw new Error(`create destination ${FORWARD_TO}: ${created.error}`);
    dest = created.data;
    console.log(
      `[eliteweblabs-mail] Added destination ${FORWARD_TO} — approve Cloudflare verify in Resend Receiving, then re-run.`,
    );
    process.exit(0);
  }
  if (dest.status !== 'verified' && !dest.verified) {
    console.log(
      `[eliteweblabs-mail] Destination ${FORWARD_TO} not verified — click the link in Resend Receiving, then re-run.`,
    );
    process.exit(0);
  }

  type Rule = { id: string; matchers?: { type?: string; field?: string; value?: string }[] };
  const rules = await cfFetch<Rule[]>(`/zones/${zone.data.id}/email/routing/rules`);
  if (!rules.ok) throw new Error(rules.error);
  const existing = (rules.data ?? []).find((r) =>
    r.matchers?.some((m) => m.type === 'literal' && m.value?.toLowerCase() === OWNER),
  );

  const ruleBody = {
    name: `sen → ${FORWARD_TO}`,
    enabled: true,
    priority: 0,
    matchers: [{ type: 'literal', field: 'to', value: OWNER }],
    actions: [{ type: 'forward', value: [FORWARD_TO] }],
  };

  if (!existing) {
    const rule = await cfFetch<Rule>(`/zones/${zone.data.id}/email/routing/rules`, {
      method: 'POST',
      body: JSON.stringify(ruleBody),
    });
    if (!rule.ok) throw new Error(`create ${OWNER} rule: ${rule.error}`);
    console.log(`[eliteweblabs-mail] ✓ ${OWNER} → ${FORWARD_TO}`);
  } else {
    const updated = await cfFetch<Rule>(`/zones/${zone.data.id}/email/routing/rules/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify(ruleBody),
    });
    if (!updated.ok) throw new Error(`update ${OWNER} rule: ${updated.error}`);
    console.log(`[eliteweblabs-mail] ✓ ${OWNER} → ${FORWARD_TO} (updated)`);
  }

  const catchAll = (rules.data ?? []).find((r) => r.matchers?.some((m) => m.type === 'all'));
  if (catchAll) {
    console.log(
      `[eliteweblabs-mail] Note: catch-all still exists (${catchAll.id}). ${OWNER} uses priority 0 and skips reave.app. Edit catch-all in Cloudflare dashboard to move other aliases to rekko.`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
