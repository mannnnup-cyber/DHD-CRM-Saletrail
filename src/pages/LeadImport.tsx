import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Upload, Plus, Download, FileText, Check, Users, Phone, Mail, MapPin, Tag, MessageSquare, Trash2, ExternalLink } from 'lucide-react';

const CATEGORIES = [
  'Logo Design', 'Packaging', 'Signage', 'Vehicle Wrap', 'Apparel',
  'Business Cards', 'Flyers', 'Social Media', 'Full Branding', 'Merchandise', 'Banners', 'Other'
];

const REPS = [
  { id: 'rep1', name: 'Keisha Brown' },
  { id: 'rep2', name: 'Andre Williams' },
  { id: 'rep3', name: 'Marcia Thompson' },
  { id: 'rep4', name: 'Devon Campbell' },
  { id: 'rep5', name: 'Tanya Reid' },
];

const LeadImport: React.FC = () => {
  const { state, addLead, deleteLead } = useApp();
  const [activeTab, setActiveTab] = useState<'list' | 'upload' | 'manual'>('list');
  const [success, setSuccess] = useState('');
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const leads = state.leads || [];

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);

    const company = (formData.get('company') as string || '').trim();
    const name = (formData.get('name') as string || '').trim();
    const phone = (formData.get('phone') as string || '').trim();
    const email = (formData.get('email') as string || '').trim();
    const address = (formData.get('address') as string || '').trim();
    const category = (formData.get('category') as string || '').trim();
    const description = (formData.get('description') as string || '').trim();
    const assignedTo = (formData.get('assignedTo') as string || 'rep1');

    if (!company || !name || !phone) {
      alert('Company Name, Contact Name, and Phone are required.');
      return;
    }

    const assignedRep = REPS.find(r => r.id === assignedTo);

    addLead({
      name,
      company,
      phone,
      email,
      address,
      category,
      description,
      status: 'New',
      source: 'Manual',
      assignedTo,
      assignedToName: assignedRep?.name || 'Unassigned'
    } as any);

    form.reset();
    showSuccess(`✅ Lead "${company}" added successfully! Pipeline deal created.`);
    setActiveTab('list');
  };

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    setCsvHeaders(headers);

    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ''; });
      return obj;
    }).filter(row => Object.values(row).some(v => v !== ''));

    setCsvData(rows);
  };

  const handleFileChange = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => parseCSV(e.target?.result as string);
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  };

  const handleCSVImport = () => {
    if (!csvData.length) return;
    let imported = 0;
    csvData.forEach((row, i) => {
      const company = row['Company Name'] || row['company'] || row['Company'] || Object.values(row)[0] || `Lead ${i + 1}`;
      const name = row['Contact Name'] || row['name'] || row['Name'] || row['Contact'] || company;
      const phone = row['Phone Number'] || row['phone'] || row['Phone'] || row['Mobile'] || '';
      const email = row['Email'] || row['email'] || row['Email Address'] || '';
      const category = row['Nature Category'] || row['category'] || row['Category'] || 'Other';
      const address = row['Street Address'] || row['address'] || row['Address'] || '';
      const description = row['Description'] || row['description'] || row['Notes'] || '';

      if (company || name) {
        const repIndex = i % REPS.length;
        addLead({
          name: name || company,
          company: company || name,
          phone,
          email,
          address,
          category,
          description,
          status: 'New',
          source: 'CSV Import',
          assignedTo: REPS[repIndex].id,
          assignedToName: REPS[repIndex].name
        } as any);
        imported++;
      }
    });
    setCsvData([]);
    setCsvHeaders([]);
    showSuccess(`✅ ${imported} leads imported successfully! Pipeline deals created.`);
    setActiveTab('list');
  };

  const handleDelete = (id: string, company: string) => {
    if (window.confirm(`Delete lead "${company}"? This will also remove the related pipeline deal.`)) {
      deleteLead(id);
      showSuccess(`Lead "${company}" deleted.`);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Import Center</h1>
          <p className="text-gray-400 text-sm mt-1">Add and manage your sales prospects</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Users className="w-4 h-4" />
          <span>{leads.length} leads total</span>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 font-medium">
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-900 rounded-xl w-fit border border-gray-800">
        {[
          { id: 'list', label: `All Leads (${leads.length})` },
          { id: 'upload', label: 'CSV Upload' },
          { id: 'manual', label: 'Manual Entry' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* LEADS LIST */}
      {activeTab === 'list' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {leads.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg font-medium">No leads yet</p>
              <p className="text-gray-500 text-sm mt-1">Add leads via CSV upload or manual entry</p>
              <button
                onClick={() => setActiveTab('manual')}
                className="mt-4 px-4 py-2 bg-amber-500 text-black rounded-lg text-sm font-bold hover:bg-amber-400 transition-colors"
              >
                Add First Lead
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/50">
                  <tr>
                    {['Company', 'Contact', 'Phone', 'Category', 'Status', 'Assigned To', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {leads.map(lead => (
                    <tr key={lead.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-white font-medium text-sm">{lead.company}</p>
                        {lead.email && <p className="text-gray-500 text-xs">{lead.email}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">{lead.name}</td>
                      <td className="px-4 py-3">
                        <a
                          href={`https://wa.me/${lead.phone?.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-green-400 text-sm hover:text-green-300"
                        >
                          <Phone className="w-3 h-3" />
                          {lead.phone}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium">
                          {lead.category || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          lead.status === 'New' ? 'bg-blue-500/20 text-blue-400' :
                          lead.status === 'Contacted' ? 'bg-yellow-500/20 text-yellow-400' :
                          lead.status === 'Qualified' ? 'bg-green-500/20 text-green-400' :
                          lead.status === 'Converted' ? 'bg-purple-500/20 text-purple-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">{(lead as any).assignedToName || 'Unassigned'}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(lead.id, lead.company)}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CSV UPLOAD */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center text-center cursor-pointer transition-all ${
              dragging ? 'border-amber-500 bg-amber-500/5' : 'border-gray-700 hover:border-amber-500/50 bg-gray-900'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
            />
            <Upload className="w-10 h-10 text-gray-500 mb-3" />
            <h3 className="text-white font-bold mb-1">Drop your CSV file here</h3>
            <p className="text-gray-400 text-sm">or click to browse</p>
            <p className="text-gray-600 text-xs mt-2">Expected columns: Company Name, Contact Name, Phone Number, Email, Nature Category, Street Address, Description</p>
          </div>

          {/* Preview */}
          {csvData.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <div>
                  <h3 className="text-white font-semibold">Preview — {csvData.length} rows detected</h3>
                  <p className="text-gray-400 text-sm">Headers: {csvHeaders.join(', ')}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setCsvData([]); setCsvHeaders([]); }}
                    className="px-3 py-2 text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleCSVImport}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-sm transition-colors flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Import {csvData.length} Leads
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800">
                    <tr>
                      {csvHeaders.map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs text-gray-400 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {csvData.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-800/30">
                        {csvHeaders.map(h => (
                          <td key={h} className="px-3 py-2 text-gray-300 truncate max-w-32">{row[h] || '—'}</td>
                        ))}
                      </tr>
                    ))}
                    {csvData.length > 5 && (
                      <tr>
                        <td colSpan={csvHeaders.length} className="px-3 py-2 text-gray-500 text-center text-xs">
                          ... and {csvData.length - 5} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Download Template */}
          <button
            onClick={() => {
              const csv = 'Company Name,Contact Name,Phone Number,Email,Nature Category,Street Address,Description\nExample Company,John Brown,18765551234,john@example.com,Logo Design,123 Main Street Kingston,New client interested in logo redesign';
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'dhd-lead-template.csv';
              a.click();
            }}
            className="flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Download CSV Template
          </button>
        </div>
      )}

      {/* MANUAL ENTRY */}
      {activeTab === 'manual' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-2xl">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Plus className="w-5 h-5 text-amber-500" />
            Add New Lead Manually
          </h2>
          <form onSubmit={handleManualSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <FileText className="w-3.5 h-3.5 inline mr-1" />
                  Company Name <span className="text-red-400">*</span>
                </label>
                <input
                  name="company"
                  type="text"
                  required
                  placeholder="e.g. Kingston Media Group"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <Users className="w-3.5 h-3.5 inline mr-1" />
                  Contact Name <span className="text-red-400">*</span>
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Marcus Brown"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <Phone className="w-3.5 h-3.5 inline mr-1" />
                  Phone Number <span className="text-red-400">*</span>
                </label>
                <input
                  name="phone"
                  type="tel"
                  required
                  placeholder="+1-876-XXX-XXXX"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <Mail className="w-3.5 h-3.5 inline mr-1" />
                  Email Address
                </label>
                <input
                  name="email"
                  type="email"
                  placeholder="contact@company.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <MapPin className="w-3.5 h-3.5 inline mr-1" />
                  Street Address
                </label>
                <input
                  name="address"
                  type="text"
                  placeholder="123 Hope Road, Kingston"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <Tag className="w-3.5 h-3.5 inline mr-1" />
                  Nature Category
                </label>
                <select
                  name="category"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all appearance-none"
                >
                  {CATEGORIES.map(cat => <option key={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <Users className="w-3.5 h-3.5 inline mr-1" />
                  Assign To
                </label>
                <select
                  name="assignedTo"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all appearance-none"
                >
                  {REPS.map(rep => <option key={rep.id} value={rep.id}>{rep.name}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <MessageSquare className="w-3.5 h-3.5 inline mr-1" />
                  Description / Notes
                </label>
                <textarea
                  name="description"
                  rows={4}
                  placeholder="Project details, budget range, timeline, special requirements..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all resize-none"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-4 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 text-base"
            >
              <Plus className="w-5 h-5" />
              Add Lead to Pipeline
            </button>
            <p className="text-gray-500 text-xs text-center">
              ✓ A pipeline deal will be automatically created in the "New Lead" stage
            </p>
          </form>
        </div>
      )}
    </div>
  );
};

export default LeadImport;
