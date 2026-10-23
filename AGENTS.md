<!-- antislop:start -->
## antislop
For backend, code comments, and copy work, read these installed skill files directly:
- Core filter, always on: `antislop`: `.agents/skills/antislop/SKILL.md`
- Copy & text: `antislop-copywriting`: `.agents/skills/antislop-copywriting/SKILL.md`
- Code comments: `antislop-code`: `.agents/skills/antislop-code/SKILL.md`
(Note: UI, visual, and frontend mobile styling skills reside in `console/AGENTS.md` and `console/.agents/skills/`)
Before starting, follow the core's "Two Usage Modes" section in strict order: explicit session instruction first, then global preference, then ask. A session instruction always wins. For a resolved mode, say `antislop active: <mode> (session override).` or `antislop active: <mode> (global preference).` once before presenting findings or making edits, using the actual mode and source. Acknowledging the user's request without naming the source does not replace this notice.
Only an explicit choice of antislop during or after selects a session mode. A request to review, audit, or avoid file edits does not select a mode; read the global preference in that case. Another skill's mode does not select antislop's mode.
If the mode is unresolved, ask during/after and end the response; wait for the answer before any UI review, planning, or concept. For read-only tasks, put the active-mode notice only at the start of the final answer, never in progress messages. For editing tasks, announce before the first edit and omit it from the final answer.
To update antislop later: `npx antislop-ai --update`, or run `npx antislop-ai` and pick Overwrite them.
<!-- antislop:end -->

## Engineering Standards

All code contributions must adhere to the following principles:
- **Optimal & Lean (Ponytail):** Solve the problem completely with the smallest working diff. Skip speculative features, options, and abstractions nobody asked for (YAGNI). Use existing project patterns and standard library first. Deletion beats addition.
- **Root-Cause Diagnosis:** When fixing bugs, inspect logs, reproduce the failure, and trace the root cause in shared code before editing.
- **Correctness & Testing (TDD):** Non-trivial logic (concurrency, data mutation, auth, parsing, security, routing) must have automated tests validating behavior and edge cases.
- **Review Gate:** Verify code for safety, race conditions, memory leaks, and bloat before completion.

## Agent skills

### Issue tracker

GitHub Issues via `gh` CLI.

### Triage labels

Canonical five-role triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`).

### Domain docs

Single-context domain modeling.

