import {
  supabaseRequest, setCors, addComputedFields
} from './_supabase.js';

function escapeValue(value) {
  return encodeURIComponent(String(value).trim());
}

function decorateStudent(student) {
  const sems = Array.isArray(student.semesters) ? student.semesters : [];
  if (sems.length) {
    const latest = [...sems].sort((a, b) => {
      return (a.semester_number || 0) - (b.semester_number || 0);
    }).at(-1);
    student.latest_cgpa = latest?.cgpa ?? null;
    student.latest_sgpa = latest?.sgpa ?? null;
  } else {
    student.latest_cgpa = null;
    student.latest_sgpa = null;
  }
  return addComputedFields(student);
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS')
    return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const q = (url.searchParams.get('q') || '').trim();
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25', 10)));
  const filters = [];

  if (q) {
    const search = escapeValue(`%${q}%`);
    filters.push(
      `or=(full_name.ilike.${search},student_id.ilike.${search},email.ilike.${search},department_name.ilike.${search},phone_number.ilike.${search})`
    );
  }

  const enrollmentStatus = url.searchParams.get('enrollment_status') || '';
  if (enrollmentStatus) {
    filters.push(`enrollment_status=eq.${escapeValue(enrollmentStatus)}`);
  }

  const departmentFilter = (url.searchParams.get('department_id') || '').trim();
  if (departmentFilter) {
    if (/^\d+$/.test(departmentFilter)) {
      filters.push(`department_id=eq.${departmentFilter}`);
    } else {
      filters.push(`department_name=eq.${escapeValue(departmentFilter)}`);
    }
  }

  const admissionYear = (url.searchParams.get('admission_year') || '').trim();
  if (admissionYear) {
    filters.push(`admission_year=eq.${admissionYear}`);
  }

  const currentYear = (url.searchParams.get('current_year') || '').trim();
  if (currentYear) {
    filters.push(`current_year=eq.${currentYear}`);
  }

  const gender = (url.searchParams.get('gender') || '').trim();
  if (gender) {
    const genderMap = { M: 'Male', F: 'Female', O: 'Other' };
    filters.push(`gender=eq.${escapeValue(genderMap[gender] || gender)}`);
  }

  const allowed = ['full_name', 'student_id', 'admission_year', 'current_year', 'department_name', 'created_at', 'enrollment_status'];
  const sortBy = allowed.includes(url.searchParams.get('sort_by')) ? url.searchParams.get('sort_by') : 'full_name';
  const sortDir = url.searchParams.get('sort_dir') === 'desc' ? 'desc' : 'asc';

  const rangeStart = (page - 1) * limit;
  const rangeEnd = rangeStart + limit - 1;
  let qs = 'select=*,semesters(semester_number,academic_year,sgpa,cgpa,attendance_pct,result,backlogs)';
  if (filters.length) qs += `&${filters.join('&')}`;
  qs += `&order=${sortBy}.${sortDir}`;

  const result = await supabaseRequest(
    'GET',
    `/rest/v1/students?${qs}`,
    null,
    false,
    { Range: `${rangeStart}-${rangeEnd}`, Prefer: 'count=exact' }
  );

  const totalRes = await supabaseRequest(
    'GET',
    `/rest/v1/students?select=id${filters.length ? `&${filters.join('&')}` : ''}`,
    null,
    false
  );

  const rows = Array.isArray(result.data) ? result.data : [];
  const total = Array.isArray(totalRes.data) ? totalRes.data.length : 0;
  const data = rows.map(decorateStudent);

  return res.status(200).json({
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
