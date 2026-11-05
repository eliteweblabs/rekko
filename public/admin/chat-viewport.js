/**
 * Shared scroll / reading-state helpers for admin + focus agent chat.
 */

const NEAR_BOTTOM_PX = 80;

export function chatMessageViewportEl() {
  return document.querySelector('#ch-thread-root .aui-viewport, .aui-root--focus .aui-viewport');
}

export function isChatViewportNearBottom(thresholdPx = NEAR_BOTTOM_PX) {
  const viewport = chatMessageViewportEl();
  if (!(viewport instanceof HTMLElement)) return true;
  const distance = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
  return distance <= thresholdPx;
}

export function isChatViewportAtTop(thresholdPx = 20) {
  const viewport = chatMessageViewportEl();
  if (!(viewport instanceof HTMLElement)) return false;
  return viewport.scrollTop <= thresholdPx;
}

/** Set from AgentChatPanel when the user has scrolled up to read older turns. */
export function isChatReadingHistory() {
  try {
    return Boolean(window.__reaveChatReadingHistory);
  } catch {
    return false;
  }
}

export function shouldDeferChatThreadSync() {
  return isChatReadingHistory() || !isChatViewportNearBottom();
}
