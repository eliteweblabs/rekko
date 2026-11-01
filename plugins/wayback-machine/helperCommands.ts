import type { HelperManifestEntry } from '../../src/lib/agentHelperCommands';

export const waybackMachineHelperCommands: HelperManifestEntry[] = [
  {
    slash: '/wayback',
    summary: 'View an archived website snapshot',
    template: 'What did [url] look like in [month/year]?',
    example: 'What did https://example.com look like in February 2018?',
  },
];
