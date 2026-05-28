import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const _url = process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL || '';
const _key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = _url && _key ? createClient(_url, _key) : null;

function normalizePhone(raw: string): string {
  if (!raw) return '';
  return raw.replace(/[^\d]/g, '');
}

function normalizeEmail(raw: string): string {
  if (!raw) return '';
  return raw.toLowerCase().trim();
}

function normalizeName(raw: string): string {
  if (!raw) return '';
  return raw.toLowerCase().trim();
}

/**
 * Simple Levenshtein distance algorithm for string similarity
 * Returns number of single-character edits needed to transform one string into another
 */
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

/**
 * Calculate string similarity score (0-1)
 * Uses Levenshtein distance normalized by string length
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1; // Both empty strings are identical

  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
}

/**
 * Calculate duplicate confidence score based on multiple factors
 * Returns object with total confidence and breakdown by field
 */
function calculateDuplicateConfidence(
  contact1: any,
  contact2: any
): {
  confidence: number;
  reasons: string[];
  breakdown: Record<string, number>;
} {
  const breakdown: Record<string, number> = {};
  const reasons: string[] = [];

  let totalScore = 0;
  let factorCount = 0;

  // Email match (highest confidence)
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

  // Phone match (very high confidence)
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

  // Name similarity (medium-high confidence if also has email or phone)
  if (contact1.name && contact2.name) {
    const nameSim = calculateStringSimilarity(
      normalizeName(contact1.name),
      normalizeName(contact2.name)
    );

    // Only consider name match if it's very high similarity (90%+)
    if (nameSim >= 0.9) {
      breakdown.name = nameSim * 0.70; // Cap at 70% since name alone is less reliable
      totalScore += breakdown.name;
      reasons.push(`name_similarity_${Math.round(nameSim * 100)}`);
      factorCount++;
    } else {
      breakdown.name = 0;
    }
  }

  // Company match (helpful for deduplication)
  if (contact1.company && contact2.company) {
    const companySim = calculateStringSimilarity(
      normalizeName(contact1.company),
      normalizeName(contact2.company)
    );

    if (companySim >= 0.95) {
      breakdown.company = companySim * 0.30; // Lower weight since people can work at same place
      totalScore += breakdown.company;
      reasons.push('company_match');
      factorCount++;
    } else {
      breakdown.company = 0;
    }
  }

  // Calculate weighted average
  const confidence = factorCount > 0 ? Math.min(totalScore / factorCount, 1.0) : 0;

  return {
    confidence,
    reasons,
    breakdown
  };
}

/**
 * Find potential duplicates for a contact
 * POST /api/duplicates?action=findDuplicates
 * Input: { contactId } or { email?, phone?, name? }
 */
async function findDuplicates(
  req: VercelRequest,
  res: VercelResponse
) {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  try {
    const { contactId, email, phone, name } = req.body;

    // Get target contact
    let targetContact: any;
    if (contactId) {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();

      if (error || !data) {
        return res.status(404).json({
          success: false,
          error: 'Contact not found'
        });
      }

      targetContact = data;
    } else {
      // Create temporary contact object from provided fields
      targetContact = { email, phone, name };
    }

    // Get all existing contacts (excluding the target if searching by ID)
    const { data: allContacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, name, email, phone, company, created_at');

    if (contactsError) {
      return res.status(500).json({
        success: false,
        error: `Failed to fetch contacts: ${contactsError.message}`
      });
    }

    // Find potential duplicates
    const potentialDuplicates: any[] = [];

    for (const contact of allContacts || []) {
      // Skip same contact
      if (contactId && contact.id === contactId) continue;

      const { confidence, reasons, breakdown } = calculateDuplicateConfidence(
        targetContact,
        contact
      );

      // Only include if confidence is above threshold (60%)
      if (confidence >= 0.6) {
        potentialDuplicates.push({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
          createdAt: contact.created_at,
          confidence,
          reasons,
          breakdown
        });
      }
    }

    // Sort by confidence descending
    potentialDuplicates.sort((a, b) => b.confidence - a.confidence);

    return res.status(200).json({
      success: true,
      targetContact: contactId ? targetContact : undefined,
      duplicates: potentialDuplicates,
      count: potentialDuplicates.length
    });
  } catch (err: any) {
    console.error('[duplicates] Find error:', err);
    return res.status(500).json({
      success: false,
      error: `Server error: ${err.message || 'Unknown error'}`
    });
  }
}

/**
 * Prevent enrichment if duplicate with enriched data exists
 * GET /api/duplicates?action=checkBeforeEnrich&email=...
 */
async function checkBeforeEnrich(
  req: VercelRequest,
  res: VercelResponse
) {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  try {
    const { email, phone } = req.query as Record<string, string>;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        error: 'email or phone required'
      });
    }

    const conflicts: any[] = [];

    // Check for exact email match
    if (email) {
      const { data: emailMatches } = await supabase
        .from('contacts')
        .select('id, name, email, phone, company, enrichment_confidence, enrichment_timestamp')
        .eq('email', normalizeEmail(email));

      if (emailMatches && emailMatches.length > 0) {
        for (const match of emailMatches) {
          if (match.enrichment_confidence && match.enrichment_confidence > 0.7) {
            conflicts.push({
              id: match.id,
              name: match.name,
              email: match.email,
              reason: 'exact_email_match',
              enrichmentConfidence: match.enrichment_confidence,
              enrichmentTimestamp: match.enrichment_timestamp
            });
          }
        }
      }
    }

    // Check for exact phone match
    if (phone) {
      const normalizedPhone = normalizePhone(phone);
      const { data: phoneMatches } = await supabase
        .from('contacts')
        .select('id, name, email, phone, company, enrichment_confidence, enrichment_timestamp');

      if (phoneMatches) {
        for (const match of phoneMatches) {
          if (normalizePhone(match.phone) === normalizedPhone) {
            if (match.enrichment_confidence && match.enrichment_confidence > 0.7) {
              conflicts.push({
                id: match.id,
                name: match.name,
                email: match.email,
                reason: 'exact_phone_match',
                enrichmentConfidence: match.enrichment_confidence,
                enrichmentTimestamp: match.enrichment_timestamp
              });
            }
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      hasConflicts: conflicts.length > 0,
      conflicts,
      recommendation: conflicts.length > 0
        ? 'Consider merging with existing contact before enriching'
        : 'Safe to enrich'
    });
  } catch (err: any) {
    console.error('[duplicates] Check before enrich error:', err);
    return res.status(500).json({
      success: false,
      error: `Server error: ${err.message || 'Unknown error'}`
    });
  }
}

/**
 * Merge two contacts
 * POST /api/duplicates?action=mergeContacts
 * Input: { primaryContactId, duplicateContactId, strategy: 'keep_primary' | 'merge_enriched' }
 */
async function mergeContacts(
  req: VercelRequest,
  res: VercelResponse
) {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  try {
    const { primaryContactId, duplicateContactId, strategy = 'merge_enriched' } = req.body;

    if (!primaryContactId || !duplicateContactId) {
      return res.status(400).json({
        success: false,
        error: 'primaryContactId and duplicateContactId required'
      });
    }

    // Fetch both contacts
    const { data: primary, error: primaryError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', primaryContactId)
      .single();

    const { data: duplicate, error: duplicateError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', duplicateContactId)
      .single();

    if (primaryError || !primary || duplicateError || !duplicate) {
      return res.status(404).json({
        success: false,
        error: 'One or both contacts not found'
      });
    }

    // Determine merged data based on strategy
    const mergedData: any = { ...primary };

    if (strategy === 'merge_enriched') {
      // Use enriched data from whichever has higher confidence
      if (
        duplicate.enrichment_confidence &&
        duplicate.enrichment_confidence > (primary.enrichment_confidence || 0)
      ) {
        mergedData.enrichment_source = duplicate.enrichment_source;
        mergedData.enrichment_confidence = duplicate.enrichment_confidence;
        mergedData.enrichment_timestamp = duplicate.enrichment_timestamp;
        mergedData.enrichment_notes = duplicate.enrichment_notes;
      }

      // Fill in missing fields from duplicate
      if (!mergedData.email && duplicate.email) mergedData.email = duplicate.email;
      if (!mergedData.phone && duplicate.phone) mergedData.phone = duplicate.phone;
      if (!mergedData.company && duplicate.company) mergedData.company = duplicate.company;
      if (!mergedData.notes && duplicate.notes) mergedData.notes = duplicate.notes;
    }

    // Update primary contact with merged data
    const { error: updateError } = await supabase
      .from('contacts')
      .update(mergedData)
      .eq('id', primaryContactId);

    if (updateError) {
      return res.status(500).json({
        success: false,
        error: `Failed to update primary contact: ${updateError.message}`
      });
    }

    // Update duplicate_detections table
    const { error: detectionError } = await supabase
      .from('duplicate_detections')
      .insert({
        contact_a_id: primaryContactId < duplicateContactId ? primaryContactId : duplicateContactId,
        contact_b_id: primaryContactId < duplicateContactId ? duplicateContactId : primaryContactId,
        confidence: 0.95, // Manually merged = high confidence
        reason: 'manual_merge',
        merged: true,
        merged_into_id: primaryContactId,
        merged_at: new Date().toISOString()
      });

    if (detectionError && !detectionError.message.includes('duplicate key')) {
      console.warn('[duplicates] Warning adding to duplicate_detections:', detectionError);
      // Don't fail the merge if detection record fails - non-critical
    }

    // Create interaction record for merge
    try {
      await supabase.from('interactions').insert({
        contact_id: primaryContactId,
        type: 'NOTE',
        subject: 'Duplicate contact merged',
        content: `Merged duplicate contact ${duplicate.name} (ID: ${duplicateContactId}) into this contact. Strategy: ${strategy}`,
        metadata: {
          mergedContactId: duplicateContactId,
          mergedContactName: duplicate.name,
          strategy
        },
        timestamp: new Date().toISOString()
      });
    } catch (interactionErr) {
      console.warn('[duplicates] Warning creating interaction record:', interactionErr);
    }

    return res.status(200).json({
      success: true,
      message: 'Contacts merged successfully',
      primaryContactId,
      mergedData
    });
  } catch (err: any) {
    console.error('[duplicates] Merge error:', err);
    return res.status(500).json({
      success: false,
      error: `Server error: ${err.message || 'Unknown error'}`
    });
  }
}

/**
 * Get duplicate detection status for contacts table
 * GET /api/duplicates?action=getDetectionStatus
 */
async function getDetectionStatus(
  req: VercelRequest,
  res: VercelResponse
) {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  try {
    const { data: detections, error } = await supabase
      .from('duplicate_detections')
      .select('*')
      .eq('merged', false)
      .order('confidence', { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        error: `Failed to fetch detections: ${error.message}`
      });
    }

    return res.status(200).json({
      success: true,
      unmergedDuplicates: detections || [],
      count: (detections || []).length,
      highConfidence: (detections || []).filter(d => d.confidence >= 0.9).length,
      mediumConfidence: (detections || []).filter(d => d.confidence >= 0.7 && d.confidence < 0.9).length
    });
  } catch (err: any) {
    console.error('[duplicates] Status error:', err);
    return res.status(500).json({
      success: false,
      error: `Server error: ${err.message || 'Unknown error'}`
    });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  const { action } = req.query as Record<string, string>;

  if (action === 'findDuplicates' && req.method === 'POST') {
    return findDuplicates(req, res);
  }

  if (action === 'checkBeforeEnrich' && req.method === 'GET') {
    return checkBeforeEnrich(req, res);
  }

  if (action === 'mergeContacts' && req.method === 'POST') {
    return mergeContacts(req, res);
  }

  if (action === 'getDetectionStatus' && req.method === 'GET') {
    return getDetectionStatus(req, res);
  }

  return res.status(404).json({ error: 'Action not found' });
}
