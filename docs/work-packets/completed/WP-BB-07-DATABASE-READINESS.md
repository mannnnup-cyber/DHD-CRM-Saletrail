# BB-07: hosted database compatibility verification

Scope: user-authorized read-only comparison of vatsonbvjkyzxqrnderr and the existing BrightBean migration; necessary corrections remain on feat/brightbean-content-studio. Root is the sole implementation owner. Existing worktree/branch reused at the user's explicit instruction; QA/security independently review without edits.

No hosted migration, data or permission writes; no merge, deployment, enabling publishing, provider uploads or posts. Queries use explicit read-only transactions and metadata/zero-row probes only.

Found and reproduced CRM-delete incompatibility in the new attribution foreign keys. Corrected SET NULL behavior, initial target validation and active-link reporting; expanded tests mirror hosted default grants. Added only a feature-branch deployment guard to honor the no-deployment push restriction.

Impact attempts social_command/social_report/PublishingAnalytics returned target not found in GitNexus; static callers and targeted tests reviewed. Runtime impact limited to new social attribution/RPC/reporting and the feature branch deployment setting; unrelated CRM handlers remain unchanged. detect_changes unavailable; git diff/status/check substitutes.

Verification: hosted schema/grants/primitives/collisions/hooks inspected; 53 targeted tests/5 files and TypeScript PASS. Independent precommit QA/security review PASS; production build PASS (2,786 modules, 1,315.71kB HTML / 349.41kB gzip). Exact commit confirmation recorded in handoff. Full report: ../../BB-07-DATABASE-READINESS.md.
