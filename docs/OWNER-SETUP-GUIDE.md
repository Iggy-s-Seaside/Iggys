# Iggy's — Owner Setup Guide (the things only you can do)

Plain-English guide to the external accounts + credentials that unlock the "gated" features. The app is built and waiting on each of these — when you finish a step, hand me the credential the same secure way as the Google Calendar token (paste into the Supabase dashboard's secrets, never into chat) and I flip it on. Ordered by **lead time** (start the slow ones first).

---

## 1. Texting (SMS) — "Text when your table is ready" + promo texts
**What works today:** the waitlist's "Text table is ready" button and the marketing texter are fully built but **safe-stubbed** — they log the message and mark the guest "notified" without actually sending, until Twilio credentials exist.

**Two tiers:**
- **Trial (instant, for testing):** a free Twilio trial can text **only verified numbers**. I can verify your phone ([REDACTED]) and send you a real "table ready" text to prove the loop end-to-end. Trial numbers can't text customers and get carrier-filtered, so it's for validation only.
- **Production (real customers) — A2P 10DLC registration (needed before texting guests):**
  1. Create/confirm the Twilio account for Iggy's.
  2. Twilio Console → **Trust Hub** → register the **Brand** (sole-proprietor or standard; needs Iggy's legal name, address *200 S Franklin St, Seaside OR 97138*, EIN).
  3. Register a **Campaign** — use case "Low-Volume Mixed / Marketing." (~$4 one-time + ~$1.50/mo + a fraction of a cent per text.)
  4. Buy/assign a local **phone number** to the campaign.
  5. Hand me the 4 secrets → I set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`, `SMS_ENABLED=true`. Texting goes live with **zero code changes**.
  - Approval takes ~1–3 business days, so start this early. **STOP/HELP** opt-out handling is required and already designed in.

> My recommendation: let me set up the **trial + verify your number now** so you can feel the "table ready" text this week; you register the A2P brand in parallel for go-live.

---

## 2. Marketing emails — growing the list + sending
**Today:** the website collects **zero** email signups, and (important) your booking/contact forms save leads **without marketing consent**, so they're legally un-emailable. The campaign composer "sends" to a count but there's no email provider wired.

**What I'm building this sprint:** a consent-gated **"Get the inside scoop" email + SMS signup** on the site (separate checkboxes, proper consent text, an unsubscribe link), writing real opt-ins + a consent log. That's the highest-ROI fix — it gives you a list to market to.

**What you do:** pick an email sender — I recommend **Resend** (cheapest, one domain verification, great deliverability for a small list). Steps:
1. Create a Resend account; verify the sending domain (e.g. `mail.iggysseaside.com`) with the DNS records it gives you.
2. Hand me `RESEND_API_KEY` + the from-address → I set `RESEND_API_KEY`, `MARKETING_FROM` and wire the campaign "Send" button to it. I can test campaigns to **[REDACTED]** first.

---

## 3. Google Ads — the real marketing plan
You already have first-party **conversion tracking plumbing** (funnel events + Microsoft Clarity). To run ads:
1. Create a **Google Ads** account; create a **Conversion action** for "Booking submitted" (and "Newsletter signup") → it gives you an `AW-XXXXXX/label`.
2. Hand me the `AW-` ID → I drop in gtag.js (guarded by an env var, same pattern as Clarity) and fire a **conversion event** on the high-intent actions you already emit. Now Google can optimize toward real bookings.
3. Turn on Clarity: give me `VITE_CLARITY_ID` and you get session replay + heatmaps of the booking funnel (already built, inert until set).

A full **Seaside-targeted Google Ads campaign plan** (campaign structure, keywords, geo radius, budget tiers, ad copy, landing pages) is a separate deliverable doc I'm writing — `docs/GOOGLE-ADS-PLAN.md`.

---

## 4. Reviews — where they come from
**Today:** the reviews page is empty — the auto-sync is an honest stub with no Google credentials, and your public "leave us a review" link still points at a **placeholder** Place ID.
- **This sprint (no waiting):** I'm adding **manual review entry** so you can paste in any Google/Yelp/FB review today and it shows on the wall.
- **Real auto-sync:** needs **Google Business Profile** API access (OAuth) + your real Google **Place ID**. Send me your Google Business listing URL and I'll extract the Place ID + fix the outbound review link; the OAuth tokens are the same handoff as Calendar.

---

## 5. Instagram / Facebook auto-posting (Meta) — **NOT submitted yet**
You asked: no, nothing's been sent to Meta. The in-app social composer drafts posts but is gated off until a Meta app is approved.

**Quick win this week (zero Meta review):** connect Iggy's IG once at **behold.so** (free) and hand me the feed ID — I'll embed your **live Instagram feed on the website**. Instant social proof, no app needed.

**Full auto-posting — owner submission checklist (start ASAP, longest lead time):**
1. Create/confirm a **Facebook Page** for Iggy's (business account, not personal).
2. In Instagram: Settings → switch to a **Professional (Business)** account → **link it to that Page**.
3. At **business.facebook.com**: create a **Business Portfolio** containing the Page + IG; complete **Business Verification** (legal name, address, EIN/utility doc — can take days).
4. At **developers.facebook.com**: create a **Business**-type App; add products **Instagram** (Graph) + **Facebook Login for Business**.
5. Host a **Privacy Policy** + **Data Deletion** URL (I'll ship these on iggysseaside.com — they're App-Review requirements).
6. **App Review** → request `instagram_content_publish` + `pages_manage_posts` (+ `pages_read_engagement`, `pages_show_list`). I'll prep a screencast of the draft→approve→publish flow against a test build.
7. After approval: generate a long-lived **Page token** + **IG Business Account ID**.
8. Hand me the token + IDs → I set `IG_ACCESS_TOKEN`, `FB_PAGE_ID`, `IG_USER_ID`, `SOCIAL_PUBLISH_ENABLED=true`. Done.

**My side, in parallel:** implement the real Graph publish calls, add the auto-post cron + a "Publish now" button, and ship the privacy/data-deletion pages — so the moment Review approves, going live is just pasting secrets.

---

## 6. Getting it on phones & iPads
It's an installable app (PWA). I'm fixing the home-screen icon (currently broken), adding an in-app **"Install this app"** helper for iOS, and a printable **QR code** + **employee logins** so staff just scan, install, and sign in to their limited view. No App Store needed.

---

### TL;DR — what to send me when you can
- Twilio: let me set up the trial + verify your number now; you start the A2P brand registration.
- Resend API key + from-address (for email campaigns).
- Google Ads `AW-` conversion ID + `VITE_CLARITY_ID`.
- Your Google Business listing URL (for Place ID + reviews).
- behold.so IG feed ID (instant website IG embed).
- Kick off Meta steps 1–3 today (Business Verification is the bottleneck).
