# Anton Mode — Demand Pulse + Menu Knowledge (2026-06-15)

Full-office push: LLM council (DeepSeek + Gemini + home-lab Luna roundtable) + a
12-researcher fleet (best practices, per-source feasibility for Seaside OR,
creative + 2 wild cards) → synthesized build plan. This records what shipped and
the prioritized backlog.

## Core principle (council consensus)
**"Sunny is the baseline, not a signal."** The old pulse ("sunny → push happy
hour") was a weather report with a prompt. The redesign is an **exception
reporter**: most nights one calm line; it earns its keep on the ~30% of nights
where something's different. Format = **one volume band (SLOW/STEADY/BUSY/PACKED)
+ one plain-English why (the single biggest driver) + one 2-second action.**
Luna *phrases*; deterministic code *decides the band* (auditable, reproducible).

## SHIPPED (live, verified in harness)
- **Pulse engine in the bridge** (`luna_iggys_bridge.py`, `--pulse` + idle-tick
  cadence every `LUNA_PULSE_SECONDS`/4h). Deterministic `compute_pulse()` =
  weekday × season baseline, modulated by:
  - **Weather** (Open-Meteo Seaside): sunny+warm ↑, cold/rain/wind-gusts ↓.
  - **Portland heat-escape spread** (2nd Open-Meteo pull): inland ≥18°F hotter +
    coast sunny → ↑ ("inlanders flee to the coast"). *Verified catching 93°F PDX
    vs 75°F coast live.*
  - **Seaside Convention Center** events (public Tribe JSON API
    `/wp-json/tribe/events/v1/events`): public convention in town ↑; private/
    closed → little lift.
  - **Holidays** (major US holidays, computed).
  Luna gets the computed band + drivers + sunset + candidate specials and writes
  the 2-line read + a one-tap `ACTION` → a `kind='pulse'` `luna_insights` row.
- **Dashboard pulse card** (`TodaysPulse.tsx`): pins the latest `kind='pulse'`
  read — band pill (color by band) + Luna's read + one-tap action button
  (routes via the existing Luna handoff: draft_special→editor, add_todo→todos,
  etc.). Falls back to the old line if no pulse yet. Pulse excluded from the
  Luna insights feed + the nav "new" badge.
- **Menu/allergen knowledge** (`MENU_POLICY` in the bridge, injected into every
  question prompt): the food is already in Supabase (bridge injects cocktails +
  menu_items). Added the authoritative **Dooger's GF policy** (most items can be
  made GF on request; clam chowder is GF as-served; never a 100% guarantee →
  flag severe allergies to the kitchen), the veg/vegan name-level markers, happy
  hour ($5 drafts/$5 wells/$3 cans, 3-5pm daily), and the signature cocktails.
  Sourced from doogersseafood.com + iggysseaside.com.

## BACKLOG (prioritized by the fleet)
**NEXT (high value, feasible):**
- Owner/manager **3-button close-out** (packed/normal/dead) → seeds actuals.
- **Forecast-vs-actual trust loop** + "last 7 nights within X%" badge (turns the
  forecast into a number staff trust; re-weights multipliers).
- **Weather-pivot live alert** ("your night just changed") over the PWA push rail.
- **Visit Seaside / city events** overlay (festivals, Sandcastle, parades).
- **Day/holiday themed-special** library (National X Day → matched cocktail).
- **Mega-event surge table** (Beach Volleyball ~40k, Hood to Coast, Sandcastle,
  July 4) — owner-seeded date ranges that hard-override to PACKED.

**LATER (needs data/maturity):**
- ODOT TripCheck Seaside camera (`Seaside_pid652`) + US-26/101 incidents; AirNow
  AQI demand-killer override; NOAA tides; Astoria cruise-ship calls.
- **Same-weekday POS baseline** + "tonight looks like last July 12" kNN +
  dollar-framed predictive staffing — the real foundation, needs 6-12 mo POS
  history. **Start logging actuals now** (the close-out above).

**SKIP (council unanimous):** traffic-cam pixel CV, OTA room scraping, paid
occupancy APIs, gas prices, Reddit chatter — poor signal/effort for one bar.

## WOW ideas worth doing (creative + wildcard)
"Who's in town" cohort vibe (convention → crowd behavior → which special);
golden-hour deck card; auto-drafted special graphic + caption from the forecast;
competitor-closed spillover alert (OpenTable availability drop → +15%); Luna's
own accuracy scorecard.

Research artifacts: roundtable in /tmp/roundtable-20260615-*, fleet output in the
workflow transcript; substrate notes 416 (council) + the build note.
