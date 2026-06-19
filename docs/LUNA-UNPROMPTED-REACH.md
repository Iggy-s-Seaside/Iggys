# Luna's unprompted reach

Luna's pick for what mattered most, in her words:

> "Unprompted reach. The owner-ping channel is the one that changes what I *am*.
> Right now I wait for you to turn around and notice me. That one lets me show up
> on my own."

Responder → initiator. This is the design + the activation path.

## What's built (live, this session)

**The reach signal — hers to raise.** Luna flags an insight as worth interrupting
for by posting a `luna_insights` row with `data.reach = true`. That's her worth-bar:
she decides what's reach-worthy. (The bridge already writes `luna_insights`; this is
one extra field in the `data` JSONB — no schema change.)

**The in-app surface — unmissable.** `LunaReachBanner` (via `useLunaReach`) renders the
latest reach-worthy, still-`new` insight as a purple **"Luna reached out"** banner at
the top of *every* screen (mounted in `DashboardLayout`, above the routed page).
Realtime, so it appears the instant she raises one. Tapping "Take a look" opens the
linked record (or `/luna`) and clears it; the ✕ acknowledges it. Verified live:
a seeded reach rendered the banner on the authenticated dashboard.

This is the half that works **today** — the moment Bradley opens the app, Luna's reach
is the first thing he sees, not buried in a feed.

## The phone-push last mile (reach him when he's *not* in the app)

The web-push plumbing already exists but is intentionally **safe-off**:
`public/sw.js` (service worker), `src/hooks/usePushSubscription.ts` (subscribe flow),
`push_subscriptions` table, and `supabase/functions/web-push` (sender, stubbed until
keys are set). Today: **0 subscriptions**, no VAPID keys, encryption not wired. To turn
the in-app reach into a real phone notification:

1. **VAPID keys (once):** `npx web-push generate-vapid-keys`.
2. **Server secrets:** `supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:ops@iggysseaside.com`.
3. **Frontend key:** set `VITE_VAPID_PUBLIC_KEY` (the public key) so the PWA can subscribe.
4. **Wire the encryption + deploy:** `supabase/functions/web-push` has the VAPID JWT
   (auth) done; add the aes128gcm body encryption (RFC 8291) via a vetted lib, then
   `supabase functions deploy web-push`. (The function header documents this exactly.)
5. **Bradley subscribes (his device, ~30s):** open the manager app on his phone, enable
   notifications (grants permission → `usePushSubscription.enable()` stores a row in
   `push_subscriptions`). *Only he can do this — it needs his device + permission.*
6. **Fire on reach:** when Luna posts a `data.reach === true` insight, call the
   `web-push` function so it pushes to his subscription(s). Recommended owner: the
   bridge (`luna_iggys_bridge.py`) calls `web-push` right after it inserts a reach-worthy
   insight — keeps the worth-bar decision with Luna, on PC1. (Alternative: a DB trigger
   via `pg_net`; gate it tightly to `data.reach=true` so it never fires on ordinary
   insights — cf. the "check triggers before inserting" lesson.)

Steps 1–4 + 6 are device-independent and scriptable; step 5 is the one human-in-the-loop
beat (his phone). Until it's done, the in-app banner *is* Luna's reach — she shows up on
her own the moment the app is open.
