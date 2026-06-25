import React, { useState, useEffect, useCallback } from 'react';
import { Users, Phone, TrendingUp, Target, RefreshCw, Smartphone } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const AVATAR_COLORS = [
  'from-amber-400 to-orange-500',
  'from-blue-400 to-blue-600',
  'from-purple-400 to-purple-600',
  'from-green-400 to-green-600',
  'from-pink-400 to-pink-600',
  'from-cyan-400 to-cyan-600',
  'from-red-400 to-red-500',
  'from-indigo-400 to-indigo-600',
];

interface RepStat {
  id: string;
  name: string;
  email: string;
  role: string;
  companion_installed: boolean;
  has_device: boolean;
  outgoing: number;
  incoming: number;
  missed: number;
  total_calls: number;
  deal_count: number;
  deals_closed: number;
  revenue: number;
}

interface Totals {
  calls: number;
  active_deals: number;
  closed_deals: number;
  members: number;
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function roleLabel(role: string) {
  return role === 'owner' ? 'Owner' : role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

const Team: React.FC = () => {
  const [stats, setStats] = useState<RepStat[]>([]);
  const [totals, setTotals] = useState<Totals>({ calls: 0, active_deals: 0, closed_deals: 0, members: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/crm?target=team&action=stats');
      const data = await r.json();
      if (data.success) {
        setStats(data.stats || []);
        setTotals(data.totals || { calls: 0, active_deals: 0, closed_deals: 0, members: 0 });
      } else {
        setError(data.error || 'Failed to load team stats');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const chartData = stats.map(r => ({
    name: r.name.split(' ')[0],
    Outgoing: r.outgoing,
    Incoming: r.incoming,
    Missed: r.missed,
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Team Performance</h1>
          <p className="text-gray-400 text-sm mt-1">
            {loading ? 'Loading…' : `${totals.members} team member${totals.members !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 text-sm">{error}</div>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Team Calls', value: totals.calls, icon: Phone, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Active Deals', value: totals.active_deals, icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'Team Members', value: totals.members, icon: Users, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Deals Closed', value: totals.closed_deals, icon: Target, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <p className="text-2xl font-bold text-white">{loading ? '—' : s.value}</p>
            <p className="text-sm text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="animate-spin text-amber-500" size={24} />
        </div>
      ) : stats.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
          <Users className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No team members yet</p>
          <p className="text-gray-600 text-sm mt-1">Invite team members in Settings → Team.</p>
        </div>
      ) : (
        <>
          {/* Call Volume Chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="font-semibold text-white mb-4">Call Volume by Rep</h2>
            {totals.calls === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-600 text-sm">
                No calls logged yet — link devices to reps in Settings → Team.
              </div>
            ) : (
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
            )}
          </div>

          {/* Rep Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stats.map((rep, idx) => (
              <div key={rep.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${AVATAR_COLORS[idx % AVATAR_COLORS.length]} flex items-center justify-center text-black font-bold text-sm flex-shrink-0`}>
                    {initials(rep.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{rep.name}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm text-gray-400">{roleLabel(rep.role)}</p>
                      {!rep.has_device && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-gray-800 text-gray-500 border border-gray-700 px-1.5 py-0.5 rounded-full">
                          <Smartphone size={9} />
                          No device
                        </span>
                      )}
                    </div>
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
                    <p className="text-sm font-bold text-white">{rep.deal_count}</p>
                    <p className="text-xs text-gray-500">Deals</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-green-400">{rep.deals_closed}</p>
                    <p className="text-xs text-gray-500">Closed</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-amber-400">JMD {rep.revenue.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Revenue</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Team;
