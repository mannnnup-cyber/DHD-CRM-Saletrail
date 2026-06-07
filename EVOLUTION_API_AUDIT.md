# Evolution API Feature Audit & Implementation Plan

**Audit Date:** 2026-06-05  
**Status:** In Progress  
**Target Completion:** Phase 1 by end of session

---

## 📊 Current Implementation Status

### ✅ Already Implemented for Evolution API (8 features)

| Feature | Action | Status | Notes |
|---------|--------|--------|-------|
| Instance Creation | `createInstance` | ✅ Working | Creates QR code for WhatsApp linking |
| QR Code Retrieval | `getQRCode` | ✅ Working | Get QR for existing instances |
| Instance Status | `getInstanceStatus` | ✅ Working | Check if authenticated |
| Instance Deletion | `disconnect` | ✅ Working | Delete instance from Evolution API |
| Webhook Config Info | `webhookConfig` | ✅ Working | Returns webhook URL format |
| Provider Switching | `selectProvider` | ✅ Working | Switch between Green API and Evolution |
| Send Text Messages | `send` | ✅ JUST FIXED | Uses `/message/sendText/{instance}` |
| Receive Messages | `receive` | ✅ Works via webhook | Detects Evolution vs Green API format |

### ❌ Missing for Evolution API (22 features)

#### Core Messaging (HIGH PRIORITY)
| Feature | Evolution Endpoint | Priority | Impact |
|---------|-------------------|----------|--------|
| Send Images/Videos | `POST /message/sendMedia/{instance}` | 🔴 HIGH | Users can't share media |
| Send Audio Files | `POST /message/sendAudio/{instance}` | 🔴 HIGH | No voice message support |
| Send Files/Documents | `POST /message/sendDocument/{instance}` | 🔴 HIGH | Can't send PDFs, etc. |
| Send Stickers | `POST /message/sendSticker/{instance}` | 🟡 MEDIUM | Nice to have |
| Send Reactions | `POST /message/sendReaction/{instance}` | 🟡 MEDIUM | Can't react to messages |
| Send Location | `POST /message/sendLocation/{instance}` | 🟡 MEDIUM | Can't share location |
| Send Contact Card | `POST /message/sendContact/{instance}` | 🟡 MEDIUM | Can't share contacts |
| Send Poll | `POST /message/sendPoll/{instance}` | 🟡 MEDIUM | No polls |

#### Chat Management (MEDIUM PRIORITY)
| Feature | Evolution Endpoint | Priority | Impact |
|---------|-------------------|----------|--------|
| Get Chats | `GET /chat/getChats/{instance}` | 🔴 HIGH | Can't list WhatsApp chats |
| Get Messages | `GET /chat/getMessages/{instance}` | 🔴 HIGH | Can't load message history |
| Archive Chat | `PUT /chat/archiveChat/{instance}` | 🟡 MEDIUM | Can't organize chats |
| Mark as Read | `PUT /chat/markAsRead/{instance}` | 🟡 MEDIUM | No read status control |
| Delete Message | `DELETE /message/delete/{instance}` | 🟡 MEDIUM | Can't delete sent messages |

#### Group Management (MEDIUM PRIORITY)
| Feature | Evolution Endpoint | Priority | Impact |
|---------|-------------------|----------|--------|
| Create Group | `POST /group/create/{instance}` | 🟡 MEDIUM | No group creation |
| Send Group Message | `POST /message/sendText/{instance}` | 🟡 MEDIUM | Already works if group ID provided |
| Get Groups | `GET /group/getGroups/{instance}` | 🟡 MEDIUM | Can't see groups |
| Add Group Members | `PUT /group/addMember/{instance}` | 🟡 MEDIUM | Can't manage groups |
| Remove Group Members | `PUT /group/removeMember/{instance}` | 🟡 MEDIUM | Can't remove members |

#### Profile & Account (LOW PRIORITY)
| Feature | Evolution Endpoint | Priority | Impact |
|---------|-------------------|----------|--------|
| Get Profile Info | `GET /profile/me/{instance}` | 🟢 LOW | Nice to display info |
| Update Profile Name | `PUT /profile/name/{instance}` | 🟢 LOW | Can't update name |
| Update Profile Picture | `PUT /profile/picture/{instance}` | 🟢 LOW | Can't set avatar |
| Check Number Exists | `GET /chat/checkNumber/{instance}` | 🟢 LOW | Can't validate numbers |
| Get Profile Picture | `GET /profile/picture/{instance}` | 🟢 LOW | Can't show avatars |

#### Webhook Management (HIGH PRIORITY - BLOCKING)
| Feature | Evolution Endpoint | Priority | Impact |
|---------|-------------------|----------|--------|
| Configure Webhook | `POST /webhook/set/{instance}` | 🔴 HIGH | **BLOCKING**: Can't auto-configure webhooks |
| Get Webhook Config | `GET /webhook/get/{instance}` | 🔴 HIGH | **BLOCKING**: Can't verify webhook |

---

## 🎯 Implementation Plan

### Phase 1: CORE - Get Evolution API Fully Functional (Estimated: 2-3 hours)

**Goals:**
- ✅ Fix text message sending (DONE)
- ✅ Add media sending (images, videos, files)
- ✅ Add chat loading (get chats, get messages)
- ✅ Auto-configure webhooks
- ✅ Test end-to-end workflow

**Tasks:**

1. **Task 1.1: Implement sendMedia for Evolution API**
   - Add `case 'sendMedia'` to handle images/videos
   - Support base64 and URL-based media
   - Store in Supabase with correct provider tag
   - Estimated: 30 min

2. **Task 1.2: Implement sendAudio for Evolution API**
   - Add `case 'sendAudio'` endpoint
   - Handle audio base64 data
   - Support MP3, OGG, etc.
   - Estimated: 20 min

3. **Task 1.3: Implement getChats for Evolution API**
   - Add `case 'getChats'` with Evolution routing
   - Fetch all chats from Evolution API
   - Format response to match frontend expectations
   - Estimated: 25 min

4. **Task 1.4: Implement getMessages for Evolution API**
   - Add `case 'getMessages'` with Evolution routing
   - Support pagination
   - Load message history
   - Estimated: 30 min

5. **Task 1.5: Auto-configure Webhooks**
   - Detect if webhook is configured
   - Provide one-click configuration
   - Test webhook delivery
   - Estimated: 30 min

6. **Task 1.6: Create E2E Test Plan**
   - Send text message ✅ (already works)
   - Send image
   - Send video
   - Load chats
   - Load messages
   - Receive message via webhook
   - Estimated: 30 min

### Phase 2: ENHANCED - Additional Message Types (Estimated: 2 hours)

**Goals:**
- Add support for reactions, locations, contacts
- Add basic group management
- Add chat management (archive, delete)

**Tasks:**
- Implement sendReaction
- Implement sendLocation
- Implement sendContact
- Implement archiveChat
- Implement deleteMessage
- Add group message support

### Phase 3: NICE TO HAVE - Profile & Advanced (Estimated: 1 hour)

**Goals:**
- Profile management
- Contact checking
- Advanced features

**Tasks:**
- Implement profile retrieval
- Implement profile updates
- Implement checkNumber
- Implement getProfilePicture

---

## 📋 Files That Need Changes

**Primary:** `/api/whatsapp.ts`
- Add Evolution routing for media endpoints
- Add chat/message retrieval
- Add webhook auto-configuration
- Add provider-specific implementations

**Secondary:** `/src/pages/WhatsApp.tsx`
- Add UI for media uploads
- Show media preview
- Handle file selection
- Display chats from both providers

**Database:** `/supabase/whatsapp_schema.sql`
- May need to add columns for media URLs, chat info
- Update whatsapp_messages schema if needed

---

## 🚀 Success Criteria

### Phase 1 Complete When:
- [ ] Text messages send ✅
- [ ] Images can be sent
- [ ] Videos can be sent
- [ ] Files can be sent
- [ ] Chat list loads
- [ ] Message history loads
- [ ] Webhooks auto-configure
- [ ] All 7 message types appear in received messages
- [ ] No 404 errors on Evolution API

### Phase 2 Complete When:
- [ ] Reactions can be sent
- [ ] Locations can be sent
- [ ] Contact cards can be sent
- [ ] Groups can be viewed
- [ ] Group messages can be sent
- [ ] Chat archiving works

### Phase 3 Complete When:
- [ ] Profile info can be retrieved
- [ ] Profile can be updated
- [ ] Phone numbers can be validated
- [ ] Avatars display correctly

---

## ⚠️ Known Issues to Fix

1. **Webhook Configuration** - Evolution API manager requires manual setup; implement auto-config
2. **Instance ID vs Name** - Manager uses UUID but API uses name; ensure consistency
3. **Media Formats** - Verify which formats Evolution API accepts
4. **Error Handling** - Add better error messages for failed sends
5. **Timeout Issues** - Some endpoints timeout; may need retry logic

---

## 📈 Progress Tracking

**Phase 1 Progress:**
- [ ] 0% - Start
- [ ] 20% - Media sending implemented
- [ ] 40% - Audio sending implemented
- [ ] 60% - Chat/message retrieval implemented
- [ ] 80% - Webhook configuration implemented
- [ ] 100% - Full E2E testing complete

**Estimated Timeline:**
- Start: Now
- Phase 1: ~2-3 hours
- Phase 2: ~2 hours (optional)
- Phase 3: ~1 hour (optional)
- **Total: 5-6 hours for full feature parity**
