# BrightBean Content Studio — baseline and execution

Baseline: master b6f8dbcc9d9853d61e706d02ad43633ce164422c, feature branch feat/brightbean-content-studio. Existing 204 tests passed and TypeScript passed before edits. Production build is being checked independently by lead. Phase 0 read and pinned hosted OpenAPI/source contracts reviewed.

Existing Social Inbox remains isolated and unchanged. It already verifies fresh canonical active owner/manager and provider scope. New publishing handler owns its own request-scoped authorization and durable workspace membership. Existing AI uses OPENAI_API_KEY env/settings, Anthropic sk-ant prefix or OpenAI. The only storage bucket found is public APK storage: unsuitable for private images. Use BrightBean media storage, never database binaries or that bucket.

GitNexus impact: AppInner and Sidebar each 0 upstream callers/0 affected processes, graph LOW; runtime route/navigation risk MEDIUM, new privileged workflow security HIGH. Independent QA/security required. detect_changes tool unavailable: git diff/status scope verification substitutes. Supabase CLI unavailable; timestamped additive migration authored manually, never applied to hosted DB.

Six commits: BB01 read-only readiness/media/known-post; BB02 durable schema/state machine; BB03 image upload/composer/approval-gated schedule; BB04 calendar/cancel/status operations; BB05 AI/brands/campaigns; BB06 analytics/attribution/regression/docs. No merge, deploy, live migrations, provider writes, account reconnections or settings changes. Live publication requires separate owner-authorized UAT.
