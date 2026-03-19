import { supabaseRequest, setCors } from './_supabase.js';

function average(values) {
  if (!values.length) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(2));
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS')
    return res.status(200).end();

  const [stuRes, deptRes, semRes] = await Promise.all([
    supabaseRequest('GET',
      '/rest/v1/students?select=id,enrollment_status,admission_year,department_id,department_name'
    ),
    supabaseRequest('GET',
      '/rest/v1/departments?select=id'
    ),
    supabaseRequest('GET',
      '/rest/v1/semesters?select=student_id,semester_number,cgpa&cgpa=not.is.null&order=student_id.asc,semester_number.desc'
    ),
  ]);

  const students = Array.isArray(stuRes.data) ? stuRes.data : [];
  const departments = Array.isArray(deptRes.data) ? deptRes.data : [];
  const semesters = Array.isArray(semRes.data) ? semRes.data : [];
  const counts = {
    active: 0,
    graduated: 0,
    dropped: 0,
    transferred: 0,
    suspended: 0,
  };
  const batchBreakdown = {};
  const deptKeys = new Set();
  const latestCgpaByStudent = new Map();

  for (const student of students) {
    const status = student.enrollment_status || 'active';
    if (counts[status] !== undefined) counts[status] += 1;
    if (student.admission_year) {
      batchBreakdown[student.admission_year] = (batchBreakdown[student.admission_year] || 0) + 1;
    }
    if (student.department_id) deptKeys.add(`id:${student.department_id}`);
    else if (student.department_name) deptKeys.add(`name:${student.department_name}`);
  }

  for (const semester of semesters) {
    if (!semester.student_id || latestCgpaByStudent.has(semester.student_id)) continue;
    const cgpa = Number(semester.cgpa);
    if (!Number.isNaN(cgpa)) {
      latestCgpaByStudent.set(semester.student_id, cgpa);
    }
  }

  const sortedBatches = Object.fromEntries(
    Object.entries(batchBreakdown).sort((a, b) => Number(b[0]) - Number(a[0]))
  );

  return res.status(200).json({
    total_students: students.length,
    active_students: counts.active,
    graduated_students: counts.graduated,
    dropped_students: counts.dropped,
    transferred_students: counts.transferred,
    suspended_students: counts.suspended,
    departments_count: deptKeys.size || departments.length,
    total_departments: deptKeys.size || departments.length,
    avg_cgpa: average([...latestCgpaByStudent.values()]),
    batch_breakdown: sortedBatches,
    batches: Object.keys(sortedBatches),
    latest_batch: Object.keys(sortedBatches)[0] ?? null,
  });
}
