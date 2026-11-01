import type { HelperManifestEntry } from '../../src/lib/agentHelperCommands';

export const siteAuditsHelperCommands: HelperManifestEntry[] = [
  {
    slash: '/audit',
    summary: 'Run Lighthouse audit on a URL',
    template: 'Run a Lighthouse audit on [url].',
    example: 'Run a Lighthouse audit on https://acme.com.',
  },
  {
    slash: '/fetch',
    summary: 'Fetch and review a webpage',
    template: 'Fetch and summarize [url].',
    example: 'Fetch and summarize https://acme.com.',
  },
  {
    slash: '/seoinventory',
    summary: 'SEO inventory (OG, robots, sitemap, manifest)',
    template:
      'Run seo_inventory on [url] — check og:image, robots.txt, sitemap, manifest, favicon, canonical, and JSON-LD.',
    example:
      'Run seo_inventory on https://acme.com — check og:image, robots.txt, sitemap, manifest, favicon, canonical, and JSON-LD.',
  },
  {
    slash: '/ssl',
    summary: 'Check SSL certificate',
    template: 'Check SSL certificate for [domain].',
    example: 'Check SSL certificate for acme.com.',
  },
  {
    slash: '/links',
    summary: 'Check broken links on a site',
    template: 'Check for broken links on [url].',
    example: 'Check for broken links on https://acme.com.',
  },
  {
    slash: '/dns',
    summary: 'DNS and email auth check',
    template: 'Run DNS check for [domain].',
    example: 'Run DNS check for acme.com.',
  },
  {
    slash: '/techstack',
    summary: 'Detect tech stack (Wappalyzer-style)',
    template: 'What is [url] built with? Detect the tech stack.',
    example: 'What is https://acme.com built with? Detect the tech stack.',
  },
];
