import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

const _url = process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL || '';
const _key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = _url && _key ? createClient(_url, _key) : null;

function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/[^\d]/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
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
  const phoneNorm  = normalizePhone(opts.phone || '');
  const filters: string[] = [];
  if (emailLower) filters.push(`email.ilike.${emailLower}`);
  if (phoneNorm)  filters.push(`phone_normalized.eq.${phoneNorm}`);
  if (filters.length > 0) {
    const { data: existing } = await supabase.from('contacts').select('id, email, phone, phone_normalized, company').or(filters.join(',')).limit(1).maybeSingle();
    if (existing) {
      const updates: Record<string, any> = {};
      if (emailLower && !existing.email)            updates.email = emailLower;
      if (phoneNorm  && !existing.phone_normalized) { updates.phone_normalized = phoneNorm; if (opts.phone) updates.phone = opts.phone; }
      if (opts.company && !existing.company)        updates.company = opts.company;
      if (Object.keys(updates).length > 0) await supabase.from('contacts').update(updates).eq('id', existing.id);
      return { id: existing.id, created: false };
    }
  }
  const { data, error } = await supabase.from('contacts').insert({ name: opts.name || 'Unknown', email: emailLower || null, phone: opts.phone || null, phone_normalized: phoneNorm || null, company: opts.company || null, notes: opts.notes || null, source: opts.source, status: 'NEW' }).select('id').single();
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
    const allowed = ['contact_preference', 'notes', 'status', 'website_url', 'timezone', 'linkedin_url'];
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

  // Enrichment actions (merged from enrichment.ts)
  if (action === 'enrichContacts' && req.method === 'POST') return enrichContacts(req, res);
  if (action === 'previewEnrichment' && req.method === 'POST') return previewEnrichment(req, res);
  if (action === 'enrichLead' && req.method === 'POST') return enrichLead(req, res);

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

// ---------------------------------------------------------------------------
// Enrichment helpers (merged from enrichment.ts)
// ---------------------------------------------------------------------------

function guessCompanyDomains(companyName: string): string[] {
  if (!companyName || companyName.trim().length === 0) return [];
  const patterns = [
    (n: string) => n.toLowerCase().replace(/\s+/g, ''),
    (n: string) => n.toLowerCase().replace(/\s+/g, '-'),
    (n: string) => n.toLowerCase().replace(/\s+/g, '') + '.co.jm',
    (n: string) => n.toLowerCase().replace(/\s+/g, '-') + '.co.jm',
  ];
  const domains: string[] = [];
  const tlds = ['.com', '.io', '.co', '.org', '.net'];
  for (const pattern of patterns) {
    const base = pattern(companyName);
    if (!base.includes('.')) { for (const tld of tlds) domains.push(base + tld); }
    else domains.push(base);
  }
  return [...new Set(domains)];
}

async function scrapeWebsite(url: string): Promise<{ name?: string; email?: string; phone?: string; description?: string; website_url?: string } | null> {
  try {
    let targetUrl = url;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) targetUrl = `https://${targetUrl}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(targetUrl, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const html = await response.text();
    const $ = cheerio.load(html);
    const extractedData: any = {};
    extractedData.name = $('meta[property="og:site_name"]').attr('content') || $('meta[name="apple-mobile-web-app-title"]').attr('content') || $('h1').first().text()?.trim() || $('title').text()?.split('|')[0]?.trim() || undefined;
    extractedData.description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || undefined;
    extractedData.website_url = targetUrl;
    let email = '';
    const contactHref = $('a').filter((_, el) => { const t = $(el).text().toLowerCase(); return t.includes('contact') || t.includes('email'); }).first().attr('href');
    if (contactHref?.includes('@')) email = contactHref.replace('mailto:', '').split('?')[0];
    if (!email) { const m = $.text().match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/); if (m) email = m[1]; }
    extractedData.email = email || undefined;
    let phone = '';
    const telLink = $('a[href^="tel:"]').first().attr('href');
    if (telLink) phone = telLink.replace('tel:', '').split('?')[0];
    if (!phone) { const m = $.text().match(/(\+?1?\s*[\(\-\.\s]?(\d{3})[\)\-\.\s]?(\d{3})[\-\.\s]?(\d{4}))/); if (m) phone = m[0]; }
    extractedData.phone = phone || undefined;
    if (extractedData.name) extractedData.name = extractedData.name.trim();
    if (extractedData.description) extractedData.description = extractedData.description.trim();
    if (extractedData.email) extractedData.email = extractedData.email.trim().toLowerCase();
    return extractedData;
  } catch { return null; }
}

function calcEnrichConfidence(d: any): number {
  let s = 0;
  if (d.email) s += 0.35; if (d.name) s += 0.25; if (d.phone) s += 0.25; if (d.description) s += 0.15;
  return Math.min(s, 1.0);
}

async function findCompanyWebsite(companyName: string): Promise<string | null> {
  for (const domain of guessCompanyDomains(companyName)) {
    const r = await scrapeWebsite(domain).catch(() => null);
    if (r && (r.email || r.phone || r.description)) return domain;
  }
  return null;
}

async function enrichContacts(req: VercelRequest, res: VercelResponse) {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  try {
    const { contacts } = req.body;
    if (!Array.isArray(contacts) || contacts.length === 0) return res.status(400).json({ success: false, error: 'contacts array required' });
    const results: any[] = []; let successCount = 0; let failureCount = 0;
    for (const contact of contacts) {
      const companyName = contact.company?.trim();
      if (!companyName) { results.push({ input: contact, success: false, error: 'No company name', enriched: null }); failureCount++; continue; }
      try {
        let found: any = null;
        for (const domain of guessCompanyDomains(companyName)) {
          const d = await scrapeWebsite(domain);
          if (d && (d.email || d.phone || d.description)) { found = d; break; }
        }
        if (found) { results.push({ input: contact, success: true, enriched: { ...contact, ...found, enrichment_source: 'bulk_web_scrape', enrichment_confidence: calcEnrichConfidence(found), enrichment_timestamp: new Date().toISOString() } }); successCount++; }
        else { results.push({ input: contact, success: false, error: 'Could not find website', enriched: null }); failureCount++; }
      } catch (e: any) { results.push({ input: contact, success: false, error: e.message, enriched: null }); failureCount++; }
      await new Promise(r => setTimeout(r, 100));
    }
    return res.status(200).json({ success: true, results, summary: { total: contacts.length, successful: successCount, failed: failureCount, successRate: Math.round((successCount / contacts.length) * 100) } });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
}

async function previewEnrichment(req: VercelRequest, res: VercelResponse) {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  try {
    const { contacts, sampleSize = 5 } = req.body;
    if (!Array.isArray(contacts) || contacts.length === 0) return res.status(400).json({ success: false, error: 'contacts array required' });
    const sample = contacts.slice(0, Math.min(sampleSize, contacts.length));
    let successCount = 0;
    for (const contact of sample) {
      const companyName = contact.company?.trim();
      if (!companyName) continue;
      for (const domain of guessCompanyDomains(companyName)) {
        const d = await scrapeWebsite(domain).catch(() => null);
        if (d && (d.email || d.phone || d.description)) { successCount++; break; }
      }
      await new Promise(r => setTimeout(r, 100));
    }
    const rate = sample.length > 0 ? Math.round((successCount / sample.length) * 100) : 0;
    return res.status(200).json({ success: true, preview: { sampleSize: sample.length, totalContacts: contacts.length, sampleSuccessful: successCount, sampleFailed: sample.length - successCount, projectedSuccessRate: rate, projectedSuccessful: Math.round((rate / 100) * contacts.length), projectedFailed: contacts.length - Math.round((rate / 100) * contacts.length) } });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
}

async function enrichLead(req: VercelRequest, res: VercelResponse) {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  let { companyUrl, contactId, useCompanyName } = req.body;
  if (!contactId) return res.status(400).json({ success: false, error: 'contactId required' });
  try {
    let targetUrl = companyUrl;
    let autoDetected = false;
    if (!targetUrl && useCompanyName) {
      const { data: contact, error: ce } = await supabase.from('contacts').select('company').eq('id', contactId).single();
      if (ce || !contact?.company) return res.status(400).json({ success: false, error: 'Contact has no company name' });
      targetUrl = await findCompanyWebsite(contact.company);
      autoDetected = true;
      if (!targetUrl) return res.status(400).json({ success: false, error: `Could not find website for company: ${contact.company}` });
    }
    if (!targetUrl) return res.status(400).json({ success: false, error: 'companyUrl required' });
    const extractedData = await scrapeWebsite(targetUrl);
    if (!extractedData) return res.status(500).json({ success: false, error: 'Failed to scrape website' });
    const confidence = calcEnrichConfidence(extractedData);
    const update: any = {};
    if (extractedData.name) update.company = extractedData.name;
    if (extractedData.email) update.email = extractedData.email;
    if (extractedData.phone) { update.phone = extractedData.phone; update.phone_normalized = extractedData.phone.replace(/[^\d]/g, ''); }
    if (extractedData.description) update.notes = extractedData.description;
    if (extractedData.website_url) update.website_url = extractedData.website_url;
    update.enrichment_source = 'web_scrape'; update.enrichment_confidence = confidence; update.enrichment_timestamp = new Date().toISOString();
    const foundFields = Object.keys(extractedData).filter(k => extractedData[k] && k !== 'confidence').map(k => k === 'name' ? 'company' : k);
    update.enrichment_notes = `Enriched from: ${targetUrl}. Found: ${foundFields.length > 0 ? foundFields.join(', ') : 'none'}. Confidence: ${(confidence * 100).toFixed(0)}%${autoDetected ? ' (auto-detected)' : ''}`;
    const { data, error } = await supabase.from('contacts').update(update).eq('id', contactId).select('*').single();
    if (error) return res.status(500).json({ success: false, error: error.message, extracted: extractedData });
    try { await supabase.from('interactions').insert({ contact_id: contactId, type: 'ENRICHMENT', subject: `Web scrape: ${targetUrl}`, content: `Enriched contact. Confidence: ${(confidence * 100).toFixed(0)}%`, metadata: { extractedData, confidence, url: targetUrl, autoDetected }, timestamp: new Date().toISOString() }); } catch (_) {}
    return res.status(200).json({ success: true, extracted: extractedData, contact: data, enrichmentMetadata: { url: targetUrl, source: 'web_scrape', confidence, autoDetected } });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
}
