import { escVCard, foldLine } from './vcardFormat';

export type PetTagFields = {
  ownerName: string;
  dogName: string;
  phone: string;
  altPhone: string;
  address: string;
  businessName: string;
  businessPhone: string;
};

export const EMPTY_PET_TAG_FIELDS: PetTagFields = {
  ownerName: '',
  dogName: '',
  phone: '',
  altPhone: '',
  address: '',
  businessName: '',
  businessPhone: '',
};

function trimField(value: string | null | undefined): string {
  return (value ?? '').trim();
}

/** Split "Jane Doe" into vCard N components (last;first;;;). */
export function parseOwnerNameForVCard(ownerName: string): { first: string; last: string } {
  const full = ownerName.trim();
  if (!full) return { first: '', last: '' };
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first: parts[0]!, last: '' };
  const last = parts[parts.length - 1]!;
  const first = parts.slice(0, -1).join(' ');
  return { first, last };
}

/** Display / FN line shown in Contacts and the generator preview. */
export function petTagFormattedName(fields: PetTagFields): string {
  const dog = trimField(fields.dogName);
  const owner = trimField(fields.ownerName);
  if (dog && owner) return `${dog} - ${owner}`;
  if (dog) return dog;
  if (owner) return owner;
  const biz = trimField(fields.businessName);
  if (biz) return biz;
  return 'Pet tag';
}

export function petTagHasContent(fields: PetTagFields): boolean {
  return (
    trimField(fields.ownerName) !== '' ||
    trimField(fields.dogName) !== '' ||
    trimField(fields.phone) !== '' ||
    trimField(fields.altPhone) !== '' ||
    trimField(fields.address) !== '' ||
    trimField(fields.businessName) !== '' ||
    trimField(fields.businessPhone) !== ''
  );
}

function normalizePhoneForCompare(phone: string): string {
  return phone.replace(/\D/g, '');
}

function buildNoteLines(fields: PetTagFields): string[] {
  const lines: string[] = [];
  const dog = trimField(fields.dogName);
  const owner = trimField(fields.ownerName);
  if (dog) lines.push(`Dog: ${dog}`);
  if (owner && dog) lines.push('If found, please call.');
  else if (owner || trimField(fields.phone) || trimField(fields.altPhone)) {
    lines.push('If found, please call.');
  }
  const biz = trimField(fields.businessName);
  const bizPhone = trimField(fields.businessPhone);
  if (biz) {
    lines.push(bizPhone ? `Pet care by ${biz} (${bizPhone})` : `Pet care by ${biz}`);
  }
  return lines;
}

/** vCard 3.0 for offline NFC (MIME text/vcard). No URL field. */
export function buildPetTagVCard(fields: PetTagFields): string {
  const owner = trimField(fields.ownerName);
  const { first, last } = parseOwnerNameForVCard(owner);
  const fn = petTagFormattedName(fields);
  const phone = trimField(fields.phone);
  const altPhone = trimField(fields.altPhone);
  const address = trimField(fields.address);
  const businessName = trimField(fields.businessName);
  const businessPhone = trimField(fields.businessPhone);

  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  lines.push(foldLine(`N:${escVCard(last)};${escVCard(first)};;;`));
  lines.push(foldLine(`FN:${escVCard(fn)}`));
  if (businessName) lines.push(foldLine(`ORG:${escVCard(businessName)}`));
  if (phone) lines.push(foldLine(`TEL;TYPE=CELL:${escVCard(phone)}`));
  if (altPhone) lines.push(foldLine(`TEL;TYPE=HOME:${escVCard(altPhone)}`));
  const bizDigits = normalizePhoneForCompare(businessPhone);
  const primaryDigits = normalizePhoneForCompare(phone);
  const altDigits = normalizePhoneForCompare(altPhone);
  if (businessPhone && bizDigits && bizDigits !== primaryDigits && bizDigits !== altDigits) {
    lines.push(foldLine(`TEL;TYPE=WORK,VOICE:${escVCard(businessPhone)}`));
  }
  if (address) {
    lines.push(foldLine(`LABEL;TYPE=HOME:${escVCard(address)}`));
    lines.push(foldLine(`ADR;TYPE=HOME:;;${escVCard(address)};;;;`));
  }
  const note = buildNoteLines(fields).join('\n');
  if (note) lines.push(foldLine(`NOTE:${escVCard(note)}`));
  lines.push('END:VCARD');

  return lines.join('\r\n') + '\r\n';
}

/** Short plain-text NDEF companion for finders (optional second record). */
export function petTagPlainTextSummary(fields: PetTagFields): string {
  const dog = trimField(fields.dogName);
  const owner = trimField(fields.ownerName);
  const phone = trimField(fields.phone) || trimField(fields.altPhone);
  const parts: string[] = [];
  if (dog) parts.push(`Lost dog ${dog}.`);
  else parts.push('Lost pet.');
  if (owner && phone) parts.push(`Call ${owner}: ${phone}.`);
  else if (owner) parts.push(`Contact ${owner}.`);
  else if (phone) parts.push(`Call ${phone}.`);
  else if (trimField(fields.address)) parts.push(`Address: ${trimField(fields.address)}.`);
  return parts.join(' ').trim();
}

export type PetTagQueryKeys = keyof Pick<
  PetTagFields,
  'ownerName' | 'dogName' | 'phone' | 'altPhone' | 'address'
>;

const QUERY_MAP: Record<string, PetTagQueryKeys> = {
  owner: 'ownerName',
  dog: 'dogName',
  phone: 'phone',
  alt: 'altPhone',
  address: 'address',
};

export function petTagFieldsFromSearchParams(params: URLSearchParams): Partial<PetTagFields> {
  const out: Partial<PetTagFields> = {};
  for (const [param, key] of Object.entries(QUERY_MAP)) {
    const raw = params.get(param);
    if (raw != null && raw.trim()) out[key] = raw.trim();
  }
  return out;
}

export function petTagSearchParamsFromFields(
  fields: Pick<PetTagFields, 'ownerName' | 'dogName' | 'phone' | 'altPhone' | 'address'>,
): URLSearchParams {
  const params = new URLSearchParams();
  if (trimField(fields.dogName)) params.set('dog', trimField(fields.dogName));
  if (trimField(fields.ownerName)) params.set('owner', trimField(fields.ownerName));
  if (trimField(fields.phone)) params.set('phone', trimField(fields.phone));
  if (trimField(fields.altPhone)) params.set('alt', trimField(fields.altPhone));
  if (trimField(fields.address)) params.set('address', trimField(fields.address));
  return params;
}

/** Safe filename stem for downloaded .vcf */
export function petTagVcfFilename(fields: PetTagFields): string {
  const dog = trimField(fields.dogName);
  const owner = trimField(fields.ownerName);
  const base = [dog, owner].filter(Boolean).join('-') || 'pet-tag';
  return `${base.replace(/[^\w.-]+/g, '_').slice(0, 80)}.vcf`;
}
