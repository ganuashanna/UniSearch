import {
  supabaseRequest, setCors, addComputedFields
} from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS')
    return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const q   = url.searchParams.get('q') || '';
  const page  = Math.max(1, parseInt(url.searchParams.get('page'))  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit')) || 25));

  const filters = [];

  if (q) {
    const s = encodeURIComponent(`%${q}%`);
    filters.push(
      `or=(full_name.ilike.${s},`
    + `student_id.ilike.${s},`
    + `email.ilike.${s},`
    + `department_name.ilike.${s},`
    + `phone_number.ilike.${s})`
    );
  }

  const directFilters = {
    department_id:     'eq',
    admission_year:    'eq',
    current_year:      'eq',
    current_semester:  'eq',
    enrollment_status: 'eq',
    gender:            'eq',
  };

  for (const [key, op] of Object.entries(directFilters)) {
    const val = url.searchParams.get(key);
    if (val)
      filters.push(`${key}=${op}.${val}`);
  }

  const gradYear = url.searchParams.get('graduation_year');
  if (gradYear === 'enrolled')
    filters.push('graduation_year=is.null');
  else if (gradYear)
    filters.push(`graduation_year=eq.${gradYear}`);

  const allowed = ['full_name','student_id', 'admission_year','current_year', 'department_name','created_at', 'enrollment_status'];
  const sortBy  = allowed.includes(url.searchParams.get('sort_by')) ? url.searchParams.get('sort_by') : 'full_name';
  const sortDir = url.searchParams.get('sort_dir') === 'desc' ? 'desc' : 'asc';

  let qs = 'select=*,semesters(*)';
  if (filters.length) qs += '&' + filters.join('&');
  qs += `&order=${sortBy}.${sortDir}`;

  const from = (page - 1) * limit;
  const to   = from + limit - 1;

  const result = await supabaseRequest(
    'GET',
    `/rest/v1/students?${qs}`,
    null, false,
    { Range: `${from}-${to}`, Prefer: 'count=exact' }
  );

  // Simple count check
  const countRes = await supabaseRequest('GET', `/rest/v1/students?${qs}&select=id`);
  const total = Array.isArray(countRes.data) ? countRes.data.length : 0;

  const data = (Array.isArray(result.data) ? result.data : []).map(addComputedFields);

  res.status(200).json({
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
