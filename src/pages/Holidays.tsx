import React from 'react';
import { Calendar, AlertTriangle, CheckCircle } from 'lucide-react';

const HOLIDAYS = [
  { date: '2025-01-01', name: "New Year's Day", type: 'Public Holiday' },
  { date: '2025-02-24', name: "Bob Marley Birthday (observed)", type: 'Observed' },
  { date: '2025-04-18', name: "Good Friday", type: 'Public Holiday' },
  { date: '2025-04-21', name: "Easter Monday", type: 'Public Holiday' },
  { date: '2025-05-23', name: "Labour Day", type: 'Public Holiday' },
  { date: '2025-08-01', name: "Emancipation Day", type: 'Public Holiday' },
  { date: '2025-08-06', name: "Independence Day", type: 'Public Holiday' },
  { date: '2025-10-20', name: "National Heroes Day", type: 'Public Holiday' },
  { date: '2025-12-25', name: "Christmas Day", type: 'Public Holiday' },
  { date: '2025-12-26', name: "Boxing Day", type: 'Public Holiday' },
];

const Holidays: React.FC = () => {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const todayHoliday = HOLIDAYS.find(h => h.date === todayStr);

  const upcoming = HOLIDAYS.filter(h => new Date(h.date) >= today).slice(0, 5);
  const past = HOLIDAYS.filter(h => new Date(h.date) < today);

  const daysUntil = (date: string) => {
    const diff = new Date(date).getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">🇯🇲 Jamaica Public Holidays</h1>
        <p className="text-gray-400 text-sm mt-1">Holiday call blocking for your Jamaica sales team</p>
      </div>

      {/* Today's Status */}
      <div className={`rounded-2xl p-5 border ${todayHoliday ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
        <div className="flex items-center gap-3">
          {todayHoliday ? (
            <>
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <div>
                <p className="font-bold text-red-300">🚫 Holiday Today — Call Blocking Active</p>
                <p className="text-sm text-red-400 mt-0.5">{todayHoliday.name} — Calls are blocked for today</p>
              </div>
            </>
          ) : (
            <>
              <CheckCircle className="w-6 h-6 text-green-400" />
              <div>
                <p className="font-bold text-green-300">✅ Normal Business Day</p>
                <p className="text-sm text-green-400 mt-0.5">No holiday today — team can make calls</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Upcoming Holidays */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-amber-400" /> Upcoming Holidays 2025
        </h2>
        <div className="space-y-3">
          {upcoming.map((h) => {
            const days = daysUntil(h.date);
            return (
              <div key={h.date} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="text-center w-12">
                    <p className="text-lg font-bold text-amber-400">{new Date(h.date).getDate()}</p>
                    <p className="text-xs text-gray-500">{new Date(h.date).toLocaleDateString('en', { month: 'short' })}</p>
                  </div>
                  <div>
                    <p className="font-medium text-white">{h.name}</p>
                    <p className="text-xs text-gray-500">{h.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  {days === 0 ? (
                    <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full font-medium">Today</span>
                  ) : days === 1 ? (
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full font-medium">Tomorrow</span>
                  ) : (
                    <span className="text-xs bg-gray-700 text-gray-400 px-2 py-1 rounded-full">{days} days</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Past Holidays */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-4">Past Holidays 2025</h2>
        <div className="space-y-2">
          {past.map((h) => (
            <div key={h.date} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-xl opacity-60">
              <p className="text-sm text-gray-400">{h.name}</p>
              <p className="text-xs text-gray-600">{new Date(h.date).toLocaleDateString()}</p>
            </div>
          ))}
          {past.length === 0 && <p className="text-sm text-gray-500">No past holidays yet this year</p>}
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-gray-900 border border-amber-500/20 rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-4">🇯🇲 How Holiday Blocking Works</h2>
        <div className="space-y-3">
          {[
            'The system checks today\'s date against Jamaica\'s official public holidays',
            'When a holiday is detected, a red banner appears at the top of all pages',
            'Reps are notified not to make outbound calls on holidays',
            'Incoming calls are still logged but flagged as "Holiday - Inbound"',
            'Reports distinguish between holiday and regular call days',
            'MacroDroid macros can be paused on holidays via the Settings page',
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">{i + 1}</div>
              <p className="text-sm text-gray-300">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Holidays;
