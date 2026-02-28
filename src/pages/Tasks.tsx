import React, { useState } from 'react';
import { CheckCircle2, Clock, AlertTriangle, Plus, X, Calendar, User, Flag } from 'lucide-react';
import { useApp } from '../context/AppContext';

const Tasks: React.FC = () => {
  const { state } = useApp();
  const [filter, setFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', dueDate: '', priority: 'medium', assignedTo: '' });

  const tasks = state.tasks || [];
  const isOverdue = (t: any) => !t.completed && new Date(t.dueDate) < new Date();

  const filtered = tasks.filter(t => {
    if (filter === 'pending') return !t.completed && !isOverdue(t);
    if (filter === 'completed') return t.completed;
    if (filter === 'overdue') return isOverdue(t);
    return true;
  });

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => !t.completed && !isOverdue(t)).length,
    completed: tasks.filter(t => t.completed).length,
    overdue: tasks.filter(t => isOverdue(t)).length,
  };

  const priorityColor = (p: string) => {
    if (p === 'high') return 'text-red-400 bg-red-500/10';
    if (p === 'medium') return 'text-amber-400 bg-amber-500/10';
    return 'text-blue-400 bg-blue-500/10';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks & Follow-ups</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your daily follow-up tasks</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-bold px-4 py-2 rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Add Task
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: CheckCircle2, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
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

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'pending', 'overdue', 'completed'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${filter === f ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No tasks found</p>
          </div>
        ) : filtered.map((task: any) => (
          <div key={task.id} className={`bg-gray-900 border rounded-xl p-4 flex items-start gap-4 ${isOverdue(task) ? 'border-red-500/30' : task.completed ? 'border-green-500/20 opacity-60' : 'border-gray-800'}`}>
            <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 ${task.completed ? 'bg-green-500 border-green-500' : isOverdue(task) ? 'border-red-400' : 'border-gray-600'}`} />
            <div className="flex-1 min-w-0">
              <p className={`font-medium ${task.completed ? 'line-through text-gray-500' : 'text-white'}`}>{task.title || task.description}</p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Calendar className="w-3 h-3" /> {task.dueDate}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <User className="w-3 h-3" /> {task.assignedTo}
                </span>
                {task.priority && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${priorityColor(task.priority)}`}>
                    <Flag className="w-3 h-3 inline mr-1" />{task.priority}
                  </span>
                )}
                                {isOverdue(task) && (
                    <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-medium">⚠️ Overdue</span>
                  )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Task Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Add New Task</h3>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <input type="text" placeholder="Task title" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500" />
              <input type="date" value={newTask.dueDate} onChange={e => setNewTask({...newTask, dueDate: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500" />
              <select value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500">
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
              <div className="flex gap-3">
                <button onClick={() => setShowAdd(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 rounded-xl transition-colors">Cancel</button>
                <button onClick={() => setShowAdd(false)} className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold py-3 rounded-xl transition-colors">Add Task</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
