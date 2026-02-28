import React, { useState } from 'react';
import { BookOpen, Server, Phone, ShoppingCart, Users, Flag, Wrench } from 'lucide-react';

const TABS = [
  { id: 'plan', label: 'Implementation Plan', icon: BookOpen },
  { id: 'arch', label: 'Architecture', icon: Server },
  { id: 'calls', label: 'Call Logging', icon: Phone },
  { id: 'woo', label: 'WooCommerce', icon: ShoppingCart },
  { id: 'guide', label: 'User Guide', icon: Users },
  { id: 'jamaica', label: 'Jamaica Config', icon: Flag },
  { id: 'troubleshoot', label: 'Troubleshooting', icon: Wrench },
];

const Documentation: React.FC = () => {
  const [activeTab, setActiveTab] = useState('plan');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">📚 Documentation</h1>
        <p className="text-gray-400 text-sm mt-1">DHD SalesTrail — Implementation Guide & Reference</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === t.id ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">

        {activeTab === 'plan' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Implementation Plan</h2>
            {[
              { phase: 'Phase 1', title: 'Foundation (Week 1-2)', status: 'done', items: ['Login system with WordPress auth', 'Dashboard with charts', 'Lead import (CSV/Manual)', 'Pipeline with 7 branding stages', 'Call logs and filtering'] },
              { phase: 'Phase 2', title: 'Integrations (Week 3-4)', status: 'done', items: ['WooCommerce REST API connection', 'Google Sheets call sync via MacroDroid', 'WhatsApp click-to-chat links', 'Quote generator with GCT', 'Task management and follow-ups'] },
              { phase: 'Phase 3', title: 'Advanced (Week 5-6)', status: 'progress', items: ['Message templates (WhatsApp/Email)', 'Activity timeline per contact', 'Role-based data filtering', 'Settings persistence', 'PDF invoice printing'] },
              { phase: 'Phase 4', title: 'Optimization (Week 7-8)', status: 'planned', items: ['Real-time Google Sheets sync', 'Vercel serverless API proxy', 'Mobile companion app', 'Baileys WhatsApp integration', 'Advanced analytics'] },
            ].map((p) => (
              <div key={p.phase} className="border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-bold ${p.status === 'done' ? 'bg-green-500/20 text-green-400' : p.status === 'progress' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-700 text-gray-400'}`}>
                    {p.status === 'done' ? '✅ Complete' : p.status === 'progress' ? '🔄 In Progress' : '⏳ Planned'}
                  </span>
                  <h3 className="font-semibold text-white">{p.phase}: {p.title}</h3>
                </div>
                <ul className="space-y-1">
                  {p.items.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-400">
                      <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'done' ? 'bg-green-400' : p.status === 'progress' ? 'bg-amber-400' : 'bg-gray-600'}`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'arch' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">System Architecture</h2>
            <div className="bg-gray-800/50 rounded-xl p-4 font-mono text-sm text-gray-300 space-y-2">
              <p>📱 Rep Phone (Android)</p>
              <p className="ml-4">↓ MacroDroid triggers on call end</p>
              <p>📊 Google Sheets (Free database)</p>
              <p className="ml-4">↓ Google Apps Script web hook</p>
              <p>🖥️ DHD SalesTrail (This app)</p>
              <p className="ml-4">↓ WooCommerce REST API</p>
              <p>🛒 dirtyhanddesigns.com</p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { title: 'Frontend', items: ['React 18 + TypeScript', 'Vite build tool', 'Tailwind CSS', 'Recharts for charts', 'React Router (Hash-based)', 'localStorage persistence'] },
                { title: 'Integrations', items: ['WooCommerce REST API', 'Google Sheets API', 'MacroDroid webhooks', 'WhatsApp wa.me links', 'WordPress JWT auth', 'Vercel deployment'] },
              ].map((s) => (
                <div key={s.title} className="bg-gray-800/50 rounded-xl p-4">
                  <p className="font-semibold text-white mb-3">{s.title}</p>
                  <ul className="space-y-1">{s.items.map((i, idx) => <li key={idx} className="text-sm text-gray-400 flex items-center gap-2"><span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />{i}</li>)}</ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'calls' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Call Logging Setup (MacroDroid)</h2>
            <div className="space-y-3">
              {[
                { title: 'Step 1: Create Google Sheet', desc: 'Go to sheets.google.com, create "DHD Call Logs" with columns: Rep, Number, Type, Duration, Date, Time, Contact' },
                { title: 'Step 2: Create Apps Script', desc: 'In Google Sheet → Extensions → Apps Script. Paste the doGet() function. Deploy as Web App, access: Anyone.' },
                { title: 'Step 3: Install MacroDroid', desc: 'Install MacroDroid from Google Play Store on each rep\'s Android phone.' },
                { title: 'Step 4: Create 3 Macros', desc: 'Create DHD Outgoing, DHD Incoming, DHD Missed. Trigger: Phone → Call Ended → select type. Action: HTTP GET with Apps Script URL.' },
                { title: 'Step 5: Build URL', desc: 'URL: [script_url]?rep=Keisha&number=[call_number]&type=Outgoing&name=[call_name]. Use Magic Text button for variables.' },
                { title: 'Step 6: Disable Battery Optimization', desc: 'Settings → Apps → MacroDroid → Battery → Unrestricted. CRITICAL or Android kills the app.' },
                { title: 'Step 7: Connect to CRM', desc: 'Go to Call Sync page, paste Sheet ID and Apps Script URL, click Sync Now.' },
              ].map((s, i) => (
                <div key={i} className="flex gap-3 p-4 bg-gray-800/50 rounded-xl">
                  <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 text-sm font-bold flex items-center justify-center flex-shrink-0">{i + 1}</div>
                  <div>
                    <p className="font-medium text-white">{s.title}</p>
                    <p className="text-sm text-gray-400 mt-1">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-300 mb-1">Your Google Apps Script URL:</p>
              <code className="text-xs text-amber-400 break-all">https://script.google.com/macros/s/AKfycbwnY2StE8XHSwoaAq57dNNBbKang7qfRfz0k7EIVpSRHTZPx-3lm4rCKPYnpkNN0yRo/exec</code>
            </div>
          </div>
        )}

        {activeTab === 'woo' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">WooCommerce Integration</h2>
            <div className="space-y-3">
              {[
                'Go to dirtyhanddesigns.com/wp-admin',
                'WooCommerce → Settings → Advanced → REST API',
                'Click "Add Key" → Description: DHD SalesTrail',
                'Permissions: Read/Write → Generate API Key',
                'Copy Consumer Key (ck_xxx) and Consumer Secret (cs_xxx)',
                'Paste into CRM Settings → WooCommerce Connection',
                'Click Test Connection → then Sync Orders',
              ].map((s, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</div>
                  <p className="text-sm text-gray-300">{s}</p>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <p className="font-semibold text-white mb-3">Order → Pipeline Mapping:</p>
              {[['pending', 'New Lead'], ['on-hold', 'Consultation'], ['processing', 'Quote Sent'], ['completed', 'Delivered'], ['cancelled', 'Lost']].map(([wc, crm]) => (
                <div key={wc} className="flex items-center gap-3 py-2 border-b border-gray-800">
                  <code className="text-xs text-purple-400 w-24">{wc}</code>
                  <span className="text-gray-600">→</span>
                  <span className="text-sm text-white">{crm}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'guide' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">User Guide</h2>
            <div>
              <p className="font-semibold text-amber-400 mb-3">👑 Manager Daily Workflow</p>
              <ul className="space-y-2">{['Login → Dashboard: Check today\'s call stats and leaderboard', 'Reports: Review weekly performance, export CSV for team meeting', 'Pipeline: Check stuck deals, reassign if needed', 'Team: Compare rep performance, identify top performer'].map((s, i) => <li key={i} className="text-sm text-gray-300 flex gap-2"><span className="text-amber-400">→</span>{s}</li>)}</ul>
            </div>
            <div>
              <p className="font-semibold text-blue-400 mb-3">💼 Sales Rep Daily Workflow</p>
              <ul className="space-y-2">{['Login → Tasks: Check today\'s follow-ups and overdue tasks', 'Leads: Review new assigned leads, click WhatsApp icon to contact', 'Pipeline: Move deals through stages as projects progress', 'Quotes: Create quotes with GCT for active deals'].map((s, i) => <li key={i} className="text-sm text-gray-300 flex gap-2"><span className="text-blue-400">→</span>{s}</li>)}</ul>
            </div>
            <div>
              <p className="font-semibold text-green-400 mb-3">📞 Login Credentials</p>
              <div className="bg-gray-800/50 rounded-xl p-4 font-mono text-sm space-y-1">
                <p className="text-gray-300">Manager: <span className="text-amber-400">manager</span> / <span className="text-amber-400">manager123</span></p>
                <p className="text-gray-300">Rep: <span className="text-blue-400">keisha</span> / <span className="text-blue-400">manager123</span></p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'jamaica' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">🇯🇲 Jamaica Configuration</h2>
            <div className="bg-gray-800/50 rounded-xl p-4">
              <p className="font-semibold text-white mb-2">15% GCT Tax Formula</p>
              <code className="text-amber-400 text-sm">preTax = grandTotal / 1.15</code>
              <p className="text-sm text-gray-400 mt-2">Example: Invoice of JMD $115,000 → Pre-tax: $100,000 → GCT: $15,000</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4">
              <p className="font-semibold text-white mb-3">Public Holidays (Call Blocking)</p>
              <ul className="space-y-1">{["Jan 1 - New Year's Day", "Apr 18 - Good Friday", "Apr 21 - Easter Monday", "May 23 - Labour Day", "Aug 1 - Emancipation Day", "Aug 6 - Independence Day", "Oct 20 - National Heroes Day", "Dec 25 - Christmas Day", "Dec 26 - Boxing Day"].map((h, i) => <li key={i} className="text-sm text-gray-300 flex gap-2"><span className="text-green-400">🇯🇲</span>{h}</li>)}</ul>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4">
              <p className="font-semibold text-white mb-2">Phone Format</p>
              <code className="text-amber-400 text-sm">+1-876-XXX-XXXX (Jamaica country code)</code>
              <p className="text-sm text-gray-400 mt-1">WhatsApp: wa.me/1876XXXXXXX (no dashes)</p>
            </div>
          </div>
        )}

        {activeTab === 'troubleshoot' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Troubleshooting</h2>
            {[
              { issue: 'White screen / blank page', fix: 'Hard refresh with Ctrl+Shift+R. If persists, clear localStorage: Settings → Reset All Data.' },
              { issue: 'Data not saving after refresh', fix: 'Check if localStorage is enabled in your browser. Incognito/private mode disables localStorage.' },
              { issue: 'MacroDroid not logging calls', fix: 'Check battery optimization is disabled for MacroDroid. Settings → Apps → MacroDroid → Battery → Unrestricted.' },
              { issue: 'Google Sheet not receiving data', fix: 'Test your Apps Script URL in browser. Should return "OK". Check the URL in MacroDroid has no spaces.' },
              { issue: 'WooCommerce connection failed', fix: 'Check API keys are correct. CORS error means you need a Vercel serverless proxy (advanced setup).' },
              { issue: 'Login not working', fix: 'Use demo credentials: manager/manager123. WordPress auth requires WooCommerce connection first.' },
              { issue: 'URL not changing when navigating', fix: 'The app uses hash routing (/#/page). The URL shows /#/dashboard etc. This is normal for this hosting.' },
            ].map((t, i) => (
              <div key={i} className="border border-gray-800 rounded-xl p-4">
                <p className="font-medium text-red-400 mb-1">⚠️ {t.issue}</p>
                <p className="text-sm text-gray-400">✅ {t.fix}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Documentation;
