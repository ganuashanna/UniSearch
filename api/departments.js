import { supabaseRequest, setCors } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS')
    return res.status(200).end();

  const result = await supabaseRequest('GET',
    '/rest/v1/departments?select=*&order=name.asc');

  if (Array.isArray(result.data) && result.data.length) {
    return res.json({ departments: result.data });
  }

  const fallback = await supabaseRequest(
    'GET',
    '/rest/v1/students?select=department_name&department_name=not.is.null&order=department_name.asc'
  );

  const departments = [...new Set(
    (Array.isArray(fallback.data) ? fallback.data : [])
      .map((row) => row.department_name)
      .filter(Boolean)
  )].map((name, index) => ({ id: index + 1, name }));

  return res.json({ departments });
}
