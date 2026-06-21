/**
 * api/recordings.ts
 *
 * Handles recording uploads from companion app and transcription queue management
 *
 * Endpoints:
 * - POST /api/recordings?action=uploadRecording  - Upload call recording file
 * - POST /api/recordings?action=listRecordings   - List pending recordings
 * - POST /api/recordings?action=getTranscript    - Get transcript for a call
 */

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Disable default Next.js body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Check if recording should be skipped based on org settings
 */
async function shouldSkipRecording(
  phoneNumber: string,
  org_id: string
): Promise<boolean> {
  try {
    // Get org recording settings
    const { data: settings } = await supabase
      .from('recording_settings')
      .select('*')
      .eq('org_id', org_id)
      .eq('scope', 'ORG')
      .is('scope_id', null)
      .single();

    if (!settings) {
      return false; // Record by default if no settings
    }

    // Check if recording is disabled globally
    if (!settings.recording_enabled) {
      return true;
    }

    // Check if number is excluded
    if (settings.excluded_numbers && settings.excluded_numbers.includes(phoneNumber)) {
      console.log('[recordings] Skipping excluded number:', phoneNumber);
      return true;
    }

    // Check if current time is within schedule
    if (settings.schedule_enabled) {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const dayOfWeek = now.getDay();

      // Check if day is scheduled (0=Sunday, need to convert)
      const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sun=0 to index 6
      const isDayScheduled = settings.schedule_days[dayIndex];

      if (!isDayScheduled) {
        console.log('[recordings] Current day not scheduled for recording');
        return true;
      }

      // Check if time is within range
      if (currentTime < settings.schedule_start_time || currentTime > settings.schedule_end_time) {
        console.log('[recordings] Current time outside recording schedule');
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error('[recordings] Error checking settings:', err);
    return false; // Record by default on error
  }
}

/**
 * Parse multipart form data (recordings file + metadata)
 */
async function parseFormData(
  req: VercelRequest
): Promise<{ fields: any; files: any }> {
  return new Promise((resolve, reject) => {
    const form = formidable({
      uploadDir: '/tmp',
      keepExtensions: true,
      maxFileSize: 500 * 1024 * 1024, // 500MB max
    });

    form.parse(req, (err: any, fields: any, files: any) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

/**
 * Upload recording file to Supabase Storage
 */
async function uploadToStorage(
  filePath: string,
  storagePath: string,
  _org_id: string
): Promise<{ path: string; size: number }> {
  try {
    const fileContent = fs.readFileSync(filePath);
    const _fileName = path.basename(storagePath);

    const { data, error } = await supabase.storage
      .from('call-recordings')
      .upload(storagePath, fileContent, {
        contentType: 'audio/mp4',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    console.log('[recordings] File uploaded to storage:', storagePath);

    return {
      path: data.path,
      size: fileContent.length,
    };
  } catch (err) {
    console.error('[recordings] Storage upload error:', err);
    throw err;
  }
}

/**
 * Handle recording upload
 */
async function handleUploadRecording(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    const { fields, files } = await parseFormData(req);

    // Fields sent by useCallRecorder.ts in the companion app
    const phone_number = fields.phone_number?.[0] || '';
    const timestamp_ms = parseInt(fields.timestamp_ms?.[0] || '0', 10);
    const device_phone = fields.device_phone?.[0] || '';
    const filename     = fields.filename?.[0] || '';
    const duration_ms  = parseInt(fields.duration_ms?.[0] || '0', 10);
    const file         = files.file?.[0];

    console.log('[recordings] Upload request:', { phone_number, timestamp_ms, filename, size: file?.size });

    if (!file || !filename) {
      return res.status(400).json({ success: false, error: 'Missing file or filename' });
    }

    // ── Resolve org_id ─────────────────────────────────────────────────────
    // Use the single org in app_settings, or 'default' if none configured.
    // In a multi-tenant setup this would come from an API key header.
    const { data: orgRow } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'ORG_ID')
      .maybeSingle();
    const org_id = orgRow?.setting_value || 'default';

    // ── Resolve call_id ────────────────────────────────────────────────────
    // Try to find a matching cellular_call (phone + timestamp within ±2 min).
    // Falls back to a deterministic UUID derived from phone + timestamp.
    let call_id: string;
    if (phone_number && timestamp_ms) {
      const windowMs = 2 * 60 * 1000;
      const low  = new Date(timestamp_ms - windowMs).toISOString();
      const high = new Date(timestamp_ms + windowMs).toISOString();
      const normPhone = phone_number.replace(/\D/g, '');

      const { data: matched } = await supabase
        .from('cellular_calls')
        .select('id')
        .ilike('phone_number', `%${normPhone}%`)
        .gte('called_at', low)
        .lte('called_at', high)
        .order('called_at', { ascending: false })
        .limit(1);

      call_id = matched?.[0]?.id || crypto.randomUUID();
    } else {
      call_id = crypto.randomUUID();
    }

    // ── Policy check ───────────────────────────────────────────────────────
    if (await shouldSkipRecording(phone_number, org_id)) {
      return res.json({ success: true, skipped: true, message: 'Recording skipped by policy' });
    }

    // ── Multi-device dedup ─────────────────────────────────────────────────
    const { data: existing } = await supabase
      .from('audio_recordings')
      .select('recording_id')
      .eq('call_id', call_id)
      .eq('org_id', org_id)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.json({
        success: true,
        recording_id: existing[0].recording_id,
        message: 'Recording already exists (deduplicated)',
      });
    }

    // ── Upload to Supabase Storage ─────────────────────────────────────────
    const storagePath = `recordings/${org_id}/${device_phone || 'unknown'}/${filename}`;
    const uploadResult = await uploadToStorage(file.filepath, storagePath, org_id);

    // ── Save metadata ──────────────────────────────────────────────────────
    const { data: recording, error: dbError } = await supabase
      .from('audio_recordings')
      .insert({
        call_id,
        org_id,
        file_path:            uploadResult.path,
        file_size_bytes:      uploadResult.size,
        duration_seconds:     Math.floor(duration_ms / 1000),
        transcription_status: 'PENDING',
      })
      .select()
      .single();

    if (dbError) {
      console.error('[recordings] DB insert error:', dbError);
      return res.status(500).json({ success: false, error: dbError.message });
    }

    // ── Queue transcription job ────────────────────────────────────────────
    await supabase.from('transcription_jobs').insert({
      recording_id: recording.recording_id,
      status:       'QUEUED',
      attempts:     0,
      max_attempts: 3,
    });

    try { fs.unlinkSync(file.filepath); } catch (_) {}

    console.log('[recordings] Upload complete:', recording.recording_id);
    return res.json({
      success: true,
      recording_id:         recording.recording_id,
      call_id,
      transcription_status: 'PENDING',
      message:              'Recording uploaded and queued for transcription',
    });

  } catch (err: any) {
    console.error('[recordings] Upload error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Upload failed' });
  }
}

/**
 * List pending recordings for a user
 */
async function handleListRecordings(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    const user_id = req.body.user_id || '';
    const org_id = req.body.org_id || '';

    if (!user_id || !org_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing user_id or org_id',
      });
    }

    const { data, error } = await supabase
      .from('audio_recordings')
      .select('*')
      .eq('user_id', user_id)
      .eq('org_id', org_id)
      .order('uploaded_at', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({
      success: true,
      recordings: data,
      count: data?.length || 0,
    });
  } catch (err: any) {
    console.error('[recordings] List error:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}

/**
 * Get transcript for a call
 */
async function handleGetTranscript(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    const call_id = req.body.call_id || '';

    if (!call_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing call_id',
      });
    }

    const { data: transcript, error } = await supabase
      .from('call_transcripts')
      .select('*')
      .eq('call_id', call_id)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!transcript) {
      return res.json({
        success: true,
        transcript: null,
        message: 'No transcript available yet',
      });
    }

    return res.json({
      success: true,
      transcript,
    });
  } catch (err: any) {
    console.error('[recordings] Transcript error:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}

/**
 * Main handler
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = req.query.action as string;

  try {
    switch (action) {
      case 'uploadRecording':
        return await handleUploadRecording(req, res);

      case 'listRecordings':
        return await handleListRecordings(req, res);

      case 'getTranscript':
        return await handleGetTranscript(req, res);

      // Transcription actions (merged from transcribe.ts)
      case 'processTranscriptions':
      case 'transcribe':
        return await handleProcessTranscriptions(req, res);

      default:
        return res.status(400).json({
          success: false,
          error: `Unknown action: ${action}`,
        });
    }
  } catch (err: any) {
    console.error('[recordings] Unexpected error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
}

// ---------------------------------------------------------------------------
// Transcription helpers (merged from transcribe.ts)
// ---------------------------------------------------------------------------
import FormData from 'form-data';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

async function downloadAudio(filePath: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from('call-recordings').download(filePath);
  if (error) throw new Error(`Download failed: ${error.message}`);
  return Buffer.from(await (data as Blob).arrayBuffer());
}

async function transcribeWithWhisper(audioBuffer: Buffer, filename: string): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
  const form = new FormData();
  form.append('file', audioBuffer, filename);
  form.append('model', 'whisper-1');
  form.append('language', 'en');
  form.append('response_format', 'json');
  const response = await fetch(WHISPER_API_URL, { method: 'POST', headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, ...form.getHeaders() }, body: form as any });
  if (!response.ok) { const err = await response.text(); throw new Error(`Whisper API failed: ${response.status} ${err.substring(0, 100)}`); }
  const result = await response.json() as any;
  if (!result.text) throw new Error('No transcript returned from Whisper');
  return result.text;
}

async function processTranscriptionJob(jobId: string, recordingId: string): Promise<boolean> {
  try {
    await supabase.from('transcription_jobs').update({ status: 'IN_PROGRESS' }).eq('job_id', jobId);
    const { data: recording, error: re } = await supabase.from('audio_recordings').select('*').eq('recording_id', recordingId).single();
    if (re || !recording) throw new Error(`Recording not found: ${re?.message}`);
    const audioBuffer = await downloadAudio(recording.file_path);
    if (audioBuffer.length === 0) throw new Error('Downloaded audio is empty');
    const transcriptText = await transcribeWithWhisper(audioBuffer, recording.filename || 'recording.m4a');
    if (!transcriptText.trim()) throw new Error('Transcription returned empty text');
    await supabase.from('call_transcripts').insert({ call_id: recording.call_id, org_id: recording.org_id, text: transcriptText, provider: 'openai', model_used: 'whisper-1', duration_seconds: recording.duration_seconds, generated_at: new Date().toISOString() });
    await supabase.from('audio_recordings').update({ transcription_status: 'COMPLETE', transcription_error: null }).eq('recording_id', recordingId);
    await supabase.from('transcription_jobs').update({ status: 'COMPLETE', completed_at: new Date().toISOString() }).eq('job_id', jobId);
    return true;
  } catch (err: any) {
    const { data: job } = await supabase.from('transcription_jobs').select('attempts, max_attempts').eq('job_id', jobId).single();
    const attempts = (job?.attempts || 0) + 1;
    const maxAttempts = job?.max_attempts || 3;
    if (attempts >= maxAttempts) {
      await supabase.from('transcription_jobs').update({ status: 'FAILED', error_message: err.message, attempts, completed_at: new Date().toISOString() }).eq('job_id', jobId);
      await supabase.from('audio_recordings').update({ transcription_status: 'FAILED', transcription_error: err.message }).eq('recording_id', recordingId);
    } else {
      await supabase.from('transcription_jobs').update({ status: 'QUEUED', error_message: err.message, attempts }).eq('job_id', jobId);
    }
    return false;
  }
}

async function handleProcessTranscriptions(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST' && req.body?.recording_id) {
    const { recording_id, job_id } = req.body;
    const success = await processTranscriptionJob(job_id || recording_id, recording_id);
    return res.json({ success, message: success ? 'Transcription complete' : 'Transcription failed' });
  }
  const { data: jobs, error } = await supabase.from('transcription_jobs').select('job_id, recording_id').eq('status', 'QUEUED').order('created_at', { ascending: true }).limit(10);
  if (error) return res.status(500).json({ success: false, error: error.message });
  if (!jobs || jobs.length === 0) return res.json({ success: true, processed: 0, message: 'No pending transcription jobs' });
  let processed = 0, failed = 0;
  for (const job of jobs) { if (await processTranscriptionJob(job.job_id, job.recording_id)) processed++; else failed++; }
  return res.json({ success: true, processed, failed, message: `Processed ${processed} jobs${failed > 0 ? `, ${failed} failed` : ''}` });
}
