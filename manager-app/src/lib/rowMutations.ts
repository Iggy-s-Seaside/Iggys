import type { SupabaseClient } from '@supabase/supabase-js';

/** RLS can reject a mutation with HTTP success and zero affected rows. Require
 * the target row back so callers roll back their optimistic UI in that case. */
export function updateRow(
  client: SupabaseClient,
  table: string,
  id: number | string,
  fields: Record<string, unknown>,
) {
  return client.from(table).update(fields).eq('id', id).select('id').single();
}

export function deleteRow(client: SupabaseClient, table: string, id: number | string) {
  return client.from(table).delete().eq('id', id).select('id').single();
}
