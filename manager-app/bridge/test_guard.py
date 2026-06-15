"""Unit test for guard_draft — no model/DB needed. Exit 0 = all green."""
import sys
sys.path.insert(0, sys.argv[1] if len(sys.argv) > 1 else ".")
import luna_iggys_bridge as b  # noqa: E402

FAILS = []


def check(name, cond):
    print(("PASS" if cond else "FAIL"), name)
    if not cond:
        FAILS.append(name)


# The 2 real prod failures must be rejected.
ok, _, rej, _ = b.guard_draft("Hey Bradley. Something on your mind, or were you shaking off a pocket-dial?", "Peggy", "x")
check("pocket-dial draft rejected (owner)", (not ok) and any("owner" in r for r in rej))
ok, _, rej, _ = b.guard_draft("Ready when you are. What's next?", "Steve", "x")
check("standby draft rejected", (not ok) and "idle/standby phrase" in rej)

# A genuine reply passes and keeps its sign-off.
ok, fixed, rej, fl = b.guard_draft(
    "Hi Peggy, thanks so much for thinking of us! We love hearing about new music. "
    "I'll pass Jacquie Roar's name along to our events team. - Iggy's Seaside", "Peggy", "x")
check("good draft ok", ok and not rej)
check("good draft keeps sign-off", fixed.strip().endswith("- Iggy's Seaside"))

# Missing sign-off is auto-fixed (not rejected).
ok, fixed, rej, _ = b.guard_draft("Hi Bob, happy to help with dinner for the team. What time works for you?", "Bob", "x")
check("missing sign-off auto-fixed + ok", ok and fixed.strip().endswith("- Iggy's Seaside"))

# Unfilled placeholder is rejected.
ok, _, rej, _ = b.guard_draft("Hi [name], thanks for reaching out! - Iggy's Seaside", "X", "x")
check("placeholder rejected", (not ok) and "unfilled [placeholder]" in rej)

# Absolute allergen guarantee is rejected.
ok, _, rej, _ = b.guard_draft("Hi Sam, our kitchen is 100% gluten-free and completely safe for celiacs. - Iggy's Seaside", "Sam", "x")
check("allergen guarantee rejected", (not ok) and "absolute allergen guarantee" in rej)

# The ALLOWED gluten-free language must NOT trip the guard.
ok, _, rej, _ = b.guard_draft(
    "Hi Sam, many dishes can be made gluten-free on request, and our clam chowder is gluten-free as served. "
    "For a specific allergy, our kitchen can walk you through it. - Iggy's Seaside", "Sam", "x")
check("allowed GF language passes", ok and not rej)

# Persona/AI self-reference is rejected.
ok, _, rej, _ = b.guard_draft("Hi Sam, I am Luna and I'd be happy to help. - Iggy's Seaside", "Sam", "x")
check("persona leak rejected", (not ok) and "assistant/persona leak" in rej)

# An unexpected price is FLAGGED, not rejected.
ok, _, rej, fl = b.guard_draft("Hi Mel, the room runs $400 for the evening. - Iggy's Seaside", "Mel", "no figures here")
check("unexpected price flagged not rejected", ok and any("400" in f for f in fl))

# Happy-hour prices are allowed (no flag).
ok, _, rej, fl = b.guard_draft("Hi Mel, happy hour is $5 drafts and $3 cans, 3-5pm. - Iggy's Seaside", "Mel", "x")
check("happy-hour prices ok (no flag)", ok and not fl)

# Booking-confirmation language is flagged.
ok, _, rej, fl = b.guard_draft("Hi Mel, you're all set for September 22nd! - Iggy's Seaside", "Mel", "x")
check("booking-confirm flagged", ok and any("date" in f for f in fl))

# ── Adversarial-review fixes (false positives must NOT drop real customers) ──
# A customer who is literally named Bradley must get their reply.
ok, _, rej, _ = b.guard_draft("Hi Bradley, thanks for reaching out about a table this Friday! - Iggy's Seaside", "Bradley Smith", "x")
check("customer named Bradley NOT dropped", ok and not rej)
# But addressing the OWNER (customer isn't Bradley) is still rejected.
ok, _, rej, _ = b.guard_draft("Hey Bradley, this one looks like a party inquiry. - Iggy's Seaside", "Peggy", "x")
check("owner Bradley still rejected", (not ok) and "names the owner (Bradley)" in rej)
# A customer or cocktail named Luna must NOT be a persona-leak false positive.
ok, _, rej, _ = b.guard_draft("Hi Sam, the Luna cocktail is a great pick for the group! - Iggy's Seaside", "Sam", "x")
check("'Luna cocktail' NOT dropped", ok and not rej)
ok, _, rej, _ = b.guard_draft("Hi Luna, thanks so much for reaching out about your event! - Iggy's Seaside", "Luna Ortiz", "x")
check("customer named Luna NOT dropped", ok and not rej)
# But a real persona self-ID is still rejected.
ok, _, rej, _ = b.guard_draft("Hi Sam, this is Luna and I can help with that. - Iggy's Seaside", "Sam", "x")
check("'this is Luna' persona leak rejected", (not ok) and "assistant/persona leak" in rej)
# A correct deferral with the word 'fully' must NOT trip the allergen guard.
ok, _, rej, _ = b.guard_draft("Hi Sam, we have gluten-free options and the kitchen will fully confirm what works for your allergy. - Iggy's Seaside", "Sam", "x")
check("'fully confirm' deferral NOT allergen-rejected", ok and not rej)
# New over-assurance phrasings ARE caught.
ok, _, rej, _ = b.guard_draft("Hi Sam, our kitchen is celiac-friendly so you can eat anything without worry. - Iggy's Seaside", "Sam", "x")
check("celiac-friendly/eat-anything rejected", (not ok) and "absolute allergen guarantee" in rej)
# Owner-relay phrasing (false negative the review caught) is rejected.
ok, _, rej, _ = b.guard_draft("Hi Mel, tell the boss you want the upstairs space and we'll sort it. - Iggy's Seaside", "Mel", "x")
check("'tell the boss' relay rejected", (not ok) and "addresses/relays to the owner" in rej)
# But the legit deferral to 'our manager' must pass.
ok, _, rej, _ = b.guard_draft("Hi Mel, I'll have our manager confirm availability and pricing for that date. - Iggy's Seaside", "Mel", "x")
check("'our manager will confirm' deferral passes", ok and not rej)
# Added standby opener is caught.
ok, _, rej, _ = b.guard_draft("Hi there. How may I assist you today? - Iggy's Seaside", "x", "x")
check("'how may I assist' standby rejected", (not ok) and "idle/standby phrase" in rej)
# Sign-off with trailing words does NOT double-append.
_, fixed, _, _ = b.guard_draft("Thanks so much! - Iggy's Seaside, your hosts", "Mel", "x")
check("no double sign-off on trailing text", fixed.lower().count("iggy's seaside") == 1)

print("\nRESULT:", "ALL GREEN" if not FAILS else f"{len(FAILS)} FAILED: {FAILS}")
sys.exit(1 if FAILS else 0)
