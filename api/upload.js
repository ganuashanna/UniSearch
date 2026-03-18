import {
  supabaseRequest, setCors, verifyAdminToken
} from './_supabase.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS')
    return res.status(200).end();

  if (!verifyAdminToken(req))
    return res.status(401).json({ error: 'Unauthorized' });

  if (req.method !== 'POST')
    return res.status(405).json({ error: 'POST only' });

  // Handle semester upsert if action is specified (from admin.js)
  // Since bodyParser is false, we need to handle JSON or Multipart.
  // Actually the user specified api/upload.js to handle file upload.
  
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks);
  const ct = req.headers['content-type'] || '';
  
  // Check if it's JSON (for semester upsert)
  if (ct.includes('application/json')) {
     const body = JSON.parse(raw.toString('utf-8'));
     if (body.action === 'upsert_semester') {
        const res_sem = await supabaseRequest('POST', '/rest/v1/semesters', body.data, true, { Prefer: 'resolution=merge-duplicates' });
        return res.json({ success: res_sem.status < 300 });
     }
  }

  const boundaryMatch = ct.match(/boundary=(.+)$/i);
  if (!boundaryMatch)
    return res.status(400).json({ error: 'Not multipart' });

  const boundary = '--' + boundaryMatch[1];
  const parts = raw.toString('binary').split(boundary).filter(p => p.includes('Content-Disposition'));

  let fileBuffer = null;
  let fileName   = '';

  for (const part of parts) {
    const [head, ...rest] = part.split('\r\n\r\n');
    if (!head.includes('filename')) continue;
    const fnMatch = head.match(/filename="([^"]+)"/);
    if (fnMatch) fileName = fnMatch[1];
    const body = rest.join('\r\n\r\n').replace(/\r\n--$/, '').replace(/--$/, '');
    fileBuffer = Buffer.from(body, 'binary');
    break;
  }

  if (!fileBuffer) return res.status(400).json({ error: 'No file found' });

  const ext = fileName.split('.').pop().toLowerCase();
  
  if (ext === 'csv') {
    const text    = fileBuffer.toString('utf-8').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    const lines   = text.split('\n').filter(Boolean);
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    let rows = [];

    for (let i = 1; i < lines.length; i++) {
        const vals = parseCSVLine(lines[i]);
        if (!vals.some(Boolean)) continue;
        rows.push(Object.fromEntries(headers.map((h,i) => [h, vals[i] ?? ''])));
    }

    const aliases = {
        'name': 'full_name', 'full name': 'full_name', 'id': 'student_id', 'student id': 'student_id',
        'dept': 'department_name', 'department': 'department_name', 'phone': 'phone_number',
        'adm_year': 'admission_year', 'admission_year': 'admission_year', 'grad_year': 'graduation_year',
        'year': 'current_year', 'sem': 'current_semester', 'status': 'enrollment_status'
    };

    let imported = 0;
    for (let row of rows) {
        const mapped = {};
        for (let [k,v] of Object.entries(row)) {
            const key = aliases[k] || k;
            mapped[key] = v?.trim() || null;
            if (['admission_year', 'graduation_year', 'current_year', 'current_semester', 'department_id'].includes(key)) {
                mapped[key] = mapped[key] ? parseInt(mapped[key]) : null;
            }
        }
        if (!mapped.full_name || !mapped.student_id) continue;
        
        const res_u = await supabaseRequest('POST', '/rest/v1/students?on_conflict=student_id', mapped, true, { Prefer: 'resolution=merge-duplicates' });
        if (res_u.status < 300) imported++;
    }
    
    return res.json({ success: true, imported, total: rows.length });
  } else {
    return res.status(400).json({ error: 'Only CSV is supported currently. Please convert XLSX to CSV.' });
  }
}

function parseCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ;
    } else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
    else cur += c;
  }
  result.push(cur);
  return result;
}
