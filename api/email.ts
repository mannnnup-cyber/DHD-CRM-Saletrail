import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import Imap from 'imap';
import { simpleParser } from 'mailparser';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_PROJECT_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || '';

// IMAP Configuration
const IMAP_HOST = process.env.IMAP_HOST || '';
const IMAP_PORT = parseInt(process.env.IMAP_PORT || '993');
const IMAP_USER = process.env.IMAP_USER || '';
const IMAP_PASSWORD = process.env.IMAP_PASSWORD || '';
const IMAP_USE_TLS = process.env.IMAP_USE_TLS !== 'false';

const supabase = SUPABASE_URL ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

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
  if (!OPENAI_API_KEY) {
    return {
      score: 50,
      category: 'other',
      analysis: {
        intent: 'Unknown',
        sentiment: 'Neutral',
        urgency: 'Normal',
        keyPoints: ['Email needs manual review'],
        suggestedAction: 'Review email manually'
      }
    };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
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
        }],
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

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

        if (error) throw error;

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
        // Sync emails from IMAP mailbox
        if (!IMAP_HOST || !IMAP_USER || !IMAP_PASSWORD) {
          return res.json({
            success: false,
            error: 'IMAP not configured',
            message: 'Add IMAP credentials to Vercel env vars:',
            required: ['IMAP_HOST', 'IMAP_USER', 'IMAP_PASSWORD'],
            optional: ['IMAP_PORT (default: 993)', 'IMAP_USE_TLS (default: true)'],
            example: 'imap.gmail.com,993,your-email@gmail.com,app-password'
          });
        }

        if (!supabase) {
          return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        return new Promise((resolve) => {
          const imap = new Imap({
            user: IMAP_USER,
            password: IMAP_PASSWORD,
            host: IMAP_HOST,
            port: IMAP_PORT,
            tls: IMAP_USE_TLS,
            tlsOptions: { rejectUnauthorized: false }
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

              // Fetch last 50 emails (most recent)
              const fetchRange = Math.max(1, totalEmails - 49);
              const fetch = imap.seq.fetch(`${fetchRange}:*`, {
                bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID REFERENCES IN-REPLY-TO)',
                struct: true
              });

              let processedCount = 0;
              let newEmails = 0;

              fetch.on('message', (msg, seqno) => {
                const headers: any = {};
                let bodyPreview = '';
                let messageId = '';
                let inReplyTo = '';
                let references = '';

                msg.on('headers', (h) => {
                  headers.from = h.from?.[0] || '';
                  headers.to = h.to?.[0] || '';
                  headers.subject = h.subject?.[0] || 'No Subject';
                  headers.date = h.date?.[0] || new Date().toISOString();
                  messageId = h['message-id']?.[0] || `local-${seqno}`;
                  inReplyTo = h['in-reply-to']?.[0] || '';
                  references = h.references?.[0] || '';
                });

                msg.on('body', (stream, info) => {
                  let buffer = '';
                  stream.on('data', (chunk) => {
                    buffer += chunk.toString('utf8');
                    if (buffer.length > 50000) {
                      stream.destroy();
                    }
                  });
                  stream.once('end', async () => {
                    try {
                      const parsed = await simpleParser(buffer);
                      bodyPreview = parsed.text?.slice(0, 5000) || parsed.html?.replace(/<[^>]*>/g, '').slice(0, 5000) || '';

                      // Extract email addresses
                      const fromMatch = headers.from.match(/<([^>]+)>/);
                      const fromEmail = fromMatch ? fromMatch[1] : headers.from.replace(/.*<([^>]+)>.*/, '$1');
                      const fromName = headers.from.replace(/<[^>]+>/, '').trim() || fromEmail.split('@')[0];

                      const toMatch = headers.to.match(/<([^>]+)>/);
                      const toEmail = toMatch ? toMatch[1] : headers.to.replace(/.*<([^>]+)>.*/, '$1');

                      // Determine thread_id (use message-id or in-reply-to or generate from references)
                      let threadId = messageId;
                      if (!threadId && inReplyTo) {
                        threadId = inReplyTo.trim();
                      }
                      if (!threadId && references) {
                        const refArray = references.trim().split(/\s+/);
                        threadId = refArray[refArray.length - 1];
                      }
                      if (!threadId) {
                        threadId = `thread-${fromEmail}-${headers.subject}`.replace(/\s+/g, '-');
                      }

                      const emailData = {
                        message_id: messageId,
                        thread_id: threadId,
                        from_email: fromEmail,
                        from_name: fromName,
                        to_email: toEmail,
                        subject: headers.subject,
                        body: bodyPreview,
                        date: new Date(headers.date).toISOString(),
                        read: info.which !== '\\Seen',
                        starred: false,
                        category: 'other' as const,
                        lead_score: 50,
                        source: 'IMAP'
                      };

                      // Check if email already exists
                      const { data: existing } = await supabase
                        .from('emails')
                        .select('id')
                        .eq('message_id', messageId)
                        .single();

                      if (!existing) {
                        // AI analysis
                        const aiResult = await analyzeWithAI({
                          subject: headers.subject,
                          body: bodyPreview,
                          from: fromEmail
                        });

                        emailData.category = aiResult.category as any;
                        emailData.lead_score = aiResult.score;
                        emailData.ai_analysis = aiResult.analysis;

                        const { error } = await supabase.from('emails').insert(emailData);
                        if (!error) newEmails++;
                      }

                      fetchedEmails.push(emailData);
                      processedCount++;

                      if (processedCount === (fetch as any)._messages?.length || processedCount >= 50) {
                        imap.end();
                        resolve(res.json({
                          success: true,
                          synced: newEmails,
                          total: totalEmails,
                          processed: processedCount,
                          message: `Synced ${newEmails} new emails`
                        }));
                      }
                    } catch (parseErr) {
                      processedCount++;
                      if (processedCount >= 50) {
                        imap.end();
                        resolve(res.json({
                          success: true,
                          synced: newEmails,
                          total: totalEmails,
                          processed: processedCount
                        }));
                      }
                    }
                  });
                });
              });

              fetch.once('error', (err) => {
                imap.end();
                resolve(res.status(500).json({ success: false, error: err.message }));
              });

              fetch.once('end', () => {
                if (processedCount === 0) {
                  imap.end();
                  resolve(res.json({ success: true, synced: 0, total: totalEmails }));
                }
              });

              // Timeout after 60 seconds
              setTimeout(() => {
                imap.end();
                resolve(res.json({
                  success: true,
                  synced: newEmails,
                  total: totalEmails,
                  processed: processedCount,
                  timeout: true
                }));
              }, 60000);
            });
          });

          imap.once('error', (err) => {
            resolve(res.status(500).json({
              success: false,
              error: err.message,
              hint: 'Check IMAP credentials and firewall settings'
            }));
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
        // Send email via Resend
        if (!RESEND_API_KEY) {
          return res.status(400).json({
            success: false,
            error: 'Resend API key not configured'
          });
        }

        const { to, subject, body, from, cc, bcc } = req.body;

        if (!to || !subject || !body) {
          return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const emailData: any = {
          from: from || 'DHD Sales <sales@saletrail.com>',
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
        if (!RESEND_API_KEY) {
          return res.status(400).json({ success: false, error: 'Resend not configured' });
        }

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: 'DHD Sales <sales@saletrail.com>',
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
        await supabase.from('email_conversions').insert({
          email_id: emailId
        });

        return res.json({
          success: true,
          lead: {
            name: email.from_name || email.from_email.split('@')[0],
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
        const { emailId } = req.query;
        if (!supabase || !OPENAI_API_KEY) {
          return res.json({
            success: false,
            suggestion: 'Connect OpenAI API for AI suggestions'
          });
        }

        const { data: email } = await supabase
          .from('emails')
          .select('*')
          .eq('id', emailId)
          .single();

        if (!email) {
          return res.status(404).json({ success: false, error: 'Email not found' });
        }

        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [{
                role: 'system',
                content: `You are a sales assistant for Dirty Hand Designs, a branding and design company.
Generate a professional, friendly email reply. Keep it concise, warm, and professional.
Consider the AI analysis: ${JSON.stringify(email.ai_analysis || {})}
Return ONLY the email body text.`
              }, {
                role: 'user',
                content: `Original Email:\nFrom: ${email.from_name || email.from_email}\nSubject: ${email.subject}\n\nBody:\n${email.body}\n\nGenerate a reply:`
              }]
            })
          });

          const data = await response.json();
          const suggestion = data.choices?.[0]?.message?.content || '';

          return res.json({ success: true, suggestion });
        } catch (error) {
          return res.json({ success: false, error: 'AI suggestion failed' });
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