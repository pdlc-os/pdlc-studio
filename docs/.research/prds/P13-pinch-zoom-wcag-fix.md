# P13 — Pinch-Zoom / WCAG 1.4.4 Fix

| Field | Value |
| --- | --- |
| **Priority** | **P13** of 30 |
| **Score** | **13.5** |
| **Inputs** | Value 3 · Reach 3 · GapWeight ×1.5 · Effort 1 |
| **Category** | Mobile, Responsive & PWA · Design System, Theming & Accessibility |
| **Matrix features** | `MOB-06` (pinch-zoom not disabled) |
| **Maturity** | PDLC Studio **0** → target **4** · claudecodeui UNVERIFIED |
| **Effort** | **1** — the smallest in the pack |
| **Depends on** | Nothing |
| **Blocks** | Nothing |
| **Status** | Proposed — **ship with P05** |

---

## 1. Context & problem statement

`frontend/index.html:15` disables pinch-zoom on every touch device:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
```

`user-scalable=no` prevents a user from zooming the page. On a phone or tablet, someone who
cannot comfortably read the text at its rendered size has **no recourse inside the
application**.

This fails **[WCAG 2.1 Success Criterion 1.4.4 Resize Text](https://www.w3.org/WAI/WCAG21/Understanding/resize-text.html)**
(Level AA), which requires text be resizable up to 200% without loss of content or
functionality. It also runs against
[SC 1.4.10 Reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow.html).

### Why this is worth a PRD rather than a drive-by fix

Two reasons.

**First, it contradicts the project's own standard.** PDLC Studio's accessibility practice
is genuinely strong — `05-feature-categories-and-maturity.md` scores it **5** in Design
System & A11y, its clearest lead over claudecodeui, which ships no accessibility tooling at
all. `CLAUDE.md` mandates asserting on behaviour and state (`data-selected`, `aria-*`,
roles) and **never** on generated StyleX class names, which makes accessible markup
structurally necessary rather than optional.

Against that background, `user-scalable=no` is an outlier. `04-uiux-workflow-comparison.md`
§4 puts it plainly:

> **The defect**: `user-scalable=no` in the viewport meta disables pinch-zoom. This fails
> WCAG 2.1 SC 1.4.4 and contradicts everything above.

**Second, removing it is not risk-free**, which is why it needs more than a one-line commit.
The attribute is usually added deliberately — to stop double-tap zoom on interactive
elements, or to prevent iOS Safari's auto-zoom when focusing an input with a font size below
16px. If either was the motivation here, removing the attribute without addressing the
underlying cause will produce a visible regression on mobile. §7.2 covers this.

### Why P13 rather than higher

Effort 1 and a genuine accessibility defect. It ranks below the other effort-1 items only
because its reach is limited to touch users who need zoom — a real population, but smaller
than "everyone who hits a rate limit" (P02) or "everyone who copies a code block" (P03).

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Cited as evidence of value only.

claudecodeui's viewport meta is **UNVERIFIED** — its `index.html` was not read. Given that
mobile is its headline use case and that it ships no accessibility tooling in 35
devDependencies, it may well have the same defect.

**This PRD does not rest on a competitor comparison.** It rests on a specific, named WCAG
Level AA criterion and on the project's own stated standards. That is a stronger basis than
parity.

---

## 3. Goals & non-goals

### Goals

1. Users can pinch-zoom on touch devices.
2. Text scales to at least 200% without loss of content or functionality.
3. Whatever `user-scalable=no` was preventing is addressed properly rather than reintroduced.
4. The fix is protected by a test so it cannot silently regress.

### Non-goals

- **A full WCAG audit.** Worthwhile, but a different piece of work. This PRD fixes one named
  criterion.
- **Mobile layout redesign.** That is P29.
- **PWA manifest work.** That is P05 — though both touch `frontend/index.html` and should
  ship together (§13).
- **Desktop zoom.** Browser zoom already works; this is specifically about touch.

---

## 4. Personas & user stories

**Priya — low vision, uses a phone.**

> As a user with low vision, I want to pinch-zoom, so that I can read a code block that is
> rendered too small for me.

**Marcus — reading a dense diff on a train.**

> As a user on a small screen, I want to zoom into a specific region, so that I can read
> detail without a laptop.

**Devon — reviewing accessibility before recommending the tool internally.**

> As someone evaluating this for a team, I want it to meet WCAG AA basics, so that adopting
> it does not create a compliance problem.

---

## 5. Functional requirements

- **FR-1** `user-scalable=no` **MUST** be removed from the viewport meta in
  `frontend/index.html`.
- **FR-2** `maximum-scale` **MUST NOT** be set to a value below `5`. Setting
  `maximum-scale=1` is equivalent to `user-scalable=no` in effect and fails the same
  criterion.
- **FR-3** The viewport meta **MUST** retain `width=device-width, initial-scale=1.0`.
- **FR-4** Text **MUST** remain readable and functional at 200% zoom, with no content
  clipped or made unreachable.
- **FR-5** No horizontal scrolling **MUST** be introduced at 320 CSS pixels wide at 200%
  zoom, per SC 1.4.10.
- **FR-6** Any interactive element that relied on zoom suppression to avoid double-tap zoom
  **MUST** be addressed with `touch-action` rather than by disabling zoom globally.
- **FR-7** Text inputs **MUST NOT** trigger iOS auto-zoom on focus — which requires a
  computed font size of at least **16px** on those inputs (§7.2).
- **FR-8** An automated test **MUST** assert the viewport meta does not disable scaling, so
  the fix cannot silently regress.

---

## 6. UX & interaction specification

### The change

```diff
- <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
+ <meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

Omitting `user-scalable` and `maximum-scale` entirely is preferable to setting them
permissively — the defaults already allow scaling, and an explicit `maximum-scale=5` invites
a future edit to tighten it.

### What the user gains

| Before | After |
| --- | --- |
| Pinch does nothing | Pinch zooms |
| Double-tap does nothing | Double-tap zooms to fit a block |
| Text stuck at rendered size | Text scalable to browser maximum |
| Zoomed-out code blocks unreadable | Zoomable |

### What might regress

Honest accounting, because this is the whole risk of the PRD:

| Possible regression | Cause | Handling |
| --- | --- | --- |
| Double-tap zooms when the user meant to tap twice | Zoom now enabled | `touch-action: manipulation` on affected controls (FR-6) |
| iOS zooms in when focusing the composer | Input font size < 16px | Ensure ≥16px computed (FR-7) |
| Layout breaks when zoomed | Fixed positioning, viewport units | Verify at 200% (FR-4, FR-5) |

### Verification target

At **320 CSS px wide and 200% zoom** — the SC 1.4.10 reference condition — the transcript,
composer, and header must all remain usable with no horizontal page scroll.

Note that wide content *inside* its own scroll container is fine and expected: Astryx
`CodeBlock` scrolls horizontally by default, and has an `isWrapped` prop if wrapping is
preferred. What must not happen is the **page body** scrolling horizontally.

---

## 7. Technical design

### 7.1 The change itself

One line in `frontend/index.html`. That is the entire code change.

Note the file also contains a documented inline anti-FOUC script that sets `data-theme`
before React mounts, with a careful comment explaining why it must not set
`style.colorScheme`. **Do not disturb it** — it is load-bearing and well reasoned.

### 7.2 Investigate why the attribute is there

**This is the real work.** `git log`/`git blame` on `frontend/index.html` should show when
`user-scalable=no` was introduced and whether the commit message explains it.

Three likely origins:

| Origin | Consequence |
| --- | --- |
| **Copied boilerplate** — most likely | Nothing to fix; remove and verify |
| **Suppressing iOS input auto-zoom** | Must fix font sizes (FR-7) or the composer will zoom on focus |
| **Suppressing double-tap zoom** on chat controls | Must apply `touch-action: manipulation` (FR-6) |

The iOS auto-zoom case is the one to check carefully. Safari zooms the viewport when a user
focuses an input whose computed font size is below 16px, and it does **not** zoom back out.
That is genuinely disruptive, and it is the most common legitimate reason teams reach for
`user-scalable=no`.

Because the composer is an Astryx `TextArea` (`CLAUDE.md` notes "TextArea owns composer
sizing"), its font size is set by design-system tokens rather than app CSS. So FR-7 may
require either a documented Astryx size variant that yields ≥16px, or a narrow token
override. **Check the computed size on a real iOS device before assuming it is fine.**

### 7.3 Where `touch-action` would go, if needed

`CLAUDE.md` restricts app CSS to the existing app-shell classes (`.app-shell`, `.app-scroll`,
`.app-chat-region`, `.launch-*`) in `frontend/src/index.css`. If FR-6 turns out to be
necessary, `touch-action: manipulation` on `.app-chat-region` is the appropriate scope —
targeted, on an existing class, not a new utility.

Do **not** add a new utility class. Do **not** apply `touch-action` globally, which would
suppress double-tap zoom everywhere and partially recreate the defect.

### 7.4 The regression test

FR-8 needs a test that reads `frontend/index.html` and asserts the viewport meta permits
scaling. This is unusual — a test over a static asset rather than a component — but there is
precedent in this codebase: `AppIcon.test.tsx` compares SVG geometry across `brand/`,
`frontend/public/`, and inlined source, failing `make check` on drift.

P05 also proposes asserting on `index.html` (that the manifest link is present). **These two
assertions belong in the same test file**, since both guard the same file against the same
class of accidental edit.

Assert on absence of `user-scalable=no` **and** on `maximum-scale` being absent or ≥5
(FR-2) — checking only the former would let an equivalent regression through.

### 7.5 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| Static-asset assertion precedent | `AppIcon.test.tsx` | `frontend/src/components/` |
| App-shell classes for `touch-action` | `.app-chat-region` | `frontend/src/index.css` |
| Composer sizing | Astryx `TextArea` | design system |

---

## 8. Data model & persistence

**None.**

---

## 9. Security implications

**None.** Enabling zoom grants no capability and exposes no data.

Marginally positive: an accessibility barrier that forces users to work around the app —
copying content elsewhere to read it — is worse for data handling than letting them read it
in place.

---

## 10. Performance & scale

**None.** Removing an attribute has no runtime cost. Zoom is handled by the browser
compositor.

---

## 11. Telemetry & observability

None.

---

## 12. Test plan

### Automated — `make test-frontend`

New assertions, colocated with P05's (§7.4):

| Test | Asserts |
| --- | --- |
| Viewport meta does not contain `user-scalable=no` | FR-1 |
| Viewport meta has no `maximum-scale` below 5 | FR-2 |
| Viewport meta retains `width=device-width` and `initial-scale=1.0` | FR-3 |

If FR-7 requires a font-size change, add a component test asserting the composer's computed
font size is ≥16px — asserting on **computed style**, not on class names, per `CLAUDE.md`.

### Manual — the substantive verification

Automated tests confirm the attribute is gone. They cannot confirm the app is usable when
zoomed. This must be done on real devices.

**iOS Safari** — the platform where regressions are most likely:

1. Pinch-zoom in the transcript → zooms.
2. Double-tap a code block → zooms to fit.
3. **Tap the composer → the page does not auto-zoom** (FR-7). *The critical check.*
4. Type a message while zoomed → composer stays usable and visible.
5. Rotate to landscape while zoomed → no layout break.

**Android Chrome**:

6. Pinch-zoom works.
7. Double-tap on chat controls does not fire the control twice (FR-6).

**Desktop, emulating 320 px at 200%** (SC 1.4.10):

8. No horizontal scrolling of the page body (FR-5).
9. Composer, header, and transcript all reachable (FR-4).
10. Wide code blocks scroll within their own container, not the page.

**Regression sweep**:

11. Permission dialogs usable while zoomed.
12. Launch screen and folder picker usable while zoomed.

---

## 13. Rollout & migration

No migration, no persisted state, no wire change.

**Ship with P05 (PWA installability).** Both are single-line-ish changes to
`frontend/index.html`, both add assertions to the same test file, and both need the same
real-device verification pass. Reviewing and testing them as one diff is materially cheaper
than doing it twice. P05 §13 makes the same recommendation.

Release notes should say plainly that pinch-zoom now works — users who previously found the
app unusable on a phone will not otherwise discover the fix.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **iOS auto-zooms on composer focus once zoom is enabled** | **Medium** | **High** | §7.2 investigation; FR-7 ≥16px; explicit device check |
| 2 | Double-tap zoom interferes with chat controls | Medium | Medium | FR-6 `touch-action: manipulation` on `.app-chat-region` only |
| 3 | Layout breaks at 200% zoom | Medium | Medium | FR-4/FR-5 verification at 320 px |
| 4 | Attribute is reintroduced later by someone fixing a mobile bug | **Medium** | Medium | FR-8 test; comment in `index.html` explaining why it must not return |
| 5 | Astryx `TextArea` cannot reach 16px without a token override | Low | Medium | §7.2 — check computed size first; narrow override if required |
| 6 | `touch-action` applied globally, recreating the defect | Low | Medium | §7.3 — scope to the existing app-shell class only |

**Risk 4 deserves the comment.** A future contributor debugging a mobile tap issue will find
`user-scalable=no` an attractive fix. An inline comment naming WCAG 1.4.4 and pointing at
the test is the cheapest possible defence.

---

## 15. Acceptance criteria

- [ ] `user-scalable=no` removed from `frontend/index.html`
- [ ] No `maximum-scale` below 5
- [ ] `width=device-width, initial-scale=1.0` retained
- [ ] Inline anti-FOUC theme script untouched
- [ ] Comment added explaining why scaling must not be disabled again
- [ ] Pinch-zoom works on iOS Safari and Android Chrome
- [ ] **Focusing the composer on iOS does not auto-zoom**
- [ ] Double-tap does not double-fire chat controls
- [ ] At 320 px and 200% zoom: no horizontal page scroll, all controls reachable
- [ ] Wide code blocks scroll in their own container, not the page
- [ ] Automated assertions on the viewport meta, colocated with P05's
- [ ] No new CSS utility classes
- [ ] `make check` passes

---

## 16. Open questions

1. **Why was `user-scalable=no` added?** Blocking for scoping. Check `git log`/`git blame` on
   `frontend/index.html` first. If it was deliberate, the underlying cause must be fixed, not
   just the symptom.
2. **What is the composer's computed font size on iOS?** Determines whether FR-7 is free or
   requires an Astryx token override. Must be measured on a device, not assumed.
3. **Is a real iOS device available for verification?** Simulator behaviour for input
   auto-zoom is not always faithful. If not, this ships with a stated caveat rather than a
   false claim of verification.
4. **Should this trigger a broader WCAG audit?** The project's a11y practice is strong and
   this defect was found by inspection rather than by tooling — which suggests there is no
   tooling. Adding `eslint-plugin-jsx-a11y` or an axe check to `make check` is a natural
   follow-up and would have caught this. Out of scope here; worth filing.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| Investigate origin via `git blame` (§7.2) | 0.5 h |
| Remove the attribute; add explanatory comment | 0.25 h |
| Check and if needed fix composer font size (FR-7) | 1.5 h |
| `touch-action` scoping, if needed (FR-6) | 0.5 h |
| Automated viewport assertions | 1 h |
| Manual device verification, iOS + Android + 320 px | 2 h |
| **Total** | **≈5.75 h — under 1 day** |

The smallest item in the pack. Note that **verification is more than half the effort** —
which is the right ratio for a change whose risk is entirely in what it might regress rather
than in what it does.

---

## 18. References

- `frontend/index.html:15` — the viewport meta containing `user-scalable=no`
- `frontend/index.html:17-42` — the anti-FOUC theme script that must not be disturbed
- `frontend/src/index.css` — `.app-shell`, `.app-chat-region` and the app-CSS restriction
- `frontend/src/components/AppIcon.test.tsx` — precedent for asserting on static assets
- `CLAUDE.md` § "Chat UI" — Astryx `TextArea` owns composer sizing
- `CLAUDE.md` § "Testing note" — assert on behaviour and state, never class names
- [WCAG 2.1 SC 1.4.4 Resize Text](https://www.w3.org/WAI/WCAG21/Understanding/resize-text.html)
- [WCAG 2.1 SC 1.4.10 Reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow.html)
- `../03-feature-comparison-matrix.md` — `MOB-06`
- `../04-uiux-workflow-comparison.md` §4 — where the defect was identified
- `P05-pwa-installability.md` §13 — the shared-shipping recommendation
