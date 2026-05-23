import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Calculator, FileText, CheckCircle, XCircle, Clock, Search } from 'lucide-react';

const Invoices: React.FC = () => {
  const { state, updateInvoice } = useApp();
  const invoices = state.invoices || [];
  const deals = state.deals || [];
  const [search, setSearch] = useState('');
  const [calcAmount, setCalcAmount] = useState('');

  const GCT_RATE = 0.15;
  const calcResult = (() => {
    const val = parseFloat(calcAmount) || 0;
    const preTax = val / (1 + GCT_RATE);
    return { preTax, gct: val - preTax, total: val };
  })();

  const filtered = invoices.filter(inv => {
    const deal = deals.find(d => d.id === inv.dealId);
    return !search || deal?.name.toLowerCase().includes(search.toLowerCase()) || inv.id.includes(search);
  });

  const totalRevenue = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.grandTotal, 0);
  const outstanding = invoices.filter(i => i.status === 'Unpaid').reduce((s, i) => s + i.grandTotal, 0);

  const statusIcon = (s: string) => {
    if (s === 'Paid') return <CheckCircle className="w-4 h-4 text-green-400" />;
    if (s === 'Cancelled') return <XCircle className="w-4 h-4 text-red-400" />;
    return <Clock className="w-4 h-4 text-amber-400" />;
  };

  const statusColor = (s: string) => {
    if (s === 'Paid') return 'bg-green-500/10 text-green-400';
    if (s === 'Cancelled') return 'bg-red-500/10 text-red-400';
    return 'bg-amber-500/10 text-amber-400';
  };

  const markPaid = (invoiceId: string) => {
    updateInvoice(invoiceId, { status: 'Paid', paidAt: new Date().toISOString() });
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-white">Invoices & GCT</h1>
        <p className="text-gray-400">Manage billing and Jamaica tax compliance</p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Invoices', value: invoices.length, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Unpaid', value: invoices.filter(i => i.status === 'Unpaid').length, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Paid Revenue', value: `$${(totalRevenue / 1000).toFixed(0)}K`, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'Outstanding', value: `$${(outstanding / 1000).toFixed(0)}K`, color: 'text-red-400', bg: 'bg-red-500/10' },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>
              <FileText className={`w-5 h-5 ${s.color}`} />
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-sm text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* GCT Calculator */}
        <div className="lg:col-span-1">
          <div className="bg-gray-900 border border-amber-500/20 rounded-2xl p-6 shadow-xl shadow-amber-500/5">
            <h3 className="font-bold text-white mb-6 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-amber-500" />
              15% GCT Calculator
            </h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Total Amount (JMD)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                  <input
                    type="number"
                    value={calcAmount}
                    onChange={e => setCalcAmount(e.target.value)}
                    placeholder="Enter total amount"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-8 pr-4 text-white font-bold outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>
              <div className="space-y-3 pt-4 border-t border-gray-800">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Pre-Tax Amount:</span>
                  <span className="text-white font-medium">${calcResult.preTax.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">GCT (15%):</span>
                  <span className="text-amber-500 font-medium">${calcResult.gct.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between pt-3 border-t border-gray-800">
                  <span className="font-bold text-white">Total:</span>
                  <span className="font-bold text-white text-lg">${calcResult.total.toLocaleString()}</span>
                </div>
              </div>
              <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/10">
                <p className="text-xs text-blue-400 leading-relaxed">
                  <strong>Compliance Note:</strong> Under Jamaica tax law, GCT is calculated as <code>Total / 1.15</code> to find the pre-tax base.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice List */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-gray-800 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <h3 className="text-lg font-bold text-white">Invoices</h3>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-9 pr-4 text-sm text-white outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              {invoices.length === 0
                ? <p>No invoices yet. Approve a quote to generate one.</p>
                : <p>No invoices match your search.</p>
              }
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {filtered.map(inv => {
                const deal = deals.find(d => d.id === inv.dealId);
                const isOverdue = inv.status === 'Unpaid' && new Date(inv.dueDate) < new Date();
                return (
                  <div key={inv.id} className="p-5 hover:bg-gray-800/30 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-mono text-xs text-amber-500 mb-1">INV-{inv.id.slice(-6).toUpperCase()}</p>
                        <p className="font-semibold text-white">{deal?.name || 'Unknown Project'}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Created {new Date(inv.createdAt).toLocaleDateString()} •
                          Due {new Date(inv.dueDate).toLocaleDateString()}
                          {isOverdue && <span className="text-red-400 ml-1">· OVERDUE</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusIcon(inv.status)}
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(inv.status)}`}>{inv.status}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1 text-sm">
                        <div className="flex gap-4 text-gray-400">
                          <span>Subtotal: JMD {inv.total.toLocaleString()}</span>
                          <span>GCT: JMD {inv.gct.toLocaleString()}</span>
                        </div>
                        <p className="font-bold text-white">Total: JMD {inv.grandTotal.toLocaleString()}</p>
                      </div>
                      {inv.status === 'Unpaid' && (
                        <button
                          onClick={() => markPaid(inv.id)}
                          className="flex items-center gap-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                        >
                          <CheckCircle className="w-3 h-3" /> Mark Paid
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Invoices;
