# Option B Implementation Guide: Android Call Log Sync

**3-Week DIY Implementation Plan for DHD-CRM-Saletrail**

Start Date: Today  
Target Completion: 3 weeks  
Cost: $0 (development time only)  

---

## Week 1: Build & Test Android App

### Day 1: Setup Android Development Environment

**What You Need:**
1. Android Studio (https://developer.android.com/studio)
2. Android SDK (API 34)
3. JDK 17+
4. Git (for version control)

**Installation Steps:**
```bash
# Windows: Download and run installer from https://developer.android.com/studio
# Accept default paths
# Let it download SDKs automatically

# Verify installation
android --version
gradle --version
```

**Expected Output:**
- Android Studio opens
- Welcome screen shows
- SDK Manager available

### Day 2: Create Android Project

**In Android Studio:**

```
File → New → New Android Project
  ├─ Project Name: CallLogSync
  ├─ Package Name: com.dhdcrm.calllogsync
  ├─ Save Location: C:\Users\Administrator\DHD-CRM-CallLogSync
  ├─ Language: Kotlin
  ├─ Minimum API Level: 26 (Android 8.0)
  └─ Empty Activity
```

**Project Structure (will auto-generate):**
```
CallLogSync/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── kotlin/com/dhdcrm/calllogsync/
│   │   │   ├── res/
│   │   │   └── AndroidManifest.xml
│   │   └── test/
│   ├── build.gradle.kts
│   └── proguard-rules.pro
├── gradle/
├── build.gradle.kts
├── settings.gradle.kts
└── README.md
```

### Day 3-4: Add Dependencies

**Edit: app/build.gradle.kts**

```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.dhdcrm.calllogsync"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.dhdcrm.calllogsync"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    buildFeatures {
        viewBinding = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // Core
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")

    // WorkManager (background sync)
    implementation("androidx.work:work-runtime-ktx:2.8.1")

    // RecyclerView
    implementation("androidx.recyclerview:recyclerview:1.3.2")

    // Testing
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
}
```

**Sync Gradle:** Click "Sync Now" in Android Studio

### Day 5: Create Core Classes

**Create File: app/src/main/kotlin/com/dhdcrm/calllogsync/models/CallLog.kt**

```kotlin
package com.dhdcrm.calllogsync.models

data class CallLog(
    val id: String,
    val number: String,
    val type: String,
    val timestamp: Long,
    val duration: Int,
    val contactName: String = ""
) {
    val typeLabel: String
        get() = when (type) {
            "INCOMING" -> "📞 Incoming"
            "OUTGOING" -> "📤 Outgoing"
            "MISSED" -> "❌ Missed"
            else -> "❓ Unknown"
        }

    val durationFormatted: String
        get() {
            val hours = duration / 3600
            val minutes = (duration % 3600) / 60
            val seconds = duration % 60
            return when {
                hours > 0 -> String.format("%02d:%02d:%02d", hours, minutes, seconds)
                minutes > 0 -> String.format("%02d:%02d", minutes, seconds)
                else -> String.format("%ds", seconds)
            }
        }

    val dateFormatted: String
        get() {
            val date = java.util.Date(timestamp)
            val format = java.text.SimpleDateFormat("MMM dd, yyyy HH:mm", java.util.Locale.getDefault())
            return format.format(date)
        }
}
```

### Day 6-7: Create Repository & Utilities

**Create File: app/src/main/kotlin/com/dhdcrm/calllogsync/repository/CallLogRepository.kt**

```kotlin
package com.dhdcrm.calllogsync.repository

import android.content.Context
import android.provider.CallLog
import com.dhdcrm.calllogsync.models.CallLog as CallLogModel

class CallLogRepository(private val context: Context) {

    fun getRecentCalls(limit: Int = 100): List<CallLogModel> {
        return try {
            val calls = mutableListOf<CallLogModel>()
            val cursor = context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(
                    CallLog.Calls._ID,
                    CallLog.Calls.NUMBER,
                    CallLog.Calls.TYPE,
                    CallLog.Calls.DATE,
                    CallLog.Calls.DURATION,
                    CallLog.Calls.CACHED_NAME
                ),
                null,
                null,
                CallLog.Calls.DATE + " DESC LIMIT $limit"
            )

            cursor?.use {
                val idIndex = it.getColumnIndex(CallLog.Calls._ID)
                val numberIndex = it.getColumnIndex(CallLog.Calls.NUMBER)
                val typeIndex = it.getColumnIndex(CallLog.Calls.TYPE)
                val dateIndex = it.getColumnIndex(CallLog.Calls.DATE)
                val durationIndex = it.getColumnIndex(CallLog.Calls.DURATION)
                val nameIndex = it.getColumnIndex(CallLog.Calls.CACHED_NAME)

                while (it.moveToNext()) {
                    val id = it.getLong(idIndex)
                    val number = it.getString(numberIndex) ?: ""
                    val typeCode = it.getInt(typeIndex)
                    val date = it.getLong(dateIndex)
                    val duration = it.getInt(durationIndex)
                    val cachedName = it.getString(nameIndex) ?: ""

                    val type = when (typeCode) {
                        CallLog.Calls.INCOMING_TYPE -> "INCOMING"
                        CallLog.Calls.OUTGOING_TYPE -> "OUTGOING"
                        CallLog.Calls.MISSED_TYPE -> "MISSED"
                        else -> "UNKNOWN"
                    }

                    calls.add(
                        CallLogModel(
                            id = id.toString(),
                            number = number,
                            type = type,
                            timestamp = date,
                            duration = duration,
                            contactName = cachedName
                        )
                    )
                }
            }

            calls
        } catch (e: Exception) {
            android.util.Log.e("CallLogRepo", "Error loading calls: ${e.message}")
            emptyList()
        }
    }

    fun getCallsSince(timestamp: Long): List<CallLogModel> {
        return try {
            val calls = mutableListOf<CallLogModel>()
            val cursor = context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(
                    CallLog.Calls._ID,
                    CallLog.Calls.NUMBER,
                    CallLog.Calls.TYPE,
                    CallLog.Calls.DATE,
                    CallLog.Calls.DURATION,
                    CallLog.Calls.CACHED_NAME
                ),
                "${CallLog.Calls.DATE} > ?",
                arrayOf(timestamp.toString()),
                CallLog.Calls.DATE + " DESC"
            )

            cursor?.use {
                val idIndex = it.getColumnIndex(CallLog.Calls._ID)
                val numberIndex = it.getColumnIndex(CallLog.Calls.NUMBER)
                val typeIndex = it.getColumnIndex(CallLog.Calls.TYPE)
                val dateIndex = it.getColumnIndex(CallLog.Calls.DATE)
                val durationIndex = it.getColumnIndex(CallLog.Calls.DURATION)
                val nameIndex = it.getColumnIndex(CallLog.Calls.CACHED_NAME)

                while (it.moveToNext()) {
                    val id = it.getLong(idIndex)
                    val number = it.getString(numberIndex) ?: ""
                    val typeCode = it.getInt(typeIndex)
                    val date = it.getLong(dateIndex)
                    val duration = it.getInt(durationIndex)
                    val cachedName = it.getString(nameIndex) ?: ""

                    val type = when (typeCode) {
                        CallLog.Calls.INCOMING_TYPE -> "INCOMING"
                        CallLog.Calls.OUTGOING_TYPE -> "OUTGOING"
                        CallLog.Calls.MISSED_TYPE -> "MISSED"
                        else -> "UNKNOWN"
                    }

                    calls.add(
                        CallLogModel(
                            id = id.toString(),
                            number = number,
                            type = type,
                            timestamp = date,
                            duration = duration,
                            contactName = cachedName
                        )
                    )
                }
            }

            calls
        } catch (e: Exception) {
            android.util.Log.e("CallLogRepo", "Error: ${e.message}")
            emptyList()
        }
    }
}
```

---

## Week 2: Create UI & Sync Service

### Day 8-9: Create MainActivity

**Create File: app/src/main/kotlin/com/dhdcrm/calllogsync/MainActivity.kt**

[Copy full code from the comprehensive source files I provided earlier]

**Key Features:**
- RecyclerView for call list
- Sync button
- Settings button
- Status display
- Background sync setup

### Day 10-11: Create SettingsActivity

**Create File: app/src/main/kotlin/com/dhdcrm/calllogsync/SettingsActivity.kt**

[Copy code from provided earlier - includes webhook URL configuration]

### Day 12: Create PreferenceManager

**Create File: app/src/main/kotlin/com/dhdcrm/calllogsync/util/PreferenceManager.kt**

[Copy from provided code - SharedPreferences wrapper]

### Day 13-14: Create Sync Worker

**Create File: app/src/main/kotlin/com/dhdcrm/calllogsync/sync/CallLogSyncWorker.kt**

[Copy from provided code - WorkManager background service]

---

## Week 3: Build, Test & Deploy

### Day 15: Build APK

**In Terminal (Android Studio):**

```bash
cd C:\Users\Administrator\DHD-CRM-CallLogSync

# Build release APK
./gradlew assembleRelease

# Or debug APK for testing
./gradlew assembleDebug
```

**Expected Output:**
```
BUILD SUCCESSFUL in 2m 15s
```

**APK Location:**
```
app/build/outputs/apk/release/app-release.apk
app/build/outputs/apk/debug/app-debug.apk
```

### Day 16: Update AndroidManifest.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.dhdcrm.calllogsync">

    <uses-permission android:name="android.permission.READ_CALL_LOG" />
    <uses-permission android:name="android.permission.READ_CONTACTS" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />

    <application
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/Theme.AppCompat.Light.DarkActionBar">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <activity
            android:name=".SettingsActivity"
            android:exported="false"
            android:parentActivityName=".MainActivity" />

    </application>

</manifest>
```

### Day 17: Install on Android Phone

**Using ADB (Android Debug Bridge):**

```bash
# Connect Android phone to computer
# Enable USB debugging on phone:
#   Settings → Developer Options → USB Debugging

# Install APK
adb install -r app/build/outputs/apk/release/app-release.apk

# Or debug version
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

**Expected Output:**
```
Success
```

### Day 18-19: Configure & Test

**On Android Phone:**
1. Open "DHD-CRM Call Log Sync" app
2. Grant permissions (READ_CALL_LOG, INTERNET)
3. Tap "Settings"
4. Enter webhook URL: `https://yourapp.vercel.app/api/whatsapp?action=addGSMCall`
5. (Optional) Enter device token
6. Set sync interval: 60 minutes
7. Tap "Test Webhook" → Should see ✓ success
8. Tap "Save"

**Manual Test:**
1. Make 2-3 test calls:
   - 1 incoming call
   - 1 outgoing call
   - Let 1 go to voicemail (missed)
2. Return to app home screen
3. Tap "Sync Now"
4. Watch for: "✓ Synced X calls"

### Day 20-21: Verify in Backend

**Check Backend Logs:**
```bash
vercel logs --follow
# Should see: [addGSMCall] Received X calls from device...
```

**Check Database:**
```sql
-- Supabase SQL Editor
SELECT COUNT(*) FROM cellular_calls;
```

**Check Interactions:**
```sql
SELECT * FROM interactions 
WHERE type IN ('INBOUNDCALL', 'MISSEDCALL')
ORDER BY timestamp DESC LIMIT 10;
```

---

## Next: Backend Integration (Week 2 Parallel)

While building the app, also prepare the backend:

### Add to `api/whatsapp.ts`

See BACKEND_INTEGRATION.md for complete code. Key steps:

1. **Create `cellular_calls` table:**
   ```sql
   CREATE TABLE cellular_calls (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     phone_number VARCHAR(50),
     phone_normalized VARCHAR(50),
     direction VARCHAR(20),
     call_type VARCHAR(20),
     duration_seconds INTEGER,
     started_at TIMESTAMPTZ,
     device_model VARCHAR(100),
     source VARCHAR(50) DEFAULT 'android_app',
     created_at TIMESTAMPTZ DEFAULT now()
   );
   ```

2. **Add webhook endpoint:**
   ```typescript
   case 'addGSMCall': {
     const { calls, device, phone } = req.body;
     // Process and insert calls
   }
   ```

3. **Deploy to Vercel:**
   ```bash
   vercel deploy --prod
   ```

---

## Success Criteria

✅ Day 7: Android project created with dependencies  
✅ Day 14: All UI complete, app builds without errors  
✅ Day 15: APK generated successfully  
✅ Day 17: APK installed on Android phone  
✅ Day 19: App runs, displays permissions request  
✅ Day 20: Manual sync shows "✓ Synced X calls"  
✅ Day 21: Database shows entries in `cellular_calls` table  

---

## Troubleshooting

### Build Fails
```bash
# Clean and rebuild
./gradlew clean assembleRelease

# Check gradle version
./gradlew --version

# Update gradle wrapper
./gradlew wrapper --gradle-version=8.0.2
```

### APK Won't Install
```bash
# Check if already installed
adb shell pm list packages | grep calllogsync

# Uninstall first
adb uninstall com.dhdcrm.calllogsync

# Then install
adb install app/build/outputs/apk/release/app-release.apk
```

### App Crashes on Launch
```bash
# Check logs
adb logcat | grep CallLogSync

# Most likely: Missing permissions
# Grant in Settings → Apps → DHD-CRM Call Log Sync → Permissions
```

### Webhook Test Returns Error
```bash
# Test manually with curl
curl -X POST https://yourapp.vercel.app/api/whatsapp?action=addGSMCall \
  -H "Content-Type: application/json" \
  -d '{"calls": [], "device": "test"}'

# Should return: {"success": true}
```

---

## You've Got This! 🚀

**Timeline:**
- Week 1: Build Android app (40-50 hours)
- Week 2: Backend + parallel setup (10-15 hours)
- Week 3: Testing & optimization (10-15 hours)
- **Total: 60-80 hours (~8-10 days of full-time work)**

**Cost:** $0 (your dev time)

**Next Step:** Start with Day 1 - Install Android Studio
