---
feature: billing_esign
defaultStatus: request
stage: 2
---

# Estimate Digital Signature (Crater Financial)

Paid add-on on **Crater Financial**. Separate from document-template **Digital Signature**
(`digital_signature` + Dynamic Documents).

## Sibling services

- Requires `billing` (Crater on Railway — `CRATER_API_BASE_URL` + `CRATER_API_TOKEN`)

## Required env vars

- Same as Crater Financial on the Reave app service

## External setup

- Enable `billing` and `billing_esign` in install config `features[]` or Account → Add-ons
- Crater customers must have `contact_uid` (contact-api sync)

## Client flow

- Sign link: `/estimate/:contact_uid/:estimate_unique_hash`
- API: `POST /api/estimate/:uid/sign`
- Crater custom routes: `accept-signed`, `by-hash`, `mail-payload`

## Checklist

- [ ] Confirm Crater Financial is enabled and deployed
- [ ] Enable `billing_esign` (Add-ons or install config)
- [ ] Open a test estimate sign URL for a linked contact
- [ ] Confirm ACCEPTED in Crater + signed copy on contact portal
- [ ] Set `moduleStatus.billing_esign` → `deployed` when live
