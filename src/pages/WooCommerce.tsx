import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart, CheckCircle, XCircle, RefreshCw, ExternalLink,
  Package, Users, DollarSign, ArrowRight, Key, Globe,
  ChevronDown, ChevronUp, Copy, Zap, UserPlus, AlertCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface WCOrder {
  id: string;
  orderId: number;
  orderNumber: string;
  status: string;
  pipelineStage: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  company: string;
  address: string;
  total: number;
  currency: string;
  lineItems: { name: string; quantity: number; price: number; total: number }[];
  dateCreated: string;
  paymentMethod: string;
  notes: string;
}

interface WCCustomer {
  id: string;
  wcId: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  totalSpent: number;
  ordersCount: number;
  dateRegistered: string;
  avatarUrl: string;
}

const STAGE_MAP: Record<string, { label: string; color: string }> = {
  pending:    { label: 'New Lead',    color: 'bg-gray-500' },
  'on-hold':  { label: 'Consultation', color: 'bg-blue-500' },
  processing: { label: 'Quote Sent',  color: 'bg-yellow-500' },
  completed:  { label: 'Delivered',   color: 'bg-green-500' },
  cancelled:  { label: 'Lost',        color: 'bg-red-500' },
  refunded:   { label: 'Lost',        color: 'bg-red-500' },
  failed:     { label: 'Lost',        color: 'bg-red-500' },
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

const formatCurrency = (amount: number, currency = 'JMD') =>
  `$${amount.toLocaleString()} ${currency}`;

const formatDate = (d: string) =>
  d ? new Date(d).toLocaleDateString('en-JM', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

export default function WooCommerce() {
  const { addDeal, addLead } = useApp();

  const [configured, setConfigured]           = useState<boolean | null>(null);
  const [storeUrl, setStoreUrl]               = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');
  const [connectionInfo, setConnectionInfo]   = useState<any>(null);
  const [activeTab, setActiveTab]             = useState<'orders' | 'customers' | 'mapping' | 'setup'>('orders');

  const [orders, setOrders]                   = useState<WCOrder[]>([]);
  const [totalOrders, setTotalOrders]         = useState(0);
  const [totalPages, setTotalPages]           = useState(1);
  const [currentPage, setCurrentPage]         = useState(1);
  const [loadingMore, setLoadingMore]         = useState(false);
  const [syncing, setSyncing]                 = useState(false);
  const [lastSync, setLastSync]               = useState('');
  const [searchOrder, setSearchOrder]         = useState('');
  const [filterStatus, setFilterStatus]       = useState('all');
  const [expandedOrder, setExpandedOrder]     = useState<string | null>(null);
  const [importedOrders, setImportedOrders]   = useState<Set<string>>(new Set());
  const [importingOrder, setImportingOrder]   = useState<string | null>(null);

  const [customers, setCustomers]             = useState<WCCustomer[]>([]);
  const [totalCustomers, setTotalCustomers]   = useState(0);
  const [customerPages, setCustomerPages]     = useState(1);
  const [customerPage, setCustomerPage]       = useState(1);
  const [loadingMoreCustomers, setLoadingMoreCustomers] = useState(false);
  const [syncingCustomers, setSyncingCustomers] = useState(false);
  const [importedCustomers, setImportedCustomers] = useState<Set<string>>(new Set());
  const [importingCustomer, setImportingCustomer] = useState<string | null>(null);
  const [searchCustomer, setSearchCustomer]   = useState('');

  const [error, setError]                     = useState('');

  // Check if env vars are configured (no credentials leave the browser)
  useEffect(() => {
    fetch('/api/woocommerce?action=configured')
      .then(r => r.json())
      .then(d => {
        setConfigured(d.configured);
        if (d.storeUrl) setStoreUrl(d.storeUrl);
      })
      .catch(() => setConfigured(false));

    const saved = localStorage.getItem('wc_last_sync');
    if (saved) setLastSync(saved);
    const savedOrders = localStorage.getItem('wc_orders');
    if (savedOrders) setOrders(JSON.parse(savedOrders));
    const savedImported = localStorage.getItem('wc_imported_orders');
    if (savedImported) setImportedOrders(new Set(JSON.parse(savedImported)));
    const savedImportedC = localStorage.getItem('wc_imported_customers');
    if (savedImportedC) setImportedCustomers(new Set(JSON.parse(savedImportedC)));
  }, []);

  const testConnection = async () => {
    setConnectionStatus('testing');
    setError('');
    try {
      const r = await fetch('/api/woocommerce?action=test');
      const data = await r.json();
      if (data.success) {
        setConnectionStatus('connected');
        setConnectionInfo(data.store);
      } else {
        setConnectionStatus('failed');
        setError(data.error || 'Connection failed');
      }
    } catch (e: any) {
      setConnectionStatus('failed');
      setError(e.message);
    }
  };

  const syncOrders = useCallback(async () => {
    setSyncing(true);
    setError('');
    try {
      const r = await fetch('/api/woocommerce?action=orders&per_page=100&page=1');
      const data = await r.json();
      if (data.success) {
        setOrders(data.orders);
        setTotalOrders(data.total || data.orders.length);
        setTotalPages(data.pages || 1);
        setCurrentPage(1);
        const t = new Date().toLocaleString();
        setLastSync(t);
        localStorage.setItem('wc_orders', JSON.stringify(data.orders));
        localStorage.setItem('wc_last_sync', t);
      } else {
        setError(data.error || 'Failed to sync orders');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setSyncing(false);
  }, []);

  const loadMoreOrders = useCallback(async () => {
    if (loadingMore || currentPage >= totalPages) return;
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const r = await fetch(`/api/woocommerce?action=orders&per_page=100&page=${nextPage}`);
      const data = await r.json();
      if (data.success) {
        setOrders(prev => {
          const existingIds = new Set(prev.map(o => o.id));
          const newOrders = data.orders.filter((o: WCOrder) => !existingIds.has(o.id));
          return [...prev, ...newOrders];
        });
        setCurrentPage(nextPage);
      } else {
        setError(data.error || 'Failed to load more orders');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoadingMore(false);
  }, [currentPage, totalPages, loadingMore]);

  const syncCustomers = useCallback(async () => {
    setSyncingCustomers(true);
    setError('');
    try {
      const r = await fetch('/api/woocommerce?action=customers&per_page=100&page=1');
      const data = await r.json();
      if (data.success) {
        setCustomers(data.customers);
        setTotalCustomers(data.total || data.customers.length);
        setCustomerPages(data.pages || 1);
        setCustomerPage(1);
      } else {
        setError(data.error || 'Failed to sync customers');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setSyncingCustomers(false);
  }, []);

  const loadMoreCustomers = useCallback(async () => {
    if (loadingMoreCustomers || customerPage >= customerPages) return;
    setLoadingMoreCustomers(true);
    try {
      const nextPage = customerPage + 1;
      const r = await fetch(`/api/woocommerce?action=customers&per_page=100&page=${nextPage}`);
      const data = await r.json();
      if (data.success) {
        setCustomers(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          return [...prev, ...data.customers.filter((c: WCCustomer) => !existingIds.has(c.id))];
        });
        setCustomerPage(nextPage);
      } else {
        setError(data.error || 'Failed to load more customers');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoadingMoreCustomers(false);
  }, [customerPage, customerPages, loadingMoreCustomers]);

  // Auto-sync orders every 15 minutes
  useEffect(() => {
    if (configured !== true) return;
    syncOrders();
    const interval = setInterval(syncOrders, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [configured, syncOrders]);

  const importOrderToPipeline = async (order: WCOrder) => {
    if (importedOrders.has(order.id)) return;
    setImportingOrder(order.id);
    try {
      await addDeal({
        name: `${order.customerName} — WC#${order.orderNumber}`,
        value: order.total,
        stage: order.pipelineStage as any,
        notes: [
          order.notes,
          `WooCommerce #${order.orderNumber}`,
          order.paymentMethod ? `Payment: ${order.paymentMethod}` : '',
          order.lineItems.map(i => `${i.name} ×${i.quantity}`).join(', ')
        ].filter(Boolean).join('\n'),
        source: 'WooCommerce'
      } as any);
      const next = new Set([...importedOrders, order.id]);
      setImportedOrders(next);
      localStorage.setItem('wc_imported_orders', JSON.stringify([...next]));
    } catch (e: any) {
      setError('Import failed: ' + e.message);
    }
    setImportingOrder(null);
  };

  const importCustomerAsLead = async (c: WCCustomer) => {
    if (importedCustomers.has(c.id)) return;
    setImportingCustomer(c.id);
    try {
      await addLead({
        name: c.name,
        email: c.email,
        phone: c.phone,
        company: c.company,
        source: 'WooCommerce',
        status: 'new',
        notes: `WC customer — ${c.ordersCount} orders, ${formatCurrency(c.totalSpent)} total spent`
      } as any);
      const next = new Set([...importedCustomers, c.id]);
      setImportedCustomers(next);
      localStorage.setItem('wc_imported_customers', JSON.stringify([...next]));
    } catch (e: any) {
      setError('Import failed: ' + e.message);
    }
    setImportingCustomer(null);
  };

  const filteredOrders = orders.filter(o => {
    const q = searchOrder.toLowerCase();
    const matchSearch = !q || o.customerName.toLowerCase().includes(q) ||
      o.orderNumber.includes(q) || o.customerEmail.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const filteredCustomers = customers.filter(c => {
    const q = searchCustomer.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) || c.phone.includes(q);
  });

  const stats = {
    total: totalOrders || orders.length,
    processing: orders.filter(o => o.status === 'processing').length,
    completed: orders.filter(o => o.status === 'completed').length,
    revenue: orders.filter(o => o.status === 'completed').reduce((s, o) => s + o.total, 0),
    customers: totalCustomers || customers.length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-purple-400" />
            WooCommerce
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {storeUrl || 'dirtyhanddesigns.com'} orders &amp; customers
            {lastSync && <span className="ml-2 text-gray-600">· Last sync {lastSync}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {configured === true && (
            <button
              onClick={syncOrders}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
        </div>
      </div>

      {/* Config status */}
      {configured === false && (
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-400 font-medium text-sm">Environment variables not set</p>
            <p className="text-gray-400 text-xs mt-1">
              Add <code className="text-purple-400">WC_STORE_URL</code>, <code className="text-purple-400">WC_CONSUMER_KEY</code>, and <code className="text-purple-400">WC_CONSUMER_SECRET</code> to your Vercel project settings, then redeploy.
            </p>
          </div>
        </div>
      )}

      {configured === true && connectionStatus === 'idle' && (
        <div className="flex items-center justify-between p-4 bg-gray-800/40 border border-gray-700/50 rounded-xl">
          <p className="text-gray-300 text-sm">Credentials configured. Test the connection to verify.</p>
          <button
            onClick={testConnection}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Test Connection
          </button>
        </div>
      )}

      {connectionStatus === 'testing' && (
        <div className="flex items-center gap-3 p-4 bg-gray-800/40 border border-gray-700/50 rounded-xl">
          <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
          <p className="text-gray-400 text-sm">Testing connection...</p>
        </div>
      )}

      {connectionStatus === 'connected' && connectionInfo && (
        <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-green-400 font-medium text-sm">{connectionInfo.name}</p>
              <p className="text-gray-400 text-xs">{connectionInfo.url} · WooCommerce {connectionInfo.version} · {connectionInfo.currency}</p>
            </div>
          </div>
        </div>
      )}

      {connectionStatus === 'failed' && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <XCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-400 text-sm">{error || 'Connection failed. Check your credentials in Vercel.'}</p>
        </div>
      )}

      {error && connectionStatus !== 'failed' && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <XCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Stats */}
      {orders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Orders',  value: stats.total,                       icon: Package,       color: 'text-purple-400' },
            { label: 'Processing',    value: stats.processing,                  icon: RefreshCw,     color: 'text-yellow-400' },
            { label: 'Completed',     value: stats.completed,                   icon: CheckCircle,   color: 'text-green-400'  },
            { label: 'Revenue',       value: formatCurrency(stats.revenue),     icon: DollarSign,    color: 'text-amber-400'  },
            { label: 'Customers',     value: stats.customers || customers.length, icon: Users,       color: 'text-blue-400'   },
          ].map((s, i) => (
            <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-gray-400 text-xs">{s.label}</span>
              </div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700/50">
        {[
          { id: 'orders',    label: `Orders${orders.length ? ` (${orders.length})` : ''}` },
          { id: 'customers', label: `Customers${customers.length ? ` (${customers.length})` : ''}` },
          { id: 'mapping',   label: 'Stage Mapping' },
          { id: 'setup',     label: 'Setup Guide' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              if (tab.id === 'customers' && customers.length === 0) syncCustomers();
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ORDERS TAB */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-12 text-center">
              <ShoppingCart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 font-medium">No orders synced yet</p>
              <p className="text-gray-500 text-sm mt-1 mb-4">
                {configured === true ? 'Click Sync Now to load orders' : 'Configure credentials in the Setup Guide first'}
              </p>
              {configured === true && (
                <button onClick={syncOrders} disabled={syncing} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                  {syncing ? 'Syncing...' : 'Sync Orders'}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={searchOrder}
                  onChange={e => setSearchOrder(e.target.value)}
                  placeholder="Search by name, order #, email..."
                  className="flex-1 bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                />
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="on-hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {totalOrders > orders.length && (
                <p className="text-gray-500 text-xs text-right">
                  Showing {orders.length} of {totalOrders} orders
                </p>
              )}

              <div className="space-y-3">
                {filteredOrders.map(order => (
                  <div key={order.id} className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden">
                    <div className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-16 flex-shrink-0">
                          <p className="text-white font-medium text-sm">#{order.orderNumber}</p>
                          <p className="text-gray-500 text-xs">{formatDate(order.dateCreated)}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{order.customerName}</p>
                          <p className="text-gray-400 text-xs truncate">{order.customerEmail}</p>
                        </div>
                        <span className={`hidden md:inline-flex px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-gray-500/20 text-gray-400'}`}>
                          {order.status}
                        </span>
                        <div className="hidden md:flex items-center gap-2">
                          <ArrowRight className="w-3 h-3 text-gray-500" />
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300">
                            {STAGE_MAP[order.status]?.label || 'New Lead'}
                          </span>
                        </div>
                        <p className="text-amber-400 font-bold text-sm whitespace-nowrap">
                          {formatCurrency(order.total, order.currency)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {importedOrders.has(order.id) ? (
                          <span className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs font-medium">
                            <CheckCircle className="w-3 h-3" /> In Pipeline
                          </span>
                        ) : (
                          <button
                            onClick={() => importOrderToPipeline(order)}
                            disabled={importingOrder === order.id}
                            className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            {importingOrder === order.id
                              ? <RefreshCw className="w-3 h-3 animate-spin" />
                              : <ArrowRight className="w-3 h-3" />}
                            Import
                          </button>
                        )}
                        <button
                          onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                          className="p-1.5 text-gray-400 hover:text-white"
                        >
                          {expandedOrder === order.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {expandedOrder === order.id && (
                      <div className="border-t border-gray-700/50 p-4 bg-gray-900/30 space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {[
                            { label: 'Phone',   value: order.customerPhone },
                            { label: 'Company', value: order.company },
                            { label: 'Payment', value: order.paymentMethod },
                            { label: 'Address', value: order.address },
                          ].map(f => (
                            <div key={f.label}>
                              <p className="text-gray-500 text-xs">{f.label}</p>
                              <p className="text-white text-sm">{f.value || 'N/A'}</p>
                            </div>
                          ))}
                        </div>
                        {order.lineItems.length > 0 && (
                          <div>
                            <p className="text-gray-400 text-xs font-medium mb-2">Items:</p>
                            <div className="space-y-1">
                              {order.lineItems.map((item, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                  <span className="text-gray-300">{item.name} × {item.quantity}</span>
                                  <span className="text-amber-400">{formatCurrency(item.total, order.currency)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {order.notes && (
                          <div>
                            <p className="text-gray-400 text-xs font-medium mb-1">Customer Note:</p>
                            <p className="text-gray-300 text-sm">{order.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {currentPage < totalPages && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={loadMoreOrders}
                    disabled={loadingMore}
                    className="flex items-center gap-2 px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingMore ? 'animate-spin' : ''}`} />
                    {loadingMore ? 'Loading...' : `Load More (${totalOrders - orders.length} remaining)`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* CUSTOMERS TAB */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <input
              type="text"
              value={searchCustomer}
              onChange={e => setSearchCustomer(e.target.value)}
              placeholder="Search customers..."
              className="flex-1 mr-3 bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={syncCustomers}
              disabled={syncingCustomers}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncingCustomers ? 'animate-spin' : ''}`} />
              {syncingCustomers ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {customers.length === 0 ? (
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-12 text-center">
              <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 font-medium">{syncingCustomers ? 'Loading customers...' : 'No customers loaded'}</p>
            </div>
          ) : (
            <>
              {totalCustomers > customers.length && (
                <p className="text-gray-500 text-xs text-right">
                  Showing {customers.length} of {totalCustomers} customers
                </p>
              )}
            <div className="space-y-3">
              {filteredCustomers.map(c => (
                <div key={c.id} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{c.name}</p>
                      <p className="text-gray-400 text-xs truncate">{c.email}</p>
                    </div>
                    <div className="hidden md:block text-center">
                      <p className="text-white text-sm font-medium">{c.ordersCount}</p>
                      <p className="text-gray-500 text-xs">orders</p>
                    </div>
                    <div className="hidden md:block text-center">
                      <p className="text-amber-400 text-sm font-bold">{formatCurrency(c.totalSpent)}</p>
                      <p className="text-gray-500 text-xs">total spent</p>
                    </div>
                    {c.phone && <p className="hidden lg:block text-gray-400 text-xs">{c.phone}</p>}
                  </div>
                  {importedCustomers.has(c.id) ? (
                    <span className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs font-medium flex-shrink-0">
                      <CheckCircle className="w-3 h-3" /> In CRM
                    </span>
                  ) : (
                    <button
                      onClick={() => importCustomerAsLead(c)}
                      disabled={importingCustomer === c.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {importingCustomer === c.id
                        ? <RefreshCw className="w-3 h-3 animate-spin" />
                        : <UserPlus className="w-3 h-3" />}
                      Add as Lead
                    </button>
                  )}
                </div>
              ))}
            </div>

              {customerPage < customerPages && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={loadMoreCustomers}
                    disabled={loadingMoreCustomers}
                    className="flex items-center gap-2 px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingMoreCustomers ? 'animate-spin' : ''}`} />
                    {loadingMoreCustomers ? 'Loading...' : `Load More (${totalCustomers - customers.length} remaining)`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* STAGE MAPPING TAB */}
      {activeTab === 'mapping' && (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-purple-400" />
            WooCommerce → CRM Pipeline Mapping
          </h3>
          <div className="space-y-3">
            {Object.entries(STAGE_MAP).map(([wcStatus, pipeline]) => (
              <div key={wcStatus} className="flex items-center gap-4 p-3 bg-gray-900/30 rounded-lg">
                <span className={`flex-1 px-3 py-1 rounded-full text-xs font-medium text-center ${STATUS_COLORS[wcStatus] || 'bg-gray-500/20 text-gray-400'}`}>
                  WC: {wcStatus}
                </span>
                <ArrowRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <span className={`flex-1 px-3 py-1 rounded-full text-xs font-medium text-white text-center ${pipeline.color} bg-opacity-20`}>
                  {pipeline.label}
                </span>
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

      {/* SETUP GUIDE TAB */}
      {activeTab === 'setup' && (
        <div className="space-y-4">
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-purple-400" />
              Vercel Environment Variables
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Go to your Vercel project → Settings → Environment Variables and add:
            </p>
            <div className="relative">
              <pre className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-xs text-green-400 font-mono whitespace-pre">
{`WC_STORE_URL=https://dirtyhanddesigns.com
WC_CONSUMER_KEY=ck_your_key_here
WC_CONSUMER_SECRET=cs_your_secret_here`}
              </pre>
              <button
                onClick={() => navigator.clipboard.writeText('WC_STORE_URL=https://dirtyhanddesigns.com\nWC_CONSUMER_KEY=ck_your_key_here\nWC_CONSUMER_SECRET=cs_your_secret_here')}
                className="absolute top-2 right-2 p-1.5 text-gray-500 hover:text-white bg-gray-800 rounded"
                title="Copy"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            <p className="text-amber-400 text-xs mt-3">After adding variables, redeploy the project for them to take effect.</p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-400" />
              How to Get WooCommerce API Keys
            </h3>
            <ol className="space-y-3">
              {[
                'Go to dirtyhanddesigns.com/wp-admin',
                'Navigate to WooCommerce → Settings → Advanced → REST API',
                'Click "Add key"',
                'Description: DHD SalesTrail CRM · User: your admin account · Permissions: Read',
                'Click "Generate API key" and copy Consumer Key + Secret',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-gray-300 text-sm">{step}</span>
                </li>
              ))}
            </ol>
            <a
              href="https://dirtyhanddesigns.com/wp-admin/admin.php?page=wc-settings&tab=advanced&section=keys"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open WooCommerce API Settings
            </a>
          </div>

          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Real-time Webhook (New Orders)
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Set up a WooCommerce webhook so new orders appear in the CRM automatically:
            </p>
            <ol className="space-y-3">
              {[
                'WooCommerce → Settings → Advanced → Webhooks → Add webhook',
                'Name: DHD CRM — New Order · Status: Active · Topic: Order created',
                `Delivery URL: https://dhd-crm-saletrail.vercel.app/api/woocommerce-webhook`,
                'Click Save webhook. Repeat for "Order updated" topic.',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
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
