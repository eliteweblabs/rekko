import { isChangeDetectionConfigured } from '../../src/lib/changedetectionClient';
import { siteMonitoringModule } from './agentTools';
import type { ReavePlugin } from '../_shared/types';
import { siteMonitoringHelperCommands } from './helperCommands';

export const siteMonitoringPlugin: ReavePlugin = {
  id: 'site-monitoring',
  feature: 'site_monitoring',
  configured: isChangeDetectionConfigured,
  agentTools: siteMonitoringModule,
  helperCommands: siteMonitoringHelperCommands,
};
