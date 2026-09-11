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
5. **follops-security** reviews if WP has Security Constraints (auth/RLS/credentials)
6. **follops-lead** marks WP complete, moves to `docs/work-packets/completed/`

## Authority

- **External Principal Architect** defines requirements and approves scope
- **follops-lead** coordinates implementation, escalates constraints
- **Specialists** implement only within approved WP scope
- **Reviewers** verify independently, cannot approve their own work

## Documentation

- Agent role specifications: `docs/agents/*.md`
- Product context: `docs/context/PRODUCT.md`
- Architecture: `docs/context/ARCHITECTURE.md`
- Security baseline: `docs/context/SECURITY.md`
- File map: `docs/context/FILE_MAP.md`
- Task board: `docs/context/TASK_BOARD.md`
- Work packet template: `docs/work-packets/TEMPLATE.md`

## GitNexus Integration

This project uses GitNexus code intelligence. Implementation agents should use GitNexus MCP tools for impact analysis before editing symbols. See `CLAUDE.md` for GitNexus workflow.
