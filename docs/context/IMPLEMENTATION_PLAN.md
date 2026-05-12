# DHD CRM SalesTrail — Customer Intelligence System
## Implementation Plan

> This document is the authoritative build plan agreed between the product owner
> and the AI development team on 2026-05-11. Every phase must be implemented in
> sequence. No code changes begin without referencing this document first.

---

## 1. Vision

DHD CRM SalesTrail must become the **central intelligence hub** for all customer
relationships at Dirty Hand Designs. The system must:

- **Aggregate** every customer touchpoint — emails, calls, WhatsApp, WooCommerce
  orders, and imported lead lists — into one place.
- **Unify** all data around a single Contact record per person, regardless of how
  they entered the system.
- **Analyse** that combined data to surface patterns, missed follow-ups, lapsed
  customers, and lead conversion gaps.
- **Act** — give the sales team a clear daily action list so they are always
  working the right contacts at the right time.
- **Communicate** — allow the team to respond to customers via email or WhatsApp
  directly from the CRM, with AI-drafted reply suggestions based on the full
  customer history.

The shift is from **reactive** (log what happened) to **proactive** (tell the
team what to do next and why).

---

## 2. Core Definitions

### Contact
The **master record** for every person DHD has ever interacted with, regardless
of how they entered the system (WooCommerce order, CSV import, email inquiry,
WhatsApp message, walk-in entered manually). One Contact per real person.
Contains the full 360° timeline of every interaction.

### Lead
An **active follow-up opportunity** linked to a Contact. Represents a specific
reason to pursue that contact right now (e.g. quote inquiry, upsell target,
reactivation). A Lead has a status, an assigned rep, a category, and a source.
When it resolves — converted to a deal or marked lost — the Lead closes but the
Contact remains permanently.

**Relationship:** every Lead has a `contact_id` foreign key. The Leads page
becomes a filtered view of Contacts with open follow-up opportunities.

---

## 3. Service Standards Extracted from CS Manual

These are the enforceable DHD timeframes that drive the missed opportunity rules:

| Standard | Source | Timeframe | CRM Rule |
|---|---|---|---|
| Quote must be sent | Incoming Call Script | **Within 2 hours** of inquiry call | Flag if no quote sent 2hrs after call logged |
| Email must be answered | Answering Emails section | **Within 24 hours** | Flag if inbound email unanswered after 24hrs |
| Pickup arranged | Ready for Pickup script | **Within 3 days** of completion | Flag if delivered order has no pickup/delivery call in 3 days |
| Feedback call | Feedback script | **Next business day** after delivery | Flag if completed order has no feedback call next day |
| Add to WhatsApp | Calls to Order script | At order time | Auto-action: prompt rep to add contact to WhatsApp list |
| Negative feedback follow-up | Feedback script | Immediate | Flag if negative feedback logged with no follow-up deal created |
| Lapsed customer | Business judgment | **60 days** since last order | Flag contacts with `total_orders > 1` and `last_order_date > 60 days` |

---

## 4. Confirmed Technology Decisions

| Decision | Choice | Reason |
|---|---|---|
| AI for email triage & lead analysis | **Google Gemini Flash (free tier)** | 1,500 req/day free, no credit card, high quality structured extraction |
| AI model for draft replies | **Google Gemini Flash** | Same — no additional cost |
| WhatsApp provider | **Green API (current) — keep** | Already working; migrate to official Meta Cloud API in Phase 6 |
| Omnichannel platform (Chatwoot) | **Skip** | Separate server, separate DB, works against unified data goal |
| External CRM repos | **Reference only, do not integrate** | Integration cost exceeds value; build on existing schema |
| DeepSeek | **Skip** | Privacy risk — customer data through Chinese servers |
| Web enrichment for lead import | **Tavily API (free tier: 1,000/month)** | AI-driven web research, structured results, $0 to start |

---

## 5. Current State Assessment

### What the Database Already Has (Good)
The schema was partially designed for this vision. These tables exist:
- `contacts` — unified contact entity with WooCommerce stats fields
- `interactions` — unified communication log (CALL, EMAIL, WHATSAPP, NOTE, SMS, MEETING)
- `woo_orders` — WooCommerce order storage with `contact_id` FK
- `order_trends` — aggregated trend data
- `lead_stages` — stage progression history
- `emails` — email storage
- `app_settings` — key-value settings store

### What the Application Code Has NOT Done Yet (The Gap)
| Problem | Impact |
|---|---|
| `contacts` table exists but nothing reads/writes to it | Unified profile page impossible |
| `interactions` table exists but nothing writes to it | Unified timeline impossible |
| `emails` has no `contact_id` FK | Emails not linked to contacts |
| `calls` has no contact FK at all | Calls float with a name string only |
| `whatsapp_messages` has no `contact_id` FK | WhatsApp not linked to contacts |
| `leads` table is separate from `contacts` with no link | Duplicate, siloed |
| `woo_orders.contact_id` not populated during sync | WC orders not linked to contacts |
| Team/reps hardcoded in 6+ files as plain string arrays | Brittle, not from DB |
| Dashboard stats computed in-memory | Not from real Supabase data |
| Reports use hardcoded rep names for matching | Fragile, breaks if names change |

---

## 6. Implementation Phases

---

### Phase 1 — Data Foundation
**Goal:** Every data stream writes to `contacts` and `interactions`. No UI changes yet.

**Estimated effort:** 3–4 days

#### 1.1 Database Schema Changes
Run a new migration file `supabase/v2-contact-links.sql`:

```sql
-- Add contact_id to emails
ALTER TABLE emails ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_emails_contact_id ON emails(contact_id);

-- Add contact_id to calls
ALTER TABLE calls ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_calls_contact_id ON calls(contact_id);

-- Add contact_id to whatsapp_messages
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_contact_id ON whatsapp_messages(contact_id);

-- Add contact_id to leads (linking leads to their master contact record)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_leads_contact_id ON leads(contact_id);

-- Add contact_id to deals, quotes, invoices
ALTER TABLE deals ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
```

#### 1.2 Identity Resolution Service
New file: `api/contacts.ts`

Actions:
- `resolve` — given an email address or phone number, find or create a Contact.
  Match priority: email first, normalised phone second. Create if no match.
- `list` — paginated contact list with search, filter by status/source/segment
- `get` — single contact with full interaction timeline
- `merge` — merge two duplicate contacts into one
- `enrich` — trigger web search enrichment for a contact (Tavily, Phase 4)

The `resolve` function is the identity resolution core. Every other service calls
it when they encounter a person.

#### 1.3 Wire Existing Services to contacts

**Email sync (`api/email.ts`):**
- After parsing each email, call `resolve(fromEmail)` to get `contact_id`
- Set `contact_id` on the email record before inserting
- Write one row to `interactions` (type: EMAIL, direction: INBOUND)

**Call log (`DataContext.tsx` + `api/`):**
- When a call is logged, call `resolve(phone or name)` to get `contact_id`
- Set `contact_id` on the call record
- Write one row to `interactions` (type: CALL, direction based on call type)

**WhatsApp webhook (`api/whatsapp.ts`):**
- After storing a WhatsApp message, call `resolve(phone)` to get `contact_id`
- Set `contact_id` on the `whatsapp_messages` record
- Write one row to `interactions` (type: WHATSAPP)

**WooCommerce sync (`api/woocommerce.ts`):**
- After syncing each order, call `resolve(customerEmail)` to get `contact_id`
- Set `contact_id` on `woo_orders` record
- Update `contacts` fields: `total_orders`, `total_revenue`, `last_order_date`,
  `average_order_value`

**Lead creation (`DataContext.tsx`):**
- When a lead is created, call `resolve(email or phone)` to get `contact_id`
- Set `contact_id` on the lead record

#### 1.4 Add `contacts` source enum value for email
Add `EMAIL` to the `contacts.source` CHECK constraint so email-sourced contacts
can be created.

#### 1.5 Migrate existing leads to contacts
One-time migration script in `api/contacts.ts?action=migrate`:
- Read all rows from `leads`
- For each lead, call `resolve(email, phone)` — creates or finds a Contact
- Set `leads.contact_id` to the resolved Contact id
- Copy lead status into `contacts.status` (mapping: new→NEW, contacted→CONTACTED,
  qualified→QUALIFYING, converted→CONVERTED, lost→LOST)

**Deliverable:** Every new touchpoint creates/updates a Contact record and logs
to `interactions`. Historical data is migrated. The UI does not change yet.

---

### Phase 2 — Unified Customer Profile Page
**Goal:** Any rep can open a Contact and see their complete history in one view.

**Estimated effort:** 3–4 days

#### 2.1 New Route and Page
- Route: `/contacts/:id`
- File: `src/pages/ContactProfile.tsx`
- Added to `src/App.tsx` route table and `src/components/Sidebar.tsx`

#### 2.2 Profile Page Sections
```
┌─────────────────────────────────────────────────┐
│  Contact Header                                  │
│  Name · Company · Email · Phone · Segment badge  │
│  Assigned rep · Tags · Total spend (JMD)         │
├──────────────────┬──────────────────────────────┤
│  Left Column     │  Right Column                │
│                  │                              │
│  WooCommerce     │  Activity Timeline           │
│  Order History   │  (newest first)              │
│                  │  📧 Email received            │
│  Open Deals      │  📞 Call logged — Keisha      │
│                  │  💬 WhatsApp sent             │
│  Open Quotes     │  🛒 WooCommerce order         │
│                  │  📝 Note added                │
│  Open Leads      │                              │
└──────────────────┴──────────────────────────────┘
│  Action Bar                                      │
│  [Log Call]  [Send Email]  [Send WhatsApp]       │
│  [Add Note]  [Create Lead]  [Create Deal]        │
└─────────────────────────────────────────────────┘
```

#### 2.3 Cross-Linking
Every page that shows a person's name becomes a link to their Contact profile:
- Call Logs → click name → Contact Profile
- Email Inbox → click sender → Contact Profile
- WhatsApp → click chat → Contact Profile
- WooCommerce → click customer → Contact Profile
- Pipeline → click contact name on deal → Contact Profile
- Lead list → click lead → Contact Profile

#### 2.4 Contacts List Page
- Route: `/contacts`
- File: `src/pages/Contacts.tsx`
- Replaces the current `/leads` route (which becomes an alias)
- Shows all contacts with segment filter (New / Active / At-Risk / Lapsed /
  High-Value), search, assigned rep filter, and source filter
- Each row links to `/contacts/:id`

**Deliverable:** Sales reps have one place to see everything about a customer.
No more switching between 4 pages to build context before a call.

---

### Phase 3 — Missed Opportunity Engine & Daily Action List
**Goal:** The system proactively tells the team who to contact today and why.

**Estimated effort:** 3–4 days

#### 3.1 Opportunity Rules Engine
New file: `api/opportunities.ts`

Actions:
- `scan` — runs all rules against live data, returns prioritised action list
- `dismiss` — rep dismisses a flag (stores in `dismissed_opportunities` table)
- `complete` — rep marks an action done (logs to `interactions`)

Rules (from CS manual timeframes):

| Rule ID | Condition | Priority | Suggested Action |
|---|---|---|---|
| QUOTE_UNSENT | Call logged with type "quotation" inquiry, no quote created within 2hrs | Critical | "Send quote to [name] — 2hr window breached" |
| EMAIL_UNANSWERED | Inbound email with lead_score ≥ 50, no outbound reply within 24hrs | High | "Reply to [name]'s email — overdue by Xhrs" |
| PICKUP_UNSCHEDULED | Deal moved to Delivered, no outbound call/WhatsApp within 3 days | High | "Call [name] about order pickup" |
| FEEDBACK_MISSED | Deal Delivered + no feedback call logged next business day | Medium | "Call [name] for post-delivery feedback" |
| QUALIFIED_NO_DEAL | Lead status = qualified, no Deal record linked, > 2 days | High | "Create deal for qualified lead [name]" |
| QUOTE_NO_FOLLOWUP | Deal in Quote Sent stage > 5 days with no call/email/WhatsApp | High | "Follow up on quote sent to [name]" |
| LAPSED_CUSTOMER | Contact with total_orders > 1 and last_order_date > 60 days | Medium | "Re-engage [name] — last ordered X days ago" |
| NO_ACTIVITY | Lead assigned to rep, no interaction of any type in 7 days | Medium | "Check in with [name] — no activity in 7 days" |
| NEGATIVE_FEEDBACK_OPEN | Interaction note tagged "negative feedback", no follow-up deal | High | "Offer resolution/discount to [name]" |

#### 3.2 Daily Action List Dashboard Widget
- Replaces the current static notification hardcodes in `src/App.tsx`
- Shown prominently on the Dashboard page as the top section
- Each action item shows: contact name (links to profile), rule description,
  days overdue, assigned rep, one-click actions (Call / Email / WhatsApp / Dismiss)
- Manager view: sees all reps' action lists
- Rep view: sees only their assigned items
- Badge count on Dashboard nav item = total open actions

#### 3.3 Real Notification System
- Replace the hardcoded `notifications` array in `src/App.tsx` with live data
  from the opportunities engine
- Notification bell shows real count from Supabase

#### 3.4 New Database Table
```sql
CREATE TABLE dismissed_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id VARCHAR(50) NOT NULL,
  contact_id UUID REFERENCES contacts(id),
  dismissed_by UUID REFERENCES users(id),
  dismissed_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ -- re-surface after this time
);
```

**Deliverable:** Every morning the team opens the CRM and sees exactly who to
contact and why. Missed follow-ups are visible before they become lost deals.

---

### Phase 4 — Smart Lead Import & AI Enrichment
**Goal:** Import a list, AI categorises and enriches each contact, team works
the best leads first.

**Estimated effort:** 4–5 days

#### 4.1 Enhanced Lead Import
Update `src/pages/LeadImport.tsx` (renamed to `src/pages/Contacts.tsx`):
- CSV upload maps columns to contact fields
- Before import, run identity resolution on each row — flag duplicates found in
  existing contacts
- User reviews duplicates: merge, skip, or create new
- After import, batch AI analysis runs in background (non-blocking)

#### 4.2 AI Contact Analysis (Gemini Flash)
New action in `api/contacts.ts?action=analyseImport`:

For each imported contact, Gemini Flash returns:
```json
{
  "priority": "high | medium | low",
  "likely_interest": "Vehicle Wrap | Embroidery | Screen Printing | Other",
  "is_likely_business": true,
  "suggested_category": "hot_lead | warm_lead | cold_lead | existing_customer",
  "suggested_first_message": "...",
  "reasoning": "..."
}
```

Prompt is built from:
- The contact's name, company, email domain, phone area code
- DHD's service categories (embroidery, screen printing, heat transfer)
- DHD's CS manual tone and approach

#### 4.3 Web Enrichment (Tavily)
Optional per-contact action: "Enrich Contact"
- Searches Tavily for company name + Jamaica
- Returns: business type, social media links, estimated size, industry
- Stored in `contacts.notes` as structured JSON
- Cost: ~$0.01/search, 1,000 free/month

#### 4.4 Import Categorisation View
After import, show a results table:
- Colour-coded by AI priority (red = hot, amber = warm, grey = cold)
- Likely interest category
- Suggested first action
- Bulk assign to rep
- Bulk create leads for high-priority contacts

**Deliverable:** An imported list of 200 contacts becomes a prioritised work
queue in under 2 minutes, with suggested outreach for each one.

---

### Phase 5 — Intelligence Dashboard
**Goal:** Replace hardcoded/in-memory dashboard stats with live Supabase data.
Give management real business intelligence.

**Estimated effort:** 4–5 days

#### 5.1 Live Dashboard Stats
Replace the current in-memory calculations in `src/pages/Dashboard.tsx`:
- Today's calls: from `calls` table (Supabase)
- Pipeline value: from `deals` table (Supabase)
- Revenue: from `invoices` table (status = paid)
- Open action items: from opportunities engine

#### 5.2 Customer Intelligence Section
New dashboard section visible to managers:
- **Top customers by revenue** (from `contacts.total_revenue`)
- **At-risk customers** (contacts with last_order > 30 days, previously frequent)
- **Product interest trends** (from email AI analysis + lead categories)
- **Monthly inquiry volume** by channel (email vs WhatsApp vs call)

#### 5.3 Team Accountability View
Replace the hardcoded leaderboard in Dashboard and Reports:
- Calls made today vs. action items assigned (completion rate %)
- Average quote response time (call logged → quote sent in hours)
- Average email response time
- Deals closed this month per rep

#### 5.4 Order Pattern Analysis
New section on Dashboard (manager only):
- Best-selling service categories (from WooCommerce `line_items`)
- Repeat order rate (customers with > 1 order)
- Average days between first and second order
- Revenue by month (last 12 months)

#### 5.5 Live Reports Page
Rebuild `src/pages/Reports.tsx` to pull from Supabase:
- Rep performance from real `calls`, `deals`, `interactions` data
- Exportable CSV remains
- Date range picker (this week / this month / custom)

**Deliverable:** Management has real business intelligence, not demo numbers.
Team accountability is measured automatically from system usage.

---

### Phase 6 — AI Communication Layer & WhatsApp Migration
**Goal:** Reps can draft and send communications with AI assistance. WhatsApp
moves to the official Meta Cloud API.

**Estimated effort:** 5–6 days

#### 6.1 AI-Assisted Email Replies
In `src/pages/EmailInbox.tsx` — when a rep opens an email:
- Gemini Flash analyses the email + fetches the contact's full interaction
  history from `interactions`
- Generates a suggested reply using DHD's CS manual tone and the contact's
  order history
- Rep sees: "Suggested reply (edit before sending)" — not auto-sent
- Rep edits if needed, clicks Send
- Reply stored as outbound interaction in `interactions`

Prompt context includes:
- DHD service categories and CS manual phrases
- Contact's previous orders (what they bought, when)
- Conversation history (last 5 interactions)
- Current deals/quotes in progress

#### 6.2 AI-Assisted WhatsApp Messages
In `src/pages/WhatsApp.tsx` — when rep opens a chat:
- Same Gemini analysis — suggested reply based on full contact context
- Template suggestions matched to where the customer is in the pipeline
  (e.g. if deal is "Quote Sent" → suggest quote follow-up template)

#### 6.3 WhatsApp Migration to Official Meta Cloud API
- Set up WhatsApp Business API via Meta Developer Console (free)
- Rewrite `api/whatsapp.ts` handler to parse Meta webhook format instead of
  Green API format
- All storage and UI code remains unchanged
- Green API is deprecated after successful migration test
- New env vars: `META_WA_PHONE_ID`, `META_WA_TOKEN`, `META_WA_VERIFY_TOKEN`

#### 6.4 Unified Compose from Contact Profile
From the Contact Profile page (Phase 2), the [Send Email] and [Send WhatsApp]
action buttons open a compose panel pre-loaded with:
- Contact's email/phone
- AI-suggested message
- Relevant template options
- Full send capability (not just draft)

**Deliverable:** Reps respond faster and more consistently. Every outbound
message is informed by the full customer history. WhatsApp is on a stable,
official API.

---

## 7. What Runs Before Every Phase

Before writing any code in each phase:

1. Read `docs/context/ARCHITECTURE.md` and this document
2. Run impact analysis on any symbol being modified
3. Check `FILE_MAP.md` — update it if new files, routes, or env vars are added
4. Make the smallest safe change
5. Build must pass (`npm run build`) before committing
6. Update `CHANGELOG.md` with what changed and why
7. Update `TASK_BOARD.md` to mark tasks complete

---

## 8. New Files This Plan Introduces

| File | Phase | Purpose |
|---|---|---|
| `supabase/v2-contact-links.sql` | 1 | FK migrations linking all tables to contacts |
| `api/contacts.ts` | 1 | Identity resolution, contact CRUD, migration, enrichment |
| `src/pages/Contacts.tsx` | 2 | Contacts list page (replaces/aliases LeadImport) |
| `src/pages/ContactProfile.tsx` | 2 | Unified 360° customer profile view |
| `api/opportunities.ts` | 3 | Missed opportunity rules engine |
| `supabase/v3-opportunities.sql` | 3 | dismissed_opportunities table |
| `src/components/ActionList.tsx` | 3 | Daily action list widget (used in Dashboard) |

---

## 9. Environment Variables This Plan Introduces

| Variable | Phase | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | 4 | Google Gemini Flash for AI analysis and reply drafting |
| `TAVILY_API_KEY` | 4 | Web enrichment for contact research (optional) |
| `META_WA_PHONE_ID` | 6 | Official WhatsApp Cloud API phone ID |
| `META_WA_TOKEN` | 6 | Official WhatsApp Cloud API bearer token |
| `META_WA_VERIFY_TOKEN` | 6 | Webhook verification token |

Add all of these to `.env.example` as each phase is implemented.

---

## 10. What Is NOT Being Built

- Full Supabase Auth replacement (demo login stays for now)
- Chatwoot integration (adds complexity, works against unified data goal)
- DeepSeek integration (data privacy risk)
- Real-time voice call recording or transcription
- Customer-facing portal or self-service
- Mobile app

---

## 11. Task Board for This Plan

| Phase | Task | Status |
|---|---|---|
| 1 | Write `supabase/v2-contact-links.sql` | Planned |
| 1 | Write `api/contacts.ts` with resolve + list + get | Planned |
| 1 | Wire email sync to identity resolution | Planned |
| 1 | Wire call logging to identity resolution | Planned |
| 1 | Wire WhatsApp webhook to identity resolution | Planned |
| 1 | Wire WooCommerce sync to identity resolution | Planned |
| 1 | Write one-time leads → contacts migration | Planned |
| 2 | Build `ContactProfile.tsx` with timeline | Planned |
| 2 | Build `Contacts.tsx` list page | Planned |
| 2 | Cross-link all pages to Contact Profile | Planned |
| 3 | Write `api/opportunities.ts` rules engine | Planned |
| 3 | Write `supabase/v3-opportunities.sql` | Planned |
| 3 | Build `ActionList.tsx` dashboard widget | Planned |
| 3 | Replace hardcoded notifications with live data | Planned |
| 4 | Add AI analysis to contact import | Planned |
| 4 | Add Tavily enrichment to contact profile | Planned |
| 4 | Build duplicate detection in import flow | Planned |
| 5 | Rebuild Dashboard with live Supabase data | Planned |
| 5 | Rebuild Reports with live Supabase data | Planned |
| 5 | Add order pattern analysis section | Planned |
| 6 | Add AI reply drafting to email inbox | Planned |
| 6 | Add AI reply drafting to WhatsApp | Planned |
| 6 | Migrate WhatsApp to Meta Cloud API | Planned |

---

## 12. Decisions Log

| Date | Decision | Reason |
|---|---|---|
| 2026-05-11 | Contacts = master record, Leads = active opportunities | Product owner confirmed: leads are action items, contacts are the 360° view |
| 2026-05-11 | Use Google Gemini Flash free tier | Cost-free start, 1,500 req/day, quality sufficient for triage |
| 2026-05-11 | Keep Green API for WhatsApp now | Already working; migrate to Meta Cloud API in Phase 6 |
| 2026-05-11 | Skip Chatwoot | Separate server/DB works against unified data goal |
| 2026-05-11 | Timeframes from CS manual | Quote: 2hrs, Email: 24hrs, Pickup: 3 days, Feedback: next day, Lapsed: 60 days |
| 2026-05-11 | Skip DeepSeek | Privacy risk — customer data through Chinese servers |
| 2026-05-11 | External repos for reference only | Integration cost exceeds value; build on existing schema |
