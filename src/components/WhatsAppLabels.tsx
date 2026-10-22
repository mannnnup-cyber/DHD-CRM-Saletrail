import { validLabelTarget } from '../lib/whatsapp/inbox';
import { Tag } from 'lucide-react';
import type { PhoneLabel } from '../lib/whatsapp/inbox';
import { usePhoneLabels } from '../lib/whatsapp/use-phone-labels';
type Controls = ReturnType<typeof usePhoneLabels>;
const name = (label: PhoneLabel, all: PhoneLabel[]) => all.filter(row => row.name === label.name).length > 1 ? `${label.name} (#${label.id.slice(-4)})` : label.name;
export function PhoneLabelChips({ labels }: {
    labels: PhoneLabel[];
}) { return labels.length ? <div className="flex gap-1 mt-1 min-w-0" aria-label="Phone conversation labels">{labels.slice(0, 2).map(label => <span key={label.id} title={`${label.name} · Phone color code ${label.color}`} className="max-w-24 truncate text-[10px] rounded px-1.5 py-0.5 bg-amber-500/10 text-amber-300">{name(label, labels)}</span>)}{labels.length > 2 && <span className="text-[10px] text-gray-400" title={labels.slice(2).map(label => label.name).join(', ')}>+{labels.length - 2}</span>}</div> : null; }
export function WhatsAppLabelControls({ controls: c, selected }: {
    controls: Controls;
    selected: {
        id: string;
        name: string;
    } | null;
}) {
    const row = selected ? c.fresh(selected.id) : null, eligible = !!selected && validLabelTarget(selected.id), canChange = !!row && eligible && c.writesEnabled && !c.blocked.has(selected!.id) && !c.changing && !c.loading;
    return <div className="px-3 py-2 border-b border-gray-700/50 text-xs text-gray-400">
 <div className="flex items-center justify-between gap-2"><button type="button" onClick={() => void c.toggle()} disabled={c.changing} aria-expanded={c.open} className="inline-flex items-center gap-1 text-amber-400"><Tag className="w-3 h-3"/> Phone labels</button>
 <select aria-label="Filter by phone label" value={c.filter} onChange={e => c.setFilter(e.target.value)} className="bg-gray-800 rounded px-2 py-1 max-w-40"><option value="all">All labels</option><option value="unknown">Not checked</option><option value="none">No labels (checked)</option>{c.labels.map(label => <option key={label.id} value={label.id}>{name(label, c.labels)}</option>)}</select></div>
 <p className="mt-1">Labels checked: {c.known} of {c.total}. {c.filter !== 'all' && c.filter !== 'unknown' ? 'Filter matches checked conversations only.' : 'Checks expire after 3 minutes.'}</p>
 {c.open && <div className="mt-2 space-y-2" role="region" aria-label="Phone labels"><p>{selected ? `Phone labels for ${selected.name}` : 'Select a conversation to manage its phone labels.'}</p>
 {!c.writesEnabled && <p>Assignment changes are awaiting activation. Existing phone labels are shown below.</p>}
 {selected && !row && <button type="button" disabled={c.loading || c.changing} onClick={() => void c.load([selected.id], true)} className="text-blue-400">Check this conversation</button>}
 {selected && row && !eligible && <p>This conversation supports viewing labels only.</p>}
 <div className="flex gap-3"><button type="button" disabled={c.loading || c.changing} onClick={() => void c.refresh()} className="text-blue-400">{c.loading ? 'Checking…' : 'Refresh first 25 checked'}</button>{c.next.length > 0 && <button type="button" disabled={c.loading || c.changing} onClick={() => void c.load(c.next)} className="text-blue-400">Check next {c.next.length}</button>}</div>
 <ul className="max-h-40 overflow-auto">{!c.labels.length && !c.loading && <li>No phone labels found.</li>}{c.labels.map(label => <li key={label.id} className="py-1"><label className="flex items-center gap-2" title={`Phone label ID ${label.id}; color code ${label.color}`}><input type="checkbox" checked={row?.labelIds?.includes(label.id) === true} disabled={!canChange} onChange={() => selected && void c.change(selected.id, label.id)}/><span className="w-2 h-2 rounded-full bg-gray-400" aria-hidden="true"/><span>{name(label, c.labels)}</span></label></li>)}</ul>
 <p>Names and colors are managed on the phone. Only an individual selected label changes; other labels remain untouched.</p></div>}
 {c.error && <p role="alert" className="mt-1 text-amber-400">{c.error}</p>}
 </div>;
}
