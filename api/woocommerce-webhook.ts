import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

// Self-contained Supabase client — does NOT import from src/lib/supabase (Vite-only)
const _supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL || '';
const _supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = _supabaseUrl && _supabaseKey ? createClient(_supabaseUrl, _supabaseKey) : null;

const WC_WEBHOOK_SECRET = process.env.WC_WEBHOOK_SECRET || '';

function verifySignature(body: string, signature: string): boolean {
  if (!WC_WEBHOOK_SECRET) return true; // skip verification if secret not set
  const expected = createHmac('sha256', WC_WEBHOOK_SECRET)
    .update(body, 'utf8')
    .digest('base64');
  return expected === signature;
}

const stageMap: Record<string, string> = {
  pending: 'New Lead',
  processing: 'Quote Sent',
  'on-hold': 'Consultation',
  completed: 'Delivered',
  cancelled: 'Lost',
  refunded: 'Lost',
  failed: 'Lost'
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // WooCommerce only sends POST webhooks
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify HMAC signature if secret is configured
  const signature = req.headers['x-wc-webhook-signature'] as string || '';
  const rawBody = JSON.stringify(req.body);
  if (signature && !verifySignature(rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const topic = req.headers['x-wc-webhook-topic'] as string || '';
  const order = req.body;

  if (!order || !order.id) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  // Only handle order topics
  if (!topic.startsWith('order.')) {
    return res.status(200).json({ ok: true, skipped: true });
  }

  const mapped = {
    wc_order_id: order.id,
    order_number: String(order.number || order.id),
    status: order.status || 'pending',
    pipeline_stage: stageMap[order.status] || 'New Lead',
    customer_name: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
    customer_email: order.billing?.email || '',
    customer_phone: order.billing?.phone || '',
    company: order.billing?.company || '',
    address: `${order.billing?.address_1 || ''} ${order.billing?.city || ''}, ${order.billing?.state || ''}`.trim(),
    total: parseFloat(order.total || '0'),
    currency: order.currency || 'JMD',
    line_items: JSON.stringify(
      (order.line_items || []).map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price || '0'),
        total: parseFloat(item.total || '0')
      }))
    ),
    payment_method: order.payment_method_title || '',
    customer_note: order.customer_note || '',
    date_created: order.date_created || new Date().toISOString(),
    date_modified: order.date_modified || new Date().toISOString(),
    raw: order
  };

  if (!supabase) {
    console.error('WooCommerce webhook: Supabase not configured');
    return res.status(200).json({ ok: true, note: 'supabase not configured' });
  }

  if (topic === 'order.created') {
    const { error } = await supabase
      .from('woocommerce_orders')
      .upsert(mapped, { onConflict: 'wc_order_id', ignoreDuplicates: false });

    if (error) {
      console.error('WooCommerce webhook insert error:', error);
      return res.status(500).json({ error: error.message });
    }
  } else if (topic === 'order.updated') {
    const { error } = await supabase
      .from('woocommerce_orders')
      .upsert(mapped, { onConflict: 'wc_order_id', ignoreDuplicates: false });

    if (error) {
      console.error('WooCommerce webhook update error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(200).json({ ok: true, topic, orderId: order.id });
}
