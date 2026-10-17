import type { SupabaseClient } from '@supabase/supabase-js';

export async function loadMailboxSettings(admin: SupabaseClient<any>): Promise<Record<string, string>> {
  const { data, error } = await admin.from('app_settings').select('setting_key,setting_value').order('updated_at', { ascending: false });
  if (error) throw new Error('Saved email settings are unavailable.');
  const settings: Record<string, string> = {};
  for (const row of data || []) if (!(row.setting_key in settings)) settings[row.setting_key] = row.setting_value || '';
  return settings;
}
export function mailboxConfig(settings: Record<string, string>, env = process.env) {
  const get = (key: string, fallback = '') => env[key] || settings[key] || fallback;
  const host = get('IMAP_HOST').trim().toLowerCase();
  const port = Number(get('IMAP_PORT', '993'));
  const user = get('IMAP_USER'); const password = get('IMAP_PASSWORD');
  // Only public provider DNS names are accepted; saved configuration is never taken from a request.
  const providers = ['imap.gmail.com', 'outlook.office365.com', 'imap.mail.yahoo.com', 'imap.zoho.com', 'imappro.zoho.com'];
  if (!host || !user || !password || /^[•*]+$/.test(password)) throw new Error('Save valid IMAP credentials in Settings before syncing.');
  if (!providers.includes(host) || port !== 993 || get('IMAP_USE_TLS', 'true') === 'false') throw new Error('Use a supported IMAP provider with TLS on port 993.');
  return { host, port, user, password, tls: true, tlsOptions: { rejectUnauthorized: true, servername: host }, connTimeout: 6000, authTimeout: 6000 };
}
export async function verifySavedMailbox(admin: SupabaseClient<any>) {
  const config = mailboxConfig(await loadMailboxSettings(admin));
  const { default: Imap } = await import('imap');
  return new Promise<void>((resolve, reject) => {
    const imap = new Imap(config); let settled = false;
    const finish = (error?: Error) => { if (settled) return; settled = true; clearTimeout(timer); imap.destroy(); error ? reject(error) : resolve(); };
    const timer = setTimeout(() => finish(new Error('IMAP validation timed out. Try again.')), 8000);
    imap.once('ready', () => imap.openBox('INBOX', true, err => finish(err ? new Error('Unable to open the saved mailbox.') : undefined)));
    imap.once('error', () => finish(new Error('IMAP login failed. Check the saved app password and provider settings.')));
    imap.once('end', () => finish(new Error('IMAP connection ended before validation.')));
    try { imap.connect(); } catch { finish(new Error('Unable to connect to the saved mailbox.')); }
  });
}
