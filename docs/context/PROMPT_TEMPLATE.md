# AI Coding Prompt Template

## Full Structured Prompt

Use this for major coding tasks. Copy and fill in the bracketed sections.

```
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

Key rules:
- Never call supabase.from() directly from a page component. Use /api/* fetch calls.
- Never edit a function without running gitnexus_impact first.
- Check cellular_calls.rep_phone and devices.phone_number are same format (10-digit, no country code).
- Automation changes in api/crm.ts affect all 11 pipeline rules and daily cron.
- Changes to api/whatsapp.ts may silently break the Android companion app.

4. File Index / GitNexus Index

Use docs/context/FILE_MAP.md and the GitNexus index before opening broad or
unrelated files. Open only files relevant to this task.

Run: gitnexus_query({ query: "[concept]" }) to find relevant execution flows.
Run: gitnexus_impact({ target: "[symbolName]", direction: "upstream" }) before editing.

5. Dependencies

Check package.json and existing imports before adding dependencies.
Use Context7 or official docs for framework, library, API, or setup questions.
Verify that @supabase/supabase-js query options match the installed version.

6. What Could Break

Before editing, identify risks to:
- routes and navigation (App.tsx + Sidebar.tsx must stay in sync)
- shared CRM state in DataContext
- localStorage persistence (keys: dhd_salestrail_state, dhd_synced_calls, dhd_wa_open_contact)
- Supabase table contracts (check schema files + API handlers + types)
- Vercel API handlers and CORS behavior
- environment variables (must mirror in .env.example and Vercel settings)
- Android companion app (api/whatsapp.ts is the sync endpoint)
- Automation engine daily cron (api/crm.ts)
- CRM business workflows (tasks, automation, pipeline)

7. Current Roadmap Phase

[INSERT MILESTONE OR TASK_BOARD STATUS — see docs/context/MILESTONES.md]

8. Required Output Format

Implement the smallest safe change. Then summarize:
- files changed
- behavior changed
- what was tested or checked
- remaining risks or follow-up tasks

9. Documentation Update Requirements

After any change that affects product behavior, architecture, file relationships,
dependencies, routes, APIs, env vars, DB tables, or milestones:
- Update docs/context/CHANGELOG.md (newest entry at top)
- Update docs/context/FILE_MAP.md if files/routes/APIs changed
- Update docs/context/TASK_BOARD.md if task status changed
- Update docs/context/MILESTONES.md if a phase was completed
```

---

## Quicker Prompt

For smaller tasks, use this compact version:

```
Before making changes, read the docs/context/ files and GitNexus index first.
Use the index to find only the files relevant to this task.
Do not call supabase.from() directly from page components — use /api/* fetch calls.

Task: [INSERT TASK]
```

---

## Common Task Starters

**Adding a new page:**
```
Read docs/context/FILE_MAP.md and src/App.tsx first.
New route: /[path] → src/pages/[Page].tsx
Add to App.tsx route table and Sidebar.tsx nav.
Fetch data from /api/[endpoint] — not supabase.from() directly.
Update FILE_MAP.md with the new route and dependsOn list.
```

**Adding a new API endpoint:**
```
Read docs/context/ARCHITECTURE.md first.
Create api/[name].ts following the pattern in api/tasks.ts.
Create Supabase client with createClient() from process.env (not src/lib/supabase.ts).
Add CORS headers and handle OPTIONS.
Update FILE_MAP.md apiEndpoints section.
```

**Modifying the automation engine:**
```
Read api/crm.ts and docs/context/ARCHITECTURE.md automation section first.
Run gitnexus_impact({ target: "fireTask", direction: "upstream" }).
Check automation_rules table for active rules before changing trigger logic.
Test that automation_runs dedup check still prevents duplicate task creation.
```

**Modifying WhatsApp API:**
```
Read api/whatsapp.ts first (it is very large — ~2600 lines).
Note that this file handles: WhatsApp inbox, GSM call sync, device registration,
companion app heartbeat, AND the Android APK version check.
Changes can silently break the Android companion app.
Test both Green API and Evolution API paths if touching send/receive logic.
```
