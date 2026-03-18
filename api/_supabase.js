const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY         = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
export const JWT_SECRET     = process.env.JWT_SECRET     || 'fallback';

// Supabase REST request
export async function supabaseRequest(
  method,
  endpoint,
  body         = null,
  serviceRole  = false,
  extraHeaders = {}
) {
  const key = serviceRole
    ? SUPABASE_SERVICE_ROLE_KEY
    : SUPABASE_ANON_KEY;

  const headers = {
    'apikey':        key,
    'Authorization': 'Bearer ' + key,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation',
    ...extraHeaders,
  };

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res  = await fetch(SUPABASE_URL + endpoint, options);
  const data = await res.json().catch(() => ({}));
  return { data, status: res.status };
}

// CORS headers
export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
}

// Simple JWT (no library needed)
function b64u(str) {
  const input = typeof str === 'string' ? str : JSON.stringify(str);
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g,'-')
    .replace(/\//g,'_')
    .replace(/=/g,'');
}

function b64uDecode(str) {
  return Buffer.from(
    str.replace(/-/g,'+').replace(/_/g,'/'), 'base64'
  ).toString();
}

import { createHmac } from 'crypto';

export function jwtEncode(payload) {
  const h = b64u({ alg:'HS256', typ:'JWT' });
  const p = b64u(payload);
  const s = b64u(createHmac('sha256', JWT_SECRET)
    .update(`${h}.${p}`).digest());
  return `${h}.${p}.${s}`;
}

export function jwtDecode(token) {
  try {
    const [h, p, s] = token.split('.');
    const expected = b64u(
      createHmac('sha256', JWT_SECRET)
      .update(`${h}.${p}`).digest());
    if (expected !== s) return null;
    const payload = JSON.parse(b64uDecode(p));
    if (payload.exp < Math.floor(Date.now()/1000))
      return null;
    return payload;
  } catch { return null; }
}

export function verifyAdminToken(req) {
  const auth = req.headers.authorization || '';
  const match = auth.match(/Bearer\s+(.+)/i);
  if (!match) return false;
  const payload = jwtDecode(match[1].trim());
  return payload?.admin === true;
}

// Add computed fields to student object
export function addComputedFields(s) {
  const stat = s.enrollment_status || 'active';
  const adm  = s.admission_year;
  const grad = s.graduation_year;
  const yr   = s.current_year;
  const sem  = s.current_semester;

  s.batch = adm
    ? `${adm}–${grad ?? 'Enrolled'}` : '—';

  const sfx = ['','st','nd','rd','th','th','th','th','th','th'];
  s.year_display = yr
    ? `${yr}${sfx[yr] || 'th'} Year` : '—';

  s.academic_year_label = {
    graduated:   `Graduated ${grad ?? ''}`,
    dropped:     `Left ${grad ?? ''}`,
    transferred: 'Transferred',
    suspended:   'Suspended',
  }[stat] ?? `${s.year_display}${sem
    ? ' · Sem ' + sem : ''}`;

  s.status_color = {
    active:      'emerald',
    graduated:   'indigo',
    dropped:     'rose',
    suspended:   'amber',
    transferred: 'cyan',
  }[stat] ?? 'gray';

  return s;
}
