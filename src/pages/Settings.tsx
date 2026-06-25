import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Save, Shield, Smartphone, Globe, Mail, Bot, Link2, CheckCircle, XCircle, Loader2, Eye, EyeOff, MessageCircle,
  Users, UserPlus, Trash2, Crown, UserCheck, KeyRound, X, Copy, AlertCircle
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

  const [activeTab, setActiveTab] = useState<'email' | 'api' | 'integrations' | 'automation' | 'team'>('email');

  // Team management state
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'sales_rep'>('sales_rep');
  const [inviting, setInviting] = useState(false);
  const [teamMessage, setTeamMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Reset password state
  const [resetingPwId, setResetingPwId] = useState<string | null>(null);
  const [resetPwResult, setResetPwResult] = useState<{ email: string; name: string; tempPassword: string; warning?: string } | null>(null);

  // Role editing state
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editRoleValue, setEditRoleValue] = useState<'manager' | 'sales_rep'>('sales_rep');
  const [savingRole, setSavingRole] = useState(false);

  // Device linking state
  const [devices, setDevices] = useState<any[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [savingDevice, setSavingDevice] = useState<string | null>(null);
  const [deviceAssignments, setDeviceAssignments] = useState<Record<string, string>>({});
  const [deviceNames, setDeviceNames] = useState<Record<string, string>>({});

  // Call forwarding state
  const [forwardStatus, setForwardStatus] = useState<Record<string, any>>({});
  const [forwardTarget, setForwardTarget] = useState<Record<string, string>>({});
  const [forwardSim, setForwardSim] = useState<Record<string, number>>({});
  const [showForwardForm, setShowForwardForm] = useState<Record<string, boolean>>({});
  const [sendingForward, setSendingForward] = useState<string | null>(null);
  const [forwardPollPhone, setForwardPollPhone] = useState<string | null>(null);

  // Automation rules state
  const [automationRules, setAutomationRules] = useState<any[]>([]);
  const [automationLoading, setAutomationLoading] = useState(false);
  const [automationToggling, setAutomationToggling] = useState<string | null>(null);
  const [automationRunning, setAutomationRunning] = useState(false);
  const [automationRunResult, setAutomationRunResult] = useState<string | null>(null);

  // First-time owner setup state
  const [showOwnerSetup, setShowOwnerSetup] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
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

  // Auto-poll forwarding status after queuing a command
  useEffect(() => {
    if (!forwardPollPhone) return;
    const interval = setInterval(async () => {
      try {
        const r = await fetch('/api/whatsapp?action=getForwardStatus');
        const data = await r.json();
        if (data.success) {
          setForwardStatus(data.forwardStatus || {});
          const s = (data.forwardStatus || {})[forwardPollPhone];
          if (s && (s.status === 'done' || s.status === 'failed')) {
            setForwardPollPhone(null);
          }
        }
      } catch {}
    }, 30000);
    return () => clearInterval(interval);
  }, [forwardPollPhone]);

  const detectKeyProvider = (key: string): 'anthropic' | 'openai' | null => {
    if (!key) return null;
    if (key.startsWith('sk-ant-')) return 'anthropic';
    if (key.startsWith('sk-')) return 'openai';
    return null;
  };

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
    { id: 'team' as const, label: 'Team', icon: Users },
  ];

  const loadTeam = async () => {
    setTeamLoading(true);
    try {
      const r = await fetch('/api/users?action=list');
      const data = await r.json();
      if (data.success) setTeamMembers(data.users || []);
    } catch {}
    setTeamLoading(false);
  };

  const loadDevices = async () => {
    setDevicesLoading(true);
    try {
      const [devR, fwdR] = await Promise.all([
        fetch('/api/users?action=listDevices'),
        fetch('/api/whatsapp?action=getForwardStatus').catch(() => ({ ok: false })),
      ]);
      const devData = await devR.json();
      const fwdData = fwdR.ok ? await fwdR.json() : { success: false };

      if (devData.success) {
        setDevices(devData.devices || []);
        const assignments: Record<string, string> = {};
        const names: Record<string, string> = {};
        (devData.devices || []).forEach((d: any) => {
          assignments[d.device_id] = d.user_id || '';
          names[d.device_id] = d.device_name || '';
        });
        setDeviceAssignments(assignments);
        setDeviceNames(names);
      }
      if (fwdData.success) {
        setForwardStatus(fwdData.forwardStatus || {});
      } else {
        // Forward status load failed — not critical, just continue
        setForwardStatus({});
      }
    } catch (e) {
      console.warn('loadDevices error:', e);
      setForwardStatus({});
    }
    setDevicesLoading(false);
  };

  const handleVerifyForwardStatus = async (devicePhone: string, simSlot: number) => {
    setSendingForward(devicePhone);
    try {
      const r = await fetch('/api/whatsapp?action=sendForwardCommand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          devicePhone,
          command: 'verify_status',
          simSlot,
        }),
      });
      const data = await r.json();
      if (data.success) {
        setTeamMessage({
          type: 'success',
          text: `Verify command sent. Device will dial *#21# and report status within 15 minutes.`,
        });
      } else {
        setTeamMessage({ type: 'error', text: data.error || 'Failed to send verify command' });
      }
    } catch (e) {
      setTeamMessage({ type: 'error', text: `Network error: ${e instanceof Error ? e.message : 'Unknown error'}` });
    }
    setSendingForward(null);
  };

  const handleSendForwardCommand = async (
    devicePhone: string,
    command: 'forward_enable' | 'forward_disable'
  ) => {
    // Validate preconditions
    if (!devicePhone || devicePhone.length < 7) {
      setTeamMessage({ type: 'error', text: 'Invalid device phone number' });
      return;
    }

    if (command === 'forward_enable') {
      const target = forwardTarget[devicePhone] || '';
      const cleanTarget = target.replace(/[^0-9+]/g, '');
      if (cleanTarget.length < 7) {
        setTeamMessage({ type: 'error', text: 'Target number must be at least 7 digits (e.g., +1 876 123 4567)' });
        return;
      }
    }

    setSendingForward(devicePhone);
    try {
      const r = await fetch('/api/whatsapp?action=sendForwardCommand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          devicePhone,
          command,
          targetNumber: command === 'forward_enable' ? (forwardTarget[devicePhone] || '') : undefined,
          simSlot: forwardSim[devicePhone] ?? 0,
        }),
      });
      const data = await r.json();
      if (data.success) {
        setForwardStatus(prev => ({ ...prev, [devicePhone]: data.command }));
        setShowForwardForm(prev => ({ ...prev, [devicePhone]: false }));
        setForwardPollPhone(devicePhone);
        setTeamMessage({
          type: 'success',
          text: command === 'forward_enable'
            ? `Forwarding queued — status will update automatically when the device responds`
            : `Disable command queued — status will update automatically`,
        });
        // Reset target/sim after successful send
        setForwardTarget(prev => ({ ...prev, [devicePhone]: '' }));
        setForwardSim(prev => ({ ...prev, [devicePhone]: 0 }));
      } else {
        setTeamMessage({ type: 'error', text: data.error || 'Failed to send command' });
      }
    } catch (e) {
      setTeamMessage({ type: 'error', text: `Network error: ${e instanceof Error ? e.message : 'Unknown error'}` });
    }
    setSendingForward(null);
  };

  const handleSaveDevice = async (deviceId: string) => {
    setSavingDevice(deviceId);
    try {
      const r = await fetch('/api/users?action=linkDevice', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          userId: deviceAssignments[deviceId] || null,
          deviceName: deviceNames[deviceId] || null
        })
      });
      const data = await r.json();
      if (!data.success) setTeamMessage({ type: 'error', text: data.error || 'Failed to save device' });
      else setTeamMessage({ type: 'success', text: 'Device saved' });
    } catch {
      setTeamMessage({ type: 'error', text: 'Network error' });
    }
    setSavingDevice(null);
  };

  const handleSaveRole = async (memberId: string) => {
    setSavingRole(true);
    try {
      const r = await fetch('/api/users?action=update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: memberId, role: editRoleValue })
      });
      const data = await r.json();
      if (data.success) {
        setTeamMessage({ type: 'success', text: 'Role updated' });
        setEditingRoleId(null);
        loadTeam();
      } else {
        setTeamMessage({ type: 'error', text: data.error || 'Failed to update role' });
      }
    } catch {
      setTeamMessage({ type: 'error', text: 'Network error' });
    }
    setSavingRole(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setTeamMessage(null);
    try {
      const r = await fetch('/api/users?action=invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: inviteName, email: inviteEmail, role: inviteRole })
      });
      const data = await r.json();
      if (data.success) {
        const msg = data.warning
          ? data.warning
          : `Invite sent to ${inviteEmail}`;
        setTeamMessage({ type: data.warning ? 'error' : 'success', text: msg });
        setInviteName(''); setInviteEmail(''); setInviteRole('sales_rep');
        setShowInviteForm(false);
        loadTeam();
      } else {
        setTeamMessage({ type: 'error', text: data.error || 'Failed to send invite' });
      }
    } catch {
      setTeamMessage({ type: 'error', text: 'Network error' });
    }
    setInviting(false);
  };

  const handleRemoveMember = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from the team?`)) return;
    try {
      const r = await fetch('/api/users?action=remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await r.json();
      if (data.success) { setTeamMessage({ type: 'success', text: `${name} removed` }); loadTeam(); }
      else setTeamMessage({ type: 'error', text: data.error || 'Failed to remove' });
    } catch {}
  };

  const handleResetPassword = async (member: { id: string; name: string; email: string }) => {
    if (!confirm(`Reset ${member.name}'s password? They will need new credentials to log in.`)) return;
    setResetingPwId(member.id);
    try {
      const r = await fetch('/api/users?action=resetPassword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: member.id })
      });
      const data = await r.json();
      if (data.success) {
        setResetPwResult({ email: member.email, name: member.name, tempPassword: data.tempPassword, warning: data.warning });
      } else {
        setTeamMessage({ type: 'error', text: data.error || 'Failed to reset password' });
      }
    } catch {
      setTeamMessage({ type: 'error', text: 'Network error' });
    }
    setResetingPwId(null);
  };

  const handleCreateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setTeamMessage(null);
    try {
      const r = await fetch('/api/users?action=createOwner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: ownerName, email: ownerEmail, password: ownerPassword })
      });
      const data = await r.json();
      if (data.success) {
        setTeamMessage({ type: 'success', text: 'Owner account created. You can now log in with the new email.' });
        setShowOwnerSetup(false);
        loadTeam();
      } else {
        setTeamMessage({ type: 'error', text: data.error || 'Failed to create owner' });
      }
    } catch {
      setTeamMessage({ type: 'error', text: 'Network error' });
    }
    setInviting(false);
  };

  const loadAutomationRules = async () => {
    setAutomationLoading(true);
    try {
      const r = await fetch('/api/crm?target=automation&action=getStatus');
      if (r.ok) { const d = await r.json(); setAutomationRules(d.rules || []); }
    } catch (_) {}
    finally { setAutomationLoading(false); }
  };

  const toggleAutomationRule = async (ruleId: string, isActive: boolean) => {
    setAutomationToggling(ruleId);
    try {
      await fetch('/api/crm?target=automation&action=toggleRule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId, isActive }),
      });
      setAutomationRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_active: isActive } : r));
    } catch (_) {}
    finally { setAutomationToggling(null); }
  };

  const runAutomationNow = async () => {
    setAutomationRunning(true);
    setAutomationRunResult(null);
    try {
      const r = await fetch('/api/crm?target=automation&action=run');
      const d = await r.json();
      setAutomationRunResult(d.success ? `✓ ${d.tasksCreated} task${d.tasksCreated !== 1 ? 's' : ''} created across ${d.rulesRun} rules` : `Error: ${d.error}`);
      await loadAutomationRules();
    } catch (_) { setAutomationRunResult('Network error'); }
    finally { setAutomationRunning(false); }
  };

  useEffect(() => {
    if (activeTab === 'team') { loadTeam(); loadDevices(); }
    if (activeTab === 'automation') { loadAutomationRules(); }
  }, [activeTab]);

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
          {activeTab === 'api' && (() => {
            const detectedProvider = detectKeyProvider(localValues['OPENAI_API_KEY'] || '');
            return (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="font-bold text-white flex items-center gap-2 mb-4">
                  <Bot className="w-5 h-5 text-amber-500" />
                  AI Configuration
                </h3>
                <p className="text-gray-400 text-sm mb-6">
                  Configure an AI API key for email analysis and reply suggestions. Supports both OpenAI and Anthropic.
                </p>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                      AI API Key
                      {isConfigured['OPENAI_API_KEY'] && !localValues['OPENAI_API_KEY'] && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded border border-green-500/30">Saved</span>
                      )}
                      {detectedProvider === 'anthropic' && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded border border-purple-500/30">Anthropic detected</span>
                      )}
                      {detectedProvider === 'openai' && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded border border-green-500/30">OpenAI detected</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords['OPENAI_API_KEY'] ? 'text' : 'password'}
                        value={localValues['OPENAI_API_KEY'] || ''}
                        onChange={(e) => handleValueChange('OPENAI_API_KEY', e.target.value)}
                        placeholder={isConfigured['OPENAI_API_KEY'] ? 'Leave blank to keep saved key' : 'sk-…  or  sk-ant-…'}
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
                    <p className="text-xs text-gray-500 mt-1">
                      {detectedProvider === 'anthropic'
                        ? 'Anthropic key — get yours at console.anthropic.com → API Keys.'
                        : detectedProvider === 'openai'
                        ? 'OpenAI key — get yours at platform.openai.com → API Keys.'
                        : 'Paste an OpenAI key (sk-…) or Anthropic key (sk-ant-…) — provider detected automatically.'}
                    </p>
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
                  {detectedProvider === 'anthropic' ? 'Test Anthropic Key' : detectedProvider === 'openai' ? 'Test OpenAI Key' : 'Test AI Key'}
                </button>
              </div>
            );
          })()}

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

              {/* Workflow Automation Rules */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Bot className="w-5 h-5 text-amber-500" />
                    Workflow Automation
                  </h3>
                  <button
                    onClick={runAutomationNow}
                    disabled={automationRunning}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {automationRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    {automationRunning ? 'Running…' : 'Run Now'}
                  </button>
                </div>

                {automationRunResult && (
                  <div className={`text-xs px-3 py-2 rounded-lg mb-4 ${automationRunResult.startsWith('✓') ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {automationRunResult}
                  </div>
                )}

                <p className="text-xs text-gray-500 mb-4">
                  Rules run automatically every hour. Each rule creates a task when conditions are met, with a cooldown to prevent duplicates.
                </p>

                {automationLoading ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading rules…
                  </div>
                ) : automationRules.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    <Bot className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>No automation rules found.</p>
                    <p className="text-xs mt-1">Run the SQL migration to create default rules.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {automationRules.map((rule: any) => {
                      const triggerLabels: Record<string, string> = {
                        whatsapp_unread: 'WhatsApp unread',
                        no_activity: 'No activity',
                        lead_no_contact: 'New lead uncontacted',
                        deal_stale: 'Deal stalled',
                        missing_data: 'Missing data',
                        new_phone_lead: 'New phone lead',
                        new_whatsapp_lead: 'New WhatsApp lead',
                        woo_order_status: 'WooCommerce order status',
                        woo_stale_order: 'Stale WooCommerce order',
                        multichannel_followup: 'Multi-channel follow-up',
                      };
                      const priorityColors: Record<string, string> = {
                        critical: 'text-red-500', high: 'text-red-400', medium: 'text-amber-400', low: 'text-blue-400',
                      };
                      const triggerMeta = (() => {
                        const cfg = rule.trigger_config || {};
                        if (cfg.hours_since != null && cfg.hours_since > 0) return `after ${cfg.hours_since}h`;
                        if (cfg.hours) return `within ${cfg.hours}h`;
                        if (cfg.days) return `${cfg.days}-day window`;
                        if (cfg.field) return `missing ${cfg.field}`;
                        if (Array.isArray(cfg.statuses) && cfg.statuses.length) return cfg.statuses.join(', ');
                        return null;
                      })();
                      return (
                        <div key={rule.id} className="flex items-start justify-between gap-3 p-4 bg-gray-800/50 rounded-xl">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-gray-200">{rule.name}</p>
                              <span className={`text-xs font-medium ${priorityColors[rule.action_config?.priority] || 'text-gray-400'}`}>
                                {rule.action_config?.priority || 'medium'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {triggerLabels[rule.trigger_type] || rule.trigger_type}
                              {triggerMeta ? ` › ${triggerMeta}` : ''}
                              {' · '}cooldown {rule.cooldown_hours}h
                            </p>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-600">
                              <span>{rule.totalTasksCreated} tasks created</span>
                              {rule.lastFired && <span>· last fired {new Date(rule.lastFired).toLocaleDateString()}</span>}
                            </div>
                          </div>
                          <button
                            onClick={() => toggleAutomationRule(rule.id, !rule.is_active)}
                            disabled={automationToggling === rule.id}
                            className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 mt-0.5 disabled:opacity-50 ${rule.is_active ? 'bg-amber-500' : 'bg-gray-700'}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${rule.is_active ? 'left-7' : 'left-1'}`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
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

          {/* Team Settings */}
          {activeTab === 'team' && (
            <div className="space-y-6">
              {teamMessage && (
                <div className={`p-4 rounded-xl flex items-center gap-3 ${teamMessage.type === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                  {teamMessage.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
                  {teamMessage.text}
                </div>
              )}

              {/* Owner Setup */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-500" />
                    Owner Account Setup
                  </h3>
                  <button
                    onClick={() => setShowOwnerSetup(v => !v)}
                    className="text-xs text-amber-400 hover:text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {showOwnerSetup ? 'Cancel' : 'Set Up Owner Login'}
                  </button>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  Create the owner account using <span className="text-white font-medium">support@dirtyhanddesigns.com</span>. This replaces the shared login and must be done once.
                </p>
                {showOwnerSetup && (
                  <form onSubmit={handleCreateOwner} className="space-y-4 border-t border-gray-800 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5">Display Name</label>
                        <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)} required
                          placeholder="e.g. DHD Owner"
                          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5">Email</label>
                        <input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} required
                          placeholder="support@dirtyhanddesigns.com"
                          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5">Password</label>
                      <input type="password" value={ownerPassword} onChange={e => setOwnerPassword(e.target.value)} required
                        placeholder="Choose a strong password"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50" />
                    </div>
                    <button type="submit" disabled={inviting}
                      className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black text-sm font-bold rounded-xl transition-colors">
                      {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                      Create Owner Account
                    </button>
                  </form>
                )}
              </div>

              {/* Team Members List */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-500" />
                    Team Members
                    {teamMembers.length > 0 && (
                      <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{teamMembers.length}</span>
                    )}
                  </h3>
                  <button
                    onClick={() => setShowInviteForm(v => !v)}
                    className="flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Invite Member
                  </button>
                </div>

                {/* Invite Form */}
                {showInviteForm && (
                  <form onSubmit={handleInvite} className="mb-6 p-4 bg-gray-800/60 rounded-xl border border-gray-700 space-y-4">
                    <p className="text-sm font-medium text-white">Send Invite</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5">Name</label>
                        <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)} required
                          placeholder="Full name"
                          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5">Personal Email</label>
                        <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required
                          placeholder="their@email.com"
                          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5">Role</label>
                        <select value={inviteRole} onChange={e => setInviteRole(e.target.value as any)}
                          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50">
                          <option value="sales_rep">Sales Rep</option>
                          <option value="manager">Manager</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="submit" disabled={inviting}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors">
                        {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                        Send Invite Email
                      </button>
                      <button type="button" onClick={() => setShowInviteForm(false)}
                        className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors">
                        Cancel
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">They'll receive an email to set their password and log in with their personal email address.</p>
                  </form>
                )}

                {/* Members List */}
                {teamLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                  </div>
                ) : teamMembers.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium text-gray-400">No team members yet</p>
                    <p className="text-xs mt-1">Set up the owner account above, then invite your team.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {teamMembers.map(member => {
                      const roleColors: Record<string, string> = {
                        owner: 'bg-amber-500/20 text-amber-400',
                        manager: 'bg-blue-500/20 text-blue-400',
                        sales_rep: 'bg-green-500/20 text-green-400',
                      };
                      const RoleIcon = member.role === 'owner' ? Crown : member.role === 'manager' ? UserCheck : Users;
                      return (
                        <div key={member.id} className="flex items-center gap-4 p-3 rounded-xl bg-gray-800/40 hover:bg-gray-800/60 transition-colors">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-amber-400 font-bold text-sm">{member.name?.[0]?.toUpperCase() || '?'}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{member.name}</p>
                            <p className="text-xs text-gray-500 truncate">{member.email}</p>
                          </div>
                          {/* Role — click to edit (owner only, non-owner members) */}
                          {member.role !== 'owner' && editingRoleId === member.id ? (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <select
                                value={editRoleValue}
                                onChange={e => setEditRoleValue(e.target.value as any)}
                                className="bg-gray-800 border border-gray-600 rounded-lg text-xs text-white px-2 py-1 focus:outline-none focus:border-amber-500/50">
                                <option value="sales_rep">Sales Rep</option>
                                <option value="manager">Manager</option>
                              </select>
                              <button
                                onClick={() => handleSaveRole(member.id)}
                                disabled={savingRole}
                                className="p-1 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors">
                                {savingRole ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => setEditingRoleId(null)}
                                className="p-1 text-gray-500 hover:text-white rounded-lg transition-colors">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { if (member.role !== 'owner') { setEditingRoleId(member.id); setEditRoleValue(member.role); } }}
                              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${roleColors[member.role] || 'bg-gray-700 text-gray-400'} ${member.role !== 'owner' ? 'hover:ring-1 hover:ring-white/20 cursor-pointer' : 'cursor-default'}`}
                              title={member.role !== 'owner' ? 'Click to change role' : undefined}>
                              <RoleIcon className="w-3 h-3" />
                              {member.role === 'sales_rep' ? 'Sales Rep' : member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                            </button>
                          )}
                          {member.role !== 'owner' && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => handleResetPassword(member)}
                                disabled={resetingPwId === member.id}
                                className="p-1.5 text-gray-600 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                                title="Reset password">
                                {resetingPwId === member.id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <KeyRound className="w-3.5 h-3.5" />}
                              </button>
                              <button onClick={() => handleRemoveMember(member.id, member.name)}
                                className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Remove member">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Device → User Linking */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-amber-500" />
                    Companion App Devices
                    {devices.length > 0 && (
                      <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{devices.length}</span>
                    )}
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mb-4">Link each registered device to a team member so call logs can be attributed correctly.</p>

                {devicesLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                  </div>
                ) : devices.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Smartphone className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No devices registered yet</p>
                    <p className="text-xs mt-1">Install the Companion App on a sales rep's phone to register it here.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {devices.map(device => (
                      <div key={device.device_id} className="p-3 bg-gray-800/40 rounded-xl border border-gray-700/50">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Smartphone className="w-4 h-4 text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <p className="text-xs text-gray-400 font-mono truncate">{device.phone_number}</p>
                              <span className="text-xs text-gray-600">{device.device_model}</span>
                              {device.is_active && (
                                <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">Active</span>
                              )}
                              {device.app_version ? (
                                <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">v{device.app_version}</span>
                              ) : (
                                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">App update needed</span>
                              )}
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <div>
                                <label className="block text-[10px] text-gray-500 mb-1">Device Name</label>
                                <input
                                  type="text"
                                  value={deviceNames[device.device_id] || ''}
                                  onChange={e => setDeviceNames(prev => ({ ...prev, [device.device_id]: e.target.value }))}
                                  placeholder="e.g. John's Work Phone"
                                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50" />
                              </div>
                              <div>
                                <label className="block text-[10px] text-gray-500 mb-1">Assigned to</label>
                                <select
                                  value={deviceAssignments[device.device_id] || ''}
                                  onChange={e => setDeviceAssignments(prev => ({ ...prev, [device.device_id]: e.target.value }))}
                                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50">
                                  <option value="">— Unassigned —</option>
                                  {teamMembers.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleSaveDevice(device.device_id)}
                            disabled={savingDevice === device.device_id}
                            className="flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 mt-0.5">
                            {savingDevice === device.device_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Save
                          </button>
                        </div>

                        {/* Call Forwarding Control */}
                        {(() => {
                          const phone = device.phone_number;
                          if (!phone || phone.length < 7) {
                            return (
                              <div className="mt-3 pt-3 border-t border-gray-700/50 text-[10px] text-gray-600">
                                Phone number not set up — forwarding unavailable
                              </div>
                            );
                          }

                          const fwd = forwardStatus[phone];
                          const isForwarding = fwd && fwd.command === 'forward_enable' && (fwd.status === 'done' || fwd.status === 'pending');
                          const isPending = fwd && fwd.status === 'pending';
                          const isPolling = forwardPollPhone === phone;
                          const showForm = showForwardForm[phone];
                          const targetNum = forwardTarget[phone] || '';
                          const cleanTarget = targetNum.replace(/[^0-9+]/g, '');
                          const isValidTarget = cleanTarget.length >= 7;

                          return (
                            <div className="mt-3 pt-3 border-t border-gray-700/50">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Call Forwarding</span>
                                  {isForwarding && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isPending ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'}`}>
                                      {isPending ? '⏳ Pending…' : `→ ${fwd.target_number}`}
                                    </span>
                                  )}
                                  {fwd && fwd.command === 'forward_disable' && fwd.status === 'pending' && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-gray-600/40 text-gray-400">⏳ Disabling…</span>
                                  )}
                                  {isPolling && (
                                    <span className="text-[10px] text-blue-400 flex items-center gap-1">
                                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                      Auto-checking…
                                    </span>
                                  )}
                                  {fwd && fwd.status === 'failed' && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-red-500/20 text-red-400" title={fwd.result_message}>Failed</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {isForwarding && fwd.status === 'done' && (
                                    <>
                                      <button
                                        onClick={() => handleVerifyForwardStatus(phone, forwardSim[phone] ?? 0)}
                                        disabled={sendingForward === phone}
                                        className="text-[10px] px-2 py-1 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-colors disabled:opacity-50">
                                        {sendingForward === phone ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Verify'}
                                      </button>
                                      <button
                                        onClick={() => handleSendForwardCommand(phone, 'forward_disable')}
                                        disabled={sendingForward === phone}
                                        className="text-[10px] px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50">
                                        {sendingForward === phone ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Disable'}
                                      </button>
                                    </>
                                  )}
                                  {!showForm && (
                                    <button
                                      onClick={() => setShowForwardForm(prev => ({ ...prev, [phone]: true }))}
                                      className="text-[10px] px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-colors">
                                      {isForwarding ? 'Change' : 'Enable'}
                                    </button>
                                  )}
                                  {showForm && (
                                    <button
                                      onClick={() => setShowForwardForm(prev => ({ ...prev, [phone]: false }))}
                                      className="text-[10px] px-2 py-1 rounded-lg bg-gray-700 text-gray-400 hover:bg-gray-600 transition-colors">
                                      Cancel
                                    </button>
                                  )}
                                </div>
                              </div>

                              {showForm && (
                                <div className="mt-2 p-3 bg-gray-800/60 rounded-xl border border-gray-700/50 space-y-2">
                                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <div>
                                      <label className="block text-[10px] text-gray-500 mb-1">Forward to number</label>
                                      <select
                                        value={forwardTarget[phone] || ''}
                                        onChange={e => setForwardTarget(prev => ({ ...prev, [phone]: e.target.value }))}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50">
                                        <option value="">— Pick a device or type below —</option>
                                        {devices.filter(d => d.phone_number && d.phone_number !== phone).map(d => (
                                          <option key={d.device_id} value={d.phone_number}>
                                            {deviceNames[d.device_id] || d.phone_number} ({d.phone_number})
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-[10px] text-gray-500 mb-1">Or enter number</label>
                                      <input
                                        type="tel"
                                        value={forwardTarget[phone] || ''}
                                        onChange={e => setForwardTarget(prev => ({ ...prev, [phone]: e.target.value }))}
                                        placeholder="+18761234567"
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] text-gray-500 mb-1">
                                      SIM slot {device.sim_count && device.sim_count < 2 ? `(device has 1 SIM)` : ''}
                                    </label>
                                    <div className="flex gap-1.5">
                                      {[0, 1].map(slot => {
                                        const hasSim = !device.sim_count || device.sim_count > slot;
                                        return (
                                          <button
                                            key={slot}
                                            onClick={() => hasSim && setForwardSim(prev => ({ ...prev, [phone]: slot }))}
                                            disabled={!hasSim}
                                            className={`text-[10px] px-3 py-1 rounded-lg border transition-colors ${
                                              !hasSim
                                                ? 'bg-gray-900 border-gray-800 text-gray-700 cursor-not-allowed'
                                                : (forwardSim[phone] ?? 0) === slot
                                                ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                                                : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'
                                            }`}>
                                            SIM {slot + 1}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  {!isValidTarget && targetNum && (
                                    <div className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-center">
                                      Target number must be at least 7 digits
                                    </div>
                                  )}
                                  <button
                                    onClick={() => handleSendForwardCommand(phone, 'forward_enable')}
                                    disabled={sendingForward === phone || !isValidTarget}
                                    className="w-full flex items-center justify-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-3 py-2 rounded-lg transition-colors">
                                    {sendingForward === phone ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                    Send Forwarding Command
                                  </button>
                                  <p className="text-[10px] text-gray-600 text-center">Device executes USSD within 15 minutes (requires internet)</p>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {device.last_heartbeat && (
                          <p className="text-[10px] text-gray-600 mt-2 pl-11">
                            Last seen {new Date(device.last_heartbeat).toLocaleString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Save Button — hidden on team tab */}
          <div className={`flex justify-end gap-4 pt-4 ${activeTab === 'team' ? 'hidden' : ''}`}>
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


      {/* Reset Password Result Modal */}
      {resetPwResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Password Reset — {resetPwResult.name}</h3>
              </div>
              <button onClick={() => setResetPwResult(null)} className="p-1 text-gray-500 hover:text-white rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {resetPwResult.warning ? (
                <div className="flex items-start gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>{resetPwResult.warning}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-400 text-xs">
                  <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  Password reset email sent to {resetPwResult.email}
                </div>
              )}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-2">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Temporary Credentials</p>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">Email</p>
                    <p className="text-sm text-white font-mono truncate">{resetPwResult.email}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">New Password</p>
                    <p className="text-sm text-amber-400 font-mono">{resetPwResult.tempPassword}</p>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(resetPwResult.tempPassword)}
                    className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
                    title="Copy password">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500">Share these credentials with {resetPwResult.name}. They should change their password after logging in.</p>
              <button
                onClick={() => setResetPwResult(null)}
                className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-2.5 rounded-xl transition-all text-sm">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
