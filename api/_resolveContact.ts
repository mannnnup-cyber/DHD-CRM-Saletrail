/**
 * Shared contact resolution utility — cross-channel deduplication with enrichment.
 *
 * Used by whatsapp.ts, email.ts, woocommerce.ts, and contacts.ts so that
 * a phone number arriving via WhatsApp and an email arriving via WooCommerce
 * collapse into the same contact record rather than creating duplicates.
 */

export interface ResolveOpts {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  source: string;
}

/**
 * Normalize to last 10 digits — collapses country-code drift between channels.
 * e.g. "+1 (876) 123-4567", "18761234567", "8761234567" → "8761234567"
 */
export function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/[^\d]/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * Find-or-create a contact by email OR phone (single round-trip OR query).
 * On match, enriches the existing record with any previously-missing fields.
 * Returns the contact UUID, or null on error.
 */
export async function resolveContact(sb: any, opts: ResolveOpts): Promise<string | null> {
  const emailLower = (opts.email || '').toLowerCase().trim();
  const phoneNorm  = normalizePhone(opts.phone || '');

  const filters: string[] = [];
  if (emailLower) filters.push(`email.ilike.${emailLower}`);
  if (phoneNorm)  filters.push(`phone_normalized.eq.${phoneNorm}`);

  if (filters.length > 0) {
    const { data: existing } = await sb
      .from('contacts')
      .select('id, email, phone, phone_normalized, company')
      .or(filters.join(','))
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Enrich: fill in fields that were null on the existing record
      const updates: Record<string, any> = {};
      if (emailLower && !existing.email)            updates.email = emailLower;
      if (phoneNorm  && !existing.phone_normalized) {
        updates.phone_normalized = phoneNorm;
        if (opts.phone) updates.phone = opts.phone;
      }
      if (opts.company && !existing.company)        updates.company = opts.company;
      if (Object.keys(updates).length > 0) {
        await sb.from('contacts').update(updates).eq('id', existing.id);
      }
      return existing.id;
    }
  }

  // No match — create new contact
  const { data, error } = await sb
    .from('contacts')
    .insert({
      name:             opts.name    || 'Unknown',
      email:            emailLower   || null,
      phone:            opts.phone   || null,
      phone_normalized: phoneNorm    || null,
      company:          opts.company || null,
      source:           opts.source,
      status:           'NEW',
    })
    .select('id')
    .single();

  if (error) {
    console.error(`[resolveContact] insert error (source=${opts.source}):`, error.message);
    return null;
  }
  return data.id;
}
