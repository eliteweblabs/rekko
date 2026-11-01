/**
 * Apply a media library row to Admin → Company branding slots (logo / icon / OG).
 */

import { readRasterDimensions } from './brandImageRender';
import {
  companyBrandingOgUrl,
  companyBrandingVersion,
  companyLogoUrl,
  getCompanyBrandContext,
  getCompanyConfig,
  type CompanyConfig,
} from './companyConfig';
import {
  clearStoredCompanyIcon,
  clearStoredCompanyLogo,
  clearStoredCompanyOg,
  setStoredCompanyConfig,
  setStoredCompanyIcon,
  setStoredCompanyLogo,
  setStoredCompanyOg,
} from './companyConfigStore';
import { BRANDING_ICON_PATH, BRANDING_LOGO_PATH } from './companyLogo';
import { brandingBlobFromMedia, storeGetMediaByRef } from './mediaLibrary';

export type CompanyBrandingSlot = 'logo' | 'icon' | 'og';

function publicBrandingUrls(company: CompanyConfig): {
  logo_url: string | null;
  icon_url: string | null;
  og_image_url: string | null;
} {
  const v = companyBrandingVersion(company);
  const logo =
    company.logoSource === 'hidden'
      ? null
      : companyLogoUrl(company.logoPath, company.logoVersion) ||
        (company.logoHasRaster || company.logoSvg ? `${BRANDING_LOGO_PATH}${v ? `?v=${encodeURIComponent(v)}` : ''}` : null);
  const icon =
    company.iconHasRaster || company.iconSvg
      ? `${BRANDING_ICON_PATH}${v ? `?v=${encodeURIComponent(v)}` : ''}`
      : companyLogoUrl(company.iconPath, company.iconVersion) || null;
  const og = company.ogHasRaster ? companyBrandingOgUrl(company) : null;
  return { logo_url: logo || null, icon_url: icon || null, og_image_url: og };
}

export function companySettingsForAgent(company: CompanyConfig, siteUrl: string): Record<string, unknown> {
  const branding = publicBrandingUrls(company);
  const abs = (path: string | null) => {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    const base = siteUrl.replace(/\/$/, '');
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  };
  return {
    name: company.name,
    legal_name: company.legalName,
    description: company.description,
    domain: company.domain,
    support_email: company.supportEmail,
    support_phone: company.supportPhone,
    brand_primary: company.brandPrimary,
    brand_secondary: company.brandSecondary,
    header_logo_size: company.headerLogoSize,
    logo_source: company.logoSource,
    icon_source: company.iconSource,
    logo_has_raster: company.logoHasRaster,
    icon_has_raster: company.iconHasRaster,
    og_has_raster: company.ogHasRaster,
    logo_path: company.logoPath,
    icon_path: company.iconPath,
    ...branding,
    logo_public_url: abs(branding.logo_url),
    icon_public_url: abs(branding.icon_url),
    og_image_public_url: abs(branding.og_image_url),
    note: 'Company wordmark/icon are served from /api/branding/* — use set_company_branding_from_media with a media library id after generate_image save_to_media.',
  };
}

export async function applyCompanyBrandingFromMediaLibrary(
  slot: CompanyBrandingSlot,
  mediaRef: string,
): Promise<
  | { ok: true; slot: CompanyBrandingSlot; company: ReturnType<typeof companySettingsForAgent> }
  | { ok: false; error: string }
> {
  const ref = mediaRef.trim();
  if (!ref) return { ok: false, error: 'media_id is required' };

  const record = await storeGetMediaByRef(ref);
  if (!record) return { ok: false, error: 'media_id not found in the media library' };

  const blob = brandingBlobFromMedia(record);
  if (!blob.ok) return { ok: false, error: blob.error };

  if (slot === 'og') {
    if (blob.kind === 'svg') {
      return { ok: false, error: 'OG share image must be a raster (PNG, JPEG, WebP, AVIF)' };
    }
    const dims = await readRasterDimensions(blob.dataBase64);
    const ok = await setStoredCompanyOg({
      dataBase64: blob.dataBase64,
      mediaType: blob.mediaType,
      width: dims?.width,
      height: dims?.height,
    });
    if (!ok) return { ok: false, error: 'Failed to save OG image' };
  } else if (slot === 'logo') {
    if (blob.kind === 'svg') {
      const ok = await setStoredCompanyConfig({
        logoSvg: blob.svg,
        logoData: null,
        logoMediaType: null,
        logoPath: null,
      });
      if (!ok) return { ok: false, error: 'Failed to save logo SVG' };
    } else {
      const ok = await setStoredCompanyLogo({
        dataBase64: blob.dataBase64,
        mediaType: blob.mediaType,
      });
      if (!ok) return { ok: false, error: 'Failed to save logo' };
    }
  } else {
    if (blob.kind === 'svg') {
      const ok = await setStoredCompanyConfig({
        iconSvg: blob.svg,
        iconData: null,
        iconMediaType: null,
        iconPath: null,
      });
      if (!ok) return { ok: false, error: 'Failed to save icon SVG' };
    } else {
      const ok = await setStoredCompanyIcon({
        dataBase64: blob.dataBase64,
        mediaType: blob.mediaType,
      });
      if (!ok) return { ok: false, error: 'Failed to save icon' };
    }
  }

  const company = await getCompanyConfig();
  const brand = await getCompanyBrandContext();
  return {
    ok: true,
    slot,
    company: companySettingsForAgent(company, brand.siteUrl),
  };
}

export async function clearCompanyBrandingSlot(
  slot: CompanyBrandingSlot,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ok =
    slot === 'logo' ? await clearStoredCompanyLogo() : slot === 'icon' ? await clearStoredCompanyIcon() : await clearStoredCompanyOg();
  if (!ok) return { ok: false, error: `Failed to clear ${slot}` };
  return { ok: true };
}
