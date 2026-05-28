# Contact Fields & UX Recommendations

## ✅ Completed Improvements

### Email Navigation
- **Email address now clicks through to email section** (not `mailto:`)
- Added "View Emails" button for direct navigation
- Email section anchored with `id="email-section"` for smooth scroll
- Reduces friction - users stay in app instead of opening external email client

### Cursor & Clickability Standards
All interactive elements now show `cursor-pointer`:
- Email/phone links ✓
- "View Emails" button ✓
- "Send Email" button ✓
- "Call" button ✓
- Organization "Remove" button ✓
- Enrich modal buttons ✓
- Duplicate warning buttons ✓

Non-interactive elements use `pointer-events-none`:
- Status badges
- Source badges
- Static info labels

---

## 🔴 Critical Missing Fields (Priority 1)

### 1. **Website/Company URL**
**Why:** Essential for enrichment reference and B2B context
**Database:** `website_url VARCHAR(500)`
**UI Changes:**
- Add URL input in manual entry
- Display with icon in header
- Make clickable (open in new tab)
- Capture from enrichment API

**Recommendation:** Add this FIRST - foundation for enrichment system

```sql
ALTER TABLE contacts ADD COLUMN website_url VARCHAR(500);
CREATE INDEX idx_contacts_website_url ON contacts(website_url);
```

### 2. **Contact Preference (Preferred Channel)**
**Why:** Skip irrelevant communication channels
**Database:** `contact_preference VARCHAR(50)` CHECK (IN 'email', 'phone', 'whatsapp', 'sms', 'any')
**UI Changes:**
- Add dropdown in profile header
- Icon indicator next to name
- Filter by preference in bulk outreach

**Example:**
```
🔵 John Smith (📧 Prefers Email)
```

### 3. **Timezone**
**Why:** Scheduling calls across regions (Jamaica, US, Canada)
**Database:** `timezone VARCHAR(50)` (e.g., 'America/Jamaica', 'America/New_York')
**UI Changes:**
- Add timezone selector in profile
- Show current time in their timezone
- Auto-suggest in scheduling (future)
- Set automatically from enrichment if possible

### 4. **Engagement Score / Last Response Date**
**Why:** Prioritize warm leads vs cold contacts
**Database:** 
```sql
ALTER TABLE contacts ADD COLUMN engagement_score INTEGER DEFAULT 50; -- 0-100
ALTER TABLE contacts ADD COLUMN last_response_date TIMESTAMP;
ALTER TABLE contacts ADD COLUMN response_rate DECIMAL(5,2); -- % of contacts reached
```
**Calculation:**
- +10 points per email opened (from email system)
- +20 points per reply within 24h
- +15 points per whatsapp message received
- -5 points per week of silence
- Auto-update based on interactions

### 5. **LinkedIn URL**
**Why:** B2B context, decision maker verification
**Database:** `linkedin_url VARCHAR(500)`
**UI Changes:**
- Add input in profile
- Display LinkedIn profile card on hover
- Use in duplicate detection (fuzzy match)
- Capture from enrichment if available

---

## 🟡 Recommended Fields (Priority 2)

### 6. **Risk Level**
**Why:** Flag problematic contacts early
**Database:** `risk_level VARCHAR(20)` CHECK (IN 'safe', 'caution', 'high', 'blacklist')
**UI Changes:**
- Color-coded badge (🟢 Safe, 🟡 Caution, 🔴 High, ⚫ Blacklist)
- Reason text field
- Filter in Contacts list
- Block outreach to blacklist

**Use Cases:**
- Competitor companies (High)
- Spam/bot accounts (Blacklist)
- Invoice payment delays (Caution)
- Previous failed projects (High)

### 7. **Lead Source Detail**
**Why:** Track conversion metrics by channel
**Database:** `lead_source_detail VARCHAR(200)`
**Examples:**
- Google Organic Search → keyword "luxury branding"
- LinkedIn → recruiter outreach
- Referral → from Company X
- WooCommerce → upsell customer
- CSV Import → client list
- Instagram DM → social inquiry

**UI:** Hierarchy dropdown
```
├─ Organic
│  ├─ Google Search
│  ├─ LinkedIn
│  └─ Instagram
├─ Paid
│  ├─ Google Ads
│  └─ Facebook Ads
├─ Referral
└─ Other
```

### 8. **Decision Maker Flag**
**Why:** Prioritize decision makers in campaigns
**Database:** `is_decision_maker BOOLEAN DEFAULT false`
**UI Changes:**
- Checkbox in profile
- Crown icon next to name if true
- Filter in Contacts list
- Separate list view for decision makers

### 9. **Next Follow-up Date**
**Why:** Automated reminder system (future phase)
**Database:** `next_followup_date DATE`
**UI Changes:**
- Set date picker in profile
- Red badge if overdue
- Show in Contacts list
- Trigger notifications/tasks

### 10. **Customer Lifetime Value (CLV) Prediction**
**Why:** Identify high-value prospects early
**Database:** `predicted_clv DECIMAL(10,2)`, `clv_confidence FLOAT`
**Calculation:**
- Based on first order value
- Industry benchmarks
- Company size
- Engagement level

---

## 🔵 Nice-to-Have Fields (Priority 3)

### 11. **Birthday / Anniversary**
**Why:** Relationship building, special outreach
**Database:** `birthday DATE`, `business_anniversary DATE`
**UI:** Show in timeline, trigger reminder tasks

### 12. **Industry / Sector**
**Why:** Segmentation, targeted campaigns
**Database:** `industry VARCHAR(100)` (e.g., 'Hospitality', 'Retail', 'SaaS')
**UI:** Dropdown with pre-defined options, filterable in Contacts

### 13. **Contact Quality Score**
**Why:** How complete is the contact record?
**Database:** `contact_completeness_score INTEGER` (0-100)
**Auto-calculated:**
- Name: +25 points
- Email: +25 points
- Phone: +25 points
- Company: +10 points
- Website: +10 points
- Organization affiliation: +10 points
- Enriched data: +5 points

### 14. **Tags / Custom Labels**
**Why:** Flexible categorization
**Database:** `tags TEXT[]` (array of strings)
**Examples:** `["VIP", "Early-Adopter", "Referrer", "Problem-Child"]`
**UI:** Multi-select picker, color-coded display

---

## 📊 Current Field Coverage

| Field | Status | Notes |
|-------|--------|-------|
| Name | ✅ | Complete |
| Email | ✅ | Complete, now navigates to email section |
| Phone | ✅ | Complete, callable |
| Company | ✅ | Complete |
| Source | ✅ | Complete (WOOCOMMERCE, WHATSAPP, EMAIL, CSV, MANUAL) |
| Status | ✅ | Complete (NEW, CONTACTED, QUALIFYING, VERIFIED_CUSTOMER, CONVERTED, LOST) |
| Website URL | ❌ | **NEEDED** |
| LinkedIn | ❌ | **NEEDED** |
| Contact Preference | ❌ | **NEEDED** |
| Timezone | ❌ | **NEEDED** |
| Decision Maker | ❌ | **NEEDED** |
| Risk Level | ❌ | **NEEDED** |
| Lead Source Detail | ❌ | **NEEDED** |
| Engagement Score | ❌ | **NEEDED** |
| Next Follow-up | ❌ | **NEEDED** |
| Tags | ✅ | Complete (exists in database) |
| Enrichment Data | ✅ | Complete (source, confidence, timestamp, notes) |
| Organizations | ✅ | Complete (role, dates, primary) |
| Orders Data | ✅ | Complete (total_orders, total_revenue, avg_order_value) |
| Created Date | ✅ | Complete |

---

## 🎯 Recommended Implementation Order

### Phase 5: Critical Contact Fields
1. Website URL (impacts enrichment)
2. Contact Preference (impacts outreach)
3. Timezone (scheduling foundations)
4. LinkedIn URL (B2B context)

### Phase 6: Lead Intelligence
5. Risk Level (safety)
6. Engagement Score (lead scoring)
7. Decision Maker Flag (prioritization)
8. Next Follow-up Date (automation)

### Phase 7: Advanced Features
9. Industry/Sector (segmentation)
10. CLV Prediction (value scoring)
11. Lead Source Detail (attribution)
12. Birthday/Anniversary (relationship)

---

## 💡 UX Patterns Already Implemented

These patterns should be replicated for new fields:

### ✅ Modal Forms (Enrichment)
- Auto-detect toggle
- Multiple input modes
- Success feedback
- Error handling

### ✅ Badge System
- Color-coded status (risk level follows this)
- Icon + text
- Hover tooltips

### ✅ Multi-select Pickers
- Tags implementation (reuse for new fields)
- Search + filter
- Color labels

### ✅ Date Range UI
- Start/end dates (org affiliation pattern)
- Optional end (ongoing/active)
- Relative date display

---

## 📝 Database Migration Template

For each new field, follow this pattern:

```sql
-- Add column safely
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'contacts' AND column_name = 'website_url') THEN
    ALTER TABLE contacts ADD COLUMN website_url VARCHAR(500);
    CREATE INDEX idx_contacts_website_url ON contacts(website_url);
  END IF;
END $$;
```

---

## 🔗 Field Relationships

```
Contact
├─ Basic Info
│  ├─ name ✅
│  ├─ email ✅ → View Emails (NEW)
│  ├─ phone ✅ → Call
│  ├─ website_url (TODO) → Open in browser
│  └─ linkedin_url (TODO)
│
├─ Context
│  ├─ company ✅
│  ├─ industry (TODO)
│  ├─ timezone (TODO)
│  ├─ decision_maker (TODO)
│  └─ organizations ✅
│
├─ Engagement
│  ├─ engagement_score (TODO)
│  ├─ last_response_date (TODO)
│  ├─ next_followup_date (TODO)
│  ├─ response_rate (TODO)
│  └─ interactions ✅
│
├─ Value & Risk
│  ├─ predicted_clv (TODO)
│  ├─ risk_level (TODO)
│  ├─ contact_preference (TODO)
│  └─ tags ✅
│
├─ Source
│  ├─ source ✅
│  ├─ lead_source_detail (TODO)
│  └─ created_at ✅
│
└─ Orders (WooCommerce)
   ├─ total_orders ✅
   ├─ total_revenue ✅
   ├─ average_order_value ✅
   └─ last_order_date ✅
```

---

## 🎨 UI Component Status

| Component | Status | Notes |
|-----------|--------|-------|
| Email Navigation | ✅ NEW | Clicks → email section |
| Cursor Indicators | ✅ NEW | cursor-pointer on all interactive |
| Organization Links | ✅ | With role + dates |
| Enrichment Status | ✅ | Confidence score + metadata |
| Duplicate Detection | ✅ | Pre-enrichment warning |
| Tags Display | ✅ | Colored badges |
| Status Badge | ✅ | Color-coded |
| Source Badge | ✅ | Icon + label |
| Interaction Timeline | ✅ | Multi-channel view |

---

## 📋 Checklist for Next Phases

- [ ] Add website_url field + UI input
- [ ] Add contact_preference field + selector UI
- [ ] Add timezone field + selector UI
- [ ] Add linkedin_url field + UI display
- [ ] Create engagement_score calculation engine
- [ ] Add risk_level field + color system
- [ ] Add decision_maker flag + crown icon
- [ ] Create next_followup_date picker + reminder system
- [ ] Add industry field + categorization
- [ ] Implement CLV prediction algorithm
- [ ] Build lead_source_detail hierarchy
- [ ] Add birthday/anniversary fields + timeline display

---

## 🚀 Summary

**Quick Wins (1-2 hours):**
- ✅ Email navigation (DONE)
- ✅ Cursor improvements (DONE)
- [ ] Website URL field (add one column + input)

**High Impact (4-6 hours):**
- Contact Preference
- Timezone
- LinkedIn URL
- Risk Level

**Automation Ready (8-12 hours):**
- Engagement Score (auto-calculated)
- Next Follow-up (workflow trigger)
- CLV Prediction (algorithm + display)

All recommendations follow existing UI patterns and maintain code consistency.
