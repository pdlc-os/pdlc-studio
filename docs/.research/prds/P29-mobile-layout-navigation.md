# P29 — Mobile Layout & Navigation

| Field | Value |
| --- | --- |
| **Priority** | **P29** of 30 |
| **Score** | **4.5** |
| **Inputs** | Value 3 · Reach 3 · GapWeight ×1.5 · Effort 3 |
| **Category** | Mobile, Responsive & PWA |
| **Matrix features** | `MOB-01` (responsive layout), and `MOB-05` (mobile navigation) folded in |
| **Maturity** | PDLC Studio **2** → target **4** · claudecodeui **4** |
| **Effort** | **3** |
| **Depends on** | P13 (pinch-zoom) and P05 (PWA) should land first. **P14 for safe remote use** |
| **Blocks** | Nothing |
| **Status** | Proposed |

---

## 1. Context & problem statement

The README claims "Mobile-responsive design — touch-optimized interface for any device"
(`README.md:90`), and ships iPhone-SE-width screenshots
(`docs/.reference/images/screenshot-mobile-*.png`).

The reality is thinner. `02-pdlc-studio-baseline.md` §3.12 scores it **2** — Prototype — and
the code supports that:

- The only responsive logic in the app is `MESSAGE_CONSTANTS.MAX_DISPLAY_WIDTH`, which
  switches message width between `MOBILE: "85%"` and `DESKTOP: "70%"`
  (`frontend/src/utils/constants.ts:14-17`).
- Everything else is whatever Astryx provides by default.
- There is no mobile navigation pattern — no drawer, no bottom bar. The desktop layout simply
  narrows.
- The launch screen is an **Xcode-style 60/40 split panel** (`CLAUDE.md`, "Launch screen"),
  a layout that does not work at 375px and whose chrome lives in hand-written `.launch-*`
  classes.

`04-uiux-workflow-comparison.md` §2 Journey G puts it plainly:

> The honest reading: *responsive*, yes. *A mobile app experience*, no.

### The problem is about to get worse

Three PRDs each add something to the chat header: **P04** usage and cost, **P09** the model
selector, **P23** context pressure. All three flag header crowding as a risk and defer to a
"shared responsive strategy" that no PRD currently owns.

**P29 is where that strategy should live.** Without it, three PRDs will each invent their own
breakpoint behaviour and the header will be incoherent.

Similarly, **P07** introduces a side panel that must overlay rather than compress the chat on
narrow viewports, and **P15**, **P16**, and **P25** all add content to it.

### Why P29 is second-to-last

Score 4.5 — the lowest but one. Effort 3 against value 3 and reach 3. The scoring is honest:
mobile use of PDLC Studio is currently a niche, **because it is gated on security**. Reaching
the app from a phone requires `--host 0.0.0.0`, which without authentication exposes the
machine.

So the ordering has a certain logic: fix the security (P14), make it installable (P05), fix
the accessibility defect (P13), and *then* invest in the layout. Investing heavily in mobile
before P14 would be polishing a door that should not be opened.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Observable capability only.

claudecodeui scores 4, and mobile is its **headline positioning**:

> "Works seamlessly across desktop, tablet, and mobile so you can also use Agents from
> mobile."

Its GitHub description leads with *"A desktop and mobile UI for Claude Code, Cursor CLI, and
Codex… use it locally or remotely to view your active projects and sessions from everywhere."*

This is coherent for them because they have JWT authentication, an authenticated WebSocket, a
`0.0.0.0` default bind, Web Push, and a paid hosted tier. Remote mobile access is the product.

**PDLC Studio should not copy the positioning**, only the layout competence. Its identity is a
local-first tool with an excellent single binary. Mobile is a convenience, not the pitch.

There is one structural disadvantage worth naming: claudecodeui uses **Tailwind**, whose
responsive variants make per-breakpoint layout trivial. PDLC Studio uses **Astryx with no
utility classes** (`CLAUDE.md`), so responsive behaviour must come from component props,
container queries, or the small set of permitted app-shell classes. §7.2 addresses this
directly — it is the main technical constraint.

---

## 3. Goals & non-goals

### Goals

1. Every surface is usable at 375px without horizontal scrolling.
2. The launch screen works on a phone.
3. Header content degrades coherently as width shrinks — **one strategy, owned here**.
4. Side panels overlay rather than compress.
5. Touch targets meet accessibility minimums.
6. No Tailwind, no utility classes, no new styling primitive.

### Non-goals

- **PWA installability.** P05.
- **Pinch-zoom.** P13.
- **Push notifications.** `MOB-04`, rejected.
- **Offline support.** `MOB-03`, deferred.
- **A separate mobile codebase or route tree.** One responsive app.
- **Native apps.** Out of scope; `PLAT-05` (Electron) is rejected on similar grounds.
- **Promoting remote access.** Same constraint P05 §3.1 and P18 §3.1 impose — see §9.

---

## 4. Personas & user stories

**Devon — checking on a long-running task from the sofa.**

> As a user, I want to read a session and send a follow-up from my phone, so that I do not
> have to return to my desk to unblock an agent.

**Marcus — tablet as a second screen.**

> As a tablet user, I want the layout to use the space properly, rather than showing a
> narrowed desktop layout.

**Priya — small laptop.**

> As a user on a 1280px screen with a side panel open, I want the chat to remain readable
> rather than squeezed into a column.

Priya's story is worth noting: **this is not only about phones.** The header-crowding and
panel-compression problems appear well before phone widths.

---

## 5. Functional requirements

### Layout

- **FR-1** All surfaces **MUST** be usable at **375px** wide without horizontal page scrolling.
- **FR-2** They **MUST** remain usable at 320px, the WCAG reflow reference width.
- **FR-3** Wide content **MUST** scroll within its own container, never the page body.
- **FR-4** The launch screen's split panel **MUST** reflow to a single column on narrow
  viewports.
- **FR-5** Dialogs **MUST** be usable at narrow widths, with reachable actions.

### Header

- **FR-6** A **single, shared** degradation strategy **MUST** be defined and used by all header
  content.
- **FR-7** Below a defined width, secondary header content **MUST** collapse into one overflow
  affordance.
- **FR-8** Collapsed content **MUST** remain reachable.
- **FR-9** The strategy **MUST** accommodate P04, P09, and P23 without each defining its own.

### Panels

- **FR-10** Side panels (P07, P15, P16, P25) **MUST** overlay rather than compress below a
  defined width.
- **FR-11** An overlaid panel **MUST** be dismissible by an obvious gesture or control.
- **FR-12** Opening a panel **MUST NOT** lose the chat's scroll position.

### Touch

- **FR-13** Interactive targets **MUST** be at least **44×44 CSS pixels**.
- **FR-14** Controls that appear on hover **MUST** be visible or reachable without hover.
- **FR-15** The composer **MUST** remain visible when the on-screen keyboard is open.

### Accessibility

- **FR-16** Focus order **MUST** remain logical at every breakpoint.
- **FR-17** Content **MUST NOT** be hidden from assistive technology purely because it is
  visually collapsed.
- **FR-18** Overlaid panels **MUST** trap focus while open and restore it on close.
- **FR-19** Reflow **MUST** satisfy WCAG 1.4.10 at 320px and 400% zoom.

FR-14 matters more than it appears: **P03's copy button** and **P19's file references** both
use hover-revealed affordances. On touch there is no hover, so those controls would be
permanently invisible without this requirement.

---

## 6. UX & interaction specification

### Breakpoints

Three, deliberately few:

| Name | Width | Behaviour |
| --- | --- | --- |
| Compact | < 640px | Single column; panels overlay; header collapses to overflow |
| Medium | 640–1023px | Panels overlay; header shows a reduced set |
| Wide | ≥ 1024px | Panels inline; full header |

Panels overlay at *medium* as well as compact — Priya's story. A 900px window with a file tree
compressing the chat to 500px is a poor experience even though it is not a phone.

### Header degradation (FR-6)

**This is the deliverable other PRDs are waiting for.**

| Breakpoint | Header shows |
| --- | --- |
| Wide | mark · project · usage+cost (P04) · pressure (P23) · model (P09) · settings |
| Medium | mark · project · usage (P04) · model (P09) · overflow |
| Compact | mark · project · **overflow only** |

The overflow control opens a sheet containing everything collapsed (FR-8). Each of P04, P09,
and P23 registers its content into that mechanism rather than deciding its own visibility.

### Launch screen (FR-4)

The 60/40 split becomes a single column: identity and actions first, Recent Projects below.

`CLAUDE.md` explains why the chrome is hand-written CSS:

> Layout chrome lives in the `.launch-*` classes in `src/index.css` because Astryx has no
> split-panel or grid primitive and `Card` cannot clip a child's background to its own
> rounded corners.

So this is one of the few places where app CSS legitimately changes. It also documents two
token traps to respect: `--radius-xl` does not exist (`--radius-page` does), and
`--color-background-muted` is identical to `--color-background-body` in theme-neutral, so it
gives no contrast.

### Panel overlay (FR-10)

```
Compact                    Wide
┌──────────────┐          ┌────────┬──────────────┐
│ ▓ Files    ✕ │          │ Files  │  Chat        │
│ ▓            │          │        │              │
│ ▓  overlays  │          │ inline │              │
│ ▓  the chat  │          │        │              │
└──────────────┘          └────────┴──────────────┘
```

Dismissible by a close control and by `Escape` (FR-11), with focus trapped while open
(FR-18).

### The keyboard problem (FR-15)

On iOS, the on-screen keyboard shrinks the visual viewport without changing layout viewport
height, which commonly pushes a bottom-anchored composer off-screen.

The modern fix is the `VisualViewport` API or `dvh` units. **This must be verified on a real
device** — it is the single most common mobile layout bug in chat interfaces, and simulators
do not reproduce it faithfully.

---

## 7. Technical design

### 7.1 Establish the breakpoints once

A single module defining the three breakpoints and a hook exposing the current one:

```ts
// frontend/src/utils/breakpoints.ts
export const BREAKPOINTS = { compact: 640, medium: 1024 } as const;

// frontend/src/hooks/useBreakpoint.ts
export function useBreakpoint(): "compact" | "medium" | "wide";
```

Implemented with `matchMedia`, not resize listeners.

`MESSAGE_CONSTANTS.MAX_DISPLAY_WIDTH` (`frontend/src/utils/constants.ts:14-17`) is the
existing ad-hoc version of this and should be folded in.

### 7.2 Responsive without utility classes — the core constraint

`CLAUDE.md` is unambiguous:

> There is no Tailwind and no utility-class styling — build UI by composing Astryx
> components… App CSS below that block is unlayered… Keep it to the few app-shell classes
> that already exist. **Do not add utility classes.**

So the available mechanisms are:

| Mechanism | Use |
| --- | --- |
| **Astryx responsive props** | First choice — check what components accept |
| **`useBreakpoint()` + conditional rendering** | For structural changes like overflow collapse |
| **Container queries in existing app-shell classes** | For layout that should respond to its container, not the viewport |
| **Media queries in `.launch-*`** | For the launch screen specifically (§6) |

**Container queries are the most promising and least explored.** A side panel should respond to
its own width, not the viewport's — which is exactly what container queries express and what
media queries cannot.

**Investigate Astryx's own responsive support first** (§16.1). It ships `Layout` — described as
a "page shell with header, sidebar(s), content, and footer slots for building full app
layouts" — which may already handle panel and header behaviour. If it does, this PRD shrinks
considerably; if it does not, more falls to conditional rendering.

### 7.3 The header overflow mechanism

A small registry so P04, P09, and P23 contribute rather than each deciding visibility:

```ts
export interface HeaderItem {
  id: string;
  priority: number;                  // higher survives longer
  render: (mode: "inline" | "sheet") => ReactNode;
}
```

Items above the breakpoint's cutoff render inline; the rest render inside the overflow sheet.
Each PRD registers one item and provides both presentations.

This mirrors P17's palette-source registry and P12's shortcut registry — the same pattern of
"one mechanism, several contributors" that has kept those PRDs from colliding.

### 7.4 Touch targets

FR-13's 44×44 minimum is a design-system concern. Astryx components have their own sizing;
where a small variant falls below the minimum on touch, the fix is choosing a larger variant —
**not** overriding with app CSS.

FR-14's hover-only problem needs auditing across P03 (copy), P19 (file references), and any
row-hover affordances. The general rule: **on coarse pointers, show it.**

### 7.5 Components

| Item | Purpose |
| --- | --- |
| New `frontend/src/utils/breakpoints.ts` | Single source of breakpoints |
| New `frontend/src/hooks/useBreakpoint.ts` | Current breakpoint |
| New `frontend/src/components/AppHeader.tsx` | Header with the overflow mechanism |
| Modify `frontend/src/components/ProjectSelector.tsx` + `.launch-*` | FR-4 |
| Modify `frontend/src/components/ChatPage.tsx` | Panel overlay behaviour |
| Modify `frontend/src/utils/constants.ts` | Fold in `MAX_DISPLAY_WIDTH` |

### 7.6 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| Page shell with slots | **Astryx `Layout`** | design system |
| Existing width constants | `MESSAGE_CONSTANTS` | `frontend/src/utils/constants.ts` |
| Launch chrome | `.launch-*` | `frontend/src/index.css` |
| App shell classes | `.app-shell`, `.app-scroll`, `.app-chat-region` | `frontend/src/index.css` |
| Panel shell | `FilePanel` (P07) | `frontend/src/components/files/` |
| Sheet/dialog primitives | Astryx | design system |

---

## 8. Data model & persistence

**None.** Breakpoint state is derived from the viewport. Panel open/closed persists via
P07's existing `AppSettings` field.

One consideration: a panel left open on a wide screen and then opened on a narrow one should
probably not auto-open as an overlay. Panel state may need to be breakpoint-aware, or simply
default closed on compact.

---

## 9. Security implications

No direct implications — this is layout.

**One constraint carries over.** P05 §3.1 and P18 §3.1 both establish that work making the app
more attractive on other devices must not *promote* unauthenticated network exposure.
The same applies here, and more strongly, because this PRD is explicitly about making the app
good on a phone — and a phone is not the machine the server runs on.

> **This PRD MUST NOT add `--host 0.0.0.0` guidance to documentation, onboarding, or release
> notes until P14 has shipped.**

Improving the layout widens no exposure by itself. Telling users how to reach it from their
phone, before authentication exists, would.

If P14 has shipped, this constraint lifts — and P29 becomes the natural moment to document
remote use properly, including the TLS caveat P14 §9.1 requires.

---

## 10. Performance & scale

- `matchMedia` listeners are cheap; avoid resize-event listeners, which fire continuously.
- Conditional rendering at breakpoints causes remounts. Where a component is expensive — the
  transcript especially — prefer CSS-driven changes so it is not torn down on rotation.
- Container queries are well supported in current browsers and have no meaningful cost.
- The overflow sheet should render lazily.

---

## 11. Telemetry & observability

None. No analytics.

---

## 12. Test plan

### Frontend — Vitest + Testing Library, `make test-frontend`

New `frontend/src/hooks/useBreakpoint.test.ts`:

| Test | Asserts |
| --- | --- |
| Returns compact/medium/wide at the right widths | §6 |
| Uses `matchMedia`, not resize events | §10 |
| Cleans up listeners on unmount | §10 |

New `frontend/src/components/AppHeader.test.tsx`:

| Test | Asserts |
| --- | --- |
| Wide shows all registered items inline | FR-6 |
| Compact shows only the overflow control | FR-7 |
| **Collapsed items remain reachable via the sheet** | FR-8 |
| **Collapsed items are not hidden from assistive technology** | **FR-17** |
| Registration order does not affect priority ordering | §7.3 |

`ProjectSelector` and `ChatPage` tests:

| Test | Asserts |
| --- | --- |
| Launch screen renders single-column at compact | FR-4 |
| Panel overlays at medium and compact | FR-10 |
| Overlaid panel traps focus and restores on close | FR-18 |
| Opening a panel preserves chat scroll position | FR-12 |
| Hover-only controls are visible on coarse pointers | FR-14 |

Per `CLAUDE.md`, assert on roles, `aria-*`, and behaviour — **never** on StyleX class names.
That rule matters unusually here, since the temptation is to assert on layout classes.

### Manual verification — the substantive half

Layout cannot be meaningfully unit-tested. Real devices required.

**iOS Safari:**
1. 375px: launch screen single column, no horizontal scroll.
2. Chat readable; composer reachable.
3. **Focus the composer → keyboard opens → composer stays visible** (FR-15). *The critical
   check.*
4. Open the file panel → overlays, dismissible, focus trapped.
5. Rotate while a panel is open → no layout break.
6. Copy button and file references visible without hover (FR-14).

**Android Chrome:** repeat 1–6.

**Desktop:**
7. 320px at 400% zoom → WCAG 1.4.10 reflow satisfied (FR-19).
8. 900px with a panel open → chat not squeezed (Priya's story).
9. Resize slowly across both breakpoints → no flicker, no lost scroll position.
10. Keyboard-only at each breakpoint → focus order sane (FR-16).
11. Verify touch targets meet 44×44 (FR-13).

---

## 13. Rollout & migration

- No persistence change, no wire change, no migration.
- **Ship after P13 and P05**, which are the cheap mobile fixes, and ideally after **P14**, which
  is what makes mobile use defensible (§9).
- **The header registry (§7.3) should land before or with P04**, since P04, P09, and P23 all
  depend on it. If P04 ships first, it should build the registry rather than a bespoke header.
- Minor release.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **iOS keyboard hides the composer** | **High** if unhandled | **High** | FR-15; `VisualViewport`/`dvh`; real-device check 3 |
| 2 | Responsive work drifts toward utility classes | **Medium** | **High** | §7.2 permitted mechanisms only; `CLAUDE.md` rule; review |
| 3 | Three PRDs invent separate header strategies | **High** if this lands late | Medium | §7.3 registry; §13 sequencing note |
| 4 | Breakpoint remounts tear down the transcript | Medium | Medium | §10 prefer CSS-driven changes |
| 5 | Collapsed header content hidden from AT | Medium | **High** | FR-17; explicit test |
| 6 | Launch screen reflow breaks the documented token traps | Medium | Low | §6 — `--radius-page`, muted-background caveat |
| 7 | Mobile polish encourages unauthenticated exposure | Medium | **High** | §9 constraint; sequence after P14 |
| 8 | Astryx `Layout` already does this and work is duplicated | Medium | Medium | §16.1 investigate first |
| 9 | Panel state restored inappropriately on a small screen | Low | Low | §8 default closed on compact |

---

## 15. Acceptance criteria

- [ ] All surfaces usable at 375px with no horizontal page scrolling
- [ ] Usable at 320px; WCAG 1.4.10 reflow satisfied at 400% zoom
- [ ] Wide content scrolls in its own container
- [ ] Launch screen reflows to a single column
- [ ] **One shared header degradation strategy, with a registry P04/P09/P23 use**
- [ ] Collapsed header content reachable and **exposed to assistive technology**
- [ ] Side panels overlay at medium and compact, dismissible, focus-trapped
- [ ] Opening a panel preserves chat scroll position
- [ ] **Composer stays visible with the on-screen keyboard open on iOS**
- [ ] Touch targets at least 44×44
- [ ] Hover-only controls visible on coarse pointers
- [ ] Focus order logical at every breakpoint
- [ ] Breakpoints defined in one module; `MAX_DISPLAY_WIDTH` folded in
- [ ] **No Tailwind, no utility classes; app CSS limited to existing app-shell classes**
- [ ] **No `--host 0.0.0.0` guidance added** unless P14 has shipped
- [ ] `make check` passes

---

## 16. Open questions

1. **What does Astryx `Layout` already provide?** It advertises header, sidebar, content, and
   footer slots. If it handles responsive collapse, much of §7.2 and §7.3 disappears.
   **Resolve first** — it is the largest scoping variable.
2. **Do Astryx components accept responsive props?** Determines how much falls to conditional
   rendering versus component configuration.
3. **Are container queries the right tool for panels?** They express "respond to your
   container" precisely, which is what FR-10 wants. Worth confirming they compose cleanly with
   Astryx's layered CSS.
4. **Should the transcript layout change at all on mobile**, beyond width? Message bubbles at
   85% already work reasonably. Possibly nothing more is needed.
5. **Should there be a bottom navigation bar?** `MOB-05` suggested one. But PDLC Studio has
   three routes, one dev-only — there is almost nothing to navigate between. Recommendation:
   **no**, the panel overlay plus header covers it. Adding a nav bar for a two-destination app
   would be cargo-culting claudecodeui's IDE structure into a product that deliberately does
   not have one.

Question 5 is a real product decision, and the recommendation to skip it follows the same
reasoning `04-uiux-workflow-comparison.md` §6 uses to reject a tabbed IDE layout.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| **Investigate Astryx `Layout` and responsive props (§16.1, §16.2)** | 3 h |
| Breakpoint module and hook | 2 h |
| Header registry and overflow sheet | 6 h |
| Launch screen reflow | 5 h |
| Panel overlay behaviour | 5 h |
| iOS keyboard handling | 4 h |
| Touch target and hover audit across P03/P19 | 3 h |
| Fold in `MAX_DISPLAY_WIDTH` | 1 h |
| Tests | 6 h |
| Manual verification across real devices | 5 h |
| **Total** | **≈40 h — 5 days** |

Verification is an eighth of the effort and should not be cut — every significant risk in §14
is one that only appears on a real device.

---

## 18. References

- `frontend/src/utils/constants.ts:14-17` — the entire current responsive logic
- `frontend/src/index.css` — `.app-shell`, `.app-chat-region`, `.launch-*`, and the token traps
- `frontend/src/components/ProjectSelector.tsx` — the split-panel launch screen
- `frontend/index.html:15` — viewport meta (P13 changes this)
- `CLAUDE.md` § "Design System (Astryx)" — no Tailwind, no utility classes
- `CLAUDE.md` § "Launch screen" — why `.launch-*` exists and its token gotchas
- `README.md:90` — the mobile-responsive claim
- `../02-pdlc-studio-baseline.md` §3.12 — the maturity-2 assessment
- `../04-uiux-workflow-comparison.md` §2 Journey G, §6
- `P04-token-usage-cost-visibility.md` §6 — header crowding, first raised
- `P09-model-selector.md` §6, `P23-context-window-pressure-indicator.md` §6 — the same problem
- `P05-pwa-installability.md` §3.1, `P14-authentication.md` §9 — the exposure constraint
- `P07-file-tree-read-only-file-viewer.md` §6 — panel overlay requirement
