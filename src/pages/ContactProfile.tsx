import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, Building2, ShoppingCart, MessageCircle,
  PhoneCall, FileText, RefreshCw, AlertCircle, Clock, TrendingUp,
  DollarSign, Package, User, ExternalLink, ChevronDown, ChevronUp, Globe, X
} from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  website_url: string | null;
  source: string;
  status: string;
  notes: string | null;
  tags: string[] | null;
  total_orders: number;
  total_revenue: number;
  average_order_value: number;
  first_order_date: string | null;
  last_order_date: string | null;
  created_at: string;
}

interface Interaction {
  id: string;
  type: 'WHATSAPP' | 'CALL' | 'EMAIL' | 'NOTE' | 'SMS' | 'MEETING';
  direction: 'INBOUND' | 'OUTBOUND';
  subject: string | null;
  content: string | null;
  metadata: Record<string, any> | null;
  timestamp: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  EMAIL:    { icon: Mail,           color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',   label: 'Email' },
  WHATSAPP: { icon: MessageCircle,  color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20', label: 'WhatsApp' },
  CALL:     { icon: PhoneCall,      color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20', label: 'Call' },
  NOTE:     { icon: FileText,       color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', label: 'Note' },
  SMS:      { icon: MessageCircle,  color: 'text-cyan-400',   bg: 'bg-cyan-500/10 border-cyan-500/20',   label: 'SMS' },
  MEETING:  { icon: User,           color: 'text-rose-400',   bg: 'bg-rose-500/10 border-rose-500/20',   label: 'Meeting' },
};

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-gray-600/30 text-gray-400',
  CONTACTED: 'bg-blue-500/20 text-blue-300',
  QUALIFYING: 'bg-amber-500/20 text-amber-300',
  VERIFIED_CUSTOMER: 'bg-green-500/20 text-green-300',
  CONVERTED: 'bg-emerald-500/20 text-emerald-300',
  LOST: 'bg-red-500/20 text-red-400',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

const ContactProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAllInteractions, setShowAllInteractions] = useState(false);
  const [showEnrichModal, setShowEnrichModal] = useState(false);
  const [enrichUrl, setEnrichUrl] = useState('');
  const [enrichAutoDetect, setEnrichAutoDetect] = useState(false);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichError, setEnrichError] = useState('');
  const [enrichSuccess, setEnrichSuccess] = useState('');
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateCandidates, setDuplicateCandidates] = useState<any[]>([]);
  const [selectedDuplicateId, setSelectedDuplicateId] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [orgSearch, setOrgSearch] = useState('');
  const [orgSearchResults, setOrgSearchResults] = useState<any[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null);
  const [orgRole, setOrgRole] = useState('');
  const [orgStartDate, setOrgStartDate] = useState('');
  const [orgEndDate, setOrgEndDate] = useState('');
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState('');

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`/api/contacts?id=${id}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setContact(json.contact);
      setInteractions(json.interactions || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEnrichLead = async () => {
    // Validate input
    if (!id) return;
    if (!enrichAutoDetect && !enrichUrl.trim()) return;

    setEnrichLoading(true);
    setEnrichError('');
    setEnrichSuccess('');

    try {
      // First, check for duplicates before enriching
      if (contact?.email || contact?.phone) {
        const checkResponse = await fetch(
          `/api/duplicates?action=checkBeforeEnrich&email=${encodeURIComponent(contact.email || '')}&phone=${encodeURIComponent(contact.phone || '')}`
        );

        if (checkResponse.ok) {
          const checkResult = await checkResponse.json();

          if (checkResult.hasConflicts && checkResult.conflicts.length > 0) {
            // Show duplicate warning and let user decide
            setDuplicateCandidates(checkResult.conflicts);
            setShowDuplicateWarning(true);
            setEnrichLoading(false);
            return;
          }
        }
      }

      // No conflicts, proceed with enrichment
      await performEnrichment();
    } catch (e: any) {
      setEnrichError(e.message || 'Network error');
      setEnrichLoading(false);
    }
  };

  const performEnrichment = async () => {
    if (!id) return;

    try {
      const requestBody: any = { contactId: id };

      if (enrichAutoDetect) {
        // Use company name to auto-detect domain
        requestBody.useCompanyName = true;
      } else {
        // Use manually entered URL
        requestBody.companyUrl = enrichUrl.trim();
      }

      const response = await fetch('/api/scrape?action=enrichLead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();

      if (!response.ok) {
        // Even on error, show what was extracted
        if (result.extracted) {
          const extracted = result.extracted;
          const items = [];
          if (extracted.name) items.push(`name`);
          if (extracted.email) items.push(`email`);
          if (extracted.phone) items.push(`phone`);
          if (extracted.description) items.push(`description`);

          setEnrichError(`${result.error || 'Failed to save'}\n\nBut found: ${items.join(', ')}`);
        } else {
          setEnrichError(result.error || `HTTP ${response.status}`);
        }
        return;
      }

      // Update local contact data
      if (result.contact) {
        setContact(result.contact);
      }

      // Show success message with enrichment details
      const extracted = result.extracted;
      const items = [];
      if (extracted.name) items.push(`name`);
      if (extracted.email) items.push(`email`);
      if (extracted.phone) items.push(`phone`);
      if (extracted.description) items.push(`description`);

      let successMsg = `✓ Enriched: ${items.join(', ')}`;

      // Add confidence score if available
      if (result.enrichmentMetadata?.confidence) {
        const confidencePercent = Math.round(result.enrichmentMetadata.confidence * 100);
        successMsg += ` (${confidencePercent}% confidence)`;
      }

      // Add auto-detected domain indicator if applicable
      if (result.enrichmentMetadata?.autoDetected) {
        successMsg += ` from ${result.enrichmentMetadata.url}`;
      }

      setEnrichSuccess(successMsg);
      setEnrichUrl('');
      setEnrichAutoDetect(false);

      // Close modal after 2 seconds
      setTimeout(() => {
        setShowEnrichModal(false);
        setEnrichSuccess('');
      }, 2000);

    } catch (e: any) {
      setEnrichError(e.message || 'Network error');
    } finally {
      setEnrichLoading(false);
    }
  };

  const handleMergeDuplicate = async () => {
    if (!selectedDuplicateId || !id) return;

    setMerging(true);
    setEnrichError('');

    try {
      const mergeResponse = await fetch('/api/duplicates?action=mergeContacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryContactId: id,
          duplicateContactId: selectedDuplicateId,
          strategy: 'merge_enriched'
        })
      });

      const mergeResult = await mergeResponse.json();

      if (!mergeResponse.ok) {
        setEnrichError(`Failed to merge: ${mergeResult.error}`);
        setMerging(false);
        return;
      }

      // Merge successful, now proceed with enrichment
      setShowDuplicateWarning(false);
      setSelectedDuplicateId(null);
      setDuplicateCandidates([]);

      // Reload contact and proceed with enrichment
      await load();
      setTimeout(() => performEnrichment(), 500);
    } catch (e: any) {
      setEnrichError(e.message || 'Merge failed');
      setMerging(false);
    }
  };

  const loadOrganizations = async () => {
    if (!id) return;

    try {
      const r = await fetch(`/api/organizations?action=getOrganizations&contactId=${id}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setOrganizations(json.organizations || []);
    } catch (e: any) {
      console.error('Failed to load organizations:', e);
    }
  };

  const handleSearchOrganizations = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setOrgSearchResults([]);
      return;
    }

    try {
      // Search for organizations by name
      const r = await fetch(`/api/contacts?search=${encodeURIComponent(searchTerm)}&limit=10`);
      if (r.ok) {
        const json = await r.json();
        // Filter for organization-type contacts only
        const orgs = (json.contacts || []).filter((c: any) => c.contact_type === 'organization');
        setOrgSearchResults(orgs.length > 0 ? orgs : json.contacts || []);
      }
    } catch (e: any) {
      console.error('Search failed:', e);
    }
  };

  const handleLinkOrganization = async () => {
    if (!id || !selectedOrg) return;

    setOrgLoading(true);
    setOrgError('');

    try {
      const r = await fetch('/api/organizations?action=linkContact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: id,
          organizationId: selectedOrg.id,
          role: orgRole || undefined,
          startedAt: orgStartDate || undefined,
          endedAt: orgEndDate || undefined,
          isPrimary: organizations.length === 0 // First link is primary
        })
      });

      const result = await r.json();

      if (!r.ok) {
        setOrgError(result.error || 'Failed to link organization');
        setOrgLoading(false);
        return;
      }

      // Success - reload organizations and close modal
      await loadOrganizations();
      setShowOrgModal(false);
      setOrgSearch('');
      setOrgSearchResults([]);
      setSelectedOrg(null);
      setOrgRole('');
      setOrgStartDate('');
      setOrgEndDate('');
    } catch (e: any) {
      setOrgError(e.message || 'Network error');
    } finally {
      setOrgLoading(false);
    }
  };

  const handleUnlinkOrganization = async (linkId: string) => {
    if (!confirm('Remove this organizational link?')) return;

    try {
      const r = await fetch('/api/organizations?action=unlinkContact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId })
      });

      if (!r.ok) {
        const json = await r.json();
        console.error('Unlink failed:', json.error);
        return;
      }

      // Success - reload organizations
      await loadOrganizations();
    } catch (e: any) {
      console.error('Unlink error:', e);
    }
  };

  useEffect(() => {
    loadOrganizations();
  }, [id]);

  useEffect(() => { load(); }, [id]);

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-4">
        <div className="h-8 w-40 bg-gray-800 rounded-xl animate-pulse" />
        <div className="h-40 bg-gray-900 border border-gray-800 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="p-4 lg:p-6">
        <button onClick={() => navigate('/contacts')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Contacts
        </button>
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error || 'Contact not found'}
        </div>
      </div>
    );
  }

  const statusColor = STATUS_COLORS[contact.status] || STATUS_COLORS.NEW;
  const visibleInteractions = showAllInteractions ? interactions : interactions.slice(0, 10);

  const initials = contact.name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">

      {/* Back + Refresh */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/contacts')}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Contacts
        </button>
        <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg text-xs transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Contact Header Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400/30 to-orange-500/30 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-amber-400 font-bold text-xl">{initials}</span>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold text-white">{contact.name}</h1>
                {contact.company && (
                  <div className="flex items-center gap-1.5 text-gray-400 text-sm mt-0.5">
                    <Building2 className="w-3.5 h-3.5" />
                    {contact.company}
                  </div>
                )}
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium pointer-events-none ${statusColor}`} title={`Status: ${contact.status.replace('_', ' ')}`}>
                {contact.status.replace('_', ' ')}
              </span>
            </div>

            {/* Contact info row */}
            <div className="flex flex-wrap gap-4 mt-4">
              {contact.email && (
                <button
                  onClick={() => {
                    const emailSection = document.getElementById('email-section');
                    if (emailSection) {
                      emailSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-blue-400 cursor-pointer transition-colors"
                  title={`View emails from ${contact.email}`}
                >
                  <Mail className="w-4 h-4 text-gray-500" />
                  {contact.email}
                  <ExternalLink className="w-3 h-3 text-gray-600" />
                </button>
              )}
              {contact.phone && (
                <a
                  href={`tel:${contact.phone}`}
                  className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-amber-400 cursor-pointer transition-colors"
                >
                  <Phone className="w-4 h-4 text-gray-500" />
                  {contact.phone}
                </a>
              )}
              {contact.website_url && (
                <a
                  href={contact.website_url.startsWith('http') ? contact.website_url : `https://${contact.website_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-emerald-400 cursor-pointer transition-colors"
                  title={`Visit ${contact.website_url}`}
                >
                  <Globe className="w-4 h-4 text-gray-500" />
                  {contact.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  <ExternalLink className="w-3 h-3 text-gray-600" />
                </a>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mt-4">
              {contact.email && (
                <>
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Send Email
                  </a>
                  <button
                    onClick={() => {
                      const emailSection = document.getElementById('email-section');
                      if (emailSection) {
                        emailSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    title="View email history for this contact"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    View Emails
                  </button>
                </>
              )}
              {contact.phone && (
                <a
                  href={`tel:${contact.phone}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  Call
                </a>
              )}
              <button
                onClick={() => navigate('/leads')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-300 rounded-lg text-xs font-medium transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                Create Lead
              </button>
              <button
                onClick={() => setShowEnrichModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-300 rounded-lg text-xs font-medium transition-colors"
              >
                <Globe className="w-3.5 h-3.5" />
                Enrich
              </button>
            </div>
          </div>
        </div>

        {/* Notes */}
        {contact.notes && (
          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-500 mb-1">Notes</p>
            <p className="text-sm text-gray-300">{contact.notes}</p>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-500">Total Orders</span>
          </div>
          <p className="text-2xl font-bold text-white">{contact.total_orders || 0}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-gray-500">Total Revenue</span>
          </div>
          <p className="text-xl font-bold text-white">
            {(contact.total_revenue || 0) > 0
              ? `JMD ${contact.total_revenue.toLocaleString()}`
              : '—'}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-500">Avg Order Value</span>
          </div>
          <p className="text-xl font-bold text-white">
            {(contact.average_order_value || 0) > 0
              ? `JMD ${Math.round(contact.average_order_value).toLocaleString()}`
              : '—'}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-500">Interactions</span>
          </div>
          <p className="text-2xl font-bold text-white">{interactions.length}</p>
        </div>
      </div>

      {/* Organization Links */}
      {organizations.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-400" />
              <h2 className="font-semibold text-white">Organizations</h2>
            </div>
            <button
              onClick={() => setShowOrgModal(true)}
              className="text-xs px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              + Add
            </button>
          </div>

          <div className="space-y-2">
            {organizations.map(org => (
              <div
                key={org.linkId}
                className={`p-3 rounded-lg border ${
                  org.isCurrent
                    ? 'border-purple-500/30 bg-purple-500/10'
                    : 'border-gray-700 bg-gray-800/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white">{org.name}</p>
                    {org.role && <p className="text-sm text-purple-300">Role: {org.role}</p>}
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                      {org.startedAt && (
                        <span>
                          From {new Date(org.startedAt).toLocaleDateString('en', { year: '2-digit', month: 'short' })}
                        </span>
                      )}
                      {org.endedAt && (
                        <span>
                          to {new Date(org.endedAt).toLocaleDateString('en', { year: '2-digit', month: 'short' })}
                        </span>
                      )}
                      {!org.endedAt && <span className="text-purple-400">Ongoing</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnlinkOrganization(org.linkId)}
                    className="text-gray-400 hover:text-red-400 transition-colors text-xs px-2 py-1 hover:bg-red-500/10 rounded"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Organization Button (if no organizations yet) */}
      {organizations.length === 0 && (
        <button
          onClick={() => setShowOrgModal(true)}
          className="w-full flex items-center justify-center gap-2 p-4 border border-dashed border-purple-500/50 rounded-lg text-purple-400 hover:bg-purple-500/5 transition-colors"
        >
          <Building2 className="w-5 h-5" />
          <span>Add Organization / Affiliation</span>
        </button>
      )}

      {/* Interaction Timeline / Email Section */}
      <div id="email-section" className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-white">Activity Timeline</h2>
          <div className="flex gap-2">
            {(['EMAIL', 'WHATSAPP', 'CALL'] as const).map(type => {
              const count = interactions.filter(i => i.type === type).length;
              if (!count) return null;
              const cfg = TYPE_CONFIG[type];
              return (
                <span key={type} className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color} bg-gray-800`}>
                  {count} {cfg.label}
                </span>
              );
            })}
          </div>
        </div>

        {interactions.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-sm">No activity yet</p>
            <p className="text-xs mt-1">Interactions will appear here as they happen</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/40">
            {visibleInteractions.map((interaction) => {
              const cfg = TYPE_CONFIG[interaction.type] || TYPE_CONFIG.NOTE;
              const Icon = cfg.icon;
              return (
                <div key={interaction.id} className="flex gap-4 px-5 py-4 hover:bg-gray-800/20 transition-colors">
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-xs text-gray-600">·</span>
                      <span className="text-xs text-gray-500 capitalize">{interaction.direction?.toLowerCase()}</span>
                      <span className="text-xs text-gray-600">·</span>
                      <span className="text-xs text-gray-500">{timeAgo(interaction.timestamp)}</span>
                    </div>
                    {interaction.subject && (
                      <p className="text-sm font-medium text-white mt-0.5 truncate">{interaction.subject}</p>
                    )}
                    {interaction.content && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{interaction.content}</p>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="text-xs text-gray-600 flex-shrink-0 text-right hidden sm:block">
                    {new Date(interaction.timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                    <br />
                    {new Date(interaction.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            })}

            {interactions.length > 10 && (
              <button
                onClick={() => setShowAllInteractions(!showAllInteractions)}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-400 hover:text-white hover:bg-gray-800/30 transition-colors"
              >
                {showAllInteractions ? (
                  <><ChevronUp className="w-4 h-4" /> Show less</>
                ) : (
                  <><ChevronDown className="w-4 h-4" /> Show {interactions.length - 10} more interactions</>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Source + Meta */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500 mb-1">Source</p>
            <p className="text-white">{contact.source}</p>
          </div>
          {contact.first_order_date && (
            <div>
              <p className="text-xs text-gray-500 mb-1">First Order</p>
              <p className="text-white">{new Date(contact.first_order_date).toLocaleDateString()}</p>
            </div>
          )}
          {contact.last_order_date && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Last Order</p>
              <p className="text-white">{new Date(contact.last_order_date).toLocaleDateString()}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 mb-1">Added</p>
            <p className="text-white">{new Date(contact.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Organization Link Modal */}
      {showOrgModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between sticky top-0 bg-gray-900">
              <h2 className="text-lg font-bold text-white">Link Organization</h2>
              <button
                onClick={() => {
                  setShowOrgModal(false);
                  setOrgSearch('');
                  setOrgSearchResults([]);
                  setSelectedOrg(null);
                  setOrgRole('');
                  setOrgStartDate('');
                  setOrgEndDate('');
                  setOrgError('');
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Organization Search */}
            <div className="space-y-2">
              <label className="block text-sm text-gray-400">Organization</label>
              <input
                type="text"
                placeholder="Search for school, company, or organization..."
                value={orgSearch}
                onChange={e => {
                  setOrgSearch(e.target.value);
                  handleSearchOrganizations(e.target.value);
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-purple-500/50"
              />

              {/* Search Results */}
              {orgSearch && orgSearchResults.length > 0 && (
                <div className="border border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                  {orgSearchResults.map(org => (
                    <button
                      key={org.id}
                      onClick={() => {
                        setSelectedOrg(org);
                        setOrgSearch('');
                        setOrgSearchResults([]);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-800 border-b border-gray-700 last:border-b-0 transition-colors"
                    >
                      <p className="text-white text-sm">{org.name}</p>
                      {org.company && <p className="text-xs text-gray-400">{org.company}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Organization */}
            {selectedOrg && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                <p className="font-medium text-white text-sm">{selectedOrg.name}</p>
                {selectedOrg.company && <p className="text-xs text-gray-400 mt-0.5">{selectedOrg.company}</p>}
                <button
                  onClick={() => {
                    setSelectedOrg(null);
                    setOrgSearch('');
                  }}
                  className="text-xs text-gray-400 hover:text-gray-300 mt-2"
                >
                  Change
                </button>
              </div>
            )}

            {/* Role */}
            <div className="space-y-2">
              <label className="block text-sm text-gray-400">Role (optional)</label>
              <input
                type="text"
                placeholder="e.g., Principal, Manager, Director"
                value={orgRole}
                onChange={e => setOrgRole(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-purple-500/50"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="block text-sm text-gray-400">Started (optional)</label>
                <input
                  type="date"
                  value={orgStartDate}
                  onChange={e => setOrgStartDate(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm text-gray-400">Ended (optional)</label>
                <input
                  type="date"
                  value={orgEndDate}
                  onChange={e => setOrgEndDate(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50"
                />
              </div>
            </div>

            {orgError && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{orgError}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleLinkOrganization}
                disabled={!selectedOrg || orgLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                {orgLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Linking...
                  </>
                ) : (
                  'Link Organization'
                )}
              </button>
              <button
                onClick={() => {
                  setShowOrgModal(false);
                  setOrgSearch('');
                  setOrgSearchResults([]);
                  setSelectedOrg(null);
                  setOrgRole('');
                  setOrgStartDate('');
                  setOrgEndDate('');
                  setOrgError('');
                }}
                disabled={orgLoading}
                className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Warning Modal */}
      {showDuplicateWarning && duplicateCandidates.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-yellow-600/50 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-400" />
                <h2 className="text-lg font-bold text-white">Possible Duplicate Found</h2>
              </div>
              <button
                onClick={() => {
                  setShowDuplicateWarning(false);
                  setSelectedDuplicateId(null);
                  setDuplicateCandidates([]);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-400">
              We found {duplicateCandidates.length} contact{duplicateCandidates.length !== 1 ? 's' : ''} that might be the same person:
            </p>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {duplicateCandidates.map(dup => (
                <div
                  key={dup.id}
                  onClick={() => setSelectedDuplicateId(dup.id)}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    selectedDuplicateId === dup.id
                      ? 'border-yellow-500 bg-yellow-500/10'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{dup.name || '(No name)'}</p>
                      {dup.email && <p className="text-xs text-blue-400 truncate">{dup.email}</p>}
                      {dup.phone && <p className="text-xs text-gray-400">{dup.phone}</p>}
                      {dup.company && <p className="text-xs text-gray-500">{dup.company}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-yellow-400">
                        {Math.round(dup.confidence * 100)}%
                      </p>
                      <p className="text-xs text-gray-500">{dup.reason.replace('_', ' ')}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {enrichError && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{enrichError}</span>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button
                onClick={handleMergeDuplicate}
                disabled={!selectedDuplicateId || merging}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                {merging ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Merging...
                  </>
                ) : (
                  'Merge & Enrich'
                )}
              </button>
              <button
                onClick={() => {
                  setShowDuplicateWarning(false);
                  setSelectedDuplicateId(null);
                  // Continue with enrichment anyway
                  setEnrichLoading(true);
                  performEnrichment();
                }}
                disabled={merging}
                className="w-full px-4 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 rounded-lg text-sm font-medium transition-colors"
              >
                Skip & Enrich This Contact Anyway
              </button>
              <button
                onClick={() => {
                  setShowDuplicateWarning(false);
                  setSelectedDuplicateId(null);
                  setDuplicateCandidates([]);
                  setEnrichLoading(false);
                }}
                disabled={merging}
                className="w-full px-4 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enrich Modal */}
      {showEnrichModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Enrich from Website</h2>
              <button
                onClick={() => {
                  setShowEnrichModal(false);
                  setEnrichUrl('');
                  setEnrichAutoDetect(false);
                  setEnrichError('');
                  setEnrichSuccess('');
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Auto-detect toggle */}
            <div className="flex items-center gap-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
              <input
                type="checkbox"
                id="enrichAutoDetect"
                checked={enrichAutoDetect}
                onChange={e => setEnrichAutoDetect(e.target.checked)}
                disabled={enrichLoading}
                className="w-4 h-4 rounded cursor-pointer"
              />
              <label htmlFor="enrichAutoDetect" className="flex-1 text-sm text-cyan-400 cursor-pointer">
                Auto-detect from company name {contact.company && `"${contact.company}"`}
              </label>
            </div>

            {/* URL input (shown when not auto-detecting) */}
            {!enrichAutoDetect && (
              <div className="space-y-2">
                <label className="block text-sm text-gray-400">Website URL</label>
                <input
                  type="text"
                  placeholder="example.com or https://example.com"
                  value={enrichUrl}
                  onChange={e => setEnrichUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleEnrichLead()}
                  disabled={enrichLoading}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
                />
                <p className="text-xs text-gray-500">We'll extract company name, email, phone, and description from the website.</p>
              </div>
            )}

            {/* Info when auto-detecting */}
            {enrichAutoDetect && (
              <div className="space-y-2">
                <p className="text-sm text-gray-400">We'll try common domains for "{contact.company}":</p>
                <p className="text-xs text-gray-500">• companyname.com • company-name.com • companyname.co.jm</p>
                <p className="text-xs text-gray-500">We'll extract email, phone, and description from the website.</p>
              </div>
            )}

            {enrichError && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{enrichError}</span>
              </div>
            )}

            {enrichSuccess && (
              <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm">
                <span>{enrichSuccess}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleEnrichLead}
                disabled={(enrichAutoDetect ? false : !enrichUrl.trim()) || enrichLoading || !contact.company && enrichAutoDetect}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                {enrichLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Enriching...
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4" />
                    {enrichAutoDetect ? 'Auto-detect & Enrich' : 'Enrich'}
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowEnrichModal(false);
                  setEnrichUrl('');
                  setEnrichAutoDetect(false);
                  setEnrichError('');
                  setEnrichSuccess('');
                }}
                disabled={enrichLoading}
                className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactProfile;
