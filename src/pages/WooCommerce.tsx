import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShoppingCart, CheckCircle, XCircle, RefreshCw, ExternalLink,
  Package, Users, DollarSign, ArrowRight, Key, Globe,
  ChevronDown, ChevronUp, Copy, Zap, UserPlus, AlertCircle,
  Printer, Calendar, Download, Bell, X, MessageCircle,
  Mail, Phone, SortDesc, FileDown, Star
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';

interface WCOrder {
  id: string; orderId: number; orderNumber: string; status: string;
  pipelineStage: string; customerName: string; customerEmail: string;
  customerPhone: string; company: string; address: string; total: number;
  currency: string; lineItems: { name: string; quantity: number; price: number; total: number }[];
  dateCreated: string; paymentMethod: string; notes: string;
}

interface WCCustomer {
  id: string; wcId: number; name: string; email: string; phone: string;
  company: string; address: string; totalSpent: number; ordersCount: number;
  dateRegistered: string; avatarUrl: string;
}

type OrdersCustomer = {
  id: string; name: string; email: string; phone: string; company: string;
  address: string; totalSpent: number; ordersCount: number; lastOrder: string; currency: string;
};

type SortOption = 'date_desc' | 'date_asc' | 'value_desc' | 'value_asc';

const STAGE_MAP: Record<string, { label: string; color: string }> = {
  pending:    { label: 'New Lead',     color: 'bg-gray-500' },
  'on-hold':  { label: 'Consultation', color: 'bg-blue-500' },
  processing: { label: 'Quote Sent',   color: 'bg-yellow-500' },
  completed:  { label: 'Delivered',    color: 'bg-green-500' },
  cancelled:  { label: 'Lost',         color: 'bg-red-500' },
  refunded:   { label: 'Lost',         color: 'bg-red-500' },
  failed:     { label: 'Lost',         color: 'bg-red-500' },
};

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-gray-500/20 text-gray-400',
  processing: 'bg-yellow-500/20 text-yellow-400',
  'on-hold':  'bg-blue-500/20 text-blue-400',
  completed:  'bg-green-500/20 text-green-400',
  cancelled:  'bg-red-500/20 text-red-400',
  refunded:   'bg-red-500/20 text-red-400',
  failed:     'bg-red-500/20 text-red-400',
};

const fmt = (n: number, cur = 'JMD') => `$${n.toLocaleString()} ${cur}`;
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-JM', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
const waLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`;

export default function WooCommerce() {
  const { addDeal, addLead } = useApp();

  const [configured, setConfigured]     = useState<boolean | null>(null);
  const [storeUrl, setStoreUrl]         = useState('');
  const [connStatus, setConnStatus]     = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');
  const [connInfo, setConnInfo]         = useState<any>(null);
  const [activeTab, setActiveTab]       = useState<'orders' | 'customers' | 'mapping' | 'setup'>('orders');
  const [error, setError]               = useState('');

  // Orders
  const [orders, setOrders]             = useState<WCOrder[]>([]);
  const [totalOrders, setTotalOrders]   = useState(0);
  const [totalPages, setTotalPages]     = useState(1);
  const [currentPage, setCurrentPage]   = useState(1);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [syncing, setSyncing]           = useState(false);
  const [lastSync, setLastSync]         = useState('');
  const [searchOrder, setSearchOrder]   = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [productFilter, setProductFilter] = useState('');
  const [sortBy, setSortBy]             = useState<SortOption>('date_desc');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [importedOrders, setImportedOrders] = useState<Set<string>>(new Set());
  const [importingOrder, setImportingOrder] = useState<string | null>(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [copiedOrder, setCopiedOrder]   = useState<string | null>(null);

  // Customers
  const [customers, setCustomers]       = useState<WCCustomer[]>([]);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [customerPages, setCustomerPages] = useState(1);
  const [customerPage, setCustomerPage] = useState(1);
  const [loadingMoreC, setLoadingMoreC] = useState(false);
  const [syncingC, setSyncingC]         = useState(false);
  const [importedC, setImportedC]       = useState<Set<string>>(new Set());
  const [importingC, setImportingC]     = useState<string | null>(null);
  const [searchC, setSearchC]           = useState('');
  const [customerView, setCustomerView] = useState<'orders' | 'registered'>('orders');
  const [selectedCustomer, setSelectedCustomer] = useState<OrdersCustomer | null>(null);

  // Toast
  const [newOrderToast, setNewOrderToast] = useState<{ orderNumber: string; customerName: string } | null>(null);
  const toastTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importedRef  = useRef(importedOrders);

  useEffect(() => { importedRef.current = importedOrders; }, [importedOrders]);

  const showToast = (orderNumber: string, customerName: string) => {
    setNewOrderToast({ orderNumber, customerName });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setNewOrderToast(null), 6000);
  };

  // Init
  useEffect(() => {
    fetch('/api/woocommerce?action=configured').then(r => r.json())
      .then(d => { setConfigured(d.configured); if (d.storeUrl) setStoreUrl(d.storeUrl); })
      .catch(() => setConfigured(false));
    const sv = localStorage.getItem('wc_last_sync'); if (sv) setLastSync(sv);
    const so = localStorage.getItem('wc_orders'); if (so) setOrders(JSON.parse(so));
    const si = localStorage.getItem('wc_imported_orders'); if (si) setImportedOrders(new Set(JSON.parse(si)));
    const sc = localStorage.getItem('wc_imported_customers'); if (sc) setImportedC(new Set(JSON.parse(sc)));
  }, []);

  // Real-time new orders
  useEffect(() => {
    if (!supabase || typeof supabase.channel !== 'function') return;
    const ch = supabase.channel('wc_orders_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'woocommerce_orders' }, (payload: any) => {
        const row = payload.new;
        showToast(row.order_number, row.customer_name);
        const mapped: WCOrder = {
          id: `wc_${row.wc_order_id}`, orderId: row.wc_order_id, orderNumber: row.order_number,
          status: row.status, pipelineStage: row.pipeline_stage || 'New Lead',
          customerName: row.customer_name || '', customerEmail: row.customer_email || '',
          customerPhone: row.customer_phone || '', company: row.company || '',
          address: row.address || '', total: row.total || 0, currency: row.currency || 'JMD',
          lineItems: (() => { try { return JSON.parse(row.line_items || '[]'); } catch { return []; } })(),
          dateCreated: row.date_created, paymentMethod: row.payment_method || '', notes: row.customer_note || '',
        };
        setOrders(prev => prev.find(o => o.id === mapped.id) ? prev : [mapped, ...prev]);
        setTotalOrders(prev => prev + 1);
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ── API helpers ───────────────────────────────────────────────────────────
  const buildUrl = (page: number, from = '', to = '') => {
    let u = `/api/woocommerce?action=orders&per_page=100&page=${page}`;
    if (from) u += `&after=${encodeURIComponent(from + 'T00:00:00')}`;
    if (to)   u += `&before=${encodeURIComponent(to + 'T23:59:59')}`;
    return u;
  };

  const syncOrders = useCallback(async () => {
    setSyncing(true); setError('');
    try {
      const d = await fetch(buildUrl(1)).then(r => r.json());
      if (d.success) {
        setOrders(d.orders); setTotalOrders(d.total || d.orders.length);
        setTotalPages(d.pages || 1); setCurrentPage(1);
        const t = new Date().toLocaleString(); setLastSync(t);
        localStorage.setItem('wc_orders', JSON.stringify(d.orders));
        localStorage.setItem('wc_last_sync', t);
      } else setError(d.error || 'Failed to sync');
    } catch (e: any) { setError(e.message); }
    setSyncing(false);
  }, []);

  const applyDateFilter = async () => {
    if (!dateFrom && !dateTo) return syncOrders();
    setSyncing(true); setError('');
    try {
      const d = await fetch(buildUrl(1, dateFrom, dateTo)).then(r => r.json());
      if (d.success) { setOrders(d.orders); setTotalOrders(d.total || d.orders.length); setTotalPages(d.pages || 1); setCurrentPage(1); }
      else setError(d.error || 'Failed');
    } catch (e: any) { setError(e.message); }
    setSyncing(false);
  };

  const loadMoreOrders = useCallback(async () => {
    if (loadingMore || currentPage >= totalPages) return;
    setLoadingMore(true);
    try {
      const np = currentPage + 1;
      const d = await fetch(buildUrl(np, dateFrom, dateTo)).then(r => r.json());
      if (d.success) {
        setOrders(prev => { const ids = new Set(prev.map(o => o.id)); return [...prev, ...d.orders.filter((o: WCOrder) => !ids.has(o.id))]; });
        setCurrentPage(np);
      } else setError(d.error || 'Failed');
    } catch (e: any) { setError(e.message); }
    setLoadingMore(false);
  }, [currentPage, totalPages, loadingMore, dateFrom, dateTo]);

  const syncCustomers = useCallback(async () => {
    setSyncingC(true); setError('');
    try {
      const d = await fetch('/api/woocommerce?action=customers&per_page=100&page=1').then(r => r.json());
      if (d.success) { setCustomers(d.customers); setTotalCustomers(d.total || d.customers.length); setCustomerPages(d.pages || 1); setCustomerPage(1); }
      else setError(d.error || 'Failed');
    } catch (e: any) { setError(e.message); }
    setSyncingC(false);
  }, []);

  const loadMoreCustomers = useCallback(async () => {
    if (loadingMoreC || customerPage >= customerPages) return;
    setLoadingMoreC(true);
    try {
      const np = customerPage + 1;
      const d = await fetch(`/api/woocommerce?action=customers&per_page=100&page=${np}`).then(r => r.json());
      if (d.success) {
        setCustomers(prev => { const ids = new Set(prev.map(c => c.id)); return [...prev, ...d.customers.filter((c: WCCustomer) => !ids.has(c.id))]; });
        setCustomerPage(np);
      } else setError(d.error || 'Failed');
    } catch (e: any) { setError(e.message); }
    setLoadingMoreC(false);
  }, [customerPage, customerPages, loadingMoreC]);

  useEffect(() => {
    if (configured !== true) return;
    syncOrders();
    const iv = setInterval(syncOrders, 15 * 60 * 1000);
    return () => clearInterval(iv);
  }, [configured, syncOrders]);

  const testConnection = async () => {
    setConnStatus('testing'); setError('');
    try {
      const d = await fetch('/api/woocommerce?action=test').then(r => r.json());
      if (d.success) { setConnStatus('connected'); setConnInfo(d.store); }
      else { setConnStatus('failed'); setError(d.error || 'Connection failed'); }
    } catch (e: any) { setConnStatus('failed'); setError(e.message); }
  };

  // ── Import ────────────────────────────────────────────────────────────────
  const importOrder = async (order: WCOrder) => {
    if (importedRef.current.has(order.id)) return;
    setImportingOrder(order.id);
    try {
      await addDeal({
        name: `${order.customerName} — WC#${order.orderNumber}`, value: order.total,
        stage: order.pipelineStage as any,
        notes: [order.notes, `WooCommerce #${order.orderNumber}`, order.paymentMethod ? `Payment: ${order.paymentMethod}` : '', order.lineItems.map(i => `${i.name} ×${i.quantity}`).join(', ')].filter(Boolean).join('\n'),
        source: 'WooCommerce'
      } as any);
      setImportedOrders(prev => { const n = new Set([...prev, order.id]); importedRef.current = n; localStorage.setItem('wc_imported_orders', JSON.stringify([...n])); return n; });
    } catch (e: any) { setError('Import failed: ' + e.message); }
    setImportingOrder(null);
  };

  const bulkImport = async (list: WCOrder[]) => {
    const pending = list.filter(o => !importedRef.current.has(o.id));
    if (!pending.length) return;
    setBulkImporting(true); setBulkProgress({ done: 0, total: pending.length });
    for (const o of pending) { await importOrder(o); setBulkProgress(p => ({ ...p, done: p.done + 1 })); }
    setBulkImporting(false); setBulkProgress({ done: 0, total: 0 });
  };

  const importCustomer = async (c: WCCustomer) => {
    if (importedC.has(c.id)) return;
    setImportingC(c.id);
    try {
      await addLead({ name: c.name, email: c.email, phone: c.phone, company: c.company, source: 'WooCommerce', status: 'new', notes: `WC customer — ${c.ordersCount} orders, ${fmt(c.totalSpent)} total spent` } as any);
      const n = new Set([...importedC, c.id]); setImportedC(n); localStorage.setItem('wc_imported_customers', JSON.stringify([...n]));
    } catch (e: any) { setError('Import failed: ' + e.message); }
    setImportingC(null);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const copyOrder = (o: WCOrder) => {
    navigator.clipboard.writeText([
      `Order #${o.orderNumber} — ${fmtDate(o.dateCreated)}`, `Status: ${o.status}`,
      `Customer: ${o.customerName}`, o.customerEmail && `Email: ${o.customerEmail}`,
      o.customerPhone && `Phone: ${o.customerPhone}`, o.company && `Company: ${o.company}`,
      o.address && `Address: ${o.address}`, o.paymentMethod && `Payment: ${o.paymentMethod}`, '',
      'Items:', ...o.lineItems.map(i => `  ${i.name} × ${i.quantity}  —  ${fmt(i.total, o.currency)}`),
      '', `Total: ${fmt(o.total, o.currency)}`, o.notes && `Note: ${o.notes}`,
    ].filter(Boolean).join('\n'));
    setCopiedOrder(o.id); setTimeout(() => setCopiedOrder(null), 2000);
  };

  const printOrder = (o: WCOrder) => {
    const w = window.open('', '_blank'); if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Order #${o.orderNumber}</title><style>body{font-family:Arial,sans-serif;padding:40px;max-width:600px;margin:auto;color:#111}h2{margin-bottom:4px}table{width:100%;border-collapse:collapse;margin:12px 0}th{text-align:left;padding:8px;background:#f5f5f5;font-size:.85em}td{padding:8px;border-bottom:1px solid #eee;font-size:.9em}.tr{font-weight:bold;border-top:2px solid #333}.note{background:#fffbea;padding:10px;border-left:3px solid #f0c040;margin-top:12px}@media print{body{padding:20px}}</style></head><body><h2>Order #${o.orderNumber}</h2><p style="color:#555">${fmtDate(o.dateCreated)} · ${o.status} · ${o.paymentMethod||''}</p><p>${o.customerName}<br>${o.customerEmail||''}<br>${o.customerPhone||''}<br>${o.company||''}<br>${o.address||''}</p><table><tr><th>Item</th><th>Qty</th><th style="text-align:right">Total</th></tr>${o.lineItems.map(i=>`<tr><td>${i.name}</td><td>${i.quantity}</td><td style="text-align:right">${fmt(i.total,o.currency)}</td></tr>`).join('')}<tr class="tr"><td colspan="2">Total</td><td style="text-align:right">${fmt(o.total,o.currency)}</td></tr></table>${o.notes?`<div class="note"><strong>Note:</strong> ${o.notes}</div>`:''}<script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  };

  const exportCSV = () => {
    const hdr = ['Order #','Date','Customer','Email','Phone','Company','Status','Total','Currency','Items','Payment','Note'];
    const rows = filteredOrders.map(o => [o.orderNumber, fmtDate(o.dateCreated), o.customerName, o.customerEmail, o.customerPhone, o.company, o.status, o.total, o.currency, o.lineItems.map(i=>`${i.name} x${i.quantity}`).join('; '), o.paymentMethod, o.notes]);
    const csv = [hdr, ...rows].map(r => r.map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = `orders-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const ordersCustomers = (() => {
    const map = new Map<string, OrdersCustomer>();
    for (const o of orders) {
      const key = o.customerEmail || o.customerName; if (!key) continue;
      const ex = map.get(key);
      const value = !['cancelled','refunded','failed'].includes(o.status) ? o.total : 0;
      if (ex) { ex.totalSpent += value; ex.ordersCount++; if (o.dateCreated > ex.lastOrder) ex.lastOrder = o.dateCreated; }
      else map.set(key, { id: `oc_${key}`, name: o.customerName || o.customerEmail, email: o.customerEmail, phone: o.customerPhone, company: o.company, address: o.address, totalSpent: value, ordersCount: 1, lastOrder: o.dateCreated, currency: o.currency });
    }
    return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  })();

  // emails that appear in 2+ orders = repeat customers
  const repeatEmails = new Set(
    Object.entries(orders.reduce((acc, o) => { if (o.customerEmail) acc[o.customerEmail] = (acc[o.customerEmail] || 0) + 1; return acc; }, {} as Record<string, number>))
      .filter(([, n]) => n > 1).map(([e]) => e)
  );

  const filteredOrders = (() => {
    const q = searchOrder.toLowerCase();
    const pq = productFilter.toLowerCase();
    let list = orders.filter(o => {
      const matchSearch = !q || o.customerName.toLowerCase().includes(q) || o.orderNumber.includes(q) || o.customerEmail.toLowerCase().includes(q);
      const matchStatus = filterStatus === 'all' || o.status === filterStatus;
      const matchProduct = !pq || o.lineItems.some(i => i.name.toLowerCase().includes(pq));
      const d = o.dateCreated ? new Date(o.dateCreated) : null;
      const matchFrom = !dateFrom || !d || d >= new Date(dateFrom);
      const matchTo   = !dateTo   || !d || d <= new Date(dateTo + 'T23:59:59');
      return matchSearch && matchStatus && matchProduct && matchFrom && matchTo;
    });
    if (sortBy === 'date_asc')   list = [...list].sort((a,b) => a.dateCreated.localeCompare(b.dateCreated));
    if (sortBy === 'value_desc') list = [...list].sort((a,b) => b.total - a.total);
    if (sortBy === 'value_asc')  list = [...list].sort((a,b) => a.total - b.total);
    return list;
  })();

  const filteredRevenue = filteredOrders
    .filter(o => !['cancelled','refunded','failed'].includes(o.status))
    .reduce((s, o) => s + o.total, 0);

  const filteredCurrency = filteredOrders[0]?.currency || 'JMD';

  const unimportedCount = filteredOrders.filter(o => !importedOrders.has(o.id)).length;

  const stats = {
    total:      totalOrders || orders.length,
    processing: orders.filter(o => o.status === 'processing').length,
    completed:  orders.filter(o => o.status === 'completed').length,
    revenue:    orders.filter(o => o.status === 'completed').reduce((s,o) => s+o.total, 0),
    customers:  ordersCustomers.length,
  };

  const customerOrders = selectedCustomer
    ? orders.filter(o => o.customerEmail === selectedCustomer.email || o.customerName === selectedCustomer.name)
    : [];

  const filteredOC = ordersCustomers.filter(c => { const q = searchC.toLowerCase(); return !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q); });
  const filteredRC = customers.filter(c => { const q = searchC.toLowerCase(); return !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q); });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* New order toast */}
      {newOrderToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 p-4 bg-green-600 text-white rounded-xl shadow-2xl border border-green-500">
          <Bell className="w-5 h-5 flex-shrink-0" />
          <div><p className="font-semibold text-sm">New Order #{newOrderToast.orderNumber}</p><p className="text-green-200 text-xs">{newOrderToast.customerName}</p></div>
          <button onClick={() => setNewOrderToast(null)} className="ml-2 text-green-200 hover:text-white"><XCircle className="w-4 h-4" /></button>
        </div>
      )}

      {/* Customer drill-down panel */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedCustomer(null)} />
          <div className="relative w-full max-w-md bg-gray-900 border-l border-gray-700 h-full overflow-y-auto z-50 flex flex-col">
            {/* Panel header */}
            <div className="flex items-start justify-between p-6 border-b border-gray-700/50 sticky top-0 bg-gray-900 z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {(selectedCustomer.name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-white font-semibold">{selectedCustomer.name}</h3>
                  {selectedCustomer.company && <p className="text-gray-400 text-xs">{selectedCustomer.company}</p>}
                  {repeatEmails.has(selectedCustomer.email) && (
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium">
                      <Star className="w-3 h-3" /> Repeat Customer
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="text-gray-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1">
              {/* Contact info */}
              <div className="space-y-2">
                {selectedCustomer.email && (
                  <a href={`mailto:${selectedCustomer.email}`} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors group">
                    <Mail className="w-4 h-4 text-gray-400 group-hover:text-purple-400" />
                    <span className="text-gray-300 text-sm">{selectedCustomer.email}</span>
                  </a>
                )}
                {selectedCustomer.phone && (
                  <a href={waLink(selectedCustomer.phone)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors group">
                    <MessageCircle className="w-4 h-4 text-gray-400 group-hover:text-green-400" />
                    <span className="text-gray-300 text-sm">{selectedCustomer.phone}</span>
                    <span className="ml-auto text-xs text-gray-500 group-hover:text-green-400">WhatsApp →</span>
                  </a>
                )}
                {selectedCustomer.address && (
                  <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                    <Globe className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-300 text-sm">{selectedCustomer.address}</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Orders', value: selectedCustomer.ordersCount, color: 'text-purple-400' },
                  { label: 'Total Spent', value: fmt(selectedCustomer.totalSpent, selectedCustomer.currency), color: 'text-amber-400' },
                  { label: 'Last Order', value: fmtDate(selectedCustomer.lastOrder), color: 'text-blue-400' },
                ].map(s => (
                  <div key={s.label} className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <p className={`font-bold text-sm ${s.color}`}>{s.value}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Add as Lead */}
              {importedC.has(selectedCustomer.id) ? (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 text-sm font-medium">Added to CRM as Lead</span>
                </div>
              ) : (
                <button
                  onClick={() => importCustomer({ ...selectedCustomer, wcId: 0, dateRegistered: selectedCustomer.lastOrder, avatarUrl: '', ordersCount: selectedCustomer.ordersCount, totalSpent: selectedCustomer.totalSpent })}
                  disabled={importingC === selectedCustomer.id}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {importingC === selectedCustomer.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Add as CRM Lead
                </button>
              )}

              {/* Order history */}
              <div>
                <h4 className="text-white font-medium text-sm mb-3">Order History ({customerOrders.length})</h4>
                {customerOrders.length === 0 ? (
                  <p className="text-gray-500 text-sm">No orders found</p>
                ) : (
                  <div className="space-y-2">
                    {customerOrders.sort((a, b) => b.dateCreated.localeCompare(a.dateCreated)).map(o => (
                      <div key={o.id} className="bg-gray-800/50 border border-gray-700/40 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white text-sm font-medium">#{o.orderNumber}</span>
                          <span className="text-amber-400 text-sm font-bold">{fmt(o.total, o.currency)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 text-xs">{fmtDate(o.dateCreated)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status] || 'bg-gray-500/20 text-gray-400'}`}>{o.status}</span>
                        </div>
                        {o.lineItems.length > 0 && (
                          <p className="text-gray-400 text-xs mt-1 truncate">{o.lineItems.map(i => `${i.name} ×${i.quantity}`).join(', ')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-purple-400" /> WooCommerce
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {storeUrl || 'dirtyhanddesigns.com'} orders &amp; customers
            {lastSync && <span className="ml-2 text-gray-600">· Last sync {lastSync}</span>}
          </p>
        </div>
        {configured === true && (
          <button onClick={syncOrders} disabled={syncing} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        )}
      </div>

      {/* Banners */}
      {configured === false && (
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-400 font-medium text-sm">Environment variables not set</p>
            <p className="text-gray-400 text-xs mt-1">Add <code className="text-purple-400">WC_STORE_URL</code>, <code className="text-purple-400">WC_CONSUMER_KEY</code>, <code className="text-purple-400">WC_CONSUMER_SECRET</code> to Vercel, then redeploy.</p>
          </div>
        </div>
      )}
      {configured === true && connStatus === 'idle' && (
        <div className="flex items-center justify-between p-4 bg-gray-800/40 border border-gray-700/50 rounded-xl">
          <p className="text-gray-300 text-sm">Credentials configured. Test the connection to verify.</p>
          <button onClick={testConnection} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors">Test Connection</button>
        </div>
      )}
      {connStatus === 'testing' && (
        <div className="flex items-center gap-3 p-4 bg-gray-800/40 border border-gray-700/50 rounded-xl">
          <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" /><p className="text-gray-400 text-sm">Testing connection...</p>
        </div>
      )}
      {connStatus === 'connected' && connInfo && (
        <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <div><p className="text-green-400 font-medium text-sm">{connInfo.name}</p><p className="text-gray-400 text-xs">{connInfo.url} · WooCommerce {connInfo.version} · {connInfo.currency}</p></div>
        </div>
      )}
      {connStatus === 'failed' && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <XCircle className="w-5 h-5 text-red-400" /><p className="text-red-400 text-sm">{error || 'Connection failed'}</p>
        </div>
      )}
      {error && connStatus !== 'failed' && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <XCircle className="w-5 h-5 text-red-400" /><p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Clickable stat cards */}
      {orders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {([
            { label: 'Total Orders',  value: stats.total,              icon: Package,     color: 'text-purple-400', filter: 'all',        tab: 'orders' as const },
            { label: 'Processing',    value: stats.processing,         icon: RefreshCw,   color: 'text-yellow-400', filter: 'processing', tab: 'orders' as const },
            { label: 'Completed',     value: stats.completed,          icon: CheckCircle, color: 'text-green-400',  filter: 'completed',  tab: 'orders' as const },
            { label: 'Revenue',       value: fmt(stats.revenue),       icon: DollarSign,  color: 'text-amber-400',  filter: 'completed',  tab: 'orders' as const },
            { label: 'Customers',     value: stats.customers,          icon: Users,       color: 'text-blue-400',   filter: '',           tab: 'customers' as const },
          ] as const).map((s, i) => (
            <button
              key={i}
              onClick={() => { setActiveTab(s.tab); if (s.filter) setFilterStatus(s.filter); }}
              className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-left hover:border-purple-500/50 hover:bg-gray-800 transition-all group"
            >
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-4 h-4 ${s.color} group-hover:scale-110 transition-transform`} />
                <span className="text-gray-400 text-xs">{s.label}</span>
              </div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700/50">
        {[
          { id: 'orders',   label: `Orders${totalOrders ? ` (${totalOrders})` : orders.length ? ` (${orders.length})` : ''}` },
          { id: 'customers',label: `Customers${ordersCustomers.length ? ` (${ordersCustomers.length})` : ''}` },
          { id: 'mapping',  label: 'Stage Mapping' },
          { id: 'setup',    label: 'Setup Guide' },
        ].map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); if (tab.id === 'customers' && customers.length === 0) syncCustomers(); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── ORDERS TAB ── */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-12 text-center">
              <ShoppingCart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 font-medium">No orders synced yet</p>
              <p className="text-gray-500 text-sm mt-1 mb-4">{configured === true ? 'Click Sync Now to load orders' : 'Configure credentials in Setup Guide first'}</p>
              {configured === true && <button onClick={syncOrders} disabled={syncing} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">{syncing ? 'Syncing...' : 'Sync Orders'}</button>}
            </div>
          ) : (
            <>
              {/* Search + Status + Sort */}
              <div className="flex gap-3 flex-wrap">
                <input type="text" value={searchOrder} onChange={e => setSearchOrder(e.target.value)} placeholder="Search name, order #, email..."
                  className="flex-1 min-w-40 bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500">
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="on-hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)}
                  className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500">
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="value_desc">Highest Value</option>
                  <option value="value_asc">Lowest Value</option>
                </select>
              </div>

              {/* Product filter + Date range */}
              <div className="flex gap-3 flex-wrap items-center p-3 bg-gray-800/30 border border-gray-700/40 rounded-lg">
                <Package className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <input type="text" value={productFilter} onChange={e => setProductFilter(e.target.value)} placeholder="Filter by product name..."
                  className="flex-1 min-w-36 bg-transparent text-white text-sm focus:outline-none placeholder-gray-600" />
                <div className="h-4 w-px bg-gray-700 hidden md:block" />
                <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-purple-500" />
                <span className="text-gray-500 text-xs">to</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-purple-500" />
                <button onClick={applyDateFilter} disabled={syncing} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium disabled:opacity-50">Apply</button>
                {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(''); setDateTo(''); syncOrders(); }} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium">Clear</button>}
              </div>

              {/* Toolbar: count + revenue + bulk import + export */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-gray-500 text-xs">
                  {filteredOrders.length} orders · <span className="text-amber-400 font-medium">{fmt(filteredRevenue, filteredCurrency)}</span> revenue
                  {totalOrders > orders.length && <span className="text-gray-600"> · {totalOrders} total in WooCommerce</span>}
                </p>
                <div className="flex items-center gap-2">
                  {unimportedCount > 0 && (
                    <button onClick={() => bulkImport(filteredOrders)} disabled={bulkImporting}
                      className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-medium disabled:opacity-50">
                      {bulkImporting ? <><RefreshCw className="w-3 h-3 animate-spin" /> Importing {bulkProgress.done}/{bulkProgress.total}...</>
                        : <><Download className="w-3 h-3" /> Import All ({unimportedCount})</>}
                    </button>
                  )}
                  <button onClick={exportCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium transition-colors">
                    <FileDown className="w-3 h-3" /> Export CSV
                  </button>
                </div>
              </div>

              {/* Orders list */}
              <div className="space-y-3">
                {filteredOrders.map(order => {
                  const isRepeat = repeatEmails.has(order.customerEmail);
                  return (
                    <div key={order.id} className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden">
                      <div className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-16 flex-shrink-0">
                            <p className="text-white font-medium text-sm">#{order.orderNumber}</p>
                            <p className="text-gray-500 text-xs">{fmtDate(order.dateCreated)}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-white text-sm font-medium truncate">{order.customerName}</p>
                              {isRepeat && (
                                <span className="flex-shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium">
                                  <Star className="w-2.5 h-2.5" /> Repeat
                                </span>
                              )}
                            </div>
                            <p className="text-gray-400 text-xs truncate">{order.customerEmail}</p>
                          </div>
                          <span className={`hidden md:inline-flex px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-gray-500/20 text-gray-400'}`}>{order.status}</span>
                          <div className="hidden md:flex items-center gap-2">
                            <ArrowRight className="w-3 h-3 text-gray-500" />
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300">{STAGE_MAP[order.status]?.label || 'New Lead'}</span>
                          </div>
                          <p className="text-amber-400 font-bold text-sm whitespace-nowrap">{fmt(order.total, order.currency)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {importedOrders.has(order.id) ? (
                            <span className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs font-medium">
                              <CheckCircle className="w-3 h-3" /> In Pipeline
                            </span>
                          ) : (
                            <button onClick={() => importOrder(order)} disabled={importingOrder === order.id || bulkImporting}
                              className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium disabled:opacity-50">
                              {importingOrder === order.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />} Import
                            </button>
                          )}
                          <button onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)} className="p-1.5 text-gray-400 hover:text-white">
                            {expandedOrder === order.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {expandedOrder === order.id && (
                        <div className="border-t border-gray-700/50 p-4 bg-gray-900/30 space-y-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[{ label:'Phone', value: order.customerPhone }, { label:'Company', value: order.company }, { label:'Payment', value: order.paymentMethod }, { label:'Address', value: order.address }].map(f => (
                              <div key={f.label}><p className="text-gray-500 text-xs">{f.label}</p><p className="text-white text-sm">{f.value || 'N/A'}</p></div>
                            ))}
                          </div>
                          {order.lineItems.length > 0 && (
                            <div>
                              <p className="text-gray-400 text-xs font-medium mb-2">Items:</p>
                              <div className="space-y-1">
                                {order.lineItems.map((item, i) => (
                                  <div key={i} className="flex justify-between text-sm">
                                    <span className="text-gray-300">{item.name} × {item.quantity}</span>
                                    <span className="text-amber-400">{fmt(item.total, order.currency)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {order.notes && <div><p className="text-gray-400 text-xs font-medium mb-1">Customer Note:</p><p className="text-gray-300 text-sm">{order.notes}</p></div>}
                          <div className="flex items-center justify-between pt-1 border-t border-gray-700/40">
                            {order.customerEmail && (
                              <div className="flex items-center gap-2">
                                {order.customerPhone && (
                                  <a href={waLink(order.customerPhone)} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg text-xs font-medium">
                                    <MessageCircle className="w-3 h-3" /> WhatsApp
                                  </a>
                                )}
                                <a href={`mailto:${order.customerEmail}`}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium">
                                  <Mail className="w-3 h-3" /> Email
                                </a>
                              </div>
                            )}
                            <div className="flex gap-2 ml-auto">
                              <button onClick={() => copyOrder(order)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium">
                                <Copy className="w-3 h-3" />{copiedOrder === order.id ? 'Copied!' : 'Copy'}
                              </button>
                              <button onClick={() => printOrder(order)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium">
                                <Printer className="w-3 h-3" /> Print
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {currentPage < totalPages && (
                <div className="flex justify-center pt-2">
                  <button onClick={loadMoreOrders} disabled={loadingMore} className="flex items-center gap-2 px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${loadingMore ? 'animate-spin' : ''}`} />
                    {loadingMore ? 'Loading...' : `Load More (${totalOrders - orders.length} remaining)`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── CUSTOMERS TAB ── */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-blue-300 text-xs"><span className="font-semibold">From Orders</span> captures every buyer including guests. <span className="font-semibold">Registered</span> shows WordPress accounts only — may show 0 orders if they checked out as guests.</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg overflow-hidden border border-gray-700/50">
              <button onClick={() => setCustomerView('orders')} className={`px-4 py-2 text-xs font-medium transition-colors ${customerView === 'orders' ? 'bg-purple-600 text-white' : 'bg-gray-800/50 text-gray-400 hover:text-white'}`}>
                From Orders ({ordersCustomers.length})
              </button>
              <button onClick={() => { setCustomerView('registered'); if (customers.length === 0) syncCustomers(); }} className={`px-4 py-2 text-xs font-medium transition-colors ${customerView === 'registered' ? 'bg-purple-600 text-white' : 'bg-gray-800/50 text-gray-400 hover:text-white'}`}>
                Registered ({totalCustomers || customers.length})
              </button>
            </div>
            <input type="text" value={searchC} onChange={e => setSearchC(e.target.value)} placeholder="Search customers..."
              className="flex-1 min-w-40 bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
            {customerView === 'registered' && (
              <button onClick={syncCustomers} disabled={syncingC} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${syncingC ? 'animate-spin' : ''}`} />{syncingC ? 'Loading...' : 'Refresh'}
              </button>
            )}
          </div>

          {/* From Orders */}
          {customerView === 'orders' && (
            ordersCustomers.length === 0 ? (
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-12 text-center">
                <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 font-medium">No orders loaded yet</p>
                <p className="text-gray-500 text-sm mt-1">Sync orders first — customers appear automatically.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOC.map(c => (
                  <div key={c.id} onClick={() => setSelectedCustomer(c)} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 flex items-center justify-between gap-4 cursor-pointer hover:border-purple-500/50 hover:bg-gray-800 transition-all">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {(c.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium text-sm truncate">{c.name}</p>
                          {repeatEmails.has(c.email) && <span className="flex-shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-xs"><Star className="w-2.5 h-2.5" /> Repeat</span>}
                        </div>
                        <p className="text-gray-400 text-xs truncate">{c.email}</p>
                        {c.phone && <p className="text-gray-500 text-xs">{c.phone}</p>}
                      </div>
                      <div className="hidden md:block text-center"><p className="text-white text-sm font-medium">{c.ordersCount}</p><p className="text-gray-500 text-xs">orders</p></div>
                      <div className="hidden md:block text-center"><p className="text-amber-400 text-sm font-bold">{fmt(c.totalSpent, c.currency)}</p><p className="text-gray-500 text-xs">spent</p></div>
                      <div className="hidden lg:block text-center"><p className="text-gray-300 text-xs">{fmtDate(c.lastOrder)}</p><p className="text-gray-500 text-xs">last order</p></div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      {c.phone && <a href={waLink(c.phone)} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-green-400 transition-colors"><MessageCircle className="w-4 h-4" /></a>}
                      {importedC.has(c.id) ? (
                        <span className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs font-medium"><CheckCircle className="w-3 h-3" /> In CRM</span>
                      ) : (
                        <button onClick={() => importCustomer({ ...c, wcId: 0, dateRegistered: c.lastOrder, avatarUrl: '' })} disabled={importingC === c.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium disabled:opacity-50">
                          {importingC === c.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />} Add as Lead
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Registered */}
          {customerView === 'registered' && (
            customers.length === 0 ? (
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-12 text-center">
                <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 font-medium">{syncingC ? 'Loading...' : 'No registered customers'}</p>
                {!syncingC && <button onClick={syncCustomers} className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium">Load Registered Customers</button>}
              </div>
            ) : (
              <>
                {totalCustomers > customers.length && <p className="text-gray-500 text-xs text-right">Showing {customers.length} of {totalCustomers}</p>}
                <div className="space-y-3">
                  {filteredRC.map(c => (
                    <div key={c.id} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{c.name.charAt(0).toUpperCase()}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm truncate">{c.name}</p>
                          <p className="text-gray-400 text-xs truncate">{c.email}</p>
                        </div>
                        <div className="hidden md:block text-center"><p className="text-white text-sm font-medium">{c.ordersCount}</p><p className="text-gray-500 text-xs">orders</p></div>
                        <div className="hidden md:block text-center"><p className="text-amber-400 text-sm font-bold">{fmt(c.totalSpent)}</p><p className="text-gray-500 text-xs">spent</p></div>
                      </div>
                      {importedC.has(c.id) ? (
                        <span className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs font-medium flex-shrink-0"><CheckCircle className="w-3 h-3" /> In CRM</span>
                      ) : (
                        <button onClick={() => importCustomer(c)} disabled={importingC === c.id} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium disabled:opacity-50 flex-shrink-0">
                          {importingC === c.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />} Add as Lead
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {customerPage < customerPages && (
                  <div className="flex justify-center pt-2">
                    <button onClick={loadMoreCustomers} disabled={loadingMoreC} className="flex items-center gap-2 px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                      <RefreshCw className={`w-4 h-4 ${loadingMoreC ? 'animate-spin' : ''}`} />
                      {loadingMoreC ? 'Loading...' : `Load More (${totalCustomers - customers.length} remaining)`}
                    </button>
                  </div>
                )}
              </>
            )
          )}
        </div>
      )}

      {/* ── STAGE MAPPING TAB ── */}
      {activeTab === 'mapping' && (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2"><ArrowRight className="w-5 h-5 text-purple-400" /> WooCommerce → CRM Pipeline Mapping</h3>
          <div className="space-y-3">
            {Object.entries(STAGE_MAP).map(([wcStatus, pipeline]) => (
              <div key={wcStatus} className="flex items-center gap-4 p-3 bg-gray-900/30 rounded-lg">
                <span className={`flex-1 px-3 py-1 rounded-full text-xs font-medium text-center ${STATUS_COLORS[wcStatus] || 'bg-gray-500/20 text-gray-400'}`}>WC: {wcStatus}</span>
                <ArrowRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <span className={`flex-1 px-3 py-1 rounded-full text-xs font-medium text-white text-center ${pipeline.color} bg-opacity-20`}>{pipeline.label}</span>
              </div>
            ))}
          </div>
          <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <p className="text-purple-400 text-sm font-medium mb-2">Full pipeline flow:</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
              {['New Lead','Consultation','Quote Sent','Design Review','In Production','Delivered'].map((stage, i, arr) => (
                <span key={stage} className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-gray-700 rounded text-gray-300">{stage}</span>
                  {i < arr.length - 1 && <ArrowRight className="w-3 h-3" />}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SETUP GUIDE TAB ── */}
      {activeTab === 'setup' && (
        <div className="space-y-4">
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Key className="w-5 h-5 text-purple-400" /> Vercel Environment Variables</h3>
            <p className="text-gray-400 text-sm mb-4">Go to your Vercel project → Settings → Environment Variables and add:</p>
            <div className="relative">
              <pre className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-xs text-green-400 font-mono whitespace-pre">{`WC_STORE_URL=https://dirtyhanddesigns.com\nWC_CONSUMER_KEY=ck_your_key_here\nWC_CONSUMER_SECRET=cs_your_secret_here`}</pre>
              <button onClick={() => navigator.clipboard.writeText('WC_STORE_URL=https://dirtyhanddesigns.com\nWC_CONSUMER_KEY=ck_your_key_here\nWC_CONSUMER_SECRET=cs_your_secret_here')} className="absolute top-2 right-2 p-1.5 text-gray-500 hover:text-white bg-gray-800 rounded"><Copy className="w-3 h-3" /></button>
            </div>
            <p className="text-amber-400 text-xs mt-3">After adding variables, redeploy the project.</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Globe className="w-5 h-5 text-blue-400" /> How to Get WooCommerce API Keys</h3>
            <ol className="space-y-3">
              {['Go to dirtyhanddesigns.com/wp-admin','Navigate to WooCommerce → Settings → Advanced → REST API','Click "Add key"','Description: DHD SalesTrail CRM · User: your admin account · Permissions: Read','Click "Generate API key" and copy Consumer Key + Secret'].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                  <span className="text-gray-300 text-sm">{step}</span>
                </li>
              ))}
            </ol>
            <a href="https://dirtyhanddesigns.com/wp-admin/admin.php?page=wc-settings&tab=advanced&section=keys" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm font-medium transition-colors">
              <ExternalLink className="w-4 h-4" /> Open WooCommerce API Settings
            </a>
          </div>
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-yellow-400" /> Real-time Webhook (New Orders)</h3>
            <ol className="space-y-3">
              {['WooCommerce → Settings → Advanced → Webhooks → Add webhook','Name: DHD CRM — New Order · Status: Active · Topic: Order created','Delivery URL: https://dhd-crm-saletrail.vercel.app/api/woocommerce-webhook','Click Save webhook. Repeat for "Order updated" topic.'].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                  <span className="text-gray-300 text-sm">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
