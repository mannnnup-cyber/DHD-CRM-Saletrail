# AI Coding Prompt Template

Use this template for major coding tasks.

```txt
1. Context

Project: DHD CRM SalesTrail.
Read these guard-rail files first:
- docs/context/PROJECT_BRIEF.md
- docs/context/ARCHITECTURE.md
- docs/context/FILE_MAP.md
- docs/context/TASK_BOARD.md
- docs/context/COMMENTING_STANDARD.md

2. Task

[INSERT THE SPECIFIC TASK]

3. Guard Rail Files

Follow the current architecture, commenting standard, task board, milestones,
and changelog expectations in docs/context/.

4. File Index / GitNexus Index

Use docs/context/FILE_MAP.md and the GitNexus index before opening broad or
unrelated files. Open only files relevant to this task unless the index is stale.

5. Dependencies

Check package.json and existing imports before adding dependencies. Use
Context7 or official docs for framework, library, API, or setup questions.

6. What Could Break

Before editing, identify risks to:
- routes and navigation
- shared app state
- localStorage persistence
- Supabase table contracts
- Vercel API handlers
- environment variables
- CRM business workflows
- build and deployment

7. Current Roadmap Phase

[INSERT MILESTONE OR TASK_BOARD STATUS]

8. Required Output Format

Implement the smallest safe change. Then summarize:
- files changed
- behavior changed
- tests or checks run
- remaining risks

9. Documentation Update Requirements

Update docs/context/ when the task changes project behavior, architecture, file
relationships, dependencies, routes, APIs, env vars, milestones, or completed
work.
```

## Quicker Prompt

```txt
Before making changes, read docs/context files and the GitNexus/code index first.
Use the index to find only the files relevant to this task.

Task:
[INSERT TASK]
```
