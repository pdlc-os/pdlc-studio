# P21 — Attachments: Paste, Drag-Drop, Picker

| Field | Value |
| --- | --- |
| **Priority** | **P21** of 30 |
| **Score** | **10.7** |
| **Inputs** | Value 4 · Reach 4 · GapWeight ×2.0 · Effort 3 |
| **Category** | Multimodal & Rich Input |
| **Matrix features** | `IN-01` (image paste), `IN-02` (drag-and-drop), `IN-03` (file picker) |
| **Maturity** | PDLC Studio **0** → target **3** · claudecodeui **4** |
| **Effort** | **3** |
| **Depends on** | Nothing |
| **Blocks** | Nothing |
| **Status** | Proposed |

---

## 1. Context & problem statement

PDLC Studio cannot accept an attachment of any kind. Not an image, not a file, not a pasted
screenshot.

The constraint is in the wire contract itself. `shared/types.ts:8`:

```ts
export interface ChatRequest {
  message: string;
  …
}
```

`message` is a bare `string`. There is nowhere for an attachment to go.

`04-uiux-workflow-comparison.md` §2 Journey E describes the consequence:

> **"Here's a screenshot of the bug"** — **impossible.** The user must save the image, then
> ask Claude to read it by path — which works only because Claude has filesystem access, and
> fails entirely if the image is on a phone.
>
> Screenshot→chat is one of the highest-frequency agent workflows in practice. Its total
> absence is a bigger deal than the maturity-0 score suggests.

The workaround — save to disk, then reference by path — is genuinely poor. It requires the
user to know where they saved it, to type an absolute path, and to be on the same machine.
For anyone using the app from a tablet or phone (the scenario P05 and P29 target), it does
not work at all.

### Why P21 rather than higher

Effort 3, because this is not a UI feature — it changes the wire contract, adds a storage
question to an app with no persistence, and has to interact with the Agent SDK's own content
model. §7 shows the work is real.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Observable capability only.

claudecodeui scores 4:

- **`react-dropzone ^14.2.3`** client-side for drag-and-drop
- **`multer ^2.0.1`** server-side for multipart upload
- A dedicated authenticated **`/api/assets`** route for chat image assets
- `/api/projects/:projectId/files/upload` for project file upload
- Limits of **200 MB per file, 20 files**, with a 50 MB JSON body limit

The `/api/assets` separation is the instructive part: chat attachments are treated as a
distinct resource class from project files, with their own route and lifecycle. That
distinction matters and §7.3 adopts it.

**PDLC Studio should take much less.** `FILE-07` (upload files into a project) is deferred,
and the 200 MB limit is wildly inappropriate for an app whose whole distribution is 38 MB.
This PRD scopes to **chat attachments only**, with limits sized for images and small text
files.

### 2.1 Astryx ships `FileInput`

Querying the design system resolved the picker and drag-drop question:

> **`FileInput`** — *"provides file upload with optional drag-and-drop support. Use it for
> single or multiple file selection with built-in validation for file type, size, and count.
> Pair with validation status for upload feedback."*
>
> Key props: `label`, `value: File | File[] | null`, `onChange`.

So **FR-2 (drag-drop) and FR-3 (picker) come largely from the design system**, including type,
size, and count validation. `react-dropzone` is not needed — which matters, since
`CLAUDE.md` forbids hand-rolled equivalents of design-system components.

Clipboard paste (FR-1) is not mentioned in `FileInput`'s description and is likely still ours
(§7.5).

---

## 3. Goals & non-goals

### Goals

1. Paste a screenshot directly into the composer.
2. Drag a file onto the composer.
3. Pick a file through a normal file dialog.
4. Have Claude actually receive and understand the attachment.
5. Work from a device that is not the host machine.

### Non-goals

- **Uploading files into the project tree.** `FILE-07`, deferred. Attachments are
  conversation inputs, not project content.
- **Arbitrary large files.** Sized for images and small text (§5).
- **Video or audio.** Out of scope; `IN-04` (voice) is rejected.
- **Attachment history or a media library.** Attachments belong to their message.
- **Editing or annotating images.** Out of scope.
- **Rendering attachments in loaded history** beyond what Claude Code's own transcript
  preserves — see §16.3.

---

## 4. Personas & user stories

**Priya — reporting a visual bug.**

> As a user, I want to paste a screenshot, so that I can show Claude the rendering problem
> instead of describing it.

**Marcus — has a log file.**

> As a user, I want to drag a log onto the composer, so that Claude can read it without me
> finding its absolute path.

**Devon — on a tablet.**

> As a mobile user, I want to attach a photo, so that the app is useful away from the machine
> it runs on. Today this is impossible — there is no path to type.

**Sam — pasting a design.**

> As a user, I want to paste an image from my clipboard, so that the fastest possible
> interaction is one keystroke.

---

## 5. Functional requirements

### Input methods

- **FR-1** Pasting image data into the composer **MUST** attach it.
- **FR-2** Dropping files onto the composer **MUST** attach them.
- **FR-3** A file picker **MUST** be available.
- **FR-4** Multiple attachments per message **MUST** be supported.
- **FR-5** An attachment **MUST** be removable before sending.

### Types and limits

- **FR-6** Common image types (PNG, JPEG, GIF, WebP) **MUST** be supported.
- **FR-7** Plain-text types **SHOULD** be supported.
- **FR-8** A per-file size limit **MUST** be enforced, client and server side.
- **FR-9** A per-message count limit **MUST** be enforced.
- **FR-10** Rejected files **MUST** produce a specific reason — type, size, or count — not a
  generic failure.
- **FR-11** Limits **MUST** be enforced server-side regardless of client checks.

### Delivery to Claude

- **FR-12** Attachments **MUST** reach Claude in a form it can interpret.
- **FR-13** Images **MUST** be delivered as image content, not as a file path.
- **FR-14** Where the SDK cannot accept an attachment type, the app **MUST** say so rather
  than silently dropping it.

### Presentation

- **FR-15** Pending attachments **MUST** be visible in the composer before sending.
- **FR-16** Images **MUST** show a thumbnail; non-images an identifiable icon and filename.
- **FR-17** Sent attachments **MUST** appear in the transcript with their message.
- **FR-18** A failed send **MUST NOT** lose the attachments.

### Accessibility

- **FR-19** The picker **MUST** be keyboard-reachable and labelled.
- **FR-20** Each pending attachment **MUST** have an accessible name and a keyboard-reachable
  remove control.
- **FR-21** Attaching and removing **MUST** be announced.
- **FR-22** Drag-and-drop **MUST NOT** be the only way to attach (satisfied by FR-1 and FR-3).

---

## 6. UX & interaction specification

```
┌──────────────────────────────────────────┐
│  ┌────────┐  ┌────────┐                  │
│  │ [img]  │  │ 📄     │                  │
│  │ ✕      │  │ log.txt│                  │
│  └────────┘  │ ✕      │                  │
│              └────────┘                  │
│  ┌────────────────────────────────────┐  │
│  │ Why does this render wrong?        │  │
│  └────────────────────────────────────┘  │
│  📎                          [ Send ]    │
└──────────────────────────────────────────┘
```

- Pending attachments sit above the text area, not inside it.
- Each has a remove control (FR-5, FR-20).
- The paperclip is the picker entry point (FR-3).

### Drop target

The **whole composer region** is the drop target, not just the paperclip — a small target is
frustrating. On drag-over, show a clear boundary and a "Drop to attach" affordance.

Dropping outside the composer must do nothing, and must not navigate the browser away, which
is the default behaviour for a dropped file and a common bug.

### States

| State | Behaviour |
| --- | --- |
| No attachments | Composer as today; zero visual change |
| Dragging over | Drop affordance shown |
| Attachment pending | Thumbnail/chip above the text area |
| Over limit | Specific message; **existing attachments retained** |
| Wrong type | Specific message naming accepted types |
| Sending | Attachments shown as in-flight |
| Sent | Rendered with the message in the transcript |
| Send failed | **Attachments preserved** for retry (FR-18) |

FR-18 matters: losing a pasted screenshot to a transient failure means the user has to
re-capture it, which may be impossible.

---

## 7. Technical design

### 7.1 The wire contract change

`shared/types.ts` must grow an attachment field:

```ts
export interface ChatAttachment {
  /** Client-generated id, so the UI can correlate. */
  id: string;
  type: "image" | "text";
  mediaType: string;        // "image/png", "text/plain"
  name?: string;            // original filename where known
  /** Base64-encoded content. See §7.3 for why not multipart. */
  data: string;
}

export interface ChatRequest {
  message: string;
  attachments?: ChatAttachment[];
  …
}
```

Optional, so omitting it is exactly today's behaviour — the same compatibility guarantee
P09 §7.1 makes for `model`.

### 7.2 Delivering to the Agent SDK — the blocking question

**This is the part that determines whether the PRD is feasible as specified**, and it must be
resolved first.

`backend/handlers/chat.ts:50-70` calls `query({ prompt: processedMessage, options: {…} })`
with `prompt` as a **string**.

Per `CLAUDE.md`, the SDK's message types come from the Anthropic API `Beta*` family, and
`SDKUserMessage["message"]` is a `MessageParam` whose `content` "may be a plain string rather
than a block array." That implies the block-array form — which is how the Anthropic API
carries image content — is available.

But whether `query()`'s `prompt` parameter accepts a content-block array, or only a string,
is **unverified**. Three possibilities:

| Finding | Consequence |
| --- | --- |
| `prompt` accepts content blocks | Straightforward: build an array of text + image blocks |
| `prompt` accepts an async iterable of `SDKUserMessage` | Also workable; richer, more plumbing |
| `prompt` is string-only | **FR-13 is not achievable via the SDK.** Fallback in §7.6 |

**Read `frontend/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` before estimating.**
This is §16.1 and it is genuinely blocking — the rest of the design is contingent on it.

### 7.3 Transport: base64 JSON, not multipart

claudecodeui uses `multer` and multipart. **PDLC Studio should not**, for two reasons:

1. `POST /api/chat` is currently a JSON endpoint returning an NDJSON stream
   (`backend/handlers/chat.ts:112`, `163-169`). Converting it to multipart would complicate
   the streaming response path for no benefit.
2. `multer` is an Express middleware; this is Hono. A Hono equivalent is another dependency
   inside every `deno compile` binary.

Base64 inflates payloads by ~33%, which is acceptable at the size limits in §7.4 and is the
right trade against a new dependency and a reworked endpoint.

**Attachments are not persisted.** They travel with the request and are handed to the SDK.
There is no `/api/assets` equivalent, because there is no store to put them in — PDLC Studio
has no database, and writing user images into `~/.claude` would be inventing a media
lifecycle nobody asked for.

This is a real limitation and §16.3 records it: attachments may not be visible when a
conversation is reloaded from history, depending on what Claude Code's own JSONL preserves.

### 7.4 Limits

Sized for the actual use case, not claudecodeui's 200 MB:

| Limit | Value | Reasoning |
| --- | --- | --- |
| Per file | **5 MB** | A generous screenshot; well under any API constraint |
| Per message | **5 files** | Beyond this, a user should be pointing Claude at files on disk |
| Total request | **20 MB** | Bounds the base64-inflated JSON body |

Enforced client-side for immediate feedback (FR-10) and **again server-side** (FR-11),
because the client is not trustworthy.

The Hono JSON body limit must be raised to accommodate this — and must be raised
*deliberately*, to a specific number, not removed.

### 7.5 Clipboard paste

`FileInput` (§2.1) covers drag-drop and the picker. Paste is ours.

A `paste` listener on the composer inspects `ClipboardEvent.clipboardData.items` for entries
with `kind === "file"` and an image media type. Notes:

- **Do not intercept text pastes.** Only act when image data is present; otherwise let the
  default happen. A paste handler that swallows text would be a serious regression.
- Pasted images typically have no filename — synthesise one from the media type and a
  timestamp.
- Browsers differ on whether a copied *file* (from a file manager) appears as a `file` item.
  Handle its absence gracefully.

### 7.6 If the SDK cannot take image content

The honest fallback, should §7.2 resolve badly: write the attachment to a temporary file in
the working directory and reference it by path in the prompt, letting Claude's own `Read`
tool pick it up.

This is **worse** in several ways — it writes files the user did not ask for, needs cleanup,
depends on the permission mode allowing a read, and leaks temporary files into the project.
It should be treated as a last resort and would justify reducing this PRD's scope to
text-only attachments rather than shipping something that litters the user's repository.

**Do not design for this fallback until §16.1 is answered.**

### 7.7 Components

| Item | Purpose |
| --- | --- |
| New `frontend/src/components/chat/AttachmentList.tsx` | Pending attachments |
| New `frontend/src/components/chat/AttachmentChip.tsx` | One attachment + remove |
| New `frontend/src/hooks/chat/useAttachments.ts` | State, validation, encoding |
| New `frontend/src/utils/attachments.ts` | Type detection, base64, limits |
| Modify `frontend/src/components/chat/ChatInput.tsx` | Paste, drop, picker wiring |
| Modify `backend/handlers/chat.ts` | Accept, validate, pass to SDK |

### 7.8 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| **Picker + drag-drop + validation** | **Astryx `FileInput`** | design system |
| Composer | `ChatInput` | `frontend/src/components/chat/` |
| SDK message shapes | `sdkFixtures.ts` factories | `frontend/src/utils/` |
| Wire contract | `ChatRequest` | `shared/types.ts` |
| Request validation pattern | `resolvePermissionMode` → 400 | `backend/utils/permissions.ts` |

---

## 8. Data model & persistence

**None.** Attachments exist in browser memory until sent, travel in the request, and are
handed to the SDK. Nothing is written to disk by this app.

| Datum | Store | Lifetime |
| --- | --- | --- |
| Pending attachments | React state | Until sent or removed |
| Sent attachments | Whatever Claude Code's transcript preserves | Out of our control |

The second row is the honest limitation (§16.3).

---

## 9. Security implications

The most substantial of any PRD in the P17–P25 range, because this accepts **arbitrary
binary input from the client for the first time**.

| Threat | Mitigation |
| --- | --- |
| **Resource exhaustion via huge payloads** | FR-8/FR-9/FR-11 limits, enforced server-side; explicit Hono body limit (§7.4) |
| Base64 decode bomb | Validate declared size before decoding; cap decoded length |
| **Media type spoofing** | Do not trust the client's `mediaType`. Verify against magic bytes server-side for images |
| Malicious image parsed by a decoder | The app never decodes images — it forwards them. The browser renders thumbnails from a blob URL, which is the browser's own hardened path |
| **XSS via SVG** | **SVG must not be an accepted image type.** SVG is script-capable and rendering one as a thumbnail is an XSS vector. FR-6's list deliberately excludes it |
| Filename injection | Filenames are display-only and rendered as text; never used to construct a path |
| Sending sensitive files unintentionally | FR-15's visible pending state is the mitigation — the user sees what will be sent |
| **No authentication** | Unchanged; this adds an unauthenticated *write-shaped* input until P14 |

**The SVG exclusion is the sharpest point here** and is easy to get wrong, because SVG is an
image type and a naive `image/*` accept filter would allow it.

Note also that attachments are conversation content sent to Anthropic's API via the CLI —
the same as message text. Worth being explicit in documentation, since users may not think of
a pasted screenshot the same way they think of typed text.

---

## 10. Performance & scale

- Base64 encoding of a 5 MB file in the browser should be done off the main thread or in
  chunks; a synchronous encode of several files would jank the composer.
- Thumbnails render from blob URLs, **which must be revoked on removal and unmount** or they
  leak memory for the session.
- The 20 MB request cap (§7.4) bounds server memory per request.
- Multiple pending attachments hold their data in memory until send — the count limit is what
  keeps that bounded.

---

## 11. Telemetry & observability

Via `backend/utils/logger.ts`:

- `logger.chat.warn` on rejected attachments with the reason, mirroring the permission-mode
  rejection warning at `backend/handlers/chat.ts:122-124`.
- `logger.chat.debug` already logs the chat request — **it must not log attachment `data`.**
  A base64 blob in the debug log would be both useless and a privacy problem. The existing
  `logger.chat.debug("Received chat request {*}", chatRequest)` at lines 115-118 would do
  exactly that and **must be adjusted**.

That last point is a concrete change required by this PRD and easy to overlook.

---

## 12. Test plan

### Backend — `make test-backend`

Extend `backend/handlers/chat.test.ts`:

| Test | Asserts |
| --- | --- |
| Request without `attachments` behaves exactly as today | Compatibility |
| Valid image attachment accepted and passed to the SDK | FR-12, FR-13 |
| Oversized file rejected with 400 and a specific reason | FR-8, FR-10, FR-11 |
| Too many files rejected | FR-9, FR-11 |
| Oversized total body rejected | §7.4 |
| **Unsupported type rejected — including `image/svg+xml`** | **§9** |
| Declared media type not matching magic bytes rejected | §9 |
| Malformed base64 rejected without throwing | Robustness |
| **Debug logging does not include attachment `data`** | **§11** |

### Frontend — `make test-frontend`

New `frontend/src/hooks/chat/useAttachments.test.ts`:

| Test | Asserts |
| --- | --- |
| Adding a valid file produces a pending attachment | FR-1–FR-4 |
| Oversized file rejected with a size-specific message | FR-10 |
| Wrong type rejected with a type-specific message | FR-10 |
| Exceeding the count keeps existing attachments | §6 |
| Removal works | FR-5 |
| **Blob URLs revoked on removal and unmount** | **§10** |
| **Attachments preserved when send fails** | **FR-18** |

New `frontend/src/components/chat/AttachmentList.test.tsx`:

| Test | Asserts |
| --- | --- |
| Image shows a thumbnail; non-image shows name and icon | FR-16 |
| Each has an accessible name and keyboard remove control | FR-20 |
| Attach and remove announced | FR-21 |

Extend `ChatInput` tests:

| Test | Asserts |
| --- | --- |
| Pasting image data attaches it | FR-1 |
| **Pasting text does not attach and does not swallow the paste** | **§7.5** |
| Dropping a file attaches it | FR-2 |
| Dropping outside the composer does not navigate | §6 |
| Picker is keyboard-reachable and labelled | FR-19 |

Per `CLAUDE.md`, assert on roles and `aria-*`, never StyleX class names.

### Manual verification

1. Screenshot to clipboard, paste → thumbnail appears; send; Claude describes the image.
2. Paste plain text → text pastes normally, nothing attaches.
3. Drag a PNG onto the composer → attaches.
4. Drag a file outside the composer → browser does not navigate.
5. Attach a 10 MB image → clear size message.
6. Attach six files → clear count message, first five retained.
7. **Attempt an SVG → rejected.**
8. Kill the backend, send with attachments → error shown, **attachments still present**.
9. From a phone (post-P05), attach a photo.
10. Keyboard-only: attach via picker, remove, send.
11. Confirm `--debug` logs contain no base64 blobs.

---

## 13. Rollout & migration

- **Backwards compatible**: `attachments` is optional; omitting it is today's behaviour.
- No persistence, no migration.
- Hono body limit change is a config change, documented.
- Minor release.
- **Blocked on §16.1** — do not start before the SDK question is answered.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **SDK `prompt` does not accept image content blocks** | **Medium** | **Critical** | §16.1 resolve first; §7.6 fallback is poor enough to justify rescoping instead |
| 2 | **SVG accepted, creating an XSS vector** | Medium | **High** | §9 explicit exclusion; dedicated test |
| 3 | Media type spoofing | Medium | Medium | Magic-byte verification server-side |
| 4 | Paste handler swallows text pastes | Medium | **High** | §7.5; explicit test |
| 5 | Blob URL leaks | **Medium** | Medium | §10 revoke on removal and unmount; test |
| 6 | Attachments lost on send failure | Medium | **High** | FR-18; test |
| 7 | Base64 blobs in debug logs | **Medium** | Medium | §11 — requires an explicit change to existing logging |
| 8 | Large base64 encode janks the composer | Medium | Low | §10 chunked or off-thread |
| 9 | Attachments invisible in reloaded history | **Medium** | Medium | §16.3 — set expectations; may be unavoidable |
| 10 | Body-limit increase becomes a DoS vector | Low | Medium | §7.4 specific number, not removal; unauthenticated until P14 |

---

## 15. Acceptance criteria

- [ ] Pasting an image attaches it; pasting text is unaffected
- [ ] Dropping files on the composer attaches them
- [ ] File picker available, keyboard-reachable, labelled
- [ ] Multiple attachments supported and individually removable
- [ ] PNG, JPEG, GIF, WebP accepted; **SVG rejected**
- [ ] Per-file, per-message, and total-body limits enforced **client and server side**
- [ ] Rejections name the specific reason
- [ ] Declared media type verified against magic bytes server-side
- [ ] Images reach Claude as image content, not as a file path
- [ ] Unsupported cases reported, never silently dropped
- [ ] Pending attachments visible before sending; thumbnails for images
- [ ] **Attachments preserved when a send fails**
- [ ] Blob URLs revoked on removal and unmount
- [ ] **Debug logging excludes attachment data**
- [ ] Requests without `attachments` behave exactly as before
- [ ] Built on Astryx `FileInput`; no `react-dropzone` or `multer` equivalent added
- [ ] `make check` passes

---

## 16. Open questions

1. **Does the Agent SDK's `query()` accept content blocks or an async iterable of
   `SDKUserMessage` for `prompt`?** **Blocking.** Determines whether FR-13 is achievable at
   all. Read `sdk.d.ts` before any other work on this PRD.
2. **Does `FileInput` support clipboard paste?** §2.1 suggests not, but its full prop list was
   not read. If it does, §7.5 disappears.
3. **What happens to attachments in reloaded history?** Depends on what Claude Code writes to
   its JSONL. If images are preserved, `backend/history/parser.ts` may be able to surface
   them; if not, FR-17 applies only to the live session and that limitation must be stated.
4. **Should text files be inlined into the message instead of attached?** For a small log,
   putting the content in the prompt may work better than an attachment and needs no SDK
   support. Possibly the right answer for `type: "text"` regardless of §16.1's outcome.
5. **Should there be a total-conversation attachment budget?** Several large images across a
   session consume significant context. P23 (context pressure) is the related surface.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| **Resolve §16.1 SDK content-block support** | 3 h |
| Shared types | 1 h |
| Backend validation incl. magic bytes and limits | 5 h |
| SDK delivery path | 4 h |
| Logging adjustment (§11) | 1 h |
| `useAttachments` hook incl. encoding and blob lifecycle | 5 h |
| `AttachmentList` / `AttachmentChip` | 4 h |
| `FileInput` integration | 2 h |
| Paste handling | 3 h |
| Backend tests | 5 h |
| Frontend tests | 5 h |
| Manual verification incl. mobile | 2 h |
| **Total** | **≈40 h — 5 days** |

Effort 3 is right, and it is dominated by validation and lifecycle correctness rather than
UI — which is the correct shape for a feature that accepts arbitrary binary input.

---

## 18. References

- `shared/types.ts:7-22` — `ChatRequest`, the bare-string constraint
- `backend/handlers/chat.ts:50-70` — `query()` with a string `prompt`
- `backend/handlers/chat.ts:112-131` — JSON parsing and the validate-then-400 pattern
- `backend/handlers/chat.ts:115-118` — the debug logging that must change (§11)
- `frontend/src/components/chat/ChatInput.tsx` — composer
- `frontend/src/utils/sdkFixtures.ts` — SDK shape factories
- `CLAUDE.md` § "Assistant payloads use the Anthropic API `Beta*` types" — `MessageParam.content`
- `../01-claudecodeui-deep-scan.md` §3.10 — competitor's multer/dropzone/assets approach
- `../03-feature-comparison-matrix.md` — `IN-01`, `IN-02`, `IN-03`, deferred `FILE-07`
- `../04-uiux-workflow-comparison.md` §2 Journey E
