import { useEffect, useRef, useState } from 'react';
import { authHeaders } from '../auth';
import { validChatId, projectPhoneLabels, type PhoneLabel } from './inbox';
export interface PhoneAssignment {
    chatId: string;
    labelIds: string[] | null;
    checkedAt: number | null;
    expiresAt: number | null;
}
export function usePhoneLabels(chats: {
    id: string;
}[]) {
    const [labels, setLabels] = useState<PhoneLabel[]>([]), [assignments, setAssignments] = useState<Record<string, PhoneAssignment>>({}), [open, setOpen] = useState(false), [filter, setFilter] = useState('all'), [loading, setLoading] = useState(false), [changing, setChanging] = useState(false), [error, setError] = useState(''), [writesEnabled, setWritesEnabled] = useState(false), [blocked, setBlocked] = useState<Set<string>>(new Set()), [clock, setClock] = useState(Date.now());
    const validRow = (row: PhoneAssignment) => row && typeof row.chatId === 'string' && (row.labelIds === null ? row.checkedAt === null && row.expiresAt === null : Array.isArray(row.labelIds) && row.labelIds.length <= 100 && row.labelIds.every(x => typeof x === 'string' && /^[\w-]{1,100}$/.test(x)) && typeof row.checkedAt === 'number' && Number.isSafeInteger(row.checkedAt) && typeof row.expiresAt === 'number' && Number.isSafeInteger(row.expiresAt) && row.checkedAt >= 0 && row.expiresAt >= row.checkedAt && row.expiresAt - row.checkedAt <= 181000 && row.expiresAt <= Date.now() + 210000);
    const mutationActive = useRef(false), readActive = useRef(false);
    const sequence = useRef(0);
    useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 15000); return () => { clearInterval(timer); sequence.current++; }; }, []);
    const fresh = (id: string) => { const row = assignments[id]; return row && Array.isArray(row.labelIds) && typeof row.expiresAt === 'number' && row.expiresAt > Math.max(clock, Date.now()) ? row : null; };
    async function load(ids: string[], force = false) {
        if (mutationActive.current || readActive.current)
            return;
        const selected = [...new Set(ids.filter(validChatId))].slice(0, 25);
        if (!selected.length)
            return;
        readActive.current = true;
        const seq = ++sequence.current;
        setLoading(true);
        setError('');
        try {
            const response = await fetch('/api/whatsapp?action=phoneAssignments', { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ chatIds: selected, forceRefresh: force }) });
            const value = await response.json();
            if (!response.ok || !value.success || !Array.isArray(value.items))
                throw Error(value.error || 'Phone labels could not be checked.');
            if (seq !== sequence.current)
                return;
            const rows: Record<string, PhoneAssignment> = {};
            for (const id of selected)
                rows[id] = { chatId: id, labelIds: null, checkedAt: null, expiresAt: null };
            for (const row of value.items) {
                if (!row || !selected.includes(row.chatId) || !validRow(row))
                    throw Error('Phone label response could not be verified.');
                rows[row.chatId] = row;
            }
            setAssignments(prev => ({ ...prev, ...rows }));
            if (force)
                setBlocked(prev => new Set([...prev].filter(id => !rows[id] || !Array.isArray(rows[id].labelIds))));
            if (Object.values(rows).some(row => row.labelIds === null))
                setError('Some phone labels could not be checked. Unknown conversations are excluded from label matches.');
            setClock(Date.now());
        }
        catch (e) {
            if (seq !== sequence.current)
                return;
            setAssignments(prev => ({ ...prev, ...Object.fromEntries(selected.map(chatId => [chatId, { chatId, labelIds: null, checkedAt: null, expiresAt: null }])) }));
            setError(e instanceof Error ? e.message : 'Phone labels could not be checked.');
        }
        finally {
            readActive.current = false;
            if (seq === sequence.current)
                setLoading(false);
        }
    }
    async function catalog() { const r = await fetch('/api/whatsapp?action=phoneLabels', { headers: authHeaders() }), value = await r.json(); if (!r.ok || !value.success || !Array.isArray(value.labels))
        throw Error(value.error || 'Phone labels could not be loaded.'); setLabels(projectPhoneLabels(value.labels)); setWritesEnabled(value.writesEnabled === true); }
    async function toggle() { if (mutationActive.current)
        return; if (open) {
        setOpen(false);
        return;
    } setOpen(true); setError(''); try {
        await catalog();
        if (!Object.keys(assignments).length)
            await load(chats.map(chat => chat.id));
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Phone labels could not be loaded.');
    } }
    async function refresh() { if (mutationActive.current)
        return; setError(''); try {
        await catalog();
        await load(Object.keys(assignments).length ? Object.keys(assignments) : chats.map(chat => chat.id), true);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Phone labels could not be refreshed.');
    } }
    async function change(chatId: string, labelId: string) { const row = fresh(chatId); if (!row || mutationActive.current || readActive.current || changing || blocked.has(chatId) || !writesEnabled || !/^\d{5,25}@s\.whatsapp\.net$/.test(chatId))
        return; const expectedPresent = row.labelIds!.includes(labelId); mutationActive.current = true; const mutationSequence = ++sequence.current; setChanging(true); setError(''); try {
        const r = await fetch('/api/whatsapp?action=phoneLabelChange', { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId, labelId, action: expectedPresent ? 'remove' : 'add', expectedPresent }) });
        const value = await r.json();
        if (!r.ok || !value.success || !value.confirmed || value.chatId !== chatId || !Array.isArray(value.labelIds) || !validRow(value))
            throw Object.assign(Error(value.error || 'Phone label update could not be confirmed.'), { uncertain: value.uncertain === true });
        if (mutationSequence !== sequence.current)
            return;
        setAssignments(prev => ({ ...prev, [chatId]: value }));
        setClock(Date.now());
    }
    catch (e) {
        setBlocked(prev => new Set([...prev, chatId]));
        setAssignments(prev => ({ ...prev, [chatId]: { chatId, labelIds: null, checkedAt: null, expiresAt: null } }));
        setError(e instanceof Error ? e.message : 'Check the phone, then refresh labels before continuing.');
    }
    finally {
        mutationActive.current = false;
        setChanging(false);
    } }
    const known = chats.filter(chat => fresh(chat.id)).length;
    const next = chats.map(chat => chat.id).filter(id => validChatId(id) && !Object.prototype.hasOwnProperty.call(assignments, id)).slice(0, 25);
    const matches = (id: string) => filter === 'all' ? true : filter === 'unknown' ? !fresh(id) : filter === 'none' ? fresh(id)?.labelIds?.length === 0 : fresh(id)?.labelIds?.includes(filter) === true;
    const display = (id: string) => { const row = fresh(id); return row?.labelIds?.map(labelId => labels.find(label => label.id === labelId) || { id: labelId, name: 'Unknown phone label', color: '' }) || []; };
    return { labels, assignments, open, filter, setFilter, loading, changing, error, writesEnabled, blocked, fresh, known, total: chats.length, next, toggle, refresh, load, change, matches, display };
}
