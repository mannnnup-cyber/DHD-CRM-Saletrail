import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface Call {
  id: string;
  phone_number: string;
  contact_name?: string;
  called_at: string;
  duration_seconds: number;
  user_id: string;
  user?: { name: string };
  recording?: { recording_id: string; file_path: string };
  transcript?: { text: string };
  insight?: {
    sentiment: string;
    sentiment_score: number;
    topics: string[];
    coaching_notes?: string;
  };
}

export default function CoachingDashboard() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative'>('all');
  const [repFilter, setRepFilter] = useState<string>('all');
  const [reps, setReps] = useState<any[]>([]);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [coachingNotes, setCoachingNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    loadCalls();
    loadReps();
  }, []);

  const loadReps = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'rep')
        .limit(100);

      if (!error) {
        setReps(data || []);
      }
    } catch (err) {
      console.error('Error loading reps:', err);
    }
  };

  const loadCalls = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('cellular_calls as c')
        .select(
          `
          id,
          phone_number,
          contact_name,
          called_at,
          duration_seconds,
          user_id,
          user:user_id(id, full_name),
          recording:recording_id(recording_id, file_path),
          transcript:call_id(text),
          insight:call_id(sentiment, sentiment_score, topics, coaching_notes)
        `
        )
        .eq('has_recording', true)
        .order('called_at', { ascending: false })
        .limit(50);

      if (filter !== 'all') {
        query = query.eq('insight.sentiment', filter.toUpperCase());
      }

      if (repFilter !== 'all') {
        query = query.eq('user_id', repFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading calls:', error);
        return;
      }

      setCalls(data || []);
    } catch (err) {
      console.error('Error loading calls:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveCoachingNotes = async () => {
    if (!selectedCall) return;

    try {
      setSavingNotes(true);

      const { error } = await supabase
        .from('call_insights')
        .update({ coaching_notes: coachingNotes })
        .eq('call_id', selectedCall.id);

      if (error) {
        console.error('Error saving notes:', error);
        return;
      }

      // Update local state
      if (selectedCall.insight) {
        selectedCall.insight.coaching_notes = coachingNotes;
      }

      alert('✓ Coaching notes saved');
    } catch (err) {
      console.error('Error:', err);
      alert('✗ Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleSelectCall = (call: Call) => {
    setSelectedCall(call);
    setCoachingNotes(call.insight?.coaching_notes || '');
  };

  const sentimentColor = (sentiment?: string) => {
    switch (sentiment?.toUpperCase()) {
      case 'POSITIVE':
        return 'text-green-700 bg-green-100';
      case 'NEGATIVE':
        return 'text-red-700 bg-red-100';
      default:
        return 'text-gray-700 bg-gray-100';
    }
  };

  const topicLabel = (topic: string): string => {
    return topic
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">Loading coaching data...</div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">📞 Call Coaching Dashboard</h1>
        <p className="text-gray-600 mb-6">
          Review reps' calls, sentiment analysis, and provide coaching feedback
        </p>

        {/* Filters */}
        <div className="mb-6 flex gap-4 flex-wrap">
          <div>
            <label className="block text-sm font-semibold mb-2">Sentiment</label>
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value as any);
                loadCalls();
              }}
              className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Calls</option>
              <option value="positive">✓ Positive</option>
              <option value="negative">✗ Needs Coaching</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Sales Rep</label>
            <select
              value={repFilter}
              onChange={(e) => {
                setRepFilter(e.target.value);
                loadCalls();
              }}
              className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Reps</option>
              {reps.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calls List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-100 border-b border-gray-200">
                <h2 className="font-semibold">Calls ({calls.length})</h2>
              </div>

              <div className="overflow-y-auto max-h-[800px]">
                {calls.map((call) => (
                  <div
                    key={call.id}
                    onClick={() => handleSelectCall(call)}
                    className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 ${
                      selectedCall?.id === call.id ? 'bg-blue-100' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-sm">
                          {call.contact_name || call.phone_number}
                        </p>
                        <p className="text-xs text-gray-600">
                          {call.user?.name || 'Unknown Rep'}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded ${sentimentColor(call.insight?.sentiment)}`}
                      >
                        {call.insight?.sentiment || 'NO DATA'}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(call.called_at), {
                        addSuffix: true,
                      })}
                    </p>

                    <p className="text-xs text-gray-500">
                      ⏱ {Math.round(call.duration_seconds / 60)} min
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Call Details */}
          {selectedCall ? (
            <div className="lg:col-span-2 space-y-4">
              {/* Call Info Card */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold">
                      {selectedCall.contact_name || selectedCall.phone_number}
                    </h2>
                    <p className="text-sm text-gray-600">
                      {selectedCall.user?.name} • {new Date(selectedCall.called_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`text-lg font-bold px-3 py-1 rounded ${sentimentColor(selectedCall.insight?.sentiment)}`}
                  >
                    {selectedCall.insight?.sentiment || 'NO SENTIMENT DATA'}
                  </span>
                </div>

                {selectedCall.insight?.sentiment_score && (
                  <div className="mb-4">
                    <p className="text-sm font-semibold mb-2">Confidence Score</p>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          selectedCall.insight.sentiment === 'POSITIVE'
                            ? 'bg-green-500'
                            : 'bg-red-500'
                        }`}
                        style={{
                          width: `${selectedCall.insight.sentiment_score * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {Math.round(selectedCall.insight.sentiment_score * 100)}% confidence
                    </p>
                  </div>
                )}

                <p className="text-sm text-gray-600">
                  <strong>Duration:</strong> {Math.round(selectedCall.duration_seconds / 60)} minutes
                </p>
              </div>

              {/* Key Topics */}
              {selectedCall.insight?.topics && selectedCall.insight.topics.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="font-semibold mb-3">Key Topics Discussed</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedCall.insight.topics.map((topic: string) => (
                      <span
                        key={topic}
                        className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium"
                      >
                        {topicLabel(topic)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Transcript */}
              {selectedCall.transcript?.text && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="font-semibold mb-3">Transcript</h3>
                  <div className="bg-gray-50 p-4 rounded max-h-[300px] overflow-y-auto">
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {selectedCall.transcript.text}
                    </p>
                  </div>
                </div>
              )}

              {/* Recording Player */}
              {selectedCall.recording?.file_path && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="font-semibold mb-3">📱 Call Recording</h3>
                  <audio
                    controls
                    className="w-full"
                    src={`${process.env.REACT_APP_SUPABASE_URL}/storage/v1/object/public/call-recordings/${selectedCall.recording.file_path}`}
                  />
                </div>
              )}

              {/* Coaching Notes */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-semibold mb-3">💬 Coaching Notes</h3>
                <textarea
                  value={coachingNotes}
                  onChange={(e) => setCoachingNotes(e.target.value)}
                  placeholder="Document specific coaching points, areas for improvement, praise for good technique..."
                  className="w-full h-32 p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={saveCoachingNotes}
                  disabled={savingNotes}
                  className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {savingNotes ? 'Saving...' : '💾 Save Coaching Notes'}
                </button>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
              Select a call to review details and add coaching notes
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
