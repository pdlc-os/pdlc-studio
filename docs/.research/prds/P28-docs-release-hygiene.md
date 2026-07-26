# P28 — Docs & Release Hygiene

| Field | Value |
| --- | --- |
| **Priority** | **P28** of 30 |
| **Score** | **6.0** |
| **Inputs** | Value 2 · Reach 2 · GapWeight ×1.5 · Effort 1 |
| **Category** | Engineering Quality · Platform, Distribution & Deployment |
| **Matrix features** | `ENG-09` (Markdown/docs in the format gate), `PLAT-08` (generated CHANGELOG) |
| **Maturity** | PDLC Studio **0–1** → target **4** · claudecodeui **4** |
| **Effort** | **1** |
| **Depends on** | Nothing |
| **Blocks** | Nothing |
| **Status** | Proposed |

---

## 1. Context & problem statement

Two small, unrelated gaps in an otherwise excellent engineering setup, bundled because
neither justifies a PRD alone and both are repository hygiene.

`02-pdlc-studio-baseline.md` §3.15 scores Engineering Quality **5** — tests on both runtimes,
Lefthook plus CI enforcing `make check`, a 787-line mock generator enabling zero-dependency
demo mode, and 598 lines of architectural documentation recording rationale *and reversals*.
That is a genuinely high bar, and claudecodeui — with **zero automated tests** — is well
behind it.

These two items are the exceptions.

### 1.1 Markdown is outside the format gate

`make format-check` runs Prettier over `frontend/src/`, `frontend/scripts/`
(`frontend/package.json:14`) and `backend/**/*.ts` (`backend/package.json:51`).

**`docs/**/*.md`, `README.md`, and `CLAUDE.md` are all outside it.** So is this research pack.

The consequence is inconsistent Markdown formatting with nothing to catch it, in a project
whose two longest and most-read files are Markdown. `make format-files` exists as a manual
escape hatch (`Makefile:79-83`), which means the tooling is present and simply not wired into
the gate.

### 1.2 There is no CHANGELOG

`CLAUDE.md` records this as a deliberate, reasoned loss rather than an oversight:

> `tagpr` was removed. It required a Personal Access Token, because a tag pushed with the
> built-in `GITHUB_TOKEN` does not trigger other workflows… Keeping the whole release in one
> workflow run sidesteps that entirely and leaves no expiring credential to rotate.
>
> The tradeoff is **no generated `CHANGELOG.md`** and no label-driven version selection…
> `generate_release_notes: true` means GitHub still assembles release notes from merged PRs.

The reasoning for removing `tagpr` was sound — it had never worked in this repository, every
run failed on a missing `GH_PAT`, and no `CHANGELOG.md` was ever produced. But the *outcome*
is that a user who wants to know what changed between 0.2.2 and 0.2.4 must browse GitHub
Releases. There is nothing in the repository, nothing in the npm package, and nothing in the
binary tarball.

`git log --oneline` shows the release cadence is real — `3997c20 Release 0.2.4`,
`d001d36 Release 0.2.3`, `57611ab Release 0.2.2` — so there is genuine history worth recording.

### Why P28 is last-but-two

Value 2, reach 2. This affects contributors and release-note readers, not users of the
application. It ranks near the bottom honestly. Its merit is that it is effort 1 and closes
the only two gaps in a category the project otherwise leads.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Cited as evidence of value only.

claudecodeui scores 4 on both items:

- **`release-it ^19.0.5`** with **`@release-it/conventional-changelog ^10.0.5`** and
  **`auto-changelog ^2.5.0`**, plus a maintained `CHANGELOG.md` — consistent with reaching
  v1.36.3.
- **`@commitlint/cli` and `@commitlint/config-conventional`** with **husky** and
  **lint-staged**, enforcing conventional commits.

The dependency chain is the point: **conventional commits are the prerequisite for a generated
changelog.** `commitlint` enforces the format; `conventional-changelog` reads it.

PDLC Studio has Lefthook running `make check` but no commit-message convention
(`ENG-05` in the matrix, deferred). So a generated changelog here requires deciding about
commit conventions first — §7.2.

It also has **`eslint-plugin-boundaries ^6.0.2`** enforcing architectural layering, which
`03-feature-comparison-matrix.md` notes as *"genuinely worth copying as a technique"*
(`ENG-03`, deferred).

---

## 3. Goals & non-goals

### Goals

1. Markdown is formatted consistently and the gate enforces it.
2. There is a changelog in the repository.
3. Neither change makes contributing harder than it is today.
4. No new required credential — the reason `tagpr` was removed.

### Non-goals

- **Reintroducing `tagpr`.** Its removal was correct and is documented.
- **Label-driven version selection.** Explicit versions are deliberate.
- **Enforcing conventional commits.** See §7.2 — a real decision, and this PRD proposes making
  it optional rather than mandatory.
- **Architectural lint boundaries.** `ENG-03`, deferred.
- **Publishing to npm.** `PLAT-02`, deferred — and a decision, not an engineering task.
- **Rewriting historical commit messages.**

---

## 4. Personas & user stories

**A contributor.**

> As a contributor, I want `make check` to tell me if my Markdown is misformatted, so that I
> am not corrected in review for something a tool could catch.

**A user upgrading.**

> As a user going from 0.2.2 to 0.2.4, I want a changelog in the repository, so that I can see
> what changed without browsing GitHub Releases.

**A maintainer.**

> As the maintainer, I want the changelog generated rather than hand-written, because a
> hand-written one will fall behind.

**A packager.**

> As someone reviewing this for distribution, I want a `CHANGELOG.md` in the tree, because its
> absence is a signal I have to check other things more carefully.

---

## 5. Functional requirements

### Formatting

- **FR-1** `make format` **MUST** format Markdown across the repository.
- **FR-2** `make format-check` **MUST** verify it.
- **FR-3** `make check` **MUST** therefore fail on misformatted Markdown.
- **FR-4** The glob **MUST** include `README.md`, `CLAUDE.md`, and `docs/**/*.md`.
- **FR-5** Generated or vendored Markdown **MUST** be excluded via `.prettierignore`.
- **FR-6** The initial reformat **MUST** be a separate commit from the tooling change, so the
  configuration diff is reviewable.

### Changelog

- **FR-7** A `CHANGELOG.md` **MUST** exist at the repository root.
- **FR-8** It **MUST** be updated as part of the release workflow, not by hand.
- **FR-9** It **MUST NOT** require a Personal Access Token or any credential beyond
  `GITHUB_TOKEN`.
- **FR-10** It **MUST** cover at least the released versions from the point of adoption.
- **FR-11** Historical entries **SHOULD** be seeded from existing releases where feasible.
- **FR-12** The release workflow **MUST** commit it to the same branch it bumps
  `backend/package.json` on.
- **FR-13** Failure to generate **MUST NOT** fail the release build.

FR-13 matters: a release that produces working binaries but fails on changelog generation
should still publish. The binaries are the product.

---

## 6. UX & interaction specification

No user-facing UI. The "interface" is `make check` and the release workflow.

### Contributor experience

```console
$ make check
...
docs/.research/03-feature-comparison-matrix.md
Code style issues found in the above file. Run Prettier with --write to fix.
make: *** [format-check-docs] Error 1

$ make format
$ make check
✓
```

The fix must be one obvious command. `make format` already exists and should simply cover more
(FR-1).

### Changelog shape

```markdown
# Changelog

## 0.3.0 — 2026-08-04

### Features
- Safe permission defaults and mode persistence (#31)

### Bug Fixes
- Serve root-level static assets from the binary (#25)

## 0.2.4 — 2026-07-12
...
```

Generated, not hand-written (FR-8). Whether sections are derived from conventional commit
prefixes or from PR titles depends on §7.2.

---

## 7. Technical design

### 7.1 Markdown formatting

Prettier is already present and already invoked on Markdown by `make format-files`
(`Makefile:79-83`), which runs `npx prettier --write` from the frontend workspace. So the
tooling exists; only the globs and the gate wiring are missing.

**`Makefile`** gains docs targets alongside the existing frontend/backend pair:

```make
format: format-frontend format-backend format-docs
format-docs:
	cd frontend && npx prettier --write "../README.md" "../CLAUDE.md" "../docs/**/*.md"

format-check: format-check-frontend format-check-backend format-check-docs
format-check-docs:
	cd frontend && npx prettier --check "../README.md" "../CLAUDE.md" "../docs/**/*.md"
```

Running from `frontend/` matches the existing `format-files` pattern and reuses that
workspace's Prettier install, avoiding a root-level dependency.

**`.prettierignore`** (FR-5) excludes anything generated or vendored. Note
`docs/.reference/README.md` is a **snapshot of the main README** — reformatting it would
create a spurious diff against its source and it should probably be ignored.

**Two commits** (FR-6): one adding configuration, one applying the reformat. A single commit
would bury a two-line Makefile change under hundreds of lines of reflowed Markdown.

**Note the scale.** This research pack alone is ~14,000 lines of Markdown. The initial
reformat will be large, which is exactly why FR-6 separates it.

### 7.2 The changelog — and the commit-convention question

**This is the real decision in this PRD.**

Generated changelogs conventionally derive from conventional commit messages, which is why
claudecodeui pairs `conventional-changelog` with `commitlint`. PDLC Studio has no such
convention (`ENG-05`, deferred), and its history is mixed — `git log` shows
`build: ship Linux releases as compressed tarballs (#26)` and
`fix: serve root-level static assets from the binary (#25)` alongside plain
`Release 0.2.4`. So the convention is *partly* followed already, without enforcement.

Three options:

| Option | Assessment |
| --- | --- |
| **Enforce conventional commits, generate from them** | Best output. But adds a gate contributors can fail on a typo, and `CLAUDE.md` notes this project is "almost entirely written and committed by Claude Code itself" — a commit-message linter is friction for that workflow |
| **Generate from merged PR titles** | GitHub already assembles release notes this way (`generate_release_notes: true` in the release workflow). The data is already there and already used |
| **Hand-maintain** | Will fall behind. Rejected by FR-8 |

**Recommendation: generate from what GitHub already produces.** The release workflow already
sets `generate_release_notes: true`, so GitHub composes notes from merged PRs on every
release. Capturing that output into `CHANGELOG.md` and committing it (FR-12) reuses an
existing, working mechanism and needs **no new credential** (FR-9) — which is the constraint
that killed `tagpr`.

The GitHub API can return generated notes for a release, and the release job already has a
`GITHUB_TOKEN` with the permissions to read them and to commit — it already commits the
version bump (`CLAUDE.md`, "Release Process").

**Conventional commits become optional-but-encouraged** rather than enforced: better commit
messages produce better PR titles produce better notes, with no gate to fail.

### 7.3 Release workflow changes

`.github/workflows/release.yml` currently: bumps `backend/package.json`, commits it, tags,
builds five binaries, publishes with generated notes.

Add, after the release is published:

1. Fetch the generated notes for the new tag.
2. Prepend them to `CHANGELOG.md` under a version heading.
3. Commit to the same branch as the version bump (FR-12).

Wrapped so a failure logs and continues (FR-13) — the binaries are already built and published
by this point, and losing a changelog entry must not fail the run.

**Ordering matters**: notes can only be fetched after the release exists, but the commit
should ideally accompany the version bump. Two commits on the branch is the pragmatic answer —
or fetch notes from the PRs directly before publishing, if that proves reliable.

### 7.4 Seeding history (FR-11)

Existing releases 0.2.0 through 0.2.4 have GitHub-generated notes already. A one-off script
can fetch and assemble them into an initial `CHANGELOG.md`.

Worth doing — a changelog starting at 0.3.0 with nothing before it looks like the project
began there.

### 7.5 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| Prettier | frontend devDependency | `frontend/package.json` |
| Markdown formatting invocation | `format-files` target | `Makefile:79-83` |
| Release automation | `release.yml` | `.github/workflows/` |
| Generated notes | `generate_release_notes: true` | `.github/workflows/release.yml` |
| Version source of truth | `backend/package.json` | — |

---

## 8. Data model & persistence

None. `CHANGELOG.md` is a tracked file.

---

## 9. Security implications

Almost none, and one small positive.

**FR-9 is the security-relevant requirement.** The reason `tagpr` was removed is documented in
`CLAUDE.md`: it needed a Personal Access Token, which is a long-lived credential requiring
rotation. This PRD must not reintroduce that. Using the built-in `GITHUB_TOKEN` (§7.2) keeps
the "no expiring credential to rotate" property, which is a genuine security improvement the
project already made and should not give back.

**Small positive**: a changelog makes it easier for users to see whether a security-relevant
change shipped — for example P01's permission-default change, which `P01 §13` requires be led
in release notes. A repository changelog makes that discoverable to someone who never visits
GitHub Releases.

**Minor consideration**: generated notes derive from PR titles, which are author-controlled.
They are committed to the repository, so a PR title containing something unpleasant would land
in a tracked file. In practice PRs are reviewed before merge, so this is not a real exposure.

---

## 10. Performance & scale

`make check` gains a Prettier pass over Markdown. With this research pack included that is a
few thousand lines — under a second, and unnoticeable next to the existing typecheck, test,
and build steps.

The release workflow gains an API call and a commit. Negligible.

---

## 11. Telemetry & observability

None. Workflow output is the observability.

---

## 12. Test plan

### Automated

There is little to unit-test; verification is that the gates work.

| Check | Asserts |
| --- | --- |
| `make format-check` fails on deliberately misformatted Markdown | FR-2, FR-3 |
| `make format` fixes it | FR-1 |
| The glob covers `README.md`, `CLAUDE.md`, `docs/**/*.md` | FR-4 |
| `.prettierignore` excludes the intended files | FR-5 |
| Existing `format-check-frontend` / `-backend` still pass | Regression |

CI runs `make check` already, so FR-3 is enforced from the first merge.

### Manual verification

1. Introduce a formatting error in `README.md` → `make check` fails.
2. `make format` → fixed; `make check` passes.
3. Confirm `docs/.reference/README.md` is handled as intended (§7.1).
4. Run a **dry-run release** on a test tag → `CHANGELOG.md` produced with sensible content.
5. **Simulate a changelog-generation failure** → release still completes with binaries
   published (FR-13). *The most important check here.*
6. Confirm no new secret or token is required (FR-9).
7. Confirm the seeded history covers 0.2.x (FR-11).

### Note on this repository's constraints

`make check` cannot currently run in every environment — it requires `node_modules` and Deno,
neither of which is guaranteed present. Verification of FR-1 to FR-3 must happen where the
full toolchain is installed.

---

## 13. Rollout & migration

- **Two commits** for the formatting change (FR-6): configuration, then the reformat.
- The reformat commit will be large and should be labelled clearly so reviewers know to skim
  it. Adding its hash to `.git-blame-ignore-revs` would keep `git blame` useful.
- The changelog change is workflow-only and takes effect on the next release.
- Seeding history (FR-11) is a separate one-off commit.
- No user-facing impact; no version bump required for the formatting half.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **Changelog generation breaks a release** | Medium | **High** | FR-13 non-fatal; explicit simulated-failure check |
| 2 | Reformat commit buries the configuration change | **High** if combined | Low | FR-6 two commits; `.git-blame-ignore-revs` |
| 3 | Reformat produces a huge, unreviewable diff | **Certain** | Low | Expected; separate commit; content unchanged |
| 4 | A PAT creeps back in | Low | Medium | FR-9; §9 — the reason `tagpr` was removed |
| 5 | `docs/.reference/README.md` diverges from the real README after reformatting | Medium | Low | §7.1 — ignore it |
| 6 | Contributors surprised by a new failing gate | Medium | Low | `make format` is the one-command fix; mention in `CLAUDE.md` |
| 7 | Generated notes are low quality without conventional commits | Medium | Low | §7.2 — encourage, do not enforce; quality improves as messages do |
| 8 | Two commits on the release branch confuse the release history | Low | Low | §7.3 acknowledged; acceptable |

---

## 15. Acceptance criteria

- [ ] `make format` formats `README.md`, `CLAUDE.md`, and `docs/**/*.md`
- [ ] `make format-check` verifies them and `make check` fails on drift
- [ ] `.prettierignore` excludes generated and snapshot Markdown
- [ ] Configuration and reformat are **separate commits**
- [ ] Reformat commit recorded in `.git-blame-ignore-revs`
- [ ] `CHANGELOG.md` exists at the repository root
- [ ] It is updated automatically by the release workflow
- [ ] **No Personal Access Token or new credential is required**
- [ ] **Changelog failure does not fail the release build**
- [ ] Historical releases seeded
- [ ] `CLAUDE.md` updated to describe the new format scope and the changelog
- [ ] Existing format checks still pass

---

## 16. Open questions

1. **Should conventional commits be enforced?** §7.2 recommends not — the project is largely
   committed by Claude Code itself, and a message linter is friction for that workflow with
   modest benefit given GitHub already generates usable notes from PR titles. But it would
   produce a better changelog, and `ENG-05` is a real deferred item.
2. **Should `CHANGELOG.md` ship inside the release artefacts** — the tarball and DMG? Arguably
   yes for the npm package; less obviously for a single binary.
3. **Is `docs/.reference/` in scope for formatting?** It contains a README snapshot; formatting
   it makes it diverge from its source. Recommendation: ignore it.
4. **Should the changelog commit happen before or after publishing?** §7.3 notes the ordering
   tension. Committing after is simpler and safer.
5. **Should this PRD be split?** The two halves are genuinely unrelated. They are bundled
   because each is too small alone — but they could be two PRs.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| Makefile docs targets | 1 h |
| `.prettierignore` and glob tuning | 1 h |
| Initial reformat, separate commit | 1 h |
| `.git-blame-ignore-revs` | 0.25 h |
| Release workflow changelog step | 3 h |
| Seed historical entries | 1.5 h |
| Dry-run release verification incl. failure simulation | 2 h |
| `CLAUDE.md` updates | 1 h |
| **Total** | **≈10.75 h — 1.5 days** |

---

## 18. References

- `Makefile:6-17` — existing format and format-check targets
- `Makefile:79-83` — `format-files`, which already runs Prettier on arbitrary files
- `frontend/package.json:13-14` — frontend Prettier globs
- `backend/package.json:50-51` — backend Prettier globs
- `.github/workflows/release.yml` — the workflow to extend
- `docs/.reference/README.md` — the README snapshot (§7.1)
- `CLAUDE.md` § "Release Process" — one-workflow design, `generate_release_notes`
- `CLAUDE.md` § "Why not tagpr" — the PAT constraint behind FR-9
- `CLAUDE.md` § "Code Quality" — Lefthook and `make check`
- `../01-claudecodeui-deep-scan.md` §3.14 — competitor's release-it and commitlint setup
- `../02-pdlc-studio-baseline.md` §3.15 — the format-gate gap
- `../03-feature-comparison-matrix.md` — `ENG-09`, `PLAT-08`, deferred `ENG-03`/`ENG-05`
