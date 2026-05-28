import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

const _url = process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL || '';
const _key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = _url && _key ? createClient(_url, _key) : null;

function normalizePhone(raw: string): string {
  if (!raw) return '';
  return raw.replace(/[^\d]/g, '');
}

/**
 * Guess possible company domains from a company name
 * E.g., "Kingston High School" → ["kingstonhighschool.com", "kingston-high-school.com", ...]
 */
function guessCompanyDomains(companyName: string): string[] {
  if (!companyName || companyName.trim().length === 0) {
    return [];
  }

  const patterns = [
    (name: string) => name.toLowerCase().replace(/\s+/g, ''), // "kingstonhighschool"
    (name: string) => name.toLowerCase().replace(/\s+/g, '-'), // "kingston-high-school"
    (name: string) => name.toLowerCase().replace(/\s+/g, '') + '.co.jm', // Jamaica TLD
    (name: string) => name.toLowerCase().replace(/\s+/g, '-') + '.co.jm'
  ];

  const domains: string[] = [];
  const tlds = ['.com', '.io', '.co', '.org', '.net'];

  for (const pattern of patterns) {
    const base = pattern(companyName);
    // For patterns without TLD, add common ones
    if (!base.includes('.')) {
      for (const tld of tlds) {
        domains.push(base + tld);
      }
    } else {
      domains.push(base);
    }
  }

  return [...new Set(domains)]; // Remove duplicates
}

/**
 * Try to find a valid company website by testing guessed domains
 * Returns the domain that has extractable company data, or null if none found
 */
async function findCompanyWebsite(companyName: string): Promise<string | null> {
  const domains = guessCompanyDomains(companyName);

  for (const domain of domains) {
    try {
      const result = await scrapeCompanyWebsite(domain);
      // If we found meaningful data, this is likely the right domain
      if (result && (result.email || result.phone || result.description)) {
        return domain;
      }
    } catch (err) {
      // Domain not found, try next
      continue;
    }
  }

  return null; // No valid domain found
}

/**
 * Calculate enrichment confidence score (0-1)
 * Based on which fields were successfully extracted
 */
function calculateConfidenceScore(extractedData: any): number {
  let score = 0;

  // Email is most valuable (35%)
  if (extractedData.email) score += 0.35;

  // Name is important (25%)
  if (extractedData.name) score += 0.25;

  // Phone is valuable (25%)
  if (extractedData.phone) score += 0.25;

  // Description is nice to have (15%)
  if (extractedData.description) score += 0.15;

  return Math.min(score, 1.0); // Cap at 1.0
}

async function scrapeCompanyWebsite(url: string): Promise<{
  name?: string;
  email?: string;
  phone?: string;
  description?: string;
} | null> {
  try {
    // Ensure URL has protocol
    let targetUrl = url;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }

    // Fetch webpage with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[scrape] HTTP ${response.status} for ${url}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract company information
    const extractedData: any = {};

    // 1. Extract company name from common locations
    extractedData.name =
      $('meta[property="og:site_name"]').attr('content') ||
      $('meta[name="apple-mobile-web-app-title"]').attr('content') ||
      $('h1').first().text()?.trim() ||
      $('title').text()?.split('|')[0]?.trim() ||
      undefined;

    // 2. Extract description from meta tags
    extractedData.description =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      undefined;

    // 3. Extract email from common patterns
    let email = '';
    // Check for contact page link
    const contactHref = $('a').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('contact') || text.includes('email');
    }).first().attr('href');

    if (contactHref?.includes('@')) {
      email = contactHref.replace('mailto:', '').split('?')[0];
    }

    // Fallback: search page text for email pattern
    if (!email) {
      const pageText = $.text();
      const emailMatch = pageText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
      if (emailMatch) email = emailMatch[1];
    }

    extractedData.email = email || undefined;

    // 4. Extract phone from common patterns
    let phone = '';
    // Check for tel: links
    const telLink = $('a[href^="tel:"]').first().attr('href');
    if (telLink) {
      phone = telLink.replace('tel:', '').split('?')[0];
    }

    // Fallback: search page text for phone pattern (simple pattern for various formats)
    if (!phone) {
      const pageText = $.text();
      const phoneMatch = pageText.match(/(\+?1?\s*[\(\-\.\s]?(\d{3})[\)\-\.\s]?(\d{3})[\-\.\s]?(\d{4}))/);
      if (phoneMatch) phone = phoneMatch[0];
    }

    extractedData.phone = phone || undefined;

    // Clean up extracted data
    if (extractedData.name) extractedData.name = extractedData.name.trim();
    if (extractedData.description) extractedData.description = extractedData.description.trim();
    if (extractedData.email) extractedData.email = extractedData.email.trim().toLowerCase();

    return extractedData;
  } catch (error) {
    console.error('[scrape] Error fetching', url, ':', error);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  const { action } = req.query as Record<string, string>;

  // POST /api/scrape?action=enrichLead
  // Input: { companyUrl, contactId } OR { contactId, useCompanyName: true }
  if (action === 'enrichLead' && req.method === 'POST') {
    let { companyUrl, contactId, useCompanyName } = req.body;

    if (!contactId) {
      return res.status(400).json({ success: false, error: 'contactId required' });
    }

    try {
      let targetUrl = companyUrl;
      let autoDetected = false;

      // NEW: If no URL provided but useCompanyName=true, try to detect from company field
      if (!targetUrl && useCompanyName) {
        const { data: contact, error: contactError } = await supabase!
          .from('contacts')
          .select('company')
          .eq('id', contactId)
          .single();

        if (contactError || !contact?.company) {
          return res.status(400).json({
            success: false,
            error: 'Contact has no company name to detect website'
          });
        }

        console.log(`[scrape] Detecting website for company: ${contact.company}`);
        targetUrl = await findCompanyWebsite(contact.company);
        autoDetected = true;

        if (!targetUrl) {
          return res.status(400).json({
            success: false,
            error: `Could not find website for company: ${contact.company}. Try entering URL manually.`
          });
        }

        console.log(`[scrape] Auto-detected domain: ${targetUrl}`);
      }

      if (!targetUrl) {
        return res.status(400).json({ success: false, error: 'companyUrl required' });
      }

      // Scrape the website
      const extractedData = await scrapeCompanyWebsite(targetUrl);

      if (!extractedData) {
        return res.status(500).json({
          success: false,
          error: 'Failed to scrape website. Check URL and try again.'
        });
      }

      // Calculate confidence score for enriched data
      const confidenceScore = calculateConfidenceScore(extractedData);

      // Prepare update payload — only use existing database columns
      const updatePayload: any = {};

      // Only update fields that were successfully extracted
      if (extractedData.name) updatePayload.company = extractedData.name;
      if (extractedData.email) updatePayload.email = extractedData.email;
      if (extractedData.phone) {
        updatePayload.phone = extractedData.phone;
        updatePayload.phone_normalized = normalizePhone(extractedData.phone);
      }
      if (extractedData.description) updatePayload.notes = extractedData.description;

      // Add enrichment metadata
      updatePayload.enrichment_source = 'web_scrape';
      updatePayload.enrichment_confidence = confidenceScore;
      updatePayload.enrichment_timestamp = new Date().toISOString();

      // Build enrichment notes describing what was found
      const foundFields = Object.keys(extractedData)
        .filter(k => extractedData[k] && k !== 'confidence')
        .map(k => k === 'name' ? 'company' : k); // Map 'name' to 'company' for clarity

      updatePayload.enrichment_notes = `Enriched from: ${targetUrl}. Found: ${foundFields.length > 0 ? foundFields.join(', ') : 'no fields'}. Confidence: ${(confidenceScore * 100).toFixed(0)}%${autoDetected ? ' (auto-detected domain)' : ''}`;

      // Only update if we have something to save
      if (Object.keys(updatePayload).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No data extracted from website',
          extracted: extractedData
        });
      }

      // Update contact in Supabase
      const { data, error } = await supabase!
        .from('contacts')
        .update(updatePayload)
        .eq('id', contactId)
        .select('*')
        .single();

      if (error) {
        console.error('[scrape] Update error:', error.message, error.details);
        return res.status(500).json({
          success: false,
          error: `Database update failed: ${error.message || 'Unknown error'}`,
          extracted: extractedData,
          supabaseError: error.message
        });
      }

      // Create enrichment history record (non-critical, don't fail if it fails)
      try {
        await supabase!.from('interactions').insert({
          contact_id: contactId,
          type: 'ENRICHMENT',
          subject: `Web scrape enrichment: ${targetUrl}`,
          content: `Enriched contact with data from website. Confidence: ${(confidenceScore * 100).toFixed(0)}%`,
          metadata: {
            extractedData,
            confidenceScore,
            url: targetUrl,
            autoDetected
          },
          timestamp: new Date().toISOString()
        });
      } catch (historyErr) {
        console.error('[scrape] History insert error (non-critical):', historyErr);
        // Don't fail the request if history insert fails
      }

      return res.status(200).json({
        success: true,
        extracted: extractedData,
        contact: data,
        enrichmentMetadata: {
          url: targetUrl,
          source: 'web_scrape',
          confidence: confidenceScore,
          autoDetected
        }
      });
    } catch (err: any) {
      console.error('[scrape] Error:', err);
      return res.status(500).json({
        success: false,
        error: `Server error: ${err.message || 'Unknown error'}`,
        details: err.toString()
      });
    }
  }

  return res.status(404).json({ error: 'Action not found' });
}
