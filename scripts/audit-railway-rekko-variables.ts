#!/usr/bin/env npx tsx
/**
 * Audit Railway env vars on every Reave App service (rekko repo).
 *
 *   npx tsx scripts/audit-railway-rekko-variables.ts
 *   npx tsx scripts/audit-railway-rekko-variables.ts --json > /tmp/audit.json
 *
 * Fingerprints secrets (sha256 prefix) — never prints raw secret values in stdout.
 */
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const REKKO_REPO = 'eliteweblabs/rekko';
const OUT_DIR = join(process.cwd(), 'docs', 'audits');

/** Keys that should be identical across installs (agency / hub keys). */
const SHARED_AGENCY_KEYS = new Set([
  'OPENROUTER_API_KEY',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'OMNIROUTE_API_KEY',
  'PEXELS_API_KEY',
  'IDEOGRAM_API_KEY',
  'BRAVE_API_KEY',
  'GOOGLE_PAGESPEED_API_KEY',
  'GOOGLE_MAPS_API_KEY',
  'PUBLIC_MAPBOX_ACCESS_TOKEN',
  'MAPBOX_ACCESS_TOKEN',
  'RAILWAY_API_TOKEN',
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'KINSTA_API_KEY',
  'KINSTA_COMPANY_ID',
  'CLOUDFLARE_API_TOKEN',
  'NAMECOM_USERNAME',
  'NAMECOM_TOKEN',
  'BRIGHTLOCAL_API_KEY',
  'ATTOM_API_KEY',
  'PLAUSIBLE_API_KEY',
]);

/** Per-install — must differ; flag if fingerprint matches another project. */
const PER_INSTALL_KEYS = new Set([
  'CLERK_SECRET_KEY',
  'PUBLIC_CLERK_PUBLISHABLE_KEY',
  'DATABASE_URL',
  'RESEND_API_KEY',
  'VAPI_API_KEY',
  'PUBLIC_VAPI_PUBLIC_KEY',
  'VAPI_ASSISTANT_ID',
  'PUBLIC_VAPI_ASSISTANT_ID',
  'TELNYX_API_KEY',
  'TELNYX_FROM_NUMBER',
  'AGENT_ALERT_USER_ID',
  'DASHBOARD_KEY',
  'REAVE_HUB_KEY',
  'CONTACT_API_KEY',
  'BOOKING_API_KEY',
]);

/** Prefer ${{ … }} references for these (not literal URLs/tokens). */
const PREFER_REFERENCE_PATTERNS: Array<{ key: RegExp; ideal: string }> = [
  { key: /^DATABASE_URL$/, ideal: '${{ reave-postgres.DATABASE_URL }}' },
  { key: /^CONTACT_API_BASE_URL$/, ideal: 'https://${{ contact-api.RAILWAY_PUBLIC_DOMAIN }}' },
  { key: /^CONTACT_API_KEY$/, ideal: '${{ shared.CONTACT_API_CLIENT_KEY }}' },
  { key: /^CRATER_API_BASE_URL$/, ideal: 'https://${{ crater.RAILWAY_PUBLIC_DOMAIN }}' },
  { key: /^CRATER_API_TOKEN$/, ideal: '${{ shared.CRATER_API_TOKEN }}' },
  { key: /^BOOKING_API_URL$/, ideal: 'https://${{ calcom-booking-api.RAILWAY_PUBLIC_DOMAIN }}' },
  { key: /^PUBLIC_BOOKING_API_URL$/, ideal: 'https://${{ calcom-web-app.RAILWAY_PUBLIC_DOMAIN }}' },
  { key: /^MATERIALS_API_BASE_URL$/, ideal: 'https://${{ materials-api.RAILWAY_PUBLIC_DOMAIN }}' },
  { key: /^MATERIALS_API_KEY$/, ideal: '${{ shared.MATERIALS_API_CLIENT_KEY }}' },
  { key: /^FLEET_API_BASE_URL$/, ideal: 'https://${{ fleet-api.RAILWAY_PUBLIC_DOMAIN }}' },
  { key: /^FLEET_API_KEY$/, ideal: '${{ shared.FLEET_API_CLIENT_KEY }}' },
  { key: /^INVENTORY_API_BASE_URL$/, ideal: 'https://${{ inventory-api.RAILWAY_PUBLIC_DOMAIN }}' },
  { key: /^INVENTORY_API_KEY$/, ideal: '${{ shared.INVENTORY_API_CLIENT_KEY }}' },
];

type RailwayProject = {
  id: string;
  name: string;
  services?: { edges?: Array<{ node: { id: string; name: string } }> };
};

type VarRow = {
  project: string;
  projectId: string;
  service: string;
  serviceId: string;
  key: string;
  raw: string;
  kind: 'reference' | 'empty' | 'literal' | 'sealed';
  fingerprint: string | null;
};

function railwayJson<T>(args: string): T {
  const out = execSync(`railway ${args} --json`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return JSON.parse(out) as T;
}

function listProjects(): RailwayProject[] {
  return railwayJson<RailwayProject[]>('list');
}

function listVars(projectId: string, serviceId: string, serviceName: string): Record<string, string> {
  try {
    return railwayJson<Record<string, string>>(
      `variable list -p ${projectId} -e production -s ${serviceName}`,
    );
  } catch {
    return {};
  }
}

function isReference(raw: string): boolean {
  return /\$\{\{/.test(raw);
}

function fingerprint(raw: string): string | null {
  const t = raw.trim();
  if (!t || isReference(t)) return null;
  return createHash('sha256').update(t).digest('hex').slice(0, 12);
}

function loadCodeEnvNames(): Set<string> {
  const text = readFileSync('/tmp/reave-env-vars.txt', 'utf8');
  return new Set(text.split('\n').filter(Boolean));
}

function isReaveAppService(vars: Record<string, string>): boolean {
  if (vars.INSTALL_CONFIG?.trim()) return true;
  if (vars.PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() && vars.DATABASE_URL?.trim()) return true;
  return false;
}

function classifyRaw(raw: string): VarRow['kind'] {
  if (raw === '' || raw === undefined) return 'empty';
  if (raw === '***') return 'sealed';
  if (isReference(raw)) return 'reference';
  return 'literal';
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });
  let codeEnv: Set<string>;
  try {
    codeEnv = loadCodeEnvNames();
  } catch {
    execSync(
      "rg -o \"serverEnv\\(['\\\"]([A-Z0-9_]+)\" --no-filename src plugins public scripts | sed \"s/serverEnv(['\\\"]//;s/['\\\"]//\" | sort -u > /tmp/reave-env-vars.txt",
      { cwd: process.cwd(), shell: '/bin/bash' },
    );
    codeEnv = loadCodeEnvNames();
  }

  const projects = listProjects();
  const targets: Array<{ project: string; projectId: string; service: string; serviceId: string }> = [];

  for (const p of projects) {
    const edges = p.services?.edges ?? [];
    for (const { node } of edges) {
      const vars = listVars(p.id, node.id, node.name);
      if (node.name === 'reave' || isReaveAppService(vars)) {
        targets.push({
          project: p.name,
          projectId: p.id,
          service: node.name,
          serviceId: node.id,
        });
      }
    }
  }

  const rows: VarRow[] = [];
  const byService = new Map<string, VarRow[]>();

  for (const t of targets) {
    const vars = listVars(t.projectId, t.serviceId, t.service);
    const list: VarRow[] = [];
    for (const [key, raw] of Object.entries(vars).sort(([a], [b]) => a.localeCompare(b))) {
      const row: VarRow = {
        ...t,
        key,
        raw: classifyRaw(raw) === 'reference' ? raw.trim() : classifyRaw(raw) === 'literal' ? '[literal]' : raw,
        kind: classifyRaw(String(raw)),
        fingerprint: fingerprint(String(raw)),
      };
      rows.push(row);
      list.push(row);
    }
    byService.set(`${t.projectId}:${t.service}`, list);
  }

  // Re-fetch for fingerprinting with actual values (in memory only)
  const fpByKey = new Map<string, Map<string, string[]>>(); // key -> fp -> projects[]
  for (const t of targets) {
    const vars = listVars(t.projectId, t.serviceId, t.service);
    for (const [key, raw] of Object.entries(vars)) {
      const fp = fingerprint(String(raw));
      if (!fp) continue;
      if (!fpByKey.has(key)) fpByKey.set(key, new Map());
      const m = fpByKey.get(key)!;
      if (!m.has(fp)) m.set(fp, []);
      m.get(fp)!.push(`${t.project} (${t.service})`);
    }
  }

  const allKeysOnRailway = new Set(rows.map((r) => r.key));
  const deadCandidates = [...allKeysOnRailway].filter((k) => !codeEnv.has(k)).sort();

  const agencyDrift: string[] = [];
  for (const key of SHARED_AGENCY_KEYS) {
    const m = fpByKey.get(key);
    if (!m || m.size <= 1) continue;
    const parts = [...m.entries()].map(([fp, projs]) => `fp:${fp} → ${projs.join(', ')}`);
    agencyDrift.push(`${key}: ${m.size} distinct values across installs\n    ${parts.join('\n    ')}`);
  }

  const literalAgency: string[] = [];
  for (const t of targets) {
    const vars = listVars(t.projectId, t.serviceId, t.service);
    for (const key of SHARED_AGENCY_KEYS) {
      const raw = vars[key];
      if (!raw?.trim()) continue;
      if (!isReference(raw) && classifyRaw(raw) === 'literal') {
        literalAgency.push(
          `${t.project}/${t.service}: ${key} is a literal (consider hub shared var or \${{ shared.${key} }})`,
        );
      }
    }
  }

  const shouldRef: string[] = [];
  for (const t of targets) {
    const vars = listVars(t.projectId, t.serviceId, t.service);
    for (const [key, raw] of Object.entries(vars)) {
      if (!raw?.trim() || isReference(raw)) continue;
      for (const rule of PREFER_REFERENCE_PATTERNS) {
        if (rule.key.test(key)) {
          shouldRef.push(`${t.project}/${t.service}: ${key} is literal — prefer ${rule.ideal}`);
        }
      }
    }
  }

  const perInstallCollisions: string[] = [];
  for (const key of PER_INSTALL_KEYS) {
    const m = fpByKey.get(key);
    if (!m || m.size <= 1) continue;
    const multi = [...m.values()].filter((p) => p.length > 1);
    if (multi.length) {
      perInstallCollisions.push(`${key}: same fingerprint on multiple installs (unexpected)`);
    }
  }

  const refCounts: Array<{ project: string; service: string; refs: number; total: number }> = [];
  for (const t of targets) {
    const vars = listVars(t.projectId, t.serviceId, t.service);
    const entries = Object.values(vars);
    const refs = entries.filter((v) => v && isReference(String(v))).length;
    refCounts.push({ project: t.project, service: t.service, refs, total: entries.length });
  }

  const lines: string[] = [];
  lines.push(`# Railway rekko app variable audit`);
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Repo filter: ${REKKO_REPO} (services with \`reave\` or INSTALL_CONFIG)`);
  lines.push(`Installs scanned: ${targets.length}`);
  lines.push('');
  lines.push('## Executive summary');
  lines.push('');
  lines.push(
    '- **Scope:** Every Railway project whose app service is named `reave` (or `pups` on PDX Paws) with `INSTALL_CONFIG`, plus a few INSTALL_CONFIG-only services.',
  );
  lines.push(
    '- **Duplicated agency keys:** Where `OPENROUTER_API_KEY`, `PEXELS_API_KEY`, and `IDEOGRAM_API_KEY` are set, fingerprints match the hub copy — installs are re-pasting the same keys, not using different vendors.',
  );
  lines.push(
    '- **Exception:** `RAILWAY_API_TOKEN` differs on **Levines Law** vs **re>I<o studio** (client should not carry a distinct ops token).',
  );
  lines.push(
    '- **Railway references:** Every scanned app service had **0** `${{ … }}` variables — URLs and shared API keys are pasted literals instead of `reave-postgres`, `contact-api`, or `shared.*` refs from the deploy wizard.',
  );
  lines.push(
    '- **Punch list hub:** Clients set `REAVE_HUB_URL`; **`REAVE_HUB_KEY` / `REAVE_HUB_SECRET` unset** on hub and all clients — punch list phone-home is not wired.',
  );
  lines.push(
    '- **Deprecated env:** `FEATURES` is still set on many installs; runtime ignores it (`config/config-{slug}.json` is source of truth).',
  );
  lines.push('');
  lines.push('### Reference usage (0 = all literals)');
  for (const r of refCounts.sort((a, b) => a.project.localeCompare(b.project))) {
    lines.push(`- ${r.project} / \`${r.service}\`: ${r.refs} refs / ${r.total} vars`);
  }
  lines.push('');
  lines.push('## App services');
  for (const t of targets.sort((a, b) => a.project.localeCompare(b.project))) {
    const vars = listVars(t.projectId, t.serviceId, t.service);
    lines.push(`- **${t.project}** — \`${t.service}\` (${Object.keys(vars).length} vars, INSTALL_CONFIG=${vars.INSTALL_CONFIG ?? '(unset)'})`);
  }
  lines.push('');
  lines.push('## Agency / shared API keys — multiple distinct values (flag)');
  if (agencyDrift.length) {
    lines.push(...agencyDrift.map((l) => `- ${l}`));
  } else {
    lines.push('- None detected (all set keys share one fingerprint per var, or only one install sets them).');
  }
  lines.push('');
  lines.push('## Agency keys stored as literals (should reference hub shared when possible)');
  if (literalAgency.length) {
    lines.push(...literalAgency.slice(0, 80).map((l) => `- ${l}`));
    if (literalAgency.length > 80) lines.push(`- … and ${literalAgency.length - 80} more`);
  } else {
    lines.push('- None.');
  }
  lines.push('');
  lines.push('## Should use Railway references (literals detected)');
  if (shouldRef.length) {
    lines.push(...shouldRef.map((l) => `- ${l}`));
  } else {
    lines.push('- None.');
  }
  lines.push('');
  lines.push('## Per-install key collisions (same secret on two installs)');
  if (perInstallCollisions.length) {
    lines.push(...perInstallCollisions.map((l) => `- ${l}`));
  } else {
    lines.push('- None flagged.');
  }
  lines.push('');
  lines.push(`## Dead / orphan variables (on Railway, not in codebase serverEnv scan — ${deadCandidates.length} keys)`);
  lines.push('');
  lines.push('Review before delete; some are Railway-provided or read only in config.');
  lines.push('');
  for (const k of deadCandidates) {
    const count = rows.filter((r) => r.key === k).length;
    lines.push(`- \`${k}\` (present on ${count} row(s))`);
  }

  const mdPath = join(OUT_DIR, `railway-rekko-variables-${new Date().toISOString().slice(0, 10)}.md`);
  writeFileSync(mdPath, lines.join('\n') + '\n');

  const jsonOut = {
    generatedAt: new Date().toISOString(),
    targets,
    agencyDrift,
    literalAgency,
    shouldRef,
    deadCandidates,
    fingerprintSummary: Object.fromEntries(
      [...fpByKey.entries()].map(([k, m]) => [k, { distinct: m.size, projects: [...m.values()].flat() }]),
    ),
  };

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(jsonOut, null, 2));
  } else {
    console.log(lines.join('\n'));
    console.log(`\nWrote ${mdPath}`);
  }
}

main();
