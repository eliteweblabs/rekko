/**
 * Admin → Company settings — read/update text fields and apply media library assets to logo/icon/OG.
 */

import { getAgentContext } from '../../agentContext';
import {
  getCompanyBrandContext,
  getCompanyConfig,
  normalizeCompanyInput,
  resolveCompanyAddressGeo,
  type CompanyConfigInput,
} from '../../companyConfig';
import {
  applyCompanyBrandingFromMediaLibrary,
  clearCompanyBrandingSlot,
  companySettingsForAgent,
  type CompanyBrandingSlot,
} from '../../companyBrandingFromMedia';
import { getStoredCompanyConfig, setStoredCompanyConfig } from '../../companyConfigStore';
import { isDeploymentOwnerId } from '../../deploymentOwner';
import { invalidateOfficeCoordsCache } from '../../mapbox';
import { mergeFontGoogleSpecs } from '../../googleFontsCatalog';
import type { AgentToolDef, AgentToolModule, ToolContext } from '../types';

function parseSlot(raw: unknown): CompanyBrandingSlot {
  const s = String(raw ?? 'logo').trim().toLowerCase();
  if (s === 'icon' || s === 'og') return s;
  return 'logo';
}

async function handle_get_company_settings(_args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const company = await getCompanyConfig();
  return JSON.stringify({
    ok: true,
    settings: companySettingsForAgent(company, ctx.brand.siteUrl),
  });
}

async function handle_update_company_settings(
  args: Record<string, unknown>,
  _ctx: ToolContext,
): Promise<string> {
  const userId = getAgentContext().userId;
  if (!userId || !isDeploymentOwnerId(userId)) {
    return JSON.stringify({
      error: 'Only the deployment owner can update company settings (same as Admin → Company save).',
    });
  }

  const input: CompanyConfigInput = {};
  const stringFields = [
    'name',
    'legalName',
    'description',
    'supportEmail',
    'supportPhone',
    'fromEmail',
    'address',
    'vapiAssistantId',
    'vapiFirstMessage',
    'vapiSystemPrompt',
    'portalOutreachNotice',
    'fontPrimary',
    'fontSecondary',
    'fontContent',
    'emailFont',
    'brandPrimary',
    'brandSecondary',
    'iconBackground',
    'logoSvg',
    'iconSvg',
    'headerLogoSize',
  ] as const;
  const argAliases: Record<string, keyof CompanyConfigInput> = {
    legal_name: 'legalName',
    support_email: 'supportEmail',
    support_phone: 'supportPhone',
    from_email: 'fromEmail',
    brand_primary: 'brandPrimary',
    brand_secondary: 'brandSecondary',
    icon_background: 'iconBackground',
    header_logo_size: 'headerLogoSize',
    logo_svg: 'logoSvg',
    icon_svg: 'iconSvg',
  };
  for (const key of stringFields) {
    if (args[key] !== undefined) input[key] = String(args[key] ?? '');
  }
  for (const [alias, target] of Object.entries(argAliases)) {
    if (args[alias] !== undefined) input[target] = String(args[alias] ?? '');
  }
  if (args.support_phone_mobile !== undefined) {
    input.supportPhoneMobile = args.support_phone_mobile;
  }
  if (args.sync_hours_to_calcom !== undefined) input.syncHoursToCalcom = args.sync_hours_to_calcom;
  if (args.sync_hours_to_gbp !== undefined) input.syncHoursToGbp = args.sync_hours_to_gbp;

  const stored = normalizeCompanyInput(input);
  const existing = await getStoredCompanyConfig();
  if (args.address !== undefined || args.geo !== undefined) {
    if (args.address !== undefined) {
      stored.address = String(args.address ?? '').trim() || null;
      stored.geo = stored.address
        ? await resolveCompanyAddressGeo(
            stored.address,
            args.geo as CompanyConfigInput['geo'],
            existing?.address,
          )
        : null;
    }
  }

  const fontGoogleSpecs = await mergeFontGoogleSpecs(existing?.fontGoogleSpecs, [
    stored.fontPrimary,
    stored.fontSecondary,
    stored.fontContent,
  ]);
  if (Object.keys(fontGoogleSpecs).length) stored.fontGoogleSpecs = fontGoogleSpecs;

  const ok = await setStoredCompanyConfig(stored);
  if (!ok) return JSON.stringify({ error: 'Failed to save company settings' });

  invalidateOfficeCoordsCache();
  const brand = await getCompanyBrandContext();
  const company = await getCompanyConfig();
  return JSON.stringify({
    ok: true,
    settings: companySettingsForAgent(company, brand.siteUrl),
  });
}

async function handle_set_company_branding_from_media(
  args: Record<string, unknown>,
  _ctx: ToolContext,
): Promise<string> {
  const mediaId = String(args.media_id ?? args.mediaId ?? '').trim();
  const slot = parseSlot(args.slot ?? args.branding_slot);
  const result = await applyCompanyBrandingFromMediaLibrary(slot, mediaId);
  return JSON.stringify(result);
}

async function handle_clear_company_branding(
  args: Record<string, unknown>,
  _ctx: ToolContext,
): Promise<string> {
  const slot = parseSlot(args.slot);
  const result = await clearCompanyBrandingSlot(slot);
  if (!result.ok) return JSON.stringify(result);
  const brand = await getCompanyBrandContext();
  const company = await getCompanyConfig();
  return JSON.stringify({
    ok: true,
    slot,
    settings: companySettingsForAgent(company, brand.siteUrl),
  });
}

export const companySettingsModule: AgentToolModule = {
  id: 'company-settings',
  enabled: () => true,
  definitions(ctx: ToolContext): AgentToolDef[] {
    return [
      {
        type: 'function',
        function: {
          name: 'get_company_settings',
          description:
            'Read Admin → Company settings: name, brand colors, header logo size, and resolved logo/icon/OG URLs (/api/branding/*). Use before replacing branding assets.',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
      },
      {
        type: 'function',
        function: {
          name: 'update_company_settings',
          description:
            'Update Admin → Company text fields (name, colors, support contact, fonts, etc.). Deployment owner only. Does not upload images — use set_company_branding_from_media with a media library id.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              legalName: { type: 'string' },
              description: { type: 'string' },
              supportEmail: { type: 'string' },
              supportPhone: { type: 'string' },
              support_phone_mobile: { type: 'boolean' },
              fromEmail: { type: 'string' },
              address: { type: 'string' },
              brandPrimary: { type: 'string' },
              brandSecondary: { type: 'string' },
              iconBackground: { type: 'string' },
              headerLogoSize: {
                type: 'string',
                description: 'xsmall | small | medium | large | xlarge',
              },
              logoSvg: { type: 'string', description: 'Inline SVG markup for animated wordmark' },
              iconSvg: { type: 'string' },
            },
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'set_company_branding_from_media',
          description:
            'Set company logo, icon, or OG share image from a media library id/slug (no manual upload/crop). Typical flow: generate_image with save_to_media → this tool with slot logo. Raster max 2 MB; SVG max 200 KB.',
          parameters: {
            type: 'object',
            properties: {
              media_id: { type: 'string', description: 'Media library UUID or slug' },
              slot: {
                type: 'string',
                description: 'logo (default — header wordmark), icon (favicon/PWA), or og (1200×630 share)',
              },
            },
            required: ['media_id'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'clear_company_branding',
          description: 'Remove admin-uploaded logo, icon, or OG image (slot: logo | icon | og).',
          parameters: {
            type: 'object',
            properties: {
              slot: { type: 'string' },
            },
            additionalProperties: false,
          },
        },
      },
    ];
  },
  handlers: {
    get_company_settings: handle_get_company_settings,
    update_company_settings: handle_update_company_settings,
    set_company_branding_from_media: handle_set_company_branding_from_media,
    clear_company_branding: handle_clear_company_branding,
  },
};
