# WhatsApp Integration - Full Assessment & Remediation Plan

**Date:** June 5, 2026  
**Status:** PARTIALLY DEPLOYED - Infrastructure 70% ready, Evolution API 40% ready  
**Deployed URL:** https://dhd-crm-saletrail.vercel.app

---

## 📊 CURRENT STATE ASSESSMENT

### ✅ WORKING (Verified on Vercel)

| Feature | Status | Evidence |
|---------|--------|----------|
| **Supabase Connection** | ✅ Working | Client initialized, credentials loaded |
| **Webhook Configuration** | ✅ Working | Webhook registered with Evolution API, receiving events |
| **Chat Loading (Empty)** | ✅ Working | `/api/whatsapp?action=chatsFromDb` returns `{"success":true,"chats":[]}` |
| **Provider Settings** | ✅ Configured | `WHATSAPP_ACTIVE_PROVIDER` set in app_settings |
| **Green API Credentials** | ✅ Set | `GREENAPI_INSTANCE_ID` and `GREENAPI_TOKEN` configured |
| **Evolution API Config** | ✅ Partial | Instance name, phone linked, but endpoint not working |
| **Debug Logging** | ✅ Comprehensive | All sendNewMessage logs added to frontend |

### ⚠️ PARTIALLY WORKING

| Feature | Status | Issue |
|---------|--------|-------|
| **Send Message** | ⚠️ Endpoint exists but fails | Evolution API endpoint `/send` returns 404 (path is wrong) |
| **Status Check** | ⚠️ Returns error | Crashes with "Unexpected end of JSON input" |
| **Message Persistence** | ⚠️ Code exists but untested | Insert code is there, RLS is disabled, but never tested end-to-end |
| **Chat Display** | ⚠️ UI ready, no data | Form works, chats load but list is empty (no conversations yet) |

### ❌ NOT WORKING

| Feature | Status | Root Cause |
|---------|--------|-----------|
| **Evolution API Send** | ❌ Broken | Wrong endpoint path: `/send` doesn't exist. Correct path is `/message/send` |
| **Message Reception** | ❌ Not tested | Webhook is configured but no incoming messages tested |
| **Green API Send** | ❌ Not tested | Credentials set but never tested with real API call |
| **Provider Switcher UI** | ❌ Not implemented | "Select as Active Provider" button in Settings missing |
| **Message History** | ❌ Empty | No test messages in database yet |

---

## 🔴 CRITICAL ISSUES TO FIX

### Issue #1: Evolution API Endpoint Path Wrong ⚠️ BLOCKING
**Severity:** CRITICAL  
**Impact:** Evolution API message sending completely broken  

**Current:**
```typescript
const evolutionUrl = new URL(`/send`, EVOLUTION_API_URL).toString();
// Results in: http://cst-evolution-api-..../send
// Returns: 404 "Cannot POST /send"
```

**Problem:** The `/send` endpoint doesn't exist on Evolution API v2. The correct path is `/message/send`.

**Fix Needed:**
```typescript
const evolutionUrl = new URL(`/message/send`, EVOLUTION_API_URL).toString();
// Should result in: http://cst-evolution-api-..../message/send
```

**Verification Test:**
```bash
curl -X POST "http://cst-evolution-api-..../message/send" \
  -H "apikey: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instance": "dhd-crm-mpvtxwbu-ujwki9",
    "number": "18768412776@c.us",
    "text": "Test message"
  }'
```

---

### Issue #2: Status Endpoint Crashing ⚠️ BLOCKING
**Severity:** HIGH  
**Impact:** Health checks fail, UI can't verify WhatsApp status  

**Error:** `/api/whatsapp?action=status` returns `{"success":false,"error":"Unexpected end of JSON input"}`

**Need to investigate:**
- Check what Evolution API's `/status` endpoint returns
- Verify it returns valid JSON
- Add error handling for malformed responses

---

### Issue #3: No Test Messages in Database
**Severity:** MEDIUM  
**Impact:** Can't verify message persistence is working  

**Status:** 
- RLS is disabled ✅
- Table structure is correct ✅
- Insert code exists ✅
- But no messages have been persisted yet ❌

**Need:** Send a test message via Green API or Evolution API and verify it appears in `whatsapp_messages` table.

---

## 📋 DETAILED REMEDIATION PLAN

### Phase 1: Fix Evolution API Integration (2-3 hours)

**Step 1.1: Fix Endpoint Path**
- [ ] Update `api/whatsapp.ts` line 646: Change `/send` to `/message/send`
- [ ] Deploy to Vercel
- [ ] Test with cURL (see verification test above)
- [ ] Commit: "Fix Evolution API send endpoint path from /send to /message/send"

**Step 1.2: Test Evolution API Send End-to-End**
- [ ] Set `WHATSAPP_ACTIVE_PROVIDER = 'evolution'` in database
- [ ] Open WhatsApp UI on deployed app
- [ ] Send test message to phone number 18768412776
- [ ] Check browser console for sendNewMessage logs
- [ ] Verify message appears in Supabase `whatsapp_messages` table
- [ ] Check that message actually arrives on WhatsApp

**Step 1.3: Fix Status Endpoint**
- [ ] Test Evolution API `/status` endpoint directly
- [ ] Check what response format it returns
- [ ] Add proper error handling and response parsing
- [ ] Commit: "Fix Evolution API status endpoint error handling"

### Phase 2: Test Green API (1-2 hours)

**Step 2.1: Verify Green API Credentials**
- [ ] Check `GREENAPI_INSTANCE_ID` and `GREENAPI_TOKEN` are set in environment
- [ ] Test Green API sendMessage endpoint with cURL
- [ ] Verify you get a valid JSON response

**Step 2.2: Test Green API Send End-to-End**
- [ ] Set `WHATSAPP_ACTIVE_PROVIDER = 'greenapi'` in database
- [ ] Send test message from UI
- [ ] Check console logs for sendMessage request/response
- [ ] Verify message persists to database with `provider='greenapi'`
- [ ] Verify message arrives on WhatsApp

### Phase 3: Implement Provider Switcher UI (1-2 hours)

**Step 3.1: Add selectProvider API Action**
- [ ] Implement `/api/whatsapp?action=selectProvider` endpoint in api/whatsapp.ts
- [ ] Validate provider is available before switching
- [ ] Save to `app_settings` table
- [ ] Return success response

**Step 3.2: Add UI Buttons in Settings**
- [ ] Find WhatsApp provider cards in Settings.tsx
- [ ] Add [Select as Active Provider] button to each card
- [ ] Implement `selectProvider` handler function
- [ ] Add visual indicator showing which provider is active
- [ ] Test switching between providers

**Step 3.3: Test Provider Switching**
- [ ] Click "Select as Active Provider" on Green API
- [ ] Send message → verify it goes to Green API
- [ ] Click "Select as Active Provider" on Evolution API
- [ ] Send message → verify it goes to Evolution API
- [ ] Check database that both have messages with correct provider values

### Phase 4: Message History (2-3 hours)

**Step 4.1: Load Webhook Messages**
- [ ] Test that Evolution API webhook actually sends incoming messages
- [ ] Verify webhook is parsing messages correctly and storing in database
- [ ] Implement any missing webhook event handlers

**Step 4.2: Display Message History**
- [ ] Implement conversation view that shows message history
- [ ] Load messages from Supabase for selected conversation
- [ ] Display with provider info (which API sent it)

---

## 🧪 TESTING CHECKLIST

### Before Starting
- [ ] Clone latest master branch
- [ ] Deployed to Vercel
- [ ] Can access https://dhd-crm-saletrail.vercel.app
- [ ] Can log in with manager/manager123

### Evolution API Testing
- [ ] Can call `/api/whatsapp?action=status` → returns valid JSON
- [ ] Can send test message to 18768412776
- [ ] Message appears in Supabase whatsapp_messages with provider='evolution'
- [ ] Message actually arrives on WhatsApp
- [ ] Webhook receives incoming messages
- [ ] Chat list updates with new conversation

### Green API Testing  
- [ ] Switch to Green API provider
- [ ] Can send test message to Green API number
- [ ] Message appears in database with provider='greenapi'
- [ ] Message arrives on WhatsApp
- [ ] No interference between Evolution and Green API

### Cross-Provider Testing
- [ ] Send message via Evolution API → appears in chat
- [ ] Switch to Green API → send message → appears in same chat
- [ ] Both messages visible in conversation history
- [ ] No provider conflicts or data corruption

---

## 📁 FILES TO MODIFY

### High Priority (Critical for Evolution API)
1. **api/whatsapp.ts** (Line 646)
   - Change: `/send` → `/message/send`
   - Change: Add status endpoint error handling
   - Change: Add selectProvider action

2. **src/pages/Settings.tsx**
   - Add: selectProvider handler function
   - Add: [Select as Active Provider] buttons
   - Add: Active provider indicator/badge

### Medium Priority
3. **api/whatsapp.ts** (Lines 300-400)
   - Add: Webhook message parsing for Evolution API
   - Add: Message history loading

4. **src/pages/WhatsApp.tsx**
   - Update: Conversation view to show message history
   - Update: Display provider info for each message

---

## 📊 SUCCESS CRITERIA

| Criterion | Current | Target | Status |
|-----------|---------|--------|--------|
| Evolution API sends messages | ❌ 404 errors | ✅ Messages sent | TODO |
| Green API sends messages | ⚠️ Untested | ✅ Messages sent | TODO |
| Messages persist to DB | ⚠️ Code untested | ✅ Database records | TODO |
| Provider switching works | ❌ UI missing | ✅ Full UI flow | TODO |
| Incoming messages received | ❌ Not tested | ✅ Webhook working | TODO |
| Message history displayed | ❌ No UI | ✅ Full conversation view | TODO |
| Status check works | ❌ Crashes | ✅ Returns valid data | TODO |
| **Overall Integration** | **40%** | **100%** | **60 units of work** |

---

## 🎨 Phase 5: WhatsApp UI Improvements (Unified Search + Sales Features)

**Status:** PLANNED  
**Timeline:** ~3 hours implementation  
**Priority:** HIGH (Core sales UX)

### Overview

Transform WhatsApp from basic messaging into a professional sales inbox with:
1. **Unified search** — Find contacts, chats, AND messages in one bar (like native WhatsApp)
2. **Status tracking** — Visual indicators showing: Active / Resolved / Pending
3. **Assignment tracking** — See who owns each chat (avoid duplicate work)
4. **Team read indicators** — Know if your rep saw a message
5. **Contact link** — Jump directly to CRM contact record
6. **WhatsApp-like UI** — Minimal, familiar design

### Key Features

| Feature | Why It Matters | Implementation |
|---------|----------------|-----------------|
| **Unified Search Bar** | One place to find everything (not two separate searches) | New `searchUnified` API action combining message text + chat names + contact names |
| **Status Pills** | Reps see at a glance: is this chat active or resolved? | Status badge (🟢 Active, ⏸ Resolved, ⚠ Pending) in chat list |
| **Assignee Badges** | Prevents double work; shows team member ownership | "Assigned to: Sarah" or "Unassigned" in chat list |
| **Team Read Status** | Know if your team member opened/read a message | Blue unread dot on chat; auto-mark read when chat opens |
| **[View Contact] Button** | Jump to full customer record without context switching | Button in chat header opens CRM contact page |
| **Profile Images** | Familiar visual context | Show contact's WhatsApp profile pic in header |

### Files to Modify

1. **api/whatsapp.ts** (HIGH PRIORITY)
   - Add `searchUnified` action: Combines message search + chat search + contact search
   - Supports pagination (limit, offset)
   - Returns grouped results: chats → messages → contacts
   - Database indexes for performance: FTS on body, indexes on contact_name

2. **src/pages/WhatsApp.tsx** (HIGH PRIORITY)
   - Replace dual search bars with single unified search
   - Add status pills (green/gray/yellow) to chat list
   - Add assignee badges to chat list
   - Add unread count badges
   - Add team read status indicators on messages
   - Add jump-to-message functionality with scroll + highlight
   - Add profile image display in header

3. **supabase/email_schema.sql** (MEDIUM PRIORITY)
   - Explicit definition of `whatsapp_chats` table (currently implicit)
   - Add FTS index on `whatsapp_messages.body` for search performance
   - Add indexes on `contact_name`, `status` for faster lookups

### Implementation Sequence

**Step 1: Database (5 min)**
- [ ] Add explicit schema for `whatsapp_chats` table
- [ ] Create FTS index on `whatsapp_messages.body`
- [ ] Verify indexes are performant with test queries

**Step 2: Backend Search Endpoint (30 min)**
- [ ] Implement `searchUnified` action in api/whatsapp.ts
- [ ] Search messages (body ILIKE pattern)
- [ ] Search chats (contact_name, phone number)
- [ ] Search contacts (name, company, linked via phone)
- [ ] Combine + deduplicate results
- [ ] Add pagination support

**Step 3: Frontend Search UI (45 min)**
- [ ] Remove dual search bars (chat search + message search)
- [ ] Add unified search input at top of chat list
- [ ] Display results grouped by type: Contacts → Chats → Messages
- [ ] Implement click handlers: select chat, jump to message

**Step 4: Chat List Enhancements (30 min)**
- [ ] Add status pills next to chat name (colors: green/gray/yellow)
- [ ] Add assignee badge (show team member)
- [ ] Add unread count badge (blue circle)
- [ ] Update styling with Tailwind

**Step 5: Message & Header Updates (30 min)**
- [ ] Add team read indicators (checkmarks/eye icon)
- [ ] Fetch and display profile images
- [ ] Add [View Contact in CRM] button
- [ ] Wire up status/assignee dropdowns

**Step 6: Testing & Polish (30 min)**
- [ ] E2E test: search → select → view workflow
- [ ] Test unread → read transitions
- [ ] Test status/assignee persistence
- [ ] Test mobile responsiveness
- [ ] Performance check: search with 50K messages

### Database Changes

```sql
-- Ensure whatsapp_chats table exists
CREATE TABLE IF NOT EXISTS whatsapp_chats (
  chat_id VARCHAR(255) PRIMARY KEY,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'pending')),
  assigned_to VARCHAR(255) DEFAULT 'Unassigned',
  contact_name VARCHAR(255),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_wa_chats_contact_name ON whatsapp_chats(contact_name);
CREATE INDEX IF NOT EXISTS idx_wa_chats_status ON whatsapp_chats(status);
CREATE INDEX IF NOT EXISTS idx_wa_messages_body_fts ON whatsapp_messages 
  USING GIN (to_tsvector('english', body));
```

### API Endpoint: searchUnified

**Request:**
```
POST /api/whatsapp?action=searchUnified
{
  "q": "design",
  "limit": 20,
  "offset": 0
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "type": "chat",
      "id": "551199999999@s.whatsapp.net",
      "name": "Sarah Chen",
      "lastMessage": "Thanks for the design!",
      "timestamp": "2:34 PM",
      "status": "active",
      "assignedTo": "Sarah"
    },
    {
      "type": "message",
      "chatId": "551199999999@s.whatsapp.net",
      "chatName": "Sarah Chen",
      "text": "I love the design you sent!",
      "timestamp": "Jun 6, 2:34 PM",
      "messageId": "3EB0XXXXXX"
    },
    {
      "type": "contact",
      "id": "uuid",
      "name": "Sarah Chen",
      "company": "Design Studio",
      "phone": "55119999999",
      "status": "CONTACTED"
    }
  ],
  "total": 47
}
```

### Testing Checklist

- [ ] Unified search finds contacts by name
- [ ] Unified search finds chats by name or phone
- [ ] Unified search finds messages by text
- [ ] Search results display in correct groups (Contacts → Chats → Messages)
- [ ] Click contact → opens chat
- [ ] Click message → jumps to that message with highlight
- [ ] Chat list shows status pills (correct colors)
- [ ] Chat list shows assignee badges
- [ ] Chat list shows unread count
- [ ] Unread badge disappears when chat is opened
- [ ] Profile images load in chat header
- [ ] [View Contact] button works
- [ ] Status dropdown allows Active/Resolved/Pending changes
- [ ] Assignee dropdown allows reassignment
- [ ] All changes persist and reload correctly
- [ ] Performance acceptable (search <500ms for 50K messages)
- [ ] Mobile responsive (chat list + search visible)

### Success Criteria

| Metric | Target | Status |
|--------|--------|--------|
| Unified search working | 1 input finds all types | TODO |
| Chat list shows status | 3 color-coded pills | TODO |
| Assignee visible | "Assigned to: X" badge | TODO |
| Team read status visible | Blue unread dot | TODO |
| Contact link works | Opens CRM record | TODO |
| Profile images shown | Loaded from Evolution API | TODO |
| UI is WhatsApp-like | Minimal, familiar design | TODO |
| Performance baseline | <500ms search, 60fps scroll | TODO |

### Related Documentation

- Plan file: `C:\Users\Administrator\.claude\plans\whatsapp-ui-improvements.md`
- Exploration notes: See "Phase 1: Initial Understanding" in plan file
- API patterns: Based on existing searchMessages + chatsFromDb endpoints

---

## 🔧 QUICK START (Do This First)

**Estimated Time: 30 minutes**

```bash
# 1. Update the Evolution API endpoint path
# File: api/whatsapp.ts, Line 646
# Change: const evolutionUrl = new URL(`/send`, EVOLUTION_API_URL).toString();
# To:     const evolutionUrl = new URL(`/message/send`, EVOLUTION_API_URL).toString();

# 2. Deploy to Vercel
git add api/whatsapp.ts
git commit -m "Fix Evolution API send endpoint path from /send to /message/send"
git push origin master
# Wait 2-3 minutes for deployment

# 3. Test the fix
curl -s "https://dhd-crm-saletrail.vercel.app/api/whatsapp?action=webhookInfo"

# 4. Try sending a message from the UI
# - Navigate to https://dhd-crm-saletrail.vercel.app/#/whatsapp
# - Click "New Message"
# - Enter: 18768412776
# - Message: "Test after endpoint fix"
# - Check console logs for success
# - Check Supabase for saved message
```

---

## 📞 KNOWN ISSUES & WORKAROUNDS

### Evolution API Endpoint
**Status:** Evolution API v2 on Cloud Station uses `/message/send` not `/send`  
**Workaround:** Update endpoint path (see Phase 1, Step 1.1)  
**Permanent Fix:** Already documented above

### Missing Credentials
**Status:** Some environment variables may not be set  
**Workaround:** Set all in Vercel dashboard:
- `GREENAPI_INSTANCE_ID`
- `GREENAPI_TOKEN`
- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`

### Webhook Not Receiving Messages
**Status:** Webhook is registered but messages not appearing  
**Check:**
1. Is webhook URL actually getting called? (Check Vercel logs)
2. Is Evolution API properly forwarding messages?
3. Is message parsing code correct?

---

## 🎯 NEXT IMMEDIATE ACTIONS

1. **RIGHT NOW:** Fix Evolution API endpoint path (30 min)
2. **THEN:** Test both APIs end-to-end (1 hour)
3. **THEN:** Fix status endpoint (30 min)
4. **THEN:** Add provider switcher UI (1-2 hours)
5. **FINALLY:** Test full message history flow (1-2 hours)

**Total Estimated Time to 100% Working: 4-6 hours**

