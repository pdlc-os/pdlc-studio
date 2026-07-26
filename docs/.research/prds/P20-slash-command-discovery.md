# P20 — Slash-Command Discovery

| Field | Value |
| --- | --- |
| **Priority** | **P20** of 30 |
| **Score** | **12.0** |
| **Inputs** | Value 4 · Reach 4 · GapWeight ×1.5 · Effort 2 |
| **Category** | Agent Configuration & Extensibility |
| **Matrix features** | `EXT-01` (slash-command discovery UI) |
| **Maturity** | PDLC Studio **1** → target **3** · claudecodeui **4** |
| **Effort** | **2** |
| **Depends on** | Nothing. Mounts into P17 (command palette) if present |
| **Blocks** | Nothing |
| **Status** | Proposed |

---

## 1. Context & problem statement

PDLC Studio supports slash commands, and no user could reasonably discover that.

The entire implementation is four lines in `backend/handlers/chat.ts:39-44`:

```ts
// Process commands that start with '/'
let processedMessage = message;
if (message.startsWith("/")) {
  // Remove the '/' and send just the command
  processedMessage = message.substring(1);
}
```

That is it. A leading `/` is stripped and the remainder is forwarded as the prompt. There is
no command list, no autocomplete, no argument hinting, no validation, and no indication
anywhere in the interface that typing `/` does anything at all.

`04-uiux-workflow-comparison.md` §3 uses this as its first example of the product's
discoverability problem:

> **Slash commands.** The backend strips a leading `/` and forwards the rest. So `/compact`
> works — but nothing in the UI tells you it exists, lists available commands, or hints at
> arguments. **It is an invisible feature.**

This matters more than it might appear, because Claude Code's slash commands include
genuinely important operations — context compaction, session management, configuration —
that a user who does not know they exist will simply never use. They will instead hit the
consequences: context pressure (P23), unexplained stalls, and sessions that could have been
compacted.

### The stripping is also questionable

Worth flagging while here: the implementation strips `/` from **any** message beginning with
one, unconditionally. A user who begins a message with a path — `/usr/local/bin is on my
PATH` — has the leading slash silently removed before it reaches Claude.

That is a latent correctness bug, not just a discoverability gap. §7.4 addresses it.

### Why P20 rather than higher

Effort 2 and a ×1.5 weight — PDLC Studio is at maturity 1 rather than 0, since the mechanism
does work. The value is real but bounded: it exposes an existing capability rather than
adding one.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Cited as evidence of value only.

claudecodeui scores 4 with a `/api/commands` route group, a `command-palette` module built on
`cmdk`, and — notably — **`gray-matter ^4.0.3`** and **`@iarna/toml ^2.2.5`** as dependencies.

Those two parsers are the interesting signal. Claude Code stores custom slash commands as
Markdown files with YAML frontmatter under `.claude/commands/`, and `gray-matter` parses
exactly that. It strongly suggests claudecodeui **reads the user's own command definitions
from disk** rather than shipping a hard-coded list — which is the difference between a list
that rots and one that does not.

**That is the design worth taking**, and it is what §7.2 specifies.

---

## 3. Goals & non-goals

### Goals

1. Typing `/` reveals available commands.
2. Commands defined by the user in their project are discovered, not just built-ins.
3. Selecting a command inserts it correctly.
4. Argument expectations are visible where known.
5. Fix the unconditional `/`-stripping bug.

### Non-goals

- **Creating or editing slash commands.** That is a file-authoring task; `EXT-05`/`EXT-06`
  (subagent and hooks config) are rejected for similar reasons.
- **Executing commands client-side.** They are forwarded to Claude Code, which owns their
  semantics.
- **Validating arguments.** The CLI owns that; guessing would produce wrong errors.
- **MCP server management.** `EXT-03`, deferred.
- **The command palette.** P17 — this PRD provides a source that mounts into it.

---

## 4. Personas & user stories

**Marcus — has never used a slash command.**

> As a daily user, I want to see what commands exist, because I did not know the feature was
> there at all.

**Priya — knows `/compact` from the CLI.**

> As someone coming from the terminal, I want autocomplete, so that I do not have to remember
> exact command names.

**Devon — has custom project commands.**

> As a user with commands defined in `.claude/commands/`, I want them listed, because they are
> the ones I actually use and they are invisible here.

**Sam — pasting a path.**

> As a user, I want a message starting with `/usr/local/bin` to reach Claude intact, rather
> than silently losing its first character.

Sam's story is the bug fix, and it is arguably the most concrete user harm in this PRD.

---

## 5. Functional requirements

### Discovery

- **FR-1** Typing `/` at the **start** of an empty composer **MUST** show available commands.
- **FR-2** The list **MUST** filter as the user continues typing.
- **FR-3** Commands defined in the project's `.claude/commands/` **MUST** be included.
- **FR-4** Commands defined in the user's `~/.claude/commands/` **MUST** be included.
- **FR-5** Known Claude Code built-in commands **SHOULD** be included.
- **FR-6** Where a command has a description, it **MUST** be shown.
- **FR-7** Where a command declares arguments, they **MUST** be indicated.
- **FR-8** An absent or unreadable commands directory **MUST** degrade to built-ins only,
  never error.

### Insertion

- **FR-9** Selecting a command **MUST** insert it into the composer.
- **FR-10** Insertion **MUST NOT** send the message — the user may need to add arguments.
- **FR-11** Where the command takes arguments, the cursor **MUST** be positioned for typing
  them.
- **FR-12** `Escape` **MUST** dismiss the list without altering the composer.

### The stripping fix

- **FR-13** A leading `/` **MUST** only be stripped when the message plausibly *is* a command.
- **FR-14** A message beginning with a filesystem path **MUST** reach Claude unmodified.
- **FR-15** The rule **MUST** be documented and covered by tests.

### Accessibility

- **FR-16** The list **MUST** follow the ARIA combobox/listbox pattern with
  `aria-activedescendant`.
- **FR-17** Arrow keys **MUST** move selection; `Enter` **MUST** insert.
- **FR-18** The list **MUST NOT** steal focus from the composer.
- **FR-19** Availability of the list **MUST** be announced when it appears.

FR-18 is the one most easily broken: an autocomplete that moves focus out of a textarea
breaks continued typing, which is the whole point.

---

## 6. UX & interaction specification

### Inline autocomplete

```
┌──────────────────────────────────────────┐
│  /comp                                   │
│  ┌────────────────────────────────────┐  │
│  │ /compact                           │  │
│  │   Summarise the conversation…      │  │
│  │                                    │  │
│  │ /component  <name>       (project) │  │
│  │   Scaffold a new component         │  │
│  └────────────────────────────────────┘  │
│                                          │
│  [ Send ]                                │
└──────────────────────────────────────────┘
```

- Appears above the composer, so it does not cover the transcript.
- `(project)` / `(user)` origin labels distinguish custom commands from built-ins — Devon
  needs to know which are his.
- Argument placeholders shown inline (FR-7).

### Trigger conditions

Deliberately narrow, to avoid firing while the user types prose:

| Condition | List shown? |
| --- | --- |
| `/` as the first character of an empty composer | **Yes** |
| `/` after existing text | No |
| `/` inside a word | No |
| Message already contains a newline | No |

This means the list only appears when the user is plausibly starting a command, which is the
same precision-over-recall principle P19 §6 applies to file references.

### Two surfaces, one source

The command list is also a **P17 palette source** (`PaletteSource` per P17 §7.2). Same data,
two entry points: inline when typing `/`, and via the palette when browsing.

If P17 has not shipped, the inline surface stands alone and the palette source is added
later — the source model is designed for that.

### States

| State | Behaviour |
| --- | --- |
| No `/` typed | Nothing |
| `/` typed, commands loading | Brief loading affordance; do not block typing |
| Commands available | Filtered list |
| No match | List hides — **do not** show an empty-state box that obscures the composer |
| Directory unreadable | Built-ins only, silently (FR-8) |
| Command selected | Inserted, cursor positioned, list dismissed |

---

## 7. Technical design

### 7.1 Where commands come from

Claude Code discovers slash commands from Markdown files:

```
<project>/.claude/commands/*.md      → project commands (FR-3)
~/.claude/commands/*.md              → user commands (FR-4)
```

Each file's name is the command, and its YAML frontmatter carries metadata — typically
`description` and an argument hint.

**This is why claudecodeui depends on `gray-matter`** (§2). PDLC Studio needs the same
capability.

**Do not add a frontmatter dependency.** The subset needed is small: a leading `---` block,
a handful of scalar keys. A ~40-line parser handling `key: value` pairs and quoted strings is
sufficient, and it fits the project's dependency discipline (`CLAUDE.md`'s `deno compile`
size constraints, and the same reasoning P14 §7.2 applies to hashing).

If the frontmatter proves to need real YAML — nested structures, lists, multi-line strings —
that is the signal to reconsider. **Check a few real command files first** (§16.1).

### 7.2 Endpoint

```
GET /api/projects/:encodedProjectName/commands
```

> **Route ordering.** Same constraint as P06, P08, P15: literal segments must register before
> `/api/projects/:encodedProjectName/...`, so this parameterised route sits with `histories`
> and must not precede `create`, `clone`, or `recent`.

```ts
export interface SlashCommand {
  name: string;           // without the leading slash
  description?: string;
  argumentHint?: string;  // FR-7
  origin: "builtin" | "project" | "user";
}

export interface SlashCommandsResponse {
  commands: SlashCommand[];
  /** Directories that could not be read — FR-8 diagnostics, not an error. */
  skipped: string[];
}
```

Reading two directories of small Markdown files is cheap. Cache in memory keyed by directory
mtime, exactly as P08 §7.5 does for transcripts — the same helper would serve both.

### 7.3 Built-ins (FR-5)

Built-in commands are not on disk, so they must come from somewhere.

| Option | Assessment |
| --- | --- |
| Hard-coded list | Simple; **will rot** as Claude Code changes |
| Query the CLI | Ideal if a machine-readable listing exists — **investigate** (§16.2) |
| Omit built-ins entirely | Loses `/compact`, the most valuable one |

**Recommendation: investigate a CLI listing first.** If none exists, ship a small hard-coded
list in **one clearly-marked module with a maintenance comment**, exactly as P04 §7.4 does
for the pricing table and P09 §FR-12 for the model list. The pattern is now established
three times over and should be consistent.

A stale built-in list is tolerable because FR-8's degradation is graceful and because typing
an unknown command still works — it is forwarded to Claude, which reports it.

### 7.4 The stripping fix

The current rule (`backend/handlers/chat.ts:39-44`) is "starts with `/` → strip". FR-13/14
need something narrower.

A message is a command if, after the leading `/`:

- the first token matches a plausible command name — word characters and hyphens only, and
- there is **no** path separator within that first token.

So:

| Input | Treated as | Reason |
| --- | --- | --- |
| `/compact` | Command | Single word token |
| `/component Button` | Command | Word token, then arguments |
| `/usr/local/bin is on my PATH` | **Prose** | Second `/` inside the first token |
| `/etc/hosts needs updating` | **Prose** | Same |
| `/ leading space` | Prose | Not a name |

This is a behaviour change to an existing code path, so it needs tests both ways (FR-15).
It is also a small backwards-compatibility risk: a user who has been relying on
`/some/path` being stripped would see different behaviour. That seems vanishingly unlikely
and is the correct trade.

**Validating against the discovered command list would be stricter still** — but it would
couple the chat handler to command discovery and would break for commands the app has not
found. The shape-based rule is the better balance.

### 7.5 Frontend

| Item | Purpose |
| --- | --- |
| New `frontend/src/hooks/useSlashCommands.ts` | Fetch, cache, filter |
| New `frontend/src/components/chat/SlashCommandList.tsx` | Inline autocomplete |
| New `frontend/src/utils/slashCommands.ts` | Trigger detection, insertion |
| Modify `frontend/src/components/chat/ChatInput.tsx` | Trigger and insertion wiring |
| New palette source (P17) | Second surface |

`ChatInput` already owns `Enter` handling and the configurable Enter behaviour, so it is the
right place — but note the interaction: **while the list is open, `Enter` must insert the
selected command, not send the message.** That is the trickiest wiring in this PRD and
deserves its own tests.

### 7.6 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| mtime-keyed cache | P08's helper (`backend/history/`) | shared if P08 shipped |
| Directory reading | `readDir`, `stat` | `backend/utils/fs.ts` |
| Home directory | `getHomeDir()` | `backend/utils/os.ts` |
| Encoded project name | `getEncodedProjectName` | `backend/history/pathUtils.ts` |
| Composer | `ChatInput` | `frontend/src/components/chat/` |
| Palette source contract | `PaletteSource` (P17) | `frontend/src/hooks/palette/` |
| Combobox/listbox pattern | Astryx | design system |

---

## 8. Data model & persistence

**None persisted.** Commands are read from disk on demand and cached in memory by mtime.

The user's command files are read, never written — consistent with `~/.claude.json` being
read-only to this app (P06 FR-6).

---

## 9. Security implications

Modest, with two things worth naming.

**1. Reading `.claude/commands/` is a new read surface.** These files are inside the project
the user selected and inside their own home directory — both already readable through
`/api/chat` and `/api/directories`. So no new capability, but it is another unauthenticated
read endpoint until P14, and command files can contain prompt text the user considers
private.

**2. Command metadata is rendered as text.** Descriptions and argument hints come from files
on disk and are displayed in the UI. As in P08 §9, P16 §9, and P19 §9, they must be rendered
as text from structured values, never interpolated as markup.

**Not a concern**: executing commands. This PRD inserts text into a composer. Nothing is
executed client-side, and the forwarded message goes through the same `/api/chat` path with
the same permission mode as any other message.

**The stripping fix is a small security improvement**: a message whose first character is
silently discarded is a correctness bug that could, in principle, change the meaning of an
instruction sent to an agent with filesystem access.

---

## 10. Performance & scale

Reading two directories of small files is trivial. The mtime cache makes repeat lookups free.

The one caveat: a project with a very large `.claude/commands/` directory would produce a
long list. Cap the rendered list and rely on filtering, as P17 does.

Filtering runs client-side on a small array — no debouncing needed.

---

## 11. Telemetry & observability

Via `backend/utils/logger.ts`:

- `logger.api.warn` when a commands directory exists but cannot be read (feeds FR-8's
  `skipped`).
- `logger.api.debug` with command counts under `--debug`.

No client analytics.

---

## 12. Test plan

### Backend — `make test-backend`

New `backend/commands/parser.test.ts`:

| Test | Asserts |
| --- | --- |
| Frontmatter `description` extracted | FR-6 |
| Argument hint extracted | FR-7 |
| File with no frontmatter yields a command with no description | Robustness |
| Malformed frontmatter does not throw | FR-8 |
| Quoted values parsed | §7.1 |
| Command name derived from filename | §7.1 |

New `backend/handlers/commands.test.ts`:

| Test | Asserts |
| --- | --- |
| Project commands discovered | FR-3 |
| User commands discovered | FR-4 |
| Built-ins included | FR-5 |
| Origin labelled correctly for each | UX |
| **Missing directory degrades to built-ins, no error** | **FR-8** |
| Unreadable directory recorded in `skipped` | FR-8 |
| Cache re-reads on mtime change | §7.2 |
| Route not captured as a project name | §7.2 |

**Stripping fix — `backend/handlers/chat.test.ts`:**

| Test | Asserts |
| --- | --- |
| `/compact` has its slash stripped | FR-13 |
| `/component Button` stripped | FR-13 |
| **`/usr/local/bin is on my PATH` reaches Claude unmodified** | **FR-14** |
| **`/etc/hosts needs updating` unmodified** | FR-14 |
| Message with no leading slash unaffected | Regression |

### Frontend — `make test-frontend`

New `frontend/src/utils/slashCommands.test.ts`:

| Test | Asserts |
| --- | --- |
| `/` in an empty composer triggers | FR-1 |
| `/` after text does not trigger | §6 |
| `/` mid-word does not trigger | §6 |
| Filtering narrows as characters are typed | FR-2 |
| Insertion places the cursor for arguments | FR-11 |

New `frontend/src/components/chat/SlashCommandList.test.tsx`:

| Test | Asserts |
| --- | --- |
| Follows the combobox pattern with `aria-activedescendant` | FR-16 |
| Arrow keys move selection | FR-17 |
| **`Enter` inserts rather than sending while the list is open** | **§7.5** |
| `Escape` dismisses without altering the composer | FR-12 |
| **Focus stays in the composer** | **FR-18** |
| No match hides the list rather than showing an empty box | §6 |
| Origin labels shown | UX |
| Descriptions rendered as text | §9.2 |

Per `CLAUDE.md`, assert on roles and `aria-*`, never StyleX class names.

### Manual verification

1. Type `/` in an empty composer → list appears with built-ins and any custom commands.
2. Add a file to `.claude/commands/` → appears after refresh.
3. Type `/comp` → filters.
4. Select a command with arguments → inserted, cursor ready, **not sent**.
5. Press `Enter` while the list is open → inserts, does not send.
6. Press `Escape` → list closes, composer text unchanged.
7. Type `/usr/local/bin is on my PATH` and send → **Claude receives the leading slash**.
8. Delete `.claude/commands/` → built-ins still listed, no error.
9. Screen reader: list announced, options readable, focus stays in the composer.

Check 7 is the bug fix and the one most worth verifying end to end rather than only in a unit
test.

---

## 13. Rollout & migration

Additive apart from the stripping-rule change, which is a **behaviour change to an existing
code path** (§7.4). It should be called out in release notes, since it alters what reaches
Claude for messages beginning with a path.

No persistence, no migration. Minor release.

Ships independently of P17; adds a palette source when P17 lands.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **`Enter` sends the message instead of inserting the command** | **Medium** | **High** | §7.5; dedicated test; interacts with configurable Enter behaviour |
| 2 | Autocomplete steals focus, breaking typing | Medium | **High** | FR-18; explicit test |
| 3 | Frontmatter needs real YAML, not a minimal parser | **Medium** | Medium | §16.1 check real files first; add a dependency only if genuinely required |
| 4 | Built-in list rots | **High** (certain over time) | Low | §7.3 — investigate a CLI listing; single marked module; unknown commands still work |
| 5 | Stripping-rule change breaks an existing user's usage | Low | Low | §7.4 — shape-based rule; release note |
| 6 | List triggers while typing prose | Medium | Medium | §6 narrow trigger conditions; three negative tests |
| 7 | Command metadata rendered as markup | Low | Medium | §9.2 |
| 8 | Route captured as a project name | Medium | Medium | §7.2 ordering; test |

---

## 15. Acceptance criteria

- [ ] Typing `/` in an empty composer shows available commands
- [ ] List filters as the user types
- [ ] Project and user commands discovered from `.claude/commands/`
- [ ] Built-ins included, from a single clearly-marked source
- [ ] Origin (built-in / project / user) shown
- [ ] Descriptions and argument hints shown where present
- [ ] Missing or unreadable directories degrade to built-ins with no error
- [ ] Selecting a command inserts it and **does not send**
- [ ] Cursor positioned for arguments
- [ ] **`Enter` inserts while the list is open; `Escape` dismisses without altering text**
- [ ] **Focus never leaves the composer**
- [ ] Combobox pattern with `aria-activedescendant`; arrow keys navigate
- [ ] List does not trigger mid-text or mid-word
- [ ] **`/usr/local/bin …` reaches Claude with its leading slash intact**
- [ ] Stripping rule documented and tested both ways
- [ ] Command metadata rendered as text
- [ ] No YAML or frontmatter dependency added unless justified
- [ ] `make check` passes

---

## 16. Open questions

1. **Do real command files need full YAML?** Blocking for §7.1. Inspect several
   `.claude/commands/*.md` files before choosing between a minimal parser and a dependency.
2. **Can the Claude CLI list built-in commands machine-readably?** Determines whether FR-5's
   list rots. Worth a few minutes of investigation — the difference between a maintained
   constant and a live source.
3. **Should unknown commands be flagged before sending?** The app could warn that `/foo` is
   not a known command. Tempting, but the list may be incomplete (§7.3), so a false warning
   would be worse than silence. Recommendation: no.
4. **Should this respect Claude Code's command precedence** when project and user directories
   define the same name? Claude Code has a rule; the UI should not contradict it. Worth
   confirming and matching.
5. **Should the stripping fix ship separately?** It is a bug fix independent of discovery and
   could land sooner as a small standalone change. Arguably it should.

Question 5 is worth acting on: FR-13/14 are the most concrete user-facing correctness
improvement in this PRD and do not need the UI work to be valuable.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| Investigate frontmatter and built-in listing (§16.1, §16.2) | 2 h |
| Minimal frontmatter parser + tests | 3 h |
| Commands endpoint incl. mtime cache | 3 h |
| Built-ins module | 1 h |
| **Stripping-rule fix + tests** | 2 h |
| `useSlashCommands` hook | 2 h |
| `SlashCommandList` component | 3 h |
| `ChatInput` trigger and `Enter` interaction | 3 h |
| P17 palette source | 1 h |
| Frontend tests | 4 h |
| Manual verification | 1.5 h |
| **Total** | **≈25.5 h — 3.5 days** |

The stripping fix alone is ~2 h and could ship independently (§16.5).

---

## 18. References

- `backend/handlers/chat.ts:39-44` — the four-line implementation and the stripping bug
- `backend/utils/fs.ts` — `readDir`, `stat`
- `backend/utils/os.ts` — `getHomeDir()`
- `backend/history/pathUtils.ts` — `getEncodedProjectName`
- `frontend/src/components/chat/ChatInput.tsx` — composer, `Enter` handling
- `CLAUDE.md` § "Backend" — route-ordering constraint
- `CLAUDE.md` § "The system prompt is opt-in" — `settingSources` picks up `.claude` settings
- `../01-claudecodeui-deep-scan.md` §3.8 — `gray-matter`, `@iarna/toml`, `/api/commands`
- `../03-feature-comparison-matrix.md` — `EXT-01`
- `../04-uiux-workflow-comparison.md` §3 "Discoverability"
- `P17-command-palette.md` §7.2 — the `PaletteSource` contract this mounts into
- `P08-cross-session-conversation-search.md` §7.5 — the mtime-cache pattern reused here
