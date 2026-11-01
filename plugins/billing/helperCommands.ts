import type { HelperManifestEntry } from '../../src/lib/agentHelperCommands';

export const billingHelperCommands: HelperManifestEntry[] = [
  {
    slash: '/invoice',
    summary: 'Create a draft Crater invoice',
    template: 'Create a draft invoice for [client name] for $[amount].',
    example: 'Create a draft invoice for Acme Corp for $1,500 for project acme-website-redesign.',
  },
  {
    slash: '/invoices',
    summary: 'List recent invoices',
    template: 'List my recent Crater invoices.',
    example: 'List my recent Crater invoices.',
  },
  {
    slash: '/invoice-pay',
    summary: 'Record an invoice payment',
    template: 'Record payment of $[amount] for invoice [number].',
    example: 'Record payment of $1,500 for invoice INV-00042.',
  },
  {
    slash: '/payment-modes',
    summary: 'Seed Crater payment modes (Venmo, Zelle, etc.)',
    template: 'Add payment modes',
    example: 'Add payment modes',
  },
];
