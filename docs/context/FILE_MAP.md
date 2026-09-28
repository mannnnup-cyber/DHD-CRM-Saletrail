# File Map — DHD-CRM-Saletrail

Hybrid format: Markdown for humans, JSON block for tools/AI parsing.

```json
{
  "project": "DHD-CRM-Saletrail",
  "stack": "React + Vite + Tailwind + TypeScript (frontend) / Express + Supabase (backend) / Vercel deploy",
  "routes": [
    {"path":"/","file":"src/app/page.tsx","purpose":"Dashboard/home","dependsOn":["src/components/LeadForm.tsx","src/lib/supabase.ts"]},
    {"path":"/api/whatsapp","file":"api/whatsapp.ts","purpose":"Evolution API integration + webhook receiver","dependsOn":["supabase","EVOLUTION_API_URL","EVOLUTION_API_KEY"]},
    {"path":"/api/woocommerce","file":"api/woocommerce.ts","purpose":"WooCommerce sync + webhook","dependsOn":["WC_CONSUMER_KEY","WC_CONSUMER_SECRET"]},
    {"path":"/api/email","file":"api/email.ts","purpose":"IMAP sync / compose / send","dependsOn":["IMAP_HOST","IMAP_USER","IMAP_PASS"]},
    {"path":"/api/auth","file":"src/lib/auth.ts","purpose":"JWT + role enforcement server-side","dependsOn":["SUPABASE_SECRET_KEY"]}
  ],
  "components": [
    {"name":"LeadForm","file":"src/components/LeadForm.tsx","purpose":"Capture new leads","dependsOn":["src/lib/supabase.ts"]},
    {"name":"Dashboard","file":"src/app/dashboard/page.tsx","purpose":"Pipeline + stats","dependsOn":["api/whatsapp","api/woocommerce"]},
    {"name":"Reports","file":"src/app/reports/page.tsx","purpose":"Revenue analytics (partial)","dependsOn":["supabase"]}
  ],
  "integrations": [
    {"name":"Supabase","file":"src/lib/supabase.ts","purpose":"DB + Auth","envVariables":["SUPABASE_URL","SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY","SUPABASE_SECRET_KEY"]},
    {"name":"Evolution API","file":"api/whatsapp.ts","purpose":"WhatsApp provider","envVariables":["EVOLUTION_API_URL","EVOLUTION_API_KEY","EVOLUTION_INSTANCE_NAME","EVOLUTION_PHONE","WHATSAPP_ACTIVE_PROVIDER"],"note":"Instance dhd-crm-wa at 76.13.31.176:8080 — state=open, webhook registered"},
    {"name":"WooCommerce","file":"api/woocommerce.ts","purpose":"Order/sync","envVariables":["WC_CONSUMER_KEY","WC_CONSUMER_SECRET","WC_WEBHOOK_SECRET"]},
    {"name":"IMAP / Email","file":"api/email.ts","purpose":"Email sync","envVariables":["IMAP_HOST","IMAP_USER","IMAP_PASS"]},
    {"name":"Vercel","purpose":"Deploy + cron","envVariables":["VERCEL_OIDC_TOKEN","CRON_SECRET"]}
  ],
  "skillFiles": [
    ".claude/skills/crm-ci-cd/README.md",
    ".claude/skills/crm-webhook/README.md",
    ".claude/skills/crm-notification/README.md",
    ".claude/skills/crm-enrichment/README.md"
  ],
  "guardRails": [
    "AGENTS.md",
    "CLAUDE.md",
    ".claude/settings.json"
  ]
}
```

Dependencies / risk notes:
- `api/whatsapp.ts` (130KB) is largest handler; changes here affect Evolution, webhook, DB
- `supabase.from()` banned from page components — all reads via `/api/*`
- `WHATSAPP_ACTIVE_PROVIDER` must match DB (`app_settings`) — env fallback only
- `EVOLUTION_API_KEY` masked (first/last 4 chars) in API responses
- Webhook signature checks currently fail open (WooCommerce / WhatsApp)
