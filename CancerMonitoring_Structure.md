# Cancer Monitoring — Structure

**Status:** draft for review. Structure by Claude; all clinical wording marked `PENDING ASH`.

**Decisions taken:** sign modules + tumour presets · multiple named masses · document before code ·
nausea and inappetence are two separate scales (§3) · palliative meds module is informational only
(§5.3) · chemotherapy toxicity uses VCOG-CTCAE grading (§5.1).

---

## 1. Why cancer can't follow the Heart Disease pattern

Every condition in `src/lib/conditions.js` today is *one condition, one fixed parameter list*. That
works for Heart Disease because cardiac patients share a symptom set. Cancer has no such set, and
structuring by tumour type fails three ways:

- **It never converges.** Twenty-plus tumour types, each needing clinical authoring before anything
  ships.
- **Owners often can't answer it.** "A mass, awaiting histopath" is the common case at the moment
  someone downloads a QoL app. A first question the owner can't answer is a dead end.
- **The signs overlap anyway.** Pulmonary mets from an osteosarcoma and a primary lung tumour are
  monitored identically. Tumour-first structure means writing the respiratory questions twice and
  letting the two copies drift.

So: **the tumour name is metadata; the signs are the structure.**

---

## 2. The shape

```
CORE  ─────────────  always on, deliberately thin
  +
SIGN MODULES  ─────  owner picks; each is 2–5 parameters
  +
TREATMENT MODULE  ─  owner picks one
  ↑
PRESET  ────────────  "what did your vet diagnose?" pre-ticks the modules above
```

A preset is a **front door, not a schema**. Picking *Osteosarcoma* ticks Mobility + Respiratory and
stores `preset: 'osteosarcoma'` for the report header. The owner can add or remove any module
afterwards. Adding a preset later is one line in a table — not a new condition definition.

---

## 3. Core — and why it should stay thin

The instinct is to put appetite, pain, activity and demeanour in the cancer core. **Most of that
already exists** in the general QoL assessment (BEAAAAPP) and the Body Condition screen. Re-asking
them inside the cancer form is the fastest way to make the feature feel like a chore, and it would
produce two answers to the same question on the same day that can disagree.

Proposed core — only what general QoL does *not* already capture:

| Key | Type | Notes |
|---|---|---|
| `nausea` | `vcog` | Lip-licking, drooling, turning away from food, gulping. `PENDING ASH` |
| `inappetence` | `vcog` | How much less she is eating. `PENDING ASH` |
| `in_himself` | `scale` | One "how is she in herself today" read, the thing owners are actually tracking. `PENDING ASH` |

**DECIDED: nausea and inappetence are two separate scales.** They dissociate in both directions — the
oral-tumour patient is hungry but can't eat, and an early-nausea patient still eats. One combined
scale would lose the distinction that tells those apart.

**Both are VCOG-graded** (§5.1). VCOG-CTCAE treats anorexia and nausea as separate categories, so this
decision and the grading system agree. Grading them here rather than only inside the chemo module
means a patient who later starts chemotherapy keeps one continuous series instead of starting a
second, differently-scaled one.

Everything else the core needs — weight, BCS, pain, activity, demeanour — is **linked, not
duplicated.** The cancer page should show the weight/BCS trend inline (the chart registry can now
supply it) and link to the daily assessment rather than reproduce it.

> **Open question 1 (Ash) — new, raised by the two-scale decision:** the general QoL assessment
> already collects an appetite score daily. Should cancer's `inappetence` be *asked again* as a VCOG
> grade, or *derived* from the appetite answer the owner has already given that day? Asking twice
> risks two contradictory answers about the same meal. Deriving keeps one source of truth but loses
> the VCOG grade an oncologist would want in the report. A third option: ask the VCOG grade only on
> days the general assessment hasn't been completed.

---

## 4. Sign modules

Ten modules. Each is small on purpose — an owner ticking three modules should still face a form
they'll complete daily.

Parameter types below are the ones the app already supports: `number`, `scale`, `yesno`, `choice`,
each with the existing `concernAbove` / `concernFrom` / `concernWhen` / `followUp` machinery.

### 4.1 `mass` — Visible or palpable mass
Per mass instance (see §6). `size_mm` `number` · `changed_since_last` `choice` (smaller / same /
larger / unsure) · `surface` `choice` (intact / red / ulcerated / bleeding) · `bothering_pet`
`yesno` (licking, chewing, rubbing) · photo prompt.

### 4.2 `respiratory` — Breathing
`resting_respiratory_rate` `number` · `respiratory_effort` `scale` · `coughing` `yesno` + character
follow-up.
**All three already exist in the cardiac module** — see §7 on sharing rather than copying.

### 4.3 `mobility` — Lameness and limb use
`lameness` `scale` · `weight_bearing` `choice` (full / partial / none) · `swelling_at_site` `yesno` ·
`worse_after_rest` `yesno`.
⚠ Sudden non-weight-bearing → **emergency** (pathological fracture).

### 4.4 `urinary` — Urination
`straining` `yesno` · `blood_in_urine` `yesno` · `unable_to_pass_urine` `yesno` · `frequency_change`
`choice`.
⚠ Unable to pass urine → **emergency**.

### 4.5 `gi` — Gastrointestinal
`vomiting` `yesno` + frequency follow-up · `diarrhoea` `yesno` + character follow-up ·
`black_tarry_stool` `yesno` · `straining_to_defecate` `yesno`.

### 4.6 `haemorrhage` — Bleeding and collapse
`gum_colour` `choice` (shared with cardiac) · `collapse_episode` `yesno` · `abdominal_distension`
`yesno` · `visible_bleeding` `yesno`.
⚠ Collapse, or white/blue gums → **emergency** (haemoabdomen).

### 4.7 `nasal` — Nasal
`nasal_discharge` `choice` (none / clear / coloured / bloody) · `sneezing` `scale` · `nosebleed`
`yesno` · `facial_swelling` `yesno` · `noisy_breathing` `yesno`.

### 4.8 `oral` — Mouth and eating mechanics
`dropping_food` `yesno` · `drooling` `scale` · `oral_bleeding` `yesno` · `bad_breath` `yesno` ·
`avoiding_hard_food` `yesno`.
**Deliberately separate from appetite.** An oral-tumour patient is hungry and *wants* to eat — an
appetite score alone reads that as fine.

### 4.9 `lymph_nodes` — Palpable lymph nodes
Reuses the mass-instance machinery (§6) with a fixed site list rather than a free-text label:
submandibular, prescapular, popliteal, etc. `size_mm` `number` · `change` `choice`.

### 4.10 `neuro` — Neurological
`seizure` `yesno` + count follow-up · `disorientation` `scale` · `circling_or_head_pressing` `yesno`
· `vision_change` `yesno` · `behaviour_change` `scale`.

> **Note:** overlaps the planned Seizures condition. Suggest the seizure parameter here links to the
> Seizures module rather than duplicating it, once that ships.

---

## 5. Treatment modules

One selected at a time.

### 5.1 `chemo` — Chemotherapy

**DECIDED: toxicity is graded with VCOG-CTCAE.**

Categories, all owner-observable: `inappetence` · `nausea` · `vomiting` · `diarrhoea` · `lethargy` ·
`constipation`. Neutropenia is not owner-observable — only its consequences are, which is what
`unusually_quiet_or_hot` `yesno` is for.

**The structure that makes VCOG usable by an owner.** VCOG criteria are written for clinicians
("increase of N stools per day over baseline"). An owner reading raw VCOG text will misgrade. So each
grade carries **two strings**:

```js
{
  key: 'vomiting',
  type: 'vcog',
  grades: [
    { grade: 0, owner: '<plain description>' },   // PENDING ASH
    { grade: 1, owner: '<plain description>' },
    { grade: 2, owner: '<plain description>' },
    { grade: 3, owner: '<plain description>' },
    { grade: 4, owner: '<plain description>' },
  ],
}
```

The owner picks a plain description; the app stores and charts the **grade**, and the report prints
"Vomiting — Grade 2". Ash writes the owner-facing descriptions; the grade numbers are the interface
to the oncologist.

**Why this needs a new parameter type rather than reusing `scale`.** The existing `scale` type is
BEAAAAPP-derived: six levels, hardcoded `domain: [0, 10]` in `chartConfigFor`, severity read off
`concernFrom`. VCOG is 0–4 with grade-specific criteria and a different severity cut. Plotted as a
`scale` the grades would compress into the bottom half of every chart and read as trivial. A
`type: 'vcog'` gets `domain: [0, 4]`, its own severity mapping and its own report rendering.

**Timing.** Neutropenia bites around days 7–10, and "lethargic and off food on day 8" is a different
question to "lethargic generally". The **Events feature already exists** — a treatment event carries a
date, so days-since is **derived, never asked**. The form shows "Day 8 after treatment" as context
above the questions.

**The important structural piece:** *day relative to treatment*. Neutropenia bites around days 7–10,
and "lethargic and off food on day 8" is a different question to "lethargic generally". The **Events
feature already exists** — a `medication_started` / treatment event carries a date, so days-since can
be **derived, never asked**. The form should say "Day 8 after treatment" as context above the
questions.

⚠ Lethargy + inappetence inside the post-treatment window → **emergency** prompt. `PENDING ASH`

**Citation.** The app already credits BEAAAAPP, the Feline Grimace Scale and the WSAVA body condition
chart, and `.beap-citation` styling exists for exactly this. VCOG-CTCAE needs the same treatment.
`PENDING ASH` — confirm the version to cite (v2 is the most recent I'm aware of, but check) and the
exact wording.

### 5.2 `radiation` — Radiation therapy
`skin_at_site` `scale` (dermatitis) · `pain_at_site` `scale` · `mucositis` `scale` (only if `oral`
also selected).

### 5.3 `palliative_meds` — Steroids / palliative medication
`drinking_more` `yesno` · `urinating_more` `yesno` · `panting` `yesno` · `appetite_increase` `yesno`.

**DECIDED: this module is informational only.** These are *expected* steroid effects. Severity-scored,
a comfortable well-palliated patient would be flagged amber every day and the QoL trend would drag
down for something benign.

What informational-only means in the code:

- Parameters carry `informational: true`.
- `evaluateParameter` returns `severity: null` for them, so no amber or red badge appears beside the
  question.
- `summariseEntry` skips them entirely — they do not count toward `flags`, do not colour the day on
  the condition calendar, and do not appear in the "Things flagged each day" chart.
- They are still **logged, charted and exported** — a steadily rising water intake is exactly the kind
  of thing worth showing a vet, it just isn't a deterioration in quality of life.

> **Open question 2 (Ash) — new, raised by this decision:** is there any escape hatch? Profound PU/PD
> can outgrow "expected steroid effect", and panting can be respiratory distress rather than a steroid
> sign. Options: leave it purely informational (simplest, and the module's whole point); or allow a
> single extreme level per parameter to flag. My inclination is to leave it purely informational and
> let the `respiratory` module carry anything that is genuinely breathing trouble — but that's a
> clinical call.

---

## 6. Masses as instances

The only genuinely new data shape. A mast cell patient can have three lumps; each needs its own
identity, its own size series, and its own photo thread.

A mass is **not a parameter** — it's an instance that *generates* parameters:

```
masses: [
  { id: 'm1', label: 'Left flank',    firstSeen: '2026-08-01' },
  { id: 'm2', label: 'Right ear base', firstSeen: '2026-08-14' },
]
```

expands to parameter keys `mass:m1:size_mm`, `mass:m1:surface`, `mass:m2:size_mm`, … Entry values are
keyed identically, so `condition_entries.values` needs no schema change. `chartsForCondition` then
produces one size chart per mass automatically, labelled by site.

**Photos are the strong asset here.** A dated photo beside a ruler is worth more to an oncologist
than an owner's caliper estimate. Suggest the mass form prompts for a photo on every measurement and
the report prints them chronologically per mass.

> **Open question 3 (Ash):** measurement method. Longest dimension only, or two axes? Ruler, calipers,
> or a coin for scale in the photo? This determines the form and the how-to text.

---

## 7. Shared parameters — a refactor this needs

`resting_respiratory_rate`, `respiratory_effort`, `coughing`, `gum_colour` and `appetite` are already
authored, signed off, and living inside the cardiac definition. The cancer `respiratory` and
`haemorrhage` modules want *exactly those*.

Proposal: extract them to a `SHARED_PARAMETERS` map in `conditions.js`, referenced by key from both
conditions. One definition, one place to edit wording, no drift. This is the same principle the chart
registry just applied to charts, and it's what keeps modules cheap to add.

Without this, the RRR wording you signed off on 23 Aug exists in two places by the end of the week.

---

## 8. Presets → modules

| Preset | Modules ticked |
|---|---|
| Lymphoma | `lymph_nodes`, `gi` |
| Osteosarcoma / bone tumour | `mobility`, `respiratory` |
| Mast cell tumour | `mass`, `gi` |
| Haemangiosarcoma / splenic | `haemorrhage`, `respiratory` |
| Bladder or urethral (TCC) | `urinary` |
| Nasal tumour | `nasal`, `respiratory` |
| Oral tumour | `oral`, `mass` |
| Mammary tumour | `mass`, `respiratory` |
| Lung tumour / metastatic | `respiratory` |
| Brain or spinal tumour | `neuro` |
| Skin / soft tissue sarcoma | `mass` |
| Other, or not diagnosed yet | core only — owner adds modules |

`PENDING ASH` on the whole table. Two in particular:

- **Mast cell → `gi`** is my inference (histamine-driven GI ulceration). Confirm.
- **Mammary → `respiratory`** assumes pulmonary metastasis surveillance. Confirm whether that's
  useful to an owner or just alarming.

---

## 9. Data model

One column. The existing schema is already parameter-agnostic — `condition_entries.values` is jsonb
and `condition_key` is deliberately not a foreign key — so nothing else moves.

```sql
alter table public.pet_conditions
  add column if not exists config jsonb not null default '{}'::jsonb;
```

```json
{
  "preset": "mast_cell",
  "modules": ["mass", "gi"],
  "treatment": "chemo",
  "masses": [
    { "id": "m1", "label": "Left flank", "firstSeen": "2026-08-01" }
  ]
}
```

**One new function:**

```js
// conditions.js — expands a per-pet config into the parameter list the
// rest of the app already knows how to handle.
export function parametersFor(definition, config) // → parameter[]
```

Everything downstream works unchanged, because it all takes a parameter object already:
`evaluateParameter`, `summariseEntry`, `chartConfigFor`, `chartsForCondition`, the export picker.
Mass size in millimetres is `type: 'number'`, which already exists and already gets a trend chart.

**Where the module definitions live.** Ten modules × ~4 parameters × per-species wording will not fit
comfortably alongside the existing conditions. Suggest `conditions.js` keeps the registry and
`SHARED_PARAMETERS`, and cancer's modules move to `src/lib/conditions/cancerModules.js` — still one
file to edit for cancer content, still plain data.

---

## 10. Emergency flags

The `SEVERITY.EMERGENCY` machinery already exists (it's what flags white or blue gums in cardiac).
Candidates, all `PENDING ASH`:

| Sign | Module |
|---|---|
| Collapse episode | `haemorrhage` |
| White or blue gums | `haemorrhage` |
| Unable to pass urine | `urinary` |
| Sudden inability to bear weight | `mobility` |
| Laboured breathing at rest | `respiratory` |
| Uncontrolled bleeding from a mass | `mass` |
| Lethargy + inappetence in the post-chemo window | `chemo` |

---

## 11. Deliberately not included

- **Staging, grading, prognosis or survival estimates.** The app must not imply a timeline. This is
  the single biggest reputational risk in the feature.
- **Education about tumour types.** That's a conversation with their vet, and it dates badly.
- **Treatment decision support.** Out of scope entirely.

---

## 12. Where end-of-life sits

Cancer is the condition where the **overall QoL trend and the good/bad-days calendar matter more than
any individual parameter** — an owner tracking a mass is often really asking "is she still enjoying
herself?" `endOfLifeTopics.js` already exists.

> **Open question 4 (Ash):** how prominent should that be on the cancer page? Always visible, surfaced
> once the trend declines, or left where it is and reached from the menu? This is a tone call, and I'd
> rather you made it than me.

---

## 13. Open clinical questions — summary

**Settled**

- ~~Nausea and inappetence: one scale or two?~~ → **two separate scales**, both VCOG-graded. (§3)
- ~~Confirm `palliative_meds` is informational-only.~~ → **informational only**. (§5.3)
- ~~Chemo toxicity: VCOG-CTCAE or a plain owner scale?~~ → **VCOG-CTCAE**, with owner-facing
  descriptions mapping to grades. (§5.1)

**Still open**

1. Should cancer's `inappetence` be asked as a VCOG grade, or derived from the appetite score the
   general assessment already collects that day? (§3)
2. Any escape hatch on `palliative_meds`, or purely informational? (§5.3)
3. VCOG-CTCAE version to cite, and the citation wording. (§5.1)
4. The owner-facing description for each VCOG grade, per category — the main body of writing this
   feature needs. (§5.1)
5. Grade cut for concern vs emergency. Grade 3+ is the conventional intervention threshold, but
   confirm. (§5.1)
6. Mass measurement method — dimensions, tool, photo scale. (§6)
7. End-of-life prominence on the cancer page. (§12)
8. Mast cell tumours and repeated handling — does measuring risk degranulation, and should the app
   warn?
9. False reassurance — a stable external mass while disease progresses internally. Needs your wording.
10. Confirm the preset → module table, particularly mast cell → `gi` and mammary → `respiratory`. (§8)
