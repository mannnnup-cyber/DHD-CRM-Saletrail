import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Save, Shield, Smartphone, Globe, Mail, Bot, Link2, CheckCircle, XCircle, Loader2, Eye, EyeOff, MessageCircle
} from 'lucide-react';

interface SettingItem {
  key: string;
  value: string;
  type: 'text' | 'password' | 'number' | 'boolean';
  description: string;
  category: string;
  isEncrypted: boolean;
}

interface SettingsByCategory {
  email: SettingItem[];
  api: SettingItem[];
  integrations: SettingItem[];
  [key: string]: SettingItem[]; // allow dynamic categories
}

const Settings: React.FC = () => {
  const { state, updateSettings } = useApp();
  const settings = state.settings;

  const [activeTab, setActiveTab] = useState<'email' | 'api' | 'integrations' | 'automation'>('email');
  const [_dbSettings, setDbSettings] = useState<SettingsByCategory>({
    email: [],
    api: [],
    integrations: []
  });
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [isConfigured, setIsConfigured] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [tableNotFound, setTableNotFound] = useState(false);

  // Evolution API WhatsApp state
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppQrCode, setWhatsAppQrCode] = useState<string | null>(null);
  const [whatsAppInstanceName, setWhatsAppInstanceName] = useState<string | null>(null);
  const [whatsAppPhoneLinked, setWhatsAppPhoneLinked] = useState<string | null>(null);
  const [whatsAppPolling, setWhatsAppPolling] = useState(false);
  const [whatsAppScanning, setWhatsAppScanning] = useState(false);

  // Load settings from database
  useEffect(() => {
    loadSettings();
  }, []);

  // Initialize WhatsApp linked state from settings
  useEffect(() => {
    // Show as linked if either phone OR instance name exists
    if (localValues['EVOLUTION_PHONE'] || localValues['EVOLUTION_INSTANCE_NAME']) {
      setWhatsAppPhoneLinked(localValues['EVOLUTION_PHONE'] || 'WhatsApp Linked');
      setWhatsAppInstanceName(localValues['EVOLUTION_INSTANCE_NAME']);
    } else {
      setWhatsAppPhoneLinked(null);
      setWhatsAppInstanceName(null);
    }
  }, [localValues['EVOLUTION_PHONE'], localValues['EVOLUTION_INSTANCE_NAME']]);

  const STORAGE_KEY = 'dhd_crm_settings';

  // Always load from localStorage first — instant and reliable
  const loadFromStorage = (): Record<string, string> => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  };

  const loadSettings = async () => {
    setLoading(true);

    // 1. Load localStorage immediately so UI is never blank
    const stored = loadFromStorage();
    if (Object.keys(stored).length > 0) {
      setLocalValues(stored);
      const configured: Record<string, boolean> = {};
      Object.entries(stored).forEach(([k, v]) => { configured[k] = !!v; });
      setIsConfigured(configured);
    }

    // 2. Try Supabase in background — merge if it returns more/newer data
    try {
      const r = await fetch('/api/settings?action=list');
      const data = await r.json();
      if (!data.success && data.tableError) {
        setTableNotFound(true);
      } else if (data.success && data.settings && Object.keys(data.settings).length > 0) {
        setTableNotFound(false);
        const rawValues: Record<string, string> = { ...stored };
        Object.entries(data.settings).forEach(([key, value]) => {
          const isPasswordKey = key.includes('PASSWORD') || key.includes('KEY') || key.includes('SECRET');
          const isMasked = value === '••••••••';
          // Keep locally-typed password over the masked DB value
          if (isPasswordKey && isMasked) return;
          rawValues[key] = value as string;
        });
        setLocalValues(rawValues);
        setIsConfigured(data.isConfigured || {});
        // Keep localStorage in sync with DB values
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rawValues));
      }
    } catch (error) {
      console.error('Error loading settings from API:', error);
    }
    setLoading(false);
  };

  const handleValueChange = (key: string, value: string) => {
    setLocalValues(prev => ({ ...prev, [key]: value }));
    setMessage(null);
  };

  const togglePasswordVisibility = (key: string) => {
    setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    // Always save to localStorage first — this is the reliable fallback
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localValues));
    } catch (e) {
      console.error('localStorage save failed:', e);
    }

    // Also attempt to sync to Supabase (best-effort)
    try {
      const r = await fetch('/api/settings?action=save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: localValues })
      });
      const data = await r.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Settings saved!' });
      } else {
        if (data.tableError) setTableNotFound(true);
        // Still show success since localStorage save worked
        setMessage({ type: 'success', text: 'Settings saved locally. (Database table not set up yet — see notice above)' });
      }
    } catch (error) {
      // API unreachable — localStorage save still succeeded
      setMessage({ type: 'success', text: 'Settings saved locally.' });
    }
    setSaving(false);
  };

  const handleTest = async (type: 'email' | 'resend' | 'openai') => {
    setTesting(type);
    setMessage(null);

    try {
      if (type === 'email') {
        const r = await fetch('/api/settings?action=testEmail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: localValues['IMAP_HOST'],
            port: localValues['IMAP_PORT'],
            user: localValues['IMAP_USER'],
            password: localValues['IMAP_PASSWORD']
          })
        });
        const data = await r.json();
        setMessage({ type: data.success ? 'success' : 'error', text: data.message || data.error });
      } else if (type === 'resend') {
        const r = await fetch('/api/settings?action=testResend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: localValues['RESEND_API_KEY'] })
        });
        const data = await r.json();
        setMessage({ type: data.success ? 'success' : 'error', text: data.message || data.error });
      } else if (type === 'openai') {
        const r = await fetch('/api/settings?action=testOpenAI', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: localValues['OPENAI_API_KEY'] })
        });
        const data = await r.json();
        setMessage({ type: data.success ? 'success' : 'error', text: data.message || data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Test failed' });
    }
    setTesting(null);
  };

  const handleToggle = (key: keyof typeof settings) => {
    updateSettings({ [key]: !settings[key] });
  };

  // WhatsApp Evolution API handlers
  const handleLinkWhatsApp = async () => {
    setWhatsAppScanning(true);
    setMessage(null);

    try {
      const r = await fetch('/api/whatsapp?action=createInstance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await r.json();

      if (!data.success) {
        setMessage({ type: 'error', text: data.message || 'Failed to create instance' });
        setWhatsAppScanning(false);
        return;
      }

      setWhatsAppInstanceName(data.instanceName);
      setWhatsAppQrCode(data.qrCode);
      setShowWhatsAppModal(true);

      // Start polling for authentication
      pollWhatsAppStatus(data.instanceName);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create WhatsApp instance' });
      setWhatsAppScanning(false);
    }
  };

  const pollWhatsAppStatus = async (instanceName: string, attempt = 0) => {
    if (attempt > 30) { // 30 second timeout (reduced from 120) - Evolution API endpoints may timeout
      // Polling timeout - show manual verify button instead
      setMessage({ type: 'error', text: 'Could not auto-verify. Check your phone - if connected, click "Verify Connection" below.' });
      setWhatsAppPolling(false);
      // Keep modal open so user can click verify button
      return;
    }

    setWhatsAppPolling(true);

    try {
      const r = await fetch(`/api/whatsapp?action=getInstanceStatus&instanceName=${instanceName}`, {
        signal: AbortSignal.timeout(5000) // 5 second timeout per request
      });
      const data = await r.json();

      if (data.success && data.authenticated) {
        setWhatsAppPhoneLinked(data.phone || 'WhatsApp Linked');
        setMessage({ type: 'success', text: `WhatsApp linked: ${data.phone || 'Connected'}` });
        setShowWhatsAppModal(false);
        setWhatsAppPolling(false);
        setWhatsAppScanning(false);
        // Reload settings to show linked state
        setTimeout(() => loadSettings(), 1000);
        return;
      }

      // Still not authenticated, poll again in 1 second
      setTimeout(() => pollWhatsAppStatus(instanceName, attempt + 1), 1000);
    } catch (error) {
      console.error('Polling error:', error);
      // If timeout after a few attempts, stop polling and show manual verify button
      if (attempt > 10) {
        setMessage({ type: 'error', text: 'Could not auto-verify. Check your phone - if connected, click "Verify Connection" below.' });
        setWhatsAppPolling(false);
        return;
      }
      // Continue polling on error
      setTimeout(() => pollWhatsAppStatus(instanceName, attempt + 1), 1000);
    }
  };

  const handleManualVerifyWhatsApp = async (instanceName: string) => {
    setTesting('whatsapp');
    setMessage(null);

    try {
      // Manually save the instance name and phone - user confirmed connection on phone
      const r = await fetch('/api/whatsapp?action=debugSaveInstance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName })
      });
      const data = await r.json();

      if (data.success) {
        setWhatsAppPhoneLinked('WhatsApp Linked');
        setMessage({ type: 'success', text: 'Instance saved successfully! Ready to send messages.' });
        setShowWhatsAppModal(false);
        setTimeout(() => loadSettings(), 1000);
      } else {
        setMessage({ type: 'error', text: `Failed to save: ${data.error}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to verify: ${error}` });
    } finally {
      setTesting(null);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    if (!confirm('Are you sure you want to disconnect WhatsApp?')) return;

    setTesting('whatsapp');
    setMessage(null);

    try {
      const r = await fetch('/api/whatsapp?action=disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await r.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'WhatsApp disconnected' });
        setWhatsAppPhoneLinked(null);
        setWhatsAppInstanceName(null);
        setTimeout(() => loadSettings(), 1000);
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to disconnect' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to disconnect WhatsApp' });
    }
    setTesting(null);
  };

  const tabs = [
    { id: 'email' as const, label: 'Email', icon: Mail },
    { id: 'api' as const, label: 'AI & API', icon: Bot },
    { id: 'integrations' as const, label: 'Integrations', icon: Link2 },
    { id: 'automation' as const, label: 'Automation', icon: Smartphone },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400">Configure your CRM integrations and preferences</p>
      </header>

      {/* Database Setup Banner */}
      {tableNotFound && (
        <div className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <p className="text-amber-400 font-semibold">Database table not set up yet</p>
          </div>
          <p className="text-gray-400 text-sm">
            The <code className="text-amber-300 bg-gray-800 px-1 py-0.5 rounded">app_settings</code> table doesn't exist in your Supabase database.
            That's why settings aren't saving. Run this SQL once in your Supabase dashboard to fix it:
          </p>
          <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
            <li>Go to your <strong className="text-white">Supabase project</strong> → <strong className="text-white">SQL Editor</strong></li>
            <li>Click <strong className="text-white">New Query</strong></li>
            <li>Paste and run the contents of <code className="text-amber-300 bg-gray-800 px-1 py-0.5 rounded">supabase/email_schema.sql</code></li>
          </ol>
          <p className="text-gray-500 text-xs">This creates the settings, emails, and email templates tables all at once.</p>
        </div>
      )}

      {/* Message Banner */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-400" />
          ) : (
            <XCircle className="w-5 h-5 text-red-400" />
          )}
          <span className={message.type === 'success' ? 'text-green-400' : 'text-red-400'}>{message.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700 pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Email Settings */}
          {activeTab === 'email' && (
            <div className="space-y-6">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="font-bold text-white flex items-center gap-2 mb-4">
                  <Mail className="w-5 h-5 text-amber-500" />
                  IMAP Configuration (Receive Emails)
                </h3>
                <p className="text-gray-400 text-sm mb-6">
                  Connect your email inbox to automatically sync and analyze incoming emails.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">IMAP Host</label>
                    <input
                      type="text"
                      value={localValues['IMAP_HOST'] || ''}
                      onChange={(e) => handleValueChange('IMAP_HOST', e.target.value)}
                      placeholder="imap.gmail.com"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:border-amber-500/50"
                    />
                    <p className="text-xs text-gray-500 mt-1">e.g., imap.gmail.com, imap-mail.outlook.com</p>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Port</label>
                    <input
                      type="number"
                      value={localValues['IMAP_PORT'] || '993'}
                      onChange={(e) => handleValueChange('IMAP_PORT', e.target.value)}
                      placeholder="993"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:border-amber-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Email Address</label>
                    <input
                      type="text"
                      value={localValues['IMAP_USER'] || ''}
                      onChange={(e) => handleValueChange('IMAP_USER', e.target.value)}
                      placeholder="your-email@gmail.com"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:border-amber-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                      Password / App Password
                      {isConfigured['IMAP_PASSWORD'] && !localValues['IMAP_PASSWORD'] && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded border border-green-500/30">Saved</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords['IMAP_PASSWORD'] ? 'text' : 'password'}
                        value={localValues['IMAP_PASSWORD'] || ''}
                        onChange={(e) => handleValueChange('IMAP_PASSWORD', e.target.value)}
                        placeholder={isConfigured['IMAP_PASSWORD'] ? 'Leave blank to keep saved password' : '••••••••'}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:border-amber-500/50 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('IMAP_PASSWORD')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                      >
                        {showPasswords['IMAP_PASSWORD'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">For Gmail, use an App Password from myaccount.google.com</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleValueChange('IMAP_USE_TLS', localValues['IMAP_USE_TLS'] === 'true' ? 'false' : 'true')}
                      className={`w-12 h-6 rounded-full transition-colors relative ${localValues['IMAP_USE_TLS'] === 'true' ? 'bg-amber-500' : 'bg-gray-700'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${localValues['IMAP_USE_TLS'] === 'true' ? 'left-7' : 'left-1'}`} />
                    </button>
                    <span className="text-sm text-gray-300">Use TLS/SSL</span>
                  </div>
                </div>

                <button
                  onClick={() => handleTest('email')}
                  disabled={testing === 'email'}
                  className="mt-6 flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {testing === 'email' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Validate IMAP Settings
                </button>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="font-bold text-white flex items-center gap-2 mb-4">
                  <Mail className="w-5 h-5 text-amber-500" />
                  Email Sending (Resend)
                </h3>
                <p className="text-gray-400 text-sm mb-6">
                  Configure Resend API to send emails directly from the CRM.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                      Resend API Key
                      {isConfigured['RESEND_API_KEY'] && !localValues['RESEND_API_KEY'] && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded border border-green-500/30">Saved</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords['RESEND_API_KEY'] ? 'text' : 'password'}
                        value={localValues['RESEND_API_KEY'] || ''}
                        onChange={(e) => handleValueChange('RESEND_API_KEY', e.target.value)}
                        placeholder={isConfigured['RESEND_API_KEY'] ? 'Leave blank to keep saved key' : 're_••••••••'}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:border-amber-500/50 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('RESEND_API_KEY')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                      >
                        {showPasswords['RESEND_API_KEY'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Get your API key from resend.com API Keys</p>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Default From Email</label>
                    <input
                      type="text"
                      value={localValues['DEFAULT_FROM_EMAIL'] || ''}
                      onChange={(e) => handleValueChange('DEFAULT_FROM_EMAIL', e.target.value)}
                      placeholder="sales@yourcompany.com"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:border-amber-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Default From Name</label>
                    <input
                      type="text"
                      value={localValues['DEFAULT_FROM_NAME'] || ''}
                      onChange={(e) => handleValueChange('DEFAULT_FROM_NAME', e.target.value)}
                      placeholder="Your Company Name"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleTest('resend')}
                  disabled={testing === 'resend'}
                  className="mt-6 flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {testing === 'resend' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Test Resend API Key
                </button>
              </div>
            </div>
          )}

          {/* AI & API Settings */}
          {activeTab === 'api' && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="font-bold text-white flex items-center gap-2 mb-4">
                <Bot className="w-5 h-5 text-amber-500" />
                AI Configuration
              </h3>
              <p className="text-gray-400 text-sm mb-6">
                Configure OpenAI for AI-powered email analysis and reply suggestions.
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                    OpenAI API Key
                    {isConfigured['OPENAI_API_KEY'] && !localValues['OPENAI_API_KEY'] && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded border border-green-500/30">Saved</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords['OPENAI_API_KEY'] ? 'text' : 'password'}
                      value={localValues['OPENAI_API_KEY'] || ''}
                      onChange={(e) => handleValueChange('OPENAI_API_KEY', e.target.value)}
                      placeholder={isConfigured['OPENAI_API_KEY'] ? 'Leave blank to keep saved key' : 'sk-••••••••'}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:border-amber-500/50 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('OPENAI_API_KEY')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                    >
                      {showPasswords['OPENAI_API_KEY'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Get your API key from platform.openai.com → API Keys.</p>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-200">AI Email Analysis</p>
                    <p className="text-xs text-gray-500">Automatically analyze emails for lead scoring</p>
                  </div>
                  <button
                    onClick={() => handleValueChange('AI_ANALYSIS_ENABLED', localValues['AI_ANALYSIS_ENABLED'] === 'true' ? 'false' : 'true')}
                    className={`w-12 h-6 rounded-full transition-colors relative ${localValues['AI_ANALYSIS_ENABLED'] === 'true' ? 'bg-amber-500' : 'bg-gray-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${localValues['AI_ANALYSIS_ENABLED'] === 'true' ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-200">AI Reply Suggestions</p>
                    <p className="text-xs text-gray-500">Generate AI-powered reply suggestions</p>
                  </div>
                  <button
                    onClick={() => handleValueChange('AI_SUGGESTIONS_ENABLED', localValues['AI_SUGGESTIONS_ENABLED'] === 'true' ? 'false' : 'true')}
                    className={`w-12 h-6 rounded-full transition-colors relative ${localValues['AI_SUGGESTIONS_ENABLED'] === 'true' ? 'bg-amber-500' : 'bg-gray-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${localValues['AI_SUGGESTIONS_ENABLED'] === 'true' ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              <button
                onClick={() => handleTest('openai')}
                disabled={testing === 'openai'}
                className="mt-6 flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {testing === 'openai' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Test OpenAI API Key
              </button>
            </div>
          )}

          {/* Integrations Settings */}
          {activeTab === 'integrations' && (
            <div className="space-y-6">
              {/* WhatsApp Provider Management */}
              <div className="bg-gradient-to-r from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-bold text-white flex items-center gap-2 mb-2">
                      <MessageCircle className="w-5 h-5 text-green-500" />
                      WhatsApp Integration
                    </h3>
                    <p className="text-gray-400 text-sm">Choose and manage your WhatsApp provider below.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Evolution API (Recommended) */}
                <div className="rounded-2xl p-6 transition-all bg-green-950 border border-green-500/70 ring-1 ring-green-500/30">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-5 h-5 text-green-500" />
                      <div>
                        <h4 className="font-bold text-white">Evolution API</h4>
                        <p className="text-xs text-green-400">★ Recommended</p>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${whatsAppPhoneLinked ? 'bg-green-500/30 text-green-300 font-semibold' : 'bg-gray-700/50 text-gray-400'}`}>
                      {whatsAppPhoneLinked ? '✓ Linked' : '○ Not Linked'}
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">
                    Modern QR code authentication. Free with Baileys engine. No subscription required.
                  </p>

                  {whatsAppPhoneLinked ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <div>
                            <p className="text-green-400 text-xs font-medium">WhatsApp Linked</p>
                            <p className="text-green-300 text-xs">{whatsAppPhoneLinked.replace(/^(\d{1,3})(?=\d{3})/, '$1•••')}</p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={handleDisconnectWhatsApp}
                        disabled={testing === 'whatsapp'}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {testing === 'whatsapp' ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                        Disconnect WhatsApp
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleLinkWhatsApp}
                      disabled={whatsAppScanning}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {whatsAppScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                      {whatsAppScanning ? 'Creating Instance...' : 'Link WhatsApp'}
                    </button>
                  )}
                </div>
              </div>

              {/* QR Code Modal */}
              {showWhatsAppModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 space-y-6">
                    <div>
                      <h4 className="text-white font-bold text-lg mb-2">Scan QR Code</h4>
                      <p className="text-gray-400 text-sm">Use your WhatsApp phone to scan this QR code to link your account.</p>
                    </div>

                    {whatsAppQrCode && (
                      <div className="bg-white p-4 rounded-xl flex justify-center">
                        <img
                          src={whatsAppQrCode}
                          alt="WhatsApp QR Code"
                          className="w-48 h-48"
                        />
                      </div>
                    )}

                    {whatsAppPolling && (
                      <div className="flex items-center justify-center gap-2 text-amber-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Waiting for scan...</span>
                      </div>
                    )}

                    {!whatsAppPolling && whatsAppInstanceName && (
                      <div className="space-y-3">
                        <p className="text-gray-400 text-sm text-center">
                          Did WhatsApp say "Connected" on your phone? Click the button below to save.
                        </p>
                        <button
                          onClick={() => handleManualVerifyWhatsApp(whatsAppInstanceName)}
                          disabled={testing === 'whatsapp'}
                          className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          {testing === 'whatsapp' ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Verifying...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Verify Connection
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setShowWhatsAppModal(false);
                        setWhatsAppPolling(false);
                      }}
                      className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="font-bold text-white flex items-center gap-2 mb-4">
                  <Link2 className="w-5 h-5 text-purple-500" />
                  WooCommerce
                </h3>
                <p className="text-gray-400 text-sm mb-6">
                  Connect your WooCommerce store to sync orders and customers.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-400 mb-2">Store URL</label>
                    <input
                      type="text"
                      value={localValues['WOOCOMMERCE_URL'] || ''}
                      onChange={(e) => handleValueChange('WOOCOMMERCE_URL', e.target.value)}
                      placeholder="https://yourstore.com"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:border-amber-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Consumer Key</label>
                    <input
                      type="text"
                      value={localValues['WOOCOMMERCE_KEY'] || ''}
                      onChange={(e) => handleValueChange('WOOCOMMERCE_KEY', e.target.value)}
                      placeholder="ck_••••••••"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:border-amber-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Consumer Secret</label>
                    <div className="relative">
                      <input
                        type={showPasswords['WOOCOMMERCE_SECRET'] ? 'text' : 'password'}
                        value={localValues['WOOCOMMERCE_SECRET'] || ''}
                        onChange={(e) => handleValueChange('WOOCOMMERCE_SECRET', e.target.value)}
                        placeholder="cs_••••••••"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:border-amber-500/50 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('WOOCOMMERCE_SECRET')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                      >
                        {showPasswords['WOOCOMMERCE_SECRET'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Automation Settings */}
          {activeTab === 'automation' && (
            <div className="space-y-6">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="font-bold text-white flex items-center gap-2 mb-4">
                  <Smartphone className="w-5 h-5 text-amber-500" />
                  Call Automation
                </h3>

                <div className="space-y-4">
                  {[
                    { key: 'simAutoLogging', label: 'SIM Call Auto-Logging', desc: 'Automatically log incoming/outgoing SIM calls' },
                    { key: 'twoSidedRecording', label: 'Two-Sided Recording', desc: 'Capture both sides of the conversation' },
                    { key: 'whatsAppDetection', label: 'WhatsApp Call Tracking', desc: 'Detect and log WhatsApp voice calls' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-gray-200">{item.label}</p>
                        <p className="text-xs text-gray-500">{item.desc}</p>
                      </div>
                      <button
                        onClick={() => handleToggle(item.key as any)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${settings[item.key as keyof typeof settings] ? 'bg-amber-500' : 'bg-gray-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings[item.key as keyof typeof settings] ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="font-bold text-white flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-amber-500" />
                  Compliance & Security
                </h3>

                <div className="space-y-4">
                  {[
                    { key: 'holidayBlocking', label: 'Jamaica Holiday Block', desc: 'Prevent calls on public holidays' },
                    { key: 'notifications', label: 'Manager Notifications', desc: 'Alert manager on significant events' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-gray-200">{item.label}</p>
                        <p className="text-xs text-gray-500">{item.desc}</p>
                      </div>
                      <button
                        onClick={() => handleToggle(item.key as any)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${settings[item.key as keyof typeof settings] ? 'bg-amber-500' : 'bg-gray-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings[item.key as keyof typeof settings] ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="font-bold text-white flex items-center gap-2 mb-4">
                  <Globe className="w-5 h-5 text-amber-500" />
                  Regional & Localization
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Company Name</label>
                    <input
                      type="text"
                      value={settings.companyName}
                      onChange={(e) => updateSettings({ companyName: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Currency</label>
                    <select
                      value={settings.currency || 'USD'}
                      onChange={(e) => updateSettings({ currency: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-amber-500/50"
                    >
                      <option value="JMD">JMD (Jamaican Dollar)</option>
                      <option value="USD">USD (US Dollar)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">GCT Tax Rate (%)</label>
                    <input
                      type="number"
                      value={settings.gctRate || 0}
                      onChange={(e) => updateSettings({ gctRate: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end gap-4 pt-4">
            <button
              onClick={loadSettings}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-white transition-colors"
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Settings;
