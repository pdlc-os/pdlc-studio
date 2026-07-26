# P03 — Copy Message & Code Block to Clipboard

| Field | Value |
| --- | --- |
| **Priority** | **P03** of 30 |
| **Score** | **22.5** |
| **Inputs** | Value 3 · Reach 5 · GapWeight ×1.5 · Effort 1 |
| **Category** | Chat & Streaming Experience |
| **Matrix features** | `CHAT-10` (copy message / code to clipboard) |
| **Maturity** | PDLC Studio UNVERIFIED, assumed **0–1** → target **4** · claudecodeui UNVERIFIED |
| **Effort** | **1** — **revised down after Astryx investigation; see §2.1** |
| **Depends on** | Nothing |
| **Blocks** | Nothing |
| **Status** | Proposed — scope reduced, block-level copy already ships |

---

## 1. Context & problem statement

Copying output is one of the highest-frequency actions in any chat interface. A user asks
for a command, a config block, a regex, or a snippet, and then needs it somewhere else — a
terminal, a file, a message to a colleague.

PDLC Studio renders assistant text through the Astryx `Markdown` component and long output
through `CodeBlock` (`CLAUDE.md`, "Chat UI").

The reach is the point. This is not a power-user feature; it is something nearly every user
does in nearly every session. Combined with effort 1, that is what puts a modest
value-3 feature at rank 3.

### 1.1 What the Astryx investigation found — and one correction

This PRD was originally written assuming Astryx provided nothing, and flagged a
"collapsed blocks copy truncated content" trap as its highest risk. **Querying the Astryx
design system directly showed both assumptions were wrong.** Recording the correction here
rather than silently rewriting, because it materially changes the scope:

**`CodeBlock` already ships a copy button.**

| Prop | Type | Default | Relevance |
| --- | --- | --- | --- |
| `hasCopyButton` | `boolean` | **`true`** | Block-level copy is already on, everywhere |
| `onCopy` | `() => void` | — | Callback after copy |
| `code` | `string` | required | **What gets copied** |

The Astryx docs describe the copy button as *"Copies the **code string** to the
clipboard"* — that is the `code` **prop**, not the rendered DOM. So the truncation trap
does not exist: copying a collapsed block yields the full source by construction.

**`isCollapsible` is also not truncation.** Astryx defines it as *"Allow collapsing the code
body into just the header bar. Starts expanded"*, gated by `collapsibleThreshold`
(default 10 lines). `CLAUDE.md`'s shorthand — "long output through `CodeBlock`
(`isCollapsible` handles truncation)" — is loose phrasing for a collapse toggle. Worth
correcting in `CLAUDE.md` while here.

**Consequence for scope**: FR-1 through FR-5 are already satisfied by the design system.
**The remaining work is message-level copy (FR-6 to FR-8) plus verification.** Effort drops
from ~12 h to roughly 5 h. §17 reflects this.

This is exactly the outcome `CLAUDE.md` warns about when it directs preferring the
purpose-built Chat group over hand-rolled equivalents — building a parallel copy button
would have duplicated a shipped one and produced two inconsistent affordances.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Cited as evidence of value only.

claudecodeui's copy behaviour is **UNVERIFIED**. It renders Markdown through
`react-markdown` with `react-syntax-highlighter`, neither of which provides copy buttons by
default, so it presumably implements its own — but this was not confirmed.

**This PRD's priority does not rest on the competitor.** It rests on ubiquity: copy-to-
clipboard is a baseline expectation in every chat product, and its absence is noticed
immediately.

### 2.1 Astryx investigation — completed

Resolved against the Astryx design system (see §1.1). Outcome:

| Question | Answer |
| --- | --- |
| Does `CodeBlock` provide copy? | **Yes** — `hasCopyButton`, default `true` |
| Does it copy full source or rendered text? | **Full source** (the `code` prop) |
| Is there a post-copy hook? | Yes — `onCopy` |
| Does `Markdown` provide message-level copy? | **Not established** — remains the open item |

**Do not build a parallel block-level copy affordance.** `CLAUDE.md` explicitly directs
preferring the purpose-built Chat group over hand-rolled equivalents, and a second copy
button next to Astryx's would be visibly wrong.

The one remaining discovery task is whether `Markdown` or `ChatMessage` expose anything for
message-level copy:

```bash
npx @astryxdesign/cli component Markdown
npx @astryxdesign/cli component ChatMessage
```

---

## 3. Goals & non-goals

### Goals

1. Copy the full contents of any code block, including collapsed portions.
2. Copy the full text of any assistant message.
3. Confirm success visibly, without a modal or a toast that interrupts.
4. Work by keyboard alone.
5. Degrade gracefully where the Clipboard API is unavailable.

### Non-goals

- **Copying tool-call payloads.** Rendered by `ChatToolCalls`; a separate surface with
  different content shapes. Could follow.
- **Copying the whole transcript.** That is P26 (session export).
- **Rich-text or HTML clipboard flavours.** Plain text only.
- **Copy on selection or keyboard-shortcut-only copy of the last block.** Adds discoverable
  surface for marginal gain.
- **Replacing native text selection.** Selection must keep working exactly as now.

---

## 4. Personas & user stories

**Marcus — daily driver.** Asks for a shell command, needs it in a terminal.

> As a user, I want a one-click copy on code blocks, so that I am not selecting text with a
> mouse and risking a partial selection.

**Priya — on a laptop trackpad.** Precise text selection across a scrolling region is
awkward.

> As a user on a trackpad, I want to copy without dragging, because dragging across a
> streaming region often selects the wrong range.

**Devon — keyboard-first.** Never touches the mouse.

> As a keyboard user, I want the copy control to be reachable by Tab and activated by Enter
> or Space, so that copying does not force me to the pointer.

**Sam — sharing with a colleague.** Wants the whole explanation, not just the code.

> As a user, I want to copy an entire assistant message, so that I can paste the reasoning
> along with the snippet.

---

## 5. Functional requirements

### Code block copy — **satisfied by Astryx; verify, do not build**

- **FR-1** Every rendered code block **MUST** expose a copy control.
  *Satisfied by `CodeBlock`'s `hasCopyButton` default. Requirement is to **not disable** it.*
- **FR-2** It **MUST** copy the block's **complete source**.
  *Satisfied by construction — Astryx copies the `code` prop, not the DOM.*
- **FR-3** Copied content **MUST NOT** include the language label, line numbers, or chrome.
  *Satisfied by construction, same reason. **Verify with a test** rather than assume.*
- **FR-4** Trailing whitespace **MUST** be preserved exactly.
  *Depends on what the app passes as `code`. The extraction path is ours, so this is still
  our requirement.*
- **FR-5** The control **MUST** be visible on keyboard focus, not only on hover.
  *Astryx's behaviour here is unverified — **check on a real render**, especially on touch.*

The net requirement for this group is: **confirm `hasCopyButton` is not being disabled
anywhere, confirm the `code` prop carries complete source, and cover both with tests.**

### Message copy

- **FR-6** Every assistant message **MUST** expose a copy control.
- **FR-7** It **MUST** copy the message's Markdown **source**, not the rendered DOM text, so
  that structure survives the paste.
- **FR-8** For a message containing multiple code blocks, the message-level copy **MUST**
  include all of them in order.

### Feedback

- **FR-9** Success **MUST** be confirmed within the control itself — a transient state change
  (icon and label), not a toast or modal.
- **FR-10** The confirmation **MUST** revert automatically after roughly 2 seconds.
- **FR-11** Failure **MUST** be reported in the control, not silently swallowed.

### Robustness

- **FR-12** Where `navigator.clipboard.writeText` is unavailable or rejects — non-secure
  context, denied permission — the control **MUST** fall back or clearly report failure. It
  **MUST NOT** appear to succeed.
- **FR-13** Copying **MUST** work while a response is still streaming, copying whatever has
  arrived.

### Accessibility

- **FR-14** The control **MUST** be a real `<button>` with an accessible name identifying
  what it copies ("Copy code", "Copy message").
- **FR-15** Success **MUST** be announced to assistive technology, via `aria-live="polite"`
  or an updated accessible name.
- **FR-16** The control **MUST** be reachable by Tab and activated by Enter and Space.
- **FR-17** The control **MUST NOT** appear in the tab order ahead of the message content it
  belongs to.

---

## 6. UX & interaction specification

### Placement

```
┌─────────────────────────────────────────────┐
│ Assistant                          [⧉ Copy] │ ← message-level (FR-6)
│                                             │
│ Here's the command you need:                │
│ ┌─────────────────────────────────┐         │
│ │ bash                    [⧉]     │         │ ← block-level (FR-1)
│ │ npm install -g pdlc-studio      │         │
│ └─────────────────────────────────┘         │
│                                             │
│ Run it from any directory.                  │
└─────────────────────────────────────────────┘
```

- **Block-level**: top-right of the code block, aligned with the language label.
- **Message-level**: top-right of the message container, aligned with the role label.

Both compose from Astryx button primitives. **No new CSS classes** — `CLAUDE.md` restricts
app CSS to the existing app-shell classes.

### Visibility

| Input | Behaviour |
| --- | --- |
| Pointer | Fades in on hover over the block/message |
| Keyboard | **Fully visible whenever focused** (FR-5) |
| Touch | **Always visible** — there is no hover on touch |

The touch case is easy to get wrong: a hover-only control is permanently invisible on a
phone, which matters given the mobile work in P05/P13/P29.

### Copy states

| State | Icon | Label | Duration |
| --- | --- | --- | --- |
| Idle | copy | "Copy" | — |
| Copied | check | "Copied" | ~2 s (FR-10) |
| Failed | alert | "Copy failed" | ~4 s |

No toast. No modal. The control is where the user's attention already is.

### Interaction with text selection

The control **must not** interfere with native selection. Users who prefer selecting text
manually must be able to continue. This means the control cannot overlay the content area in
a way that intercepts drag events.

---

## 7. Technical design

### 7.1 Discovery first

Per §2.1, run the Astryx CLI before writing code. The rest of this section assumes Astryx
provides no built-in copy.

### 7.2 The clipboard hook

New: `frontend/src/hooks/useCopyToClipboard.ts`.

```ts
type CopyState = "idle" | "copied" | "failed";

export function useCopyToClipboard(resetMs = 2000): {
  state: CopyState;
  copy: (text: string) => Promise<void>;
};
```

Responsibilities:

- Call `navigator.clipboard.writeText`, guarding for absence (FR-12).
- Set `copied` or `failed`, then reset on a timer (FR-10).
- **Clear the timer on unmount.** A message unmounting during the 2-second window — entirely
  possible while a transcript is re-rendering — would otherwise set state on an unmounted
  component.

The hook is deliberately generic so P26 (session export) can reuse it.

### 7.3 Where the source text comes from

This is the crux, and where the `isCollapsible` trap lives (§1.1).

The copy source **must** be the original Markdown/code string from the message data, not
`element.textContent`. The message pipeline retains the original content:

- `frontend/src/utils/UnifiedMessageProcessor.ts` (590 lines) builds display messages
- `frontend/src/utils/contentUtils.ts` (116 lines) handles content extraction
- `frontend/src/utils/messageConversion.ts` (248 lines) converts SDK shapes

Per `CLAUDE.md`, assistant content arrives as `BetaMessage` content blocks under
`message.content`, and a text block's `text` is the authoritative string. **That** is what
gets copied.

If Astryx's `Markdown` does not expose a hook for per-code-block rendering, extracting
per-block source requires either a Markdown AST pass or a custom code-block renderer prop.
**Confirm which Astryx supports before committing to FR-1** — this is the main scoping risk
and is called out in §14.

### 7.4 Components

| Component | Change |
| --- | --- |
| `frontend/src/components/chat/ChatMessages.tsx` | Render the message-level control |
| `frontend/src/components/MessageComponents.tsx` | Likely home for the shared control |
| New `frontend/src/components/chat/CopyButton.tsx` | The control itself, wrapping the hook |

`CopyButton` should take `getText: () => string` rather than `text: string`, so a
streaming message does not recompute a potentially large string on every render (FR-13).

### 7.5 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| Content extraction | helpers | `frontend/src/utils/contentUtils.ts` |
| Message shapes | processor | `frontend/src/utils/UnifiedMessageProcessor.ts` |
| Icons | `lucide-react`, already a dependency | — |
| Buttons | Astryx primitives | design system |

### 7.6 Backend

**None.** Entirely client-side.

---

## 8. Data model & persistence

**None.** No state persists beyond the transient control state.

---

## 9. Security implications

Two real considerations, both small:

1. **The clipboard is a shared surface.** Copying content writes it where any application
   can read it. This is inherent to the feature and true of manual selection too. No
   mitigation needed, but it argues against any "auto-copy" behaviour — which is why that is
   a non-goal.
2. **Secure context requirement.** `navigator.clipboard` is unavailable on non-HTTPS
   non-localhost origins. A user who binds `--host 0.0.0.0` and connects from another device
   over plain HTTP **will not have a working clipboard API**. FR-12's graceful failure is
   what makes this acceptable rather than mysterious. This is worth a line in the README's
   network-access section.

No injection surface: content goes to the clipboard as plain text and is never re-rendered
as HTML.

---

## 10. Performance & scale

The `getText` callback shape (§7.4) avoids recomputing large strings on every render of a
streaming message. Beyond that, negligible — one small button per block and per message.

For a very long transcript, adding two buttons per message increases DOM node count
modestly. Astryx's `ChatMessageList` owns virtualisation if any exists; this PRD does not
change that.

---

## 11. Telemetry & observability

None. No analytics in the product. A failed copy is surfaced to the user (FR-11) rather than
logged.

---

## 12. Test plan

### Frontend — Vitest + Testing Library, `make test-frontend`

New `frontend/src/hooks/useCopyToClipboard.test.ts`:

| Test | Asserts |
| --- | --- |
| Calls `writeText` with the given string | Core |
| Transitions idle → copied | FR-9 |
| Reverts after the reset interval | FR-10 |
| Transitions to failed when `writeText` rejects | FR-11 |
| Transitions to failed when `navigator.clipboard` is undefined | FR-12 |
| Clears its timer on unmount | §7.2 |

New `frontend/src/components/chat/CopyButton.test.tsx`:

| Test | Asserts |
| --- | --- |
| Is a `button` with an accessible name | FR-14 |
| Activated by Enter | FR-16 |
| Activated by Space | FR-16 |
| Announces success to AT | FR-15 |
| Shows failure state without appearing to succeed | FR-11, FR-12 |

Extend `frontend/src/components/chat/ChatMessages.test.tsx` (or add it):

| Test | Asserts |
| --- | --- |
| Copies **full** source of a collapsed code block | **FR-2 — the critical one** |
| Copied text excludes the language label | FR-3 |
| Message copy includes all code blocks in order | FR-8 |
| Copy works mid-stream on partial content | FR-13 |

Mock `navigator.clipboard.writeText` in `frontend/src/test-setup.ts` (59 lines), which
already exists for this kind of global setup.

Per `CLAUDE.md`, assert on roles and `aria-*` — **never** on generated StyleX class names.

### Manual verification

1. Ask for a long file; confirm the block collapses; copy; paste — **full content**, not
   truncated.
2. Tab to the control — it is visible and activates on Enter.
3. On a narrow viewport, the control is visible without hover.
4. Copy mid-stream; paste; confirm partial content arrives.
5. Load over plain HTTP from another host; confirm a clear failure state rather than a
   silent no-op.
6. Confirm manual text selection still works normally.

---

## 13. Rollout & migration

No migration, no persisted state, no wire change. Patch or minor release. Ships
independently of every other PRD.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | ~~Copy captures rendered text, truncating collapsed blocks~~ | — | — | **Retired.** §1.1: Astryx copies the `code` prop, not the DOM. |
| 2 | ~~Astryx offers no per-block copy, making FR-1 hard~~ | — | — | **Retired.** `hasCopyButton` ships by default. |
| 3 | **The `code` prop is passed truncated content by the app** | Medium | **High** | The extraction path is ours (§7.3). Astryx copies faithfully whatever it is given — so a bug here is now *our* bug, not the design system's. Test with a long file. |
| 4 | A second, hand-rolled copy button appears next to Astryx's | **Medium** | Medium | §2.1; explicit acceptance criterion |
| 5 | Astryx's copy button is hover-only and invisible on touch | Medium | Medium | FR-5 unverified — check on a real narrow-viewport render before assuming |
| 6 | Clipboard API unavailable over plain HTTP on a LAN | **Medium** | Medium | FR-12 graceful failure; document in README network section. **Note this affects Astryx's button too**, so the failure mode must be checked, not just ours. |
| 7 | Timer fires after unmount (message-level control) | Medium | Low | Cleanup + test |
| 8 | Control interferes with text selection | Low | Medium | Placement outside the content flow; manual check |

---

## 15. Acceptance criteria

- [ ] Astryx built-in copy support investigated and the finding recorded in the PR
- [ ] Code blocks expose a copy control
- [ ] Copying a **collapsed** block yields the complete source
- [ ] Copied text excludes language label and chrome
- [ ] Assistant messages expose a copy control
- [ ] Message copy preserves Markdown source and includes all blocks in order
- [ ] Success confirmed in-control and reverts automatically
- [ ] Failure reported, never silently swallowed
- [ ] Works with no clipboard API present (clear failure)
- [ ] Works mid-stream
- [ ] Control is a real button with an accessible name
- [ ] Reachable by Tab, activated by Enter and Space
- [ ] Visible on focus and on touch, not hover-only
- [ ] Success announced to assistive technology
- [ ] Native text selection unaffected
- [ ] Tests assert on roles/`aria-*`, not class names
- [ ] `make check` passes

---

## 16. Open questions

1. **What does Astryx already provide?** Blocking. Resolve via §2.1 before estimating.
2. **Should tool-call output be copyable?** `ChatToolCalls` renders structured payloads that
   are often exactly what a user wants (a command, a diff). Listed as a non-goal to keep
   effort at 1, but it is the most likely follow-up.
3. **Copy Markdown source or rendered plain text for messages?** FR-7 specifies source, on
   the grounds that pasting into another Markdown context should preserve structure. A user
   pasting into a plain-text field gets `**bold**` markers. Alternative: offer both via a
   split control — rejected here as over-engineering.
4. **Should there be a keyboard shortcut** for "copy last code block"? Attractive for
   power users; adds a binding to a product that currently has three. Better considered
   within P12 (keyboard shortcut expansion).

---

## 17. Effort breakdown

**Revised after the Astryx investigation (§1.1).** Block-level copy is already shipped, so
the estimate drops from the original ≈12 h:

| Task | Estimate |
| --- | --- |
| Confirm `hasCopyButton` not disabled; audit `code` prop for completeness | 1 h |
| Remaining discovery: `Markdown` / `ChatMessage` message-level copy (§2.1) | 0.5 h |
| `useCopyToClipboard` hook | 1.5 h |
| `CopyButton` component (message level only) | 1.5 h |
| Wiring message-level copy | 1 h |
| Clipboard mock in test setup | 0.5 h |
| Tests | 2 h |
| Manual verification incl. touch and plain-HTTP cases | 1 h |
| **Total** | **≈9 h — just over 1 day** |

Effort stays **1** on the pack's scale. If `Markdown` turns out to provide message-level
copy too, this drops to roughly **3 hours** of verification and tests.

---

## 18. References

- `CLAUDE.md` § "Chat UI" — prefer the purpose-built Chat group; `CodeBlock` / `isCollapsible`
- `CLAUDE.md` § "Discovering component APIs" — use the Astryx CLI
- `CLAUDE.md` § "Testing note" — assert on behaviour, never StyleX class names
- `frontend/src/utils/UnifiedMessageProcessor.ts` — display message construction
- `frontend/src/utils/contentUtils.ts` — content extraction helpers
- `frontend/src/components/MessageComponents.tsx`
- `frontend/src/test-setup.ts` — global test setup
- `../03-feature-comparison-matrix.md` — `CHAT-10`
- `../06-prioritization-and-roadmap.md` §2
