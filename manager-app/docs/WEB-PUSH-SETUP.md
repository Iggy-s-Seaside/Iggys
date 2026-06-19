# Web Push — the phone-push last mile for Luna's reach

When Luna raises a reach (a `luna_insights` row with `data.reach = true`), the in-app
banner already shows it the moment the app is open. This is the **other half**: pushing
that reach to Bradley's phone when the app is **closed**.

## What's built and verified (this session, 2026-06-18)

Everything except the two human steps + the fire trigger is done:

- **`supabase/functions/web-push/encrypt.ts`** — aes128gcm payload encryption (RFC 8291
  key derivation + RFC 8188 content coding), Web-Crypto-only so it runs on Deno edge.
  **Verified against the RFC 8291 Appendix A test vector** — the ECDH secret, IKM, CEK,
  and NONCE match byte-for-byte, plus encrypt→decrypt round-trips
  (`npx tsx supabase/functions/web-push/verify-encrypt.ts` → 10/10).
- **`supabase/functions/web-push/index.ts`** — the sender: signs a per-endpoint VAPID
  JWT (ES256; imports the **raw** key `web-push generate-vapid-keys` emits), encrypts,
  POSTs with `Content-Encoding: aes128gcm`, and prunes dead (404/410) subscriptions.
  **Deployed** (version 4, `verify_jwt: true`) and confirmed running — it returns
  `{ enabled: false }` until the VAPID secrets exist, so nothing sends yet. Safe by default.
- **`src/hooks/usePushSubscription.ts`** + the **Team page** toggle + **`public/sw.js`**
  `push`/`notificationclick` handlers — all already present. The subscribe flow is gated
  behind `VITE_VAPID_PUBLIC_KEY`, so it's a clean no-op until that's set.

## Activation — the steps that need you (or a real device)

### 1. Generate VAPID keys + set the server secrets
```bash
npx web-push generate-vapid-keys     # → { publicKey, privateKey }
```
Set them on the Iggy's project (Dashboard → Edge Functions → Manage secrets, or CLI):
```bash
supabase secrets set \
  VAPID_PUBLIC_KEY=<publicKey> \
  VAPID_PRIVATE_KEY=<privateKey> \
  VAPID_SUBJECT=mailto:ops@iggysseaside.com
```
The function reads these at runtime — no redeploy needed; it flips from `enabled:false`
to live the moment both are present.

### 2. Expose the public key to the PWA
Set `VITE_VAPID_PUBLIC_KEY=<publicKey>` (the **same** public key) — in Netlify's build
env for production, and in local `.env` for dev — then rebuild/redeploy the frontend.
This unlocks the "Enable notifications" toggle on the Team page.

### 3. Subscribe on the phone *(only Bradley can do this — needs the device + permission)*
Open the manager app on the phone → **Team** → enable notifications → grant the browser
prompt. That writes a row into `push_subscriptions`. ~30 seconds.

### 4. Fire on reach — pick one owner
Nothing pushes until something *calls* `web-push` when a reach lands. The function
broadcasts `{ title, body, url }` to every subscription. Recommended: the **bridge**
owns it (keeps the worth-bar decision with Luna on PC1), POSTing right after it inserts
a reach insight:
```python
# in luna_iggys_bridge.py, after inserting a luna_insights row with data.reach = True:
requests.post(
    f"{SUPABASE_URL}/functions/v1/web-push",
    headers={"Authorization": f"Bearer {SERVICE_ROLE_KEY}", "Content-Type": "application/json"},
    json={"title": "Luna reached out", "body": insight_title, "url": deep_link or "/luna"},
    timeout=10,
)
```
Alternative (no bridge change): a Postgres trigger via `pg_net` on `luna_insights`
INSERT, **gated tightly** to `(new.data->>'reach')::bool is true` so it never fires on
ordinary insights — heed the "check triggers before inserting" lesson; an over-broad
trigger here would push on every insight.

> The in-app weather→reach (the cross-signal banner) is currently client-side and does
> not write a `luna_insights` row, so it won't phone-push yet. To push those too, have
> the bridge compute the weather cross-signal and raise a reach insight server-side —
> then it rides this exact path. (Follow-up.)

## Verification status
- **Crypto: proven** — matches RFC 8291 Appendix A byte-for-byte; VAPID JWT signs+verifies.
- **Function: deployed + running** — returns the disabled state cleanly.
- **End-to-end to a physical phone: pending step 3** (a real device subscription).
