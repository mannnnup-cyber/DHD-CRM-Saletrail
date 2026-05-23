import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

async function resolveContact(sb: any, opts: { name: string; email?: string; phone?: string; source: string }): Promise<string | null> {
  const emailLower = (opts.email || '').toLowerCase().trim();
  const phoneNorm = (opts.phone || '').replace(/[^\d]/g, '');
  if (emailLower) {
    const { data } = await sb.from('contacts').select('id').ilike('email', emailLower).limit(1).single();
    if (data) return data.id;
  }
  if (phoneNorm) {
    const { data } = await sb.from('contacts').select('id').eq('phone_normalized', phoneNorm).limit(1).single();
    if (data) return data.id;
  }
  const { data, error } = await sb.from('contacts').insert({ name: opts.name || 'Unknown', email: emailLower || null, phone: opts.phone || null, phone_normalized: phoneNorm || null, source: opts.source, status: 'NEW' }).select('id').single();
  if (error) { console.error('[email] resolveContact error:', error.message); return null; }
  return data.id;
}

// Decode quoted-printable encoding (=3D, =20, soft line breaks etc.)
function decodeQP(str: string): string {
  return str
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

const SUPABASE_URL = process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = SUPABASE_URL ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Cache for settings
let settingsCache: Record<string, string> = {};
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 60000; // 1 minute

// Get settings from database (with caching)
async function getSettings(): Promise<Record<string, string>> {
  if (!supabase) return {};

  const now = Date.now();
  if (now - settingsCacheTime < SETTINGS_CACHE_TTL && Object.keys(settingsCache).length > 0) {
    return settingsCache;
  }

  try {
    // Order newest-first so duplicate rows resolve to the most recently saved value
    const { data } = await supabase
      .from('app_settings')
      .select('setting_key, setting_value')
      .order('updated_at', { ascending: false });

    settingsCache = {};
    // First occurrence of each key wins (most recently updated)
    (data || []).forEach((s: any) => {
      if (s.setting_value && !(s.setting_key in settingsCache)) {
        settingsCache[s.setting_key] = s.setting_value;
      }
    });
    settingsCacheTime = now;
  } catch (error) {
    console.error('Error fetching settings:', error);
  }

  return settingsCache;
}

// Helper to get a specific setting
async function getSetting(key: string, fallback: string = ''): Promise<string> {
  const settings = await getSettings();
  return settings[key] || fallback;
}

// Helper to get boolean setting
async function getBoolSetting(key: string, fallback: boolean = false): Promise<boolean> {
  const value = await getSetting(key, fallback ? 'true' : 'false');
  return value === 'true';
}

interface Email {
  id: string;
  message_id: string;
  thread_id: string;
  from_email: string;
  from_name: string;
  to_email: string;
  subject: string;
  body: string;
  date: string;
  read: boolean;
  starred: boolean;
  category: 'lead' | 'support' | 'newsletter' | 'other';
  leadScore: number;
  aiAnalysis: {
    intent: string;
    sentiment: string;
    urgency: string;
    keyPoints: string[];
    suggestedAction: string;
  } | null;
}

async function getAIKey(): Promise<string> {
  // 1. Check direct Vercel env var first (fastest path)
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;

  // 2. Try to read from Settings DB (if Supabase is available)
  if (supabase) {
    try {
      const key = await getSetting('OPENAI_API_KEY', '');
      if (key) return key;
    } catch (err) {
      console.error('Failed to read OPENAI_API_KEY from settings:', err);
    }
  }

  return '';
}

async function callOpenAI(messages: { role: string; content: string }[], jsonMode = false): Promise<string> {
  const apiKey = await getAIKey();
  if (!apiKey) throw new Error('No OpenAI API key configured');
  const body: any = { model: 'gpt-4o-mini', messages };
  if (jsonMode) body.response_format = { type: 'json_object' };
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Analyze email with AI
async function analyzeWithAI(email: { subject: string; body: string; from: string }): Promise<{
  score: number;
  category: string;
  analysis: {
    intent: string;
    sentiment: string;
    urgency: string;
    keyPoints: string[];
    suggestedAction: string;
  };
}> {
  try {
    const content = await callOpenAI([{
      role: 'system',
      content: `You are a CRM AI assistant analyzing emails for lead potential. Analyze the email and return a JSON object with:
{
  "score": 0-100 (how likely this is a qualified lead),
  "category": "lead" | "support" | "newsletter" | "other",
  "analysis": {
    "intent": "What the sender wants (e.g., 'Quote request', 'Partnership', 'Information')",
    "sentiment": "Positive | Neutral | Negative | Excited | Hesitant",
    "urgency": "High | Normal | Low",
    "keyPoints": ["Point 1", "Point 2"],
    "suggestedAction": "Recommended next step"
  }
}

Lead indicators (high score): mentions of budget, timeline, specific needs, business context, decision-making language
Low score indicators: generic inquiries, auto-responses, newsletters, spam`
    }, {
      role: 'user',
      content: `Analyze this email:\n\nFrom: ${email.from}\nSubject: ${email.subject}\n\nBody:\n${email.body.slice(0, 1500)}`
    }], true);

    if (content) {
      const parsed = JSON.parse(content);
      return {
        score: parsed.score || 50,
        category: parsed.category || 'other',
        analysis: parsed.analysis || {
          intent: 'Unknown',
          sentiment: 'Neutral',
          urgency: 'Normal',
          keyPoints: [],
          suggestedAction: 'Review manually'
        }
      };
    }
  } catch (error) {
    console.error('AI Analysis Error:', error);
  }

  // Fallback keyword-based analysis
  const text = `${email.subject} ${email.body}`.toLowerCase();
  let score = 50;
  let category = 'other';

  const highScoreKeywords = ['quote', 'pricing', 'budget', 'cost', 'timeline', 'deadline', 'urgent', 'meeting', 'call', 'demo', 'interested', 'purchase', 'buy', 'contract', 'proposal', 'business'];
  const lowScoreKeywords = ['unsubscribe', 'newsletter', 'update', 'spam', 'help', 'support', 'issue', 'problem', 'refund'];

  highScoreKeywords.forEach(kw => { if (text.includes(kw)) score += 10; });
  lowScoreKeywords.forEach(kw => { if (text.includes(kw)) score -= 15; });

  if (text.includes('urgent') || text.includes('asap')) {
    score += 10;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    category: score > 60 ? 'lead' : (text.includes('help') || text.includes('support') ? 'support' : (text.includes('unsubscribe') || text.includes('newsletter') ? 'newsletter' : 'other')),
    analysis: {
      intent: 'Analyzed based on keywords',
      sentiment: 'Neutral',
      urgency: text.includes('urgent') || text.includes('asap') ? 'High' : 'Normal',
      keyPoints: [],
      suggestedAction: 'Review and respond'
    }
  };
}

// Predictive scoring based on historical patterns
async function getPredictiveScore(email: { subject: string; body: string; from: string }): Promise<{
  score: number;
  predictions: { label: string; confidence: number }[];
}> {
  const baseAnalysis = await analyzeWithAI(email);

  // Get historical conversion patterns from Supabase
  if (supabase) {
    try {
      const { data: patterns } = await supabase
        .from('lead_patterns')
        .select('*')
        .eq('is_active', true);

      if (patterns && patterns.length > 0) {
        let bonusScore = 0;
        const text = `${email.subject} ${email.body}`.toLowerCase();
        const predictions: { label: string; confidence: number }[] = [];

        patterns.forEach((pattern: any) => {
          if (text.includes(pattern.pattern_value.toLowerCase())) {
            bonusScore += pattern.score_boost;
          }
        });

        // Get conversion rate for similar emails
        const { data: conversions } = await supabase
          .from('email_conversions')
          .select('*')
          .order('converted_at', { ascending: false })
          .limit(100);

        if (conversions && conversions.length > 0) {
          const conversionRate = (conversions.length / 100) * 100;
          predictions.push({
            label: `${Math.round(conversionRate)}% historical conversion rate`,
            confidence: 0.7
          });
        }

        // Predict deal value based on score
        if (baseAnalysis.score >= 70) {
          predictions.push({
            label: `Estimated deal value: $${Math.round(baseAnalysis.score * 50)}`,
            confidence: 0.6
          });
        }

        // Add timing recommendation
        const dayOfWeek = new Date().getDay();
        if (dayOfWeek >= 2 && dayOfWeek <= 4) {
          predictions.push({
            label: 'Best time to follow up: Tuesday-Thursday',
            confidence: 0.8
          });
        }

        return {
          score: Math.max(0, Math.min(100, baseAnalysis.score + (bonusScore * 0.3))),
          predictions
        };
      }
    } catch (error) {
      console.error('Predictive analysis error:', error);
    }
  }

  return {
    score: baseAnalysis.score,
    predictions: []
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = req.query.action as string;

  try {
    switch (action) {
      case 'list': {
        // Get all emails from Supabase, sorted by date
        if (!supabase) {
          return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const { data: emails, error } = await supabase
          .from('emails')
          .select('*')
          .order('date', { ascending: false })
          .limit(100);

        if (error) {
          // Table may not exist yet — return empty list rather than crashing
          console.error('Email list error:', error.message);
          return res.json({ success: true, emails: [], tableError: error.message });
        }

        return res.json({ success: true, emails: emails || [] });
      }

      case 'threads': {
        // Get email threads (grouped by thread_id)
        if (!supabase) {
          return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const { data: emails } = await supabase
          .from('emails')
          .select('*')
          .order('date', { ascending: false })
          .limit(200);

        // Group by thread_id
        const threads: Record<string, any[]> = {};
        (emails || []).forEach(email => {
          const threadId = email.thread_id || email.id;
          if (!threads[threadId]) {
            threads[threadId] = [];
          }
          threads[threadId].push(email);
        });

        // Get latest email from each thread
        const latestThreads = Object.entries(threads).map(([threadId, emails]) => ({
          threadId,
          latestEmail: emails[0],
          messageCount: emails.length,
          participants: [...new Set(emails.map(e => e.from_email))],
          unreadCount: emails.filter(e => !e.read).length
        }));

        return res.json({ success: true, threads: latestThreads });
      }

      case 'thread': {
        // Get all emails in a thread
        const { threadId } = req.query;
        if (!supabase) {
          return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const { data: emails } = await supabase
          .from('emails')
          .select('*')
          .eq('thread_id', threadId as string)
          .order('date', { ascending: true });

        return res.json({ success: true, emails: emails || [] });
      }

      case 'sync': {
        // Lazy-load imap and mailparser — dynamic import works in both CJS and ESM Vercel runtimes
        let Imap: any, simpleParser: any;
        try {
          const imapMod = await import('imap');
          Imap = (imapMod as any).default ?? imapMod;
          const mailMod = await import('mailparser');
          simpleParser = (mailMod as any).simpleParser ?? (mailMod as any).default?.simpleParser;
        } catch (importErr: any) {
          return res.status(500).json({
            success: false,
            error: 'IMAP packages not available: ' + importErr.message,
            hint: 'Run npm install imap mailparser and redeploy'
          });
        }

        // Prefer settings passed directly in the request body (from localStorage on the client)
        // so this works even if the app_settings table doesn't exist in Supabase yet
        const bodySettings: Record<string, string> = req.body?.settings || {};
        const dbSettings = Object.keys(bodySettings).length > 0 ? bodySettings : await getSettings();

        const IMAP_HOST = dbSettings['IMAP_HOST'] || '';
        const IMAP_PORT = parseInt(dbSettings['IMAP_PORT'] || '993');
        const IMAP_USER = dbSettings['IMAP_USER'] || '';
        const IMAP_PASSWORD = dbSettings['IMAP_PASSWORD'] || '';
        const IMAP_USE_TLS = dbSettings['IMAP_USE_TLS'] !== 'false';
        const AI_ANALYSIS_ENABLED = dbSettings['AI_ANALYSIS_ENABLED'] !== 'false';

        if (!IMAP_HOST || !IMAP_USER || !IMAP_PASSWORD) {
          return res.json({
            success: false,
            error: 'IMAP not configured',
            message: 'Configure IMAP settings in Settings > Email tab',
            setupUrl: '/settings'
          });
        }

        return new Promise((resolve) => {
          const imap = new Imap({
            user: IMAP_USER,
            password: IMAP_PASSWORD,
            host: IMAP_HOST,
            port: IMAP_PORT,
            tls: IMAP_USE_TLS,
            tlsOptions: { rejectUnauthorized: false },
            connTimeout: 20000,
            authTimeout: 15000
          });

          function openInbox(cb: (err: Error | null, box: any) => void) {
            imap.openBox('INBOX', true, cb);
          }

          imap.once('ready', () => {
            openInbox(async (err, box) => {
              if (err) {
                imap.end();
                return resolve(res.status(500).json({ success: false, error: err.message }));
              }

              const totalEmails = box.messages.total;
              const fetchedEmails: any[] = [];

              if (totalEmails === 0) {
                imap.end();
                return resolve(res.json({ success: true, synced: 0, total: 0 }));
              }

              // Fetch last 50 emails — fetch full raw message so simpleParser
              // can decode multipart MIME, quoted-printable, base64 itself
              const fetchRange = Math.max(1, totalEmails - 49);
              const fetch = imap.seq.fetch(`${fetchRange}:*`, {
                bodies: '',   // '' = entire raw RFC 2822 message
                struct: true
              });

              let expectedCount = 0;  // incremented synchronously per message
              let processedCount = 0; // incremented after async processing
              let fetchEnded = false;
              let resolved = false;
              let newEmails = 0;

              const tryResolve = () => {
                if (resolved) return;
                if (fetchEnded && processedCount >= expectedCount) {
                  resolved = true;
                  imap.end();
                  resolve(res.json({
                    success: true,
                    synced: newEmails,
                    total: totalEmails,
                    processed: processedCount,
                    emails: fetchedEmails,
                    message: `Synced ${newEmails} new emails`
                  }));
                }
              };

              fetch.on('message', (msg: any, seqno: any) => {
                expectedCount++;
                // Collect the full raw email (headers + body) so simpleParser
                // can handle multipart splitting and QP/base64 decoding itself
                let rawEmail = '';

                msg.on('body', (stream: any) => {
                  stream.on('data', (chunk: any) => {
                    if (rawEmail.length < 500000) rawEmail += chunk.toString('utf8');
                  });
                });

                msg.once('attributes', (attrs: any) => {
                  const flags: string[] = attrs.flags || [];
                  (msg as any)._isRead = flags.some((f: string) => f === '\\Seen');
                });

                msg.once('end', async () => {
                  try {
                    // simpleParser handles multipart MIME, QP, base64, charsets
                    const parsed = await simpleParser(rawEmail);

                    const fromAddr = parsed.from?.value?.[0];
                    const fromEmail = fromAddr?.address || `unknown-${seqno}@unknown.com`;
                    const fromName  = fromAddr?.name || fromEmail.split('@')[0];
                    const toAddr    = parsed.to && !Array.isArray(parsed.to)
                      ? parsed.to.value?.[0]?.address
                      : (parsed.to as any)?.[0]?.value?.[0]?.address || '';
                    const subject   = parsed.subject || '(no subject)';
                    const msgDate   = parsed.date ? parsed.date.toISOString() : new Date().toISOString();
                    const messageId = parsed.messageId || `imap-${seqno}-${Date.now()}`;
                    const inReplyTo = parsed.inReplyTo || '';
                    const refs      = (parsed as any).references
                      ? (Array.isArray((parsed as any).references) ? (parsed as any).references : [(parsed as any).references])
                      : [];

                    // Thread root: prefer In-Reply-To, then first Reference, then own Message-ID
                    let threadId = inReplyTo || (refs.length > 0 ? refs[0] : '') || messageId;

                    // parsed.text is already decoded plain text; fall back to stripped HTML
                    const bodyPreview = (
                      parsed.text ||
                      parsed.html?.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                  .replace(/<[^>]+>/g, ' ')
                                  .replace(/\s{2,}/g, ' ')
                                  .trim() ||
                      ''
                    ).slice(0, 5000);

                    const isRead = !!(msg as any)._isRead;

                    const emailData: any = {
                      message_id: messageId,
                      thread_id: threadId,
                      from_email: fromEmail,
                      from_name: fromName,
                      to_email: toAddr || '',
                      subject,
                      body: bodyPreview,
                      date: msgDate,
                      read: isRead,
                      starred: false,
                      category: 'other',
                      lead_score: 50,
                      ai_analysis: null,
                      source: 'IMAP'
                    };

                    // Check duplicate + save
                    let alreadyExists = false;
                    if (supabase) {
                      const { data: existing } = await supabase
                        .from('emails').select('id')
                        .eq('message_id', messageId).maybeSingle();
                      alreadyExists = !!existing;
                    }

                    if (!alreadyExists) {
                      // Resolve or create a Contact for the sender
                      const contactId = supabase ? await resolveContact(supabase, { name: fromName, email: fromEmail, source: 'WEBSITE' }) : null;
                      if (contactId) emailData.contact_id = contactId;

                      if (AI_ANALYSIS_ENABLED) {
                        try {
                          const aiResult = await analyzeWithAI({ subject, body: bodyPreview, from: fromEmail });
                          emailData.category = aiResult.category;
                          emailData.lead_score = aiResult.score;
                          emailData.ai_analysis = aiResult.analysis;
                        } catch { /* AI optional */ }
                      }

                      if (supabase) {
                        const { data: inserted, error: insertErr } = await supabase
                          .from('emails')
                          .insert(emailData)
                          .select('id')
                          .single();
                        if (!insertErr) {
                          newEmails++;
                          // Log to unified interactions table
                          if (contactId && inserted) {
                            await supabase.from('interactions').insert({
                              contact_id: contactId,
                              type: 'EMAIL',
                              direction: 'INBOUND',
                              subject,
                              content: bodyPreview.slice(0, 500),
                              metadata: { email_id: inserted.id, message_id: messageId },
                              timestamp: msgDate,
                            });
                          }
                        } else {
                          // If insert fails (table missing), still count it so localStorage cache works
                          newEmails++;
                        }
                      } else {
                        newEmails++;
                      }
                    }

                    fetchedEmails.push(emailData);
                  } catch (err) {
                    console.error('Error processing message', seqno, err);
                  }
                  processedCount++;
                  tryResolve();
                });
              });

              fetch.once('error', (err: any) => {
                if (!resolved) {
                  resolved = true;
                  imap.end();
                  resolve(res.status(500).json({ success: false, error: err.message }));
                }
              });

              fetch.once('end', () => {
                fetchEnded = true;
                tryResolve();
              });

              // Hard timeout at 55s (under Vercel's 60s limit)
              setTimeout(() => {
                if (!resolved) {
                  resolved = true;
                  imap.end();
                  resolve(res.json({
                    success: true, synced: newEmails, total: totalEmails,
                    processed: processedCount, emails: fetchedEmails, timeout: true,
                    message: `Synced ${newEmails} emails (timeout)`
                  }));
                }
              }, 55000);
            });
          });

          imap.once('error', (err: any) => {
            const msg: string = err.message || String(err);
            let hint = `Tried ${IMAP_HOST}:${IMAP_PORT} with user "${IMAP_USER}". `;
            if (msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('timed out')) {
              hint += 'Connection timed out — verify the host and port are correct. Gmail: imap.gmail.com:993. Outlook: outlook.office365.com:993.';
            } else if (msg.toLowerCase().includes('auth') || msg.toLowerCase().includes('credentials') || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('login')) {
              hint += 'Authentication failed — check your password. Gmail requires an App Password, not your regular password.';
            } else if (msg.toLowerCase().includes('self signed') || msg.toLowerCase().includes('certificate')) {
              hint += 'TLS certificate error — try disabling TLS or use port 143.';
            } else {
              hint += 'Check IMAP credentials and that your email provider allows IMAP access.';
            }
            resolve(res.json({ success: false, error: msg, hint }));
          });

          imap.connect();
        });
      }

      case 'analyze': {
        // Analyze a specific email
        const { emailId } = req.query;
        if (!supabase) {
          return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const { data: email } = await supabase
          .from('emails')
          .select('*')
          .eq('id', emailId as string)
          .single();

        if (!email) {
          return res.status(404).json({ success: false, error: 'Email not found' });
        }

        const analysis = await getPredictiveScore({
          subject: email.subject,
          body: email.body,
          from: email.from_email
        });

        // Update email with new analysis
        await supabase
          .from('emails')
          .update({
            lead_score: analysis.score,
            ai_analysis: analysis,
            updated_at: new Date().toISOString()
          })
          .eq('id', emailId);

        return res.json({ success: true, analysis, email });
      }

      case 'send': {
        // Send email via Resend (get API key from database settings)
        const settings = await getSettings();
        const RESEND_API_KEY = settings['RESEND_API_KEY'] || '';

        if (!RESEND_API_KEY) {
          return res.status(400).json({
            success: false,
            error: 'Resend API key not configured',
            setupUrl: '/settings'
          });
        }

        const { to, subject, body, from, cc, bcc } = req.body;
        const DEFAULT_FROM_EMAIL = settings['DEFAULT_FROM_EMAIL'] || 'sales@saletrail.com';
        const DEFAULT_FROM_NAME = settings['DEFAULT_FROM_NAME'] || 'DHD Sales';

        if (!to || !subject || !body) {
          return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const emailData: any = {
          from: from || `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`,
          to: Array.isArray(to) ? to : [to],
          subject,
          html: body,
          text: body.replace(/<[^>]*>/g, '')
        };

        if (cc) emailData.cc = Array.isArray(cc) ? cc : [cc];
        if (bcc) emailData.bcc = Array.isArray(bcc) ? bcc : [bcc];

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`
          },
          body: JSON.stringify(emailData)
        });

        const data = await response.json();

        if (response.ok) {
          // Save sent email to database
          if (supabase) {
            await supabase.from('emails').insert({
              message_id: data.id,
              from_email: from || 'sales@saletrail.com',
              from_name: 'DHD Sales',
              to_email: Array.isArray(to) ? to.join(', ') : to,
              subject,
              body,
              date: new Date().toISOString(),
              read: true,
              category: 'other',
              lead_score: 50
            });
          }

          return res.json({ success: true, emailId: data.id });
        } else {
          return res.status(400).json({ success: false, error: data.message || 'Failed to send email' });
        }
      }

      case 'reply': {
        // Reply to existing email thread
        const { threadId, replyBody } = req.body;
        if (!supabase) {
          return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        // Get settings from database
        const settings = await getSettings();
        const RESEND_API_KEY = settings['RESEND_API_KEY'] || '';
        const DEFAULT_FROM_EMAIL = settings['DEFAULT_FROM_EMAIL'] || 'sales@saletrail.com';
        const DEFAULT_FROM_NAME = settings['DEFAULT_FROM_NAME'] || 'DHD Sales';

        if (!RESEND_API_KEY) {
          return res.status(400).json({ success: false, error: 'Resend not configured' });
        }

        const { data: threadEmails } = await supabase
          .from('emails')
          .select('*')
          .eq('thread_id', threadId)
          .order('date', { ascending: false })
          .limit(1);

        const originalEmail = threadEmails?.[0];
        if (!originalEmail) {
          return res.status(404).json({ success: false, error: 'Thread not found' });
        }

        // Send via Resend
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`,
            to: [originalEmail.from_email],
            subject: `Re: ${originalEmail.subject}`,
            html: replyBody,
            text: replyBody.replace(/<[^>]*>/g, '')
          })
        });

        const data = await response.json();

        if (response.ok) {
          return res.json({ success: true, emailId: data.id });
        } else {
          return res.status(400).json({ success: false, error: data.message });
        }
      }

      case 'markRead': {
        const { emailId } = req.query;
        if (!supabase) {
          return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        await supabase
          .from('emails')
          .update({ read: true, updated_at: new Date().toISOString() })
          .eq('id', emailId);

        return res.json({ success: true });
      }

      case 'markStarred': {
        const { emailId, starred } = req.query;
        if (!supabase) {
          return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        await supabase
          .from('emails')
          .update({ starred: starred === 'true', updated_at: new Date().toISOString() })
          .eq('id', emailId);

        return res.json({ success: true });
      }

      case 'convertToLead': {
        const { emailId } = req.query;
        if (!supabase) {
          return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const { data: email } = await supabase
          .from('emails')
          .select('*')
          .eq('id', emailId)
          .single();

        if (!email) {
          return res.status(404).json({ success: false, error: 'Email not found' });
        }

        // Mark as converted and boost score
        await supabase
          .from('emails')
          .update({
            converted_to_lead: true,
            lead_score: Math.max(email.lead_score, 70),
            category: 'lead',
            updated_at: new Date().toISOString()
          })
          .eq('id', emailId);

        // Record conversion
        await supabase.from('email_conversions').insert({ email_id: emailId });

        // Insert into leads table (skip if email already exists)
        const { data: existingLead } = await supabase
          .from('leads')
          .select('id')
          .eq('email', email.from_email)
          .maybeSingle();

        const leadName = email.from_name || email.from_email.split('@')[0];

        // Resolve or create master Contact for this sender
        const contactId = supabase ? await resolveContact(supabase, { name: leadName, email: email.from_email, source: 'WEBSITE' }) : null;

        if (contactId) {
          await supabase.from('emails').update({ contact_id: contactId }).eq('id', emailId);
        }

        if (!existingLead) {
          await supabase.from('leads').insert({
            name: leadName,
            email: email.from_email,
            source: 'Email',
            status: 'new',
            notes: `Converted from email: "${email.subject}"`,
            contact_id: contactId ?? null,
          });
        } else if (contactId) {
          await supabase.from('leads').update({ contact_id: contactId }).eq('id', existingLead.id).is('contact_id', null);
        }

        return res.json({
          success: true,
          alreadyExisted: !!existingLead,
          lead: {
            name: leadName,
            email: email.from_email,
            score: Math.max(email.lead_score, 70),
            source: 'Email'
          }
        });
      }

      case 'stats': {
        if (!supabase) {
          return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const { count: total } = await supabase
          .from('emails')
          .select('*', { count: 'exact', head: true });

        const { count: unread } = await supabase
          .from('emails')
          .select('*', { count: 'exact', head: true })
          .eq('read', false);

        const { count: hotLeads } = await supabase
          .from('emails')
          .select('*', { count: 'exact', head: true })
          .eq('category', 'lead')
          .gte('lead_score', 80);

        const { count: warmLeads } = await supabase
          .from('emails')
          .select('*', { count: 'exact', head: true })
          .eq('category', 'lead')
          .gte('lead_score', 50)
          .lt('lead_score', 80);

        const { count: coldLeads } = await supabase
          .from('emails')
          .select('*', { count: 'exact', head: true })
          .eq('category', 'lead')
          .lt('lead_score', 50);

        const { data: allEmails } = await supabase
          .from('emails')
          .select('lead_score');

        const avgScore = allEmails && allEmails.length > 0
          ? Math.round(allEmails.reduce((sum, e) => sum + e.lead_score, 0) / allEmails.length)
          : 0;

        return res.json({
          success: true,
          stats: {
            total: total || 0,
            unread: unread || 0,
            hotLeads: hotLeads || 0,
            warmLeads: warmLeads || 0,
            coldLeads: coldLeads || 0,
            avgScore
          }
        });
      }

      case 'aiSuggest': {
        // Accept email content from request body (POST) so it works for
        // both DB-stored emails and locally-cached / demo emails
        const posted = req.body || {};
        const fromName  = posted.fromName  || '';
        const fromEmail = posted.fromEmail || '';
        const subject   = posted.subject   || '(No subject)';
        const body      = (posted.body     || '').slice(0, 2000);
        const aiAnalysis = posted.aiAnalysis || {};

        // If content wasn't posted, fall back to DB lookup
        let emailContent = { fromName, fromEmail, subject, body, aiAnalysis };
        if (!body && supabase && posted.emailId) {
          const { data: dbEmail } = await supabase
            .from('emails')
            .select('from_name, from_email, subject, body, ai_analysis')
            .eq('id', posted.emailId)
            .single();
          if (dbEmail) {
            emailContent = {
              fromName:   dbEmail.from_name  || '',
              fromEmail:  dbEmail.from_email || '',
              subject:    dbEmail.subject    || '(No subject)',
              body:       (dbEmail.body      || '').slice(0, 2000),
              aiAnalysis: dbEmail.ai_analysis || {},
            };
          }
        }

        try {
          const suggestion = await callOpenAI([{
            role: 'system',
            content: `You are a sales assistant for Dirty Hand Designs, a Jamaican branding and design company in Kingston.
Generate a professional, friendly, concise email reply in the first person. Warm but businesslike tone.
Context from AI analysis: ${JSON.stringify(emailContent.aiAnalysis)}
Return ONLY the email body text — no subject line, no "Here is a draft:" preamble.`
          }, {
            role: 'user',
            content: `Original Email:\nFrom: ${emailContent.fromName || emailContent.fromEmail}\nSubject: ${emailContent.subject}\n\nBody:\n${emailContent.body}\n\nGenerate a reply:`
          }]);

          return res.json({ success: true, suggestion });
        } catch (err: any) {
          return res.json({ success: false, error: err.message || 'AI suggestion failed' });
        }
      }

      case 'templates': {
        // Get email templates
        if (!supabase) {
          return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const { data: templates } = await supabase
          .from('email_templates')
          .select('*')
          .order('usage_count', { ascending: false });

        return res.json({ success: true, templates: templates || [] });
      }

      case 'useTemplate': {
        // Use a template
        const { templateId, variables } = req.body;
        if (!supabase) {
          return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const { data: template } = await supabase
          .from('email_templates')
          .select('*')
          .eq('id', templateId)
          .single();

        if (!template) {
          return res.status(404).json({ success: false, error: 'Template not found' });
        }

        // Replace variables
        let subject = template.subject_template || '';
        let body = template.body_template || '';

        Object.entries(variables || {}).forEach(([key, value]) => {
          subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value as string);
          body = body.replace(new RegExp(`{{${key}}}`, 'g'), value as string);
        });

        // Increment usage
        await supabase
          .from('email_templates')
          .update({ usage_count: (template.usage_count || 0) + 1 })
          .eq('id', templateId);

        return res.json({ success: true, subject, body });
      }

      case 'import': {
        // Import demo emails for testing
        const { emails } = req.body;

        if (!supabase) {
          return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        if (!emails || !Array.isArray(emails)) {
          return res.status(400).json({ success: false, error: 'Invalid emails data' });
        }

        // Analyze each email and insert
        const insertPromises = emails.map(async (email: any) => {
          const aiResult = await analyzeWithAI({
            subject: email.subject,
            body: email.body,
            from: email.from
          });

          return supabase.from('emails').insert({
            from_email: email.from,
            from_name: email.fromName || email.from.split('@')[0],
            to_email: email.to || 'sales@saletrail.com',
            subject: email.subject,
            body: email.body,
            date: email.date || new Date().toISOString(),
            read: false,
            starred: false,
            category: aiResult.category,
            lead_score: aiResult.score,
            ai_analysis: aiResult.analysis,
            thread_id: email.thread_id || null,
            is_part_of_thread: !!email.thread_id
          });
        });

        await Promise.all(insertPromises);

        return res.json({ success: true, imported: emails.length });
      }

      case 'delete': {
        const { emailId } = req.query;
        if (!supabase) {
          return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        await supabase.from('emails').delete().eq('id', emailId);
        return res.json({ success: true });
      }

      case 'predictive': {
        // Get predictive insights
        if (!supabase) {
          return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        // Get top leads
        const { data: topLeads } = await supabase
          .from('emails')
          .select('*')
          .eq('category', 'lead')
          .gte('lead_score', 70)
          .order('lead_score', { ascending: false })
          .limit(5);

        // Get conversion stats
        const { data: conversions } = await supabase
          .from('email_conversions')
          .select('*')
          .order('converted_at', { ascending: false })
          .limit(30);

        const avgDealValue = conversions && conversions.length > 0
          ? conversions.reduce((sum, c) => sum + (c.deal_value || 0), 0) / conversions.length
          : 0;

        return res.json({
          success: true,
          insights: {
            topLeads: topLeads || [],
            conversionRate: conversions ? (conversions.length / 30 * 100).toFixed(1) + '%' : 'N/A',
            avgDealValue: `$${avgDealValue.toFixed(0)}`,
            recommendations: [
              'Focus on leads with score 80+ for immediate follow-up',
              'Best days to contact: Tuesday, Wednesday, Thursday',
              'Include budget mentions in initial outreach for higher conversion'
            ]
          }
        });
      }

      default:
        return res.status(400).json({
          success: false,
          error: 'Unknown action',
          available: ['list', 'threads', 'thread', 'sync', 'analyze', 'send', 'reply', 'markRead', 'markStarred', 'convertToLead', 'stats', 'aiSuggest', 'templates', 'useTemplate', 'oauthUrl', 'predictive']
        });
    }
  } catch (err: any) {
    console.error('Email API Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}