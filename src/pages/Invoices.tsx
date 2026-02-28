import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Calculator, Receipt, Download, Search, FileText, Printer } from 'lucide-react';

const Invoices: React.FC = () => {
  const { state } = useApp();
  const [amount, setAmount] = useState<string>('');
  const GCT_RATE = 0.15;

  const calculateGCT = (val: number) => {
    const total = val;
    const preTax = total / (1 + GCT_RATE);
    const gct = total - preTax;
    return { preTax, gct, total };
  };

  const result = calculateGCT(parseFloat(amount) || 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-white">Invoices & GCT</h1>
        <p className="text-gray-400">Manage billing and Jamaica tax compliance</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
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
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter total amount"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-8 pr-4 text-white font-bold outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-gray-800">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Pre-Tax Amount:</span>
                  <span className="text-white font-medium">${result.preTax.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">GCT (15%):</span>
                  <span className="text-amber-500 font-medium">${result.gct.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gray-800">
                  <span className="font-bold text-white">Total:</span>
                  <span className="font-bold text-white text-lg">${result.total.toLocaleString()}</span>
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

        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-gray-800 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <h3 className="text-lg font-bold text-white">Recent Invoices</h3>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                type="text" 
                placeholder="Search invoices..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-9 pr-4 text-sm text-white outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-800/50 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Invoice #</th>
                  <th className="px-6 py-4 font-semibold">Client</th>
                  <th className="px-6 py-4 font-semibold">Pre-Tax</th>
                  <th className="px-6 py-4 font-semibold">GCT</th>
                  <th className="px-6 py-4 font-semibold">Total</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {[
                  { id: 'INV-2024-001', client: 'Blue Mountain Coffee', total: 92000 },
                  { id: 'INV-2024-002', client: 'Kingston Media Group', total: 45000 },
                  { id: 'INV-2024-003', client: 'Jamaica Tourism Board', total: 125000 },
                ].map((inv) => {
                  const calc = calculateGCT(inv.total);
                  return (
                    <tr key={inv.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-amber-500">{inv.id}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-200 font-medium">{inv.client}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-400">${calc.preTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="px-6 py-4 text-gray-400">${calc.gct.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="px-6 py-4 text-white font-bold">${inv.total.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"><Printer className="w-4 h-4" /></button>
                        <button className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"><Download className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Invoices;
