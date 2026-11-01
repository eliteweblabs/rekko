/**
 * Self-contained Reave plugin contract.
 *
 * Each plugin repo (or `plugins/{id}/` in this monorepo) owns:
 * - bundled knowledge under `knowledge/`
 * - optional agent tools under `agentTools.ts`
 * - feature gate + service env check
 *
 * Reave core loads only enabled plugins — no duplicate knowledge in src/knowledge/.
 */
import type { FeatureId } from '../../src/lib/features';
import type { AgentToolModule } from '../../src/lib/agentTools/types';

export interface ReavePlugin {
  /** Directory name under plugins/, e.g. billing, dev-infra */
  id: string;
  /** Optional module id. Omit for always-on core plugins (Clerk). */
  feature?: FeatureId;
  /** When set, module is "fully configured" for deploy UI — not required to register agent tools. */
  configured?: () => boolean;
  agentTools?: AgentToolModule;
}
