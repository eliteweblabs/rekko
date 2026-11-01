import type { HelperManifestEntry } from '../../src/lib/agentHelperCommands';

export const emailInboxHelperCommands: HelperManifestEntry[] = [
  {
    slash: '/inbox',
    summary: 'List inbox emails',
    template: 'List recent inbox emails.',
    example: 'List recent inbox emails.',
  },
  {
    slash: '/email',
    summary: 'Read an inbox email',
    template: 'Read inbox email [id or subject].',
    example: 'Read the latest email from Acme Corp.',
  },
  {
    slash: '/rule',
    summary: 'Create an email filter rule',
    template: 'Create an email filter rule for sender [address] (optional: expires in [N] days).',
    example: 'Create an email filter rule for sender noreply@wordpress.com that expires in 7 days.',
  },
];
