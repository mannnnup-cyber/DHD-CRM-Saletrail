import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const _url = process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL || '';
const _key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = _url && _key ? createClient(_url, _key) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  // ── GET /api/tasks — list tasks ──────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, description, due_date, completed, priority, contact_id, assigned_to, created_at')
      .order('completed', { ascending: true })
      .order('due_date', { ascending: true })
      .limit(500);

    if (error) return res.status(500).json({ error: error.message });

    // Batch-resolve contact names and rep names
    const contactIds = [...new Set((data || []).map((t: any) => t.contact_id).filter(Boolean))];
    const repIds     = [...new Set((data || []).map((t: any) => t.assigned_to).filter(Boolean))];

    const [contactsRes, repsRes] = await Promise.all([
      contactIds.length > 0
        ? supabase.from('contacts').select('id, name').in('id', contactIds)
        : Promise.resolve({ data: [] }),
      repIds.length > 0
        ? supabase.from('user_profiles').select('id, name').in('id', repIds)
        : Promise.resolve({ data: [] }),
    ]);

    const contactMap = Object.fromEntries((contactsRes.data || []).map((c: any) => [c.id, c.name]));
    const repMap     = Object.fromEntries((repsRes.data     || []).map((r: any) => [r.id, r.name]));

    return res.json({
      success: true,
      tasks: (data || []).map((t: any) => ({
        ...t,
        contact_name:  t.contact_id  ? (contactMap[t.contact_id]  ?? null) : null,
        assigned_name: t.assigned_to ? (repMap[t.assigned_to]     ?? null) : null,
      })),
    });
  }

  // ── POST /api/tasks — create task ────────────────────────────────────────
  if (req.method === 'POST') {
    const { title, description, due_date, priority, contact_id, assigned_to } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ error: 'title required' });

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        due_date: due_date || null,
        priority: priority || 'medium',
        completed: false,
        contact_id: contact_id || null,
        assigned_to: assigned_to || null,
      })
      .select('id, title, description, due_date, completed, priority, contact_id, assigned_to, created_at')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, task: { ...data, contact_name: null, assigned_name: null } });
  }

  // ── PATCH /api/tasks — update task ───────────────────────────────────────
  if (req.method === 'PATCH') {
    const { id, completed, title, description, due_date, priority } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (completed !== undefined) updates.completed = completed;
    if (title     !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (due_date  !== undefined) updates.due_date = due_date;
    if (priority  !== undefined) updates.priority = priority;

    const { error } = await supabase.from('tasks').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
