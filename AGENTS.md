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
