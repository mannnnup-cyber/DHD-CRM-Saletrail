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
import { NextApiRequest, NextApiResponse } from 'next';
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
  req: NextApiRequest
): Promise<{ fields: any; files: any }> {
  return new Promise((resolve, reject) => {
    const form = formidable({
      uploadDir: '/tmp',
      keepExtensions: true,
      maxFileSize: 500 * 1024 * 1024, // 500MB max
    });

    form.parse(req, (err, fields, files) => {
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
  org_id: string
): Promise<{ path: string; size: number }> {
  try {
    const fileContent = fs.readFileSync(filePath);
    const fileName = path.basename(storagePath);

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
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Parse multipart form data
    const { fields, files } = await parseFormData(req);

    const org_id = fields.org_id?.[0] || '';
    const user_id = fields.user_id?.[0] || '';
    const device_id = fields.device_id?.[0] || '';
    const call_id = fields.call_id?.[0] || '';
    const phone_number = fields.phone_number?.[0] || '';
    const filename = fields.filename?.[0] || '';
    const duration_ms = parseInt(fields.duration_ms?.[0] || '0', 10);
    const file = files.file?.[0];

    console.log('[recordings] Upload request:', {
      call_id,
      org_id,
      filename,
      size: file?.size,
    });

    if (!file || !call_id || !org_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: file, call_id, org_id',
      });
    }

    // Check if we should record this call
    if (await shouldSkipRecording(phone_number, org_id)) {
      console.log('[recordings] Recording skipped based on settings');
      return res.json({
        success: true,
        skipped: true,
        message: 'Recording skipped by policy',
      });
    }

    // Check if recording already exists (multi-device dedup)
    const { data: existing } = await supabase
      .from('audio_recordings')
      .select('recording_id')
      .eq('call_id', call_id)
      .eq('org_id', org_id)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log('[recordings] Recording already exists for this call');
      return res.json({
        success: true,
        recording_id: existing[0].recording_id,
        message: 'Recording already exists from another device',
      });
    }

    // Upload file to Supabase Storage
    const storagePath = `org-${org_id}/recordings/${user_id}/${filename}`;
    const uploadResult = await uploadToStorage(
      file.filepath,
      storagePath,
      org_id
    );

    // Create recording metadata in database
    const { data: recording, error: dbError } = await supabase
      .from('audio_recordings')
      .insert({
        call_id,
        device_id: device_id || null,
        user_id,
        org_id,
        file_path: uploadResult.path,
        file_size_bytes: uploadResult.size,
        duration_seconds: Math.floor(duration_ms / 1000),
        transcription_status: 'PENDING',
      })
      .select()
      .single();

    if (dbError) {
      console.error('[recordings] Database error:', dbError);
      return res.status(500).json({
        success: false,
        error: `Recording save failed: ${dbError.message}`,
      });
    }

    // Queue transcription job
    const { error: jobError } = await supabase
      .from('transcription_jobs')
      .insert({
        recording_id: recording.recording_id,
        status: 'QUEUED',
        attempts: 0,
        max_attempts: 3,
      });

    if (jobError) {
      console.error('[recordings] Job queue error:', jobError);
      // Don't fail the upload if job queueing fails - retry later
    }

    // Clean up temp file
    try {
      fs.unlinkSync(file.filepath);
    } catch (_) {}

    console.log('[recordings] Upload complete:', recording.recording_id);

    return res.json({
      success: true,
      recording_id: recording.recording_id,
      transcription_status: 'PENDING',
      message: 'Recording uploaded and queued for transcription',
    });
  } catch (err: any) {
    console.error('[recordings] Upload error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Upload failed',
    });
  }
}

/**
 * List pending recordings for a user
 */
async function handleListRecordings(
  req: NextApiRequest,
  res: NextApiResponse
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
  req: NextApiRequest,
  res: NextApiResponse
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
  req: NextApiRequest,
  res: NextApiResponse
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
