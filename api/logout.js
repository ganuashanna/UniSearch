import { setCors } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  res.json({ success: true });
}
