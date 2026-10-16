// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import SocialInbox from '../src/components/SocialInbox';
vi.mock('../src/lib/auth', () => ({ authHeaders: () => ({ Authorization: 'Bearer synthetic-token' }) }));
const id = '44444444-4444-4444-8444-444444444444', rid = '55555555-5555-4555-8555-555555555555';
let host: HTMLDivElement, root: Root, fetchMock: ReturnType<typeof vi.fn>, item: any, failSend: boolean, failCreate: boolean;
const ok = (data: any) => ({ ok: true, status: 200, json: async () => ({ success: true, ...data }) });
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; sessionStorage.clear(); failSend = false; failCreate = false;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  item = { id, accountId: 'account', sender: 'Synthetic sender', platform: 'facebook', type: 'dm', status: 'open', receivedAt: '2024-09-14T01:32:02Z', body: '<img src="https://tracker.invalid"><script>unsafe()</script>', canSend: true, reason: '', replies: [{ id: rid, messageId: id, body: 'Saved synthetic reply', status: 'draft', sentAt: null, confirmed: false }] };
  fetchMock = vi.fn(async (url: string, opts: any) => {
    if (url.includes('action=status')) return ok({ configured: true, accounts: [{ id: 'account', platform: 'facebook', account_name: 'Synthetic page', connection_status: 'connected' }] });
    if (url.includes('action=inbox')) return ok({ items: [item], nextCursor: 'MjU=', canReply: true });
    if (url.includes('action=message')) return ok({ item: structuredClone(item), canReply: true });
    if (url.includes('action=sendReply')) { if (failSend) return { ok: false, status: 502, json: async () => ({ success: false, uncertain: true, error: 'Reply outcome is uncertain.' }) }; item.replies[0] = { ...item.replies[0], status: 'sent', sentAt: '2026-10-15T12:00:00Z', confirmed: true }; return ok({ reply: item.replies[0] }); }
    if (url.includes('action=createDraft')) { if (failCreate) throw new Error('Draft outcome uncertain.'); const reply = { ...item.replies[0], id: 'new-reply', body: JSON.parse(opts.body).body }; item.replies.push(reply); return ok({ reply }); }
    return ok({});
  }); vi.stubGlobal('fetch', fetchMock);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); sessionStorage.clear(); });
async function mount() { await act(async () => root.render(<SocialInbox actorId="synthetic-actor" />)); }
const button = (label: string) => [...host.querySelectorAll('button')].find(node => node.textContent === label)!;
async function click(label: string) { await act(async () => button(label).click()); }
async function text(value: string) { await act(async () => { const field = host.querySelector('textarea')!; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })); }); }
describe('actual social inbox controls', () => {
  it('renders escaped messages with historical date; loading only performs authenticated GETs', async () => { await mount(); expect(host.querySelector('article')?.textContent).toContain('<img src='); expect(host.querySelector('img')).toBeNull(); expect(host.querySelector('script')).toBeNull(); expect(host.textContent).toContain('2024'); expect(fetchMock.mock.calls.every(call => call[1].method === 'GET' && call[1].headers.Authorization)).toBe(true); });
  it('uses provider cursor and resets pagination on account change', async () => { await mount(); await click('Next social page'); expect(fetchMock.mock.calls.some(call => call[0].includes('cursor=MjU%3D'))).toBe(true); await act(async () => { const select = host.querySelector('select')!; select.value = 'account'; select.dispatchEvent(new Event('change', { bubbles: true })); }); const reads = fetchMock.mock.calls.filter(call => call[0].includes('action=inbox')); expect(reads.at(-1)[0]).toContain('account_id=account'); expect(reads.at(-1)[0]).not.toContain('cursor='); expect(button('Previous social page').disabled).toBe(true); });
  it('shows expired reply window and blocks sending', async () => { item.canSend = false; item.reason = 'Reply window expired'; await mount(); expect(host.textContent).toContain('Reply window expired'); expect(button('Send reply now').disabled).toBe(true); });
  it('requires explicit send and displays confirmed platform receipt only afterward', async () => { await mount(); expect(host.textContent).toContain('Draft — not sent'); await click('Send reply now'); expect(host.textContent).toContain('Platform receipt confirmed'); expect(fetchMock.mock.calls.filter(call => call[1].method === 'POST')).toHaveLength(1); });
  it('blocks uncertain-send stale draft until refresh and informed acknowledgement', async () => { await mount(); failSend = true; await click('Send reply now'); expect(button('Retry sending reply').disabled).toBe(true); expect((host.querySelector('input[type=checkbox]') as HTMLInputElement).disabled).toBe(true); await click('Refresh social'); expect(button('Retry sending reply').disabled).toBe(true); await act(async () => (host.querySelector('input[type=checkbox]') as HTMLInputElement).click()); expect(button('Retry sending reply').disabled).toBe(false); failSend = false; await click('Retry sending reply'); expect(host.textContent).toContain('Platform receipt confirmed'); });
  it('retains pending-create identity after reload and allows explicit recovery only after refresh review', async () => { await mount(); failCreate = true; await text('Synthetic new reply'); await click('Save draft'); const storageKey = `follops-social-retry:synthetic-actor:${id}`; const requestId = sessionStorage.getItem(storageKey); expect(requestId).toBeTruthy(); expect(button('Start a new draft').disabled).toBe(true); await act(async () => root.unmount()); root = createRoot(host); await mount(); expect(sessionStorage.getItem(storageKey)).toBe(requestId); expect(button('Start a new draft').disabled).toBe(true); const checkbox = [...host.querySelectorAll('input')].find(node => node.parentElement?.textContent?.includes('reviewed the refreshed'))!; await act(async () => checkbox.click()); await click('Start a new draft'); expect(sessionStorage.getItem(storageKey)).toBeNull(); expect(host.querySelector('textarea')!.value).toBe(''); });
});
