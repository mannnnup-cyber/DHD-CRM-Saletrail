import type { VercelRequest, VercelResponse } from '@vercel/node';

const WC_API_BASE = process.env.WC_STORE_URL || '';
const WC_CONSUMER_KEY = process.env.WC_CONSUMER_KEY || '';
const WC_CONSUMER_SECRET = process.env.WC_CONSUMER_SECRET || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action, storeUrl, consumerKey, consumerSecret } = req.query;

  // Use env vars or passed params
  const baseUrl = (storeUrl as string) || WC_API_BASE;
  const ck = (consumerKey as string) || WC_CONSUMER_KEY;
  const cs = (consumerSecret as string) || WC_CONSUMER_SECRET;

  if (!baseUrl || !ck || !cs) {
    return res.status(400).json({
      success: false,
      error: 'Missing WooCommerce credentials. Please configure store URL, consumer key and secret.'
    });
  }

  // Build auth header
  const credentials = Buffer.from(`${ck}:${cs}`).toString('base64');
  const headers = {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json'
  };

  try {
    switch (action) {
      case 'test': {
        // Test connection by fetching store info
        const response = await fetch(`${baseUrl}/wp-json/wc/v3/system_status`, { headers });
        if (!response.ok) {
          const error = await response.text();
          return res.status(response.status).json({
            success: false,
            error: `WooCommerce API error: ${response.status} ${response.statusText}`,
            details: error
          });
        }
        const data = await response.json();
        return res.status(200).json({
          success: true,
          message: 'Connection successful!',
          store: {
            name: data.settings?.general?.blogname || 'Dirty Hand Designs',
            url: baseUrl,
            version: data.environment?.version || 'Unknown',
            currency: data.settings?.currency?.value || 'JMD'
          }
        });
      }

      case 'orders': {
        // Fetch orders with pagination
        const page = req.query.page || 1;
        const perPage = req.query.per_page || 50;
        const status = req.query.status || 'any';
        
        const url = `${baseUrl}/wp-json/wc/v3/orders?page=${page}&per_page=${perPage}&status=${status}&orderby=date&order=desc`;
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
          return res.status(response.status).json({
            success: false,
            error: `Failed to fetch orders: ${response.status} ${response.statusText}`
          });
        }
        
        const orders = await response.json();
        const totalOrders = response.headers.get('X-WP-Total') || 0;
        const totalPages = response.headers.get('X-WP-TotalPages') || 1;

        // Map WooCommerce orders to CRM pipeline stages
        const stageMap: Record<string, string> = {
          'pending': 'New Lead',
          'processing': 'Quote Sent',
          'on-hold': 'Consultation',
          'completed': 'Delivered',
          'cancelled': 'Lost',
          'refunded': 'Lost',
          'failed': 'Lost'
        };

        const mappedOrders = orders.map((order: any) => ({
          id: `wc_${order.id}`,
          orderId: order.id,
          orderNumber: order.number,
          status: order.status,
          pipelineStage: stageMap[order.status] || 'New Lead',
          customerName: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
          customerEmail: order.billing?.email || '',
          customerPhone: order.billing?.phone || '',
          company: order.billing?.company || '',
          address: `${order.billing?.address_1 || ''} ${order.billing?.city || ''}, ${order.billing?.state || ''}`.trim(),
          total: parseFloat(order.total || '0'),
          currency: order.currency || 'JMD',
          lineItems: order.line_items?.map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            price: parseFloat(item.price || '0'),
            total: parseFloat(item.total || '0')
          })) || [],
          dateCreated: order.date_created,
          dateModified: order.date_modified,
          paymentMethod: order.payment_method_title || '',
          notes: order.customer_note || ''
        }));

        return res.status(200).json({
          success: true,
          total: totalOrders,
          pages: totalPages,
          orders: mappedOrders
        });
      }

      case 'customers': {
        const page = req.query.page || 1;
        const perPage = req.query.per_page || 50;
        
        const url = `${baseUrl}/wp-json/wc/v3/customers?page=${page}&per_page=${perPage}&orderby=registered&order=desc`;
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
          return res.status(response.status).json({
            success: false,
            error: `Failed to fetch customers: ${response.status}`
          });
        }
        
        const customers = await response.json();
        
        const mappedCustomers = customers.map((customer: any) => ({
          id: `wc_customer_${customer.id}`,
          name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
          email: customer.email || '',
          phone: customer.billing?.phone || '',
          company: customer.billing?.company || '',
          address: `${customer.billing?.address_1 || ''} ${customer.billing?.city || ''}`.trim(),
          totalSpent: parseFloat(customer.total_spent || '0'),
          ordersCount: customer.orders_count || 0,
          dateRegistered: customer.date_created,
          avatarUrl: customer.avatar_url || ''
        }));

        return res.status(200).json({
          success: true,
          customers: mappedCustomers
        });
      }

      case 'products': {
        const url = `${baseUrl}/wp-json/wc/v3/products?per_page=50&status=publish`;
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
          return res.status(response.status).json({
            success: false,
            error: `Failed to fetch products: ${response.status}`
          });
        }
        
        const products = await response.json();
        
        return res.status(200).json({
          success: true,
          products: products.map((p: any) => ({
            id: p.id,
            name: p.name,
            price: parseFloat(p.price || '0'),
            category: p.categories?.[0]?.name || 'General',
            status: p.status
          }))
        });
      }

      default:
        return res.status(400).json({
          success: false,
          error: `Unknown action: ${action}`
        });
    }
  } catch (error: any) {
    console.error('WooCommerce API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      hint: 'Make sure your WooCommerce store URL is correct and API keys have read permissions'
    });
  }
}
