# Railway rekko variables — remediation plan

Follow-up to `railway-rekko-variables-2026-11-01.md`. Re-run audit:

```bash
npx tsx scripts/audit-railway-rekko-variables.ts
```

## Phase 1 — Per-project shared agency keys (no cross-project magic)

Railway **shared variables** live inside one project. For each client project (Lux Cleaning, Stratus Hub, …):

1. Project → **Shared Variables** → create once:
   - `OPENROUTER_API_KEY`, `PEXELS_API_KEY`, `IDEOGRAM_API_KEY`, `BRAVE_API_KEY`, `GOOGLE_PAGESPEED_API_KEY`, `GOOGLE_MAPS_API_KEY`, `PUBLIC_MAPBOX_ACCESS_TOKEN`, `PLAUSIBLE_API_KEY`, `ATTOM_API_KEY` (if used)
   - Copy values from **re>I<o studio → reave** (canonical agency keys).

2. On **`reave`** (or `pups`) service, replace literals with references, e.g.:
   - `OPENROUTER_API_KEY=${{ shared.OPENROUTER_API_KEY }}`
   - `PEXELS_API_KEY=${{ shared.PEXELS_API_KEY }}`
   - `IDEOGRAM_API_KEY=${{ shared.IDEOGRAM_API_KEY }}`

3. **Do not** copy `RAILWAY_API_TOKEN`, `GITHUB_TOKEN`, or `CLOUDFLARE_API_TOKEN` to client projects unless that install truly runs deploy/dev_infra. Remove Levines Law’s distinct `RAILWAY_API_TOKEN` if the install is not an ops host.

## Phase 2 — Service references (deploy wizard shape)

On each **`reave`** service, prefer:

| Variable | Reference |
|----------|-----------|
| `DATABASE_URL` | `${{ reave-postgres.DATABASE_URL }}` |
| `CONTACT_API_BASE_URL` | `https://${{ contact-api.RAILWAY_PUBLIC_DOMAIN }}` |
| `CONTACT_API_KEY` | `${{ shared.CONTACT_API_CLIENT_KEY }}` |
| `CRATER_API_BASE_URL` | `https://${{ crater.RAILWAY_PUBLIC_DOMAIN }}` |
| `CRATER_API_TOKEN` | `${{ shared.CRATER_API_TOKEN }}` |
| `BOOKING_API_URL` | `https://${{ calcom-booking-api.RAILWAY_PUBLIC_DOMAIN }}` |
| `PUBLIC_BOOKING_API_URL` | `https://${{ calcom-web-app.RAILWAY_PUBLIC_DOMAIN }}` |

Create matching **shared** keys (`CONTACT_API_CLIENT_KEY`, `CRATER_API_TOKEN`, `BOOKING_API_KEY`) in the project if missing — wizard seeds these on apply.

## Phase 3 — Punch list hub

**Hub** (`re>I<o studio`, `INSTALL_CONFIG=reave`):

- Set `REAVE_HUB_SECRET` (or `REAVE_HUB_KEY`) to a long random value.

**Each client** with punch list:

- `REAVE_HUB_URL=https://rekko.studio`
- `REAVE_HUB_KEY=${{ shared.REAVE_HUB_KEY }}` with the same secret in project shared vars (or paste once per project).

## Phase 4 — Safe deletes (after spot-check)

| Variable | Action |
|----------|--------|
| `FEATURES` | Remove — deprecated; use `config/config-*.json`. |
| `SEED_INBOX`, `SEED_SCHEDULE`, `SEED_TODOS`, `INSTALL_BOOTSTRAP` | Remove after bootstrap completed. |
| `Levines Law` → `levineslaw` service | Review duplicate stack; likely stale if `reave` is canonical. |

**Keep** (not dead): `RAILWAY_*`, `PUBLIC_CLERK_*`, `PORT` — platform or Clerk runtime.

## Phase 5 — Hub canonical store

Keep **one** literal copy of agency keys on **re>I<o studio / reave**. All other projects should reference **their own** project shared vars filled from hub during deploy wizard apply — not literal re-paste on every key change.
