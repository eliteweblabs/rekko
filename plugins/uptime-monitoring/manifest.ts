import { isUptimeRobotConfigured } from '../../src/lib/uptimerobotClient';
import { uptimeModule } from './agentTools';
import type { ReavePlugin } from '../_shared/types';
import { uptimeMonitoringHelperCommands } from './helperCommands';

export const uptimeMonitoringPlugin: ReavePlugin = {
  id: 'uptime-monitoring',
  /** Bundled with Sites (`analytic_audit`) via FEATURE_REQUIRES. */
  feature: 'uptime_monitoring',
  configured: isUptimeRobotConfigured,
  agentTools: uptimeModule,
  helperCommands: uptimeMonitoringHelperCommands,
};
