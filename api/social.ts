import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleSocial } from '../src/lib/inbox/social-server.js';
import { handlePublishing } from '../src/lib/publishing/server.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.query.module === 'publishing') return handlePublishing(req, res);
  return handleSocial(req, res);
}
