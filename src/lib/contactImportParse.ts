import { parseVCard } from './carddav/vcard';

export type ParsedImportContact = {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
};

/**
 * Parse CSV format: name,email,phone,company,notes
 * First line can be header (skipped if it contains "name" or "email").
 */
export function parseContactImportCsv(content: string): ParsedImportContact[] {
  const lines = content.trim().split(/\r?\n/);
  const contacts: ParsedImportContact[] = [];

  let startIdx = 0;
  if (lines.length > 0) {
    const firstLine = lines[0].toLowerCase();
    if (firstLine.includes('name') || firstLine.includes('email')) {
      startIdx = 1;
    }
  }

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
    const [name, email, phone, company, notes] = parts;

    if (!name && !email && !phone) continue;

    contacts.push({
      name: name || undefined,
      email: email || undefined,
      phone: phone || undefined,
      company: company || undefined,
      notes: notes || undefined,
    });
  }

  return contacts;
}

/** Multiple vCards can be concatenated in a single file. */
export function parseContactImportVCards(content: string): ParsedImportContact[] {
  const contacts: ParsedImportContact[] = [];
  const vcards = content.split(/BEGIN:VCARD/i).slice(1);

  for (const vcard of vcards) {
    const vcardText = 'BEGIN:VCARD' + vcard;
    const parsed = parseVCard(vcardText);
    if (!parsed) continue;

    contacts.push({
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      company: parsed.company,
      notes: parsed.notes,
    });
  }

  return contacts;
}

export function parseContactImportFile(content: string, fileName: string): ParsedImportContact[] {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.vcf') || lower.endsWith('.vcard')) {
    return parseContactImportVCards(content);
  }
  if (lower.endsWith('.csv')) {
    return parseContactImportCsv(content);
  }
  return [];
}

export function contactImportDisplayName(contact: ParsedImportContact): string {
  const name = contact.name?.trim();
  if (name) return name;
  if (contact.email?.trim()) return contact.email.trim();
  if (contact.phone?.trim()) return contact.phone.trim();
  return 'Unknown';
}

export function pickContactsByIndices(
  contacts: ParsedImportContact[],
  indices: number[],
): ParsedImportContact[] {
  const set = new Set(indices.filter((i) => Number.isInteger(i) && i >= 0 && i < contacts.length));
  return [...set].sort((a, b) => a - b).map((i) => contacts[i]);
}

export function parseContactImportIndices(raw: FormDataEntryValue | null): number[] | null {
  if (raw == null || raw === '') return null;
  const text = String(raw).trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((n): n is number => typeof n === 'number' && Number.isInteger(n));
  } catch {
    return null;
  }
}
