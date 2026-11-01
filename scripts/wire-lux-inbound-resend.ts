/**
 * Add inbound.lux.cleaning to Resend (receiving + send), sync Cloudflare DNS,
 * then point felicia@ Cloudflare routing → inbox@inbound.lux.cleaning.
 *
 * Requires a free Resend domain slot (upgrade or remove an unused domain first).
 *
 * Run after upgrade:
 *   set -a && source .env && set +a && npm run wire:lux-inbound-resend
 */
import { execSync } from 'node:child_process';

import {
  resendCreateDomain,
  resendGetDomainByName,
  syncResendDnsToCloudflare,
  resendEnsureInboundWebhook,
} from '../src/lib/resendDnsSync.ts';
import { serverEnv } from '../src/lib/serverEnv.ts';

const INBOUND = 'inbound.lux.cleaning';
const APEX = 'lux.cleaning';
const WEBHOOK = `https://${APEX}/api/email/inbound`;

async function enableReceiving(domainId: string): Promise<void> {
  const key = serverEnv('RESEND_API_KEY')?.trim();
  if (!key) throw new Error('RESEND_API_KEY is not set');
  const res = await fetch(`https://api.resend.com/domains/${domainId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ capabilities: { sending: 'enabled', receiving: 'enabled' } }),
  });
  if (!res.ok) throw new Error(`enable receiving: ${await res.text()}`);
}

async function main() {
  console.log('[wire-lux-inbound] Resend domain:', INBOUND);
  let domain = await resendGetDomainByName(INBOUND);
  if (!domain.ok) {
    const created = await resendCreateDomain(INBOUND);
    if (!created.ok) {
      console.error(`
Resend rejected create: ${created.error}

Upgrade plan or remove an unused domain in Resend, then re-run:
  npm run wire:lux-inbound-resend
`);
      process.exit(1);
    }
    console.log(`[wire-lux-inbound] ✓ created (${created.status})`);
    domain = await resendGetDomainByName(INBOUND);
    if (!domain.ok) throw new Error('domain missing after create');
  } else {
    console.log(`[wire-lux-inbound] ✓ already on Resend (${domain.detail.status})`);
  }

  if (domain.detail.capabilities?.receiving !== 'enabled') {
    await enableReceiving(domain.detail.id);
    console.log('[wire-lux-inbound] ✓ receiving enabled');
  }

  const dns = await syncResendDnsToCloudflare(INBOUND);
  if (!dns.ok) throw new Error(`DNS sync: ${dns.error}`);
  console.log(`[wire-lux-inbound] ✓ ${dns.summary.split('\n')[0]}`);

  const hook = await resendEnsureInboundWebhook(WEBHOOK);
  if (!hook.ok) throw new Error(`webhook: ${hook.error}`);
  console.log(`[wire-lux-inbound] ✓ webhook → ${WEBHOOK}`);

  console.log('[wire-lux-inbound] Updating Cloudflare owner routing (felicia@ → inbox@inbound)…');
  execSync('npx tsx scripts/fix-lux-stripe-owner-mail.ts', { stdio: 'inherit', env: process.env });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
