import {
  supabaseRequest, setCors, addComputedFields
} from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS')
    return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const id = url.searchParams.get('id');
  if (!id) return res.status(400).json({ error: 'id required' });

  const [stuRes, semRes] = await Promise.all([
    supabaseRequest('GET',
      `/rest/v1/students?id=eq.${id}`
    + `&select=*,departments(name,code,total_years)`
    + `&limit=1`
    ),
    supabaseRequest('GET',
      `/rest/v1/semesters?student_id=eq.${id}`
    + `&select=*&order=semester_number.asc`
    ),
  ]);

  const students = stuRes.data || [];
  if (!students.length)
    return res.status(404).json({ error: 'Student not found' });

  const student    = addComputedFields(students[0]);
  student.semesters = semRes.data || [];

  if (student.semesters.length) {
    const last = student.semesters.at(-1);
    student.latest_cgpa = last.cgpa ?? 0;
    student.latest_sgpa = last.sgpa ?? 0;
  }

  res.json(student);
}
