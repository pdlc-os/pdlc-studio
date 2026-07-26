# P18 — Docker Image

| Field | Value |
| --- | --- |
| **Priority** | **P18** of 30 |
| **Score** | **12.0** |
| **Inputs** | Value 3 · Reach 2 · GapWeight ×2.0 · Effort 1 |
| **Category** | Platform, Distribution & Deployment |
| **Matrix features** | `PLAT-03` (Docker image) |
| **Maturity** | PDLC Studio **0** → target **3** · claudecodeui **4** |
| **Effort** | **1** |
| **Depends on** | **P14 strongly recommended** — see §3.1 |
| **Blocks** | Nothing |
| **Status** | Proposed |

---

## 1. Context & problem statement

PDLC Studio has no container story. A search for `Dockerfile`, `docker-compose`,
`.dockerignore`, and `containerfile` across the repository returns nothing.

Its distribution is genuinely excellent for its intended use — `deno compile` single-file
binaries for Linux x64/arm64 and macOS x64/arm64, compressed to 38 MB (DMG) and 41 MB
(tar.gz), with one-command releases. `02-pdlc-studio-baseline.md` §3.14 scores that a 4.

But there is a gap between "download a binary and run it on your laptop" and the question
users actually ask when they want it somewhere else: **"how do I run this on a server, or in
an isolated environment, without installing Node, Deno, and the Claude CLI on the host?"**

Today the answer is a manual sequence: install the Claude CLI, authenticate it, download the
binary, arrange a service manager, and figure out the security implications yourself. There
is no supported, reproducible packaging for that.

There is a second motivation, and it may be the stronger one. `README.md:286-306` and
`backend/utils/permissions.ts:14-17` are candid that this app runs Claude with filesystem and
(pre-P01) shell access against a chosen directory. **A container is a meaningful isolation
boundary for exactly that.** Running PDLC Studio in a container with a single mounted project
directory bounds the blast radius in a way no amount of in-app permission logic can.

### Why P18 rather than lower

Effort 1 with a ×2.0 gap weight. Reach is only 2 — most users will never containerise a
local dev tool — but for those who do, there is currently no supported path at all.

### 3.1 The ordering constraint

**A container image is an invitation to run this on a network.** Nobody containerises
something to run it on loopback.

Until P14 (authentication) ships, a published image would be a supported, convenient way to
deploy an unauthenticated remote-shell service. That is precisely the failure mode
`04-uiux-workflow-comparison.md` §2 Journey G and P05 §3.1 exist to prevent.

**Recommendation: ship P18 after P14.** If it must ship earlier, the image **must** default
to loopback binding and its documentation **must not** demonstrate exposing it — the same
constraint P05 §3.1 imposes on the PWA work. This is FR-14.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Cited as evidence of value only.

claudecodeui has a top-level `docker/` directory and its README describes "Docker sandboxes"
as **experimental**. It also offers Electron desktop builds and a hosted cloud tier — its
distribution surface is broad because its product is broad.

Two observations worth carrying:

1. **They label it experimental.** Containerising an app that shells out to a CLI which needs
   its own authentication is genuinely fiddly (§7.3). Honest labelling is the right move and
   this PRD adopts it (FR-15).
2. **They default to `0.0.0.0`**, which is coherent *for them* because they have JWT auth and
   sell remote access. PDLC Studio must not copy that default without P14 (§3.1).

---

## 3. Goals & non-goals

### Goals

1. A supported, reproducible way to run PDLC Studio in a container.
2. Small image, consistent with the project's existing size discipline.
3. A clear answer to how the Claude CLI is provided and authenticated inside the container.
4. Sensible, safe defaults — loopback, non-root, minimal mounts.
5. Documented, honest limitations.

### Non-goals

- **A published registry image.** See §16.1 — publishing is a maintenance and trust
  commitment, and a `Dockerfile` in the repository delivers most of the value.
- **Kubernetes manifests, Helm charts, or orchestration.** Out of scope.
- **Bundling or automating Claude CLI authentication.** Credentials are the user's; §7.3.
- **A multi-user or hosted deployment mode.** Single operator remains the model.
- **Windows containers.** Windows is unsupported generally.
- **Replacing binary distribution.** Binaries remain the primary path.

---

## 4. Personas & user stories

**Sam — self-hosts on a home server.**

> As someone running a home server, I want a container image, so that I can run this
> alongside my other services without installing a toolchain on the host.

**Devon — wants isolation.**

> As a security-conscious user, I want to run the agent in a container with only one project
> directory mounted, so that a mistake cannot reach the rest of my filesystem.

**Priya — evaluating without commitment.**

> As an evaluator, I want to try it without installing Deno, Node, or the Claude CLI on my
> machine, so that trying it costs me nothing to undo.

Devon's story is the most interesting one, because it is the case where a container is not
merely convenient but genuinely safer than the default deployment.

---

## 5. Functional requirements

### Image

- **FR-1** A `Dockerfile` **MUST** exist at a discoverable location in the repository.
- **FR-2** The image **MUST** run the application without requiring Deno or Node on the host.
- **FR-3** It **MUST** support `linux/amd64` and `linux/arm64`, matching the existing release
  matrix.
- **FR-4** It **MUST** use a multi-stage build so build tooling is not shipped in the final
  layer.
- **FR-5** It **MUST NOT** run as root.
- **FR-6** It **MUST** declare the port it listens on.
- **FR-7** A `.dockerignore` **MUST** exclude `node_modules`, `dist`, `.git`, and build
  artefacts.

### Claude CLI

- **FR-8** The image **MUST** document how the Claude CLI is provided — installed in the
  image, or mounted from the host.
- **FR-9** Claude CLI credentials **MUST NOT** be baked into the image.
- **FR-10** Credential provision **MUST** be by mount or environment at run time.
- **FR-11** Where the CLI is absent or unauthenticated, the container **MUST** fail with a
  clear message rather than starting and failing at first message. **P10's health check is
  the natural mechanism.**

### Configuration

- **FR-12** Port, host, and (post-P14) password **MUST** be settable by environment variable.
- **FR-13** The project directory **MUST** be a documented mount point.
- **FR-14** The default bind **MUST** remain loopback, and documentation **MUST NOT**
  demonstrate exposing the container without authentication (§3.1).
- **FR-15** The image **MUST** be documented with its limitations, including that it is
  initially experimental.

### Build

- **FR-16** The image **SHOULD** be buildable in CI to catch breakage.
- **FR-17** Image size **SHOULD** be reported at build time, consistent with the project's
  attention to artefact size.

---

## 6. UX & interaction specification

There is no in-app UI. The "interface" is the run command and the documentation, and both
should be short enough to read in one screen.

### Intended usage

```bash
# Build
docker build -t pdlc-studio .

# Run, mounting one project and the Claude credentials
docker run --rm \
  -p 127.0.0.1:8080:8080 \
  -v "$HOME/code/my-project:/workspace/my-project" \
  -v "$HOME/.claude:/home/pdlc/.claude" \
  pdlc-studio
```

Two details carry the safety argument:

- **`-p 127.0.0.1:8080:8080`**, not `-p 8080:8080`. The former binds only loopback on the
  host; the latter exposes the container on every interface. This distinction is easy to miss
  and is the single most important line in the documentation (FR-14).
- **One project mounted**, not `$HOME`. This is Devon's isolation story, and it is what makes
  the container genuinely safer rather than merely different.

### Documentation shape

A `docker/README.md` covering: build, run, the two mounts and why, environment variables,
the CLI-authentication question (§7.3), and an explicit limitations section. Linked from the
main README's installation options.

---

## 7. Technical design

### 7.1 What goes in the image

Three plausible approaches:

| Approach | Assessment |
| --- | --- |
| **Copy the compiled binary** | Smallest and simplest. The release workflow already produces Linux x64/arm64 binaries. Image is a base plus one file. **Recommended.** |
| Install the npm package | Requires Node in the image; larger; the npm package has never actually been published (`CLAUDE.md`, "Release Process"), so this path is untested |
| Build from source in the image | Requires Deno and the full toolchain in a build stage; slowest; most reproducible |

**Recommendation: multi-stage, copying the compiled binary.** A build stage produces or
fetches the binary; the final stage is a minimal base plus the binary, a non-root user, and
whatever the Claude CLI requires (§7.3).

This preserves the project's size discipline. `CLAUDE.md` documents the 428 MB → 94 MB fight
and the decision to ship `.tar.gz` rather than `.tar.xz` to avoid an extraction dependency;
an image that reintroduces a full toolchain would be at odds with all of that.

### 7.2 Base image

The binary is `deno compile` output, which is largely self-contained but not fully static —
it typically needs glibc. So `scratch` is out, and a distroless or slim base is the target.

**This must be verified rather than assumed.** Run the actual Linux binary in a candidate
base and confirm it starts. `alpine` in particular uses musl and is a likely failure.

Note also §7.3: whatever base is chosen must be able to host the Claude CLI, which is a
Node application. That constraint may dominate the choice.

### 7.3 The Claude CLI problem — the hard part

**This is the reason the image should be labelled experimental (FR-15).**

PDLC Studio does not bundle Claude Code. `CLAUDE.md` is explicit about why: the Agent SDK
ships platform-specific executables as optional dependencies, and the app deliberately points
at *the user's own* installed CLI via `pathToClaudeCodeExecutable`, which is "what makes the
single-binary distribution work without bundling a platform binary per target."

In a container, "the user's own installed CLI" has no obvious meaning. Options:

| Option | Trade-off |
| --- | --- |
| **Install the Claude CLI in the image** | Self-contained and predictable. But adds Node and the CLI to the image, and pins a CLI version that may skew from the SDK's `claudeCodeVersion` — a risk `CLAUDE.md` explicitly warns about |
| **Mount the host's CLI** | Keeps the image small; version follows the host. But host and container architectures and libc must match, and the path must be discoverable |
| **Drop `pathToClaudeCodeExecutable`** and use the SDK's bundled executable | Removes version skew entirely. But `CLAUDE.md` notes this means "bundling binaries into the build" — acceptable *for a container*, where a single platform is targeted per image |

The third option is genuinely interesting and under-appreciated: the reason PDLC Studio
avoids the bundled executable is to keep five cross-platform binaries small. **A container
image is built per-architecture anyway**, so that constraint does not apply. It may be the
cleanest answer, at the cost of a container-specific build variant.

**Authentication is separate and unavoidable.** The Claude CLI stores credentials under
`~/.claude`. FR-9 forbids baking them in, so they must be mounted (FR-10). That mount also
carries `~/.claude.json`, which is where `GET /api/projects` reads the recent-project list
(`backend/handlers/projects.ts:21`) — so mounting it serves two purposes.

**Resolve this before writing the Dockerfile** — it determines the base image, the size, and
the documentation. It is §16.2.

### 7.4 Non-root and file ownership

FR-5 requires a non-root user. The practical consequence is **UID mismatch on mounted
volumes**: files the agent writes into a mounted project will be owned by the container's
UID, which may not match the host user.

This is the most common cause of "the container works but my files are owned by 1000" and it
must be documented, with the `--user "$(id -u):$(id -g)"` escape hatch shown.

### 7.5 CI

FR-16: a build-only job in `.github/workflows/`, next to the existing `ci.yml`,
`release.yml`, and `demo-comparison.yml`. Building on every PR catches Dockerfile rot
cheaply; publishing is a separate decision (§16.1).

Note the release workflow already builds Linux binaries — the image build should consume
those artefacts rather than rebuilding, keeping the two in step.

---

## 8. Data model & persistence

None in the application. Container-level state:

| Datum | Mechanism |
| --- | --- |
| Project files | Host bind mount (FR-13) |
| Claude credentials and `~/.claude.json` | Host bind mount (FR-10) |
| Conversation history | Inside `~/.claude`, so covered by the same mount |
| Post-P14 auth sidecar | Also under `~/.claude` — same mount |

Everything the application persists lives under `~/.claude`, which means **one mount covers
all of it**. That is a happy consequence of the sidecar decisions in P06 and P14 and worth
stating in the documentation.

---

## 9. Security implications

The most nuanced section, because containers cut both ways here.

**Genuinely improved — Devon's story:**

- A container with one project mounted bounds filesystem access far more effectively than
  any in-app permission logic. Even under `bypassPermissions`, the agent cannot reach what is
  not mounted.
- Non-root execution (FR-5) limits damage inside the container.
- This is the strongest isolation story PDLC Studio can currently offer.

**Genuinely worsened, if done carelessly:**

- **A container invites network exposure.** `-p 8080:8080` binds all host interfaces.
  Pre-P14 that is an unauthenticated remote shell. Hence §3.1, FR-14, and the ordering
  recommendation.
- **Mounting `~/.claude` mounts credentials.** Necessary (FR-10), but it means a compromised
  container has the user's Claude credentials. Worth stating plainly.
- **Mounting `$HOME` defeats the entire point.** The documentation must show a single project
  mount and explicitly warn against the broad one.

**Not addressed:** container escape, image supply chain, and registry trust — all standard
and out of scope, but reasons §16.1 treats *publishing* as a bigger commitment than
*providing a Dockerfile*.

---

## 10. Performance & scale

Container overhead is negligible for this workload. Image size is the metric worth watching
(FR-17), and it is dominated by the §7.3 decision: mounting the host CLI keeps the image
around the binary's ~145 MB uncompressed; installing Node plus the CLI could triple it.

---

## 11. Telemetry & observability

Application logging is unchanged — `backend/utils/logger.ts` writes to stdout, which is
exactly what container tooling expects. No change needed.

The startup log lines from P10 (CLI health) and P14 (auth mode) become especially valuable in
a container, where they may be the only diagnostic a user sees.

---

## 12. Test plan

There is no application code to unit-test. Verification is build-and-run.

### CI (FR-16)

| Check | Asserts |
| --- | --- |
| Image builds for `linux/amd64` | FR-3 |
| Image builds for `linux/arm64` | FR-3 |
| Final image contains no build tooling | FR-4 |
| Container does not run as root | FR-5 |
| Image size reported | FR-17 |

### Manual verification

1. Build the image; note the size.
2. Run with a project mount and a `~/.claude` mount → app reachable on loopback.
3. Complete a full chat turn end to end → confirms the CLI resolution from §7.3 works.
4. Confirm files the agent writes appear correctly on the host; note UID ownership (§7.4).
5. Run with `--user "$(id -u):$(id -g)"` → ownership correct.
6. Run **without** the `~/.claude` mount → **clear failure message**, not a silent start
   (FR-11).
7. Confirm the container does not run as root (`id` inside).
8. Confirm no credentials are present in `docker history` or image layers (FR-9).
9. On arm64 hardware, repeat 2–3.
10. Confirm the documented run command binds loopback only (FR-14).

Check 8 is the one most worth automating later — credentials in a layer are a mistake that
survives publication.

---

## 13. Rollout & migration

- Purely additive: a `Dockerfile`, a `.dockerignore`, a `docker/README.md`, and a CI job.
- No application code changes, unless §7.3 resolves toward a container-specific build variant.
- **Ship after P14** (§3.1). If shipped earlier, FR-14 is mandatory rather than advisory.
- **Label it experimental in the README** (FR-15), following claudecodeui's honest example,
  until the §7.3 question has been exercised by real users.
- Publishing to a registry is a **separate decision** (§16.1), not part of this PRD.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **Image encourages unauthenticated network exposure** | **Medium** | **High** | §3.1 ship after P14; FR-14 loopback default and documentation constraint |
| 2 | **Claude CLI resolution inside the container is unsolved** | **Medium** | **High** | §7.3 — resolve before writing the Dockerfile; label experimental |
| 3 | Binary fails on the chosen base (musl vs glibc) | Medium | Medium | §7.2 verify with the real binary; avoid alpine |
| 4 | Users mount `$HOME` and lose all isolation benefit | **Medium** | **High** | Documentation shows a single project mount and warns explicitly |
| 5 | UID mismatch produces wrongly-owned files | **High** | Low | §7.4 documented, with the `--user` escape hatch |
| 6 | Credentials baked into a layer | Low | **High** | FR-9; manual check 8; automate later |
| 7 | Image bloats, at odds with project size discipline | Medium | Low | FR-17 size reporting; §7.1 binary-copy approach |
| 8 | CLI/SDK version skew inside the image | Medium | Medium | `CLAUDE.md` warns of this generally; §7.3 option 3 removes it |
| 9 | Dockerfile rots silently | Medium | Low | FR-16 CI build on every PR |

---

## 15. Acceptance criteria

- [ ] `Dockerfile` and `.dockerignore` present
- [ ] Multi-stage build; no build tooling in the final image
- [ ] Builds for `linux/amd64` and `linux/arm64`
- [ ] Runs as a non-root user
- [ ] Declared port; port, host and password settable by environment
- [ ] **Default bind is loopback; documentation does not demonstrate unauthenticated exposure**
- [ ] Claude CLI provisioning documented and working end to end
- [ ] **No credentials in any image layer**
- [ ] Missing or unauthenticated CLI fails clearly at startup
- [ ] Single-project mount documented, with an explicit warning against mounting `$HOME`
- [ ] UID/ownership behaviour documented with the `--user` workaround
- [ ] Image size reported at build time
- [ ] CI builds the image on every PR
- [ ] Documented as experimental
- [ ] No application source changes beyond any container build variant

---

## 16. Open questions

1. **Should an image be published to a registry?** A `Dockerfile` in the repo delivers most of
   the value with none of the supply-chain or maintenance commitment. Publishing means
   signing, scanning, tagging, and a trust relationship — a real ongoing obligation for a
   single-maintainer project. **Recommendation: Dockerfile now, publish later if asked for.**
2. **How is the Claude CLI provided?** §7.3's three options. Blocking — it determines base
   image, size, and documentation. The third option (drop `pathToClaudeCodeExecutable` for a
   container build) is under-appreciated and worth evaluating properly.
3. **Which base image?** Depends on 2 and on §7.2's glibc verification.
4. **Should `docker-compose.yml` be included?** It would encode the two mounts and the
   loopback port binding as defaults, which is a real safety benefit — a compose file is
   harder to get wrong than a long `docker run`. Cheap; probably yes.
5. **Should the image ship a healthcheck** using P10's `/api/health/cli`? Natural fit, and
   it makes FR-11 observable to orchestration.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| **Resolve §7.3 CLI provisioning** | 3 h |
| Base image selection and glibc verification | 1.5 h |
| Multi-stage `Dockerfile` | 2 h |
| `.dockerignore` | 0.25 h |
| Non-root user and permissions handling | 1 h |
| `docker-compose.yml` (if adopted) | 1 h |
| `docker/README.md` | 2 h |
| CI build job, both architectures | 2 h |
| Manual verification incl. arm64 and credential-layer check | 3 h |
| **Total** | **≈15.75 h — 2 days** |

Effort **1** on the pack's scale is a slight understatement — but this writes no application
code, adds no tests to the suite, and touches nothing users of the binary depend on. The
uncertainty is concentrated entirely in §7.3.

---

## 18. References

- `CLAUDE.md` § "Single Binary Distribution" — size discipline and the Linux artefacts to reuse
- `CLAUDE.md` § "Claude CLI Path Detection" — why `pathToClaudeCodeExecutable` is set, and what
  dropping it would mean
- `CLAUDE.md` § "Claude Agent SDK Dependency Management" — CLI/SDK version skew
- `CLAUDE.md` § "Release Process" — npm publishing has never run
- `backend/handlers/projects.ts:21` — reads `~/.claude.json`, hence the mount
- `backend/utils/permissions.ts:14-17` — what the agent is permitted to do, and why isolation matters
- `README.md:286-306` — Security Considerations
- `.github/workflows/` — existing CI and release workflows
- `../01-claudecodeui-deep-scan.md` §3.13 — competitor's `docker/` directory, labelled experimental
- `../03-feature-comparison-matrix.md` — `PLAT-03`
- `../04-uiux-workflow-comparison.md` §2 Journey G — the exposure hazard
- `P05-pwa-installability.md` §3.1 — the same "do not promote exposure" constraint
- `P14-authentication.md` §9 — what auth does and does not fix, including the TLS gap
