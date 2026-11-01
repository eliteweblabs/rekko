import { siteAuditsModule } from './agentTools';
import type { ReavePlugin } from '../_shared/types';
import { siteAuditsHelperCommands } from './helperCommands';

export const siteAuditsPlugin: ReavePlugin = {
  id: 'site-audits',
  feature: 'site_audits',
  agentTools: siteAuditsModule,
  helperCommands: siteAuditsHelperCommands,
};
