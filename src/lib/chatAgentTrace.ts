/**
 * Structured agent/chat diagnostics — Railway `[chat-agent]` lines and
 * chat_turn_events rows. Enable verbose per-round logs with CHAT_AGENT_TRACE=1.
 */

import type { ChatTurn } from './chatTypes';
import { parseChatMessageContent } from './chatTypes';
import { recordChatTurnEvent } from './chatTurnEvents';
import type { AgentToolRunEntry } from './chatAgentLedger';
import { serverEnv } from './serverEnv';

export type AgentHistoryDigest = {
  messagesInThread: number;
  turnsAfterTrim: number;
  historyTurnCap: number | null;
  turnsDroppedByCap: number;
  userTurns: number;
  assistantTurns: number;
  charsUser: number;
  charsAssistant: number;
  turnsTruncatedByChars: number;
  attachmentTurnsStripped: number;
  lastUserPreview: string;
  lastAssistantPreview: string;
};

function historyTurnCapFromEnv(): number | null {
  const raw = serverEnv('AGENT_CHAT_HISTORY_TURNS');
  if (!raw?.trim()) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export function isChatAgentTraceVerbose(): boolean {
  const raw = serverEnv('CHAT_AGENT_TRACE')?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'verbose';
}

export function digestPriorTurns(
  rawMessages: { role: string; content: string }[],
  trimmed: ChatTurn[],
  opts: { maxTurnChars: number },
): AgentHistoryDigest {
  const cap = historyTurnCapFromEnv();
  const rawTurns = rawMessages.filter((m) => m.role === 'user' || m.role === 'assistant');
  let turnsTruncatedByChars = 0;
  let attachmentTurnsStripped = 0;
  for (const m of rawTurns) {
    if (m.role === 'user') {
      const { text, images, docs } = parseChatMessageContent(m.content);
      const serialized = m.content.startsWith('{"v":');
      if (serialized && !images.length && !docs.length && text) attachmentTurnsStripped += 1;
    }
    if (m.content.length > opts.maxTurnChars) turnsTruncatedByChars += 1;
  }
  let charsUser = 0;
  let charsAssistant = 0;
  for (const t of trimmed) {
    if (t.role === 'user') charsUser += t.content.length;
    else charsAssistant += t.content.length;
  }
  const lastUser = [...trimmed].reverse().find((t) => t.role === 'user');
  const lastAssistant = [...trimmed].reverse().find((t) => t.role === 'assistant');
  return {
    messagesInThread: rawMessages.length,
    turnsAfterTrim: trimmed.length,
    historyTurnCap: cap,
    turnsDroppedByCap: cap != null && rawTurns.length > cap ? rawTurns.length - cap : 0,
    userTurns: trimmed.filter((t) => t.role === 'user').length,
    assistantTurns: trimmed.filter((t) => t.role === 'assistant').length,
    charsUser,
    charsAssistant,
    turnsTruncatedByChars,
    attachmentTurnsStripped,
    lastUserPreview: previewTurn(lastUser?.content ?? ''),
    lastAssistantPreview: previewTurn(lastAssistant?.content ?? ''),
  };
}

function previewTurn(content: string): string {
  const { text } = parseChatMessageContent(content);
  const line = (text || content).replace(/\s+/g, ' ').trim();
  return line.length <= 160 ? line : `${line.slice(0, 157)}…`;
}

function logChatAgent(line: Record<string, unknown>): void {
  try {
    console.info('[chat-agent]', JSON.stringify(line));
  } catch {
    /* ignore */
  }
}

export function traceAgentEvent(
  userId: string,
  threadId: string,
  event:
    | 'agent_history'
    | 'agent_round'
    | 'agent_tool'
    | 'agent_stall'
    | 'agent_finish'
    | 'agent_error',
  detail: Record<string, unknown>,
): void {
  const verbose = isChatAgentTraceVerbose();
  const always =
    event === 'agent_history' ||
    event === 'agent_finish' ||
    event === 'agent_error' ||
    event === 'agent_stall';
  if (!verbose && !always) return;

  logChatAgent({ userId, threadId, event, ...detail });
  recordChatTurnEvent(userId, threadId, event, { detail });
}

export function traceAgentFinish(
  userId: string,
  threadId: string,
  detail: {
    digest: AgentHistoryDigest;
    toolRounds: number;
    stallNudges: number;
    llmTimeouts: number;
    toolsRun: AgentToolRunEntry[];
    replyChars: number;
    aborted?: boolean;
  },
): void {
  traceAgentEvent(userId, threadId, 'agent_finish', {
    ...detail.digest,
    toolRounds: detail.toolRounds,
    stallNudges: detail.stallNudges,
    llmTimeouts: detail.llmTimeouts,
    toolsRun: detail.toolsRun.map((t) => ({
      name: t.name,
      ok: t.ok,
      ms: t.ms,
      hint: t.hint,
    })),
    replyChars: detail.replyChars,
    aborted: detail.aborted ?? false,
    verbose: isChatAgentTraceVerbose(),
  });
}
