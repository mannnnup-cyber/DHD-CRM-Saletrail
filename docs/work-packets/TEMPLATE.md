# Work Packet Template

## Metadata

- **Work Packet ID:** `WP-XXX`
- **Title:** [Descriptive title]
- **Status:** `Planned` | `In Progress` | `Review` | `Done` | `Blocked`
- **Priority:** `P0` | `P1` | `P2` | `P3`
- **Owner:** [Name/Role]
- **Assigned Agent(s):** [Agent name(s)]
- **Dependencies:** [WP-XXX, WP-XXX, or None]

## Objective

What this work packet aims to achieve.

## Business Background

Why this work matters to the business.

## Current State

What exists today that this work changes or builds on.

## Scope

In scope:
- [ ] Item 1
- [ ] Item 2

Out of Scope:
- [ ] Item excluded 1
- [ ] Item excluded 2

## Functional Requirements

1. Requirement 1
2. Requirement 2

## UX Requirements

- [ ] UX requirement 1
- [ ] UX requirement 2

## Technical Constraints

- [ ] Constraint 1 (e.g., "No direct supabase.from() in page components")
- [ ] Constraint 2

## Security Constraints

- [ ] Security constraint 1 (e.g., "No credential rotation without owner authorization")
- [ ] Security constraint 2

## Expected Files / Modules

- `path/to/file.ts` — purpose
- `path/to/other.ts` — purpose

## Testing Requirements

- [ ] Test 1
- [ ] Test 2
- Build verification (`npm run build`)

## Acceptance Criteria

1. Criterion 1 — measurable
2. Criterion 2 — verifiable
3. No regressions in existing paths

## Rollback

How to revert if this work fails:
- [ ] Rollback step 1
- [ ] Rollback step 2

## Repository Baseline (recorded by Lead during mandatory preflight)

- **Authoritative Git Root:** `<repo_absolute_path>`
- **Baseline origin/master SHA:** `<verified_origin_master_sha>`
- **Worktree:** `<worktree_path>` (record all; verify assignment matches assigned WP)
- **Branch:** `<assigned_wp_branch>`
- **HEAD:** `<current_head_sha>`
- **Ahead/Behind (branch vs origin/master):** `<ahead> ahead / <behind> behind`
- **Local Master Stale:** `<record_if_different> — LOCAL MASTER STALE — origin/master remains authoritative` (non-blocking; do NOT auto-reconcile)
- **Nested Repo:** `<none_or_path>` (block only if ambiguous/mismatch/unsafe)
- **Preflight Verdict:** `PASS` | `BLOCKED — <reason>`

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Build passes
- [ ] Type checks pass
- [ ] QA review complete
- [ ] Security review complete (if applicable)
- [ ] Documentation updated
- [ ] CHANGELOG.md entry added
- [ ] FILE_MAP.md updated (if applicable)
- [ ] TASK_BOARD.md status updated

## Implementation Report

(To be filled by implementation agent upon completion)

- **Work Packet:** WP-XXX
- **Branch/Worktree:** [branch name]
- **Files Changed:** [list]
- **Summary:** [brief description]
- **Tests Executed:** [results]
- **Build Result:** [pass/fail]
- **Known Limitations:** [any]
- **Assumptions:** [any]
- **Unresolved Questions:** [any]
- **Commit SHA:** [if committed]
- **QA Review Required:** Yes/No
- **Security Review Required:** Yes/No

## QA Review

(To be filled by QA agent)

## Security Review

(To be filled by Security agent, if applicable)
