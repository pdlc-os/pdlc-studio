# P30 — i18n Scaffolding

| Field | Value |
| --- | --- |
| **Priority** | **P30** of 30 |
| **Score** | **3.0** — lowest in the pack |
| **Inputs** | Value 3 · Reach 2 · GapWeight ×2.0 · Effort 4 |
| **Category** | Design System, Theming & Accessibility |
| **Matrix features** | `UX-06` (internationalisation) |
| **Maturity** | PDLC Studio **0** → target **3** · claudecodeui **4** |
| **Effort** | **4** |
| **Depends on** | Nothing. **Has an ordering claim on everything after it** — §1.2 |
| **Blocks** | Nothing formally; see §1.2 |
| **Status** | Proposed — **the ranking is contested; read §1.2 before deferring** |

---

## 1. Context & problem statement

PDLC Studio has **no internationalisation of any kind**. Every user-facing string is a
hard-coded English literal in a component. There is no message catalogue, no locale detection,
no formatting layer, and no mechanism a translator could use.

`03-feature-comparison-matrix.md` marks this as a **total gap** — one of the few places where
claudecodeui leads by a full ×2.0 weight against a PDLC Studio score of 0.
`04-uiux-workflow-comparison.md` §5 notes why it is easy to miss:

> **The i18n row is a total gap**, and easy to overlook because nothing in the app looks
> broken. Every user-facing string is a hard-coded English literal. Retrofitting i18n across a
> codebase is far more expensive than scaffolding it early, which is why UX-06 is ranked
> despite having no current user demand.

That is the entire argument, and it is a cost-curve argument rather than a user-demand one.

### 1.1 Why it scores lowest

Honestly: **value 3, reach 2, effort 4.**

- No user has asked. There is no issue, no discussion thread, no translation PR.
- The audience is developers using a CLI whose own output is English.
- The work is a **cross-cutting sweep** touching essentially every component — the definition
  of effort 4 in `06-prioritization-and-roadmap.md` §1.

Score 3.0 is the correct output of the model, and `06-prioritization-and-roadmap.md` §1 says
so explicitly:

> **Strategic value.** i18n (P30) scores 3.0 and lands last, because it has no current user
> demand and costs a cross-cutting sweep. That is the model working correctly, and it is also
> **the item most likely to be worth pulling forward on judgement rather than arithmetic**.

### 1.2 The ordering claim — the important part

**P30 is ranked last but should probably not be *done* last.**

`06-prioritization-and-roadmap.md` §3 records the dependency inversion:

> **P30 is ranked last but has an ordering claim on everything after it.** Every PRD shipped
> before i18n scaffolding adds hard-coded English strings that must later be extracted. The
> model ranks it 30th on value÷effort; the dependency graph says that if it is *ever* going to
> be done, doing it before P07/P15/P16/P17 is materially cheaper.

The arithmetic is straightforward. The 29 other PRDs add a great deal of new user-facing text —
P07's file panel, P15's git panel, P16's diff viewer, P17's palette, P10's onboarding, P14's
login screen, P24's permissions surface, P27's activity log. Every one of those strings is
either written against a catalogue once, or written as a literal and extracted later.

**Extraction is strictly more expensive than authoring**, because it requires finding every
literal, judging which are user-facing, and re-testing what was already working.

So the decision this PRD actually asks for is binary:

| Decision | Consequence |
| --- | --- |
| **Never do i18n** | Then rank 30 is correct and this PRD should be closed, not deferred |
| **Do it eventually** | Then doing it **now**, before Milestone 3, is the cheapest moment it will ever be |

Deferring it indefinitely while continuing to add UI is the one option that is strictly worse
than both.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Cited as evidence of value only.

claudecodeui scores 4:

- **`i18next ^25.7.4`**, **`react-i18next ^16.5.3`**, and
  **`i18next-browser-languagedetector ^8.2.0`**
- Its **README is translated into 7 languages**

The README translations are the interesting signal. They suggest a real international user
base — enough that someone did the work — which is evidence the audience for a Claude Code
web UI is not English-only.

That is worth weighing against §1.1's "no user has asked". PDLC Studio has no i18n, so a
non-English speaker evaluating it has no reason to file a request; they simply use something
else. **Absence of demand is weak evidence when the feature's absence filters the audience.**

---

## 3. Goals & non-goals

### Goals

1. All user-facing strings come from a catalogue, not from literals.
2. A new language can be added by contributing one file — no code changes.
3. Locale-aware formatting for dates, times, and numbers.
4. English remains the default and the fallback.
5. The mechanism is enforced, so new literals do not creep back.

### Non-goals

- **Actually translating into other languages.** This PRD builds the mechanism and ships
  English only. Translations are contributions.
- **Right-to-left layout.** A real, separate piece of work. §16.4.
- **Translating `CLAUDE.md` or the README.** Documentation, not application.
- **Translating Claude's output.** The model produces what it produces.
- **Translating error text from the CLI or git.** Passed through verbatim — see §5.
- **A translation-management platform.** Files in the repository are sufficient at this scale.

---

## 4. Personas & user stories

**A non-English-speaking developer.**

> As a Japanese-speaking developer, I want the interface in my language, so that I am not
> parsing English UI while thinking about code.

**A contributor who wants to help.**

> As someone who would happily translate this, I want a catalogue file to translate, so that
> contributing does not mean editing thirty components.

**The maintainer.**

> As the maintainer, I want strings centralised, so that copy changes happen in one file and I
> can see all user-facing text at once.

**A future contributor to any other PRD.**

> As someone adding the git panel, I want a catalogue to add strings to, so that my work does
> not have to be revisited later for extraction.

The last one is the operative story, and it is why §1.2 matters more than §4's first three.

---

## 5. Functional requirements

### Mechanism

- **FR-1** All user-facing strings **MUST** come from a catalogue.
- **FR-2** Adding a language **MUST** require only a new catalogue file.
- **FR-3** English **MUST** be the default and the fallback for missing keys.
- **FR-4** A missing key **MUST** fall back visibly-but-safely — never render a raw key or an
  empty string to the user in production.
- **FR-5** Locale **MUST** be detectable from the browser and overridable by the user.
- **FR-6** The choice **MUST** persist.

### Coverage

- **FR-7** All UI strings **MUST** be externalised, including empty states, errors, and
  accessible labels.
- **FR-8** **Accessible names and `aria-label`s MUST be translated.** Untranslated ARIA text is
  a worse accessibility failure than untranslated visible text, because it is invisible to the
  sighted reviewer who would otherwise catch it.
- **FR-9** Pluralisation **MUST** be handled by the library, not by string concatenation.
- **FR-10** Interpolation **MUST** be supported — no sentence assembly from fragments.
- **FR-11** Dates and times **MUST** be locale-formatted.
- **FR-12** Numbers **MUST** be locale-formatted.

### What is *not* translated

- **FR-13** Content from Claude, git stderr, and CLI output **MUST** pass through verbatim.
- **FR-14** File paths, session ids, and command text **MUST NOT** be transformed.
- **FR-15** Where such content is embedded in a translated sentence, the sentence **MUST** use
  interpolation so translators can reorder around it.

### Enforcement

- **FR-16** A lint rule **MUST** flag new user-facing literals in components.
- **FR-17** The catalogue **MUST** be type-safe, so a missing or misspelled key fails
  typechecking.
- **FR-18** Unused keys **SHOULD** be detectable.

FR-16 and FR-17 are what make this durable rather than a one-time sweep that erodes.

---

## 6. UX & interaction specification

### Visible surface: almost none

If done correctly, **an English-speaking user sees no change at all.** That is the success
criterion, and it is also why this PRD is risky — a large diff with no visible benefit and
real regression potential.

The only new UI is a language selector in `SettingsModal`, alongside theme and Enter behaviour:

```
┌────────────────────────────────┐
│  Language                      │
│  [ English            ▾ ]      │
│    English                     │
│    (more via contributions)    │
└────────────────────────────────┘
```

With only English shipped, the selector could arguably be hidden until a second language
exists. **Recommendation: show it anyway**, so the capability is visible and contributors know
it is wanted.

### Formatting changes that *are* visible

FR-11 and FR-12 change behaviour even in English if the current code uses fixed formats.
`frontend/src/utils/time.ts` (52 lines) handles relative timestamps and is the place to check —
switching to `Intl.RelativeTimeFormat` and `Intl.DateTimeFormat` may alter English output
slightly. That is a real, if small, user-visible change and should be verified rather than
assumed harmless.

---

## 7. Technical design

### 7.1 Library or hand-rolled?

Unlike P14 (hashing), P17 (palette), and P22 (fuzzy matching) — where this pack recommends
avoiding dependencies — **i18n is a case for taking one.**

| Concern | Why hand-rolling is wrong |
| --- | --- |
| **Pluralisation** | CLDR plural rules are genuinely complex. Arabic has six forms; Polish and Russian have non-obvious rules. Getting this wrong produces broken grammar in exactly the languages you added i18n for |
| Interpolation with ordering | Translators must reorder placeholders |
| Fallback chains | `ja-JP` → `ja` → `en` |
| Locale detection | Well-solved, fiddly |

A minimal implementation would handle interpolation and lookup adequately and pluralisation
badly, which defeats the purpose.

**Recommendation: `i18next` + `react-i18next`**, matching claudecodeui's choice — not because
they chose it, but because it is the mature option and the plural handling is the part that
must not be improvised.

**But weigh the bundle cost seriously.** `CLAUDE.md` documents a hard-won fight to keep
artefacts small (428 MB → 94 MB), and this is a **frontend** dependency, so it lands in the
bundle served from — and embedded in — the binary. `i18next` plus `react-i18next` is on the
order of tens of kilobytes gzipped, which is modest against a 38 MB artefact but is not
nothing. Measure it (§16.2).

A lighter alternative worth evaluating: the platform's own `Intl.PluralRules` covers the hard
part natively, and a thin wrapper over it plus a lookup function would be far smaller. That is
the strongest argument for hand-rolling and should be evaluated before adopting `i18next`.

### 7.2 Catalogue structure

```
frontend/src/locales/
  en.json          ← the source of truth
  ja.json          ← contributed
```

Flat-ish, namespaced keys — `chat.composer.placeholder`, `git.panel.empty` — so a translator
can see structure without reading code.

**English is the source of truth** (FR-3). Keys are added to `en.json` as features are built;
other locales fill in later and fall back until they do.

### 7.3 Type safety (FR-17)

Derive the key type from the English catalogue:

```ts
type TranslationKey = keyof typeof en;
export function useTranslation(): { t: (key: TranslationKey, vars?: …) => string };
```

A misspelled or removed key then fails `make check`'s typecheck rather than rendering a raw key
at runtime. This is the single most valuable piece of the scaffolding — it converts an entire
class of runtime bug into a compile error, and `make check` already runs `tsc -b`.

### 7.4 Enforcement (FR-16)

An ESLint rule flagging string literals in JSX text positions and in known prop positions
(`aria-label`, `title`, `placeholder`, `alt`).

The rule will produce false positives — `data-testid`, class-like values, non-user-facing
attributes — so it needs a configured allowlist rather than being switched on raw.

Note that claudecodeui's use of **`eslint-plugin-boundaries`** shows lint-based architectural
enforcement is a technique this project could adopt more broadly (`ENG-03`, deferred). This is
a narrow instance of the same idea.

### 7.5 The migration sweep — the actual work

This is where effort 4 comes from. Every component with user-facing text must be touched:

| Area | Files |
| --- | --- |
| Chat | `ChatPage`, `ChatInput`, `ChatMessages`, `PermissionInputPanel`, `PlanPermissionInputPanel`, `HistoryButton` |
| Launch | `ProjectSelector`, `NewProjectDialog`, `CloneRepositoryDialog`, `DirectoryPickerDialog` |
| History | `HistoryView` |
| Settings | `SettingsModal`, `GeneralSettings`, `SettingsButton` |
| Messages | `MessageComponents`, `CollapsibleDetails`, `TimestampComponent` |
| Demo | `DemoPage` — dev-only, arguably skippable |

Plus **every PRD shipped before this one**, which is precisely §1.2's point.

**Existing tests are the safety net.** The project has 14 test files, and many assert on
visible text. Those assertions will need updating — but they are also what will catch a string
that was extracted incorrectly. `CLAUDE.md`'s rule to assert on roles and `aria-*` rather than
class names helps here; assertions on *text* will need the most attention.

### 7.6 What must not be translated

FR-13/FR-14 matter and are easy to get wrong. These pass through verbatim:

- Claude's responses and tool output
- git stderr (`backend/handlers/projectSetup.ts:196-201` deliberately surfaces it, and
  P15/P16 do the same)
- Claude CLI errors (P10's health check surfaces these)
- File paths, session ids, model identifiers, command text

FR-15's interpolation rule matters for sentences that *contain* such content:

```jsonc
// Right — translator controls word order around the path
"file.notFound": "Could not find {{path}}"

// Wrong — assembles a sentence from fragments
"file.notFoundPrefix": "Could not find"
```

### 7.7 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| Settings persistence | `AppSettings`, `useSettings` | `frontend/src/utils/storage.ts` |
| Settings UI | `SettingsModal`, `GeneralSettings` | `frontend/src/components/` |
| Time formatting | `time.ts` — to be made locale-aware | `frontend/src/utils/` |
| Typecheck gate | `make check` → `tsc -b` | `Makefile` |
| Lint configuration | existing ESLint setup | `frontend/` |

---

## 8. Data model & persistence

| Datum | Store | Lifetime |
| --- | --- | --- |
| Selected locale | `AppSettings` in `localStorage` | Until cleared |
| Catalogues | Bundled JSON | Build time |

**The settings-version migration now spans six PRDs** — P01, P09, P10, P17, P24, and P30.
P24 §7.3 already flags this. Whichever lands last extends the same migration; six parallel
migrations would be a genuine mess.

---

## 9. Security implications

Two small but real ones.

**1. Interpolated content must not become markup.** Translated strings interpolate values —
file paths, commands, model names — that may contain markup-like characters. `i18next` escapes
interpolation by default, and **that default must not be disabled**. Several PRDs already
establish this rule for their own rendering (P08 §9, P16 §9, P19 §9, P20 §9); i18n is a new
place the same mistake can be made, and a more central one.

**2. Contributed catalogues are third-party content.** A translation PR adds strings that
render in every user's UI. They are data, not code, and escaping handles the injection case —
but a malicious or careless translation could still mislead, for example by mistranslating
P01's `bypassPermissions` warning or P26's deletion confirmation into something that
understates the consequence.

**Security-relevant strings deserve extra review in translation PRs.** Worth noting in
`CLAUDE.md` alongside the contribution guidance.

---

## 10. Performance & scale

- Catalogues are JSON loaded at startup. English alone is small.
- **Non-default locales should be lazily loaded**, not all bundled — otherwise adding ten
  languages grows every user's bundle for nine they will never use.
- `Intl` formatters are cheap but should be memoised rather than constructed per render.
- The library's bundle cost is the main consideration and must be measured (§16.2).

---

## 11. Telemetry & observability

None. No analytics.

A development-mode console warning for missing keys is useful; in production FR-4's fallback
should be silent.

---

## 12. Test plan

### Frontend — `make test-frontend`

New `frontend/src/i18n/i18n.test.ts`:

| Test | Asserts |
| --- | --- |
| Known key returns its English string | FR-1 |
| Missing key falls back to English | FR-3 |
| **Missing key never renders a raw key to the user** | **FR-4** |
| Interpolation substitutes values | FR-10 |
| **Interpolated values are escaped** | **§9.1** |
| Pluralisation selects correct forms | FR-9 |
| Locale detection reads the browser | FR-5 |
| Persisted locale overrides detection | FR-6 |

New `frontend/src/utils/time.test.ts` additions:

| Test | Asserts |
| --- | --- |
| Relative times formatted per locale | FR-11 |
| Numbers formatted per locale | FR-12 |
| English output unchanged from before the sweep | §6 regression |

Catalogue integrity:

| Test | Asserts |
| --- | --- |
| Every key used in code exists in `en.json` | FR-17 |
| No unused keys | FR-18 |
| Non-English catalogues contain no keys absent from English | FR-2 |

**Existing test updates** are the bulk of the work here. Every assertion on visible text needs
review. This is unglamorous and is where regressions will be caught.

### Manual verification

1. Load the app in English → **visually identical to before**.
2. Add a stub second locale, switch → strings change, layout holds.
3. Set a browser locale with no catalogue → falls back to English cleanly.
4. Delete a key from a stub catalogue → English fallback, no raw key visible.
5. Interpolate a path containing `<script>` → rendered as text.
6. Screen reader with a non-English locale → **accessible labels are translated** (FR-8).
7. Verify Claude's output, git errors, and file paths remain untranslated.
8. Measure bundle size before and after (§16.2).

Check 6 is the one most likely to be skipped and is the reason FR-8 exists.

---

## 13. Rollout & migration

- **Ship in two phases.** Phase 1: mechanism, types, lint rule, and the sweep — English only,
  no visible change. Phase 2: contributed locales, as they arrive.
- The sweep is a very large diff with **no user-visible benefit**, which makes it hard to
  review and easy to regress. Splitting by area — chat, launch, settings, history — is
  strongly advisable.
- Settings version bump; coordinate with the other five PRDs (§8).
- `CLAUDE.md` must document the catalogue, the key convention, the lint rule, and the
  translation-contribution process.
- Minor release.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **Large diff with no visible benefit regresses working UI** | **Medium** | **High** | Phased by area (§13); existing tests as the net; manual check 1 |
| 2 | **Cost grows with every PRD shipped first** | **Certain** | **High** | §1.2 — the ordering claim; decide now |
| 3 | Bundle grows materially | Medium | Medium | §7.1 evaluate `Intl.PluralRules` alternative; §10 lazy-load locales; measure |
| 4 | Literals creep back in | **High** without enforcement | Medium | FR-16 lint rule, FR-17 types |
| 5 | ARIA labels left untranslated | **Medium** | **High** | FR-8; manual check 6 |
| 6 | Claude output or git stderr accidentally translated | Medium | Medium | FR-13/FR-14; explicit check 7 |
| 7 | Interpolation escaping disabled for convenience | Low | **High** | §9.1; explicit test |
| 8 | Sentence fragments assembled, untranslatable | Medium | Medium | FR-15 interpolation rule |
| 9 | Six-way settings migration collision | Medium | Medium | §8 single shared migration |
| 10 | Locale formatting changes English output unexpectedly | Medium | Low | §6; regression test |

---

## 15. Acceptance criteria

- [ ] All user-facing strings come from a catalogue
- [ ] **Accessible names and ARIA labels are translated**
- [ ] English is the default and fallback; missing keys never render raw
- [ ] Locale detected from the browser, overridable, and persisted
- [ ] Pluralisation handled by the library, not concatenation
- [ ] Interpolation used rather than sentence assembly; values escaped
- [ ] Dates, times, and numbers locale-formatted
- [ ] **Claude output, git stderr, paths and ids pass through untranslated**
- [ ] Adding a language requires only a new catalogue file
- [ ] Catalogue is type-safe; a bad key fails `make check`
- [ ] Lint rule flags new literals, with a configured allowlist
- [ ] Unused keys detectable
- [ ] **English UI is visually unchanged after the sweep**
- [ ] Non-default locales lazily loaded
- [ ] Bundle size impact measured and recorded
- [ ] `CLAUDE.md` documents the catalogue and contribution process
- [ ] `make check` passes

---

## 16. Open questions

1. **Should this be done at all?** §1.2 frames it as binary. If the answer is "not in the
   foreseeable future", this PRD should be **closed rather than deferred**, so nobody keeps
   paying the option cost of leaving it open.
2. **`i18next`, or `Intl.PluralRules` plus a thin wrapper?** §7.1 leans toward `i18next` for
   plural correctness, but the platform now covers the hard part natively. Measure both, and
   weigh against the bundle discipline in `CLAUDE.md`.
3. **Should the sweep include `DemoPage`?** It is dev-only (`frontend/src/App.tsx:10-16`) and
   never ships to users. Skipping it saves effort; including it keeps the lint rule simple.
   Recommendation: skip, with a lint exclusion.
4. **Is RTL support in scope later?** Adding Arabic or Hebrew would need layout mirroring,
   which Astryx may or may not support. Worth knowing before promising any language.
5. **Which languages would actually be wanted?** claudecodeui's 7 README translations are the
   only evidence available and are a reasonable starting hypothesis.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| Evaluate library vs `Intl` (§16.2), measure bundle | 4 h |
| i18n setup, provider, fallback chain | 5 h |
| Type-safe key derivation | 4 h |
| ESLint rule and allowlist tuning | 5 h |
| Locale-aware `time.ts` and number formatting | 4 h |
| **Sweep: chat area** | 6 h |
| **Sweep: launch screen and dialogs** | 6 h |
| **Sweep: history, settings, messages** | 6 h |
| Language selector in settings | 2 h |
| Settings migration | 1 h |
| **Update existing tests** | 8 h |
| New i18n and catalogue tests | 5 h |
| `CLAUDE.md` documentation | 2 h |
| Manual verification incl. screen reader | 3 h |
| **Total** | **≈61 h — 8 days** |

Effort 4 confirmed. **Note the sweep plus test updates is ~26 h — 43% of the total — and that
figure grows with every PRD shipped first.** After Milestones 3 and 4, it would plausibly be
half again as large.

That number is the concrete form of §1.2's argument.

---

## 18. References

- `frontend/src/utils/time.ts` — relative-time formatting to be made locale-aware
- `frontend/src/utils/storage.ts` — `AppSettings` persistence
- `frontend/src/components/SettingsModal.tsx`, `settings/GeneralSettings.tsx` — settings surface
- `frontend/src/App.tsx:10-16` — dev-only `DemoPage` (§16.3)
- `backend/handlers/projectSetup.ts:196-201` — git stderr surfaced verbatim (FR-13)
- `CLAUDE.md` § "Testing note" — assert on roles and `aria-*`, which eases the sweep
- `CLAUDE.md` § "Single Binary Distribution" — the bundle discipline weighing on §7.1
- `../01-claudecodeui-deep-scan.md` §3.12 — i18next and 7 README languages
- `../03-feature-comparison-matrix.md` — `UX-06`, deferred `ENG-03`
- `../04-uiux-workflow-comparison.md` §5 — where the total gap was identified
- `../06-prioritization-and-roadmap.md` §1, §3 — the strategic-value caveat and ordering claim
- `P24-tool-allowlist-ui.md` §7.3 — the settings-migration coordination this joins
