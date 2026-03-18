import { supabaseRequest, setCors } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS')
    return res.status(200).end();
  const result = await supabaseRequest('GET',
    '/rest/v1/departments?select=*&order=name.asc');
  res.json({ departments: result.data || [] });
}
