# DHD-CRM Companion App: 12-Week Implementation Roadmap

**Full-Featured Mobile Sales Platform (Salestrail-Inspired)**

---

## 📌 What You're Building

**NOT:** A background sync service  
**BUT:** A mobile sales companion app that records calls, transcribes them, and feeds analysis to your CRM

```
Sales Rep on Phone
├─ Uses app dialer to call contacts (auto-logged)
├─ Calls recorded automatically (SIM + WhatsApp)
├─ Recordings transcribed automatically
└─ Everything synced to CRM dashboard
```

---

## 📊 High-Level Timeline

| Phase | Duration | What's Delivered |
|-------|----------|------------------|
| **Phase 1: MVP** | 3 weeks | Call recording + dialer + sync |
| **Phase 2: Transcription** | 2 weeks | Auto-transcription + search |
| **Phase 3: Intelligence** | 2 weeks | Sentiment analysis + summaries |
| **Phase 4: Polish** | 2 weeks | UI/UX + Performance |
| **Testing & Refinement** | 3 weeks | QA + Bug fixes + Launch |
| **Total** | **12 weeks** | Production-ready app |

---

## 🔍 Phase 1: MVP (Weeks 1-3)

### Goal
Basic app that records calls and syncs to CRM.

### Week 1: Project Setup & Call Detection

**Days 1-2: Project Creation**
- Create Capacitor project: `npm create @capacitor/app`
- Setup Vue 3 + TypeScript
- Setup folder structure

**Days 3-5: Call Detection Plugin**
- Create Capacitor plugin for call detection
- Hook into Android TelephonyManager
- Detect incoming/outgoing/missed calls
- Pass events to Vue app

**Code Snippet:**
```kotlin
// CallDetectionPlugin.kt
@CapacitorPlugin(name = "CallDetection")
class CallDetectionPlugin: Plugin() {

    @PluginMethod
    fun startMonitoring(call: PluginCall) {
        // Register telephony manager listener
        // Listen for calls
        // Send to JavaScript
        call.resolve()
    }
}
```

### Week 2: Call Recording

**Days 6-9: Recording Implementation**
- SIM call recording with MediaRecorder
- WhatsApp call detection + recording via WebRTC
- Local storage (phone's filesystem)
- Compression before upload

**Days 10: Call History UI**
- Build call history screen
- Display recent calls with status
- Show recording status (pending, recorded, transcribed)

**Code Snippet:**
```kotlin
// RecordingPlugin.kt
class RecorderService : Service() {
    private val mediaRecorder = MediaRecorder()
    
    fun startRecording(call: CallInfo) {
        mediaRecorder.apply {
            setAudioSource(MediaRecorder.AudioSource.VOICE_CALL)
            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            setOutputFile(getRecordingPath(call))
            prepare()
            start()
        }
    }
}
```

### Week 3: Backend Integration

**Days 11-14: Webhook & Sync**
- Build webhook endpoint (/api/whatsapp?action=addCall)
- Queue calls for syncing (offline support)
- Upload recordings to Supabase Storage
- Create cellular_calls table entries
- Settings page for configuration

**Code Snippet:**
```typescript
// api/whatsapp.ts
case 'addCall': {
  const { call, recording, contact } = req.body;
  
  // Store call
  await supabase.from('cellular_calls').insert({
    phone_number: call.phoneNumber,
    call_type: call.type,
    duration_seconds: call.duration,
    started_at: call.timestamp,
    recorded: !!recording
  });
  
  // Upload recording if exists
  if (recording) {
    const { data } = await supabase.storage
      .from('call-recordings')
      .upload(`${call.id}.m4a`, recording);
    
    await supabase.from('call_recordings').insert({
      call_id: call.id,
      storage_url: data.path,
      duration: call.duration
    });
  }
  
  return res.json({ success: true });
}
```

---

## 🎤 Phase 2: Transcription (Weeks 4-5)

### Goal
Auto-transcribe all calls using Google Speech-to-Text.

### Week 4: Transcription Pipeline

**Days 15-18: Backend Transcription**
- Setup Google Cloud Speech-to-Text API
- Create async transcription queue
- Process recordings in background
- Store transcripts in database

**Code Snippet:**
```typescript
// transcription-worker.ts (background job)
async function transcribeCall(recordingUrl: string) {
  const audio = fs.readFileSync(recordingUrl);
  
  const speechClient = new speech.SpeechClient();
  const request = {
    audio: { content: audio },
    config: {
      encoding: 'LINEAR16',
      languageCode: 'en-US',
    }
  };
  
  const [response] = await speechClient.recognize(request);
  const transcription = response.results
    .map(r => r.alternatives[0].transcript)
    .join('\n');
  
  await supabase.from('call_transcripts').insert({
    call_id: recordingUrl,
    transcript: transcription,
    confidence: response.results[0].alternatives[0].confidence
  });
}
```

### Week 5: Transcript UI

**Days 19-21: Display Transcripts**
- Show transcript in call details screen
- Add transcript search functionality
- Add playback with timestamp sync
- Download transcripts as text/PDF

---

## 🧠 Phase 3: Intelligence (Weeks 6-7)

### Goal
Add AI-powered call analysis.

### Week 6: Sentiment & Summary

**Days 22-25: Analysis Pipeline**
- Sentiment analysis using Google Cloud Natural Language
- Call summarization using Claude API
- Extract action items
- Detect keywords

**Code Snippet:**
```typescript
// call-analysis.ts
async function analyzeCall(transcript: string) {
  // Sentiment analysis
  const sentiment = await analyzesentiment(transcript);
  
  // Summary
  const summary = await claude.messages.create({
    model: "claude-3-sonnet-20240229",
    max_tokens: 200,
    messages: [{
      role: "user",
      content: `Summarize this call in 2-3 sentences:\n\n${transcript}`
    }]
  });
  
  // Keywords
  const keywords = extractKeywords(transcript);
  
  return { sentiment, summary, keywords };
}
```

### Week 7: Intelligence UI

**Days 26-28: Display Analysis**
- Show sentiment (positive/negative/neutral)
- Display summary at top of transcript
- Show extracted keywords
- Action items list

---

## 🎨 Phase 4: Polish (Weeks 8-9)

### Week 8: UI/UX Improvements

**Days 29-32:**
- Improve call history filtering
- Better recording player
- Contact integration
- Dark mode support

### Week 9: Performance & Optimization

**Days 33-35:**
- Recording compression optimization
- Database query optimization
- App size reduction
- Battery usage optimization

---

## ✅ Phase 5: Testing & Launch (Weeks 10-12)

### Week 10: Internal Testing

**Days 36-39:**
- Internal alpha testing
- Bug identification
- Fix critical issues
- Performance testing

### Week 11: Beta Testing

**Days 40-42:**
- External beta with sales team
- Gather feedback
- Iterate on feedback
- Optimize based on usage

### Week 12: Launch

**Days 43-46:**
- Final bug fixes
- Launch to production
- Monitor for issues
- Support team training

---

## 📱 Database Schema

### cellular_calls

```sql
CREATE TABLE cellular_calls (
  id UUID PRIMARY KEY,
  phone_number VARCHAR(50),
  contact_id UUID REFERENCES contacts(id),
  call_type VARCHAR(20),      -- INCOMING, OUTGOING, MISSED
  direction VARCHAR(20),       -- INBOUND, OUTBOUND
  duration_seconds INTEGER,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  device_model VARCHAR(100),
  recorded BOOLEAN,
  transcribed BOOLEAN,
  created_at TIMESTAMPTZ
);
```

### call_recordings

```sql
CREATE TABLE call_recordings (
  id UUID PRIMARY KEY,
  call_id UUID REFERENCES cellular_calls(id),
  storage_url VARCHAR(255),    -- Supabase Storage URL
  file_size_bytes INTEGER,
  duration_seconds INTEGER,
  format VARCHAR(20),          -- m4a, mp3, wav
  created_at TIMESTAMPTZ
);
```

### call_transcripts

```sql
CREATE TABLE call_transcripts (
  id UUID PRIMARY KEY,
  call_id UUID REFERENCES cellular_calls(id),
  transcript TEXT,
  confidence DECIMAL(3,2),     -- 0-1
  sentiment VARCHAR(20),       -- positive, negative, neutral
  summary TEXT,
  keywords TEXT[],
  action_items TEXT[],
  created_at TIMESTAMPTZ
);
```

---

## 🏗️ Tech Stack

### Frontend
- **Capacitor** - Cross-platform (iOS + Android)
- **Vue 3** - UI framework
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **Pinia** - State management

### Native Plugins
- **CallDetectionPlugin** - Monitor calls
- **RecordingPlugin** - Record calls
- **WhatsAppDetectionPlugin** - Detect WhatsApp calls
- **ContactSyncPlugin** - Sync CRM contacts
- **StoragePlugin** - Manage local files

### Backend
- **Node.js/Express** - API server
- **Google Cloud Speech-to-Text** - Transcription
- **Google Cloud Natural Language** - Sentiment
- **Claude API** - Summarization
- **Supabase** - Database + Storage

### External Services
- **Google Cloud** - Speech, NLP
- **Supabase Storage** - Recording storage
- **Anthropic Claude** - AI analysis

---

## 💰 Infrastructure Costs

### Supabase
- Database + Storage: ~$50-100/month
- Scale as needed

### Google Cloud
- Speech-to-Text: ~$0.024 per 15 seconds
  - 100 hours/month = $240/month
- Natural Language: ~$1 per 1,000 requests
  - Low cost

### Anthropic Claude
- ~$0.015 per 1K input tokens
- ~$0.075 per 1K output tokens
- Relatively cheap for summaries

### Total Monthly
- ~$300-400/month infrastructure
- **vs $2,400-4,800/month for Salestrail**

---

## 🎯 Success Metrics

### Phase 1 (MVP)
- ✅ App installed on team phones
- ✅ Calls recording automatically
- ✅ Records syncing to backend
- ✅ Visible in CRM dashboard

### Phase 2 (Transcription)
- ✅ All calls transcribed within 1 hour
- ✅ Transcript search working
- ✅ 95%+ transcription accuracy

### Phase 3 (Intelligence)
- ✅ Sentiment analysis accurate
- ✅ Summaries useful
- ✅ Action items extracted

### Phase 4+ (Production)
- ✅ App stable (< 1% crash rate)
- ✅ Team adoption > 80%
- ✅ Usage insights from analytics
- ✅ ROI measurable

---

## 📊 Team Requirements

### Mobile Development (Weeks 1-9)
- 1 senior mobile dev (Capacitor + native plugins)
- 1 frontend dev (Vue UI)
- Part-time: 50 hours/week × 9 weeks = 450 hours

### Backend Development (Weeks 1-12)
- 1 backend dev (API + integrations)
- Part-time: 30 hours/week × 12 weeks = 360 hours

### DevOps/Infrastructure (Weeks 1-12)
- Part-time: 10 hours/week = 120 hours

### QA/Testing (Weeks 10-12)
- 1 QA engineer × 3 weeks = 120 hours

**Total: ~1,050 hours (~5 FTE weeks)**

---

## 🚀 Next Actions

1. **Decide:** Commit to this 12-week roadmap?
2. **Allocate:** Assign dev team
3. **Setup:** Create Capacitor project
4. **Plan:** Detailed Week 1 breakdown

---

## ⚠️ Critical Success Factors

✅ **Call Recording Quality** - Must work reliably on all Android versions  
✅ **Transcription Accuracy** - Need > 90% accuracy  
✅ **Offline Capability** - Must queue & retry when offline  
✅ **Battery Usage** - Background service must not drain battery  
✅ **Permissions** - Handle all Android permission scenarios  
✅ **Data Privacy** - Comply with local recording laws  

---

**Ready to build a Salestrail-scale companion app?**

This is **not** a quick weekend project, but the **payoff is significant**:
- Professional mobile sales tool
- Zero recurring licensing costs
- Competitive advantage
- Team productivity increase
- Valuable IP asset

What do you think? Ready to commit to 12 weeks? 🚀
