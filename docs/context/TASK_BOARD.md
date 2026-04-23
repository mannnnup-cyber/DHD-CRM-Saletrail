# Task Board

## Workflow Setup

| Task | Owner | Status | Blockers | Next Step |
| --- | --- | --- | --- | --- |
| Create AI guard-rail docs | AI agent | Done | None | Keep docs current as work changes |
| Add root AI operating guide | AI agent | Done | None | Keep `AGENTS.md` aligned with context docs |
| Add parseable file map | AI agent | Done | None | Update when files, routes, APIs, or env vars change |
| Install app dependencies | AI agent | Done | None | Review npm audit output separately |
| Set up GitNexus | AI agent | Blocked | Third-party `npx` repo indexing was rejected by execution policy | Run only after explicit risk approval |
| Set up Context7 | AI agent | Blocked | Third-party setup was not run after GitNexus policy rejection | Run only after explicit risk approval |
| Verify build | AI agent | Done | None | Re-run after future code changes |

## Product Backlog

| Task | Owner | Status | Blockers | Next Step |
| --- | --- | --- | --- | --- |
| Review production authentication approach | Team | Planned | Product/security decision | Compare demo login with Supabase Auth needs |
| Review Supabase RLS policies | Team | Planned | Production role model | Define least-privilege table policies |
| Verify WooCommerce credential storage | Team | Planned | Deployment env setup | Confirm secrets stay server-side |
| Refresh in-app documentation copy | Team | Planned | Current implementation review | Align app docs with latest setup |

## Status Values

Use `Planned`, `In progress`, `Blocked`, `Review`, or `Done`.
