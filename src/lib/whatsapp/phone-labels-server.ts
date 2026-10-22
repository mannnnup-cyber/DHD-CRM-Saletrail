import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { projectPhoneLabels, validChatId } from './inbox.js';
class LabelError extends Error {
    constructor(public status: number, message: string, public uncertain = false) { super(message); }
}
const fail = (status: number, message: string, uncertain = false): never => { throw new LabelError(status, message, uncertain); };
const validLabel = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,100}$/.test(value);
const cache = new Map<string, {
    labelIds: string[];
    checkedAt: number;
    expiresAt: number;
}>();
const writes = new Set<string>();
const budgets = new Map<string, {
    since: number;
    count: number;
}>();
const TTL = 180000;
export async function handlePhoneLabels(req: VercelRequest, res: VercelResponse, admin: SupabaseClient<any>) {
    try {
        const writesEnabled = process.env.WHATSAPP_LABEL_WRITES_ENABLED === 'true';
        if (req.query.action === 'phoneLabelChange' && !writesEnabled)
            fail(403, 'Phone label changes are not enabled yet.');
        const { data: settings, error } = await admin.from('app_settings').select('setting_key,setting_value').in('setting_key', ['EVOLUTION_API_URL', 'EVOLUTION_API_KEY', 'EVOLUTION_INSTANCE_NAME']);
        if (error)
            fail(503, 'Phone label configuration is unavailable.');
        const config = Object.fromEntries((settings || []).map(row => [row.setting_key, row.setting_value]));
        const origin = new URL(config.EVOLUTION_API_URL || process.env.EVOLUTION_API_URL || '');
        const key = process.env.EVOLUTION_API_KEY || config.EVOLUTION_API_KEY, instance = config.EVOLUTION_INSTANCE_NAME || process.env.EVOLUTION_INSTANCE_NAME;
        if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/' || !key || typeof instance !== 'string' || !/^[\w-]{1,100}$/.test(instance))
            fail(503, 'Phone label configuration is unavailable.');
        const prefix = origin.origin + '|' + instance + '|' + createHash('sha256').update(key).digest('hex');
        const deadline = Date.now() + 35000, overall = AbortSignal.timeout(35000);
        async function call(path: string, method = 'GET', body?: object) {
            const now = Date.now();
            for (const [k, v] of budgets)
                if (now - v.since >= 60000)
                    budgets.delete(k);
            if (budgets.size >= 100 && !budgets.has(prefix))
                fail(429, 'Phone label checks are busy. Try again shortly.');
            const bucket = budgets.get(prefix) || { since: now, count: 0 };
            if (bucket.count >= 120 || now >= deadline)
                fail(429, 'Phone label checks reached their current limit. Try again shortly.');
            bucket.count++;
            budgets.set(prefix, bucket);
            const response = await fetch(origin.origin + path, { method, headers: { apikey: key, Accept: 'application/json', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, redirect: 'error', cache: 'no-store', signal: AbortSignal.any([overall, AbortSignal.timeout(8000)]) });
            if (!response.ok)
                fail(502, 'Phone labels could not be checked.');
            const reader = response.body?.getReader();
            if (!reader)
                fail(502, 'Phone label response is unavailable.');
            let raw = '', bytes = 0;
            const decoder = new TextDecoder();
            while (true) {
                const chunk = await reader!.read();
                if (chunk.done)
                    break;
                bytes += chunk.value.byteLength;
                if (bytes > 131072) {
                    await reader!.cancel();
                    fail(502, 'Phone label response is too large.');
                }
                raw += decoder.decode(chunk.value, { stream: true });
            }
            return JSON.parse(raw);
        }
        function cacheResult(chatId: string, labelIds: string[]) { const now = Date.now(); for (const [k, v] of cache)
            if (v.expiresAt <= now)
                cache.delete(k); if (cache.size >= 2000)
            cache.delete(cache.keys().next().value!); const value = { labelIds, checkedAt: now, expiresAt: now + TTL }; cache.set(prefix + '|' + chatId, value); return value; }
        async function read(chatId: string, force = false) {
            const cached = cache.get(prefix + '|' + chatId);
            if (!force && cached && cached.expiresAt > Date.now())
                return cached;
            const value = await call('/chat/findChatByRemoteJid/' + encodeURIComponent(instance) + '?remoteJid=' + encodeURIComponent(chatId));
            if (!value || value.remoteJid !== chatId || !Array.isArray(value.labels) || value.labels.length > 100 || !value.labels.every(validLabel)) {
                cache.delete(prefix + '|' + chatId);
                return null;
            }
            return cacheResult(chatId, [...new Set<string>(value.labels)]);
        }
        if (req.query.action === 'phoneLabels') {
            const labels = projectPhoneLabels(await call('/label/findLabels/' + encodeURIComponent(instance)));
            return res.json({ success: true, labels, associationsAvailable: true, writesEnabled });
        }
        if (req.query.action === 'phoneAssignments') {
            const ids = req.body?.chatIds, force = req.body?.forceRefresh;
            if (!Array.isArray(ids) || ids.length > 25 || !ids.every(validChatId) || (force !== undefined && typeof force !== 'boolean'))
                fail(400, 'Provide up to 25 supported conversations.');
            const unique = [...new Set<string>(ids)], items: any[] = Array(unique.length);
            let cursor = 0;
            await Promise.all(Array.from({ length: Math.min(4, unique.length) }, async () => { while (cursor < unique.length) {
                const index = cursor++, chatId = unique[index];
                try {
                    const value = Date.now() < deadline ? await read(chatId, force === true) : null;
                    items[index] = { chatId, labelIds: value?.labelIds ?? null, checkedAt: value?.checkedAt ?? null, expiresAt: value?.expiresAt ?? null };
                }
                catch {
                    cache.delete(prefix + '|' + chatId);
                    items[index] = { chatId, labelIds: null, checkedAt: null, expiresAt: null };
                }
            } }));
            return res.json({ success: true, items, complete: items.every(item => Array.isArray(item.labelIds)) });
        }
        if (req.query.action === 'phoneLabelChange') {
            const { chatId, labelId, action, expectedPresent } = req.body || {};
            if (!validChatId(chatId) || !/^\d{5,25}@s\.whatsapp\.net$/.test(chatId) || !validLabel(labelId) || !['add', 'remove'].includes(action) || typeof expectedPresent !== 'boolean')
                fail(400, 'Select a supported direct conversation and existing label.');
            const lock = prefix + '|' + chatId;
            if (writes.has(lock))
                fail(409, 'A label update is already in progress. Refresh before continuing.');
            writes.add(lock);
            try {
                const labels = projectPhoneLabels(await call('/label/findLabels/' + encodeURIComponent(instance)));
                if (!labels.some(label => label.id === labelId))
                    fail(409, 'The phone label changed. Refresh labels before continuing.');
                const before = await read(chatId, true);
                if (!before)
                    fail(409, 'Label membership could not be verified. Refresh before continuing.');
                const desired = action === 'add', present = before!.labelIds.includes(labelId);
                if (present === desired)
                    return res.json({ success: true, confirmed: true, chatId, ...before });
                if (present !== expectedPresent)
                    fail(409, 'This label changed on the phone. Refresh before continuing.');
                cache.delete(lock);
                let acknowledged = false;
                try {
                    const ack = await call('/label/handleLabel/' + encodeURIComponent(instance), 'POST', { number: chatId.split('@')[0], labelId, action });
                    acknowledged = ack?.numberJid === chatId && ack?.labelId === labelId && ack?.[desired ? 'add' : 'remove'] === true;
                }
                catch { /* Readback, never an automatic mutation retry. */ }
                const after = await read(chatId, true).catch(() => null);
                if (!acknowledged || !after || after.labelIds.includes(labelId) !== desired) {
                    cache.delete(lock);
                    fail(409, 'Label update outcome is uncertain. Check the phone and refresh before making another change.', true);
                }
                return res.json({ success: true, confirmed: true, chatId, ...after });
            }
            finally {
                writes.delete(lock);
            }
        }
        fail(400, 'Unknown phone label action.');
    }
    catch (error) {
        return res.status(error instanceof LabelError ? error.status : 503).json({ success: false, error: error instanceof LabelError ? error.message : 'Phone labels are temporarily unavailable.', uncertain: error instanceof LabelError ? error.uncertain : false });
    }
}
