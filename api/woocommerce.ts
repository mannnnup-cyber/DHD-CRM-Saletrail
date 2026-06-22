import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveContact } from './_resolveContact';

const _url = process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL || '';
const _key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = _url && _key ? createClient(_url, _key) : null;

// Credentials come from env vars only — never from query params
const WC_API_BASE = process.env.WC_STORE_URL || '';
const WC_CONSUMER_KEY = process.env.WC_CONSUMER_KEY || '';
const WC_CONSUMER_SECRET = process.env.WC_CONSUMER_SECRET || '';

function wcHeaders() {
  const credentials = Buffer.from(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`).toString('base64');
  return {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json'
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Return config status so frontend knows if env vars are set
  if (req.query.action === 'configured') {
    return res.json({
      success: true,
      configured: !!(WC_API_BASE && WC_CONSUMER_KEY && WC_CONSUMER_SECRET),
      storeUrl: WC_API_BASE || null
    });
  }

  if (!WC_API_BASE || !WC_CONSUMER_KEY || !WC_CONSUMER_SECRET) {
    return res.status(400).json({
      success: false,
      error: 'WooCommerce credentials not configured. Add WC_STORE_URL, WC_CONSUMER_KEY, WC_CONSUMER_SECRET to Vercel environment variables.'
    });
  }

  const action = req.query.action as string;

  try {
    switch (action) {

      case 'test': {
        const r = await fetch(`${WC_API_BASE}/wp-json/wc/v3/system_status`, { headers: wcHeaders() });
        if (!r.ok) {
          return res.status(r.status).json({ success: false, error: `WooCommerce API error: ${r.status} ${r.statusText}` });
        }
        const data = await r.json();
        return res.json({
          success: true,
          store: {
            name: data.settings?.general?.blogname || 'Dirty Hand Designs',
            url: WC_API_BASE,
            version: data.environment?.version || 'Unknown',
            currency: data.settings?.currency?.value || 'JMD'
          }
        });
      }

      case 'orders': {
        const page = Number(req.query.page) || 1;
        const perPage = Number(req.query.per_page) || 50;
        const status = String(req.query.status || 'any');
        const after  = req.query.after  ? `&after=${encodeURIComponent(String(req.query.after))}`   : '';
        const before = req.query.before ? `&before=${encodeURIComponent(String(req.query.before))}` : '';
        const r = await fetch(
          `${WC_API_BASE}/wp-json/wc/v3/orders?page=${page}&per_page=${perPage}&status=${encodeURIComponent(status)}&orderby=date&order=desc${after}${before}`,
          { headers: wcHeaders() }
        );
        if (!r.ok) return res.status(r.status).json({ success: false, error: `Failed to fetch orders: ${r.status}` });

        const orders = await r.json();
        const totalOrders = parseInt(r.headers.get('X-WP-Total') || '0', 10);
        const totalPages = parseInt(r.headers.get('X-WP-TotalPages') || '1', 10);

        const stageMap: Record<string, string> = {
          pending: 'New Lead', processing: 'Quote Sent', 'on-hold': 'Consultation',
          completed: 'Delivered', cancelled: 'Lost', refunded: 'Lost', failed: 'Lost'
        };

        const mapped = orders.map((o: any) => ({
          id: `wc_${o.id}`,
          orderId: o.id,
          orderNumber: o.number || o.id,
          status: o.status,
          pipelineStage: stageMap[o.status] || 'New Lead',
          customerName: `${o.billing?.first_name || ''} ${o.billing?.last_name || ''}`.trim(),
          customerEmail: o.billing?.email || '',
          customerPhone: o.billing?.phone || '',
          company: o.billing?.company || '',
          address: `${o.billing?.address_1 || ''} ${o.billing?.city || ''}, ${o.billing?.state || ''}`.trim(),
          total: parseFloat(o.total || '0'),
          currency: o.currency || 'JMD',
          lineItems: (o.line_items || []).map((item: any) => ({
            name: item.name, quantity: item.quantity,
            price: parseFloat(item.price || '0'), total: parseFloat(item.total || '0')
          })),
          dateCreated: o.date_created,
          dateModified: o.date_modified,
          paymentMethod: o.payment_method_title || '',
          notes: o.customer_note || ''
        }));

        return res.json({ success: true, total: totalOrders, pages: totalPages, orders: mapped });
      }

      case 'customers': {
        const page = Number(req.query.page) || 1;
        const perPage = Number(req.query.per_page) || 50;
        const r = await fetch(
          `${WC_API_BASE}/wp-json/wc/v3/customers?page=${page}&per_page=${perPage}&orderby=registered_date&order=desc`,
          { headers: wcHeaders() }
        );
        if (!r.ok) return res.status(r.status).json({ success: false, error: `Failed to fetch customers: ${r.status}` });

        const customers = await r.json();
        const totalCustomers = parseInt(r.headers.get('X-WP-Total') || '0', 10);
        const totalCustomerPages = parseInt(r.headers.get('X-WP-TotalPages') || '1', 10);

        const mapped = customers.map((c: any) => ({
          id: `wc_customer_${c.id}`,
          wcId: c.id,
          name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.username || 'Unknown',
          email: c.email || '',
          phone: c.billing?.phone || '',
          company: c.billing?.company || '',
          address: `${c.billing?.address_1 || ''} ${c.billing?.city || ''}`.trim(),
          totalSpent: parseFloat(c.total_spent || '0'),
          ordersCount: c.orders_count || 0,
          dateRegistered: c.date_created,
          avatarUrl: c.avatar_url || ''
        }));

        return res.json({ success: true, total: totalCustomers, pages: totalCustomerPages, customers: mapped });
      }

      case 'products': {
        const r = await fetch(`${WC_API_BASE}/wp-json/wc/v3/products?per_page=50&status=publish`, { headers: wcHeaders() });
        if (!r.ok) return res.status(r.status).json({ success: false, error: `Failed to fetch products: ${r.status}` });
        const products = await r.json();
        return res.json({
          success: true,
          products: products.map((p: any) => ({
            id: p.id, name: p.name,
            price: parseFloat(p.price || '0'),
            category: p.categories?.[0]?.name || 'General',
            status: p.status
          }))
        });
      }

      case 'syncOrders': {
        // Fetch up to 100 most-recent orders, resolve contacts, upsert to woo_orders
        if (!supabase) {
          return res.status(503).json({ success: false, error: 'Supabase not configured' });
        }

        const perPage = Math.min(Number(req.query.per_page) || 100, 100);
        const r = await fetch(
          `${WC_API_BASE}/wp-json/wc/v3/orders?page=1&per_page=${perPage}&orderby=date&order=desc`,
          { headers: wcHeaders() }
        );
        if (!r.ok) {
          return res.status(r.status).json({ success: false, error: `WooCommerce API error: ${r.status}` });
        }

        const rawOrders = await r.json();
        if (!Array.isArray(rawOrders)) {
          return res.status(502).json({ success: false, error: 'WooCommerce returned unexpected response', raw: rawOrders });
        }

        const orders = rawOrders;
        let synced = 0;
        const errors: string[] = [];

        for (const o of orders) {
          try {
            const customerName = `${o.billing?.first_name || ''} ${o.billing?.last_name || ''}`.trim();
            const customerEmail = (o.billing?.email || '').toLowerCase().trim();
            const customerPhone = o.billing?.phone || '';

            const contactId = (customerEmail || customerPhone)
              ? await resolveContact(supabase, { name: customerName || 'WooCommerce Customer', email: customerEmail || undefined, phone: customerPhone || undefined, company: o.billing?.company || undefined, source: 'WOOCOMMERCE' })
              : null;

            const orderRow = {
              woo_order_id: String(o.id),
              contact_id: contactId ?? null,
              customer_name: customerName,
              customer_email: customerEmail,
              customer_phone: customerPhone,
              billing_address: [o.billing?.address_1, o.billing?.city, o.billing?.state].filter(Boolean).join(', '),
              subtotal: parseFloat(o.subtotal || '0'),
              tax_amount: parseFloat(o.total_tax || '0'),
              shipping_amount: parseFloat(o.shipping_total || '0'),
              total_amount: parseFloat(o.total || '0'),
              currency: o.currency || 'JMD',
              status: o.status,
              payment_method: o.payment_method_title || '',
              order_notes: o.customer_note || '',
              line_items: o.line_items || [],
              synced_at: new Date().toISOString(),
            };

            await supabase
              .from('woo_orders')
              .upsert(orderRow, { onConflict: 'woo_order_id', ignoreDuplicates: false });

            if (contactId) {
              const { data: stats } = await supabase
                .from('woo_orders')
                .select('total_amount')
                .eq('contact_id', contactId)
                .eq('status', 'completed');

              if (stats) {
                const totalOrders = stats.length;
                const totalRevenue = stats.reduce((s: number, row: any) => s + (row.total_amount || 0), 0);
                await supabase.from('contacts').update({
                  total_orders: totalOrders,
                  total_revenue: totalRevenue,
                  average_order_value: totalOrders > 0 ? totalRevenue / totalOrders : 0,
                  updated_at: new Date().toISOString(),
                }).eq('id', contactId);
              }
            }

            synced++;
          } catch (err: any) {
            errors.push(`Order ${o.id}: ${err.message}`);
          }
        }

        return res.json({ success: true, synced, total: orders.length, errors });
      }

      default:
        return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    console.error('WooCommerce API error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
}
