// Provider envelopes may contain control-plane credentials alongside message data.
export function providerPayload(value: unknown, depth = 0): unknown {
  if (depth > 32) return null;
  if (Array.isArray(value)) return value.map(item => providerPayload(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (/^(?:api[-_]?key|authorization|access[-_]?token|refresh[-_]?token|password|secret|credential|headers|cookies?)$/i.test(key)) continue;
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    result[key] = providerPayload(item, depth + 1);
  }
  return result;
}
