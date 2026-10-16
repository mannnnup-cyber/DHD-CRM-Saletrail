import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleSocial } from '../src/lib/inbox/social-server.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleSocial(req, res);
}
