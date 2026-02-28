import { useState, useEffect } from 'react';
import {
  ShoppingCart, CheckCircle, XCircle, RefreshCw, ExternalLink,
  Package, Users, DollarSign, ArrowRight, Key, Globe, Lock,
  ChevronDown, ChevronUp, Copy, Info, Zap
} from 'lucide-react';

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

interface WCSettings {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

const STAGE_MAP: Record<string, { label: string; color: string }> = {
  'pending': { label: 'New Lead', color: 'bg-gray-500' },
  'on-hold': { label: 'Consultation', color: 'bg-blue-500' },
  'processing': { label: 'Quote Sent', color: 'bg-yellow-500' },
  'completed': { label: 'Delivered ✓', color: 'bg-green-500' },
  'cancelled': { label: 'Lost ✕', color: 'bg-red-500' },
  'refunded': { label: 'Lost ✕', color: 'bg-red-500' },
  'failed': { label: 'Lost ✕', color: 'bg-red-500' }
};

const STATUS_COLORS: Record<string, string> = {
  'pending': 'bg-gray-500/20 text-gray-400',
  'processing': 'bg-yellow-500/20 text-yellow-400',
  'on-hold': 'bg-blue-500/20 text-blue-400',
  'completed': 'bg-green-500/20 text-green-400',
  'cancelled': 'bg-red-500/20 text-red-400',
  'refunded': 'bg-red-500/20 text-red-400',
  'failed': 'bg-red-500/20 text-red-400'
};

export default function WooCommerce() {
  const [settings, setSettings] = useState<WCSettings>(() => {
    const saved = localStorage.getItem('wc_settings');
    return saved ? JSON.parse(saved) : {
      storeUrl: 'https://dirtyhanddesigns.com',
      consumerKey: '',
      consumerSecret: ''
    };
  });

  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  const [orders, setOrders] = useState<WCOrder[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'connect' | 'orders' | 'setup' | 'mapping'>('connect');
  const [showSecret, setShowSecret] = useState(false);
  const [searchOrder, setSearchOrder] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [importingOrder, setImportingOrder] = useState<string | null>(null);
  const [importedOrders, setImportedOrders] = useState<string[]>(() => {
    const saved = localStorage.getItem('wc_imported_orders');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const savedSync = localStorage.getItem('wc_last_sync');
    if (savedSync) setLastSync(savedSync);
    const savedOrders = localStorage.getItem('wc_orders');
    if (savedOrders) setOrders(JSON.parse(savedOrders));
  }, []);

  const saveSettings = () => {
    localStorage.setItem('wc_settings', JSON.stringify(settings));
    setError('');
    alert('Settings saved!');
  };

  const testConnection = async () => {
    if (!settings.storeUrl || !settings.consumerKey || !settings.consumerSecret) {
      setError('Please fill in all fields before testing connection.');
      return;
    }
    setConnectionStatus('testing');
    setError('');
    try {
      const params = new URLSearchParams({
        action: 'test',
        storeUrl: settings.storeUrl,
        consumerKey: settings.consumerKey,
        consumerSecret: settings.consumerSecret
      });
      const response = await fetch(`/api/woocommerce?${params}`);
      const data = await response.json();
      if (data.success) {
        setConnectionStatus('connected');
        setConnectionInfo(data.store);
        localStorage.setItem('wc_settings', JSON.stringify(settings));
      } else {
        setConnectionStatus('failed');
        setError(data.error || 'Connection failed');
      }
    } catch (err: any) {
      setConnectionStatus('failed');
      setError(`Connection error: ${err.message}. Make sure you are running on Vercel.`);
    }
  };

  const syncOrders = async () => {
    setSyncing(true);
    setError('');
    try {
      const params = new URLSearchParams({
        action: 'orders',
        storeUrl: settings.storeUrl,
        consumerKey: settings.consumerKey,
        consumerSecret: settings.consumerSecret,
        per_page: '50'
      });
      const response = await fetch(`/api/woocommerce?${params}`);
      const data = await response.json();
      if (data.success) {
        setOrders(data.orders);
        const syncTime = new Date().toLocaleString();
        setLastSync(syncTime);
        localStorage.setItem('wc_orders', JSON.stringify(data.orders));
        localStorage.setItem('wc_last_sync', syncTime);
        setActiveTab('orders');
      } else {
        setError(data.error || 'Failed to sync orders');
      }
    } catch (err: any) {
      setError(`Sync error: ${err.message}. Make sure you are running on Vercel.`);
    } finally {
      setSyncing(false);
    }
  };

  const importOrderToPipeline = (order: WCOrder) => {
    setImportingOrder(order.id);
    setTimeout(() => {
      const existingDeals = JSON.parse(localStorage.getItem('dhd_deals') || '[]');
      const alreadyExists = existingDeals.find((d: any) => d.id === order.id);
      if (!alreadyExists) {
        const newDeal = {
          id: order.id,
          name: `${order.customerName} - WC#${order.orderNumber}`,
          company: order.company || order.customerName,
          contact: order.customerName,
          phone: order.customerPhone,
          email: order.customerEmail,
          value: order.total,
          stage: order.pipelineStage,
          repId: 'rep1',
          repName: 'Unassigned',
          createdAt: order.dateCreated,
          notes: order.notes,
          source: 'WooCommerce'
        };
        existingDeals.push(newDeal);
        localStorage.setItem('dhd_deals', JSON.stringify(existingDeals));
      }
      const newImported = [...importedOrders, order.id];
      setImportedOrders(newImported);
      localStorage.setItem('wc_imported_orders', JSON.stringify(newImported));
      setImportingOrder(null);
    }, 800);
  };

  const formatJMD = (amount: number) => `$${amount.toLocaleString()} JMD`;
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-JM', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const filteredOrders = orders.filter(o => {
    const matchSearch = !searchOrder ||
      o.customerName.toLowerCase().includes(searchOrder.toLowerCase()) ||
      o.orderNumber.includes(searchOrder) ||
      o.customerEmail.toLowerCase().includes(searchOrder.toLowerCase());
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing').length,
    completed: orders.filter(o => o.status === 'completed').length,
    revenue: orders.filter(o => o.status === 'completed').reduce((s, o) => s + o.total, 0)
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-purple-400" />
            WooCommerce Integration
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Connect dirtyhanddesigns.com orders to your CRM pipeline
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastSync && (
            <span className="text-xs text-gray-500">Last sync: {lastSync}</span>
          )}
          {connectionStatus === 'connected' && (
            <button
              onClick={syncOrders}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Orders'}
            </button>
          )}
        </div>
      </div>

      {/* Vercel Notice */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-blue-400 font-medium text-sm">Vercel Deployment Required</p>
          <p className="text-gray-400 text-xs mt-1">
            This integration uses a Vercel serverless function (<code className="text-purple-400">/api/woocommerce</code>) to securely proxy WooCommerce API calls.
            It will work automatically once deployed to Vercel. Running locally will show connection errors.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Connection Status Banner */}
      {connectionStatus === 'connected' && connectionInfo && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <div>
              <p className="text-green-400 font-medium">Connected to {connectionInfo.name}</p>
              <p className="text-gray-400 text-xs">{connectionInfo.url} • WooCommerce {connectionInfo.version} • Currency: {connectionInfo.currency}</p>
            </div>
          </div>
          <button onClick={syncOrders} disabled={syncing} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
            Sync Now
          </button>
        </div>
      )}

      {/* Stats */}
      {orders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Orders', value: stats.total, icon: Package, color: 'text-purple-400' },
            { label: 'Pending', value: stats.pending, icon: Zap, color: 'text-gray-400' },
            { label: 'Processing', value: stats.processing, icon: RefreshCw, color: 'text-yellow-400' },
            { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-green-400' },
            { label: 'Revenue', value: formatJMD(stats.revenue), icon: DollarSign, color: 'text-amber-400' }
          ].map((stat, i) => (
            <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <span className="text-gray-400 text-xs">{stat.label}</span>
              </div>
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700/50">
        {[
          { id: 'connect', label: '🔌 Connect' },
          { id: 'orders', label: `📦 Orders ${orders.length > 0 ? `(${orders.length})` : ''}` },
          { id: 'mapping', label: '🗺️ Stage Mapping' },
          { id: 'setup', label: '📖 Setup Guide' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
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

      {/* Connect Tab */}
      {activeTab === 'connect' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 space-y-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Key className="w-5 h-5 text-purple-400" />
              API Credentials
            </h3>

            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Store URL</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={settings.storeUrl}
                  onChange={e => setSettings(prev => ({ ...prev, storeUrl: e.target.value }))}
                  placeholder="https://dirtyhanddesigns.com"
                  className="w-full bg-gray-900/50 border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Consumer Key</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={settings.consumerKey}
                  onChange={e => setSettings(prev => ({ ...prev, consumerKey: e.target.value }))}
                  placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-gray-900/50 border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Consumer Secret</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={settings.consumerSecret}
                  onChange={e => setSettings(prev => ({ ...prev, consumerSecret: e.target.value }))}
                  placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-gray-900/50 border border-gray-600 rounded-lg pl-10 pr-10 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 font-mono"
                />
                <button onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  {showSecret ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={saveSettings} className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">
                Save Settings
              </button>
              <button
                onClick={testConnection}
                disabled={connectionStatus === 'testing'}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {connectionStatus === 'testing' ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Testing...</>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> Test Connection</>
                )}
              </button>
            </div>

            {connectionStatus === 'failed' && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <XCircle className="w-4 h-4 text-red-400" />
                <p className="text-red-400 text-xs">Connection failed. Check your credentials.</p>
              </div>
            )}
          </div>

          {/* How to get API keys */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-400" />
              How to Get API Keys
            </h3>
            <ol className="space-y-3">
              {[
                { step: '1', text: 'Go to dirtyhanddesigns.com/wp-admin' },
                { step: '2', text: 'Navigate to WooCommerce → Settings' },
                { step: '3', text: 'Click the "Advanced" tab' },
                { step: '4', text: 'Click "REST API" in the submenu' },
                { step: '5', text: 'Click "Add key" button' },
                { step: '6', text: 'Description: "DHD SalesTrail CRM"' },
                { step: '7', text: 'User: Select your admin account' },
                { step: '8', text: 'Permissions: Select "Read"' },
                { step: '9', text: 'Click "Generate API key"' },
                { step: '10', text: 'Copy Consumer Key & Consumer Secret' }
              ].map(item => (
                <li key={item.step} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {item.step}
                  </span>
                  <span className="text-gray-300 text-sm">{item.text}</span>
                </li>
              ))}
            </ol>
            <a
              href="https://dirtyhanddesigns.com/wp-admin/admin.php?page=wc-settings&tab=advanced&section=keys"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open WooCommerce API Settings
            </a>
          </div>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-12 text-center">
              <ShoppingCart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 font-medium">No orders synced yet</p>
              <p className="text-gray-500 text-sm mt-1 mb-4">Connect to WooCommerce and sync to see your orders here</p>
              <button
                onClick={() => setActiveTab('connect')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Connect WooCommerce
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={searchOrder}
                  onChange={e => setSearchOrder(e.target.value)}
                  placeholder="Search orders..."
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

              <div className="space-y-3">
                {filteredOrders.map(order => (
                  <div key={order.id} className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden">
                    <div className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div>
                          <p className="text-white font-medium text-sm">#{order.orderNumber}</p>
                          <p className="text-gray-400 text-xs">{formatDate(order.dateCreated)}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{order.customerName}</p>
                          <p className="text-gray-400 text-xs truncate">{order.customerEmail}</p>
                        </div>
                        <div className="hidden md:block">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-gray-500/20 text-gray-400'}`}>
                            {order.status}
                          </span>
                        </div>
                        <div className="hidden md:flex items-center gap-2">
                          <ArrowRight className="w-3 h-3 text-gray-500" />
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${STAGE_MAP[order.status]?.color || 'bg-gray-500'} bg-opacity-20 text-white`}>
                            {STAGE_MAP[order.status]?.label || 'New Lead'}
                          </span>
                        </div>
                        <p className="text-amber-400 font-bold text-sm whitespace-nowrap">{formatJMD(order.total)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {importedOrders.includes(order.id) ? (
                          <span className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs font-medium">
                            <CheckCircle className="w-3 h-3" />
                            In Pipeline
                          </span>
                        ) : (
                          <button
                            onClick={() => importOrderToPipeline(order)}
                            disabled={importingOrder === order.id}
                            className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            {importingOrder === order.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <ArrowRight className="w-3 h-3" />
                            )}
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
                      <div className="border-t border-gray-700/50 p-4 bg-gray-900/30">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-gray-500 text-xs">Phone</p>
                            <p className="text-white text-sm">{order.customerPhone || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">Company</p>
                            <p className="text-white text-sm">{order.company || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">Payment</p>
                            <p className="text-white text-sm">{order.paymentMethod || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">Address</p>
                            <p className="text-white text-sm">{order.address || 'N/A'}</p>
                          </div>
                        </div>
                        {order.lineItems.length > 0 && (
                          <div>
                            <p className="text-gray-400 text-xs font-medium mb-2">Order Items:</p>
                            <div className="space-y-1">
                              {order.lineItems.map((item, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                  <span className="text-gray-300">{item.name} × {item.quantity}</span>
                                  <span className="text-amber-400">{formatJMD(item.total)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {order.notes && (
                          <div className="mt-3">
                            <p className="text-gray-400 text-xs font-medium mb-1">Customer Note:</p>
                            <p className="text-gray-300 text-sm">{order.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Stage Mapping Tab */}
      {activeTab === 'mapping' && (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-6 flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-purple-400" />
            WooCommerce → Pipeline Stage Mapping
          </h3>
          <div className="space-y-3">
            {Object.entries(STAGE_MAP).map(([wcStatus, pipeline]) => (
              <div key={wcStatus} className="flex items-center gap-4 p-3 bg-gray-900/30 rounded-lg">
                <div className="flex-1">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[wcStatus] || 'bg-gray-500/20 text-gray-400'}`}>
                    WC: {wcStatus}
                  </span>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <div className="flex-1 text-right">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${pipeline.color} bg-opacity-20`}>
                    CRM: {pipeline.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <p className="text-purple-400 text-sm font-medium mb-2">Branding Agency Flow:</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
              {['New Lead', 'Consultation', 'Quote Sent', 'Design Review', 'In Production', 'Delivered ✓'].map((stage, i, arr) => (
                <span key={stage} className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-gray-700 rounded text-gray-300">{stage}</span>
                  {i < arr.length - 1 && <ArrowRight className="w-3 h-3" />}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Setup Guide Tab */}
      {activeTab === 'setup' && (
        <div className="space-y-4">
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Vercel Deployment Setup
            </h3>
            <ol className="space-y-4">
              {[
                {
                  step: '1',
                  title: 'Push to GitHub',
                  desc: 'Push your DHD SalesTrail code to a GitHub repository'
                },
                {
                  step: '2',
                  title: 'Connect to Vercel',
                  desc: 'Go to vercel.com → Import from GitHub → Select your repo → Deploy'
                },
                {
                  step: '3',
                  title: 'Add Environment Variables',
                  desc: 'In Vercel dashboard → Settings → Environment Variables → Add:',
                  code: 'WC_STORE_URL=https://dirtyhanddesigns.com\nWC_CONSUMER_KEY=ck_your_key_here\nWC_CONSUMER_SECRET=cs_your_secret_here'
                },
                {
                  step: '4',
                  title: 'Redeploy',
                  desc: 'Trigger a new deployment for environment variables to take effect'
                },
                {
                  step: '5',
                  title: 'Test Connection',
                  desc: 'Go to WooCommerce page → Connect tab → Click "Test Connection"'
                }
              ].map(item => (
                <li key={item.step} className="flex items-start gap-4">
                  <span className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center flex-shrink-0">
                    {item.step}
                  </span>
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">{item.title}</p>
                    <p className="text-gray-400 text-xs mt-1">{item.desc}</p>
                    {item.code && (
                      <div className="mt-2 relative">
                        <pre className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-green-400 font-mono">{item.code}</pre>
                        <button
                          onClick={() => navigator.clipboard.writeText(item.code || '')}
                          className="absolute top-2 right-2 p-1 text-gray-500 hover:text-white"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              WooCommerce Webhook Setup (Real-time Sync)
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Set up webhooks so new orders appear in the CRM automatically without manual syncing:
            </p>
            <ol className="space-y-3 text-sm">
              {[
                'Go to WooCommerce → Settings → Advanced → Webhooks',
                'Click "Add webhook"',
                'Name: "DHD CRM - New Order"',
                'Status: Active',
                'Topic: Order created',
                'Delivery URL: https://your-app.vercel.app/api/woocommerce-webhook',
                'Secret: Create a random string and save it',
                'Click Save webhook',
                'Repeat for "Order updated" topic'
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-gray-300">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
