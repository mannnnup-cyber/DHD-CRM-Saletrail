// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import UnifiedInbox from '../src/pages/UnifiedInbox';
import EmailAccessBoundary from '../src/pages/EmailInbox';
const actor = vi.hoisted(() => ({ role: 'owner', id: 'actor-id' }));
vi.mock('../src/context/AppContext', () => ({ useApp: () => ({ state: { user: actor } }) }));
vi.mock('../src/lib/auth', () => ({ authHeaders: () => ({ Authorization: 'Bearer test-token' }) }));
let host: HTMLDivElement; let root: Root;
const fetchMock = vi.fn();
const first = { id: 'first', subject: 'First message', from: 'sender@example.test', to: 'mailbox@example.test', body: '<img src="https://tracker.invalid/pixel"><script>unsafe()</script>', occurredAt: null, unread: true, contact: null, bodyTruncated: true };
const second = { ...first, id: 'second', subject: 'Second message', body: '', bodyTruncated: false, contact: { id: 'contact-id', name: 'Assigned Contact' } };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; actor.role = 'owner';
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  fetchMock.mockReset(); fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, items: [first, second], nextCursor: 'cursor-test' }) }); vi.stubGlobal('fetch', fetchMock);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function mount() { await act(async () => root.render(<UnifiedInbox />)); }
async function click(label: string) { await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent!.includes(label))!.click()); }
describe('actual Unified Inbox DOM', () => {
  it('authenticates read request only; no sync/send/mark-read/AI actions', async () => { await mount(); expect(fetchMock).toHaveBeenCalledTimes(1); expect(fetchMock.mock.calls[0][0]).toBe('/api/email?action=inbox&limit=25'); expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token'); expect(host.textContent).toContain('Saved emails'); expect(host.querySelector('a[href="#/whatsapp"]')).toBeTruthy(); });
  it('renders untrusted HTML as escaped plaintext with no images/scripts or remote fetch', async () => { await mount(); expect(host.querySelector('article')!.textContent).toContain('<img src='); expect(host.querySelector('img')).toBeNull(); expect(host.querySelector('script')).toBeNull(); expect(host.textContent).toContain('Long message shortened'); expect(host.textContent).toContain('Date unknown'); });
  it('selects message and links only its verified contact; HTML-only text unavailable explicit', async () => { await mount(); expect(host.querySelector('article a')).toBeNull(); await click('Second message'); expect(host.querySelector('article a')!.getAttribute('href')).toBe('/#/contacts/contact-id'); expect(host.textContent).toContain('No plain-text content available.'); });
  it('moves through bounded server cursor pages and refreshes', async () => { await mount(); await click('Next page'); expect(fetchMock.mock.calls[1][0]).toContain('cursor=cursor-test'); await click('Previous page'); expect(fetchMock.mock.calls[2][0]).toBe('/api/email?action=inbox&limit=25'); await click('Refresh'); expect(fetchMock).toHaveBeenCalledTimes(4); });
  it('shows truthful access denial instead of cached data or empty success', async () => { fetchMock.mockResolvedValue({ ok: false, status: 403, json: async () => ({ success: false }) }); await mount(); expect(host.querySelector('[role=alert]')!.textContent).toContain('access is denied'); expect(host.querySelector('article')).toBeNull(); });
  it('shows empty results separately from errors', async () => { fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, items: [], nextCursor: null }) }); await mount(); expect(host.textContent).toContain('No accessible stored emails'); expect(host.querySelector('[role=alert]')).toBeNull(); });
  it('disables navigation while loading and aborts on unmount', async () => { fetchMock.mockReturnValue(new Promise(() => {})); await mount(); expect(host.textContent).toContain('Loading stored emails'); expect([...host.querySelectorAll('button')].every(button => button.disabled)).toBe(true); const signal = fetchMock.mock.calls[0][1].signal; await act(async () => root.unmount()); expect(signal.aborted).toBe(true); root = createRoot(host); });
  it('direct legacy page denies reps without reading private cache or making management calls', async () => { actor.role = 'rep'; localStorage.setItem('dhd_cached_emails', JSON.stringify([{ subject: 'private-cached-email' }])); await act(async () => root.render(<EmailAccessBoundary />)); expect(host.textContent).toContain('requires an owner or manager'); expect(host.textContent).not.toContain('private-cached-email'); expect(fetchMock).not.toHaveBeenCalled(); localStorage.removeItem('dhd_cached_emails'); });
});
