/**
 * Slash-style helper commands for admin agent chat compose.
 * Core OS commands live here; optional modules register via plugins/{id}/helperCommands.ts
 * (same feature gate as agentTools). Server aggregates in agentHelperCommands.server.ts.
 */

export type AgentHelperCommand = {
  slash: string;
  label: string;
  summary: string;
  template: string;
  steps: string[];
  example: string;
  /** Omit or "core" = always available when logged in (may still be runtime-gated on server). */
  feature?: string | 'core';
};

export type HelperManifestEntry = {
  slash: string;
  summary: string;
  template: string;
  example: string;
  feature?: string | 'core';
};

function titleFromSlash(slash: string): string {
  const raw = slash.replace(/^\//, '').replace(/-/g, ' ');
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function toHelperCommand(entry: HelperManifestEntry): AgentHelperCommand {
  return {
    slash: entry.slash,
    label: titleFromSlash(entry.slash),
    summary: entry.summary,
    template: entry.template,
    steps: [],
    example: entry.example,
    feature: entry.feature ?? 'core',
  };
}

/** Always-on OS commands (+ feature-flagged add-ons without a plugin home). */
const CORE_HELPER_MANIFEST: HelperManifestEntry[] = [
  // Knowledge
  {
    slash: '/knowledge',
    summary: 'List knowledge docs',
    template: 'List all knowledge entries.',
    example: 'List all knowledge entries.',
  },
  {
    slash: '/search',
    summary: 'Search knowledge',
    template: 'Search knowledge for [topic].',
    example: 'Search knowledge for Stripe billing.',
  },
  {
    slash: '/read',
    summary: 'Read a knowledge doc',
    template: 'Read knowledge entry [slug].',
    example: 'Read knowledge entry crater-billing.',
  },

  // Work / jobs
  {
    slash: '/work',
    summary: 'List or start a job',
    template: 'List open jobs for [client].',
    example: 'List open jobs for Acme Corp.',
  },
  {
    slash: '/job',
    summary: 'Create a new job',
    template: 'Create a job for [client]: [what they need].',
    example: 'Create a job for Acme Corp: redesign homepage.',
  },
  {
    slash: '/job-read',
    summary: 'Read a job by slug',
    template: 'Show me job [slug].',
    example: 'Show me job acme-website-redesign.',
  },

  // Contacts
  {
    slash: '/contact',
    summary: 'Look up a contact',
    template: 'Who is [name]? Show their contact details and any open projects.',
    example: 'Who is Northwind Studio?',
  },
  {
    slash: '/contacts',
    summary: 'List all contacts',
    template: 'List my contacts.',
    example: 'List my contacts.',
  },
  {
    slash: '/contact-new',
    summary: 'Add a new contact',
    template: 'Create a contact for [name] with email [email].',
    example: 'Create a contact for Jane Doe with email jane@acme.com.',
  },

  // Personal todos (runtime: todo DB)
  {
    slash: '/todo',
    summary: 'List personal todos',
    template: 'List my open to-dos.',
    example: 'List my open to-dos.',
  },
  {
    slash: '/todo-add',
    summary: 'Add a personal todo',
    template: 'Add to my to-do list: [task].',
    example: 'Add to my to-do list: renew domain for Acme.',
  },

  // Durable recall
  {
    slash: '/remember',
    summary: 'What the agent already knows',
    template: 'What do you remember about me and how we work?',
    example: 'What do you remember about me and how we work?',
  },
  {
    slash: '/forget',
    summary: 'Drop a saved recall note',
    template: 'Forget that [note].',
    example: 'Forget that invoice terms are net-30.',
  },

  // Outbound comms & search (runtime gates on server)
  {
    slash: '/send',
    summary: 'Send an email',
    template: 'Email [name] at [address]: [message].',
    example: 'Email Tony at tony@example.com: Your portal link is ready.',
  },
  {
    slash: '/web',
    summary: 'Search the web',
    template: 'Search the web for [query].',
    example: 'Search the web for Northwind Studio Boston.',
  },

  // Dynamic documents (no plugin package — feature add-on)
  {
    slash: '/document',
    summary: 'Send a filled document',
    template: 'Send document [template] to [client].',
    example: 'Send document service-agreement to Acme Corp.',
    feature: 'documents',
  },

  // Voice outbound (Telnyx / Vapi stack — feature add-on)
  {
    slash: '/call',
    summary: 'Initiate an outbound call',
    template: 'Call [contact] at [phone].',
    example: 'Call Tony Vello at +15551234567.',
    feature: 'voice',
  },

  // Media drop folder (core)
  {
    slash: '/media-drop',
    summary: 'Mac / iPhone media folder setup',
    template: 'How do I mount the media library as a folder on my Mac and iPhone?',
    example: 'How do I mount the media library as a folder on my Mac and iPhone?',
  },
];

/** Core slash commands — use listEnabledHelperCommands() for the deployment-filtered list. */
export const AGENT_HELPER_COMMANDS: AgentHelperCommand[] = CORE_HELPER_MANIFEST.map(toHelperCommand);

export function filterHelperCommands(query: string, commands: AgentHelperCommand[]): AgentHelperCommand[] {
  const trimmed = query.trim();
  if (!trimmed) return commands;
  if (!trimmed.startsWith('/')) return [];
  const lower = trimmed.toLowerCase();
  return commands.filter((cmd) => cmd.slash.toLowerCase().startsWith(lower));
}

export function matchHelperCommand(query: string, commands: AgentHelperCommand[]): AgentHelperCommand | null {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed.startsWith('/')) return null;
  const exact = commands.find((cmd) => cmd.slash.toLowerCase() === trimmed);
  if (exact) return exact;
  const token = trimmed.split(/\s/)[0];
  return commands.find((cmd) => cmd.slash.toLowerCase() === token) ?? null;
}
