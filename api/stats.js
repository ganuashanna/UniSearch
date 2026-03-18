import { supabaseRequest, setCors } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS')
    return res.status(200).end();

  const [stuRes, cgpaRes] = await Promise.all([
    supabaseRequest('GET',
      '/rest/v1/students?select=id,'
    + 'enrollment_status,admission_year,'
    + 'graduation_year,department_id'
    ),
    supabaseRequest('GET',
      '/rest/v1/semesters?select=cgpa'
    + '&cgpa=not.is.null'
    ),
  ]);

  const students = stuRes.data || [];
  const counts   = {
    active: 0, 
    graduated: 0,
    dropped: 0, 
    transferred: 0,
    suspended: 0
  };
  const years = {};
  const depts = new Set();

  for (const s of students) {
    const stat = s.enrollment_status || 'active';
    if (counts[stat] !== undefined) counts[stat]++;
    if (s.admission_year)
      years[s.admission_year] = (years[s.admission_year] || 0) + 1;
    if (s.department_id)
      depts.add(s.department_id);
  }

  const cgpaVals = (cgpaRes.data || [])
    .map(r => r.cgpa).filter(Boolean);
  const avg_cgpa = cgpaVals.length
    ? +(cgpaVals.reduce((a,b) => a+b, 0) / cgpaVals.length).toFixed(2)
    : 0;

  const batch_breakdown = Object.fromEntries(
    Object.entries(years).sort(([a],[b]) => b - a)
  );

  res.json({
    total_students: students.length,
    active_students: counts.active,
    graduated_students: counts.graduated,
    dropped_students: counts.dropped,
    transferred_students: counts.transferred,
    suspended_students: counts.suspended,
    departments_count: depts.size,
    batch_breakdown,
    avg_cgpa,
    batches: Object.keys(batch_breakdown),
    latest_batch: Object.keys(batch_breakdown)[0] ?? null,
  });
}
