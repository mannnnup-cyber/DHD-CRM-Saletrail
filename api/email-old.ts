import type { VercelRequest, VercelResponse } from '@vercel/node';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

interface Email {
  id: string;
  from: string;
  fromName: string;
  to: string;
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

interface LeadAnalysis {
  score: number;
  category: 'lead' | 'support' | 'newsletter' | 'other';
  analysis: {
    intent: string;
    sentiment: string;
    urgency: string;
    keyPoints: string[];
    suggestedAction: string;
  };
}

// In-memory store for demo (in production, use Supabase)
const emailStore: Email[] = [];

// Analyze email with AI
async function analyzeWithAI(email: { subject: string; body: string; from: string }): Promise<LeadAnalysis> {
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
          content: `Analyze this email:\n\nFrom: ${email.from}\nSubject: ${email.subject}\n\nBody:\n${email.body.slice(0, 1000)}`
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

  // Fallback analysis without AI
  const text = `${email.subject} ${email.body}`.toLowerCase();
  let score = 50;
  let category: 'lead' | 'support' | 'newsletter' | 'other' = 'other';

  // Lead indicators
  if (text.includes('quote') || text.includes('pricing') || text.includes('cost')) score += 15;
  if (text.includes('budget') || text.includes('$') || text.includes('payment')) score += 15;
  if (text.includes('timeline') || text.includes('deadline') || text.includes('urgent')) score += 10;
  if (text.includes('meeting') || text.includes('call') || text.includes('demo')) score += 10;
  if (text.includes('interested') || text.includes('purchase') || text.includes('buy')) score += 15;

  // Low score indicators
  if (text.includes('unsubscribe') || text.includes('newsletter') || text.includes('update')) {
    score -= 30;
    category = 'newsletter';
  }
  if (text.includes('help') || text.includes('support') || text.includes('issue')) {
    score -= 10;
    category = 'support';
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    category: score > 60 ? 'lead' : category,
    analysis: {
      intent: 'Analyze for keywords...',
      sentiment: 'Neutral',
      urgency: text.includes('urgent') || text.includes('asap') ? 'High' : 'Normal',
      keyPoints: [],
      suggestedAction: 'Review and respond'
    }
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
        // Return all emails sorted by date
        const emails = emailStore
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .map(e => ({
            ...e,
            aiAnalysis: e.aiAnalysis ? {
              ...e.aiAnalysis,
              keyPoints: e.aiAnalysis.keyPoints || []
            } : null
          }));
        return res.json({ success: true, emails });
      }

      case 'analyze': {
        // Analyze a specific email
        const { emailId } = req.query;
        const email = emailStore.find(e => e.id === emailId);

        if (!email) {
          return res.status(404).json({ success: false, error: 'Email not found' });
        }

        const analysis = await analyzeWithAI({
          subject: email.subject,
          body: email.body,
          from: email.from
        });

        email.leadScore = analysis.score;
        email.category = analysis.category;
        email.aiAnalysis = analysis.analysis;

        return res.json({ success: true, analysis, email });
      }

      case 'send': {
        // Send email via Resend
        if (!RESEND_API_KEY) {
          return res.status(400).json({
            success: false,
            error: 'Resend API key not configured',
            message: 'Please add RESEND_API_KEY to Vercel environment variables'
          });
        }

        const { to, subject, body, from } = req.body;

        if (!to || !subject || !body) {
          return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: from || 'DHD Sales <sales@saletrail.com>',
            to: [to],
            subject,
            html: body,
            text: body.replace(/<[^>]*>/g, '')
          })
        });

        const data = await response.json();

        if (response.ok) {
          return res.json({ success: true, emailId: data.id });
        } else {
          return res.status(400).json({ success: false, error: data.message || 'Failed to send email' });
        }
      }

      case 'reply': {
        // Reply to existing email thread
        const { emailId, replyBody } = req.body;
        const originalEmail = emailStore.find(e => e.id === emailId);

        if (!originalEmail) {
          return res.status(404).json({ success: false, error: 'Original email not found' });
        }

        // Extract original sender's email
        const recipient = originalEmail.from;

        if (!RESEND_API_KEY) {
          return res.status(400).json({
            success: false,
            error: 'Resend API key not configured'
          });
        }

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: 'DHD Sales <sales@saletrail.com>',
            to: [recipient],
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

      case 'import': {
        // Import emails (demo - in production would connect to Gmail API)
        const { emails } = req.body;

        for (const emailData of emails) {
          const analysis = await analyzeWithAI({
            subject: emailData.subject,
            body: emailData.body,
            from: emailData.from
          });

          const email: Email = {
            id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            from: emailData.from,
            fromName: emailData.fromName || emailData.from.split('@')[0],
            to: emailData.to || 'sales@saletrail.com',
            subject: emailData.subject,
            body: emailData.body,
            date: emailData.date || new Date().toISOString(),
            read: false,
            starred: false,
            category: analysis.category,
            leadScore: analysis.score,
            aiAnalysis: analysis.analysis
          };

          emailStore.push(email);
        }

        return res.json({ success: true, imported: emails.length });
      }

      case 'markRead': {
        const { emailId } = req.query;
        const email = emailStore.find(e => e.id === emailId);
        if (email) {
          email.read = true;
          return res.json({ success: true });
        }
        return res.status(404).json({ success: false, error: 'Email not found' });
      }

      case 'markStarred': {
        const { emailId, starred } = req.query;
        const email = emailStore.find(e => e.id === emailId);
        if (email) {
          email.starred = starred === 'true';
          return res.json({ success: true });
        }
        return res.status(404).json({ success: false, error: 'Email not found' });
      }

      case 'delete': {
        const { emailId } = req.query;
        const index = emailStore.findIndex(e => e.id === emailId);
        if (index > -1) {
          emailStore.splice(index, 1);
          return res.json({ success: true });
        }
        return res.status(404).json({ success: false, error: 'Email not found' });
      }

      case 'stats': {
        const totalEmails = emailStore.length;
        const unreadEmails = emailStore.filter(e => !e.read).length;
        const hotLeads = emailStore.filter(e => e.leadScore >= 80).length;
        const warmLeads = emailStore.filter(e => e.leadScore >= 50 && e.leadScore < 80).length;
        const coldLeads = emailStore.filter(e => e.leadScore < 50).length;

        return res.json({
          success: true,
          stats: {
            total: totalEmails,
            unread: unreadEmails,
            hotLeads,
            warmLeads,
            coldLeads,
            avgScore: totalEmails > 0
              ? Math.round(emailStore.reduce((sum, e) => sum + e.leadScore, 0) / totalEmails)
              : 0
          }
        });
      }

      case 'aiSuggest': {
        // Get AI suggestion for replying to an email
        const { emailId } = req.query;
        const email = emailStore.find(e => e.id === emailId);

        if (!email || !OPENAI_API_KEY) {
          return res.json({
            success: false,
            suggestion: 'Please connect OpenAI API for AI suggestions'
          });
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
Generate a professional, friendly email reply based on the original email. Keep it concise, warm, and professional.
Return ONLY the email body (HTML format acceptable).`
              }, {
                role: 'user',
                content: `Original Email:\nFrom: ${email.from}\nSubject: ${email.subject}\n\nBody:\n${email.body}\n\nAI Analysis:\nIntent: ${email.aiAnalysis?.intent || 'Unknown'}\nSentiment: ${email.aiAnalysis?.sentiment || 'Neutral'}\n\nGenerate a reply:`
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

      case 'convertToLead': {
        // Convert email to lead in database
        const { emailId } = req.query;
        const email = emailStore.find(e => e.id === emailId);

        if (!email) {
          return res.status(404).json({ success: false, error: 'Email not found' });
        }

        // Mark as lead and update score
        email.category = 'lead';
        if (email.leadScore < 70) {
          email.leadScore = 70;
        }

        return res.json({
          success: true,
          message: 'Email converted to lead',
          lead: {
            name: email.fromName,
            email: email.from,
            score: email.leadScore,
            source: 'Email'
          }
        });
      }

      default:
        return res.status(400).json({
          success: false,
          error: 'Unknown action',
          available: ['list', 'analyze', 'send', 'reply', 'import', 'markRead', 'markStarred', 'delete', 'stats', 'aiSuggest', 'convertToLead']
        });
    }
  } catch (err: any) {
    console.error('Email API Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
