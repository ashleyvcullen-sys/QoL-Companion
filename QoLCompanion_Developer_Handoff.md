# QoL Companion — Developer Handoff

**Source artifact:** `QoLCompanion.jsx` (single-file React prototype, ~966KB, ~4,370 lines)
**Status:** Clinically reviewed prototype. Not production infrastructure. This document is the spec for rebuilding it as a real app.

---

## 1. What this app is

A quality-of-life tracking app for owners of seriously ill, senior, or end-of-life dogs and cats. It walks an owner through structured daily/weekly assessments (a general wellbeing check plus a validated pain scale), turns the results into trends they can bring to a vet, and provides reference material for emergencies, home care, scheduling, and end-of-life decisions.

**Content has been clinically reviewed by the commissioning veterinarian.** Treat the assessment logic, scoring, thresholds, and emergency guidance in the current build as the approved source of truth — carry it over faithfully rather than reinterpreting it during the rebuild.

---

## 2. Current architecture (prototype) vs. what's needed

| Layer | Current (prototype) | Needed for launch |
|---|---|---|
| Runtime | Single React file, `window.storage` key-value API | Real app (native or PWA) with a real backend |
| Data persistence | Sandbox-only storage, not durable, single-device | Database (per-user, per-pet), reliable sync |
| Auth | None — one implicit "user" | Real accounts, so a user's pets/data are theirs alone |
| Images | 97 reference photos embedded as base64 strings directly in the JS (this is most of the file's size) | Extracted to real static image assets, served normally |
| Distribution | Shareable artifact link only | App Store / Play Store, or hosted PWA |

**Recommendation:** React Native (Expo) if a true native app is the goal. If a native app isn't required, a hosted PWA (React + a real backend) is the fastest path and everything in this doc still applies except store submission.

---

## 3. Data model

One record per pet, shaped like this:

**Pet object** has these fields: `name` (string), `species` (either "dog" or "cat"), `breed` (string — currently holds the weight-range key, see Section 6), `age` (string, examples: "5 years", "<1 year (puppy/kitten)", "21+ years"), `sex` (either "male", "female", or "unknown"), `diagnosedConditions` (a list of strings, each one a key into `DISEASE_INSTRUMENTS`, for example "cancer" or "arthritis"), `hasSeenWelcome` (true or false), `createdAt` (an ISO date string), `generalQol` (a list of `GeneralQolEntry` objects, described below, one per day), `painLog` (a list of `PainLogEntry` objects, described below), `diseaseInstruments` (a list of `DiseaseInstrument` objects, described below), `schedule` (an object with four numbers: `general`, `pain`, `mobility`, `weightAppetite` — each is a number of days between reminders), and finally four fields that exist in the schema but have no UI built yet: `mobilityLog`, `weightAppetite`, `media`, `medications` — each currently just an empty list. Decide with the vet whether to build these out for version 1 or drop them.

**GeneralQolEntry object** has these fields: `date` (a string like "2026-01-15"), `scores` (an object with five fields — `stool`, `hygiene`, `vision`, `hearing`, `sleep` — each one is either a number from 0 to 10, or the text "unsure"), `stoolSymptoms` (a list of strings, which may include entries like "Other: itchy patch"), `hygieneSymptoms` (a list of strings, same pattern as `stoolSymptoms`), `vomiting` (an object with four fields: `hasVomited` which is true, false, or "unsure"; `frequency` which is a string or "unsure"; `unit` which is either "times/day" or "times/week"; and `character` which is a list of strings), `urination` (an object with two fields: `status` which is "normal", "abnormal", or "unsure"; and `symptoms` which is a list of strings), `waterIntake` (an object with one field: `status`, which is "reduced", "normal", "increased", or "unsure"), and `notes` (a plain string).

**PainLogEntry object**, which represents one BEAAAAPP assessment, has these fields: `date` (a string), `beap` (an object with eight fields — `breathing`, `eyes`, `ambulation`, `activity`, `appetite`, `attitude`, `posture`, `palpation` — each one a number that is always 0, 2, 4, 6, 8, or 10), `beapWorst` (a number, which is simply the highest of those eight values), and `notes` (a plain string).

**DiseaseInstrument object** has these fields: `id` (a string), `type` (a string that is a key into `DISEASE_INSTRUMENTS`, for example "cancer"), `name` (a string), and `entries` (a list of objects, where each object has a `date`, a `scores` object mapping each domain key to a number from 0 to 10, an `extra` object for any condition-specific extra fields, and a `notes` string).

---

## 4. Scoring logic — reference implementation

Reproduce this exactly; it's been through clinical review.

### General QoL score (`computeGeneralQolResult`)
- Max possible = 80 (8 sections × 10), but max shrinks by 10 for every section marked "Unsure" — excluded from both numerator and denominator, never guessed at or penalized.
- Stool / Hygiene: slider score (0–10) minus a flat penalty if symptom chips are selected (5 pts per hygiene symptom; flat 5 for any stool symptom), floored at 0.
- Vomiting: 10 if none; 5 if present; drops to 0 if frequency exceeds a threshold.
- Urination: 10 normal; 5 abnormal; 0 if abnormal and has additional symptoms.
- Drinking: 10 normal; 5 if reduced or increased.
- Vision / Hearing / Sleep: straight 0–10 slider score, no modifiers.
- Result maps to a band: ≥90% Minimal impact, ≥75% Some impact, ≥50% Moderate impact, else Severe impact.

### BEAAAAPP pain score
- 8 categories, each scored: 0 (none), 2 (mild), 4 (moderate), 6 (moderate–severe), 8 (severe), 10 (very severe).
- Overall pain picture is driven by the worst single category, not an average.
- Category text and images are species-specific (dog vs. cat) — never merge them.

### Disease-specific instruments
- 10 conditions, each with its own domain list (2–7 domains), each scored 0–10 on a labeled 3-point scale.
- Some domains are conditional (only shown if relevant, e.g. cancer's treatment-side-effects domain).
- A pet with ≥1 diagnosed condition shows its disease-specific instrument as the primary trend chart, but the general assessment still runs underneath for Overview/BEAAAAPP.

### Color severity scheme (identical across BEAAAAPP, QoL bands, and the calendar)
- green `#3D8259` — good / ≥75%
- orange `#C97A2E` — moderate / 50–74%
- red `#A33A2E` — severe / <50%

### Overview wellbeing categories (Trends screen)
- Comfort = invert(latest beapWorst)
- Appetite = invert(latest beap.appetite)
- Sleep = latest scores.sleep × 10
- Curiosity = invert(latest beap.activity)
- Connection = invert(latest beap.attitude)
- where invert(v) = 100 - (v/10)*100

---

## 5. Screen / feature inventory

- Onboarding: pet setup form → 5-slide welcome walkthrough (swipeable) → Home
- Home: icon grid nav — Emergencies, Quality Of Life Assessment, Trends, Home Care Tips (locked), Schedule, End Of Life, Export Report, About
- Quality Of Life Assessment: 18-page swipeable flow — intro → 8 core-sign pages (stool, vomiting, urination, drinking, hygiene, vision, hearing, sleep) → 8 BEAAAAPP category pages (photo options per severity band, species-specific) → review/save. History list below.
- Trends: Overview card (5 categories with icon + colored bar + %), good/bad day calendar, condition-specific or general QoL chart, 5 category trend charts
- Emergencies: static reference list, species-aware
- End Of Life: 7 topics as tappable icons → modal with full text; "How children grieve" has an age-bracket picker
- Schedule/reminders, Report export, About, Legal/Privacy — supporting screens

### Emergency logic to preserve
- Persisting-concern detection: flags things recurring across two non-consecutive logged days
- Male-cat modal: straining or not urinating, in a male cat, triggers an immediate emergency popup (urinary blockage risk)
- Cat breathing severe/very-severe descriptions flagged inline with "(emergency)" + hazard icon

---

## 6. Content that must carry over exactly

- BEAAAAPP category text: 8 categories × 6 severity levels × 2 species, species-specific
- 96 BEAAAAPP + posture reference images, dog and cat — extract to real image assets
- Citations to keep visible in-app:
  - BEAAAAPP pain scale concept — Dr. Shea Cox
  - Feline Grimace Scale — Evangelista MC, Watanabe R, Leung VSY, Monteiro BP, O'Toole E, Pang DSJ, Steagall PV. "Facial expressions of pain in cats: the development and validation of a Feline Grimace Scale." Scientific Reports, 2019;9:19128
  - "How children grieve" — adapted from material by Kristi Lehman, MSW, LISW, DVM Center
  - Life-stage/human-year equivalents — AAHA/AAFP guidelines
- Weight → human-year charts: dog varies by weight bracket, cat is a single chart
- Weight collected in kg only

---

## 7. Design system

- Colors: background `#FFF8F9`, primary accent `#C97B8C`, dark text `#3D2B30`, muted text `#9C7C86` / `#7A5B63`, card border `#F5DFE4`
- Type: headings in 'Fraunces' (serif), body in 'Inter' (sans)
- Reusable components: Card, SectionTitle, Btn (primary/outline/ghost/danger), ScoreSlider (0–10 + Unsure toggle), ChoiceButtons, SymptomChips (with "Other" → text modal), swipeable paginated wizard

---

## 8. Gaps to close before real users touch this

1. Backend + auth
2. Image asset pipeline — extract all 97 base64 images to real files
3. Push notifications for schedule/reminders
4. Legal — placeholder text needs lawyer review; store privacy declarations
5. Analytics/crash reporting
6. Accessibility pass, especially color-only severity indicators

---

## 9. Open questions

- Is multi-pet support in scope for v1?
- Home Care Tips has no content yet — needs the vet to write it
- Should mobilityLog, weightAppetite, media, medications be built for v1 or dropped?
