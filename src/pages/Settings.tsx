import React from 'react';
import { useApp } from '../context/AppContext';
import { Save, Shield, Smartphone, Bell, Globe, Database, HelpCircle } from 'lucide-react';

const Settings: React.FC = () => {
  const { state, updateSettings } = useApp();
  const settings = state.settings;

  const handleToggle = (key: keyof typeof settings) => {
    updateSettings({ [key]: !settings[key] });
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <header>
        <h1 className="text-2xl font-bold text-white">System Settings</h1>
        <p className="text-gray-400">Configure your CRM and automation preferences</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">
          <h3 className="font-bold text-white flex items-center gap-2 mb-2">
            <Smartphone className="w-5 h-5 text-amber-500" />
            Automation
          </h3>
          
          <div className="space-y-4">
            {[
              { id: 'simAutoLogging', label: 'SIM Call Auto-Logging', desc: 'Automatically log incoming/outgoing SIM calls' },
              { id: 'twoSidedRecording', label: 'Two-Sided Recording', desc: 'Capture both sides of the conversation' },
              { id: 'whatsAppDetection', label: 'WhatsApp Call Tracking', desc: 'Detect and log WhatsApp voice calls' },
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between group">
                <div>
                  <p className="text-sm font-medium text-gray-200">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
                <button 
                  onClick={() => handleToggle(item.id as any)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings[item.id as keyof typeof settings] ? 'bg-amber-500' : 'bg-gray-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings[item.id as keyof typeof settings] ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">
          <h3 className="font-bold text-white flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-amber-500" />
            Compliance & Security
          </h3>
          
          <div className="space-y-4">
            {[
              { id: 'holidayBlocking', label: 'Jamaica Holiday Block', desc: 'Prevent calls on public holidays' },
              { id: 'notifications', label: 'Manager Notifications', desc: 'Alert manager on significant events' },
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between group">
                <div>
                  <p className="text-sm font-medium text-gray-200">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
                <button 
                  onClick={() => handleToggle(item.id as any)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings[item.id as keyof typeof settings] ? 'bg-amber-500' : 'bg-gray-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings[item.id as keyof typeof settings] ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 md:col-span-2">
          <h3 className="font-bold text-white flex items-center gap-2 mb-6">
            <Globe className="w-5 h-5 text-amber-500" />
            Regional & Localization
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              <select className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-amber-500/50 appearance-none">
                <option>JMD</option>
                <option>USD</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">GCT Tax Rate (%)</label>
              <input 
                type="number" 
                value={settings.gctRate}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-amber-500/50"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <button className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-white transition-colors">
          Discard Changes
        </button>
        <button className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2">
          <Save className="w-4 h-4" />
          Save Settings
        </button>
      </div>
    </div>
  );
};

export default Settings;
