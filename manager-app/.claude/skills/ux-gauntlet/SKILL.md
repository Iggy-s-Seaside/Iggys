---
name: ux-gauntlet
description: "Run a brutal, multi-persona UX gauntlet where 5 diverse testers with real opinions each attempt to recreate a reference image using only the editor. Use this when the user wants comprehensive usability testing, wants to stress-test the editor with real-world tasks, says things like 'test with different people', 'usability test', 'can someone actually make this', 'run the gauntlet', or provides a reference image to recreate. Each tester has strong opinions, different skill levels, and will not sugarcoat problems."
---

# UX Gauntlet — Multi-Persona Recreation Test

You are running a **UX gauntlet**: 5 distinct testers with wildly different backgrounds each attempt to recreate the same reference image using the editor. They have real opinions. They will complain. They will get frustrated. They will find things the developer missed.

**The goal is NOT to verify features work. The goal is to find out if a real human can actually make something good with this tool.**

## The Reference Image

The target is a **Happy Hour promotional poster** with this structure:
- Dark, blurred bar/restaurant background photo
- **"HAPPY HOUR"** — Large bold teal heading at top
- **"MONDAY - FRIDAY | 4PM - 6PM"** — Small white subtitle beneath
- **"DRINKS"** — Teal divider with lines on either side
- Three drink items with prices left-aligned: `$5 MARGARITAS`, `$4 DRAFT BEERS`, `$6 HOUSE WINE`
- **"FOOD"** — Another teal divider
- Three food items with prices left-aligned: `$8 FISH TACOS`, `$6 LOADED NACHOS`, `$7 SLIDERS`
- **"Iggys"** — Script/cursive logo at bottom center

Key design qualities: Professional typography hierarchy, consistent spacing, readable text over dark background, clean section separation with dividers.

## Setup

1. **Start the dev server** (reuse if running):
   ```
   preview_start(name: "manager")
   ```

2. **Set mobile viewport**:
   ```
   preview_resize(serverId, preset: "mobile")
   ```

3. **Navigate to editor**:
   ```
   preview_eval(serverId, "window.location.href = '/specials/editor'")
   ```

4. **Dismiss any draft prompt** and start fresh.

5. **Take a baseline screenshot** to confirm the blank canvas.

## Available Editor Features (for reference)

Before each persona begins, know what tools exist:
- **Text presets**: Heading (Bebas Neue 96px), Subtitle (Montserrat 36px), Item (Oswald 36px), Price (Anton 72px), CTA (Oswald 48px)
- **Divider element**: Horizontal lines with centered label, configurable color/thickness/opacity/gap
- **10 fonts**: Inter, Playfair Display, Lobster, Bebas Neue, Oswald, Pacifico, Montserrat, Raleway, Poppins, Anton
- **Image layers**: Upload photos OR pick from Supabase library (Add → From Library). Blend modes, per-layer filters, crop (inset percentages).
- **Video layers**: Upload MP4/WebM as layers with autoplay, blend modes, filters. Stored in IndexedDB for draft persistence.
- **Background**: Upload photo or pick from library, global filters (Moody, Warm, etc.). Can be **converted to a layer** (More → BG → Layer) for full move/resize/blend control.
- **Canvas sizes**: 1:1 (1080x1080), 4:5 (1080x1350), 9:16 (1080x1920), 16:9 (1920x1080)
- **Typography**: Font size 8-200px, weight 300-700, B/I/U, alignment, spacing, line height, transform
- **Colors**: 9 brand presets + custom picker, opacity, stroke, shadow
- **Crop**: Non-destructive CSS inset crop for image/video layers (top/right/bottom/left percentages in Properties panel)
- **Triple-tap**: Triple-tap an image/video layer to instantly fit it to the canvas
- **Export**: PNG, JPEG with quality slider, or **animated GIF** (frame-by-frame with progress bar) when video layers are present
- **Fit to Canvas**: In More menu when an image/video layer is selected — resizes to cover the full canvas

---

## PERSONA 1: "Mike" — Bar Manager, Zero Design Skills

**Background**: 47 years old. Runs two bars. Uses his iPhone for everything. Has never opened Photoshop. His current method for making specials is taking a photo of a whiteboard. He heard about this app from the owner and is trying it for the first time.

**Personality**: Impatient. Pragmatic. Doesn't read instructions. Will tap things randomly until something happens. Gets frustrated quickly but appreciates when things "just work." Will abandon the app if he can't figure something out in 30 seconds.

**His approach**: He'll try the most obvious path first. If there's no obvious path, he's stuck.

### Mike's Test Run

Attempt to recreate the Happy Hour image as Mike would:

1. **First impression** — Open the editor. What does Mike see? Is it obvious what to do first? Is there a blank canvas with no guidance, or does something prompt him?

2. **Background** — Mike needs a dark bar photo. Can he find the Library easily? Does he know to look in "More"? Try the most obvious buttons first. If Mike can't find it within 3 taps, note that as a failure.

3. **Adding text** — Mike wants to type "HAPPY HOUR" big at the top. Does the Add button make sense? When he sees the presets (Heading, Subtitle, etc.), does he know which one to pick? After adding it, can he figure out how to change the text? How to move it to the top?

4. **Styling** — Mike wants the text teal. Can he find color options? How many taps does it take from "I added text" to "it's the color I want"?

5. **Adding items** — Mike needs to add 6 menu items. Is it tedious? Does he have to go through the full Add flow each time? After the 3rd item, is he annoyed?

6. **Dividers** — Mike probably doesn't even know what a divider is. Will he find it? Will he understand what it does from the label alone?

7. **Spacing & layout** — This is where Mike will struggle most. Can he get items evenly spaced? Does he give up on pixel-perfect and settle for "close enough"?

8. **Export** — Can Mike save/export his creation? Is the flow obvious?

**Mike's honest review** — Write Mike's unfiltered opinion of the app. He should mention:
- What confused him
- What he liked (if anything)
- Whether he'd use this again or go back to the whiteboard
- A 1-10 rating
- His biggest single complaint

---

## PERSONA 2: "Sarah" — Photoshop Power User, 12 Years Experience

**Background**: 34 years old. Senior graphic designer at an agency. Uses Photoshop, Illustrator, and Figma daily. She's evaluating this tool to see if it's worth recommending to her bar-owner clients who can't afford a designer.

**Personality**: Highly critical of design tools. Knows exactly what features should exist. Gets annoyed by missing keyboard shortcuts and lack of precision. Will immediately notice if typography controls are limited. Compares everything to Photoshop/Canva/Figma.

**Her approach**: She'll try to use professional techniques — precise positioning, consistent spacing, typography hierarchy, layer ordering.

### Sarah's Test Run

Attempt to recreate the Happy Hour image as Sarah would:

1. **Layer setup** — Sarah would start by planning her layer stack. Open the Layers panel. Can she pre-plan her composition? Can she rename layers? (Note if not possible.)

2. **Typography hierarchy** — Sarah needs:
   - "HAPPY HOUR" in a bold display font, ~96px, teal
   - "MONDAY - FRIDAY | 4PM - 6PM" in a clean sans-serif, ~20px, white, wide letter-spacing
   - Menu items in a consistent weight/size

   Can the editor achieve this? What's missing? Are there enough font options? Can she get precise sizes?

3. **Alignment & spacing** — Sarah wants elements perfectly centered and evenly spaced. Is there an align tool? Snap-to-grid? Distribution? If not, how painful is manual positioning?

4. **Dividers** — Sarah evaluates the divider element. Can she match the reference (thin teal lines with label between them)? Can she control line weight, color, padding independently?

5. **Color consistency** — Sarah needs the exact same teal (#2dd4bf) on the heading, dividers, and maybe CTAs. Is color reuse easy, or does she have to re-enter the hex each time?

6. **Background treatment** — Sarah wants a dark, slightly blurred bar photo. Can she apply a blur + dark overlay to the background? What about a gradient overlay to darken the bottom?

7. **Text shadow/readability** — The reference has subtle shadows to pop text off the background. Can Sarah add consistent shadows to text layers?

8. **Export quality** — Sarah exports at max quality. Does the output look professional? Any rendering artifacts?

**Sarah's honest review** — Write Sarah's professional assessment:
- Feature gaps that would be dealbreakers for a designer
- Things that are surprisingly good for a "simple" editor
- What she'd need added before recommending to clients
- Comparison to Canva's free tier
- A 1-10 rating
- Her specific typography complaints

---

## PERSONA 3: "Jiro" — Apple Design Purist, iOS Developer

**Background**: 29 years old. iOS developer at a startup. Obsessed with Apple's Human Interface Guidelines. Judges every app by how "iOS-native" it feels. Has strong opinions about touch targets, gesture patterns, haptic feedback, and animation curves.

**Personality**: Will nitpick every pixel of UI/UX. Notices if a button is 43px instead of 44px. Cares deeply about micro-interactions. Will comment on animation timing, blur quality, and whether the app respects safe areas. Hates web apps that feel like web apps.

**His approach**: He'll focus less on the final output and more on the EXPERIENCE of creating it. Every tap, drag, and swipe is being evaluated.

### Jiro's Test Run

Attempt to recreate the Happy Hour image, but primarily evaluate the UX:

1. **First launch feel** — Does the editor feel native? iOS-quality? Or does it feel like a web app? Rate the initial impression. Check: safe area respect, status bar handling, toolbar placement.

2. **Touch interactions** — For each interaction, evaluate:
   - **Adding text**: Does the add menu feel responsive? Do items have adequate touch targets (44pt minimum)?
   - **Selecting elements**: Can Jiro tap small text elements reliably? Is there haptic-like feedback (visual)?
   - **Moving elements**: Is the drag smooth? 60fps? Any jank or stutter? Does it feel like moving a real object?
   - **Resizing**: Do corner handles feel right? Is the gesture intuitive? Any accidental triggers?
   - **Font picker**: Does the floating bar feel like a native iOS picker? Smooth scroll?

3. **Overlay behaviors** — How do sheets/overlays animate? Spring curves or linear? Does the blur backdrop feel iOS-quality? Test mutual exclusion — opening one overlay should smoothly close another, not cause a flash.

4. **Toolbar ergonomics** — Is the bottom toolbar reachable with one thumb? Are the most common actions (Add, Edit) in the thumb zone? Is "More" a good place for important features?

5. **Canvas interaction** — Is the canvas locked correctly on mobile (no accidental scroll/zoom)? Does the auto-fit scaling feel right? Any scroll bounce issues?

6. **Sheet UX** — When the properties bottom sheet opens, does it feel like a native sheet? Can you dismiss by pulling down? Does it snap to heights?

7. **Visual polish** — Rate these on a 1-5 scale:
   - Selection handles appearance
   - Toolbar iconography
   - Color picker quality
   - Typography in the UI itself
   - Spacing and padding consistency
   - Dark mode execution

8. **Accessibility** — Can Jiro accomplish the task with slightly larger text? Are interactive elements properly labeled?

**Jiro's honest review** — Write Jiro's UX assessment:
- Top 3 things that feel native/polished
- Top 3 things that feel "webby" and break the illusion
- Touch target issues he found
- Animation quality assessment
- His recommendation: "Would I use this on my own phone daily?"
- A 1-10 rating
- His single biggest UX gripe

---

## PERSONA 4: "Zoe" — Gen-Z Social Media Manager

**Background**: 23 years old. Manages social media for 3 restaurants. Makes 10+ Instagram posts per week using Canva, CapCut, and Instagram's built-in editor. She's fast, impatient, and judges tools by how quickly she can create content.

**Personality**: Speed is everything. She'll try to create the poster in under 5 minutes. Gets frustrated by extra taps. Loves templates. Would rather modify a template than start from scratch. Compares everything to Canva mobile app. Uses slang. Doesn't care about pixel perfection — just needs it to look "fire" on Instagram.

**Her approach**: Template first. If there's a Happy Hour template, she'll start there. If not, she'll pick the closest one and modify it.

### Zoe's Test Run

Speed-run the Happy Hour poster recreation:

1. **Template hunt** — Does the editor have a Happy Hour template? Open More → Templates. If yes, start from it. If the closest template gets her 60%+ there, that's a win. Note how much modification is needed.

2. **Speed of text editing** — After adding a text element, how many taps to: (a) change the text content, (b) change the font, (c) change the color? Count the taps for each. Canva takes 2 taps max for each.

3. **Copy-paste workflow** — After styling one menu item perfectly, can Zoe duplicate it and just change the text? How many taps? This is critical for making 6 similar items.

4. **Background vibe** — Can Zoe quickly get a "moody bar" background? Rate the photo library. Are the filter presets actually good, or do they look like 2015 Instagram filters?

5. **Undo reliance** — Zoe makes mistakes constantly and relies on undo. Is undo fast and obvious? Can she undo multiple times quickly? Is it buried in the More menu?

6. **Time trial** — How long does the full recreation take? Note timestamps or approximate phase durations.

7. **Instagram readiness** — After export, would this look good on an Instagram feed? Is the aspect ratio right (4:5 for feed, 9:16 for stories)? Is the quality high enough?

**Zoe's honest review** — Write in Zoe's voice (casual, direct):
- "Okay so basically..." opening
- What she'd post about this app on her Instagram stories
- Whether she'd switch from Canva
- Feature she misses most from Canva
- A 1-10 rating
- Her one-word summary of the app

---

## PERSONA 5: "Raj" — Accessibility Advocate & QA Engineer

**Background**: 38 years old. QA engineer who specializes in accessibility testing. Uses VoiceOver on his iPhone. Tests with reduced motion enabled. Cares about contrast ratios, screen reader support, and whether the app works for people with motor impairments.

**Personality**: Methodical and thorough. Will test edge cases no one else thinks of. Checks WCAG compliance. Tests with one hand. Tests with large text. Will try to break things intentionally. Documents everything precisely.

**His approach**: He'll attempt the recreation while specifically testing for accessibility barriers at each step.

### Raj's Test Run

Attempt the recreation while evaluating accessibility:

1. **Color contrast** — Check the UI text (button labels, panel headers, slider labels) against their backgrounds. Do any fail WCAG AA (4.5:1 for text, 3:1 for large text)?

2. **Touch target audit** — Systematically check every interactive element:
   - Toolbar buttons: Are they all >= 44x44pt?
   - Font picker pills: Large enough?
   - Color swatches: Large enough?
   - Slider thumbs: Draggable with imprecise touch?
   - Layer panel buttons (visibility, lock, delete): Large enough?
   - Close/X buttons on overlays: Large enough?

3. **One-handed operation** — Can Raj do everything with just his right thumb? Left thumb? What requires two hands or is unreachable?

4. **Motor impairment simulation** — Try doing everything slowly and imprecisely:
   - Can elements be selected without accidentally selecting neighbors?
   - Do resize handles work with shaky taps?
   - Can text be edited if your taps aren't perfectly accurate?
   - Is there enough spacing between destructive actions (delete) and non-destructive ones?

5. **Error recovery** — What happens when things go wrong?
   - Accidentally delete a layer — can it be undone easily?
   - Add wrong element — is removal obvious?
   - Move something off-canvas — is it recoverable?
   - Set text color same as background — is there any warning?

6. **State clarity** — Is it always clear what's selected? What mode you're in? What will happen if you tap something?

7. **Cognitive load** — How many things does the user need to remember at once? Are there too many options visible? Is the information hierarchy clear?

**Raj's honest review** — Write Raj's accessibility assessment:
- WCAG violations found (with specific contrast ratios if possible)
- Touch target failures (list each one with actual size estimate)
- Barriers that would prevent someone with a disability from using the app
- Error recovery gaps
- Top 3 accessibility wins
- Top 3 accessibility failures
- A 1-10 accessibility score (separate from general UX)
- His recommendation for minimum fixes before public release

---

## Running the Gauntlet

For each persona:

1. **Announce who is testing** — Brief intro of the persona
2. **Fresh start** — Navigate to `/specials/editor`, dismiss drafts, blank canvas
3. **Attempt the recreation** — Work through their specific test plan above, taking screenshots at key moments
4. **Write their review** — In their authentic voice, covering all required points
5. **Take a final screenshot** — Show their best attempt at the recreation

After all 5 personas complete:

## Final Report

```markdown
# UX Gauntlet Report — [date]

## Recreation Scorecard
| Persona | Completed? | Time (est.) | Fidelity (1-10) | Would Use Again? | Rating |
|---------|-----------|-------------|-----------------|------------------|--------|
| Mike    |           |             |                 |                  |        |
| Sarah   |           |             |                 |                  |        |
| Jiro    |           |             |                 |                  |        |
| Zoe     |           |             |                 |                  |        |
| Raj     |           |             |                 |                  |        |

## Consensus Issues (3+ personas mentioned)
- [Issues multiple testers independently identified]

## Critical Blockers
- [Things that prevented task completion]

## Quick Wins (Easy fixes, big impact)
- [Low-effort changes that multiple personas would benefit from]

## Feature Requests by Priority
### Must Have (blocking real usage)
- ...
### Should Have (significantly improves experience)
- ...
### Nice to Have (polish)
- ...

## The Verdict
[One paragraph: Is this app ready for real bar staff to use daily? What's the minimum viable set of fixes before handing it to someone like Mike?]
```

## Important Rules

1. **No sugarcoating.** If something sucks, say it sucks. Use the persona's actual language.
2. **Be specific.** Don't say "the UX could be better." Say "I tapped the Font button 3 times and nothing happened because my finger was 10px too low."
3. **Try to actually DO the recreation** with each persona. Don't just theorize about what they might struggle with — prove it by attempting it in the app.
4. **Screenshot evidence** for every claim. If you say something is too small, show it.
5. **Each persona's review should disagree with at least one other persona** on something. Real people have different preferences.
6. **The final report should be actionable** — the developer should be able to read it and know exactly what to fix first.
