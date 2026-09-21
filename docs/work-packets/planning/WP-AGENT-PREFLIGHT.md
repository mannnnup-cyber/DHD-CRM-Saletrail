# WP-AGENT-PREFLIGHT (APPROVED — IMPLEMENTING)
# Status: Approved for implementation in agent framework only (WP-ARCHITECTURE-REVALIDATED branch)
# Purpose: Harden follops-lead so every future repository task establishes repository truth before analysis or delegation.
# This step implements follops-lead updates + work-packet template ONLY. No .claude/agents/ change in this step — the file is updated as part of the approved implementation below.

## Rationale (from WP-ARCHITECTURE-REVALIDATED experience)
- Architecture review contained incorrect MISSING claims because source verification relied on working-tree state / stale checkout, not origin/master Git objects.
- Divergence was misreported (0/255 from stale feature branch, not 3/0 from architecture branch).
- File existence had to be re-verified against origin/master via git ls-tree / git show / git grep before document could be corrected.
- Delegated agents must inherit verified baseline; otherwise each agent risks repeating the same false assumptions.

## Preflight (mandatory, read-only, before any analysis/delegation)
1. git fetch origin
2. git rev-parse --show-toplevel -> establish authoritative Git root; document path
3. Verify expected GitHub remote (git remote -v) -> confirm matches mannnnup-cyber/DHD-CRM-Saletrail.git; STOP if unexpected or missing
4. Record origin/master SHA (git rev-parse origin/master)
5. Identify current branch / worktree / HEAD (git branch -vv; git worktree list --porcelain; git rev-parse HEAD)
6. Compare branch against origin/master (git rev-list --left-right --count HEAD...origin/master) -> document divergence
7. Detect stale local master (git rev-parse master vs origin/master; behind count) -> RECORD "LOCAL MASTER STALE — origin/master remains authoritative"; continue using fetched origin/master SHA as baseline; do NOT checkout/pull/merge/reset/reconcile local master automatically
8. Detect unexpected nested repository / worktree (find nested .git; git worktree list --porcelain) -> record all worktrees; block only when identity is ambiguous, current worktree does not correspond to assigned WP, or unsafe collision exists
9. Use origin/master Git objects for current-state claims: git show origin/master:<path>, git ls-tree -r origin/master --name-only, git grep <term> origin/master
10. If repository identity or authoritative baseline cannot be established -> STOP with REPOSITORY PREFLIGHT BLOCKED (do not proceed with analysis/delegation); block only if origin/master cannot be fetched/identified

## Baseline recording in every future work packet
- Every work packet must header: authoritative Git root, origin/master SHA, current branch, HEAD SHA, divergence (ahead/behind), worktree count, stale-local-master flag, nested-repo flag.
- Claims about current-state files must cite origin/master Git object evidence (git ls-tree/show/grep), not working-tree inference.

## Delegated agent inheritance
- Lead passes verified baseline (root, origin/master SHA, divergence, known-present/known-absent file list) into every delegated agent prompt.
- Agent must re-verify against origin/master objects before reporting facts; must not inherit working-tree state from parent checkout without confirmation.
- Agent reports deviation from baseline immediately; lead stops and re-establishes baseline before continuing.

## STOP conditions (REPOSITORY PREFLIGHT BLOCKED)
- Remote does not match expected GitHub repository
- origin/master cannot be fetched or SHA cannot be recorded
- Branch/worktree identity ambiguous (multiple worktrees, nested repo, detached HEAD not intentional)
- Divergence cannot be computed (no common base)

## NON-BLOCKING CONDITIONS / WARNINGS
- Local master is stale (record "LOCAL MASTER STALE — origin/master remains authoritative"; do NOT auto-reconcile; verified `origin/master` remains authoritative; processing continues)

## Deliverables (PA-approved implementation)
- This work packet (updated to approved form)
- follops-lead updated (.claude/agents/follops-lead.md) with mandatory preflight + baseline recording + delegated-agent inheritance
- Work-packet template updated (docs/work-packets/TEMPLATE.md) with baseline recording fields
- Baseline template for future work packets

## Constraints
- No product code change; no DB/RLS/credential mutation; no deploy; no merge; WP-001 preserved separate.
- Commit/push only after PA approval; normal commit (no amend/force-push).

Co-Authored-By: Claude Code <noreply@anthropic.com>
