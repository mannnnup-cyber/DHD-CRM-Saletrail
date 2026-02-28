import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, MessageSquare, Search, Filter, RefreshCw } from 'lucide-react';
import { CallType } from '../data/types';

const CallLogs: React.FC = () => {
  const { state, allCalls } = useApp();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [repFilter, setRepFilter] = useState('All');

  const REPS = ['Keisha', 'Andre', 'Marcia', 'Devon', 'Tanya'];

  const getCallIcon = (type: CallType | string) => {
    switch (type) {
      case 'Incoming': return <PhoneIncoming className="w-4 h-4 text-green-500" />;
      case 'Outgoing': return <PhoneOutgoing className="w-4 h-4 text-blue-500" />;
      case 'Missed': return <PhoneMissed className="w-4 h-4 text-red-500" />;
      case 'WhatsApp': return <MessageSquare className="w-4 h-4 text-emerald-500" />;
      default: return <Phone className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      'Incoming': 'bg-green-500/10 text-green-400',
      'Outgoing': 'bg-blue-500/10 text-blue-400',
      'Missed': 'bg-red-500/10 text-red-400',
      'WhatsApp': 'bg-emerald-500/10 text-emerald-400',
    };
    return styles[type] || 'bg-gray-500/10 text-gray-400';
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds === 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const getRepName = (call: any) => {
    if (call.repName) return String(call.repName);
    const repId = String(call.repId || '');
    const repMap: Record<string, string> = {
      'rep1': 'Keisha Brown', 'rep2': 'Andre Williams',
      'rep3': 'Marcia Thompson', 'rep4': 'Devon Campbell', 'rep5': 'Tanya Reid'
    };
    return repMap[repId] || repId;
  };

  const getContactInfo = (call: any) => {
    const contact = state.leads.find(l => l.id === call.contactId);
    if (contact) return { name: contact.name, phone: contact.phone, company: contact.company };
    if (call.contactName || call.contactPhone) {
      return {
        name: String(call.contactName || call.notes || 'Unknown'),
        phone: String(call.contactPhone || ''),
        company: ''
      };
    }
    return { name: 'Unknown Contact', phone: '', company: '' };
  };

  const filteredCalls = allCalls.filter(call => {
    const contact = getContactInfo(call);
    const repName = getRepName(call);
    const matchesSearch = !search ||
      contact.name.toLowerCase().includes(search.toLowerCase()) ||
      contact.phone.includes(search) ||
      repName.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'All' || call.type === typeFilter;
    const matchesRep = repFilter === 'All' || repName.toLowerCase().includes(repFilter.toLowerCase());
    return matchesSearch && matchesType && matchesRep;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const stats = {
    total: allCalls.length,
    outgoing: allCalls.filter(c => c.type === 'Outgoing').length,
    incoming: allCalls.filter(c => c.type === 'Incoming').length,
    missed: allCalls.filter(c => c.type === 'Missed').length,
    whatsapp: allCalls.filter(c => c.type === 'WhatsApp').length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Call Logs</h1>
          <p className="text-gray-400 text-sm mt-1">All calls from SIM + Google Sheets sync</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <RefreshCw className="w-3 h-3" />
          <span>Last synced: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'Outgoing', value: stats.outgoing, color: 'text-blue-400' },
          { label: 'Incoming', value: stats.incoming, color: 'text-green-400' },
          { label: 'Missed', value: stats.missed, color: 'text-red-400' },
          { label: 'WhatsApp', value: stats.whatsapp, color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search contacts, numbers, reps..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-amber-500/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-xl py-2.5 px-3 text-sm text-white outline-none focus:border-amber-500/50"
          >
            {['All', 'Outgoing', 'Incoming', 'Missed', 'WhatsApp'].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={repFilter}
            onChange={e => setRepFilter(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-xl py-2.5 px-3 text-sm text-white outline-none focus:border-amber-500/50"
          >
            <option value="All">All Reps</option>
            {REPS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {/* Call Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                {['Type', 'Contact', 'Phone', 'Duration', 'Date & Time', 'Rep', 'WhatsApp'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredCalls.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-600">
                    No calls found. Sync your Google Sheet on the Call Sync page.
                  </td>
                </tr>
              ) : filteredCalls.map((call) => {
                const contact = getContactInfo(call);
                const repName = getRepName(call);
                const phone = contact.phone || (call as any).contactPhone || '';
                const waNumber = phone.replace(/\D/g, '');

                return (
                  <tr key={call.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getCallIcon(call.type)}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getTypeBadge(call.type)}`}>
                          {call.type}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-white">{contact.name}</p>
                      {contact.company && <p className="text-xs text-gray-500">{contact.company}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{phone || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{formatDuration(call.duration)}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(call.timestamp).toLocaleDateString()}{' '}
                      {new Date(call.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-[10px] font-bold text-black">
                          {repName[0]}
                        </div>
                        <span className="text-sm text-gray-300">{repName.split(' ')[0]}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {waNumber && (
                        <a
                          href={`https://wa.me/${waNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-lg flex items-center justify-center transition-all"
                          title="Open WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredCalls.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-500">
            Showing {filteredCalls.length} of {allCalls.length} calls
          </div>
        )}
      </div>
    </div>
  );
};

export default CallLogs;
