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
  if (action === 'enrichLead' && req.method === 'POST') {
    const { companyUrl, contactId } = req.body;

    if (!companyUrl) {
      return res.status(400).json({ success: false, error: 'companyUrl required' });
    }

    if (!contactId) {
      return res.status(400).json({ success: false, error: 'contactId required' });
    }

    try {
      // Scrape the website
      const extractedData = await scrapeCompanyWebsite(companyUrl);

      if (!extractedData) {
        return res.status(500).json({
          success: false,
          error: 'Failed to scrape website. Check URL and try again.'
        });
      }

      // Prepare update payload
      const updatePayload: any = {
        company_website: companyUrl,
        enriched_from: 'web_scrape'
      };

      // Only update fields that were successfully extracted
      if (extractedData.name) updatePayload.company = extractedData.name;
      if (extractedData.email) updatePayload.email = extractedData.email;
      if (extractedData.phone) {
        updatePayload.phone = extractedData.phone;
        updatePayload.phone_normalized = normalizePhone(extractedData.phone);
      }
      if (extractedData.description) updatePayload.notes = extractedData.description;

      // Update contact in Supabase
      const { data, error } = await supabase
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

      // Create enrichment history record
      await supabase.from('interactions').insert({
        contact_id: contactId,
        type: 'ENRICHMENT',
        subject: `Web scrape enrichment: ${companyUrl}`,
        body: JSON.stringify(extractedData),
        timestamp: new Date().toISOString(),
        source: 'WEB_SCRAPE'
      }).catch(err => console.error('[scrape] History error:', err));

      return res.status(200).json({
        success: true,
        extracted: extractedData,
        contact: data
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
