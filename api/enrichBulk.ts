import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

const _url = process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL || '';
const _key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = _url && _key ? createClient(_url, _key) : null;

function guessCompanyDomains(companyName: string): string[] {
  if (!companyName || companyName.trim().length === 0) {
    return [];
  }

  const patterns = [
    (name: string) => name.toLowerCase().replace(/\s+/g, ''),
    (name: string) => name.toLowerCase().replace(/\s+/g, '-'),
    (name: string) => name.toLowerCase().replace(/\s+/g, '') + '.co.jm',
    (name: string) => name.toLowerCase().replace(/\s+/g, '-') + '.co.jm'
  ];

  const domains: string[] = [];
  const tlds = ['.com', '.io', '.co', '.org', '.net'];

  for (const pattern of patterns) {
    const base = pattern(companyName);
    if (!base.includes('.')) {
      for (const tld of tlds) {
        domains.push(base + tld);
      }
    } else {
      domains.push(base);
    }
  }

  return [...new Set(domains)];
}

async function scrapeWebsite(url: string): Promise<{
  name?: string;
  email?: string;
  phone?: string;
  description?: string;
  website_url?: string;
} | null> {
  try {
    let targetUrl = url;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout for bulk operations

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const extractedData: any = {};

    extractedData.name =
      $('meta[property="og:site_name"]').attr('content') ||
      $('meta[name="apple-mobile-web-app-title"]').attr('content') ||
      $('h1').first().text()?.trim() ||
      $('title').text()?.split('|')[0]?.trim() ||
      undefined;

    extractedData.description =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      undefined;

    // Capture website URL (normalized to HTTPS)
    extractedData.website_url = targetUrl;

    let email = '';
    const contactHref = $('a').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('contact') || text.includes('email');
    }).first().attr('href');

    if (contactHref?.includes('@')) {
      email = contactHref.replace('mailto:', '').split('?')[0];
    }

    if (!email) {
      const pageText = $.text();
      const emailMatch = pageText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
      if (emailMatch) email = emailMatch[1];
    }

    extractedData.email = email || undefined;

    let phone = '';
    const telLink = $('a[href^="tel:"]').first().attr('href');
    if (telLink) {
      phone = telLink.replace('tel:', '').split('?')[0];
    }

    if (!phone) {
      const pageText = $.text();
      const phoneMatch = pageText.match(/(\+?1?\s*[\(\-\.\s]?(\d{3})[\)\-\.\s]?(\d{3})[\-\.\s]?(\d{4}))/);
      if (phoneMatch) phone = phoneMatch[0];
    }

    extractedData.phone = phone || undefined;

    if (extractedData.name) extractedData.name = extractedData.name.trim();
    if (extractedData.description) extractedData.description = extractedData.description.trim();
    if (extractedData.email) extractedData.email = extractedData.email.trim().toLowerCase();

    return extractedData;
  } catch (error) {
    return null;
  }
}

function calculateConfidenceScore(extractedData: any): number {
  let score = 0;
  if (extractedData.email) score += 0.35;
  if (extractedData.name) score += 0.25;
  if (extractedData.phone) score += 0.25;
  if (extractedData.description) score += 0.15;
  return Math.min(score, 1.0);
}

/**
 * Bulk enrich contacts from company names
 * POST /api/enrichBulk?action=enrichContacts
 * Input: { contacts: [{ company: string }, ...] }
 */
async function enrichContacts(req: VercelRequest, res: VercelResponse) {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  try {
    const { contacts } = req.body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'contacts array required'
      });
    }

    const results: any[] = [];
    let successCount = 0;
    let failureCount = 0;

    // Process each contact with company-based enrichment
    for (const contact of contacts) {
      const companyName = contact.company?.trim();
      const providedUrl = contact.website_url?.trim();

      if (!companyName && !providedUrl) {
        results.push({
          input: contact,
          success: false,
          error: 'No company name or website URL provided',
          enriched: null
        });
        failureCount++;
        continue;
      }

      try {
        let found: any = null;

        // If website_url is provided, use it directly (skip domain guessing)
        if (providedUrl) {
          found = await scrapeWebsite(providedUrl);
        } else {
          // Fall back to company-based domain guessing
          const domains = guessCompanyDomains(companyName);

          for (const domain of domains) {
            const scrapedData = await scrapeWebsite(domain);
            if (scrapedData && (scrapedData.email || scrapedData.phone || scrapedData.description)) {
              found = scrapedData;
              break;
            }
          }
        }

        if (found) {
          const confidence = calculateConfidenceScore(found);
          results.push({
            input: contact,
            success: true,
            enriched: {
              ...contact,
              ...found,
              enrichment_source: 'bulk_web_scrape',
              enrichment_confidence: confidence,
              enrichment_timestamp: new Date().toISOString()
            }
          });
          successCount++;
        } else {
          results.push({
            input: contact,
            success: false,
            error: 'Could not find website for company',
            enriched: null
          });
          failureCount++;
        }
      } catch (error: any) {
        results.push({
          input: contact,
          success: false,
          error: error.message || 'Enrichment failed',
          enriched: null
        });
        failureCount++;
      }

      // Add small delay to avoid overwhelming target servers
      if (contacts.indexOf(contact) < contacts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return res.status(200).json({
      success: true,
      results,
      summary: {
        total: contacts.length,
        successful: successCount,
        failed: failureCount,
        successRate: Math.round((successCount / contacts.length) * 100)
      }
    });
  } catch (err: any) {
    console.error('[enrichBulk] Error:', err);
    return res.status(500).json({
      success: false,
      error: `Server error: ${err.message || 'Unknown error'}`
    });
  }
}

/**
 * Preview bulk enrichment (trial run on sample)
 * POST /api/enrichBulk?action=previewEnrichment
 * Input: { contacts: [{ company: string }, ...], sampleSize?: number }
 */
async function previewEnrichment(req: VercelRequest, res: VercelResponse) {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  try {
    const { contacts, sampleSize = 5 } = req.body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'contacts array required'
      });
    }

    // Take sample
    const sample = contacts.slice(0, Math.min(sampleSize, contacts.length));
    let successCount = 0;

    for (const contact of sample) {
      const companyName = contact.company?.trim();
      const providedUrl = contact.website_url?.trim();

      if (!companyName && !providedUrl) continue;

      try {
        let found = null;

        // If website_url is provided, use it directly
        if (providedUrl) {
          found = await scrapeWebsite(providedUrl);
        } else {
          // Fall back to company-based domain guessing
          const domains = guessCompanyDomains(companyName);
          for (const domain of domains) {
            const scrapedData = await scrapeWebsite(domain);
            if (scrapedData && (scrapedData.email || scrapedData.phone || scrapedData.description)) {
              found = scrapedData;
              break;
            }
          }
        }

        if (found && (found.email || found.phone || found.description)) {
          successCount++;
        }
      } catch (error) {
        // Skip failed items in preview
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const projectedSuccessRate = sample.length > 0
      ? Math.round((successCount / sample.length) * 100)
      : 0;

    const projectedSuccessCount = Math.round(
      (projectedSuccessRate / 100) * contacts.length
    );

    return res.status(200).json({
      success: true,
      preview: {
        sampleSize: sample.length,
        totalContacts: contacts.length,
        sampleSuccessful: successCount,
        sampleFailed: sample.length - successCount,
        projectedSuccessRate,
        projectedSuccessful: projectedSuccessCount,
        projectedFailed: contacts.length - projectedSuccessCount
      }
    });
  } catch (err: any) {
    console.error('[enrichBulk] Preview error:', err);
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

  if (action === 'enrichContacts' && req.method === 'POST') {
    return enrichContacts(req, res);
  }

  if (action === 'previewEnrichment' && req.method === 'POST') {
    return previewEnrichment(req, res);
  }

  return res.status(404).json({ error: 'Action not found' });
}
