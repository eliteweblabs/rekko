/**
 * Tool ledger + history digest helpers for admin chat memory.
 *   npx tsx scripts/verify-chat-agent-ledger.ts
 */
import assert from 'node:assert/strict';
import {
  formatPriorTurnToolLedger,
  summarizeToolResultForLedger,
  toolRunLooksOk,
} from '../src/lib/chatAgentLedger.ts';
assert.equal(
  formatPriorTurnToolLedger([
    { name: 'generate_image', ok: true, hint: '4 images', ms: 1200 },
  ]),
  '[Tools already run in this assistant turn: generate_image: ok (4 images) 1200ms]',
);

const genOk = summarizeToolResultForLedger(
  'generate_image',
  JSON.stringify({ ok: true, count: 2, images: [{ url: 'x' }, { url: 'y' }] }),
);
assert.equal(genOk, '2 images');

assert.equal(toolRunLooksOk(JSON.stringify({ error: 'nope' })), false);
assert.equal(toolRunLooksOk(JSON.stringify({ ok: true })), true);

console.log('verify-chat-agent-ledger: ok');
