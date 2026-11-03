import {
  buildPetTagVCard,
  petTagHasContent,
  petTagPlainTextSummary,
  type PetTagFields,
} from './petTagVcard';

export type PetTagNfcPayload = 'call' | 'vcard';

/** What we encode on the chip (not the downloadable .vcf file). */
export type PetTagNdefRecord =
  | { kind: 'url'; url: string }
  | { kind: 'text'; text: string; lang?: string }
  | { kind: 'mime'; mediaType: string; body: string };

function trim(value: string): string {
  return value.trim();
}

/** Primary number used for tap-to-call tags. */
export function primaryTagPhone(fields: PetTagFields): string {
  return trim(fields.phone) || trim(fields.altPhone) || trim(fields.businessPhone);
}

/** E.164-style tel: URI for NDEF (works offline on iPhone background read). */
export function phoneToTelUri(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `tel:+${digits}`;
  return `tel:+${digits}`;
}

export function petTagCanEncodeCall(fields: PetTagFields): boolean {
  return phoneToTelUri(primaryTagPhone(fields)) != null;
}

export function petTagCanEncodePayload(fields: PetTagFields, payload: PetTagNfcPayload): boolean {
  if (payload === 'call') return petTagCanEncodeCall(fields);
  return petTagHasContent(fields);
}

/**
 * NDEF records to write. Default `call` matches iPhone behavior for https:// URL tags.
 * iOS ignores MIME vCard on background tap — only URI schemes like tel: are handled.
 */
export function buildPetTagNdefRecords(
  fields: PetTagFields,
  payload: PetTagNfcPayload = 'call',
): PetTagNdefRecord[] {
  if (payload === 'call') {
    const tel = phoneToTelUri(primaryTagPhone(fields));
    if (!tel) return [];
    const records: PetTagNdefRecord[] = [{ kind: 'url', url: tel }];
    const text = petTagPlainTextSummary(fields);
    if (text) records.push({ kind: 'text', text, lang: 'en' });
    return records;
  }

  const body = buildPetTagVCard(fields);
  return [{ kind: 'mime', mediaType: 'text/x-vcard', body }];
}
