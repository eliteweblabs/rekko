/**
 * Compact record of tools executed during one agent turn — persisted on the
 * assistant message (agent_usage.tools_run) and replayed into model context on
 * later turns (tool calls themselves are not stored in chat history).
 */

export type AgentToolRunEntry = {
  name: string;
  ok: boolean;
  ms?: number;
  /** Short human/model hint — e.g. "4 images", "committed abc1234" */
  hint?: string;
};

export function summarizeToolResultForLedger(toolName: string, rawResult: string): AgentToolRunEntry['hint'] {
  const trimmed = rawResult.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (parsed.error) return 'error';
    if (toolName === 'generate_image' || toolName === 'generate_image_variations') {
      const count =
        typeof parsed.count === 'number'
          ? parsed.count
          : Array.isArray(parsed.images)
            ? parsed.images.length
            : undefined;
      if (count != null) return count === 1 ? '1 image' : `${count} images`;
    }
    if (parsed.ok === true && typeof parsed.slug === 'string') return parsed.slug.slice(0, 40);
    if (parsed.ok === true && typeof parsed.commit_sha === 'string') {
      return String(parsed.commit_sha).slice(0, 12);
    }
  } catch {
    /* plain text tool output */
  }
  if (trimmed.length <= 80) return trimmed;
  return `${trimmed.slice(0, 77)}…`;
}

export function toolRunLooksOk(rawResult: string): boolean {
  const t = rawResult.trim();
  if (!t) return false;
  if (/^\s*\{/.test(t)) {
    try {
      const parsed = JSON.parse(t) as Record<string, unknown>;
      if (parsed.error) return false;
      if (parsed.ok === false) return false;
      return true;
    } catch {
      return true;
    }
  }
  if (/^error:/i.test(t)) return false;
  return true;
}

/** Prefix injected when rebuilding Anthropic messages from stored assistant turns. */
export function formatPriorTurnToolLedger(entries: AgentToolRunEntry[] | undefined | null): string {
  if (!entries?.length) return '';
  const parts = entries.map((e) => {
    const status = e.ok ? 'ok' : 'failed';
    const hint = e.hint ? ` (${e.hint})` : '';
    const ms = e.ms != null && e.ms > 0 ? ` ${e.ms}ms` : '';
    return `${e.name}: ${status}${hint}${ms}`;
  });
  return `[Tools already run in this assistant turn: ${parts.join('; ')}]`;
}
