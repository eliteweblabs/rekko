import type { ReavePlugin } from '../_shared/types';
import { carddavHelperCommands } from './helperCommands';

/** CardDAV sync — knowledge only (no agent tools). */
export const carddavPlugin: ReavePlugin = {
  id: 'carddav',
  feature: 'carddav',
  helperCommands: carddavHelperCommands,
};
