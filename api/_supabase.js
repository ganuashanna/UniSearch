import { createHmac } from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
export const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-min-32-chars-here';

export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
  res.setHeader('Content-Type', 'application/json');
}

export async function supabaseRequest(
  method, endpoint, body = null,
  serviceRole = false, extraHeaders = {}
) {
  const key = serviceRole
    ? SUPABASE_SERVICE_ROLE_KEY
    : SUPABASE_ANON_KEY;

  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...extraHeaders,
  };

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  try {
    const res = await fetch(
      SUPABASE_URL + endpoint, options);
    const data = await res.json().catch(() => ({}));
    return { data, status: res.status };
  } catch (e) {
    return { data: { error: e.message }, status: 500 };
  }
}

function b64uEncode(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function b64uDecode(str) {
  return Buffer.from(
    str.replace(/-/g, '+').replace(/_/g, '/'),
    'base64'
  ).toString('utf-8');
}

export function jwtEncode(payload) {
  const h = b64uEncode(Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  ));
  const p = b64uEncode(Buffer.from(
    JSON.stringify(payload)
  ));
  const s = b64uEncode(
    createHmac('sha256', JWT_SECRET)
      .update(`${h}.${p}`)
      .digest()
  );
  return `${h}.${p}.${s}`;
}

export function jwtDecode(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const expected = b64uEncode(
      createHmac('sha256', JWT_SECRET)
        .update(`${h}.${p}`)
        .digest()
    );
    if (expected !== s) return null;
    const payload = JSON.parse(b64uDecode(p));
    if (!payload) return null;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000))
      return null;
    return payload;
  } catch { return null; }
}

export function verifyAdminToken(req) {
  const auth = req.headers['authorization']
    || req.headers['Authorization'] || '';
  const m = auth.match(/Bearer\s+(.+)/i);
  if (!m) return false;
  const payload = jwtDecode(m[1].trim());
  return payload !== null && payload.admin === true;
}

export function addComputedFields(s) {
  const stat = s.enrollment_status || 'active';
  const adm  = s.admission_year;
  const grad = s.graduation_year;
  const yr   = s.current_year;
  const sem  = s.current_semester;
  const sfx  = ['', 'st', 'nd', 'rd'];

  s.batch_label = adm
    ? `${adm}-${grad ?? 'Enrolled'}` : '-';
  s.batch = s.batch_label;
  s.year_label = yr
    ? `${yr}${sfx[yr] || 'th'} Year` : '-';
  s.year_display = s.year_label;
  s.academic_year_label = {
    graduated:   `Graduated ${grad ?? ''}`,
    dropped:     `Left ${grad ?? ''}`,
    transferred: 'Transferred',
    suspended:   'Suspended',
  }[stat] ?? `${s.year_label}${sem ? ' - Sem ' + sem : ''}`;
  s.status_color = {
    active:      'emerald',
    graduated:   'indigo',
    dropped:     'rose',
    suspended:   'amber',
    transferred: 'cyan',
  }[stat] ?? 'gray';

  return s;
}
