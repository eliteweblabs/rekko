import { vapiModule } from './agentTools';
import type { ReavePlugin } from '../_shared/types';
import { vapiHelperCommands } from './helperCommands';

export const vapiPlugin: ReavePlugin = {
  id: 'vapi',
  feature: 'vapi',
  agentTools: vapiModule,
  helperCommands: vapiHelperCommands,
};
