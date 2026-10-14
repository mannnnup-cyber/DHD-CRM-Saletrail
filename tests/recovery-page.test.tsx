// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Recovery from '../src/pages/Recovery';

let host: HTMLDivElement; let root: Root;
const fetchMock = vi.fn();
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState(null, '', '/#/recovery?token_hash=hash-test&type=recovery');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function mount() { await act(async () => root.render(<React.StrictMode><Recovery /></React.StrictMode>)); }
async function enter(password = 'valid-password-123', confirmation = password) {
  await act(async () => {
    const fields = host.querySelectorAll('input');
    for (const [i, value] of [password, confirmation].entries()) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(fields[i], value);
      fields[i].dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
}
async function submit() { await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); }
describe('actual recovery page', () => {
  it('labels onboarding setup without changing fixed recovery credential contract', async () => {
    history.replaceState(null, '', '/#/recovery?token_hash=hash-test&type=recovery&mode=setup');
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });
    await mount(); expect(host.textContent).toContain('Set up your account');
    expect(location.hash).toBe('#/recovery'); await enter(); await submit();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ tokenHash: 'hash-test', newPassword: 'valid-password-123' });
  });
  it('App exposes recovery outside logged-out CRM providers and login gate', async () => {
    vi.doMock('../src/context/AppContext', () => ({ AppProvider: () => { throw new Error('CRM provider must not mount'); }, useApp: () => { throw new Error('CRM login gate must not run'); } }));
    // Other route modules are irrelevant to this integration boundary.
    for (const page of ['Login', 'Dashboard', 'CallLogs', 'Tasks', 'Pipeline', 'Quotes', 'LeadImport', 'WooCommerce', 'CompanionApp', 'CoachingDashboard', 'RecordingSettings', 'Templates', 'Team', 'Reports', 'Holidays', 'Invoices', 'Settings', 'Documentation', 'WhatsApp', 'EmailInbox', 'Contacts', 'ContactProfile', 'SocialMedia']) vi.doMock(`../src/pages/${page}`, () => ({ default: () => null }));
    for (const component of ['Sidebar', 'ContactModal', 'ActionList']) vi.doMock(`../src/components/${component}`, () => ({ default: () => null }));
    const App = (await import('../src/App')).default;
    await act(async () => root.render(<React.StrictMode><App /></React.StrictMode>));
    expect(host.textContent).toContain('Set new password'); expect(host.textContent).not.toContain('Something went wrong');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('strips token from URL in StrictMode without consuming it on mount', async () => { await mount(); expect(location.hash).toBe('#/recovery'); expect(fetchMock).not.toHaveBeenCalled(); expect(host.textContent).toContain('Set new password'); });
  it('rejects missing or unsupported link type', async () => { history.replaceState(null, '', '/#/recovery?token_hash=hash&type=signup'); await mount(); expect(host.textContent).toContain('Invalid'); expect(host.querySelector('form')).toBeNull(); });
  it('validates confirmation before submit', async () => { await mount(); await enter('valid-password', 'different-password'); await submit(); expect(host.textContent).toContain('Passwords do not match'); expect(fetchMock).not.toHaveBeenCalled(); });
  it('submits retained token to server without bearer credentials and clears passwords on success', async () => { fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) }); await mount(); await enter(); await submit(); expect(fetchMock).toHaveBeenCalledWith('/api/recovery-clear', expect.objectContaining({ method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tokenHash: 'hash-test', newPassword: 'valid-password-123' }) })); expect(host.textContent).toContain('Password updated'); expect(host.querySelector('input')).toBeNull(); });
  it('prevents concurrent submissions while waiting', async () => { let resolve: any; fetchMock.mockReturnValue(new Promise(r => { resolve = r; })); await mount(); await enter(); await submit(); expect(host.querySelector('button')!.disabled).toBe(true); await submit(); expect(fetchMock).toHaveBeenCalledTimes(1); await act(async () => resolve({ ok: true, status: 200, json: async () => ({ success: true }) })); });
  it('shows invalid/expired response and requests new link', async () => { fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ success: false }) }); await mount(); await enter(); await submit(); expect(host.textContent).toContain('new recovery link'); expect(host.querySelector('input')).toBeNull(); });
  it('reports partial cleanup truthfully without retrying consumed link', async () => { fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({ success: false, passwordUpdated: true }) }); await mount(); await enter(); await submit(); expect(host.textContent).toContain('Password updated'); expect(host.textContent).toContain('administrator'); expect(host.querySelector('form')).toBeNull(); });
  it('handles uncertain network failure without claiming unchanged password', async () => { fetchMock.mockRejectedValue(new Error('offline')); await mount(); await enter(); await submit(); expect(host.textContent).toContain('could not confirm'); expect(host.textContent).toContain('new recovery link'); expect(host.querySelector('form')).toBeNull(); });
});
