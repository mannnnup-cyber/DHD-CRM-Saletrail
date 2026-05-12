import { createClient } from '@supabase/supabase-js';

const _url = process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL || '';
const _key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = _url && _key ? createClient(_url, _key) : null;

export function normalizePhone(raw: string): string {
  if (!raw) return '';
  return raw.replace(/[^\d+]/g, '').replace(/^\+/, '');
}

export async function resolveContact(opts: {
  name: string;
  email?: string;
  phone?: string;
  source: 'MANUAL' | 'WOOCOMMERCE' | 'CSV_IMPORT' | 'WHATSAPP' | 'WEBSITE';
  company?: string;
  notes?: string;
}): Promise<{ id: string; created: boolean } | null> {
  if (!supabase) return null;

  const emailLower = opts.email?.toLowerCase().trim() || '';
  const phoneNorm = normalizePhone(opts.phone || '');

  if (emailLower) {
    const { data } = await supabase
      .from('contacts')
      .select('id')
      .ilike('email', emailLower)
      .limit(1)
      .single();
    if (data) return { id: data.id, created: false };
  }

  if (phoneNorm) {
    const { data } = await supabase
      .from('contacts')
      .select('id')
      .eq('phone_normalized', phoneNorm)
      .limit(1)
      .single();
    if (data) return { id: data.id, created: false };
  }

  const { data: created, error } = await supabase
    .from('contacts')
    .insert({
      name: opts.name || 'Unknown',
      email: emailLower || null,
      phone: opts.phone || null,
      phone_normalized: phoneNorm || null,
      company: opts.company || null,
      source: opts.source,
      notes: opts.notes || null,
      status: 'NEW',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[resolveContact] insert failed:', error);
    return null;
  }

  return { id: created.id, created: true };
}
