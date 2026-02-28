import React from 'react';
import { Users, Phone, TrendingUp, Target } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const REPS = [
  { name: 'Keisha Brown', role: 'Senior Rep', avatar: 'KB', color: 'from-amber-400 to-orange-500' },
  { name: 'Andre Williams', role: 'Sales Rep', avatar: 'AW', color: 'from-blue-400 to-blue-600' },
  { name: 'Marcia Thompson', role: 'Sales Rep', avatar: 'MT', color: 'from-purple-400 to-purple-600' },
  { name: 'Devon Campbell', role: 'Sales Rep', avatar: 'DC', color: 'from-green-400 to-green-600' },
  { name: 'Tanya Reid', role: 'Junior Rep', avatar: 'TR', color: 'from-pink-400 to-pink-600' },
];

const Team: React.FC = () => {
  const { allCalls, state } = useApp();
  const calls = allCalls || [];
  const deals = state.deals || [];

  const repStats = REPS.map(rep => {
    const firstName = rep.name.split(' ')[0].toLowerCase();
    const repCalls = calls.filter(c => {
      const repName = String((c as any).repName || '').toLowerCase();
      const repId = String(c.repId || '').toLowerCase();
      return repName.includes(firstName) || repId.includes(firstName) || repId === `rep${REPS.indexOf(rep) + 1}`;
    });
    const repDeals = deals.filter(d => {
      const repId = String(d.repId || '').toLowerCase();
      return repId.includes(firstName) || repId === `rep${REPS.indexOf(rep) + 1}`;
    });
    return {
      ...rep,
      calls: repCalls.length,
      outgoing: repCalls.filter(c => c.type === 'Outgoing').length,
      incoming: repCalls.filter(c => c.type === 'Incoming').length,
      missed: repCalls.filter(c => c.type === 'Missed').length,
      deals: repDeals.length,
      revenue: repDeals.filter(d => d.stage === 'Delivered').reduce((s, d) => s + d.value, 0),
    };
  });

  const chartData = repStats.map(r => ({
    name: r.name.split(' ')[0],
    Outgoing: r.outgoing,
    Incoming: r.incoming,
    Missed: r.missed,
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Team Performance</h1>
        <p className="text-gray-400 text-sm mt-1">Monitor your 5-person sales team in Jamaica</p>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Team Calls', value: calls.length, icon: Phone, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Active Deals', value: deals.filter(d => d.stage !== 'Delivered' && d.stage !== 'Lost').length, icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'Team Members', value: REPS.length, icon: Users, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Deals Closed', value: deals.filter(d => d.stage === 'Delivered').length, icon: Target, color: 'text-purple-400', bg: 'bg-purple-500/10' },
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

      {/* Call Volume Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-4">Call Volume by Rep</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="name" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
            <Bar dataKey="Outgoing" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Incoming" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Missed" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Rep Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {repStats.map((rep) => (
          <div key={rep.name} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${rep.color} flex items-center justify-center text-black font-bold text-sm`}>
                {rep.avatar}
              </div>
              <div>
                <p className="font-semibold text-white">{rep.name}</p>
                <p className="text-sm text-gray-400">{rep.role}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-xl font-bold text-green-400">{rep.outgoing}</p>
                <p className="text-xs text-gray-500">Outgoing</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-blue-400">{rep.incoming}</p>
                <p className="text-xs text-gray-500">Incoming</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-red-400">{rep.missed}</p>
                <p className="text-xs text-gray-500">Missed</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between">
              <div>
                <p className="text-sm font-bold text-white">{rep.deals}</p>
                <p className="text-xs text-gray-500">Deals</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-amber-400">JMD {rep.revenue.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Revenue</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Team;
