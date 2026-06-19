# Hands+Eyes QA Findings — captured during Wave 3 build

Live site `iggysmanagement.netlify.app` (wave-2 deploy), real Firefox, logged in as bradleybird3, exercised via luna-eye `bin/hid` + `bin/screenvision` (touch/keyboard emulation). 2026-06-14.

## ✅ Verified working live
- **Cmd+K command palette** (wave 2): opens, fuzzy-filters ("calend"→Calendar), arrow/enter navigation routes correctly. Quick Actions + Go To groups render clean in light mode.
- **Palette → New Party** quick action fires `CMD_NEW_PARTY` → opens the QuickAddParty sheet (validates the DashboardLayout integration end-to-end).
- **Dashboard**: "Needs your attention" triage, stat cards (correctly shows 0 Active Specials — the Slushie Hour draft is inactive), live Luna morning-briefing card, Quick Actions, Upcoming Events, Low-Stock ("all above par"), Messages, To-Do.
- **Calendar**: live Google Calendar agenda (They Educator Event Jun 15; Tracy McClean Jul 30) + Upcoming parties. (Wave 3 Agent E adds the month grid.)
- **Reports**: Trend chart, Revenue-by-space, Space breakdown, Inquiry funnel — all $0 (no confirmed parties yet) but structure is solid. (Wave 3 Agent D adds export.)
- **Luna (in-app)**: WORKING and excellent. Context-aware conversation about the Jun 20 Satan's Pilgrims show — stocking advice (PBR/Hamm's tallboys for surf-rock crowd), a "Surf Break" shot+beer combo suggestion, staffing/turnaround notes. The bridge is live and genuinely expert.

## 🐞 Friction / bugs to fix (feed wave 4)
1. **QuickAddParty modal dismisses on outside click and loses typed data.** A stray click closed it mid-entry. Should confirm-before-discard if the form is dirty, or not close on backdrop click when dirty. (Backlog: form resilience.)
2. **Native `<input type="date">` in QuickAddParty** is clunky (and a known hands-emulation gap). Consider a branded date picker or at least `inputMode`/masking; also a "smart default" date (Reservations' `defaultReservedFor()` already does this — port it here per backlog quick-win).
3. Luna morning-briefing card mentioned "the bridge script errored" — worth a glance at the PC1 bridge daemon health (not app-side; out of this wave's scope but log it).

## Notes
- Did NOT create the test party row (modal closed before submit) — no orphan data. The "Slushie Hour" special draft from earlier remains the one created artifact (inactive, unpublished, no price).
- No emails sent, no prices changed, no menu touched. All QA stayed within the hard NOs.
