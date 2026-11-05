import '@vitejs/plugin-react/preamble';
import { createRoot, type Root } from 'react-dom/client';
import { AgentChatPanel, type AgentChatPanelProps } from '../components/admin/AgentChatPanel';
import { composeTrace } from '../lib/chatComposeTrace';

type MountRecord = {
  root: Root;
  props: AgentChatPanelProps;
};

const mounts = new WeakMap<HTMLElement, MountRecord>();

function renderMount(el: HTMLElement, props: AgentChatPanelProps) {
  let record = mounts.get(el);
  if (!record) {
    const root = createRoot(el);
    record = { root, props };
    mounts.set(el, record);
  }
  record.props = props;
  record.root.render(<AgentChatPanel {...props} />);
}

export function mountAgentChat(el: HTMLElement, props: AgentChatPanelProps) {
  const end =
    typeof window !== 'undefined'
      ? window.__reaveTrace?.start?.('chat:react-mount-inner', {
          threadId: props.threadId,
          messages: props.initialMessages?.length ?? 0,
        })
      : undefined;
  renderMount(el, props);
  end?.({ ok: true });
}

export function updateAgentChat(el: HTMLElement, props: Partial<AgentChatPanelProps>) {
  const record = mounts.get(el);
  if (!record) return;
  renderMount(el, { ...record.props, ...props });
}

/** Import persisted messages into the live runtime without tearing down the tree. */
export function syncAgentChatMessages(
  el: HTMLElement,
  messages: AgentChatPanelProps['initialMessages'],
  opts?: { force?: boolean },
) {
  const record = mounts.get(el);
  if (!record) return;
  const force = opts?.force === true;
  const readingHistory =
    !force &&
    typeof window !== 'undefined' &&
    Boolean((window as Window & { __reaveChatReadingHistory?: boolean }).__reaveChatReadingHistory);

  if (readingHistory) {
    composeTrace(
      'react.sync-messages-deferred',
      { messageCount: messages?.length ?? 0 },
      'info',
      { snap: true },
    );
    renderMount(el, { ...record.props, initialMessages: messages });
    return;
  }

  const nextGen = (record.props.importMessagesGeneration ?? 0) + 1;
  composeTrace(
    'react.sync-messages-mount',
    { messageCount: messages?.length ?? 0, generation: nextGen, force },
    'warn',
    { snap: true },
  );
  renderMount(el, {
    ...record.props,
    initialMessages: messages,
    importMessagesGeneration: nextGen,
  });
}

export function unmountAgentChat(el: HTMLElement) {
  const record = mounts.get(el);
  if (!record) return;
  composeTrace('react.unmount', { threadId: record.props.threadId }, 'error', { snap: true });
  record.root.unmount();
  mounts.delete(el);
}

declare global {
  interface Window {
    __reaveAgentChat?: {
      mount: typeof mountAgentChat;
      update: typeof updateAgentChat;
      syncMessages: typeof syncAgentChatMessages;
      unmount: typeof unmountAgentChat;
    };
    __reaveChatReadingHistory?: boolean;
    __reaveTrace?: {
      enabled?: () => boolean;
      start?: (name: string, meta?: Record<string, unknown>) => (endMeta?: Record<string, unknown>) => number;
      summary?: () => unknown[];
    };
  }
}

window.__reaveAgentChat = {
  mount: mountAgentChat,
  update: updateAgentChat,
  syncMessages: syncAgentChatMessages,
  unmount: unmountAgentChat,
};

export {};
