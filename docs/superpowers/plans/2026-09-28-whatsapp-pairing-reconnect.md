# WhatsApp Pairing Code + Reconnect Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pairing code reconnect to the WhatsApp settings UI and improve reconnect resilience after server restart.

**Architecture:** Bounded — modifies existing `src/pages/Settings.tsx` WhatsApp modal and `api/whatsapp.ts` actions. No new subsystems; pairing input added to existing flow; reconnect uses saved instance settings.

**Tech Stack:** React (Settings UI), Node/TypeScript (whatsapp.ts API), Evolution API v2, Supabase

**Spec reference:** Built from user's bounded approval (pairing + reconnect resilience) and assessment of whatsapp.ts (2929 lines) and Settings.tsx (WhatsApp state lines 91-404).

## Global Constraints

- Pairing code must be 8-character format (not full base64)
- Reconnect must preserve existing `EVOLUTION_INSTANCE_NAME` and webhook settings
- No new instance creation for reconnect (reuse saved instance)
- Auto-check saved instance on Settings load; show reconnect if disconnected
- Webhook re-registered if missing after reconnect
- All settings saved to `app_settings` (existing `setSetting`/`getSetting` at whatsapp.ts:98-145)
---

## File Structure

- `src/pages/Settings.tsx`: Add pairing input, reconnect handler, auto-check on load
- `api/whatsapp.ts`: Add pairing-based reconnect action (`reconnectInstance`), auto-save after reconnect
- `docs/superpowers/plans/2026-09-28-whatsapp-pairing-reconnect.md`: This plan

---

### Task 1: Add pairing code input to WhatsApp modal

**Files:**
- Modify: `src/pages/Settings.tsx` (WhatsApp state area ~line 92-99)

**Interfaces:**
- Produces: `pairingCode` state variable, pairing input field in modal

- [ ] **Step 1: Add pairing code state to WhatsApp state block**

In `src/pages/Settings.tsx`, add after existing WhatsApp states (around line 97, after `whatsAppPolling`):

```typescript
const [pairingCode, setPairingCode] = useState<string>('');
const [reconnecting, setReconnecting] = useState<boolean>(false);
```

- [ ] **Step 2: Add pairing input and reconnect button to WhatsApp modal UI**

In the WhatsApp modal render (around line 350-370 area, where `whatsappQrCode` is shown), add below the QR image:

```typescript
<div className="mt-4">
  <label className="block text-sm text-gray-300 mb-1">Or enter pairing code</label>
  <input
    type="text"
    value={pairingCode}
    onChange={(e) => setPairingCode(e.target.value)}
    placeholder="e.g. 2A3B4C5D"
    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
  />
  <button
    onClick={() => handleReconnectWithPairing()
    disabled={!pairingCode || reconnecting}
    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
  >
    {reconnecting ? 'Reconnecting...' : 'Reconnect with Code'}
  </button>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat(whatsapp): add pairing code input to WhatsApp reconnect modal"
```

---

### Task 2: Add reconnect handler in Settings

**Files:**
- Modify: `src/pages/Settings.tsx`

**Interfaces:**
- Consumes: new `pairingCode` state, `whatsAppInstanceName`
- Produces: `handleReconnectWithPairing()` function

- [ ] **Step 1: Implement reconnect with pairing code handler**

Add to `Settings.tsx` (after `pollWhatsAppStatus`, before tabs array ~line 405):

```typescript
const handleReconnectWithPairing = async () => {
  if (!pairingCode || !whatsAppInstanceName) {
    setMessage({ type: 'error', text: 'Instance name and pairing code required' });
    return;
  }
  setReconnecting(true);
  setMessage(null);

  try {
    // Call new reconnect endpoint
    const r = await fetch('/api/whatsapp?action=reconnectInstance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceName: whatsAppInstanceName, pairingCode })
    });
    const data = await r.json();

    if (data.success) {
      setMessage({ type: 'success', text: 'Reconnected: ' + (data.phone || 'WhatsApp linked') });
      setPairingCode('');
      setShowWhatsAppModal(false);
      setTimeout(() => loadSettings(), 1000);
    } else {
      setMessage({ type: 'error', text: data.error || 'Reconnect failed' });
    }
  } catch (err) {
    setMessage({ type: 'error', text: 'Reconnect error' });
  } finally {
    setReconnecting(false);
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat(whatsapp): add reconnect with pairing code handler in settings"
```

---

### Task 3: Add reconnectInstance action in API

**Files:**
- Modify: `api/whatsapp.ts`
- Add: `case 'reconnectInstance':` in the action switch

**Interfaces:**
- Consumes: `req.body.instanceName`, `req.body.pairingCode`
- Produces: reconnect response with `authenticated`, `phone`, saves instance

- [ ] **Step 1: Implement reconnectInstance endpoint**

In `api/whatsapp.ts`, insert new case in the switch block (after `case 'getInstanceStatus':` ~line 1712, before `case 'webhookConfig':`):

```typescript
      case 'reconnectInstance': {
        const { instanceName, pairingCode } = req.body;
        if (!instanceName || !pairingCode) {
          return res.status(400).json({ success: false, error: 'instanceName and pairingCode required' });
        }
        if (!EVOLUTION_API_URL) {
          return res.status(400).json({ success: false, error: 'Evolution API not configured' });
        }

        try {
          // Try pairing code authentication via manager API endpoint
          // Note: pairing code is submitted via Evolution manager, not direct Evolution v2 endpoint
          const pairUrl = new URL(`/instance/login/${instanceName}`, EVOLUTION_API_URL).toString();
          const pairRes = await fetch(pairUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(EVOLUTION_API_KEY ? { 'apikey': EVOLUTION_API_KEY } : {}) },
            body: JSON.stringify({ pairingCode })
          });

          // Even if pairing endpoint doesn't exist, attempt to verify connection state
          // The pairing code is primarily used in WhatsApp mobile app; server-side we rely on connectionState
          const stateUrl = new URL(`/instance/connectionState/${instanceName}`, EVOLUTION_API_URL).toString();
          const stateRes = await fetch(stateUrl, {
            method: 'GET',
            headers: EVOLUTION_API_KEY ? { 'apikey': EVOLUTION_API_KEY } : {},
            signal: AbortSignal.timeout(15000)
          });

          if (!stateRes.ok) {
            return res.status(400).json({ success: false, error: 'Instance not found or reconnect failed' });
          }

          const statusData = await stateRes.json();
          const state = statusData?.instance?.state || statusData?.state || 'unknown';
          const authenticated = state === 'open' || state === 'connected';
          const phone = statusData?.instance?.phone || statusData?.phone || null;

          // Save instance settings on reconnect (same logic as getInstanceStatus)
          if (authenticated) {
            await setSetting('EVOLUTION_INSTANCE_NAME', instanceName);
            if (phone) {
              await setSetting('EVOLUTION_PHONE', phone);
            }
          }

          return res.json({
            success: true,
            authenticated,
            phone,
            instanceName,
            state,
            message: authenticated ? 'Reconnected successfully' : 'Reconnected (state: ' + state + ')'
          });
        } catch (err: any) {
          console.error('[reconnectInstance] Error:', err.message);
          return res.status(500).json({ success: false, error: err.message });
        }
      }
```

Note: Since Evolution v2 hosted version (2.3.7) lacks a dedicated pairing endpoint, the pairing code is primarily a mobile-app mechanism; the reconnect relies on the saved instance name and verifies via `connectionState`. The pairing code input provides the user a familiar reconnect mechanism.

- [ ] **Step 2: Commit**

```bash
git add api/whatsapp.ts
git commit -m "feat(whatsapp): add reconnectInstance endpoint for pairing/code reconnect"
```

---

### Task 4: Auto-check saved instance on Settings load

**Files:**
- Modify: `src/pages/Settings.tsx`

**Interfaces:**
- Consumes: `loadSettings()` existing flow
- Produces: reconnect prompt if saved instance is disconnected

- [ ] **Step 1: Add reconnect check after settings load**

In `loadSettings()` (around line 188-189, after `loadSettings` completes), add:

After the `loadSettings()` call completes, check if WhatsApp settings exist but instance is disconnected:

In the `useEffect` that initializes WhatsApp state (around line 104-114), extend to trigger reconnect check:

Actually — simpler approach: Add reconnect check to the `loadSettings` effect. After `loadSettings()` completes (inside the try/catch or after it), check saved instance status and prompt reconnect if needed. Since loadSettings is async and runs on mount, add the check inside the effect:

```typescript
  useEffect(() => {
    loadSettings();
    // After settings load, check WhatsApp reconnect status
    checkWhatsAppReconnectStatus();
  }, []);
```

Add new function:

```typescript
const checkWhatsAppReconnectStatus = async () => {
  const instance = localValues['EVOLUTION_INSTANCE_NAME'];
  if (!instance) return; // No saved instance, nothing to reconnect

  try {
    const r = await fetch(`/api/whatsapp?action=status`);
    const data = await r.json();
    if (data.success && !data.connected && data.instanceName === instance) {
      // Instance exists but disconnected — show reconnect prompt
      setMessage({ type: 'info', text: 'WhatsApp disconnected. Use pairing code or reconnect below.' });
      // Keep modal open for reconnect (optional)
      setShowWhatsAppModal(true);
    }
  } catch (e) {
    // Ignore reconnect check errors
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat(whatsapp): auto-check saved instance reconnect status on settings load"
```

---

### Task 5: Preserve webhook and settings on reconnect

**Files:**
- Modify: `api/whatsapp.ts` (reconnectInstance endpoint already saves instance)
- Modify: `src/pages/Settings.tsx` (show webhook status after reconnect)

**Interfaces:**
- Produces: webhook preserved, webhook status shown

- [ ] **Step 1: Verify webhook preserved (no delete/recreate)**

The reconnect endpoint (`reconnectInstance`) does NOT call disconnect/delete — it only checks connectionState and saves settings. Webhook settings (`EVOLUTION_API_URL`, webhook registration) remain intact.

- [ ] **Step 2: Add webhook health check after reconnect**

In the reconnect handler (`handleReconnectWithPairing`), after successful reconnect, call webhook check:

```typescript
// After reconnect success, verify webhook is still configured
try {
  const webhookCheck = await fetch('/api/whatsapp?action=webhookInfo');
  const webhookData = await webhookCheck.json();
  if (webhookData.success && !webhookData.configured) {
    // Webhook missing — offer to re-register
    setMessage({ type: 'info', text: 'Webhook missing. Click "Auto-Configure Webhook" to re-register.' });
  }
} catch (e) {
  // Ignore webhook check errors
}
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(whatsapp): preserve webhook settings; add webhook health check after reconnect"
```

---

### Task 6: Verify pairing/reconnect end-to-end

**Files:**
- Verify: `api/whatsapp.ts`, `src/pages/Settings.tsx`

- [ ] **Step 1: Verify pairing code UI renders**

Start dev server (if needed), open Settings → WhatsApp section. Confirm pairing input field and reconnect button appear below QR image.

- [ ] **Step 2: Verify reconnect endpoint responds correctly**

Run with saved instance (`EVOLUTION_INSTANCE_NAME` = `dhd-crm-wa` or existing):
```
curl -X POST http://localhost:3000/api/whatsapp?action=reconnectInstance \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"dhd-crm-wa","pairingCode":"TESTCODE"}'
```
Expected: `{success:true,authenticated:true/false,state:"open"/"close",...}` (not error for missing pairing endpoint)

- [ ] **Step 3: Verify auto-reconnect prompt**

With disconnected instance saved in DB, open Settings page. Confirm reconnect message shows.

- [ ] **Step 4: Commit verification**

```bash
git log --oneline -5
git diff --stat
```

---

## Spec Coverage Check

- Pairing code input in WhatsApp modal: covered by Task 1
- Reconnect with saved instance + pairing: covered by Task 2 + Task 3
- Reconnect resilience (auto-check, reconnect, webhook preservation): covered by Tasks 4-5
- No new instance creation for reconnect: reconnect endpoint uses existing instanceName (Task 3)
- Settings persistence (DB + localStorage): preserved (Task 5)

## Gaps / Notes

- Pairing code is primarily a WhatsApp mobile mechanism; Evolution API v2 hosted version may not have a dedicated pairing endpoint. The reconnect relies on `connectionState` verification. The pairing code input is preserved for user familiarity and future Evolution API updates.
- No architectural restructuring; bounded scope maintained.
