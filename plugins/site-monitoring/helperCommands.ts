import type { HelperManifestEntry } from '../../src/lib/agentHelperCommands';

export const siteMonitoringHelperCommands: HelperManifestEntry[] = [
  {
    slash: '/monitor',
    summary: 'Website change monitoring status',
    template: 'What is the change monitoring status for [url]?',
    example: 'What is the change monitoring status for https://acme.com?',
  },
];
