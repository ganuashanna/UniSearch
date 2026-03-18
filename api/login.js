import {
  setCors, jwtEncode,
  ADMIN_PASSWORD
} from './_supabase.js';
import { timingSafeEqual } from 'crypto';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS')
    return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'POST only' });

  // bodyParser is enabled by default in Node.js serverless functions
  const body = req.body || {};
  const pass = (body.password || '').trim();

  let match = false;
  try {
    const b1 = Buffer.from(pass);
    const b2 = Buffer.from(ADMIN_PASSWORD);
    if (b1.length === b2.length) {
        match = timingSafeEqual(b1, b2);
    }
  } catch (err) { match = false; }

  if (!match) {
    await new Promise(r => setTimeout(r, 800));
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = jwtEncode({
    admin: true,
    iat:   Math.floor(Date.now() / 1000),
    exp:   Math.floor(Date.now() / 1000) + 86400,
  });

  res.json({ success: true, token });
}
