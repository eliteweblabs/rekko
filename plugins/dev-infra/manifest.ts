import { devInfraModule } from './agentTools';
import type { ReavePlugin } from '../_shared/types';
import { devInfraHelperCommands } from './helperCommands';

export const devInfraPlugin: ReavePlugin = {
  id: 'dev-infra',
  feature: 'dev_infra',
  agentTools: devInfraModule,
  helperCommands: devInfraHelperCommands,
};
