import React, { useState, useEffect } from 'react';
import { useSupabase } from '../hooks/useSupabase';

interface RecordingSettingsType {
  setting_id: string;
  org_id: string;
  scope: 'ORG' | 'TEAM' | 'USER';
  scope_id?: string;
  recording_enabled: boolean;
  excluded_numbers: string[];
  schedule_enabled: boolean;
  schedule_start_time: string;
  schedule_end_time: string;
  schedule_days: boolean[];
  updated_at: string;
}

export default function RecordingSettings() {
  const { supabase } = useSupabase();
  const [settings, setSettings] = useState<RecordingSettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Form state
  const [recordingEnabled, setRecordingEnabled] = useState(true);
  const [excludedNumbers, setExcludedNumbers] = useState<string[]>([]);
  const [newNumber, setNewNumber] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleStart, setScheduleStart] = useState('09:00');
  const [scheduleEnd, setScheduleEnd] = useState('18:00');
  const [scheduleDays, setScheduleDays] = useState<boolean[]>([
    true,
    true,
    true,
    true,
    true,
    false,
    false,
  ]); // Mon-Sun

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('recording_settings')
        .select('*')
        .eq('scope', 'ORG')
        .is('scope_id', null)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = not found
        throw error;
      }

      if (data) {
        setSettings(data);
        setRecordingEnabled(data.recording_enabled);
        setExcludedNumbers(data.excluded_numbers || []);
        setScheduleEnabled(data.schedule_enabled);
        setScheduleStart(data.schedule_start_time || '09:00');
        setScheduleEnd(data.schedule_end_time || '18:00');
        setScheduleDays(data.schedule_days || [true, true, true, true, true, false, false]);
      } else {
        // Create default settings
        await createDefaultSettings();
      }
    } catch (err: any) {
      setMessage(`Error loading settings: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('recording_settings')
        .insert({
          scope: 'ORG',
          recording_enabled: true,
          schedule_enabled: true,
          schedule_start_time: '09:00',
          schedule_end_time: '18:00',
          schedule_days: [true, true, true, true, true, false, false],
        })
        .select()
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (err: any) {
      setMessage(`Error creating settings: ${err.message}`);
    }
  };

  const addExcludedNumber = () => {
    if (newNumber.trim() && !excludedNumbers.includes(newNumber)) {
      setExcludedNumbers([...excludedNumbers, newNumber]);
      setNewNumber('');
    }
  };

  const removeExcludedNumber = (number: string) => {
    setExcludedNumbers(excludedNumbers.filter((n) => n !== number));
  };

  const toggleScheduleDay = (index: number) => {
    const updated = [...scheduleDays];
    updated[index] = !updated[index];
    setScheduleDays(updated);
  };

  const saveSettings = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      setMessage('');

      const { error } = await supabase
        .from('recording_settings')
        .update({
          recording_enabled: recordingEnabled,
          excluded_numbers: excludedNumbers,
          schedule_enabled: scheduleEnabled,
          schedule_start_time: scheduleStart,
          schedule_end_time: scheduleEnd,
          schedule_days: scheduleDays,
          updated_at: new Date().toISOString(),
        })
        .eq('setting_id', settings.setting_id);

      if (error) throw error;

      setMessage('✓ Settings saved successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(`✗ Error saving settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Call Recording Settings</h1>
        <p className="text-gray-600 mb-6">
          Configure how calls are automatically recorded across your organization
        </p>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.startsWith('✓')
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {message}
          </div>
        )}

        <div className="space-y-6">
          {/* Global Recording Toggle */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Recording Status</h2>
                <p className="text-sm text-gray-600">
                  Enable or disable all call recording org-wide
                </p>
              </div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={recordingEnabled}
                  onChange={(e) => setRecordingEnabled(e.target.checked)}
                  className="w-5 h-5"
                />
                <span className="ml-2 font-semibold">
                  {recordingEnabled ? '✓ Recording Enabled' : '○ Recording Disabled'}
                </span>
              </label>
            </div>
          </div>

          {/* Excluded Numbers */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Excluded Phone Numbers</h2>
            <p className="text-sm text-gray-600 mb-4">
              Calls from these numbers will NOT be recorded (e.g., internal, legal)
            </p>

            <div className="flex gap-2 mb-4">
              <input
                type="tel"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addExcludedNumber()}
                placeholder="+1-555-0100 or 5550100"
                className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={addExcludedNumber}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                + Add
              </button>
            </div>

            <div className="space-y-2">
              {excludedNumbers.length === 0 ? (
                <p className="text-gray-400 text-sm italic">
                  No numbers excluded. All calls will be recorded.
                </p>
              ) : (
                excludedNumbers.map((number) => (
                  <div
                    key={number}
                    className="flex items-center justify-between bg-gray-50 p-3 rounded border border-gray-200"
                  >
                    <span className="font-mono font-semibold">{number}</span>
                    <button
                      onClick={() => removeExcludedNumber(number)}
                      className="text-red-600 hover:text-red-700 font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recording Schedule */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Recording Schedule</h2>
                <p className="text-sm text-gray-600">
                  Automatically record only during business hours
                </p>
              </div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleEnabled}
                  onChange={(e) => setScheduleEnabled(e.target.checked)}
                  className="w-5 h-5"
                />
                <span className="ml-2 font-semibold">
                  {scheduleEnabled ? '✓ Enabled' : '○ Disabled'}
                </span>
              </label>
            </div>

            {scheduleEnabled && (
              <>
                {/* Time Range */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Start Time</label>
                    <input
                      type="time"
                      value={scheduleStart}
                      onChange={(e) => setScheduleStart(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">End Time</label>
                    <input
                      type="time"
                      value={scheduleEnd}
                      onChange={(e) => setScheduleEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Days Selection */}
                <div>
                  <label className="block text-sm font-semibold mb-3">Days of Week</label>
                  <div className="grid grid-cols-4 gap-2">
                    {dayNames.map((day, idx) => (
                      <label key={idx} className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={scheduleDays[idx]}
                          onChange={() => toggleScheduleDay(idx)}
                          className="w-4 h-4"
                        />
                        <span className="ml-2 text-sm font-medium">{day.substring(0, 3)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">How It Works</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>
                ✓ All calls are recorded automatically on reps' phones (no app configuration needed)
              </li>
              <li>✓ Excluded numbers and schedules are applied before recording</li>
              <li>✓ Recordings upload to CRM when sync occurs</li>
              <li>✓ Transcriptions via OpenAI Whisper API (~$0.01/min)</li>
              <li>✓ AI sentiment analysis runs locally (free)</li>
            </ul>
          </div>

          {/* Save Button */}
          <button
            onClick={saveSettings}
            disabled={saving}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? 'Saving...' : '💾 Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
