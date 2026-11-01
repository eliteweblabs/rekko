import type { HelperManifestEntry } from '../../src/lib/agentHelperCommands';

export const clientPortalHelperCommands: HelperManifestEntry[] = [
  {
    slash: '/portal',
    summary: 'Get a client portal link',
    template: "What's the portal link for [client]?",
    example: "What's the portal link for Acme Corp?",
  },
  {
    slash: '/portal-send',
    summary: 'Send portal link to client',
    template: 'Send the client portal link to [client].',
    example: 'Send the client portal link to Acme Corp.',
  },
  {
    slash: '/portal-set',
    summary: 'Update client portal content',
    template: 'Update [client] portal headline to [headline] and body: [content].',
    example: 'Update Acme portal headline to Your project and body: We are on track for launch.',
  },
];
