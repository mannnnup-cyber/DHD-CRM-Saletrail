# FollOps — Product Context

## Purpose

FollOps is a Customer, Sales & Operations Intelligence platform built for
Dirty Hand Designs' internal operations. Its core conceptual model is:

**FOLLOW → INTELLIGENCE → ACTION**

Broader operating loop:
**Activity → Intelligence → Opportunity → Action → Result → Learning**

Primary tagline: **Never Miss The Next Opportunity.**

Every important screen should help answer: "What should I do next?"
AI should eventually behave more like a senior business advisor than a
reporting engine.

## Product Philosophy

- Proactive intelligence over passive reporting
- Activity-centric: every touchpoint feeds the loop
- Decisions surfaced at the moment they matter
- Practical and reliable over fancy

## Major Business Workflows

1. Lead intake → contact resolution → pipeline tracking
2. Call logging → GSM sync (companion app) → activity timeline
3. WhatsApp messaging (inbound/outbound via Green API + Evolution API)
4. WooCommerce order sync → customer linkage → fulfillment tracking
5. Email inbox → IMAP sync → contact resolution → AI analysis
6. Automation engine → daily pipeline rules → task creation
7. Team management → role-based access → rep assignment

## Current Capabilities

- Dashboard with ActionList widget (missed-opportunity engine)
- Contact management (unified profile, 360° timeline)
- Sales pipeline (kanban)
- Call logs (GSM + WhatsApp, smart timestamps, filters)
- Task management with automation-driven creation
- Quotes → Invoices workflow
- WhatsApp inbox (Green API + Evolution API)
- Email inbox (IMAP sync)
- WooCommerce order/customer sync
- BrightBean Studio social media integration
- Team page with live stats
- Automation engine with 11 pipeline rules
- AI enrichment (OpenAI + Anthropic)
- Companion Android app (GSM call sync, device tracking, recording)
- Coaching dashboard (skeleton)
- Reports (partial — pipeline live, revenue pending)

## Terminology

- **Contact** — master customer record
- **Lead** — active follow-up opportunity linked to a contact
- **Deal** — pipeline opportunity with stage and value
- **Interaction** — unified activity log entry (call, email, WhatsApp, note)
- **Automation Rule** — pipeline trigger → action definition
- **Action List** — daily missed-opportunity items surfaced on Dashboard
- **Companion** — Android app for GSM call sync

## Major Product Principles

1. Every screen answers "What should I do next?"
2. All data access through `/api/*` — never direct `supabase.from()` in pages
3. Server-side auth + role enforcement — frontend claims never trusted
4. Env-first credential resolution with `app_settings` fallback
5. RLS lockdown on all public tables
6. "by Dirty Hand Designs" may be subtle secondary attribution, not primary identity

## Deployment Scope

FollOps is currently developed primarily for Dirty Hand Designs' internal
operation. It is NOT architected for public SaaS/multi-tenancy at this
stage. Future SaaS ambitions are separate from the current internal deployment.

## Known Pre-existing Issues

- WooCommerce REST integration returning 403
- Outbound Resend email failing
- Automation cron not running
- BrightBean/YouTube OAuth issue
- BrightBean `/accounts/` upstream HTTP 500 (external, unconfirmed regression)
