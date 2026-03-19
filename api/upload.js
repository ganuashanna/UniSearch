import {
  supabaseRequest, setCors, verifyAdminToken
} from './_supabase.js';

export const config = { api: { bodyParser: false } };

const NUMERIC_FIELDS = new Set([
  'admission_year',
  'graduation_year',
  'current_year',
  'current_semester',
  'department_id',
  'semester_number',
  'total_credits',
  'earned_credits',
  'backlogs',
]);

const FLOAT_FIELDS = new Set([
  'sgpa',
  'cgpa',
  'attendance_pct',
]);

function normalizeRow(row = {}) {
  const mapped = {};
  const aliases = {
    'name': 'full_name',
    'full name': 'full_name',
    'student id': 'student_id',
    'id': 'student_id',
    'department': 'department_name',
    'dept': 'department_name',
    'phone': 'phone_number',
    'admission year': 'admission_year',
    'graduation year': 'graduation_year',
    'current year': 'current_year',
    'current semester': 'current_semester',
    'status': 'enrollment_status',
    'guardian phone': 'guardian_phone',
  };

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = String(key).trim().toLowerCase();
    const targetKey = aliases[normalizedKey] || normalizedKey.replace(/\s+/g, '_');
    let nextValue = typeof value === 'string' ? value.trim() : value;
    if (nextValue === '') nextValue = null;
    if (NUMERIC_FIELDS.has(targetKey) && nextValue !== null && nextValue !== undefined) {
      const parsed = parseInt(nextValue, 10);
      nextValue = Number.isNaN(parsed) ? null : parsed;
    }
    if (FLOAT_FIELDS.has(targetKey) && nextValue !== null && nextValue !== undefined) {
      const parsed = parseFloat(nextValue);
      nextValue = Number.isNaN(parsed) ? null : parsed;
    }
    mapped[targetKey] = nextValue;
  }

  return mapped;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseCsvRows(text) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((line) => line.trim());
  if (!lines.length) return [];
  const headers = parseCSVLine(lines[0]).map((header) => header.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (!values.some((value) => String(value || '').trim())) continue;
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    rows.push(normalizeRow(row));
  }
  return rows;
}

async function upsertStudents(rows) {
  const validRows = rows
    .map(normalizeRow)
    .filter((row) => row.full_name && row.student_id);

  if (!validRows.length) {
    return { success: false, status: 400, error: 'No valid student rows found' };
  }

  const result = await supabaseRequest(
    'POST',
    '/rest/v1/students?on_conflict=student_id',
    validRows,
    true,
    { Prefer: 'resolution=merge-duplicates,return=minimal' }
  );

  return {
    success: result.status >= 200 && result.status < 300,
    status: result.status,
    imported: validRows.length,
    preview: validRows.slice(0, 5),
    error: result.status >= 300 ? JSON.stringify(result.data) : null,
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS')
    return res.status(200).end();

  if (!verifyAdminToken(req))
    return res.status(401).json({ error: 'Unauthorized' });

  if (req.method !== 'POST')
    return res.status(405).json({ error: 'POST only' });

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks);
  const contentType = req.headers['content-type'] || '';

  if (contentType.includes('application/json')) {
    const body = JSON.parse(raw.toString('utf-8') || '{}');

    if (body.action === 'upsert_semester') {
      const result = await supabaseRequest(
        'POST',
        '/rest/v1/semesters?on_conflict=student_id,semester_number',
        normalizeRow(body.data),
        true,
        { Prefer: 'resolution=merge-duplicates,return=minimal' }
      );
      return res.status(result.status >= 200 && result.status < 300 ? 200 : 400).json({
        success: result.status >= 200 && result.status < 300,
        error: result.status >= 300 ? result.data : null,
      });
    }

    if (body.action === 'bulk_upsert') {
      const result = await upsertStudents(Array.isArray(body.rows) ? body.rows : []);
      return res.status(result.success ? 200 : (result.status || 400)).json(result);
    }

    if (body.action === 'preview_rows') {
      const rows = Array.isArray(body.rows) ? body.rows.map(normalizeRow) : [];
      return res.status(200).json({
        success: true,
        total: rows.length,
        preview: rows.slice(0, 8),
      });
    }
  }

  const boundaryMatch = contentType.match(/boundary=(.+)$/i);
  if (!boundaryMatch)
    return res.status(400).json({ error: 'Unsupported upload format' });

  const boundary = '--' + boundaryMatch[1];
  const parts = raw.toString('binary').split(boundary).filter((part) => part.includes('Content-Disposition'));
  let fileBuffer = null;
  let fileName = '';

  for (const part of parts) {
    const [head, ...rest] = part.split('\r\n\r\n');
    if (!head.includes('filename=')) continue;
    const match = head.match(/filename="([^"]+)"/);
    if (match) fileName = match[1];
    const body = rest.join('\r\n\r\n').replace(/\r\n--$/, '').replace(/--$/, '');
    fileBuffer = Buffer.from(body, 'binary');
    break;
  }

  if (!fileBuffer || !fileName)
    return res.status(400).json({ error: 'No file found' });

  const ext = fileName.split('.').pop().toLowerCase();
  if (ext !== 'csv')
    return res.status(400).json({ error: 'Server upload supports CSV only; XLSX/XLS should be parsed in the browser.' });

  const rows = parseCsvRows(fileBuffer.toString('utf-8'));
  const mode = req.query.mode || 'import';

  if (mode === 'preview') {
    return res.status(200).json({
      success: true,
      total: rows.length,
      preview: rows.slice(0, 8),
    });
  }

  const result = await upsertStudents(rows);
  return res.status(result.success ? 200 : (result.status || 400)).json(result);
}
