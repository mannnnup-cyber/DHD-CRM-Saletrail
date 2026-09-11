# AI Agent Operating Guide

Before making code changes in this repository, read the guard-rail docs in
`docs/context/`.

## Required Reading Order

1. `docs/context/PROJECT_BRIEF.md`
2. `docs/context/ARCHITECTURE.md`
3. `docs/context/FILE_MAP.md`
4. `docs/context/TASK_BOARD.md`
5. `docs/context/COMMENTING_STANDARD.md`

## Working Rules

- Use `docs/context/FILE_MAP.md` before broad code searches.
- Open only files relevant to the task unless the file map is stale or incomplete.
- Identify what could break before editing routes, shared state, integrations, database logic, or environment-variable usage.
- Prefer official documentation or Context7 for framework, library, and API questions.
- Make the smallest safe change that satisfies the task.
- Update relevant files in `docs/context/` when behavior, architecture, routes, integrations, dependencies, or milestones change.
- Do not commit secrets, API keys, service-role keys, tokens, passwords, or private customer data.

## Hard-won rules (do not regress — each caused a real production bug)

1. **Never call `supabase.from()` from page components.** `src/lib/supabase.ts` falls back to `{} as any` in browser builds, so it silently fails. All client reads/writes go through `/api/*` endpoints.
2. **Evolution API settings come from the `app_settings` table via `getSetting()`**, never from `.env.production`. DB values win over env on conflict.
3. **Call/contact counts must be DB-level COUNT queries** (`/api/*` doing `count()` on the Supabase server side), never row fetching — the 1000-row REST cap once froze the dashboard at "982 calls" while real calls kept growing.
4. **Credentials live in `.env.production` / `.env.local` and are never printed into chat, docs, or commits.**
5. **Deploy = push to `master` → Vercel auto-deploys.** Verify the live app after pushing; don't claim done from local state alone.
6. **`C:\Users\Administrator\dhd crm sale trail\` is a stale copy — never work there.** This repo is the only live codebase.

## Documentation Updates

When a task changes the project shape, update the matching document:

- Product or business behavior: `PROJECT_BRIEF.md`
- System structure, data flow, hosting, auth, database, or integrations: `ARCHITECTURE.md`
- Routes, files, components, dependencies, env vars, or API endpoints: `FILE_MAP.md`
- Task status, blockers, or next steps: `TASK_BOARD.md`
- Phase status or delivery sequencing: `MILESTONES.md`
- Completed notable changes: `CHANGELOG.md`

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **DHD-CRM-Saletrail** (972 symbols, 1287 relationships, 23 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/DHD-CRM-Saletrail/context` | Codebase overview, check index freshness |
| `gitnexus://repo/DHD-CRM-Saletrail/clusters` | All functional areas |
| `gitnexus://repo/DHD-CRM-Saletrail/processes` | All execution flows |
| `gitnexus://repo/DHD-CRM-Saletrail/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

---

# FollOps Multi-Agent Development

This repository uses native Claude Code agents for coordinated multi-agent development.

## Agent Architecture

**Location:** `.claude/agents/*.md`

**Hierarchy:**
```
External Principal Architect (ChatGPT)
    ↓
Work Packets (docs/work-packets/active/*.md)
    ↓
follops-lead (orchestrator)
    ↓ delegates to
    ├─ follops-backend (server/API implementation)
    ├─ follops-frontend (UI/components)
    └─ follops-integrations (external APIs/webhooks)
        ↓ reviewed by
        ├─ follops-qa (independent verification)
        └─ follops-security (auth/credentials/RLS review)
```

## Agent Roster

| Agent | Role | Tools | Read-Only |
|-------|------|-------|-----------|
| **follops-lead** | Orchestration, delegation, coordination | Read, Bash, Grep, Glob, Agent, AskUserQuestion | Delegation only |
| **follops-backend** | Server handlers, auth, API endpoints | Read, Write, Edit, Bash, Grep, Glob | No |
| **follops-frontend** | React components, pages, navigation | Read, Write, Edit, Bash, Grep, Glob | No |
| **follops-integrations** | External integrations, webhooks | Read, Write, Edit, Bash, Grep, Glob | No |
| **follops-qa** | Independent verification, regression testing | Read, Bash, Grep, Glob | Yes |
| **follops-security** | Auth, RLS, credentials, security review | Read, Bash, Grep, Glob | Yes |

## Review Requirements

**QA Review:** Mandatory for every implementation work packet.

**Security Review:** Mandatory when ANY of the following conditions apply:
- The WP Security Constraints section is non-empty
- Authentication/authorization is changed
- Supabase/database privilege behavior is changed
- RLS is involved
- Credentials/secrets are involved
- Webhook security is involved
- Customer/private data handling changes
- Privileged server operations are involved
- External integration security changes
- QA identifies security-sensitive changes
- Lead is uncertain whether a change is security-sensitive

Security does NOT need to run for purely cosmetic low-risk changes unless one of those conditions appears.

## Isolation Rules

- **One work packet → one branch/worktree → one implementation agent**
- Lead creates isolated worktrees via `git worktree` (Bash)
- Implementation agents (Backend/Frontend/Integrations) work in isolation
- QA and Security review after implementation completes
- No concurrent overlapping work on same files

## Model Routing Policy

| Agent | Recommended Model | Rationale |
|-------|------------------|-----------|
| follops-lead | `sonnet` | Balanced orchestration reasoning |
| follops-backend | `sonnet` | Security-sensitive server logic |
| follops-frontend | `fable` | Mechanical UI work, fast output |
| follops-integrations | `sonnet` | API contracts, webhook security |
| follops-qa | `sonnet` | Independent verification |
| follops-security | `opus` | Adversarial review, must not miss issues |

**Note:** Model selection is set at invocation time (not in agent definition files).

## Work Packet Workflow

1. **Principal Architect** creates work packet in `docs/work-packets/active/WP-XXX.md`
2. **follops-lead** reads WP, creates worktree, delegates to specialist (Backend/Frontend/Integrations)
3. **Specialist** implements in isolated worktree, reports Implementation Report
4. **follops-qa** verifies build, tests, acceptance criteria (independent review)
5. **follops-security** reviews if WP has Security Constraints or falls under mandatory review triggers
6. **follops-lead** marks WP complete, moves to `docs/work-packets/completed/`

## Authority

- **External Principal Architect** defines requirements and approves scope
- **follops-lead** coordinates implementation, escalates constraints
- **Specialists** implement only within approved WP scope
- **Reviewers** verify independently, cannot approve their own work

## Implementation Agent Constraints

**follops-backend must NOT:**
- Broadly redesign API authentication (e.g., convert all endpoints from public to authenticated) without explicit WP scope and Security review
- Autonomously mutate production RLS policies
- Reintroduce permissive anonymous access
- Use legacy `SUPABASE_SERVICE_ROLE_KEY` for new code (use `SUPABASE_SECRET_KEY`)
- Rotate credentials without explicit owner authorization

**follops-frontend must NOT:**
- Introduce browser-side privileged Supabase access
- Reintroduce direct `supabase.from()` calls in page components
- Modify authentication/authorization logic

**follops-integrations must NOT:**
- Expose credentials in code or logs
- Modify webhook security settings without Security review
- Rotate credentials without owner authorization

## Documentation

- Agent role specifications: `docs/agents/*.md`
- Product context: `docs/context/PRODUCT.md`
- Architecture: `docs/context/ARCHITECTURE.md`
- Security baseline: `docs/context/SECURITY.md`
- File map: `docs/context/FILE_MAP.md`
- Task board: `docs/context/TASK_BOARD.md`
- Work packet template: `docs/work-packets/TEMPLATE.md`

## GitNexus Integration

This project uses GitNexus code intelligence. Implementation agents should use GitNexus MCP tools for impact analysis before editing symbols. See CLAUDE.md for GitNexus workflow.