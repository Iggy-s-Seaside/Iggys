import { supabase } from './supabase';
import type { TemplateCategory } from '../types';

async function requireSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated. Please log in again.');
  return session;
}

export interface SendPartyEmailArgs {
  to: string;
  subject: string;
  body: string;
  partyId?: number;
  kind: TemplateCategory;
}

/** Send a party email (follow-up / confirmation / cancellation) via the Gmail-backed edge function. */
export async function sendPartyEmail(args: SendPartyEmailArgs) {
  await requireSession();
  const { data, error } = await supabase.functions.invoke('send-party-email', { body: args });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { success: boolean; gmailMessageId?: string };
}

export interface CalendarSyncResult {
  eventId?: string;
  htmlLink?: string;
  deleted?: boolean;
}

/** Create / update / delete a party's event on the bar's Google Calendar. */
export async function syncPartyCalendar(
  action: 'create' | 'update' | 'delete',
  partyId: number
): Promise<CalendarSyncResult> {
  await requireSession();
  const { data, error } = await supabase.functions.invoke('google-calendar', {
    body: { action, partyId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as CalendarSyncResult;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string; // ISO datetime or date
  end: string;
  allDay?: boolean;
  htmlLink?: string;
}

/** List upcoming events from the bar's Google Calendar (for the in-app agenda). */
export async function listCalendarEvents(timeMin: string, timeMax: string): Promise<CalendarEvent[]> {
  await requireSession();
  const { data, error } = await supabase.functions.invoke('google-calendar', {
    body: { action: 'list', timeMin, timeMax },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return (data?.events ?? []) as CalendarEvent[];
}
