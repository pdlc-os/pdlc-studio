# P12 — Keyboard Shortcut Expansion

| Field | Value |
| --- | --- |
| **Priority** | **P12** of 30 |
| **Score** | **13.5** |
| **Inputs** | Value 3 · Reach 3 · GapWeight ×1.5 · Effort 1 |
| **Category** | Design System, Theming & Accessibility |
| **Matrix features** | `UX-04` (keyboard shortcuts) |
| **Maturity** | PDLC Studio **2** → target **4** · claudecodeui UNVERIFIED |
| **Effort** | **1** |
| **Depends on** | Nothing. **Strongly complements P17** (command palette) — see §3.1 |
| **Blocks** | Nothing |
| **Status** | Proposed |

---

## 1. Context & problem statement

PDLC Studio has **exactly three keyboard shortcuts**, all declared in
`frontend/src/utils/constants.ts:5-10`:

```ts
export const KEYBOARD_SHORTCUTS = {
  ABORT: "Escape",
  SUBMIT: "Enter",
  PERMISSION_MODE_TOGGLE: "M",   // Ctrl+Shift+M
} as const;
```

They are well chosen. `Escape` to abort is the right binding, and the configurable Enter
behaviour (send vs. newline, persisted in `AppSettings`) is a thoughtful touch that many
larger products miss.

But three shortcuts is thin for an application whose users are, by definition, people who
live in a terminal. There is no binding for: starting a new session, opening history,
focusing the composer, returning to the project list, toggling the theme, or opening
settings. Each of those is a pointer round-trip.

There is a second problem, arguably larger: **the shortcuts that exist are not discoverable
from inside the app.** `Ctrl+Shift+M` is documented in `README.md:288` and in `CLAUDE.md`,
and nowhere in the interface. `04-uiux-workflow-comparison.md` §3 identifies this as part of
a wider pattern:

> PDLC Studio's weakest interaction property… The shortcut is documented in `CLAUDE.md` and
> the README — not in the app.

A shortcut nobody can find is, for most users, a shortcut that does not exist.

### Why P12 rather than higher

Effort 1 and a real quality-of-life gain for the product's core audience — but it is
convenience, not capability. Nothing is impossible without it.

### 3.1 Relationship to P17 (command palette)

`06-prioritization-and-roadmap.md` §3 records the dependency: P17 is where shortcuts become
discoverable, because a palette lists every action alongside its binding.

**These two PRDs should be designed together and can ship in either order**, but P12 should
define the action registry (§7.2) in a shape P17 can consume directly. Otherwise P17 will
rebuild it and the two will drift.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Cited as evidence of value only.

claudecodeui's specific bindings are **UNVERIFIED** — the scan did not read its keyboard
handling. What is verified is that it depends on **`cmdk ^1.1.1`** and ships a
`command-palette` component module.

That is the relevant signal: the mainstream answer to "many actions, limited memory" is a
palette rather than an ever-growing list of chords. Users do not memorise twenty bindings;
they memorise one and search.

**PDLC Studio's own design system already provides this.** Astryx ships a `CommandPalette`
component (root component managing open state, search, keyboard navigation, and composition
slots, with a `searchSource` prop). So P17 does not need `cmdk` or any equivalent — which
reinforces designing P12's registry to feed it.

---

## 3. Goals & non-goals

### Goals

1. Add bindings for the most frequent actions that currently require a pointer.
2. Make every binding discoverable from within the application.
3. Establish one registry of actions and bindings, rather than scattered key handling.
4. Avoid conflicts with browser and assistive-technology shortcuts.
5. Leave the three existing bindings unchanged.

### Non-goals

- **User-configurable rebinding.** Real scope; no demand signal. See §16.
- **Vim or Emacs modal editing.** Out of scope.
- **The command palette itself.** That is P17.
- **Changing existing bindings.** `Escape`, `Enter`, and `Ctrl+Shift+M` stay exactly as they
  are — muscle memory is a feature.
- **Shortcuts for features that do not exist yet.** Bindings for the file tree (P07) or git
  panel (P15) belong to those PRDs, registered through this PRD's registry.

---

## 4. Personas & user stories

**Devon — keyboard-first, never touches the mouse.**

> As a keyboard user, I want to start a new session and open history without reaching for
> the pointer, because every pointer round-trip breaks my flow.

**Marcus — daily driver who did not know `Ctrl+Shift+M` existed.**

> As an experienced user, I want to see what shortcuts are available, because I only learned
> about permission-mode cycling by reading the source.

**Priya — screen-reader user.**

> As an assistive-technology user, I want application shortcuts not to collide with my screen
> reader's own bindings, because a conflict makes the app unusable rather than merely
> inconvenient.

Priya's story drives FR-9 and is the reason single-letter bindings are rejected in §6.

---

## 5. Functional requirements

### Registry

- **FR-1** All shortcuts **MUST** be declared in one place, extending the existing
  `KEYBOARD_SHORTCUTS` in `frontend/src/utils/constants.ts`.
- **FR-2** Each entry **MUST** carry a stable action id, a human-readable label, and its
  binding — enough for P17 to render without a second source.
- **FR-3** Registration **MUST** support scope, so a binding can apply globally or only
  within a surface.

### New bindings

- **FR-4** There **MUST** be a binding to focus the composer.
- **FR-5** There **MUST** be a binding to start a new session in the current project.
- **FR-6** There **MUST** be a binding to open conversation history.
- **FR-7** There **SHOULD** be a binding to return to the project list.
- **FR-8** There **SHOULD** be a binding to toggle the theme.

### Safety

- **FR-9** Bindings **MUST NOT** collide with common browser shortcuts (`Ctrl/Cmd+T`, `+W`,
  `+N`, `+L`, `+R`, `+F`) or with standard screen-reader modifiers.
- **FR-10** Bindings **MUST NOT** fire while focus is in a text input, unless the binding is
  explicitly intended for that context (as `Enter` and `Escape` already are).
- **FR-11** Platform differences **MUST** be handled — `Cmd` on macOS, `Ctrl` elsewhere —
  and displayed accordingly.
- **FR-12** A shortcut whose action is unavailable **MUST** be inert, not error.

### Discoverability

- **FR-13** There **MUST** be an in-app way to see all shortcuts.
- **FR-14** That list **MUST** be generated from the registry, so it cannot drift from
  behaviour.
- **FR-15** Controls that have a binding **SHOULD** surface it in their tooltip or
  accessible name.
- **FR-16** The shortcuts list **MUST** itself be reachable by keyboard.

### Accessibility

- **FR-17** Shortcuts **MUST NOT** be the only way to reach any action.
- **FR-18** Displayed bindings **MUST** be readable by assistive technology as text, not as
  styled glyphs alone.
- **FR-19** Focus changes triggered by a shortcut **MUST** be announced.

---

## 6. UX & interaction specification

### Proposed bindings

| Action | Binding | Rationale |
| --- | --- | --- |
| Abort request | `Escape` | **Existing — unchanged** |
| Submit | `Enter` | **Existing — unchanged, configurable** |
| Cycle permission mode | `Ctrl/Cmd+Shift+M` | **Existing — unchanged** |
| Focus composer | `Ctrl/Cmd+Shift+I` | "Input". Also reachable by `Escape`-then-Tab today |
| New session | `Ctrl/Cmd+Shift+N` | Plain `Cmd+N` is a browser window — must be `Shift` |
| Open history | `Ctrl/Cmd+Shift+H` | Plain `Cmd+H` hides the app on macOS |
| Back to projects | `Ctrl/Cmd+Shift+P` | Consistent with the `Shift` family |
| Toggle theme | `Ctrl/Cmd+Shift+L` | Plain `Cmd+L` focuses the URL bar |
| Show shortcuts | `Ctrl/Cmd+/` | Widely established convention |

**Every new binding uses `Ctrl/Cmd+Shift`.** That is deliberate: it is the least-contested
modifier space, it avoids the browser shortcuts listed in FR-9, and it stays clear of screen
readers, which typically claim unmodified single letters and `Ctrl+Alt`.

**Single-letter bindings are rejected outright.** Applications that bind bare letters break
badly for screen-reader users in browse mode and for anyone using typeahead. The cost is
slightly longer chords; the benefit is not breaking Priya's story.

`Ctrl/Cmd+/` for the shortcut list is the one exception to the `Shift` family, because the
convention is strong enough to be worth matching.

### Shortcuts list

Reached by `Ctrl/Cmd+/` or from settings:

```
┌────────────────────────────────────────┐
│  Keyboard shortcuts                    │
│                                        │
│  Chat                                  │
│    Send message              Enter     │
│    Stop generating           Esc       │
│    Focus composer            ⌘⇧I       │
│    Cycle permission mode     ⌘⇧M       │
│                                        │
│  Navigation                            │
│    New session               ⌘⇧N       │
│    Conversation history      ⌘⇧H       │
│    Back to projects          ⌘⇧P       │
│                                        │
│  Application                           │
│    Toggle theme              ⌘⇧L       │
│    Show shortcuts            ⌘/        │
└────────────────────────────────────────┘
```

Generated from the registry (FR-14) and grouped by category. Rendered with Astryx dialog and
`Kbd`-style primitives; **no new CSS classes**, per `CLAUDE.md`.

Glyphs (`⌘⇧I`) are shown on macOS and spelled forms (`Ctrl+Shift+I`) elsewhere (FR-11), with
a text accessible name in both cases (FR-18).

### When shortcuts do not fire

FR-10 matters most in the composer, where the user is typing prose. The rule:

| Focus | Behaviour |
| --- | --- |
| Composer | Only `Enter` and `Escape` fire; chorded bindings still work |
| Any text input | Same |
| A dialog is open | Only that dialog's bindings fire |
| Elsewhere | All global bindings fire |

Modifier-chorded bindings are safe inside inputs — nobody types `Ctrl+Shift+N` as text — so
FR-10's restriction applies to unmodified keys, which is exactly why §6 avoids them.

---

## 7. Technical design

### 7.1 Current handling

Today, key handling lives with the components that need it: `ChatInput` handles `Enter` and
the permission-mode chord, `useAbortController` and `ChatPage` handle `Escape`. That is fine
for three bindings and does not scale to nine, and it makes FR-14's generated list
impossible — there is nothing to enumerate.

### 7.2 The registry

Extend `frontend/src/utils/constants.ts` rather than creating a parallel module, so the
existing three bindings and the new ones live together:

```ts
export type ShortcutScope = "global" | "chat" | "dialog";

export interface ShortcutDefinition {
  id: string;                 // stable, e.g. "chat.focusComposer"
  label: string;              // "Focus composer"
  category: string;           // "Chat"
  key: string;                // "I"
  modifiers: ReadonlyArray<"mod" | "shift" | "alt">;  // "mod" = Cmd/Ctrl
  scope: ShortcutScope;
  allowInInput?: boolean;
}
```

`"mod"` rather than `"ctrl"`/`"cmd"` keeps FR-11's platform difference in one place.

**This shape is what P17 consumes** (§3.1): `id`, `label`, and `category` are exactly what a
palette needs to render an action list.

### 7.3 The hook

New `frontend/src/hooks/useKeyboardShortcuts.ts`:

```ts
export function useKeyboardShortcuts(
  handlers: Partial<Record<string, () => void>>,
  scope: ShortcutScope,
): void;
```

- One `keydown` listener at the document level, not one per shortcut.
- Matches the event against the registry, respecting scope and `allowInInput`.
- Calls the handler if registered; otherwise inert (FR-12).
- Cleans up on unmount.

**The existing three bindings should migrate to this hook**, so behaviour and registry
cannot diverge. That migration is the riskiest part of an otherwise simple PRD — see §14.

### 7.4 Platform detection

`navigator.platform` is deprecated; prefer `navigator.userAgentData?.platform` with a
`navigator.userAgent` fallback. Detection belongs in one small utility so tests can stub it.

Note this affects **display** (`⌘` vs `Ctrl+`) as well as **matching** (`metaKey` vs
`ctrlKey`). Both must use the same detection.

### 7.5 Components

| Item | Purpose |
| --- | --- |
| New `frontend/src/hooks/useKeyboardShortcuts.ts` | Matching and dispatch |
| New `frontend/src/components/ShortcutsDialog.tsx` | FR-13, generated from registry |
| New `frontend/src/utils/platform.ts` | FR-11 detection and formatting |
| Modify `frontend/src/utils/constants.ts` | The registry |
| Modify `ChatPage`, `ChatInput` | Migrate existing bindings; register new ones |
| Modify `SettingsModal` | Link to the shortcuts list |

`SettingsModal` and `SettingsButton` already exist, so FR-13's second entry point is a link,
not a new surface.

### 7.6 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| Existing bindings | `KEYBOARD_SHORTCUTS` | `frontend/src/utils/constants.ts` |
| Theme toggle action | `useSettings` / `SettingsContext` | `frontend/src/hooks/useSettings.ts` |
| Abort action | `useAbortController` | `frontend/src/hooks/chat/useAbortController.ts` |
| Permission cycling | `usePermissionMode` | `frontend/src/hooks/chat/usePermissionMode.ts` |
| Navigation | React Router | `frontend/src/App.tsx` |
| Dialog + `Kbd` presentation | Astryx | design system |

---

## 8. Data model & persistence

**None.** Bindings are compile-time constants. Nothing is stored.

This changes if FR user-configurable rebinding is ever added (§16.1), which would need an
`AppSettings` field — and would then join P01, P09 and P10 in the settings-version
coordination noted across those PRDs.

---

## 9. Security implications

Essentially none. Two small notes:

- The document-level `keydown` listener must not log or transmit keystrokes. It reads
  `key` and modifier flags for matching and discards the event otherwise.
- FR-10's input handling means the listener sees keystrokes typed into the composer. It must
  match and drop, never accumulate. This is a privacy consideration rather than a security
  one, but worth being explicit about in the implementation.

---

## 10. Performance & scale

One document-level listener performing a small comparison per keystroke. Negligible.

Registering per-shortcut listeners instead would be measurably worse and should be avoided —
hence the single-listener design in §7.3.

---

## 11. Telemetry & observability

None. No analytics.

---

## 12. Test plan

### Frontend — Vitest + Testing Library, `make test-frontend`

New `frontend/src/hooks/useKeyboardShortcuts.test.ts`:

| Test | Asserts |
| --- | --- |
| Registered chord invokes its handler | FR-4 to FR-8 |
| Unregistered chord is inert | FR-12 |
| **Unmodified key does not fire while focus is in an input** | FR-10 |
| Modified chord *does* fire while focus is in an input | §6 |
| `allowInInput` bindings fire in inputs | FR-10 |
| Scope respected — a chat binding does not fire on the launch screen | FR-3 |
| macOS matches `metaKey`; other platforms match `ctrlKey` | FR-11 |
| Listener removed on unmount | §7.3 |

New `frontend/src/utils/platform.test.ts`:

| Test | Asserts |
| --- | --- |
| macOS formats as `⌘⇧I` | FR-11 |
| Windows/Linux formats as `Ctrl+Shift+I` | FR-11 |
| Falls back gracefully when platform is undetectable | Robustness |

New `frontend/src/components/ShortcutsDialog.test.tsx`:

| Test | Asserts |
| --- | --- |
| **Lists every registry entry — no hard-coded list** | **FR-14** |
| Grouped by category | UX |
| Bindings exposed as text to assistive technology | FR-18 |
| Opens via `Ctrl/Cmd+/` | FR-13 |
| Keyboard-dismissible | FR-16 |

**Regression tests for the migration** (§7.3) — these matter more than the new bindings:

| Test | Asserts |
| --- | --- |
| `Escape` still aborts an in-flight request | No regression |
| `Enter` still submits, honouring the configured behaviour | No regression |
| `Enter` still inserts a newline in newline mode | No regression |
| `Ctrl+Shift+M` still cycles permission mode | No regression |

Existing tests in `usePermissionMode.test.ts` and `useAbortController` coverage should be
reviewed rather than replaced.

Per `CLAUDE.md`, assert on roles and `aria-*`, never StyleX class names.

### Manual verification

1. Each new binding performs its action.
2. Type prose containing every bound letter into the composer → no action fires.
3. `Escape`, `Enter`, `Ctrl+Shift+M` behave exactly as before.
4. macOS shows `⌘` glyphs; Linux shows `Ctrl+`.
5. `Ctrl/Cmd+/` opens the list; it matches actual behaviour.
6. With a screen reader active, confirm no binding collides with its own.
7. Trigger a binding whose action is unavailable → nothing happens, no error.

---

## 13. Rollout & migration

Additive apart from the internal migration of three existing bindings, which is
behaviour-preserving and covered by regression tests. No persisted state, no wire change.
Patch or minor release.

**Ship before or alongside P17**, per §3.1, so the palette consumes this registry rather
than inventing one.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **Migrating the three existing bindings regresses them** | **Medium** | **High** | Behaviour-preserving migration; four explicit regression tests (§12) |
| 2 | A binding collides with a screen-reader shortcut | Medium | **High** | `Ctrl/Cmd+Shift` family only; no bare letters; manual AT check |
| 3 | A binding collides with a browser shortcut | Medium | Medium | FR-9 avoid-list; `Shift` family chosen for this reason |
| 4 | Shortcuts fire while typing | Medium | High | FR-10; modified-chord design makes this structurally unlikely |
| 5 | Shortcuts list drifts from behaviour | Medium | Medium | FR-14 generated from registry; test asserts no hard-coded list |
| 6 | Registry shape does not suit P17 | Medium | Medium | §3.1, §7.2 — design together |
| 7 | Deprecated `navigator.platform` misdetects | Low | Low | §7.4 layered detection, stubbable |
| 8 | Nine bindings is already too many to remember | Medium | Low | That is what P17 is for; FR-13 is the interim answer |

---

## 15. Acceptance criteria

- [ ] All shortcuts declared in one registry with id, label, category, binding, scope
- [ ] Bindings for focus composer, new session, and open history
- [ ] Bindings for back-to-projects and toggle-theme
- [ ] All new bindings use the `Ctrl/Cmd+Shift` family; no bare-letter bindings
- [ ] No collision with the FR-9 browser-shortcut list
- [ ] Unmodified keys do not fire while focus is in a text input
- [ ] Platform-correct matching and display (`⌘` vs `Ctrl+`)
- [ ] Unavailable actions are inert, not errors
- [ ] In-app shortcuts list, opened by `Ctrl/Cmd+/`
- [ ] **List generated from the registry, not hard-coded**
- [ ] Bindings exposed as text to assistive technology
- [ ] Every action remains reachable without a shortcut
- [ ] **`Escape`, `Enter`, and `Ctrl+Shift+M` behave exactly as before**
- [ ] Single document-level listener, cleaned up on unmount
- [ ] `make check` passes

---

## 16. Open questions

1. **Should bindings be user-configurable?** Real value for a keyboard-first audience, real
   scope (conflict detection, reset-to-default, persistence, migration). Deliberately
   excluded to keep effort at 1. Revisit if requested.
2. **Is `Ctrl/Cmd+Shift+I` acceptable for focus-composer?** On Chrome, `Cmd+Shift+I` opens
   DevTools and **the browser wins** — the page cannot intercept it. This binding may
   therefore be unusable in practice. **Verify before shipping**; `Ctrl/Cmd+Shift+K` or
   `Ctrl/Cmd+Shift+Enter` are alternatives.
3. **Should `Escape` also blur the composer** when there is nothing to abort? Currently it
   only aborts. Overloading it is conventional but could surprise.
4. **Where do P07/P15/P16 register their bindings?** Through this registry, but each PRD must
   claim its chord without colliding. Worth reserving a few now.
5. **Should the shortcuts list live in `SettingsModal`** rather than as its own dialog? Fewer
   surfaces, but a modal-within-modal if opened from settings.

Question 2 is the one most likely to require a change and should be checked first.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| Registry types and entries | 1.5 h |
| `useKeyboardShortcuts` hook | 2 h |
| Platform detection and formatting | 1 h |
| **Migrate the three existing bindings** | 2 h |
| Wire the five new actions | 2 h |
| `ShortcutsDialog` | 2 h |
| Tests incl. regression coverage | 4 h |
| Manual verification incl. screen-reader check | 1.5 h |
| **Total** | **≈16 h — 2 days** |

The migration and its regression tests are a third of the work and are the part not to rush.

---

## 18. References

- `frontend/src/utils/constants.ts:5-10` — the three existing bindings
- `frontend/src/components/chat/ChatInput.tsx` — `Enter` and permission-mode handling
- `frontend/src/hooks/chat/useAbortController.ts` — `Escape` handling
- `frontend/src/hooks/chat/usePermissionMode.ts` — cycling action
- `frontend/src/components/SettingsModal.tsx` — existing settings surface
- `frontend/src/hooks/useSettings.ts` — theme toggle action
- `README.md:288` — where `Ctrl+Shift+M` is currently documented instead of in-app
- `CLAUDE.md` § "Permission Mode Switching"
- `../03-feature-comparison-matrix.md` — `UX-04`, `EXT-02`
- `../04-uiux-workflow-comparison.md` §3 "Keyboard", "Discoverability"
- `../06-prioritization-and-roadmap.md` §3 — the P17 dependency
