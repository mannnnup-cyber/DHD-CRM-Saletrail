// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
vi.mock('../auth', () => ({ authHeaders: () => ({ Authorization: 'Bearer synthetic' }) }));
import { usePhoneLabels } from './use-phone-labels';
const id = '19000000001@s.whatsapp.net', other = '19000000002@s.whatsapp.net';
let controls: ReturnType<typeof usePhoneLabels>, root: Root, node: HTMLDivElement;
function Harness() { controls = usePhoneLabels([{ id }, { id: other }]); return null; }
const row = (chatId: string, labelIds: string[]) => ({ chatId, labelIds, checkedAt: Date.now(), expiresAt: Date.now() + 180000 });
beforeEach(async () => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; node = document.createElement('div'); document.body.append(node); root = createRoot(node); await act(async () => root.render(<Harness />)); });
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('prevents reads/toggles from racing an in-flight single-label change', async () => {
    let resolveWrite: (value: any) => void = () => { };
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => { if (url.includes('action=phoneLabels'))
        return { ok: true, json: async () => ({ success: true, writesEnabled: true, labels: [{ id: '1', name: 'One', color: '2' }, { id: '2', name: 'Two', color: '3' }] }) }; if (url.includes('action=phoneAssignments'))
        return { ok: true, json: async () => ({ success: true, items: [row(id, []), row(other, [])] }) }; if (url.includes('action=phoneLabelChange'))
        return await new Promise<any>(resolve => { resolveWrite = resolve; }); throw Error('Unexpected synthetic request'); });
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => controls.toggle());
    expect(controls.fresh(id)?.labelIds).toEqual([]);
    let pending: Promise<void> | undefined;
    await act(async () => { pending = controls.change(id, '1'); await Promise.resolve(); });
    expect(controls.changing).toBe(true);
    const calls = fetchMock.mock.calls.length;
    await act(async () => { await controls.load([id], true); await controls.toggle(); await controls.refresh(); });
    expect(fetchMock.mock.calls).toHaveLength(calls);
    await act(async () => { resolveWrite({ ok: true, json: async () => ({ success: true, confirmed: true, ...row(id, ['2', '1']) }) }); await pending; });
    expect(controls.fresh(id)?.labelIds).toEqual(['2', '1']);
    expect(controls.fresh(other)?.labelIds).toEqual([]);
    expect(controls.changing).toBe(false);
    const post = fetchMock.mock.calls.find(([url]) => url.includes('action=phoneLabelChange'))!;
    expect(JSON.parse(String(post[1]?.body))).toEqual({ chatId: id, labelId: '1', action: 'add', expectedPresent: false });
});
it('blocks repeat changes after uncertainty until explicit fresh readback', async () => {
    let freshMembership: string[] = [];
    const fetchMock = vi.fn(async (url: string) => { if (url.includes('action=phoneLabels'))
        return { ok: true, json: async () => ({ success: true, writesEnabled: true, labels: [{ id: '1', name: 'One', color: '2' }] }) }; if (url.includes('action=phoneAssignments'))
        return { ok: true, json: async () => ({ success: true, items: [row(id, freshMembership), row(other, [])] }) }; return { ok: false, json: async () => ({ success: false, uncertain: true, error: 'Check the phone and refresh.' }) }; });
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => controls.toggle());
    await act(async () => controls.change(id, '1'));
    expect(controls.blocked.has(id)).toBe(true);
    expect(controls.fresh(id)).toBeNull();
    const calls = fetchMock.mock.calls.length;
    await act(async () => controls.change(id, '1'));
    expect(fetchMock.mock.calls).toHaveLength(calls);
    freshMembership = ['1'];
    await act(async () => controls.refresh());
    expect(controls.blocked.has(id)).toBe(false);
    expect(controls.fresh(id)?.labelIds).toEqual(['1']);
});
