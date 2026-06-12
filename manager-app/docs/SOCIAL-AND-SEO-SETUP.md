# Social + SEO Setup — owner checklist + what to hand back

These three need the **owner's logins / business identity**, so they're yours to set up — but here's the exact, minimal path, and what to give me afterward so I wire it up. Ordered by impact.

---

## 1. Google Business Profile — START TODAY (biggest local-search lever)
This is what puts Iggy's at the **top of Google + the Maps pack** for "bar in Seaside Oregon." Bigger than any on‑site change. Verification can take days (postcard), so start now.

1. Go to **google.com/business** → sign in with the **bar's** Google account (ideally `iggysbarevents@gmail.com`, so the business owns it — not a personal account).
2. Search **"Iggy's Seaside Bar."** A listing likely already exists (Google auto‑creates them) → **claim it** ("Own this business?"). If none exists, create it.
3. **Verify** (Google sends a code by postcard / phone / video). Postcard = several days → do this first.
4. **Optimize** (these are the ranking factors):
   - Primary category **Bar**; add **Restaurant**, **Event venue**.
   - **NAP must EXACTLY match the website:** Iggy's Seaside Bar · 200 S Franklin St, Seaside, OR 97138 · (503) 738‑0672 · iggysseaside.com
   - Full hours, lots of **photos** (exterior, interior, food, drinks), attributes, menu link, keyword‑rich description.
   - Set the **bookings/appointment URL** to `https://iggysseaside.com/book`.
   - **Reviews** — ask happy guests, respond to every one. The #1 ongoing lever.
- **Hand me:** nothing technical — GBP lifts ranking by simply existing + being optimized.

---

## 2. Show his Instagram on the website — QUICK WIN (no Meta app/review)
For the demo era, the fastest way to put his posts on the site:
1. Owner goes to **behold.so** (free tier; or LightWidget / Elfsight) → connects Iggy's Instagram once (logs in, authorizes).
2. It produces a **feed ID / embed snippet**.
3. **Hand me the Behold feed ID** → I'll add a "Latest from Instagram" section to the site (home + a social block) this week.
- Note: **Stories (24h) aren't embeddable** anywhere — this shows recent **posts/reels**, which is the realistic "his social on the site."

---

## 3. Post to Facebook/Instagram from the app — BIGGER (Meta App Review, ~weeks)
Real project, gated by Meta. Prereqs (owner‑side):
1. A **Facebook Page** for Iggy's (create if none).
2. Instagram set to a **Business/Creator account** and **linked to the Page** (IG app → Settings → switch to professional; link the Page in Meta Business Suite).
3. Both inside a **Meta Business Portfolio** (business.facebook.com).
Then (I'll guide / build the integration):
4. Create a **Meta developer app** (developers.facebook.com) → Business type → add **Instagram** + **Facebook Login for Business**.
5. Get the **Instagram Business Account ID** + a **long‑lived access token**.
6. **App Review** for `instagram_content_publish` + `pages_manage_posts` — needs a privacy‑policy URL + screencast; Meta approval typically **1–3+ weeks**. (Stories publishing via API is restricted; feed posts/reels are the supported path.)
- **Hand me (securely, NOT in chat):** the IG Business Account ID + long‑lived token → we store the token as a Supabase secret via the **same secure handoff we used for the Calendar token** (you paste it in the dashboard / run a command; it never appears in chat).

---

## On my side (no accounts needed — already done / can do now)
- ✅ On‑page SEO: titles, descriptions, Twitter cards, canonical, **LocalBusiness JSON‑LD + ReserveAction → /book**, robots.txt, sitemap.xml.
- ⏭️ Once you send the **Behold feed ID**, I'll add the IG feed section to the site.
- ⏭️ Once the **FB Page + IG Business** are linked and the token's in hand, I'll build the in‑app posting + the feed integration via the official API.
- ⏭️ Bigger SEO: prerendering/SSR for the SPA so crawlers get full HTML (improves ranking) — a follow‑up.
