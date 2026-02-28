import React, { useState } from 'react';
import { MessageSquare, Mail, Copy, Check, Send } from 'lucide-react';
import { useApp } from '../context/AppContext';

const TEMPLATES = [
  { id: '1', name: 'Initial Inquiry Response', type: 'WhatsApp', body: `Hi {client_name}! 👋 Thanks for reaching out to Dirty Hand Designs. I'm {rep_name} and I'd love to help with your {project} project. Could we schedule a quick call to discuss your vision? 🎨` },
  { id: '2', name: 'Follow-Up (No Response)', type: 'WhatsApp', body: `Hi {client_name}, just following up on our conversation about your branding project at Dirty Hand Designs. We'd love to help bring your vision to life! 🚀 Are you still interested?` },
  { id: '3', name: 'Quote/Proposal Send', type: 'Email', body: `Dear {client_name},\n\nPlease find attached our proposal for {project}.\n\nTotal Investment: {amount} JMD (inclusive of 15% GCT)\n\nThis quote is valid for 30 days. Please don't hesitate to reach out with any questions.\n\nBest regards,\n{rep_name}\nDirty Hand Designs` },
  { id: '4', name: 'Design Review Request', type: 'WhatsApp', body: `Hi {client_name}! 🎨 Your design mockups are ready for review. Please check your email for the files. We're excited to hear your feedback! Let us know if you'd like to schedule a review call.` },
  { id: '5', name: 'Project Completion', type: 'Email', body: `Dear {client_name},\n\nWe're thrilled to let you know that your {project} project is complete! 🎉\n\nFinal files have been sent to your email. It was a pleasure working with you.\n\nWe'd greatly appreciate a referral if you're happy with our work!\n\nWarm regards,\n{rep_name}\nDirty Hand Designs` },
  { id: '6', name: 'Payment Reminder', type: 'WhatsApp', body: `Hi {client_name}, this is a friendly reminder that invoice #{invoice} for {amount} JMD is due. Please feel free to reach out if you have any questions. Thank you! 🙏` },
  { id: '7', name: 'Thank You / Referral', type: 'WhatsApp', body: `Hi {client_name}! 😊 Thank you so much for choosing Dirty Hand Designs. We hope you love your new {project}! If you know anyone who needs branding, we'd love a referral. Thanks again! 🇯🇲` },
  { id: '8', name: 'Holiday Greeting', type: 'WhatsApp', body: `Hi {client_name}! Wishing you a wonderful holiday from all of us at Dirty Hand Designs! 🇯🇲🎊 We look forward to continuing to serve you in the new year!` },
];

const Templates: React.FC = () => {
  const { state } = useApp();
  const [filter, setFilter] = useState('All');
  const [copied, setCopied] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [selected, setSelected] = useState<typeof TEMPLATES[0] | null>(null);

  const filtered = TEMPLATES.filter(t => filter === 'All' || t.type === filter);

  const processTemplate = (body: string) => {
    return body
      .replace(/{rep_name}/g, state.user?.name || 'Rep')
      .replace(/{client_name}/g, 'Client')
      .replace(/{project}/g, 'your project')
      .replace(/{amount}/g, '0')
      .replace(/{invoice}/g, '001');
  };

  const copyTemplate = (t: typeof TEMPLATES[0]) => {
    navigator.clipboard.writeText(processTemplate(t.body));
    setCopied(t.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const sendWhatsApp = (t: typeof TEMPLATES[0]) => {
    const msg = encodeURIComponent(processTemplate(t.body));
    const num = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${num || '1876'}?text=${msg}`, '_blank');
  };

  const sendEmail = (t: typeof TEMPLATES[0]) => {
    const body = encodeURIComponent(processTemplate(t.body));
    window.open(`mailto:?subject=${encodeURIComponent(t.name)}&body=${body}`, '_blank');
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Message Templates</h1>
        <p className="text-gray-400 text-sm mt-1">Pre-written WhatsApp & Email templates for your team</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['All', 'WhatsApp', 'Email'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter === f ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {f === 'WhatsApp' ? <MessageSquare className="w-4 h-4" /> : f === 'Email' ? <Mail className="w-4 h-4" /> : null}
            {f}
          </button>
        ))}
      </div>

      {/* Phone Input for WhatsApp */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
        <MessageSquare className="w-5 h-5 text-green-400 flex-shrink-0" />
        <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Enter phone number to send WhatsApp (e.g. 18765551234)" className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm" />
      </div>

      {/* Templates Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((t) => (
          <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-white">{t.name}</p>
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mt-1 ${t.type === 'WhatsApp' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
                  {t.type === 'WhatsApp' ? <MessageSquare className="w-3 h-3" /> : <Mail className="w-3 h-3" />} {t.type}
                </span>
              </div>
              <button onClick={() => copyTemplate(t)} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                {copied === t.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
              </button>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-line line-clamp-3">{processTemplate(t.body)}</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => copyTemplate(t)} className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium py-2 rounded-xl transition-colors">
                {copied === t.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />} Copy
              </button>
              {t.type === 'WhatsApp' ? (
                <button onClick={() => sendWhatsApp(t)} className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 rounded-xl transition-colors">
                  <Send className="w-4 h-4" /> WhatsApp
                </button>
              ) : (
                <button onClick={() => sendEmail(t)} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-xl transition-colors">
                  <Mail className="w-4 h-4" /> Email
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Templates;
