import type { HelperManifestEntry } from '../../src/lib/agentHelperCommands';

export const schedulingHelperCommands: HelperManifestEntry[] = [
  {
    slash: '/meeting',
    summary: "List today's and upcoming meetings",
    template: "What's on my calendar today and upcoming?",
    example: "What's on my calendar today and upcoming?",
  },
  {
    slash: '/meetings',
    summary: 'List upcoming appointments',
    template: 'List my upcoming meetings.',
    example: 'List my upcoming meetings.',
  },
  {
    slash: '/schedule',
    summary: 'Get booking link to share',
    template: 'Get my Cal.com booking link to share with a client.',
    example: 'Get my Cal.com booking link to share with a client.',
  },
];
