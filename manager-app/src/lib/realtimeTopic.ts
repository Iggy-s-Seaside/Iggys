/**
 * uniqueTopic — a per-subscription Supabase Realtime channel name.
 *
 * Supabase keys realtime channels by name PER CLIENT. If two components mount the
 * same hook (e.g. the unread-count badge in BOTH the Sidebar and the BottomNav, or
 * a page and its create-modal both using the same data hook), two `.channel('foo')`
 * calls with the SAME name collide: the second `.subscribe()` can be dropped, and
 * when one component unmounts its `removeChannel('foo')` tears down the channel the
 * other is still using. Deriving a unique name per subscription avoids both.
 *
 * The counter guarantees uniqueness across concurrent mounts; the timestamp guards
 * against remounts within the same tick.
 *
 * This consolidates the `uniqueTopic` helper previously copy-pasted into
 * useParties / useLuna / useLunaChronicle / useWeatherWatch — import this instead.
 */
let channelSeq = 0;

export const uniqueTopic = (base: string): string =>
  `${base}-${++channelSeq}-${Date.now()}`;
