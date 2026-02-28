import React from 'react';
import { useApp } from '../context/AppContext';
import { Phone, Clock, DollarSign, TrendingUp, AlertTriangle, CheckCircle2, MessageCircle, ArrowUpRight, Target, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const Dashboard: React.FC = () => {
  const { state, allCalls } = useApp();
  const calls = allCalls || [];
  const deals = state.deals || [];
  const tasks = state.tasks || [];
  const leads = state.leads || [];
  const activities = state.activities || [];

  const today = new Date().toDateString();
  const todayCalls = calls.filter(c => new Date(c.timestamp).toDateString() === today);
  const overdueTasks = tasks.filter(t => !t.completed && new Date(t.dueDate) < new Date());
  const activePipeline = deals.filter(d => d.stage !== 'Delivered' && d.stage !== 'Lost');
  const totalRevenue = deals.filter(d => d.stage === 'Delivered').reduce((s, d) => s + d.value, 0);
  const totalTalkTime = calls.reduce((s, c) => s + (c.duration || 0), 0);
  const whatsappCalls = calls.filter(c => c.type === 'WhatsApp').length;

  const weeklyData = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const dayCalls = calls.filter(c => new Date(c.timestamp).toDateString() === d.toDateString());
    return {
      day: d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }).slice(0, 6),
      calls: dayCalls.length,
      outgoing: dayCalls.filter(c => c.type === 'Outgoing').length,
      incoming: dayCalls.filter(c => c.type === 'Incoming').length,
    };
  });

  const pipelineData = [
    { name: 'New Lead', value: deals.filter(d => d.stage === 'New Lead').length, color: '#6b7280' },
    { name: 'Consultation', value: deals.filter(d => d.stage === 'Consultation').length, color: '#3b82f6' },
    { name: 'Quote Sent', value: deals.filter(d => d.stage === 'Quote Sent').length, color: '#f59e0b' },
    { name: 'Design Review', value: deals.filter(d => d.stage === 'Design Review').length, color: '#8b5cf6' },
    { name: 'In Production', value: deals.filter(d => d.stage === 'In Production').length, color: '#06b6d4' },
    { name: 'Delivered', value: deals.filter(d => d.stage === 'Delivered').length, color: '#10b981' },
  ].filter(d => d.value > 0);

  const REPS = ['Keisha Brown', 'Andre Williams', 'Marcia Thompson', 'Devon Campbell', 'Tanya Reid'];
  const leaderboard = REPS.map((name, i) => {
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
      name,
      avatar: name.split(' ').map(n => n[0]).join(''),
      calls: repCalls.length,
      revenue: won.reduce((s, d) => s + d.value, 0),
      conversion: repDeals.length > 0 ? Math.round((won.length / repDeals.length) * 100) : 0,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const recentActivities = [...activities].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 8);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const statCards = [
    { label: "Today's Calls", value: todayCalls.length, sub: `${whatsappCalls} WhatsApp`, icon: Phone, color: 'text-blue-400', bg: 'from-blue-500/20 to-blue-600/5', border: 'border-blue-500/20' },
    { label: 'Active Pipeline', value: activePipeline.length, sub: 'open deals', icon: TrendingUp, color: 'text-amber-400', bg: 'from-amber-500/20 to-amber-600/5', border: 'border-amber-500/20' },
    { label: 'Talk Time (Total)', value: formatTime(totalTalkTime), sub: `${calls.length} total calls`, icon: Clock, color: 'text-green-400', bg: 'from-green-500/20 to-green-600/5', border: 'border-green-500/20' },
    { label: 'Revenue (JMD)', value: `${(totalRevenue / 1000000).toFixed(1)}M`, sub: 'closed deals', icon: DollarSign, color: 'text-purple-400', bg: 'from-purple-500/20 to-purple-600/5', border: 'border-purple-500/20' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Welcome back! Here's your team's performance overview.</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Jamaica Time</p>
          <p className="text-sm font-medium text-gray-300">{new Date().toLocaleDateString('en-JM', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* Overdue Tasks Alert */}
      {overdueTasks.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm font-medium">
            ⚠️ {overdueTasks.length} overdue {overdueTasks.length === 1 ? 'task' : 'tasks'} need attention! Check the Tasks page.
          </p>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className={`bg-gradient-to-br ${s.bg} border ${s.border} rounded-2xl p-5`}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-gray-800/80 rounded-xl flex items-center justify-center">
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <ArrowUpRight className={`w-4 h-4 ${s.color} opacity-60`} />
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
            <p className="text-xs text-gray-600 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Call Volume Chart */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Daily Call Volume (14 days)</h2>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Total</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Outgoing</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="day" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
              <Bar dataKey="calls" fill="#f59e0b" radius={[4, 4, 0, 0]} opacity={0.8} />
              <Bar dataKey="outgoing" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pipeline Pie */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4">Pipeline Distribution</h2>
          {pipelineData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={pipelineData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                    {pipelineData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {pipelineData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-gray-400">{d.name}</span>
                    </div>
                    <span className="text-white font-medium">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-600 text-sm">No pipeline data</div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-white flex items-center gap-2"><Target className="w-4 h-4 text-amber-400" /> Monthly Leaderboard</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {leaderboard.map((rep, i) => (
              <div key={rep.name} className="flex items-center gap-4 px-5 py-3">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? 'bg-amber-500 text-black' : i === 1 ? 'bg-gray-400 text-black' : i === 2 ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                  {i + 1}
                </span>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-black font-bold text-xs flex-shrink-0">
                  {rep.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{rep.name.split(' ')[0]}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${Math.min(rep.conversion, 100)}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">{rep.conversion}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-amber-400">JMD {(rep.revenue / 1000).toFixed(0)}K</p>
                  <p className="text-xs text-gray-500">{rep.calls} calls</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-gray-800">
            <h2 className="font-semibold text-white flex items-center gap-2"><Activity className="w-4 h-4 text-blue-400" /> Recent Activity</h2>
          </div>
          <div className="divide-y divide-gray-800 max-h-80 overflow-y-auto">
            {recentActivities.length === 0 ? (
              <div className="p-8 text-center text-gray-600 text-sm">No recent activity</div>
            ) : recentActivities.map((activity: any) => (
              <div key={activity.id} className="flex items-start gap-3 px-5 py-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  activity.type === 'call' ? 'bg-blue-400' :
                  activity.type === 'deal_moved' ? 'bg-amber-400' :
                  activity.type === 'quote_created' ? 'bg-purple-400' :
                  activity.type === 'task_completed' ? 'bg-green-400' : 'bg-gray-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300">{activity.description}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{new Date(activity.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
          <Phone className="w-5 h-5 text-green-400 mx-auto mb-2" />
          <p className="text-xl font-bold text-white">{calls.filter(c => c.type === 'Outgoing').length}</p>
          <p className="text-xs text-gray-500">Outgoing Calls</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
          <Phone className="w-5 h-5 text-blue-400 mx-auto mb-2" />
          <p className="text-xl font-bold text-white">{calls.filter(c => c.type === 'Incoming').length}</p>
          <p className="text-xs text-gray-500">Incoming Calls</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
          <MessageCircle className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
          <p className="text-xl font-bold text-white">{whatsappCalls}</p>
          <p className="text-xs text-gray-500">WhatsApp Calls</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
          <CheckCircle2 className="w-5 h-5 text-amber-400 mx-auto mb-2" />
          <p className="text-xl font-bold text-white">{leads.length}</p>
          <p className="text-xs text-gray-500">Total Leads</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
