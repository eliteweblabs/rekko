import type { ReavePlugin } from '../_shared/types';
import { isEmailSendConfigured } from '../../src/lib/outbound';
import { emailInboxHelperCommands } from './helperCommands';

/** Inbound triage + admin Inbox tab (Resend receiving). */
export const emailInboxPlugin: ReavePlugin = {
  id: 'email-inbox',
  feature: 'email_inbox',
  configured: isEmailSendConfigured,
  helperCommands: emailInboxHelperCommands,
};
