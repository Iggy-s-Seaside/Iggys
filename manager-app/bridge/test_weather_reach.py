"""Verify the Python worth-bar matches the app's verified TS logic (the cases that
guard the honesty rules). Run: python3 bridge/test_weather_reach.py"""
from datetime import datetime, timedelta
from weather_reach import compute_weather_flags, reach_concern_key, js_weekday, _day_start

NOW = datetime(2026, 6, 19, 14, 0, 0)  # Fri 2pm


def D(n):
    return (NOW + timedelta(days=n)).strftime("%Y-%m-%d")


FRI, SAT, SUN = D(0), D(1), D(2)


def day(date, high, precip, code=0):
    return {"date": date, "weekday": js_weekday(_day_start(date).date()),
            "high": high, "precip": precip, "code": code}


def party(**over):
    base = {"id": 1, "status": "confirmed", "event_date": SAT, "start_min": 19 * 60,
            "guest_count": 30, "contact_name": "Henderson", "company": None, "space_name": None,
            "special_requests": None, "food_notes": None, "drink_notes": None, "internal_notes": None}
    base.update(over)
    return base


passed = failed = 0


def check(name, cond):
    global passed, failed
    if cond:
        passed += 1
        print(f"  ✓ {name}")
    else:
        failed += 1
        print(f"  ✗ FAIL: {name}")


def flags(**kw):
    kw.setdefault("now", NOW)
    kw.setdefault("daily", [])
    kw.setdefault("parties", [])
    kw.setdefault("staffing", {})
    kw.setdefault("demand", {})
    return compute_weather_flags(kw["now"], kw["daily"], kw["parties"], kw["staffing"], kw["demand"])


def kinds(fs):
    return [f["kind"] for f in fs]


# 1. rain × outdoor party
f = flags(daily=[day(SAT, 68, 75)], parties=[party(special_requests="cocktails on the deck")])
check("rain x outdoor party fires move-indoors", any(x["kind"] == "rain_party_indoor" for x in f))
check("message names 75% + party", f and "75% rain" in f[0]["message"] and "Henderson" in f[0]["message"])

# 2. indoor party (no keyword) -> no move-indoors
f = flags(daily=[day(SAT, 68, 75)], parties=[party(space_name="upstairs", internal_notes="normal setup")])
check("indoor party: no move-indoors", "rain_party_indoor" not in kinds(f))

# 3. office fix: garden salad in food_notes must NOT fabricate outdoor
for note, label in [("Garden salad to start", "garden salad"),
                    ("outside catering by an outside vendor", "outside catering"),
                    ("beachside garnish on the spritz", "beachside garnish (drink_notes)")]:
    fld = {"drink_notes": note} if "drink" in label else {"food_notes": note}
    f = flags(daily=[day(SAT, 68, 75)], parties=[party(space_name="upstairs", **fld)])
    check(f"{label}: no fabricated move-indoors", "rain_party_indoor" not in kinds(f))

# 4. 40% rain below washout bar
f = flags(daily=[day(SAT, 68, 40)], parties=[party(special_requests="deck")])
check("40% rain does not fire", "rain_party_indoor" not in kinds(f))

# 5. heat x understaffed
f = flags(daily=[day(SAT, 84, 10)], staffing={SAT: {"foh": 1, "baseline": 3}})
check("heat x understaffed fires", any(x["kind"] == "heat_understaffed" for x in f))
check("message names 84 + only 1", f and "84" in f[0]["message"] and "only 1" in f[0]["message"])

# 6. no schedule (baseline None) -> silent
f = flags(daily=[day(SAT, 84, 10)], staffing={SAT: {"foh": 0, "baseline": None}})
check("no-schedule stays silent", "heat_understaffed" not in kinds(f))

# 7. adequate staffing -> silent
f = flags(daily=[day(SAT, 84, 10)], staffing={SAT: {"foh": 4, "baseline": 3}})
check("adequate staffing silent", "heat_understaffed" not in kinds(f))

# 8. rain x deck (warm weekend)
f = flags(daily=[day(SAT, 72, 80)])
check("rain x deck plan fires", any(x["kind"] == "rain_deck" for x in f))

# 9. SLOW suppresses deck
f = flags(daily=[day(SAT, 72, 80)], demand={SAT: "SLOW"})
check("deck suppressed when SLOW", "rain_deck" not in kinds(f))

# 10. cold weekend -> no deck
f = flags(daily=[day(SAT, 55, 80)])
check("cold day no deck flag", "rain_deck" not in kinds(f))

# 11. dedup action over plan
f = flags(daily=[day(SAT, 72, 80)], parties=[party(special_requests="deck party")])
check("deck plan deduped when party action exists",
      "rain_party_indoor" in kinds(f) and "rain_deck" not in kinds(f))

# 12. beyond 48h -> silent
f = flags(daily=[day(D(5), 68, 80)], parties=[party(event_date=D(5), special_requests="deck")])
check("beyond-window party silent", len(f) == 0)

# 13. late same-day (Sat 10pm) -> day-level flags silent
late = datetime(2026, 6, 20, 22, 0, 0)
f = compute_weather_flags(late, [day(SAT, 84, 80)], [], {SAT: {"foh": 1, "baseline": 3}}, {})
check("late-night today: no heat flag", "heat_understaffed" not in kinds(f))
check("late-night today: no deck flag", "rain_deck" not in kinds(f))

# 14. reach concern key
check("concern key format", reach_concern_key({"kind": "rain_party_indoor", "date": SAT}) == f"weather:rain_party_indoor:{SAT}")

print(f"\n── {passed} passed, {failed} failed ──")
import sys
sys.exit(1 if failed else 0)
