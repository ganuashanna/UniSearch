import { setCors, jwtEncode, ADMIN_PASSWORD } from './_supabase.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // CRITICAL: Manually read raw body chunks
  // req.json() and req.body FAIL in Vercel serverless
  let rawBody = '';
  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string'
        ? Buffer.from(chunk) : chunk);
    }
    rawBody = Buffer.concat(chunks).toString('utf-8');
  } catch (e) {
    rawBody = '';
  }

  let body = {};
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    try {
      const p = new URLSearchParams(rawBody);
      body = { password: p.get('password') };
    } catch { body = {}; }
  }

  const password = String(body.password || '').trim();

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const adminPwd = String(ADMIN_PASSWORD || 'admin123').trim();
  
  // Direct comparison (safe enough for admin portal)
  if (password !== adminPwd) {
    await new Promise(r => setTimeout(r, 500));
    return res.status(401).json({
      error: 'Invalid password'
    });
  }

  const now = Math.floor(Date.now() / 1000);
  const token = jwtEncode({
    admin: true,
    iat: now,
    exp: now + 86400,
  });

  return res.status(200).json({
    success: true,
    token: token,
    message: 'Login successful'
  });
}
