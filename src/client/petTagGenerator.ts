import {
  buildPetTagVCard,
  petTagFormattedName,
  petTagHasContent,
  petTagPlainTextSummary,
  petTagSearchParamsFromFields,
  petTagVcfFilename,
  type PetTagFields,
} from '../lib/petTagVcard';

type NdefRecordInit = {
  recordType: string;
  mediaType?: string;
  data?: string | BufferSource;
  lang?: string;
};

type NdefWriteOptions = {
  records: NdefRecordInit[];
  overwrite?: boolean;
};

type NdefWriterLike = {
  write: (message: NdefWriteOptions | string, options?: { overwrite?: boolean }) => Promise<void>;
};

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function inputValue(id: string): string {
  const el = $(id);
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.value.trim();
  }
  return '';
}

function readFields(): PetTagFields {
  return {
    ownerName: inputValue('pet-tag-owner'),
    dogName: inputValue('pet-tag-dog'),
    phone: inputValue('pet-tag-phone'),
    altPhone: inputValue('pet-tag-alt'),
    address: inputValue('pet-tag-address'),
    businessName: inputValue('pet-tag-business-name'),
    businessPhone: inputValue('pet-tag-business-phone'),
  };
}

function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const n = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (n.length === 10) return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
  return raw.trim();
}

function telHref(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits ? `tel:+${digits.length === 10 ? '1' : ''}${digits}` : '';
}

function setPreviewText(id: string, text: string, hiddenWhenEmpty = true): void {
  const el = $(id);
  if (!el) return;
  if (!text.trim()) {
    el.textContent = '';
    if (hiddenWhenEmpty) el.hidden = true;
    return;
  }
  el.textContent = text;
  el.hidden = false;
}

function setActionDisabled(disabled: boolean): void {
  for (const id of ['pet-tag-download', 'pet-tag-copy', 'pet-tag-write']) {
    const el = $(id);
    if (el instanceof HTMLButtonElement) el.disabled = disabled;
  }
}

function syncShareUrl(fields: PetTagFields): void {
  const params = petTagSearchParamsFromFields(fields);
  const qs = params.toString();
  const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, '', next);
}

function updatePreview(fields: PetTagFields): void {
  const has = petTagHasContent(fields);
  setActionDisabled(!has);

  const titleEl = $('pet-tag-preview-title');
  if (titleEl) titleEl.textContent = has ? petTagFormattedName(fields) : 'Preview';

  const dog = fields.dogName.trim();
  const owner = fields.ownerName.trim();
  setPreviewText('pet-tag-preview-dog', dog ? `Dog: ${dog}` : '', true);
  setPreviewText('pet-tag-preview-owner', owner ? `Owner: ${owner}` : '', true);

  const phone = fields.phone.trim();
  const alt = fields.altPhone.trim();
  const phoneRow = $('pet-tag-preview-phone-row');
  const phoneLink = $('pet-tag-preview-phone');
  if (phoneRow && phoneLink instanceof HTMLAnchorElement) {
    if (phone) {
      phoneLink.href = telHref(phone);
      phoneLink.textContent = formatPhoneDisplay(phone);
      phoneRow.hidden = false;
    } else {
      phoneRow.hidden = true;
    }
  }
  const altRow = $('pet-tag-preview-alt-row');
  const altLink = $('pet-tag-preview-alt');
  if (altRow && altLink instanceof HTMLAnchorElement) {
    if (alt) {
      altLink.href = telHref(alt);
      altLink.textContent = formatPhoneDisplay(alt);
      altRow.hidden = false;
    } else {
      altRow.hidden = true;
    }
  }

  const address = fields.address.trim();
  setPreviewText('pet-tag-preview-address', address, true);

  const biz = fields.businessName.trim();
  const bizPhone = fields.businessPhone.trim();
  const bizLine = biz
    ? bizPhone
      ? `Pet care by ${biz} · ${formatPhoneDisplay(bizPhone)}`
      : `Pet care by ${biz}`
    : '';
  setPreviewText('pet-tag-preview-business', bizLine, true);

  const plain = has ? petTagPlainTextSummary(fields) : '';
  setPreviewText('pet-tag-preview-plain', plain ? `Tag text: ${plain}` : '', true);

  syncShareUrl(fields);
}

async function copyVCard(vcard: string): Promise<void> {
  await navigator.clipboard.writeText(vcard);
}

function downloadVcf(fields: PetTagFields, vcard: string): void {
  const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = petTagVcfFilename(fields);
  a.click();
  URL.revokeObjectURL(url);
}

/** Chrome Android over HTTPS — not available on iPhone Safari or most desktop browsers. */
function webNfcCanWrite(): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.isSecureContext) return false;
  return (
    typeof (globalThis as typeof globalThis & { NDEFWriter?: unknown }).NDEFWriter !== 'undefined'
  );
}

function showWriteHint(): void {
  const hint = $('pet-tag-write-hint');
  if (hint) {
    hint.hidden = false;
    hint.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

async function writeNfcTag(fields: PetTagFields): Promise<void> {
  const vcard = buildPetTagVCard(fields);
  const plain = petTagPlainTextSummary(fields);
  const records: NdefRecordInit[] = [
    { recordType: 'mime', mediaType: 'text/vcard', data: encodeUtf8(vcard) },
  ];
  if (plain) {
    records.push({ recordType: 'text', data: plain, lang: 'en' });
  }
  const NdefWriterCtor = (globalThis as typeof globalThis & { NDEFWriter?: new () => NdefWriterLike })
    .NDEFWriter;
  if (!NdefWriterCtor) throw new Error('Web NFC is not available on this device.');
  const writer = new NdefWriterCtor();
  await writer.write({ records }, { overwrite: true });
}

function showStatus(message: string, isError = false): void {
  const el = $('pet-tag-status');
  if (!el) return;
  el.textContent = message;
  el.hidden = !message;
  el.classList.toggle('pet-tag-status--err', isError);
}

export function initPetTagGenerator(): void {
  const form = $('pet-tag-form');
  if (!form) return;

  const writeHint = $('pet-tag-write-hint');
  if (writeHint && !webNfcCanWrite()) {
    writeHint.hidden = false;
  }

  const writeBtn = $('pet-tag-write');
  if (writeBtn instanceof HTMLButtonElement && !webNfcCanWrite()) {
    writeBtn.setAttribute('aria-description', 'Uses NFC Tools on iPhone — see steps below');
  }

  let debounce: ReturnType<typeof setTimeout> | undefined;
  const scheduleUpdate = () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => updatePreview(readFields()), 80);
  };

  form.addEventListener('input', scheduleUpdate);
  updatePreview(readFields());

  $('pet-tag-download')?.addEventListener('click', () => {
    const fields = readFields();
    if (!petTagHasContent(fields)) return;
    downloadVcf(fields, buildPetTagVCard(fields));
    showStatus('Downloaded .vcf — use NFC Tools on iPhone if needed.');
  });

  $('pet-tag-copy')?.addEventListener('click', async () => {
    const fields = readFields();
    if (!petTagHasContent(fields)) return;
    try {
      await copyVCard(buildPetTagVCard(fields));
      showStatus('vCard copied to clipboard.');
    } catch {
      showStatus('Could not copy — try Download instead.', true);
    }
  });

  writeBtn?.addEventListener('click', async () => {
    const fields = readFields();
    if (!petTagHasContent(fields)) {
      showStatus('Add at least one field before writing a tag.', true);
      return;
    }
    if (!webNfcCanWrite()) {
      downloadVcf(fields, buildPetTagVCard(fields));
      showWriteHint();
      showStatus(
        'Web NFC needs Chrome on Android. Downloaded .vcf — follow the steps below to write with NFC Tools.',
      );
      return;
    }
    showStatus('Hold the blank tag against the back of your phone…');
    try {
      await writeNfcTag(fields);
      showStatus('Tag written. Test in airplane mode.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Write failed';
      const hint =
        msg.includes('Failed to write') || msg.includes('NotAllowedError')
          ? ' Allow NFC if prompted, use a blank NTAG chip, and keep the tag still.'
          : '';
      showStatus(`${msg}${hint}`, true);
    }
  });
}
