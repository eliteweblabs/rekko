/**
 * Guard: offline pet NFC vCard builder — no URL, optional fields, query prefill.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildPetTagVCard,
  petTagFieldsFromSearchParams,
  petTagFormattedName,
  petTagHasContent,
  petTagPlainTextSummary,
  petTagSearchParamsFromFields,
  petTagVcfFilename,
} from '../src/lib/petTagVcard.ts';

const vcard = buildPetTagVCard({
  ownerName: 'Jane Doe',
  dogName: 'Max',
  phone: '(413) 555-0100',
  altPhone: '413-555-0199',
  address: '12 Oak St, Springfield',
  businessName: 'PDX Paws',
  businessPhone: '503-555-0100',
});

assert.match(vcard, /FN:Max — Jane Doe/);
assert.match(vcard, /N:Doe;Jane;;;/);
assert.match(vcard, /TEL;TYPE=CELL:\(413\) 555-0100/);
assert.match(vcard, /TEL;TYPE=HOME:413-555-0199/);
assert.match(vcard, /TEL;TYPE=WORK,VOICE:503-555-0100/);
assert.match(vcard, /ORG:PDX Paws/);
assert.match(vcard, /NOTE:.*Dog: Max/s);
assert.doesNotMatch(vcard, /^URL:/m);
assert.doesNotMatch(vcard, /\r\nURL:/);

assert.equal(petTagHasContent({ ownerName: '', dogName: '', phone: '', altPhone: '', address: '', businessName: '', businessPhone: '' }), false);
assert.equal(petTagHasContent({ ownerName: '', dogName: 'x', phone: '', altPhone: '', address: '', businessName: '', businessPhone: '' }), true);

assert.match(
  petTagPlainTextSummary({
    ownerName: 'Jane',
    dogName: 'Max',
    phone: '413-555-0100',
    altPhone: '',
    address: '',
    businessName: '',
    businessPhone: '',
  }),
  /Lost dog Max.*Jane.*413-555-0100/,
);

const params = petTagSearchParamsFromFields({
  ownerName: 'Jane Doe',
  dogName: 'Max',
  phone: '555',
  altPhone: '',
  address: 'Home',
});
assert.equal(params.get('dog'), 'Max');
assert.equal(params.get('owner'), 'Jane Doe');
const round = petTagFieldsFromSearchParams(params);
assert.equal(round.dogName, 'Max');
assert.equal(round.ownerName, 'Jane Doe');
assert.equal(round.phone, '555');
assert.equal(round.address, 'Home');

assert.equal(petTagFormattedName({ ownerName: '', dogName: 'Max', phone: '', altPhone: '', address: '', businessName: '', businessPhone: '' }), 'Max');
assert.match(petTagVcfFilename({ ownerName: 'Jane', dogName: 'Max', phone: '', altPhone: '', address: '', businessName: '', businessPhone: '' }), /^Max-Jane\.vcf$/);

const page = readFileSync('src/pages/pet-tag.astro', 'utf8');
const client = readFileSync('src/client/petTagGenerator.ts', 'utf8');
const mw = readFileSync('src/middleware.ts', 'utf8');
assert.match(page, /initPetTagGenerator/);
assert.match(client, /text\/vcard/);
assert.match(client, /webNfcCanWrite/);
assert.match(client, /overwrite: true/);
assert.match(mw, /\/pet-tag"/);

console.log('ok — pet tag vCard builder (offline NFC, no URL on tag)');
