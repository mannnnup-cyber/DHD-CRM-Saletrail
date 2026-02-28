import React from 'react';
import { FileText, Download, TrendingUp, Phone, DollarSign, Target } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const REPS = ['Keisha Brown', 'Andre Williams', 'Marcia Thompson', 'Devon Campbell', 'Tanya Reid'];

const Reports: React.FC = () => {
  const { state, allCalls } = useApp();
  const calls = allCalls || [];
  const deals = state.deals || [];

  const repStats = REPS.map((name, i) => {
    const firstName = name.split(' ')[0].toLowerCase();
    const repCalls = calls.filter(c => {
      const repName = String((c as any).repName || '').toLowerCase();
      const repId = String(c.repId || '').toLowerCase();
      return repName.includes(firstName) || repId.includes(firstName) || repId === `rep${i + 1}`;
    });
    const repDeals = deals.filter(d => {
      const repId = String(d.repId || '').toLowerCase();
      return repId.includes(firstName) || repId === `rep${i + 1}`;
    });
    const won = repDeals.filter(d => d.stage === 'Delivered');
    return {
      rank: i + 1,
      name,
      calls: repCalls.length,
      outgoing: repCalls.filter(c => c.type === 'Outgoing').length,
      missed: repCalls.filter(c => c.type === 'Missed').length,
      dealsWon: won.length,
      conversion: repDeals.length > 0 ? Math.round((won.length / repDeals.length) * 100) : 0,
      revenue: won.reduce((s, d) => s + d.value, 0),
    };
  }).sort((a, b) => b.revenue - a.revenue).map((r, i) => ({ ...r, rank: i + 1 }));

  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayCalls = calls.filter(c => new Date(c.timestamp).toDateString() === d.toDateString());
    return {
      day: d.toLocaleDateString('en', { weekday: 'short' }),
      calls: dayCalls.length,
      outgoing: dayCalls.filter(c => c.type === 'Outgoing').length,
    };
  });

  const exportCSV = () => {
    const headers = ['Rank', 'Rep', 'Total Calls', 'Outgoing', 'Missed', 'Deals Won', 'Conversion %', 'Revenue (JMD)'];
    const rows = repStats.map(r => [r.rank, r.name, r.calls, r.outgoing, r.missed, r.dealsWon, r.conversion + '%', r.revenue]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dhd-sales-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales Reports</h1>
          <p className="text-gray-400 text-sm mt-1">Team performance analytics and leaderboards</p>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-bold px-4 py-2 rounded-xl transition-colors">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Calls', value: calls.length, icon: Phone, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Deals Won', value: deals.filter(d => d.stage === 'Delivered').length, icon: Target, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'Revenue (JMD)', value: `${(deals.filter(d => d.stage === 'Delivered').reduce((s, d) => s + d.value, 0) / 1000).toFixed(0)}K`, icon: DollarSign, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Avg Conversion', value: `${Math.round(repStats.reduce((s, r) => s + r.conversion, 0) / repStats.length)}%`, icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-sm text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Weekly Trend */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-4">Weekly Call Trend</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={weeklyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="day" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
            <Line type="monotone" dataKey="calls" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b' }} />
            <Line type="monotone" dataKey="outgoing" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Leaderboard */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-gray-800">
          <h2 className="font-semibold text-white">Team Leaderboard</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                {['Rank', 'Rep', 'Calls', 'Outgoing', 'Missed', 'Won', 'Conversion', 'Revenue'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {repStats.map((r) => (
                <tr key={r.name} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${r.rank === 1 ? 'bg-amber-500 text-black' : r.rank === 2 ? 'bg-gray-400 text-black' : r.rank === 3 ? 'bg-orange-600 text-white' : 'bg-gray-700 text-white'}`}>
                      {r.rank}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-white">{r.name.split(' ')[0]}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{r.calls}</td>
                  <td className="px-4 py-3 text-sm text-green-400">{r.outgoing}</td>
                  <td className="px-4 py-3 text-sm text-red-400">{r.missed}</td>
                  <td className="px-4 py-3 text-sm text-blue-400">{r.dealsWon}</td>
                  <td className="px-4 py-3 text-sm text-amber-400">{r.conversion}%</td>
                  <td className="px-4 py-3 text-sm font-bold text-white">JMD {r.revenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-4">Revenue by Rep</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={repStats.map(r => ({ name: r.name.split(' ')[0], revenue: r.revenue }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="name" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} formatter={(v: any) => [`JMD ${v.toLocaleString()}`, 'Revenue']} />
            <Bar dataKey="revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Reports;
