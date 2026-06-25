import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, Circle, Clock, AlertTriangle, Plus, X, Calendar,
  User, Flag, RefreshCw, ExternalLink, AlertCircle, Loader2
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  priority: 'critical' | 'high' | 'medium' | 'low';
  contact_id: string | null;
  assigned_to: string | null;
  created_at: string;
  contact_name?: string | null;
  assigned_name?: string | null;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-500 bg-red-500/10 border-red-500/30',
  high:     'text-red-400 bg-red-500/10',
  medium:   'text-amber-400 bg-amber-500/10',
  low:      'text-blue-400 bg-blue-500/10',
};

const Tasks: React.FC = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'overdue' | 'completed'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({ title: '', dueDate: '', priority: 'medium', description: '' });

  const isOverdue = (t: Task) =>
    !t.completed && !!t.due_date && new Date(t.due_date) < new Date();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/tasks');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load tasks');
      setTasks(json.tasks || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = tasks.filter(t => {
    if (filter === 'pending')   return !t.completed && !isOverdue(t);
    if (filter === 'completed') return t.completed;
    if (filter === 'overdue')   return isOverdue(t);
    return true;
  });

  const stats = {
    total:     tasks.length,
    pending:   tasks.filter(t => !t.completed && !isOverdue(t)).length,
    completed: tasks.filter(t => t.completed).length,
    overdue:   tasks.filter(t => isOverdue(t)).length,
  };

  const toggleComplete = async (task: Task) => {
    setToggling(task.id);
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, completed: !task.completed }),
      });
      const json = await res.json();
      if (json.success) {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));
      }
    } catch {}
    setToggling(null);
  };

  const handleAdd = async () => {
    if (!newTask.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTask.title.trim(),
          description: newTask.description.trim() || null,
          due_date: newTask.dueDate || null,
          priority: newTask.priority,
        }),
      });
      const json = await res.json();
      if (json.success && json.task) {
        setTasks(prev => [json.task, ...prev]);
        setNewTask({ title: '', dueDate: '', priority: 'medium', description: '' });
        setShowAdd(false);
      }
    } catch {}
    setSaving(false);
  };

  const formatDue = (dateStr: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const due = new Date(dateStr); due.setHours(0,0,0,0);
    if (due.getTime() === today.getTime()) return 'Today';
    if (due.getTime() === tomorrow.getTime()) return 'Tomorrow';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks & Follow-ups</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Scheduled follow-ups — created by automation or manually added
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-bold px-4 py-2 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Task
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total',     value: stats.total,     icon: CheckCircle2, color: 'text-blue-400',  bg: 'bg-blue-500/10',   key: 'all'       },
          { label: 'Pending',   value: stats.pending,   icon: Clock,        color: 'text-amber-400', bg: 'bg-amber-500/10',  key: 'pending'   },
          { label: 'Overdue',   value: stats.overdue,   icon: AlertTriangle,color: 'text-red-400',   bg: 'bg-red-500/10',    key: 'overdue'   },
          { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10',  key: 'completed' },
        ].map(s => (
          <button
            key={s.label}
            onClick={() => setFilter(s.key as any)}
            className={`bg-gray-900 border rounded-xl p-4 text-left transition-colors ${filter === s.key ? 'border-amber-500/50' : 'border-gray-800 hover:border-gray-700'}`}
          >
            <div className={`w-9 h-9 ${s.bg} rounded-lg flex items-center justify-center mb-2`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <p className="text-xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-gray-400">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'pending', 'overdue', 'completed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${filter === f ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Task list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{tasks.length === 0 ? 'No tasks yet' : 'No tasks in this filter'}</p>
          <p className="text-sm mt-1">
            {tasks.length === 0
              ? 'Tasks are created automatically by the pipeline engine each morning, or add one manually.'
              : 'Try a different filter above.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => {
            const overdue = isOverdue(task);
            const dueLabel = formatDue(task.due_date);
            return (
              <div
                key={task.id}
                className={`bg-gray-900 border rounded-xl p-4 flex items-start gap-3 transition-colors ${
                  task.completed   ? 'border-gray-800 opacity-50' :
                  overdue          ? 'border-red-500/30 bg-red-500/5' :
                  task.priority === 'critical' ? 'border-red-500/40' :
                  'border-gray-800'
                }`}
              >
                {/* Complete toggle */}
                <button
                  onClick={() => toggleComplete(task)}
                  disabled={toggling === task.id}
                  className="mt-0.5 flex-shrink-0 text-gray-500 hover:text-green-400 transition-colors disabled:opacity-40"
                >
                  {toggling === task.id
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : task.completed
                      ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                      : <Circle className="w-5 h-5" />
                  }
                </button>

                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm ${task.completed ? 'line-through text-gray-500' : 'text-white'}`}>
                    {task.title}
                  </p>

                  {task.description && (
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {task.priority && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
                        <Flag className="w-3 h-3 inline mr-1" />{task.priority}
                      </span>
                    )}

                    {dueLabel && (
                      <span className={`flex items-center gap-1 text-xs ${overdue ? 'text-red-400' : 'text-gray-500'}`}>
                        <Calendar className="w-3 h-3" />
                        {overdue ? '⚠ ' : ''}{dueLabel}
                      </span>
                    )}

                    {task.contact_name && (
                      <button
                        onClick={() => navigate(`/contacts/${task.contact_id}`)}
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {task.contact_name}
                      </button>
                    )}

                    {task.assigned_name && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <User className="w-3 h-3" />
                        {task.assigned_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Task modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">Add New Task</h3>
              <button onClick={() => setShowAdd(false)}>
                <X className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Task title *"
                value={newTask.title}
                onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
              />
              <textarea
                placeholder="Notes / description (optional)"
                value={newTask.description}
                onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 resize-none"
              />
              <input
                type="date"
                value={newTask.dueDate}
                onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500"
              />
              <select
                value={newTask.priority}
                onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="critical">Critical</option>
              </select>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowAdd(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={saving || !newTask.title.trim()}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Add Task'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
