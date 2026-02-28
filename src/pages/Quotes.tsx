import React, { useState } from 'react';
import { FilePenLine, Plus, X, Trash2, DollarSign, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

const GCT_RATE = 0.15;

const Quotes: React.FC = () => {
  const { state, addQuote } = useApp();
  const quotes = state.quotes || [];
  const deals = state.deals || [];
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState('');
  const [items, setItems] = useState([{ id: '1', description: '', quantity: 1, price: 0 }]);

  const total = items.reduce((s, i) => s + i.quantity * i.price, 0);
  const gct = total * GCT_RATE;
  const grandTotal = total + gct;

  const addItem = () => setItems([...items, { id: Date.now().toString(), description: '', quantity: 1, price: 0 }]);
  const removeItem = (id: string) => setItems(items.filter(i => i.id !== id));
  const updateItem = (id: string, field: string, value: any) => setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));

  const handleCreate = () => {
    if (!selectedDeal || items.every(i => !i.description)) return;
    addQuote({ dealId: selectedDeal, items, total, gct, grandTotal, repId: state.user?.id || '' });
    setShowAdd(false);
    setItems([{ id: '1', description: '', quantity: 1, price: 0 }]);
    setSelectedDeal('');
  };

  const statusIcon = (s: string) => {
    if (s === 'Approved') return <CheckCircle className="w-4 h-4 text-green-400" />;
    if (s === 'Declined') return <XCircle className="w-4 h-4 text-red-400" />;
    return <Clock className="w-4 h-4 text-amber-400" />;
  };

  const statusColor = (s: string) => {
    if (s === 'Approved') return 'bg-green-500/10 text-green-400';
    if (s === 'Declined') return 'bg-red-500/10 text-red-400';
    if (s === 'Sent') return 'bg-blue-500/10 text-blue-400';
    return 'bg-amber-500/10 text-amber-400';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Quote Generator</h1>
          <p className="text-gray-400 text-sm mt-1">Create and manage project quotes with 15% GCT</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-bold px-4 py-2 rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> New Quote
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Quotes', value: quotes.length, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Pending', value: quotes.filter(q => q.status === 'Sent' || q.status === 'Draft').length, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Approved', value: quotes.filter(q => q.status === 'Approved').length, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'Total Value', value: `$${(quotes.reduce((s, q) => s + q.grandTotal, 0) / 1000).toFixed(0)}K`, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>
              <DollarSign className={`w-5 h-5 ${s.color}`} />
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-sm text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quotes List */}
      <div className="space-y-4">
        {quotes.length === 0 ? (
          <div className="text-center py-16 text-gray-500 bg-gray-900 border border-gray-800 rounded-2xl">
            <FilePenLine className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No quotes yet. Create your first quote!</p>
          </div>
        ) : quotes.map((q) => {
          const deal = deals.find(d => d.id === q.dealId);
          return (
            <div key={q.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-semibold text-white">Quote #{q.id.slice(-6).toUpperCase()}</p>
                  <p className="text-sm text-gray-400">{deal?.name || 'Unknown Project'} • {new Date(q.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {statusIcon(q.status)}
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(q.status)}`}>{q.status}</span>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                {q.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{item.description} × {item.quantity}</span>
                    <span className="text-white font-medium">JMD {(item.quantity * item.price).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-800 pt-3 space-y-1">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Subtotal</span><span>JMD {q.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-amber-400">
                  <span>GCT (15%)</span><span>JMD {q.gct.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-white">
                  <span>Total</span><span>JMD {q.grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Quote Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Create New Quote</h3>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <select value={selectedDeal} onChange={e => setSelectedDeal(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500">
                <option value="">Select a Deal / Project</option>
                {deals.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>

              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-300">Line Items</p>
                {items.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                    <input type="text" placeholder="Description" value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} className="col-span-6 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500" />
                    <input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))} className="col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" />
                    <input type="number" placeholder="Price (JMD)" value={item.price} onChange={e => updateItem(item.id, 'price', Number(e.target.value))} className="col-span-3 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" />
                    <button onClick={() => removeItem(item.id)} className="col-span-1 flex items-center justify-center text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button onClick={addItem} className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300">
                  <Plus className="w-4 h-4" /> Add Line Item
                </button>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-400"><span>Subtotal</span><span>JMD {total.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm text-amber-400"><span>GCT (15%)</span><span>JMD {gct.toLocaleString()}</span></div>
                <div className="flex justify-between font-bold text-white"><span>Grand Total</span><span>JMD {grandTotal.toLocaleString()}</span></div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowAdd(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 rounded-xl transition-colors">Cancel</button>
                <button onClick={handleCreate} className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold py-3 rounded-xl transition-colors">Create Quote</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quotes;
