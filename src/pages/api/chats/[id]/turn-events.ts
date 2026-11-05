/**
 * GET /api/chats/:id/turn-events — recent chat_turn_events for this session (auth + owner).
 * Filter Railway logs with `[chat-agent]` or `[chat-turn]` for live runs.
 */
import type { APIContext } from 'astro';
import { resolveChatThreadOwnerUserId } from '../../../../lib/chatOwnerAccess';
import { requireDashboardUser } from '../../../../lib/dashboardAuth';
import { listChatTurnEventsForThread } from '../../../../lib/chatTurnEvents';
import { isChatAgentTraceVerbose } from '../../../../lib/chatAgentTrace';
import '../../../../lib/processDrain';
import { jsonResponse } from '../../../../lib/apiResponse';

export const prerender = false;

export async function GET(context: APIContext): Promise<Response> {
  const auth = await requireDashboardUser(context);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const id = context.params.id?.trim();
  if (!id) return jsonResponse({ ok: false, error: 'Missing thread id' }, 400);

  const ownerUserId = await resolveChatThreadOwnerUserId(userId, id);
  if (!ownerUserId) return jsonResponse({ ok: false, error: 'Session not found' }, 404);

  const limitRaw = context.url.searchParams.get('limit');
  const limit = limitRaw ? Number(limitRaw) : 200;

  const events = await listChatTurnEventsForThread(id, limit);

  return jsonResponse({
    ok: true,
    thread_id: id,
    verbose_trace: isChatAgentTraceVerbose(),
    events,
  });
}
