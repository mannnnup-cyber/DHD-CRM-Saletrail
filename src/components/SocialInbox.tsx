import { useEffect, useRef, useState } from 'react';
import { authHeaders } from '../lib/auth';
import type { SocialAccount, SocialMessage, SocialReply } from '../lib/inbox/social';

async function request(action: string, method = 'GET', body?: object, signal?: AbortSignal) {
  const response = await fetch(`/api/social?action=${action}`, { method, headers: { ...authHeaders(), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok || data.success !== true) throw new Error(response.status === 401 ? 'Your session expired. Log in again.' : data.error || 'Unable to load social messages.');
  return data;
}
const replyLabel = (reply: SocialReply) => reply.status === 'sent' ? reply.confirmed ? 'Platform receipt confirmed' : 'Provider reports sent; platform receipt unavailable' : reply.status === 'failed' ? 'Failed — check platform before retrying' : reply.status === 'draft' ? 'Draft — not sent' : 'Status unknown';

export default function SocialInbox({ actorId }: { actorId: string }) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]); const [account, setAccount] = useState('');
  const [items, setItems] = useState<SocialMessage[]>([]); const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState<SocialMessage | null>(null); const [canReply, setCanReply] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null); const [next, setNext] = useState<string | null>(null); const [history, setHistory] = useState<(string | null)[]>([]);
  const [refresh, setRefresh] = useState(0); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [body, setBody] = useState(''); const [editing, setEditing] = useState<string | null>(null);
  const [retryChecked, setRetryChecked] = useState(false); const selection = useRef(''); const mounted = useRef(true);
  const [uncertainReplies, setUncertainReplies] = useState<Record<string, boolean>>({});
  const [reconciled, setReconciled] = useState(false); const [pendingCreate, setPendingCreate] = useState(false); const [recoveryChecked, setRecoveryChecked] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    request('status', 'GET', undefined, controller.signal).then(data => { if (!controller.signal.aborted) { setAccounts(data.accounts || []); if (!data.configured) setError('Social provider is not configured. Contact an administrator.'); } }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [actorId]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setItems([]); setSelected(''); setDetail(null); setNext(null);
    const query = `inbox${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}${account ? `&account_id=${encodeURIComponent(account)}` : ''}`;
    request(query, 'GET', undefined, controller.signal).then(data => { if (!controller.signal.aborted) { setItems(data.items); setNext(data.nextCursor); setCanReply(data.canReply === true); setSelected(data.items[0]?.id || ''); } }).catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [cursor, account, refresh, actorId]);
  useEffect(() => {
    selection.current = selected; setDetail(null); setBody(''); setEditing(null); setNotice(''); setRetryChecked(false); setReconciled(false); setRecoveryChecked(false);
    if (!selected) return;
    const controller = new AbortController();
    request(`message&message_id=${encodeURIComponent(selected)}`, 'GET', undefined, controller.signal).then(data => { if (!controller.signal.aborted) { setDetail(data.item); setCanReply(data.canReply === true); setReconciled(true); setPendingCreate(Boolean(sessionStorage.getItem(`follops-social-retry:${actorId}:${selected}`))); const uncertain: Record<string, boolean> = {}; for (const reply of data.item.replies) if (sessionStorage.getItem(`follops-social-send:${actorId}:${reply.id}`)) uncertain[reply.id] = true; setUncertainReplies(uncertain); } }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [selected, actorId]);
  async function mutate(action: string, reply?: SocialReply) {
    if (!detail || busy) return;
    if (action === 'updateDraft' && editing && uncertainReplies[editing]) return;
    if (action === 'sendReply' && reply && uncertainReplies[reply.id] && (!reconciled || !retryChecked)) return;
    const messageId = detail.id; setBusy(true); setError(''); setNotice('');
    try {
      const payload: Record<string, unknown> = { message_id: messageId };
      if (reply || editing) payload.reply_id = reply?.id || editing;
      if (action === 'createDraft' || action === 'updateDraft') payload.body = body;
      const retryStorage = `follops-social-retry:${actorId}:${messageId}`;
      if (action === 'createDraft') {
        // Persist only retry identity, never message/reply text. An uncertain create reuses its provider claim after reload.
        let requestId = sessionStorage.getItem(retryStorage);
        if (!requestId) { requestId = crypto.randomUUID(); sessionStorage.setItem(retryStorage, requestId); }
        payload.request_id = requestId;
      }
      if (action === 'sendReply') {
        payload.confirm_retry = retryChecked;
        sessionStorage.setItem(`follops-social-send:${actorId}:${reply!.id}`, 'uncertain');
      }
      const result = await request(action, action === 'updateDraft' ? 'PATCH' : action === 'discardDraft' ? 'DELETE' : 'POST', payload);
      if (action === 'createDraft') { sessionStorage.removeItem(retryStorage); setPendingCreate(false); }
      if (action === 'sendReply') { sessionStorage.removeItem(`follops-social-send:${actorId}:${reply!.id}`); setUncertainReplies(previous => { const next = { ...previous }; delete next[reply!.id]; return next; }); }
      if (!mounted.current || selection.current !== messageId) return;
      if (action === 'createDraft' || action === 'updateDraft') { setBody(''); setEditing(null); }
      setNotice(action === 'sendReply' && result.reply ? replyLabel(result.reply) : action === 'discardDraft' ? 'Draft discarded.' : 'Draft saved. It has not been sent.');
      const latest = await request(`message&message_id=${encodeURIComponent(messageId)}`);
      if (mounted.current && selection.current === messageId) { setDetail(latest.item); setRetryChecked(false); }
    } catch (error) { if (mounted.current && selection.current === messageId) { setError(error instanceof Error ? error.message : 'Reply outcome is uncertain. Refresh the thread before continuing.'); if (action === 'sendReply' && reply) { setUncertainReplies(previous => ({ ...previous, [reply.id]: true })); setReconciled(false); setRetryChecked(false); } if (action === 'createDraft') { setPendingCreate(true); setReconciled(false); } } }
    finally { if (mounted.current) setBusy(false); }
  }
  return <div aria-label="Social inbox">
    <div className="flex flex-wrap items-center gap-3 mb-4"><label>Account <select aria-label="Social account" disabled={busy || loading} value={account} onChange={event => { setAccount(event.target.value); setCursor(null); setHistory([]); }} className="bg-gray-800 rounded px-3 py-2"><option value="">All permitted accounts</option>{accounts.map(item => <option key={item.id} value={item.id}>{item.account_name || item.platform} ({item.connection_status})</option>)}</select></label><button disabled={busy || loading} onClick={() => setRefresh(value => value + 1)} className="bg-gray-800 rounded px-4 py-2">Refresh social</button><p className="text-sm text-gray-400">Provider syncs about every five minutes.</p></div>
    {error && <p role="alert" className="text-red-400 mb-4">{error}</p>}{notice && <p role="status" className="text-amber-400 mb-4">{notice}</p>}
    {loading ? <p role="status">Loading social messages...</p> : !error && items.length === 0 ? <p role="status">No social messages on this page.</p> : null}
    <div className="grid md:grid-cols-[minmax(250px,1fr)_2fr] gap-4">
      <div aria-label="Social messages" className="space-y-2">{items.map(item => <button key={item.id} disabled={busy} aria-pressed={selected === item.id} onClick={() => { setError(''); setSelected(item.id); }} className={`block w-full text-left border rounded-xl p-4 ${selected === item.id ? 'border-amber-500 bg-gray-800' : 'border-gray-800 bg-gray-900'}`}><strong>{item.sender}</strong><span className="block text-gray-400 text-sm">{item.platform} · {item.type} · {item.status}</span><span className="block mt-2 break-words">{item.body.slice(0, 180) || 'No text content'}</span></button>)}</div>
      {selected && !detail && !error ? <p role="status">Loading social thread...</p> : detail && <article aria-label="Selected social message" className="border border-gray-800 bg-gray-900 rounded-xl p-5 break-words">
        <h2 className="font-semibold text-xl">{detail.sender}</h2><p className="text-sm text-gray-400">{detail.platform} · {detail.type} · {detail.receivedAt ? new Date(detail.receivedAt).toLocaleString() : 'Date unknown'}</p><p className="whitespace-pre-wrap my-5">{detail.body || 'No plain-text content available.'}</p>{detail.bodyTruncated && <p>Long message shortened to 12,000 characters.</p>}
        <h3 className="font-semibold">Reply thread</h3>{detail.replies.length === 0 && <p className="text-gray-400">No replies.</p>}
        {detail.replies.map(reply => <div key={reply.id} className="border border-gray-700 rounded p-3 my-3"><p className="whitespace-pre-wrap">{reply.body}</p><p className="text-sm text-amber-400 mt-2">{uncertainReplies[reply.id] ? 'Delivery unconfirmed — review status' : replyLabel(reply)}</p>{uncertainReplies[reply.id] && <p role="status" className="text-amber-300">Previous send outcome is uncertain. Refresh social to reconcile the thread, then check the platform before retrying.</p>}{['draft', 'failed'].includes(reply.status) && <div className="flex flex-wrap gap-3 mt-3"><button disabled={busy || Boolean(uncertainReplies[reply.id])} onClick={() => { setEditing(reply.id); setBody(reply.body); }} className="underline">Edit draft</button><button disabled={busy || Boolean(uncertainReplies[reply.id])} onClick={() => mutate('discardDraft', reply)} className="underline">Discard draft</button><button disabled={busy || !canReply || !detail.canSend || (reply.status === 'failed' && !retryChecked) || (uncertainReplies[reply.id] && (!reconciled || !retryChecked))} onClick={() => mutate('sendReply', reply)} className="bg-amber-500 text-black rounded px-3 py-1 disabled:opacity-40">{reply.status === 'failed' || uncertainReplies[reply.id] ? 'Retry sending reply' : 'Send reply now'}</button></div>}</div>)}
        {(detail.replies.some(reply => reply.status === 'failed') || Object.keys(uncertainReplies).length > 0) && <label className="block text-sm text-amber-300 mb-4"><input type="checkbox" checked={retryChecked} disabled={busy || !reconciled} onChange={event => setRetryChecked(event.target.checked)} /> I checked the social platform for prior delivery. Retrying a failed or uncertain reply may send a duplicate.</label>}
        {pendingCreate && <div className="text-amber-300 my-4"><p>A previous draft save may already exist. Retry the same text to recover its result, or review the refreshed thread before starting another draft.</p><label><input type="checkbox" disabled={busy || !reconciled} checked={recoveryChecked} onChange={event => setRecoveryChecked(event.target.checked)} /> I reviewed the refreshed thread for the previous draft.</label><button disabled={busy || !reconciled || !recoveryChecked} className="block underline disabled:opacity-40" onClick={() => { sessionStorage.removeItem(`follops-social-retry:${actorId}:${detail.id}`); setPendingCreate(false); setBody(''); setEditing(null); }}>Start a new draft</button></div>}
        {!canReply && <p className="text-amber-400">Sending unavailable: the configured key lacks reply_from_inbox permission.</p>}{!detail.canSend && <p className="text-amber-400">{detail.reason || 'This platform or reply window does not currently allow sending.'}</p>}
        <label className="block mt-4">{editing ? 'Edit saved draft' : 'New draft'}<textarea aria-label="Reply text" disabled={busy || Boolean(editing && uncertainReplies[editing])} maxLength={10000} value={body} onChange={event => setBody(event.target.value)} className="block w-full min-h-28 bg-gray-800 rounded p-3 mt-2" /></label><p className="text-xs text-gray-400">Saving a draft does not send it. Send only after reviewing the saved text.</p><button disabled={busy || !body.trim() || Boolean(editing && uncertainReplies[editing])} onClick={() => mutate(editing ? 'updateDraft' : 'createDraft')} className="bg-gray-700 rounded px-4 py-2 mt-3 disabled:opacity-40">{busy ? 'Working...' : 'Save draft'}</button>{editing && <button disabled={busy} onClick={() => { setEditing(null); setBody(''); }} className="ml-4 underline">Cancel edit</button>}
      </article>}
    </div>
    <nav aria-label="Social pages" className="flex gap-3 mt-5"><button disabled={loading || busy || history.length === 0} onClick={() => { setCursor(history[history.length - 1]); setHistory(history.slice(0, -1)); }} className="bg-gray-800 rounded px-4 py-2 disabled:opacity-40">Previous social page</button><button disabled={loading || busy || !next} onClick={() => { setHistory([...history, cursor]); setCursor(next); }} className="bg-gray-800 rounded px-4 py-2 disabled:opacity-40">Next social page</button></nav>
  </div>;
}
