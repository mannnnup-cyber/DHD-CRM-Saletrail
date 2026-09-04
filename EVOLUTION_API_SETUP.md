# Evolution API Docker Deployment Setup Guide

**New Evolution API URL:** `http://76.13.31.176:32768`  
**API Key:** `<YOUR_EVOLUTION_API_KEY>`  
**Instance Name:** `dhd-crm-mpvtxwbu-ujwki9`  
**Status:** Ready to configure ⚙️

---

## 🚀 Step-by-Step Setup

### Step 1: Verify Your Docker Evolution API is Accessible

Before setting environment variables, **test that your Evolution API Docker is accessible from the internet**:

```bash
# From your local machine or server:
curl -X POST "http://76.13.31.176:32768/message/send" \
  -H "apikey: <YOUR_EVOLUTION_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "instance": "dhd-crm-mpvtxwbu-ujwki9",
    "number": "18768412776@c.us",
    "text": "Test message"
  }'
```

**Expected responses:**
- ✅ Success: `{"status":"success","data":{"key":"..."}}`
- ❌ Error: `{"error":"..."}` or timeout
- ❌ Connection refused: Check firewall/port

**If it fails, check:**
1. Docker container is running: `docker ps | grep evolution`
2. Port 32768 is exposed in Docker: `docker port CONTAINER_ID`
3. Firewall allows port 32768 inbound
4. No reverse proxy/load balancer blocking requests

---

### Step 2: Add Environment Variables to Vercel

**Online:**
1. Go to https://vercel.com/dashboard
2. Select **DHD-CRM-Saletrail** project
3. Click **Settings**
4. Click **Environment Variables**
5. Add these variables:

| Variable | Value |
|----------|-------|
| `EVOLUTION_API_URL` | `http://76.13.31.176:32768` |
| `EVOLUTION_API_KEY` | `<YOUR_EVOLUTION_API_KEY>` |
| `EVOLUTION_INSTANCE_NAME` | `dhd-crm-mpvtxwbu-ujwki9` |
| `EVOLUTION_PHONE` | `18768412776` |
| `WHATSAPP_ACTIVE_PROVIDER` | `evolution` |

6. Click **Save**

**Note:** Make sure to select **All** for "Environments" (Production, Preview, Development) unless you only want it for Production.

---

### Step 3: Redeploy to Vercel

After adding environment variables, you **must redeploy** for them to take effect:

```bash
# Option A: Via Git (automatic)
git push origin master
# Vercel will auto-deploy with new env vars

# Option B: Via Vercel CLI
vercel --prod --env-file .env.production

# Option C: Via Vercel Dashboard
# 1. Go to Deployments tab
# 2. Click the three dots on latest deployment
# 3. Select "Redeploy"
```

**Wait for deployment to complete (~2-3 minutes)**

---

### Step 4: Test the Deployed Configuration

Once deployed, test that Vercel can reach your Evolution API:

```bash
# Test 1: Check if Vercel function can access Evolution API
curl "https://dhd-crm-saletrail.vercel.app/api/whatsapp?action=status"

# Expected: Should show connection status to your Docker API
# If it fails: Check that your Docker API is accessible from the internet
```

---

### Step 5: Test Message Sending

**Via API:**
```bash
curl -X POST "https://dhd-crm-saletrail.vercel.app/api/whatsapp?action=send" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "18768412776@c.us",
    "message": "Test message to Docker Evolution API"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "provider": "evolution",
  "messageId": "...",
  "message": "Sent successfully"
}
```

**Via UI:**
1. Go to https://dhd-crm-saletrail.vercel.app
2. Login with manager/manager123
3. Click **WhatsApp Inbox**
4. Click **New Message**
5. Enter: `18768412776`
6. Message: `Test message from Docker Evolution API`
7. Click **Send**
8. Check browser console for logs
9. Check Supabase database for saved message

---

### Step 6: Verify Message in Database

Connect to your Supabase and check if messages are being saved:

```sql
SELECT * FROM whatsapp_messages 
WHERE provider = 'evolution' 
ORDER BY created_at DESC 
LIMIT 5;
```

**Expected:**
- Messages appear with `provider='evolution'`
- `direction='outbound'`
- `body` contains your test message
- `provider_message_id` contains the ID from Evolution API

---

## 🔍 Troubleshooting

### Issue: "Evolution API not configured (missing URL or key)"
**Cause:** Environment variables not set in Vercel  
**Solution:**
1. Check Vercel dashboard → Settings → Environment Variables
2. Verify all 5 variables are added
3. Redeploy the project
4. Wait 2-3 minutes for deployment to complete

### Issue: "Cannot connect to Evolution API" or timeout
**Cause:** Docker Evolution API not accessible from Vercel (firewall/network)  
**Solution:**
1. Test locally: `curl http://76.13.31.176:32768/health`
2. Check Docker is running: `docker ps`
3. Check port exposure: `docker port YOUR_CONTAINER`
4. Check firewall allows 32768 inbound
5. Check no reverse proxy is blocking it

### Issue: Message sends successfully but doesn't appear in Supabase
**Cause:** Database insert failure (RLS, permissions, or connection issue)  
**Solution:**
1. Check RLS is disabled: `ALTER TABLE whatsapp_messages DISABLE ROW LEVEL SECURITY;`
2. Check Supabase connection in Vercel logs
3. Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly

### Issue: Message doesn't arrive on WhatsApp
**Cause:** Message format or instance name is wrong  
**Solution:**
1. Verify instance name in Evolution API: `dhd-crm-mpvtxwbu-ujwki9`
2. Verify phone number format: `18768412776@c.us`
3. Check Evolution API logs for errors
4. Verify API key `<YOUR_EVOLUTION_API_KEY>` is correct

---

## 📊 Configuration Summary

| Setting | Value | Purpose |
|---------|-------|---------|
| **API URL** | `http://76.13.31.176:32768` | Where your Evolution API Docker is running |
| **API Key** | `<YOUR_EVOLUTION_API_KEY>` | Authentication for your Docker API |
| **Instance Name** | `dhd-crm-mpvtxwbu-ujwki9` | Evolution API instance identifier |
| **Phone** | `18768412776` | WhatsApp number linked to this instance |
| **Active Provider** | `evolution` | Tells the app to use Evolution API instead of Green API |

---

## ✅ Final Checklist

- [ ] Docker Evolution API is running
- [ ] Can curl Docker API from local machine (test above)
- [ ] All 5 environment variables added to Vercel
- [ ] Project redeployed to Vercel
- [ ] Test API call returns success
- [ ] Send test message via UI
- [ ] Message appears in Supabase database
- [ ] Message arrives on WhatsApp
- [ ] Status endpoint returns valid data

---

## 🆘 Need Help?

If something doesn't work:
1. **Check Vercel logs:**
   - Vercel Dashboard → Deployments → Click latest → Functions tab
   - Look for `[Evolution Send]` or error messages

2. **Check Docker logs:**
   ```bash
   docker logs CONTAINER_ID -f
   ```

3. **Test Evolution API directly:**
   ```bash
   curl -X POST "http://76.13.31.176:32768/message/send" \
     -H "apikey: <YOUR_EVOLUTION_API_KEY>" \
     -H "Content-Type: application/json" \
     -d '{"instance":"dhd-crm-mpvtxwbu-ujwki9","number":"18768412776@c.us","text":"test"}'
   ```

---

## 🎯 Success Indicators

✅ **You'll know it's working when:**
1. API endpoint is reachable from Vercel
2. Messages send without errors
3. Messages appear in Supabase `whatsapp_messages` table
4. Messages arrive on WhatsApp
5. No errors in Vercel function logs
6. No timeouts or connection refused errors

