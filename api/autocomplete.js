import { supabaseRequest, setCors } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS')
    return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const q = (url.searchParams.get('q') || '').trim();
  if (q.length < 2)
    return res.json({ suggestions: [] });

  const s = encodeURIComponent(`%${q}%`);
  const result = await supabaseRequest('GET',
    `/rest/v1/students?select=full_name`
  + `&full_name=ilike.${s}&limit=6`
  + `&order=full_name.asc`
  );

  const names = [
    ...new Set(
      (result.data || []).map(r => r.full_name)
    )
  ];
  res.json({ suggestions: names });
}
