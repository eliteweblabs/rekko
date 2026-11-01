import type { HelperManifestEntry } from '../../src/lib/agentHelperCommands';

export const uptimeMonitoringHelperCommands: HelperManifestEntry[] = [
  {
    slash: '/uptime',
    summary: 'Uptime monitoring summary',
    template: 'Show uptime monitoring summary.',
    example: 'Show uptime monitoring summary.',
  },
  {
    slash: '/uptimerobot-sync',
    summary: 'Sync UptimeRobot monitors',
    template: 'Sync monitors from UptimeRobot API.',
    example: 'Sync monitors from UptimeRobot API.',
  },
];
