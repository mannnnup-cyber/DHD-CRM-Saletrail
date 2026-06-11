import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const _url = process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL || '';
const _key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = _url && _key ? createClient(_url, _key) : null;

function normalizePhone(raw: string): string {
  if (!raw) return '';
  return raw.replace(/[^\d]/g, '');
}

async function resolveContact(opts: {
  name: string;
  email?: string;
  phone?: string;
  source: string;
  company?: string;
  notes?: string;
}): Promise<{ id: string; created: boolean } | null> {
  if (!supabase) return null;
  const emailLower = (opts.email || '').toLowerCase().trim();
  const phoneNorm = normalizePhone(opts.phone || '');

  if (emailLower) {
    const { data } = await supabase.from('contacts').select('id').ilike('email', emailLower).limit(1).single();
    if (data) return { id: data.id, created: false };
  }
  if (phoneNorm) {
    const { data } = await supabase.from('contacts').select('id').eq('phone_normalized', phoneNorm).limit(1).single();
    if (data) return { id: data.id, created: false };
  }

  const { data, error } = await supabase.from('contacts').insert({
    name: opts.name || 'Unknown',
    email: emailLower || null,
    phone: opts.phone || null,
    phone_normalized: phoneNorm || null,
    company: opts.company || null,
    source: opts.source,
    notes: opts.notes || null,
    status: 'NEW',
  }).select('id').single();

  if (error) { console.error('[contacts] insert error:', error.message); return null; }
  return { id: data.id, created: true };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  const { action, id } = req.query as Record<string, string>;

  if (!action && !id) {
    const { data, error } = await supabase.from('contacts').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ contacts: data });
  }

  if (!action && id) {
    const [{ data: contact, error: ce }, { data: interactions }] = await Promise.all([
      supabase.from('contacts').select('*').eq('id', id).single(),
      supabase.from('interactions').select('*').eq('contact_id', id).order('timestamp', { ascending: false }).limit(100),
    ]);
    if (ce) return res.status(404).json({ error: 'Contact not found' });
    return res.status(200).json({ contact, interactions: interactions || [] });
  }

  if (action === 'resolve' && req.method === 'POST') {
    const body = req.body || {};
    if (!body.email && !body.phone) return res.status(400).json({ error: 'email or phone required' });
    const result = await resolveContact({ name: body.name || 'Unknown', email: body.email, phone: body.phone, source: body.source || 'MANUAL', company: body.company });
    if (!result) return res.status(500).json({ error: 'Resolution failed' });
    return res.status(200).json(result);
  }

  if (action === 'update' && id && req.method === 'POST') {
    const body = req.body || {};
    const allowed = ['contact_preference', 'notes', 'status', 'website_url'];
    const updatePayload: Record<string, any> = {};
    for (const key of allowed) {
      if (key in body) updatePayload[key] = body[key];
    }
    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    const { data, error } = await supabase.from('contacts').update(updatePayload).eq('id', id).select('*').single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ contact: data });
  }

  if (action === 'migrate') {
    const { data: leads, error: le } = await supabase.from('leads').select('id, name, email, phone, company, notes').is('contact_id', null);
    if (le) return res.status(500).json({ error: le.message });
    if (!leads || leads.length === 0) return res.status(200).json({ migrated: 0, message: 'Nothing to migrate' });

    let migrated = 0;
    const errors: string[] = [];
    for (const lead of leads) {
      const result = await resolveContact({ name: lead.name, email: lead.email, phone: lead.phone, company: lead.company, source: 'MANUAL', notes: lead.notes });
      if (result) {
        await supabase.from('leads').update({ contact_id: result.id }).eq('id', lead.id);
        migrated++;
      } else {
        errors.push(lead.id);
      }
    }
    return res.status(200).json({ migrated, errors });
  }

  if (action === 'findDuplicates' && req.method === 'POST') return findDuplicates(req, res);
  if (action === 'checkBeforeEnrich' && req.method === 'GET') return checkBeforeEnrich(req, res);
  if (action === 'mergeContacts' && req.method === 'POST') return mergeContacts(req, res);
  if (action === 'getDetectionStatus' && req.method === 'GET') return getDetectionStatus(req, res);

  return res.status(400).json({ error: 'Unknown action' });
}

// ---------------------------------------------------------------------------
// Duplicate detection helpers (merged from duplicates.ts)
// ---------------------------------------------------------------------------

function normalizeEmail(raw: string): string {
  if (!raw) return '';
  return raw.toLowerCase().trim();
}

function normalizeName(raw: string): string {
  if (!raw) return '';
  return raw.toLowerCase().trim();
}

function levenshteinDistance(str1: string, str2: string): number {
  const track = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }

  return track[str2.length][str1.length];
}

function calculateStringSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
}

function calculateDuplicateConfidence(
  contact1: any,
  contact2: any
): { confidence: number; reasons: string[]; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};
  const reasons: string[] = [];
  let totalScore = 0;
  let factorCount = 0;

  if (contact1.email && contact2.email) {
    const emailMatch = normalizeEmail(contact1.email) === normalizeEmail(contact2.email);
    if (emailMatch) {
      breakdown.email = 0.95;
      totalScore += 0.95;
      reasons.push('exact_email_match');
      factorCount++;
    } else {
      breakdown.email = 0;
    }
  }

  if (contact1.phone && contact2.phone) {
    const phone1 = normalizePhone(contact1.phone);
    const phone2 = normalizePhone(contact2.phone);
    if (phone1 && phone2) {
      if (phone1 === phone2) {
        breakdown.phone = 0.90;
        totalScore += 0.90;
        reasons.push('exact_phone_match');
        factorCount++;
      } else {
        breakdown.phone = 0;
      }
    }
  }

  if (contact1.name && contact2.name) {
    const nameSim = calculateStringSimilarity(
      normalizeName(contact1.name),
      normalizeName(contact2.name)
    );
    if (nameSim >= 0.9) {
      breakdown.name = nameSim * 0.70;
      totalScore += breakdown.name;
      reasons.push(`name_similarity_${Math.round(nameSim * 100)}`);
      factorCount++;
    } else {
      breakdown.name = 0;
    }
  }

  if (contact1.company && contact2.company) {
    const companySim = calculateStringSimilarity(
      normalizeName(contact1.company),
      normalizeName(contact2.company)
    );
    if (companySim >= 0.95) {
      breakdown.company = companySim * 0.30;
      totalScore += breakdown.company;
      reasons.push('company_match');
      factorCount++;
    } else {
      breakdown.company = 0;
    }
  }

  const confidence = factorCount > 0 ? Math.min(totalScore / factorCount, 1.0) : 0;
  return { confidence, reasons, breakdown };
}

async function findDuplicates(req: VercelRequest, res: VercelResponse) {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  try {
    const { contactId, email, phone, name } = req.body;
    let targetContact: any;
    if (contactId) {
      const { data, error } = await supabase.from('contacts').select('*').eq('id', contactId).single();
      if (error || !data) return res.status(404).json({ success: false, error: 'Contact not found' });
      targetContact = data;
    } else {
      targetContact = { email, phone, name };
    }

    const { data: allContacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, name, email, phone, company, created_at');

    if (contactsError) return res.status(500).json({ success: false, error: `Failed to fetch contacts: ${contactsError.message}` });

    const potentialDuplicates: any[] = [];
    for (const contact of allContacts || []) {
      if (contactId && contact.id === contactId) continue;
      const { confidence, reasons, breakdown } = calculateDuplicateConfidence(targetContact, contact);
      if (confidence >= 0.6) {
        potentialDuplicates.push({ id: contact.id, name: contact.name, email: contact.email, phone: contact.phone, company: contact.company, createdAt: contact.created_at, confidence, reasons, breakdown });
      }
    }
    potentialDuplicates.sort((a, b) => b.confidence - a.confidence);

    return res.status(200).json({ success: true, targetContact: contactId ? targetContact : undefined, duplicates: potentialDuplicates, count: potentialDuplicates.length });
  } catch (err: any) {
    console.error('[contacts] findDuplicates error:', err);
    return res.status(500).json({ success: false, error: `Server error: ${err.message || 'Unknown error'}` });
  }
}

async function checkBeforeEnrich(req: VercelRequest, res: VercelResponse) {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  try {
    const { email, phone } = req.query as Record<string, string>;
    if (!email && !phone) return res.status(400).json({ success: false, error: 'email or phone required' });

    const conflicts: any[] = [];

    if (email) {
      const { data: emailMatches } = await supabase
        .from('contacts')
        .select('id, name, email, phone, company, enrichment_confidence, enrichment_timestamp')
        .eq('email', normalizeEmail(email));
      if (emailMatches) {
        for (const match of emailMatches) {
          if (match.enrichment_confidence && match.enrichment_confidence > 0.7) {
            conflicts.push({ id: match.id, name: match.name, email: match.email, reason: 'exact_email_match', enrichmentConfidence: match.enrichment_confidence, enrichmentTimestamp: match.enrichment_timestamp });
          }
        }
      }
    }

    if (phone) {
      const normalizedPhone = normalizePhone(phone);
      const { data: phoneMatches } = await supabase
        .from('contacts')
        .select('id, name, email, phone, company, enrichment_confidence, enrichment_timestamp');
      if (phoneMatches) {
        for (const match of phoneMatches) {
          if (normalizePhone(match.phone) === normalizedPhone && match.enrichment_confidence && match.enrichment_confidence > 0.7) {
            conflicts.push({ id: match.id, name: match.name, email: match.email, reason: 'exact_phone_match', enrichmentConfidence: match.enrichment_confidence, enrichmentTimestamp: match.enrichment_timestamp });
          }
        }
      }
    }

    return res.status(200).json({ success: true, hasConflicts: conflicts.length > 0, conflicts, recommendation: conflicts.length > 0 ? 'Consider merging with existing contact before enriching' : 'Safe to enrich' });
  } catch (err: any) {
    console.error('[contacts] checkBeforeEnrich error:', err);
    return res.status(500).json({ success: false, error: `Server error: ${err.message || 'Unknown error'}` });
  }
}

async function mergeContacts(req: VercelRequest, res: VercelResponse) {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  try {
    const { primaryContactId, duplicateContactId, strategy = 'merge_enriched' } = req.body;
    if (!primaryContactId || !duplicateContactId) return res.status(400).json({ success: false, error: 'primaryContactId and duplicateContactId required' });

    const { data: primary, error: primaryError } = await supabase.from('contacts').select('*').eq('id', primaryContactId).single();
    const { data: duplicate, error: duplicateError } = await supabase.from('contacts').select('*').eq('id', duplicateContactId).single();

    if (primaryError || !primary || duplicateError || !duplicate) return res.status(404).json({ success: false, error: 'One or both contacts not found' });

    const mergedData: any = { ...primary };
    if (strategy === 'merge_enriched') {
      if (duplicate.enrichment_confidence && duplicate.enrichment_confidence > (primary.enrichment_confidence || 0)) {
        mergedData.enrichment_source = duplicate.enrichment_source;
        mergedData.enrichment_confidence = duplicate.enrichment_confidence;
        mergedData.enrichment_timestamp = duplicate.enrichment_timestamp;
        mergedData.enrichment_notes = duplicate.enrichment_notes;
      }
      if (!mergedData.email && duplicate.email) mergedData.email = duplicate.email;
      if (!mergedData.phone && duplicate.phone) mergedData.phone = duplicate.phone;
      if (!mergedData.company && duplicate.company) mergedData.company = duplicate.company;
      if (!mergedData.notes && duplicate.notes) mergedData.notes = duplicate.notes;
    }

    const { error: updateError } = await supabase.from('contacts').update(mergedData).eq('id', primaryContactId);
    if (updateError) return res.status(500).json({ success: false, error: `Failed to update primary contact: ${updateError.message}` });

    const { error: detectionError } = await supabase.from('duplicate_detections').insert({
      contact_a_id: primaryContactId < duplicateContactId ? primaryContactId : duplicateContactId,
      contact_b_id: primaryContactId < duplicateContactId ? duplicateContactId : primaryContactId,
      confidence: 0.95,
      reason: 'manual_merge',
      merged: true,
      merged_into_id: primaryContactId,
      merged_at: new Date().toISOString()
    });
    if (detectionError && !detectionError.message.includes('duplicate key')) {
      console.warn('[contacts] Warning adding to duplicate_detections:', detectionError);
    }

    try {
      await supabase.from('interactions').insert({ contact_id: primaryContactId, type: 'NOTE', subject: 'Duplicate contact merged', content: `Merged duplicate contact ${duplicate.name} (ID: ${duplicateContactId}) into this contact. Strategy: ${strategy}`, metadata: { mergedContactId: duplicateContactId, mergedContactName: duplicate.name, strategy }, timestamp: new Date().toISOString() });
    } catch (interactionErr) {
      console.warn('[contacts] Warning creating interaction record:', interactionErr);
    }

    return res.status(200).json({ success: true, message: 'Contacts merged successfully', primaryContactId, mergedData });
  } catch (err: any) {
    console.error('[contacts] mergeContacts error:', err);
    return res.status(500).json({ success: false, error: `Server error: ${err.message || 'Unknown error'}` });
  }
}

async function getDetectionStatus(req: VercelRequest, res: VercelResponse) {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  try {
    const { data: detections, error } = await supabase.from('duplicate_detections').select('*').eq('merged', false).order('confidence', { ascending: false });
    if (error) return res.status(500).json({ success: false, error: `Failed to fetch detections: ${error.message}` });
    return res.status(200).json({ success: true, unmergedDuplicates: detections || [], count: (detections || []).length, highConfidence: (detections || []).filter((d: any) => d.confidence >= 0.9).length, mediumConfidence: (detections || []).filter((d: any) => d.confidence >= 0.7 && d.confidence < 0.9).length });
  } catch (err: any) {
    console.error('[contacts] getDetectionStatus error:', err);
    return res.status(500).json({ success: false, error: `Server error: ${err.message || 'Unknown error'}` });
  }
}
