import {
  AGENT_HELPER_COMMANDS,
  type AgentHelperCommand,
} from './agentHelperCommands';
import { activePluginHelperCommands } from './pluginRegistry';
import { isBraveConfigured } from './braveClient';
import {
  enabledFeatures,
  hasEmailInbox,
  hasFeature,
  hasDigitalSignature,
  type FeatureId,
} from './features';
import { isEmailSendConfigured } from './outbound';
import { isTodoDbConfigured } from './todoStore';

/** Env / DB gates for core commands that share tool-module enablement. */
const RUNTIME_HELPER_GATES: Partial<Record<string, () => boolean>> = {
  '/todo': () => isTodoDbConfigured(),
  '/todo-add': () => isTodoDbConfigured(),
  '/send': () => hasEmailInbox() && isEmailSendConfigured(),
  '/web': () => isBraveConfigured(),
};

function allHelperCommands(): AgentHelperCommand[] {
  return [...AGENT_HELPER_COMMANDS, ...activePluginHelperCommands()];
}

export function isHelperCommandEnabled(cmd: AgentHelperCommand): boolean {
  const gate = RUNTIME_HELPER_GATES[cmd.slash];
  if (gate && !gate()) return false;

  const feature = cmd.feature ?? 'core';
  if (feature === 'core') return true;
  return hasFeature(feature as FeatureId);
}

export function listEnabledHelperCommands(): AgentHelperCommand[] {
  return allHelperCommands()
    .filter(isHelperCommandEnabled)
    .map((cmd) => {
      if (cmd.slash === '/document' && hasDigitalSignature()) {
        return {
          ...cmd,
          summary: 'Send a document signing link',
          template: 'Send document [template] to [client] for signing.',
          example: 'Send document service-agreement to Acme Corp for signing.',
        };
      }
      return cmd;
    });
}

export function enabledFeatureIds(): FeatureId[] {
  return [...enabledFeatures()];
}
