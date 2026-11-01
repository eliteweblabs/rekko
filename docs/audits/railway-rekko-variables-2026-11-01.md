# Railway rekko app variable audit

Generated: 2026-11-01T16:01:06.263Z
Repo filter: eliteweblabs/rekko (services with `reave` or INSTALL_CONFIG)
Installs scanned: 13

## Executive summary

- **Scope:** App services named `reave` (or `pups` on PDX Paws) with `INSTALL_CONFIG`, plus edge cases (e.g. Levines Law `levineslaw`, upsidedownbottle).
- **Agency API keys:** `OPENROUTER_API_KEY`, `PEXELS_API_KEY`, and `IDEOGRAM_API_KEY` use the **same** key material everywhere they are set (duplicated literals of your hub keys — not different vendor accounts). **Exception:** `RAILWAY_API_TOKEN` on **Levines Law** ≠ hub.
- **Railway `${{ … }}` references:** **0** on Lux Cleaning, Stratus Hub, PDX Paws, My Digger, and hub — everything is pasted literals (including `DATABASE_URL` and sibling service URLs).
- **Punch list:** Clients have `REAVE_HUB_URL`; **`REAVE_HUB_KEY` / `REAVE_HUB_SECRET` unset** on hub and all clients.
- **Deprecated:** `FEATURES` still set on many services; app ignores it — use `config/config-{slug}.json`.
- **Remediation:** See [railway-rekko-variables-remediation.md](./railway-rekko-variables-remediation.md).

### Key coverage (OpenRouter / Pexels / Ideogram)

| Install | OPENROUTER | PEXELS | IDEOGRAM |
|---------|------------|--------|----------|
| re>I<o studio (hub) | ✓ | ✓ | ✓ |
| Lux Cleaning | ✓ | — | — |
| Stratus Hub | ✓ | ✓ | ✓ |
| REΛVE - JK | ✓ | ✓ | — |
| Levines Law | ✓ | ✓ | — |
| pdx-paws (pups) | ✓ | ✓ | — |
| Dr Paws, Life Saving, etc. | — | ✓* | — |
| Christian Gonzalez, My Digger, Pat the Plumber | — | — | — |

\*Pexels where website/content modules need it; several use `ANTHROPIC_API_KEY` only without OpenRouter.

## App services
- **Christian Gonzalez** — `reave` (35 vars, INSTALL_CONFIG=christian-gonzalez)
- **Dr Paws Calls** — `reave` (95 vars, INSTALL_CONFIG=drpawscalls)
- **Levines Law** — `levineslaw` (36 vars, INSTALL_CONFIG=(unset))
- **Levines Law** — `reave` (74 vars, INSTALL_CONFIG=levineslaw)
- **Life Saving Fire Protection** — `reave` (86 vars, INSTALL_CONFIG=life-saving)
- **Lux Cleaning** — `reave` (65 vars, INSTALL_CONFIG=luxe-cleaning)
- **My Digger** — `reave` (50 vars, INSTALL_CONFIG=my-digger)
- **Pat the Plumber** — `reave` (40 vars, INSTALL_CONFIG=pattheplumber)
- **pdx-paws** — `pups` (95 vars, INSTALL_CONFIG=pdx-paws)
- **re>I<o studio** — `reave` (108 vars, INSTALL_CONFIG=reave)
- **REΛVE - JK** — `reave` (75 vars, INSTALL_CONFIG=jk)
- **Stratus Hub** — `reave` (80 vars, INSTALL_CONFIG=stratus-hub)
- **upsidedownbottle.com** — `upsidedownbottle-site` (22 vars, INSTALL_CONFIG=darwinbottles)

## Agency / shared API keys — multiple distinct values (flag)
- RAILWAY_API_TOKEN: 2 distinct values across installs
    fp:24956ef042fc → re>I<o studio (reave)
    fp:9a38568789a3 → Levines Law (reave)

## Agency keys stored as literals (should reference hub shared when possible)
- pdx-paws/pups: OPENROUTER_API_KEY is a literal (consider hub shared var or ${{ shared.OPENROUTER_API_KEY }})
- pdx-paws/pups: ANTHROPIC_API_KEY is a literal (consider hub shared var or ${{ shared.ANTHROPIC_API_KEY }})
- pdx-paws/pups: PEXELS_API_KEY is a literal (consider hub shared var or ${{ shared.PEXELS_API_KEY }})
- pdx-paws/pups: GOOGLE_PAGESPEED_API_KEY is a literal (consider hub shared var or ${{ shared.GOOGLE_PAGESPEED_API_KEY }})
- pdx-paws/pups: GOOGLE_MAPS_API_KEY is a literal (consider hub shared var or ${{ shared.GOOGLE_MAPS_API_KEY }})
- pdx-paws/pups: PUBLIC_MAPBOX_ACCESS_TOKEN is a literal (consider hub shared var or ${{ shared.PUBLIC_MAPBOX_ACCESS_TOKEN }})
- pdx-paws/pups: ATTOM_API_KEY is a literal (consider hub shared var or ${{ shared.ATTOM_API_KEY }})
- pdx-paws/pups: PLAUSIBLE_API_KEY is a literal (consider hub shared var or ${{ shared.PLAUSIBLE_API_KEY }})
- re>I<o studio/reave: OPENROUTER_API_KEY is a literal (consider hub shared var or ${{ shared.OPENROUTER_API_KEY }})
- re>I<o studio/reave: ANTHROPIC_API_KEY is a literal (consider hub shared var or ${{ shared.ANTHROPIC_API_KEY }})
- re>I<o studio/reave: OMNIROUTE_API_KEY is a literal (consider hub shared var or ${{ shared.OMNIROUTE_API_KEY }})
- re>I<o studio/reave: PEXELS_API_KEY is a literal (consider hub shared var or ${{ shared.PEXELS_API_KEY }})
- re>I<o studio/reave: IDEOGRAM_API_KEY is a literal (consider hub shared var or ${{ shared.IDEOGRAM_API_KEY }})
- re>I<o studio/reave: BRAVE_API_KEY is a literal (consider hub shared var or ${{ shared.BRAVE_API_KEY }})
- re>I<o studio/reave: GOOGLE_PAGESPEED_API_KEY is a literal (consider hub shared var or ${{ shared.GOOGLE_PAGESPEED_API_KEY }})
- re>I<o studio/reave: GOOGLE_MAPS_API_KEY is a literal (consider hub shared var or ${{ shared.GOOGLE_MAPS_API_KEY }})
- re>I<o studio/reave: PUBLIC_MAPBOX_ACCESS_TOKEN is a literal (consider hub shared var or ${{ shared.PUBLIC_MAPBOX_ACCESS_TOKEN }})
- re>I<o studio/reave: RAILWAY_API_TOKEN is a literal (consider hub shared var or ${{ shared.RAILWAY_API_TOKEN }})
- re>I<o studio/reave: GITHUB_TOKEN is a literal (consider hub shared var or ${{ shared.GITHUB_TOKEN }})
- re>I<o studio/reave: KINSTA_API_KEY is a literal (consider hub shared var or ${{ shared.KINSTA_API_KEY }})
- re>I<o studio/reave: KINSTA_COMPANY_ID is a literal (consider hub shared var or ${{ shared.KINSTA_COMPANY_ID }})
- re>I<o studio/reave: CLOUDFLARE_API_TOKEN is a literal (consider hub shared var or ${{ shared.CLOUDFLARE_API_TOKEN }})
- re>I<o studio/reave: NAMECOM_USERNAME is a literal (consider hub shared var or ${{ shared.NAMECOM_USERNAME }})
- re>I<o studio/reave: NAMECOM_TOKEN is a literal (consider hub shared var or ${{ shared.NAMECOM_TOKEN }})
- re>I<o studio/reave: ATTOM_API_KEY is a literal (consider hub shared var or ${{ shared.ATTOM_API_KEY }})
- re>I<o studio/reave: PLAUSIBLE_API_KEY is a literal (consider hub shared var or ${{ shared.PLAUSIBLE_API_KEY }})
- Lux Cleaning/reave: OPENROUTER_API_KEY is a literal (consider hub shared var or ${{ shared.OPENROUTER_API_KEY }})
- Lux Cleaning/reave: ANTHROPIC_API_KEY is a literal (consider hub shared var or ${{ shared.ANTHROPIC_API_KEY }})
- Lux Cleaning/reave: PLAUSIBLE_API_KEY is a literal (consider hub shared var or ${{ shared.PLAUSIBLE_API_KEY }})
- Stratus Hub/reave: OPENROUTER_API_KEY is a literal (consider hub shared var or ${{ shared.OPENROUTER_API_KEY }})
- Stratus Hub/reave: ANTHROPIC_API_KEY is a literal (consider hub shared var or ${{ shared.ANTHROPIC_API_KEY }})
- Stratus Hub/reave: PEXELS_API_KEY is a literal (consider hub shared var or ${{ shared.PEXELS_API_KEY }})
- Stratus Hub/reave: IDEOGRAM_API_KEY is a literal (consider hub shared var or ${{ shared.IDEOGRAM_API_KEY }})
- Stratus Hub/reave: GOOGLE_PAGESPEED_API_KEY is a literal (consider hub shared var or ${{ shared.GOOGLE_PAGESPEED_API_KEY }})
- Stratus Hub/reave: GOOGLE_MAPS_API_KEY is a literal (consider hub shared var or ${{ shared.GOOGLE_MAPS_API_KEY }})
- Stratus Hub/reave: PUBLIC_MAPBOX_ACCESS_TOKEN is a literal (consider hub shared var or ${{ shared.PUBLIC_MAPBOX_ACCESS_TOKEN }})
- Stratus Hub/reave: ATTOM_API_KEY is a literal (consider hub shared var or ${{ shared.ATTOM_API_KEY }})
- Stratus Hub/reave: PLAUSIBLE_API_KEY is a literal (consider hub shared var or ${{ shared.PLAUSIBLE_API_KEY }})
- Dr Paws Calls/reave: ANTHROPIC_API_KEY is a literal (consider hub shared var or ${{ shared.ANTHROPIC_API_KEY }})
- Dr Paws Calls/reave: PEXELS_API_KEY is a literal (consider hub shared var or ${{ shared.PEXELS_API_KEY }})
- Dr Paws Calls/reave: GOOGLE_PAGESPEED_API_KEY is a literal (consider hub shared var or ${{ shared.GOOGLE_PAGESPEED_API_KEY }})
- Dr Paws Calls/reave: GOOGLE_MAPS_API_KEY is a literal (consider hub shared var or ${{ shared.GOOGLE_MAPS_API_KEY }})
- Dr Paws Calls/reave: PUBLIC_MAPBOX_ACCESS_TOKEN is a literal (consider hub shared var or ${{ shared.PUBLIC_MAPBOX_ACCESS_TOKEN }})
- Dr Paws Calls/reave: ATTOM_API_KEY is a literal (consider hub shared var or ${{ shared.ATTOM_API_KEY }})
- Dr Paws Calls/reave: PLAUSIBLE_API_KEY is a literal (consider hub shared var or ${{ shared.PLAUSIBLE_API_KEY }})
- Life Saving Fire Protection/reave: ANTHROPIC_API_KEY is a literal (consider hub shared var or ${{ shared.ANTHROPIC_API_KEY }})
- Life Saving Fire Protection/reave: PEXELS_API_KEY is a literal (consider hub shared var or ${{ shared.PEXELS_API_KEY }})
- Life Saving Fire Protection/reave: GOOGLE_PAGESPEED_API_KEY is a literal (consider hub shared var or ${{ shared.GOOGLE_PAGESPEED_API_KEY }})
- Life Saving Fire Protection/reave: GOOGLE_MAPS_API_KEY is a literal (consider hub shared var or ${{ shared.GOOGLE_MAPS_API_KEY }})
- Life Saving Fire Protection/reave: PUBLIC_MAPBOX_ACCESS_TOKEN is a literal (consider hub shared var or ${{ shared.PUBLIC_MAPBOX_ACCESS_TOKEN }})
- Life Saving Fire Protection/reave: KINSTA_API_KEY is a literal (consider hub shared var or ${{ shared.KINSTA_API_KEY }})
- Life Saving Fire Protection/reave: KINSTA_COMPANY_ID is a literal (consider hub shared var or ${{ shared.KINSTA_COMPANY_ID }})
- Life Saving Fire Protection/reave: ATTOM_API_KEY is a literal (consider hub shared var or ${{ shared.ATTOM_API_KEY }})
- Life Saving Fire Protection/reave: PLAUSIBLE_API_KEY is a literal (consider hub shared var or ${{ shared.PLAUSIBLE_API_KEY }})
- Pat the Plumber/reave: ANTHROPIC_API_KEY is a literal (consider hub shared var or ${{ shared.ANTHROPIC_API_KEY }})
- Pat the Plumber/reave: PUBLIC_MAPBOX_ACCESS_TOKEN is a literal (consider hub shared var or ${{ shared.PUBLIC_MAPBOX_ACCESS_TOKEN }})
- Pat the Plumber/reave: PLAUSIBLE_API_KEY is a literal (consider hub shared var or ${{ shared.PLAUSIBLE_API_KEY }})
- REΛVE - JK/reave: OPENROUTER_API_KEY is a literal (consider hub shared var or ${{ shared.OPENROUTER_API_KEY }})
- REΛVE - JK/reave: ANTHROPIC_API_KEY is a literal (consider hub shared var or ${{ shared.ANTHROPIC_API_KEY }})
- REΛVE - JK/reave: PEXELS_API_KEY is a literal (consider hub shared var or ${{ shared.PEXELS_API_KEY }})
- REΛVE - JK/reave: BRAVE_API_KEY is a literal (consider hub shared var or ${{ shared.BRAVE_API_KEY }})
- REΛVE - JK/reave: GOOGLE_PAGESPEED_API_KEY is a literal (consider hub shared var or ${{ shared.GOOGLE_PAGESPEED_API_KEY }})
- REΛVE - JK/reave: GOOGLE_MAPS_API_KEY is a literal (consider hub shared var or ${{ shared.GOOGLE_MAPS_API_KEY }})
- REΛVE - JK/reave: PUBLIC_MAPBOX_ACCESS_TOKEN is a literal (consider hub shared var or ${{ shared.PUBLIC_MAPBOX_ACCESS_TOKEN }})
- REΛVE - JK/reave: GITHUB_TOKEN is a literal (consider hub shared var or ${{ shared.GITHUB_TOKEN }})
- REΛVE - JK/reave: ATTOM_API_KEY is a literal (consider hub shared var or ${{ shared.ATTOM_API_KEY }})
- REΛVE - JK/reave: PLAUSIBLE_API_KEY is a literal (consider hub shared var or ${{ shared.PLAUSIBLE_API_KEY }})
- Levines Law/reave: OPENROUTER_API_KEY is a literal (consider hub shared var or ${{ shared.OPENROUTER_API_KEY }})
- Levines Law/reave: ANTHROPIC_API_KEY is a literal (consider hub shared var or ${{ shared.ANTHROPIC_API_KEY }})
- Levines Law/reave: PEXELS_API_KEY is a literal (consider hub shared var or ${{ shared.PEXELS_API_KEY }})
- Levines Law/reave: BRAVE_API_KEY is a literal (consider hub shared var or ${{ shared.BRAVE_API_KEY }})
- Levines Law/reave: GOOGLE_PAGESPEED_API_KEY is a literal (consider hub shared var or ${{ shared.GOOGLE_PAGESPEED_API_KEY }})
- Levines Law/reave: GOOGLE_MAPS_API_KEY is a literal (consider hub shared var or ${{ shared.GOOGLE_MAPS_API_KEY }})
- Levines Law/reave: PUBLIC_MAPBOX_ACCESS_TOKEN is a literal (consider hub shared var or ${{ shared.PUBLIC_MAPBOX_ACCESS_TOKEN }})
- Levines Law/reave: MAPBOX_ACCESS_TOKEN is a literal (consider hub shared var or ${{ shared.MAPBOX_ACCESS_TOKEN }})
- Levines Law/reave: RAILWAY_API_TOKEN is a literal (consider hub shared var or ${{ shared.RAILWAY_API_TOKEN }})
- Levines Law/reave: CLOUDFLARE_API_TOKEN is a literal (consider hub shared var or ${{ shared.CLOUDFLARE_API_TOKEN }})
- Levines Law/reave: ATTOM_API_KEY is a literal (consider hub shared var or ${{ shared.ATTOM_API_KEY }})
- Levines Law/reave: PLAUSIBLE_API_KEY is a literal (consider hub shared var or ${{ shared.PLAUSIBLE_API_KEY }})

## Should use Railway references (literals detected)
- My Digger/reave: BOOKING_API_URL is literal — prefer https://${{ calcom-booking-api.RAILWAY_PUBLIC_DOMAIN }}
- My Digger/reave: CONTACT_API_BASE_URL is literal — prefer https://${{ contact-api.RAILWAY_PUBLIC_DOMAIN }}
- My Digger/reave: CRATER_API_BASE_URL is literal — prefer https://${{ crater.RAILWAY_PUBLIC_DOMAIN }}
- My Digger/reave: DATABASE_URL is literal — prefer ${{ reave-postgres.DATABASE_URL }}
- My Digger/reave: PUBLIC_BOOKING_API_URL is literal — prefer https://${{ calcom-web-app.RAILWAY_PUBLIC_DOMAIN }}
- pdx-paws/pups: BOOKING_API_URL is literal — prefer https://${{ calcom-booking-api.RAILWAY_PUBLIC_DOMAIN }}
- pdx-paws/pups: CONTACT_API_BASE_URL is literal — prefer https://${{ contact-api.RAILWAY_PUBLIC_DOMAIN }}
- pdx-paws/pups: CONTACT_API_KEY is literal — prefer ${{ shared.CONTACT_API_CLIENT_KEY }}
- pdx-paws/pups: CRATER_API_BASE_URL is literal — prefer https://${{ crater.RAILWAY_PUBLIC_DOMAIN }}
- pdx-paws/pups: CRATER_API_TOKEN is literal — prefer ${{ shared.CRATER_API_TOKEN }}
- pdx-paws/pups: DATABASE_URL is literal — prefer ${{ reave-postgres.DATABASE_URL }}
- pdx-paws/pups: PUBLIC_BOOKING_API_URL is literal — prefer https://${{ calcom-web-app.RAILWAY_PUBLIC_DOMAIN }}
- re>I<o studio/reave: BOOKING_API_URL is literal — prefer https://${{ calcom-booking-api.RAILWAY_PUBLIC_DOMAIN }}
- re>I<o studio/reave: CONTACT_API_BASE_URL is literal — prefer https://${{ contact-api.RAILWAY_PUBLIC_DOMAIN }}
- re>I<o studio/reave: CONTACT_API_KEY is literal — prefer ${{ shared.CONTACT_API_CLIENT_KEY }}
- re>I<o studio/reave: CRATER_API_BASE_URL is literal — prefer https://${{ crater.RAILWAY_PUBLIC_DOMAIN }}
- re>I<o studio/reave: CRATER_API_TOKEN is literal — prefer ${{ shared.CRATER_API_TOKEN }}
- re>I<o studio/reave: DATABASE_URL is literal — prefer ${{ reave-postgres.DATABASE_URL }}
- re>I<o studio/reave: FLEET_API_BASE_URL is literal — prefer https://${{ fleet-api.RAILWAY_PUBLIC_DOMAIN }}
- re>I<o studio/reave: FLEET_API_KEY is literal — prefer ${{ shared.FLEET_API_CLIENT_KEY }}
- re>I<o studio/reave: PUBLIC_BOOKING_API_URL is literal — prefer https://${{ calcom-web-app.RAILWAY_PUBLIC_DOMAIN }}
- Christian Gonzalez/reave: BOOKING_API_URL is literal — prefer https://${{ calcom-booking-api.RAILWAY_PUBLIC_DOMAIN }}
- Christian Gonzalez/reave: CONTACT_API_BASE_URL is literal — prefer https://${{ contact-api.RAILWAY_PUBLIC_DOMAIN }}
- Christian Gonzalez/reave: CONTACT_API_KEY is literal — prefer ${{ shared.CONTACT_API_CLIENT_KEY }}
- Christian Gonzalez/reave: CRATER_API_BASE_URL is literal — prefer https://${{ crater.RAILWAY_PUBLIC_DOMAIN }}
- Christian Gonzalez/reave: CRATER_API_TOKEN is literal — prefer ${{ shared.CRATER_API_TOKEN }}
- Christian Gonzalez/reave: DATABASE_URL is literal — prefer ${{ reave-postgres.DATABASE_URL }}
- Christian Gonzalez/reave: PUBLIC_BOOKING_API_URL is literal — prefer https://${{ calcom-web-app.RAILWAY_PUBLIC_DOMAIN }}
- Lux Cleaning/reave: BOOKING_API_URL is literal — prefer https://${{ calcom-booking-api.RAILWAY_PUBLIC_DOMAIN }}
- Lux Cleaning/reave: CONTACT_API_BASE_URL is literal — prefer https://${{ contact-api.RAILWAY_PUBLIC_DOMAIN }}
- Lux Cleaning/reave: CONTACT_API_KEY is literal — prefer ${{ shared.CONTACT_API_CLIENT_KEY }}
- Lux Cleaning/reave: CRATER_API_BASE_URL is literal — prefer https://${{ crater.RAILWAY_PUBLIC_DOMAIN }}
- Lux Cleaning/reave: CRATER_API_TOKEN is literal — prefer ${{ shared.CRATER_API_TOKEN }}
- Lux Cleaning/reave: DATABASE_URL is literal — prefer ${{ reave-postgres.DATABASE_URL }}
- Lux Cleaning/reave: PUBLIC_BOOKING_API_URL is literal — prefer https://${{ calcom-web-app.RAILWAY_PUBLIC_DOMAIN }}
- Stratus Hub/reave: BOOKING_API_URL is literal — prefer https://${{ calcom-booking-api.RAILWAY_PUBLIC_DOMAIN }}
- Stratus Hub/reave: CONTACT_API_BASE_URL is literal — prefer https://${{ contact-api.RAILWAY_PUBLIC_DOMAIN }}
- Stratus Hub/reave: CONTACT_API_KEY is literal — prefer ${{ shared.CONTACT_API_CLIENT_KEY }}
- Stratus Hub/reave: CRATER_API_BASE_URL is literal — prefer https://${{ crater.RAILWAY_PUBLIC_DOMAIN }}
- Stratus Hub/reave: CRATER_API_TOKEN is literal — prefer ${{ shared.CRATER_API_TOKEN }}
- Stratus Hub/reave: DATABASE_URL is literal — prefer ${{ reave-postgres.DATABASE_URL }}
- Stratus Hub/reave: PUBLIC_BOOKING_API_URL is literal — prefer https://${{ calcom-web-app.RAILWAY_PUBLIC_DOMAIN }}
- Dr Paws Calls/reave: BOOKING_API_URL is literal — prefer https://${{ calcom-booking-api.RAILWAY_PUBLIC_DOMAIN }}
- Dr Paws Calls/reave: CONTACT_API_BASE_URL is literal — prefer https://${{ contact-api.RAILWAY_PUBLIC_DOMAIN }}
- Dr Paws Calls/reave: CONTACT_API_KEY is literal — prefer ${{ shared.CONTACT_API_CLIENT_KEY }}
- Dr Paws Calls/reave: CRATER_API_BASE_URL is literal — prefer https://${{ crater.RAILWAY_PUBLIC_DOMAIN }}
- Dr Paws Calls/reave: CRATER_API_TOKEN is literal — prefer ${{ shared.CRATER_API_TOKEN }}
- Dr Paws Calls/reave: DATABASE_URL is literal — prefer ${{ reave-postgres.DATABASE_URL }}
- Dr Paws Calls/reave: FLEET_API_BASE_URL is literal — prefer https://${{ fleet-api.RAILWAY_PUBLIC_DOMAIN }}
- Dr Paws Calls/reave: FLEET_API_KEY is literal — prefer ${{ shared.FLEET_API_CLIENT_KEY }}
- Dr Paws Calls/reave: PUBLIC_BOOKING_API_URL is literal — prefer https://${{ calcom-web-app.RAILWAY_PUBLIC_DOMAIN }}
- Life Saving Fire Protection/reave: BOOKING_API_URL is literal — prefer https://${{ calcom-booking-api.RAILWAY_PUBLIC_DOMAIN }}
- Life Saving Fire Protection/reave: CONTACT_API_BASE_URL is literal — prefer https://${{ contact-api.RAILWAY_PUBLIC_DOMAIN }}
- Life Saving Fire Protection/reave: CONTACT_API_KEY is literal — prefer ${{ shared.CONTACT_API_CLIENT_KEY }}
- Life Saving Fire Protection/reave: CRATER_API_BASE_URL is literal — prefer https://${{ crater.RAILWAY_PUBLIC_DOMAIN }}
- Life Saving Fire Protection/reave: CRATER_API_TOKEN is literal — prefer ${{ shared.CRATER_API_TOKEN }}
- Life Saving Fire Protection/reave: DATABASE_URL is literal — prefer ${{ reave-postgres.DATABASE_URL }}
- Life Saving Fire Protection/reave: PUBLIC_BOOKING_API_URL is literal — prefer https://${{ calcom-web-app.RAILWAY_PUBLIC_DOMAIN }}
- Pat the Plumber/reave: DATABASE_URL is literal — prefer ${{ reave-postgres.DATABASE_URL }}
- REΛVE - JK/reave: BOOKING_API_URL is literal — prefer https://${{ calcom-booking-api.RAILWAY_PUBLIC_DOMAIN }}
- REΛVE - JK/reave: CONTACT_API_BASE_URL is literal — prefer https://${{ contact-api.RAILWAY_PUBLIC_DOMAIN }}
- REΛVE - JK/reave: CONTACT_API_KEY is literal — prefer ${{ shared.CONTACT_API_CLIENT_KEY }}
- REΛVE - JK/reave: CRATER_API_BASE_URL is literal — prefer https://${{ crater.RAILWAY_PUBLIC_DOMAIN }}
- REΛVE - JK/reave: CRATER_API_TOKEN is literal — prefer ${{ shared.CRATER_API_TOKEN }}
- REΛVE - JK/reave: DATABASE_URL is literal — prefer ${{ reave-postgres.DATABASE_URL }}
- REΛVE - JK/reave: PUBLIC_BOOKING_API_URL is literal — prefer https://${{ calcom-web-app.RAILWAY_PUBLIC_DOMAIN }}
- Levines Law/levineslaw: CONTACT_API_BASE_URL is literal — prefer https://${{ contact-api.RAILWAY_PUBLIC_DOMAIN }}
- Levines Law/levineslaw: CRATER_API_BASE_URL is literal — prefer https://${{ crater.RAILWAY_PUBLIC_DOMAIN }}
- Levines Law/levineslaw: DATABASE_URL is literal — prefer ${{ reave-postgres.DATABASE_URL }}
- Levines Law/reave: BOOKING_API_URL is literal — prefer https://${{ calcom-booking-api.RAILWAY_PUBLIC_DOMAIN }}
- Levines Law/reave: CONTACT_API_BASE_URL is literal — prefer https://${{ contact-api.RAILWAY_PUBLIC_DOMAIN }}
- Levines Law/reave: CONTACT_API_KEY is literal — prefer ${{ shared.CONTACT_API_CLIENT_KEY }}
- Levines Law/reave: CRATER_API_BASE_URL is literal — prefer https://${{ crater.RAILWAY_PUBLIC_DOMAIN }}
- Levines Law/reave: CRATER_API_TOKEN is literal — prefer ${{ shared.CRATER_API_TOKEN }}
- Levines Law/reave: DATABASE_URL is literal — prefer ${{ reave-postgres.DATABASE_URL }}
- Levines Law/reave: PUBLIC_BOOKING_API_URL is literal — prefer https://${{ calcom-web-app.RAILWAY_PUBLIC_DOMAIN }}

## Per-install key collisions (same secret on two installs)
- CLERK_SECRET_KEY: same fingerprint on multiple installs (unexpected)
- PUBLIC_CLERK_PUBLISHABLE_KEY: same fingerprint on multiple installs (unexpected)
- DATABASE_URL: same fingerprint on multiple installs (unexpected)
- TELNYX_FROM_NUMBER: same fingerprint on multiple installs (unexpected)

## Dead / orphan variables (on Railway, not in codebase serverEnv scan — 47 keys)

Review before delete; some are Railway-provided or read only in config.

- `ACCESS_KEY_ID` (present on 1 row(s))
- `ATTOM_API_KEY` (present on 7 row(s))
- `BUCKET` (present on 1 row(s))
- `CALCOM_EVENT_TYPE_ID` (present on 1 row(s))
- `CLERK_SECRET_KEY` (present on 11 row(s))
- `COMPANY_LOGO_URL` (present on 7 row(s))
- `CONTACT_FROM` (present on 1 row(s))
- `CONTACT_TO` (present on 1 row(s))
- `EMAIL_NOTIFY_CHAT_ID` (present on 1 row(s))
- `ENDPOINT` (present on 1 row(s))
- `GOOGLE_REFRESH_TOKEN` (present on 1 row(s))
- `HOST` (present on 1 row(s))
- `INSTAGRAM_APP_ID` (present on 5 row(s))
- `INSTALL_BOOTSTRAP` (present on 2 row(s))
- `INSTALL_LOGO_DATA` (present on 1 row(s))
- `INSTALL_LOGO_MEDIA_TYPE` (present on 1 row(s))
- `PORT` (present on 1 row(s))
- `PUBLIC_CLERK_ALLOW_SIGN_UP` (present on 11 row(s))
- `PUBLIC_CLERK_JS_URL` (present on 2 row(s))
- `PUBLIC_CLERK_PUBLISHABLE_KEY` (present on 11 row(s))
- `PUBLIC_CLERK_UI_URL` (present on 1 row(s))
- `PUBLIC_CMSPEAK_URL` (present on 1 row(s))
- `RAILWAY_ENVIRONMENT_ID` (present on 13 row(s))
- `RAILWAY_PRIVATE_DOMAIN` (present on 13 row(s))
- `RAILWAY_PROJECT_NAME` (present on 13 row(s))
- `RAILWAY_SERVICE_CALCOM_BOOKING_API_URL` (present on 11 row(s))
- `RAILWAY_SERVICE_CALCOM_WEB_APP_URL` (present on 12 row(s))
- `RAILWAY_SERVICE_CHRISTIAN_GONZALEZ_SITE_URL` (present on 1 row(s))
- `RAILWAY_SERVICE_CONTACT_API_URL` (present on 11 row(s))
- `RAILWAY_SERVICE_CRATER_URL` (present on 11 row(s))
- `RAILWAY_SERVICE_FLEET_API_URL` (present on 1 row(s))
- `RAILWAY_SERVICE_LEVINESLAW_URL` (present on 2 row(s))
- `RAILWAY_SERVICE_PUPS_URL` (present on 1 row(s))
- `RAILWAY_SERVICE_REAVE_URL` (present on 11 row(s))
- `RAILWAY_SERVICE_UPSIDEDOWNBOTTLE_SITE_URL` (present on 1 row(s))
- `RAILWAY_STATIC_URL` (present on 13 row(s))
- `REAL_ESTATE_DATA_PROVIDER` (present on 4 row(s))
- `REAVE_WP_API_KEY` (present on 2 row(s))
- `REGION` (present on 1 row(s))
- `RESEND_INBOUND_WEBHOOK_URL` (present on 1 row(s))
- `SECRET_ACCESS_KEY` (present on 1 row(s))
- `SEED_INBOX` (present on 2 row(s))
- `SEED_SCHEDULE` (present on 2 row(s))
- `SEED_TODOS` (present on 2 row(s))
- `TELNYX_OPERATOR_NUMBER` (present on 2 row(s))
- `VAPI_PHONE_NUMBER` (present on 1 row(s))
- `VAPI_SYNC_SKIP` (present on 1 row(s))
