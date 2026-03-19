export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const url  = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Test direct fetch to Supabase
  let deptResult = 'not tested';
  let stuResult  = 'not tested';

  try {
    const r = await fetch(`${url}/rest/v1/departments?select=name&limit=3`, {
      headers: {
        'apikey': anon,
        'Authorization': `Bearer ${anon}`,
      }
    });
    const d = await r.json();
    deptResult = { status: r.status, data: d };
  } catch(e) {
    deptResult = { error: e.message };
  }

  try {
    const r = await fetch(`${url}/rest/v1/students?select=full_name&limit=3`, {
      headers: {
        'apikey': anon,
        'Authorization': `Bearer ${anon}`,
      }
    });
    const d = await r.json();
    stuResult = { status: r.status, data: d };
  } catch(e) {
    stuResult = { error: e.message };
  }

  res.status(200).json({
    env: {
      SUPABASE_URL:    url ? url.substring(0,40)+'...' : 'MISSING',
      SUPABASE_ANON_KEY: anon ? anon.substring(0,20)+'...' : 'MISSING',
      SUPABASE_SERVICE_ROLE_KEY: svc ? svc.substring(0,20)+'...' : 'MISSING',
      ADMIN_PASSWORD:  process.env.ADMIN_PASSWORD || 'MISSING',
    },
    departments: deptResult,
    students:    stuResult,
  });
}
