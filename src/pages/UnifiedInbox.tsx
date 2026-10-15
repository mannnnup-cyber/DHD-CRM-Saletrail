import { useEffect, useState } from 'react';
import { authHeaders } from '../lib/auth';
import { useApp } from '../context/AppContext';
import type { InboxEmail } from '../lib/inbox/email';

export default function UnifiedInbox() {
  const { state } = useApp();
  const [items, setItems] = useState<InboxEmail[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<(string | null)[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setItems([]); setSelected(null); setNextCursor(null);
    const query = `/api/email?action=inbox&limit=25${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    fetch(query, { headers: authHeaders(), signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || data.success !== true || !Array.isArray(data.items)) throw new Error(response.status === 401 ? 'Your session expired. Log in again.' : response.status === 403 ? 'Email access is denied for this account. Contact an administrator.' : 'Unable to load stored emails. Try refreshing.');
        if (!controller.signal.aborted) { setItems(data.items); setNextCursor(data.nextCursor || null); setSelected(data.items[0]?.id || null); }
      })
      .catch(err => { if (!controller.signal.aborted) setError(err.message || 'Unable to load stored emails.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [cursor, refresh, state.user?.id]);
  const message = items.find(item => item.id === selected);
  return <section className="p-4 lg:p-6 text-white" aria-label="Unified Inbox">
    <header className="flex justify-between items-start gap-4 mb-5">
      <div><h1 className="text-2xl font-semibold">Unified Inbox</h1><p className="text-gray-400 mt-1">Stored email · Read only · Most recent first</p></div>
      <button disabled={loading} onClick={() => setRefresh(value => value + 1)} className="bg-gray-800 rounded-lg px-4 py-2 disabled:opacity-50">Refresh</button>
    </header>
    <div className="flex gap-2 mb-5" aria-label="Channels"><span className="rounded-lg bg-amber-500 text-black px-3 py-2">Email</span><span className="rounded-lg bg-gray-800 text-gray-400 px-3 py-2">WhatsApp unavailable</span><span className="rounded-lg bg-gray-800 text-gray-400 px-3 py-2">Social unavailable</span></div>
    {loading ? <p role="status">Loading stored emails...</p> : error ? <p role="alert" className="text-red-400">{error}</p> : items.length === 0 ? <p role="status">No accessible stored emails on this page.</p> :
      <div className="grid md:grid-cols-[minmax(250px,1fr)_2fr] gap-4">
        <div className="space-y-2" aria-label="Email messages">{items.map(item => <button key={item.id} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)} className={`block w-full text-left rounded-xl border p-4 ${selected === item.id ? 'border-amber-500 bg-gray-800' : 'border-gray-800 bg-gray-900'}`}>
          <span className="block text-sm text-gray-400">{item.from || 'Unknown sender'}{item.unread ? ' · Unread' : ''}</span><strong className="block mt-1">{item.subject}</strong><span className="block text-xs text-gray-500 mt-2">{item.occurredAt ? new Date(item.occurredAt).toLocaleString() : 'Date unknown'} · {item.contact?.name || 'Contact unresolved'}</span>
        </button>)}</div>
        {message && <article className="bg-gray-900 border border-gray-800 rounded-xl p-5 break-words" aria-label="Selected email">
          <h2 className="text-xl font-semibold mb-3">{message.subject}</h2><p className="text-sm text-gray-400">From: {message.from || 'Unknown'}<br />To: {message.to || 'Unknown'}</p>
          <p className="mt-3 text-sm">{message.contact ? <a className="text-amber-400 underline" href={`/#/contacts/${encodeURIComponent(message.contact.id)}`}>View {message.contact.name}</a> : 'Contact unresolved — no contact link is available.'}</p>
          <p className="whitespace-pre-wrap mt-5">{message.body || 'No plain-text content available.'}</p>
          {message.bodyTruncated && <p role="status" className="text-amber-400 text-sm mt-4">Long message shortened to 12,000 characters. Open the original email for the complete content.</p>}
        </article>}
      </div>}
    <nav className="flex gap-3 mt-5" aria-label="Email pages">
      <button disabled={loading || history.length === 0} onClick={() => { const previous = history[history.length - 1]; setHistory(history.slice(0, -1)); setCursor(previous); }} className="bg-gray-800 rounded-lg px-4 py-2 disabled:opacity-40">Previous page</button>
      <button disabled={loading || !nextCursor} onClick={() => { setHistory([...history, cursor]); setCursor(nextCursor); }} className="bg-gray-800 rounded-lg px-4 py-2 disabled:opacity-40">Next page</button>
    </nav>
  </section>;
}
