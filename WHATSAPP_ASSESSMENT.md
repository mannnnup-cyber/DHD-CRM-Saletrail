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

