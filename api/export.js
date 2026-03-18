import { supabaseRequest, setCors } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const q = url.searchParams.get('q') || '';
  const filters = [];

  if (q) {
    const s = encodeURIComponent(`%${q}%`);
    filters.push(`or=(full_name.ilike.${s},student_id.ilike.${s},department_name.ilike.${s})`);
  }

  const map = {
    enrollment_status: 'eq',
    department_id:     'eq',
    admission_year:    'eq',
    current_year:      'eq',
  };
  for (const [k,op] of Object.entries(map)) {
    const val = url.searchParams.get(k);
    if (val) filters.push(`${k}=${op}.${val}`);
  }

  const gradYear = url.searchParams.get('graduation_year');
  if (gradYear === 'enrolled')
    filters.push('graduation_year=is.null');
  else if (gradYear)
    filters.push(`graduation_year=eq.${gradYear}`);

  let qs = 'select=*,semesters(cgpa)&order=full_name.asc&limit=1000';
  if (filters.length)
    qs = filters.join('&') + '&' + qs;

  const result = await supabaseRequest('GET', `/rest/v1/students?${qs}`);
  const rows = result.data || [];

  const date = new Date().toISOString().slice(0,10);
  res.setHeader('Content-Type', 'text/csv; charset=UTF-8');
  res.setHeader('Content-Disposition', `attachment; filename=unisearch-${date}.csv`);

  const cols = [
    'full_name','student_id','email',
    'phone_number','department_name',
    'admission_year','graduation_year',
    'current_year','current_semester',
    'enrollment_status','gender',
    'blood_group','date_of_birth',
    'address','account_number',
    'guardian_name','guardian_phone',
  ];

  const escape = v => `"${String(v ?? '').replace(/"/g,'""')}"`;

  const lines = [
    cols.map(c => c.toUpperCase().replace(/_/g,' ')).join(','),
    ...rows.map(s =>
      cols.map(c =>
        escape(c === 'graduation_year' && !s[c] ? 'Enrolled' : s[c])
      ).join(',')
    ),
  ];

  res.send('\uFEFF' + lines.join('\r\n'));
}
