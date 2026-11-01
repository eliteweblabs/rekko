import type { HelperManifestEntry } from '../../src/lib/agentHelperCommands';

export const devInfraHelperCommands: HelperManifestEntry[] = [
  {
    slash: '/deploy',
    summary: 'Check if production is live',
    template: 'Is the latest code committed, pushed, and deployed to production?',
    example: 'Is the latest code committed, pushed, and deployed to production?',
  },
  {
    slash: '/git',
    summary: 'Git repo status',
    template: 'What is the current git status on the main branch?',
    example: 'What is the current git status on the main branch?',
  },
  {
    slash: '/commits',
    summary: 'Recent commits',
    template: 'Show recent commits on main.',
    example: 'Show recent commits on main.',
  },
  {
    slash: '/branches',
    summary: 'Open git branches',
    template: 'List open branches and in-progress work.',
    example: 'List open branches and in-progress work.',
  },
  {
    slash: '/dev',
    summary: 'Run a dev/ops status check',
    template: 'Run a service status check.',
    example: 'Run a service status check.',
  },
  {
    slash: '/railway',
    summary: 'Railway domains & DNS',
    template: 'List Railway domains for the production project.',
    example: 'List Railway domains for the production project.',
  },
  {
    slash: '/kinsta',
    summary: 'List Kinsta WordPress sites',
    template: 'List Kinsta WordPress sites.',
    example: 'List Kinsta WordPress sites.',
  },
  {
    slash: '/github-pr',
    summary: 'Open a GitHub pull request',
    template: 'Open a PR from branch [branch] titled [title].',
    example: 'Open a PR from branch fix/typo titled Fix homepage typo.',
  },
];
