import { supabaseRequest, setCors } from './_supabase.js';

function escapeValue(value) {
  return encodeURIComponent(String(value).trim());
}

function buildFilters(url) {
  const filters = [];
  const q = (url.searchParams.get('q') || '').trim();
  if (q) {
    const search = escapeValue(`%${q}%`);
    filters.push(`or=(full_name.ilike.${search},student_id.ilike.${search},email.ilike.${search},department_name.ilike.${search})`);
  }

  const status = (url.searchParams.get('enrollment_status') || '').trim();
  if (status) filters.push(`enrollment_status=eq.${escapeValue(status)}`);

  const department = (url.searchParams.get('department_id') || '').trim();
  if (department) {
    if (/^\d+$/.test(department)) filters.push(`department_id=eq.${department}`);
    else filters.push(`department_name=eq.${escapeValue(department)}`);
  }

  const admissionYear = (url.searchParams.get('admission_year') || '').trim();
  if (admissionYear) filters.push(`admission_year=eq.${admissionYear}`);

  const currentYear = (url.searchParams.get('current_year') || '').trim();
  if (currentYear) filters.push(`current_year=eq.${currentYear}`);

  const gender = (url.searchParams.get('gender') || '').trim();
  if (gender) {
    const genderMap = { M: 'Male', F: 'Female', O: 'Other' };
    filters.push(`gender=eq.${escapeValue(genderMap[gender] || gender)}`);
  }

  return filters;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const filters = buildFilters(url);

  let qs = 'select=*&order=full_name.asc&limit=1000';
  if (filters.length) qs = `${filters.join('&')}&${qs}`;

  const result = await supabaseRequest('GET', `/rest/v1/students?${qs}`);
  const rows = Array.isArray(result.data) ? result.data : [];
  const date = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'text/csv; charset=UTF-8');
  res.setHeader('Content-Disposition', `attachment; filename=unisearch-${date}.csv`);

  const cols = [
    'full_name', 'student_id', 'email',
    'phone_number', 'department_name',
    'admission_year', 'graduation_year',
    'current_year', 'current_semester',
    'enrollment_status', 'gender',
    'blood_group', 'date_of_birth',
    'address', 'account_number',
    'guardian_name', 'guardian_phone',
  ];

  const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = [
    cols.map((col) => col.toUpperCase().replace(/_/g, ' ')).join(','),
    ...rows.map((row) => cols.map((col) => escapeCsv(row[col])).join(',')),
  ];

  return res.status(200).send('\uFEFF' + lines.join('\r\n'));
}
