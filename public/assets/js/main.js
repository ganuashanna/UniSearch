/**
 * UniSearch BAMU Edition - Main JS (Fixed)
 */

const state = {
  query: '',
  status: '',
  department_name: '',
  admission_year: '',
  current_year: '',
  gender: '',
  page: 1,
  limit: 25,
  sort_by: 'full_name',
  sort_dir: 'asc',
  total: 0,
  totalPages: 0,
  view: localStorage.getItem('uni_view') || 'table',
  theme: localStorage.getItem('uni_theme') || 'light'
};

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadDepartments();
  loadStats();
  search();
  setupEventListeners();
  setView(state.view);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
});

// ═══════════════════════════════
// THEME
// ═══════════════════════════════
function initTheme() {
  const btn = document.getElementById('themeBtn');
  if (state.theme === 'dark') {
    document.body.classList.add('dark');
    if (btn) btn.innerHTML = '<i class="fa fa-sun"></i>';
  } else {
    document.body.classList.remove('dark');
    if (btn) btn.innerHTML = '<i class="fa fa-moon"></i>';
  }
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('uni_theme', state.theme);
  initTheme();
}

// ═══════════════════════════════
// LOAD DEPARTMENTS
// ═══════════════════════════════
async function loadDepartments() {
  try {
    const res  = await fetch('/api/departments');
    const data = await res.json();
    const sel  = document.getElementById('deptFilter');
    if (!sel) return;
    (data.departments || []).forEach(d => {
      const opt = document.createElement('option');
      opt.value       = d.name;
      opt.textContent = d.name;
      sel.appendChild(opt);
    });
  } catch(e) { console.error('Dept load error:', e); }
}

// ═══════════════════════════════
// LOAD STATS — FIXED field names
// ═══════════════════════════════
async function loadStats() {
  try {
    const res  = await fetch('/api/stats');
    const data = await res.json();

    // API returns: total, active, total_departments, batch_breakdown
    const total   = data.total             || 0;
    const active  = data.active            || 0;
    const depts   = data.total_departments || 0;
    const batches = Object.keys(data.batch_breakdown || {}).length;

    animateNumber('heroTotal',   total);
    animateNumber('heroActive',  active);
    animateNumber('heroDepts',   depts);
    animateNumber('heroBatches', batches);
  } catch(e) { console.error('Stats error:', e); }
}

function animateNumber(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let current = 0;
  const step  = Math.max(1, Math.ceil(target / 30));
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(timer);
  }, 40);
}

// ═══════════════════════════════
// SEARCH
// ═══════════════════════════════
async function search() {
  showLoading(true);
  const params = new URLSearchParams();
  if (state.query)          params.set('q',                  state.query);
  if (state.status)         params.set('enrollment_status',  state.status);
  if (state.department_name)params.set('department_name',    state.department_name);
  if (state.admission_year) params.set('admission_year',     state.admission_year);
  if (state.current_year)   params.set('current_year',       state.current_year);
  if (state.gender)         params.set('gender',             state.gender);
  params.set('page',     state.page);
  params.set('limit',    state.limit);
  params.set('sort_by',  state.sort_by);
  params.set('sort_dir', state.sort_dir);

  try {
    const res  = await fetch('/api/search?' + params.toString());
    const data = await res.json();
    state.total      = data.total      || 0;
    state.totalPages = data.totalPages || 1;
    renderResults(data.data || []);
    renderPagination();
    updateToolbar();
  } catch(e) {
    console.error('Search error:', e);
    showToast('Search failed. Please try again.', 'error');
  } finally {
    showLoading(false);
  }
}

// ═══════════════════════════════
// HELPERS
// ═══════════════════════════════
function getInitials(name) {
  if (!name) return '?';
  const p = name.trim().split(' ');
  return p.length >= 2
    ? p[0][0].toUpperCase() + p[1][0].toUpperCase()
    : p[0][0].toUpperCase();
}

function getBatchLabel(s) {
  if (!s.admission_year) return '—';
  return s.admission_year + '–' + (s.graduation_year || 'Enrolled');
}

function getAcademicLabel(s) {
  const stat = s.enrollment_status || 'active';
  const yr   = s.current_year;
  const sem  = s.current_semester;
  const sfx  = ['', 'st', 'nd', 'rd'];
  if (stat === 'graduated')   return 'Graduated ' + (s.graduation_year || '');
  if (stat === 'dropped')     return 'Left '      + (s.graduation_year || '');
  if (stat === 'transferred') return 'Transferred';
  if (stat === 'suspended')   return 'Suspended';
  return yr
    ? yr + (sfx[yr] || 'th') + ' Year' + (sem ? ' · Sem ' + sem : '')
    : '—';
}

function getStatusColors(status) {
  const map = {
    active:      ['#D1FAE5', '#065F46'],
    graduated:   ['#DBEAFE', '#1E40AF'],
    dropped:     ['#FEE2E2', '#991B1B'],
    suspended:   ['#FEF3C7', '#92400E'],
    transferred: ['#E0F2FE', '#075985'],
  };
  return map[status] || ['#F3F4F6', '#374151'];
}

// ═══════════════════════════════
// RENDER RESULTS
// ═══════════════════════════════
function renderResults(students) {
  const tbody = document.getElementById('tableBody');
  const grid  = document.getElementById('gridContainer');
  if (tbody) tbody.innerHTML = '';
  if (grid)  grid.innerHTML  = '';

  if (!students || students.length === 0) {
    showEmptyState();
    return;
  }

  const from = (state.page - 1) * state.limit;
  students.forEach((s, i) => {
    if (tbody) tbody.appendChild(buildTableRow(s, from + i + 1));
    if (grid)  grid.appendChild(buildGridCard(s));
  });
}

function buildTableRow(s, num) {
  const tr       = document.createElement('tr');
  const initials = getInitials(s.full_name);
  const batch    = getBatchLabel(s);
  const acad     = getAcademicLabel(s);
  const [bg, tc] = getStatusColors(s.enrollment_status);
  const stat     = s.enrollment_status || 'active';

  tr.style.cursor = 'pointer';
  tr.onclick = () => openModal(s.id);

  tr.innerHTML = `
    <td style="color:#9CA3AF;font-weight:700;
      text-align:center;padding:12px 8px;
      font-size:0.8rem">${num}</td>
    <td style="padding:10px 14px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;border-radius:50%;
          background:linear-gradient(135deg,#003087,#0055A4);
          color:white;display:flex;align-items:center;
          justify-content:center;font-size:0.72rem;
          font-weight:800;flex-shrink:0;letter-spacing:0.5px">
          ${initials}
        </div>
        <div style="min-width:0">
          <div style="font-weight:700;color:#003087;
            font-size:0.875rem;white-space:nowrap;
            overflow:hidden;text-overflow:ellipsis;
            max-width:200px">
            ${s.full_name || ''}
          </div>
          <div style="font-size:0.7rem;color:#9CA3AF;
            white-space:nowrap;overflow:hidden;
            text-overflow:ellipsis;max-width:200px">
            ${(s.email || '').toLowerCase()}
          </div>
        </div>
      </div>
    </td>
    <td style="padding:10px 14px">
      <code style="font-size:0.78rem;color:#374151;
        font-weight:700;background:#F3F4F6;
        border:1px solid #E5E7EB;padding:2px 8px;
        border-radius:4px;white-space:nowrap">
        ${s.student_id || ''}
      </code>
    </td>
    <td style="color:#374151;font-size:0.85rem;
      padding:10px 14px;white-space:nowrap">
      ${s.department_name || '—'}
    </td>
    <td style="padding:10px 14px">
      <span style="background:#EBF2FF;color:#003087;
        padding:3px 10px;border-radius:999px;
        font-size:0.7rem;font-weight:700;
        border:1px solid #C3D4F0;white-space:nowrap">
        ${batch}
      </span>
    </td>
    <td style="color:#374151;font-size:0.82rem;
      padding:10px 14px;white-space:nowrap">
      ${acad}
    </td>
    <td style="padding:10px 14px">
      <span style="background:${bg};color:${tc};
        padding:3px 10px;border-radius:999px;
        font-size:0.7rem;font-weight:700;
        white-space:nowrap">
        ${stat.charAt(0).toUpperCase() + stat.slice(1)}
      </span>
    </td>
    <td style="padding:10px 8px">
      <div style="display:flex;gap:5px"
           onclick="event.stopPropagation()">
        <button onclick="openModal('${s.id}')"
          title="View Details"
          style="width:30px;height:30px;border-radius:6px;
          background:#EBF2FF;color:#003087;
          border:1px solid #C3D4F0;cursor:pointer;
          font-size:0.8rem;display:flex;align-items:center;
          justify-content:center">
          <i class="fa fa-eye"></i>
        </button>
        <button onclick="copyToClipboard('${s.student_id}',this)"
          title="Copy ID"
          style="width:30px;height:30px;border-radius:6px;
          background:#EBF2FF;color:#003087;
          border:1px solid #C3D4F0;cursor:pointer;
          font-size:0.8rem;display:flex;align-items:center;
          justify-content:center">
          <i class="fa fa-copy"></i>
        </button>
      </div>
    </td>`;
  return tr;
}

function buildGridCard(s) {
  const div      = document.createElement('div');
  div.className  = 'student-card';
  div.onclick    = () => openModal(s.id);
  const initials = getInitials(s.full_name);
  const batch    = getBatchLabel(s);
  const [bg, tc] = getStatusColors(s.enrollment_status);
  const stat     = s.enrollment_status || 'active';
  const cgpa     = s.latest_cgpa || 0;

  div.innerHTML = `
    <div style="display:flex;justify-content:space-between;
      align-items:flex-start;margin-bottom:14px">
      <div style="width:46px;height:46px;border-radius:50%;
        background:linear-gradient(135deg,#003087,#0055A4);
        color:white;display:flex;align-items:center;
        justify-content:center;font-size:0.8rem;font-weight:800">
        ${initials}
      </div>
      <span style="background:${bg};color:${tc};
        padding:3px 10px;border-radius:999px;
        font-size:0.68rem;font-weight:700">
        ${stat.charAt(0).toUpperCase() + stat.slice(1)}
      </span>
    </div>
    <div style="font-weight:700;color:#003087;
      font-size:0.9rem;margin-bottom:2px;
      white-space:nowrap;overflow:hidden;
      text-overflow:ellipsis">
      ${s.full_name || ''}
    </div>
    <div style="font-size:0.7rem;color:#9CA3AF;
      font-weight:700;text-transform:uppercase;
      letter-spacing:0.06em;margin-bottom:12px">
      ${s.student_id || ''}
    </div>
    <div style="border-top:1px solid #F3F4F6;
      padding-top:12px;font-size:0.78rem">
      <div style="display:flex;justify-content:space-between;
        margin-bottom:6px">
        <span style="color:#9CA3AF;font-weight:600">Dept</span>
        <span style="color:#003087;font-weight:700;
          text-align:right;max-width:120px;
          overflow:hidden;text-overflow:ellipsis;
          white-space:nowrap">
          ${s.department_name || '—'}
        </span>
      </div>
      <div style="display:flex;justify-content:space-between;
        margin-bottom:8px">
        <span style="color:#9CA3AF;font-weight:600">Batch</span>
        <span style="background:#EBF2FF;color:#003087;
          padding:2px 8px;border-radius:999px;
          font-size:0.65rem;font-weight:700">
          ${batch}
        </span>
      </div>
      ${cgpa ? `
      <div style="height:4px;background:#E5E7EB;
        border-radius:2px;margin-top:6px">
        <div style="height:100%;width:${cgpa*10}%;
          background:linear-gradient(90deg,#003087,#F47920);
          border-radius:2px"></div>
      </div>
      <div style="font-size:0.68rem;color:#9CA3AF;
        margin-top:3px;text-align:right">
        CGPA: ${cgpa}
      </div>` : ''}
    </div>`;
  return div;
}

function showEmptyState() {
  const tbody = document.getElementById('tableBody');
  const grid  = document.getElementById('gridContainer');
  const html  = `
    <div style="text-align:center;padding:60px 20px">
      <img src="/assets/img/bamu-logo.png"
           style="height:60px;opacity:0.12;
           display:block;margin:0 auto 14px"
           onerror="this.style.display='none'">
      <div style="color:#9CA3AF;font-size:0.9rem;
        font-weight:600;margin-bottom:12px">
        No students found matching your search.
      </div>
      <button onclick="clearFilters()"
        style="padding:8px 20px;background:#003087;
        color:white;border:none;border-radius:8px;
        cursor:pointer;font-weight:600;font-size:0.85rem">
        Clear Filters
      </button>
    </div>`;
  if (tbody) tbody.innerHTML = `<tr><td colspan="8">${html}</td></tr>`;
  if (grid)  grid.innerHTML  = html;
}

// ═══════════════════════════════
// PAGINATION
// ═══════════════════════════════
function renderPagination() {
  const area = document.getElementById('pageBtns');
  if (!area) return;
  area.innerHTML = '';
  if (state.totalPages <= 1) return;

  for (let i = 1; i <= state.totalPages; i++) {
    if (i === 1 || i === state.totalPages
        || (i >= state.page - 2 && i <= state.page + 2)) {
      const btn = document.createElement('button');
      btn.className   = 'page-btn' + (i === state.page ? ' active' : '');
      btn.textContent = i;
      btn.onclick     = () => {
        state.page = i;
        search();
        window.scrollTo({ top: 400, behavior: 'smooth' });
      };
      area.appendChild(btn);
    } else if (i === state.page - 3 || i === state.page + 3) {
      const dot = document.createElement('span');
      dot.textContent = '…';
      dot.style.cssText = 'padding:0 6px;color:#9CA3AF';
      area.appendChild(dot);
    }
  }
}

function updateToolbar() {
  const from = state.total === 0 ? 0 : (state.page - 1) * state.limit + 1;
  const to   = Math.min(from + state.limit - 1, state.total);
  const setT = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
  setT('resultsFrom',  from);
  setT('resultsTo',    to);
  setT('resultsTotal', state.total);

  const clearBtn = document.getElementById('clearFiltersBtn');
  if (clearBtn) {
    const hasFilter = state.query || state.status || state.department_name
      || state.admission_year || state.current_year || state.gender;
    clearBtn.classList.toggle('hidden', !hasFilter);
  }
}

function changeLimit(val) {
  state.limit = parseInt(val);
  state.page  = 1;
  search();
}

function toggleSort(col) {
  if (state.sort_by === col) {
    state.sort_dir = state.sort_dir === 'asc' ? 'desc' : 'asc';
  } else {
    state.sort_by  = col;
    state.sort_dir = 'asc';
  }
  search();
}

// ═══════════════════════════════
// MODAL
// ═══════════════════════════════
async function openModal(id) {
  const modal = document.getElementById('studentModal');
  if (!modal) return;
  modal.style.display     = 'flex';
  document.body.style.overflow = 'hidden';
  setTab('overview');

  // Show loading state
  const nameEl = document.getElementById('modalName');
  if (nameEl) nameEl.textContent = 'Loading...';

  try {
    const res = await fetch('/api/student?id=' + id);
    const s   = await res.json();

    if (s.error) throw new Error(s.error);

    const avatarEl = document.getElementById('modalAvatar');
    const metaEl   = document.getElementById('modalMeta');
    const batch    = getBatchLabel(s);
    const [bg, tc] = getStatusColors(s.enrollment_status);
    const stat     = s.enrollment_status || 'active';

    if (avatarEl) avatarEl.textContent = getInitials(s.full_name);
    if (nameEl)   nameEl.textContent   = s.full_name || '';
    if (metaEl) {
      metaEl.innerHTML = `
        <span style="background:${bg};color:${tc};
          padding:3px 10px;border-radius:999px;
          font-size:0.72rem;font-weight:700">
          ${stat.charAt(0).toUpperCase()+stat.slice(1)}
        </span>
        <span style="background:rgba(255,255,255,0.15);
          color:rgba(255,255,255,0.9);padding:3px 10px;
          border-radius:999px;font-size:0.72rem;font-weight:700">
          ${batch}
        </span>
        <span style="color:rgba(255,255,255,0.6);
          font-size:0.72rem;font-weight:700;
          letter-spacing:0.08em">
          ${s.student_id || ''}
        </span>`;
    }

    renderOverviewTab(s);
    renderSemestersTab(s.semesters || []);
    renderContactTab(s);
  } catch(e) {
    showToast('Failed to load student details', 'error');
    closeModal();
  }
}

function renderOverviewTab(s) {
  const tab = document.getElementById('tabOverview');
  if (!tab) return;
  const batch = getBatchLabel(s);
  const acad  = getAcademicLabel(s);
  const cgpa  = s.latest_cgpa || 0;

  const field = (label, value, color='#003087') => `
    <div style="margin-bottom:16px">
      <div style="font-size:0.68rem;font-weight:700;
        color:#9CA3AF;text-transform:uppercase;
        letter-spacing:0.08em;margin-bottom:3px">
        ${label}
      </div>
      <div style="font-weight:700;color:${color};
        font-size:0.9rem">
        ${value || '—'}
      </div>
    </div>`;

  tab.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;
      gap:20px 32px;padding:4px 0">
      ${field('Full Name', s.full_name)}
      ${field('Student ID', `<code style="font-family:monospace;
        font-size:0.85rem;background:#F3F4F6;
        padding:2px 8px;border-radius:4px">${s.student_id||'—'}</code>`)}
      ${field('Department', s.department_name)}
      ${field('Gender / Blood Group',
        (s.gender||'—') + ' / ' + (s.blood_group||'—'))}
      ${field('Enrollment Status',
        `<span style="background:${getStatusColors(s.enrollment_status)[0]};
         color:${getStatusColors(s.enrollment_status)[1]};
         padding:2px 10px;border-radius:999px;
         font-size:0.75rem;font-weight:700">
         ${(s.enrollment_status||'active').charAt(0).toUpperCase()
           +(s.enrollment_status||'active').slice(1)}
         </span>`)}
      ${field('Batch / Academic Year', batch)}
      ${field('Current Study', acad)}
      ${field('Admission → Graduation',
        (s.admission_year||'—') + ' → ' + (s.graduation_year||'Ongoing'))}
      ${field('Date of Birth', s.date_of_birth||'—')}
      ${field('Account Number', s.account_number||'—')}
      ${field('Guardian',
        (s.guardian_name||'—') + '<br>'
        + `<span style="font-size:0.78rem;color:#9CA3AF">
            ${s.guardian_phone||''}</span>`)}
      <div style="margin-bottom:16px">
        <div style="font-size:0.68rem;font-weight:700;
          color:#9CA3AF;text-transform:uppercase;
          letter-spacing:0.08em;margin-bottom:6px">
          CGPA
        </div>
        <div style="font-size:1.6rem;font-weight:800;
          color:#10B981">${cgpa || '—'}
          <span style="font-size:0.75rem;color:#9CA3AF">/ 10.0</span>
        </div>
        ${cgpa ? `<div style="height:5px;background:#E5E7EB;
          border-radius:3px;margin-top:6px">
          <div style="height:100%;width:${cgpa*10}%;
            background:linear-gradient(90deg,#003087,#F47920);
            border-radius:3px;transition:width 1s ease"></div>
          </div>` : ''}
      </div>
    </div>`;
}

function renderSemestersTab(sems) {
  const tab = document.getElementById('tabSemesters');
  if (!tab) return;

  if (!sems || sems.length === 0) {
    tab.innerHTML = `
      <div style="text-align:center;padding:40px;
        color:#9CA3AF;font-size:0.85rem">
        No semester records found for this student.
      </div>`;
    return;
  }

  const colors = {
    pass:    ['#D1FAE5','#065F46'],
    fail:    ['#FEE2E2','#991B1B'],
    backlog: ['#FEF3C7','#92400E'],
    pending: ['#EBF2FF','#1E40AF'],
    promoted:['#D1FAE5','#065F46'],
    detained:['#FEE2E2','#991B1B'],
  };

  tab.innerHTML = `
    <div style="display:grid;
      grid-template-columns:repeat(auto-fill,minmax(150px,1fr));
      gap:12px">
      ${sems.map(sem => {
        const [bg, tc] = colors[sem.result] || colors.pending;
        return `
          <div style="background:#F8FAFF;
            border:1px solid #E5E7EB;
            border-left:4px solid ${tc};
            border-radius:10px;padding:14px">
            <div style="display:flex;justify-content:space-between;
              align-items:center;margin-bottom:10px">
              <span style="font-size:0.7rem;font-weight:800;
                color:#9CA3AF;text-transform:uppercase">
                Sem ${sem.semester_number}
              </span>
              <span style="background:${bg};color:${tc};
                padding:2px 7px;border-radius:999px;
                font-size:0.62rem;font-weight:700;
                text-transform:uppercase">
                ${sem.result || 'pending'}
              </span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;
              gap:8px;margin-bottom:8px">
              <div>
                <div style="font-size:0.6rem;color:#9CA3AF;
                  font-weight:700;text-transform:uppercase">SGPA</div>
                <div style="font-size:1.1rem;font-weight:800;
                  color:#003087">${sem.sgpa || '—'}</div>
              </div>
              <div>
                <div style="font-size:0.6rem;color:#9CA3AF;
                  font-weight:700;text-transform:uppercase">CGPA</div>
                <div style="font-size:1.1rem;font-weight:800;
                  color:#F47920">${sem.cgpa || '—'}</div>
              </div>
            </div>
            <div style="font-size:0.65rem;color:#9CA3AF;
              border-top:1px solid #E5E7EB;padding-top:7px;
              display:flex;justify-content:space-between">
              <span>${sem.academic_year || ''}</span>
              <span>${sem.attendance_pct || '—'}% Att</span>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

function renderContactTab(s) {
  const tab = document.getElementById('tabContact');
  if (!tab) return;

  const row = (icon, color, label, value) => `
    <div style="display:flex;align-items:center;gap:14px;
      padding:14px;background:#F8FAFF;border-radius:10px;
      margin-bottom:10px">
      <div style="width:40px;height:40px;border-radius:8px;
        background:${color};color:white;display:flex;
        align-items:center;justify-content:center;
        flex-shrink:0">
        <i class="fa ${icon}"></i>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:0.65rem;font-weight:700;
          color:#9CA3AF;text-transform:uppercase;
          letter-spacing:0.06em">${label}</div>
        <div style="font-weight:700;color:#003087;
          font-size:0.85rem;white-space:nowrap;
          overflow:hidden;text-overflow:ellipsis">
          ${value || '—'}
        </div>
      </div>
      <button onclick="copyToClipboard('${(value||'').replace(/'/g,"\\'")}',this)"
        style="width:28px;height:28px;border-radius:6px;
        background:#EBF2FF;color:#003087;border:none;
        cursor:pointer;font-size:0.75rem;flex-shrink:0">
        <i class="fa fa-copy"></i>
      </button>
    </div>`;

  tab.innerHTML = `
    ${row('fa-envelope', '#003087', 'Email Address',  s.email)}
    ${row('fa-phone',    '#0055A4', 'Phone Number',   s.phone_number)}
    ${row('fa-user',     '#F47920', 'Guardian Name',  s.guardian_name)}
    ${row('fa-phone',    '#10B981', 'Guardian Phone', s.guardian_phone)}
    ${row('fa-home',     '#6B7280', 'Address',        s.address)}
    ${row('fa-id-card',  '#8B5CF6', 'Account Number', s.account_number)}`;
}

function setTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active',
      b.textContent.toLowerCase().includes(name));
  });
  const tabs = ['overview', 'semesters', 'contact'];
  tabs.forEach(t => {
    const el = document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1));
    if (el) el.style.display = t === name ? 'block' : 'none';
  });
}

function closeModal() {
  const modal = document.getElementById('studentModal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = 'auto';
}

function handleBackdropClick(e) {
  if (e.target.id === 'studentModal') closeModal();
}

// ═══════════════════════════════
// FILTER HANDLERS
// ═══════════════════════════════
function setStatus(el, val) {
  document.querySelectorAll('[data-status]')
    .forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  state.status = val;
  state.page   = 1;
  search();
}

function setYear(el, val) {
  document.querySelectorAll('[data-year]')
    .forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  state.current_year = val;
  state.page         = 1;
  search();
}

function setGender(el, val) {
  document.querySelectorAll('[data-gender]')
    .forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  state.gender = val;
  state.page   = 1;
  search();
}

function setSort(val) {
  state.sort_by  = val;
  state.sort_dir = 'asc';
  state.page     = 1;
  search();
}

function clearFilters() {
  state.query = ''; state.status = '';
  state.department_name = ''; state.admission_year = '';
  state.current_year = ''; state.gender = '';
  state.page = 1;

  const si = document.getElementById('searchInput');
  const df = document.getElementById('deptFilter');
  const af = document.getElementById('admYearFilter');
  if (si) si.value = '';
  if (df) df.value = '';
  if (af) af.value = '';

  document.querySelectorAll('.status-pill').forEach(p =>
    p.classList.remove('active'));
  document.querySelector('[data-status=""]')?.classList.add('active');
  document.querySelector('[data-year=""]')?.classList.add('active');
  document.querySelector('[data-gender=""]')?.classList.add('active');

  search();
}

function quickSearch(term) {
  const si = document.getElementById('searchInput');
  if (si) si.value = term;
  state.query = term;
  state.page  = 1;
  search();
  window.scrollTo({ top: 400, behavior: 'smooth' });
}

function setView(v) {
  state.view = v;
  localStorage.setItem('uni_view', v);

  const tv  = document.getElementById('tableView');
  const gv  = document.getElementById('gridView');
  const tbn = document.getElementById('viewTableBtn');
  const gbn = document.getElementById('viewGridBtn');

  if (tv) tv.style.display = v === 'table' ? 'block' : 'none';
  if (gv) gv.style.display = v === 'grid'  ? 'block' : 'none';

  if (tbn) {
    tbn.style.background = v === 'table' ? '#003087' : '';
    tbn.style.color      = v === 'table' ? 'white'   : '';
  }
  if (gbn) {
    gbn.style.background = v === 'grid' ? '#003087' : '';
    gbn.style.color      = v === 'grid' ? 'white'   : '';
  }
}

// ═══════════════════════════════
// AUTOCOMPLETE
// ═══════════════════════════════
async function handleAutocomplete(q) {
  const dd = document.getElementById('autocompleteDropdown');
  if (!dd) return;
  if (q.length < 2) { dd.classList.add('hidden'); return; }

  try {
    const res  = await fetch('/api/autocomplete?q=' + encodeURIComponent(q));
    const data = await res.json();
    const list = data.suggestions || [];
    if (!list.length) { dd.classList.add('hidden'); return; }

    dd.innerHTML = list.map(s => `
      <div class="autocomplete-item"
           onclick="quickSearch('${s.replace(/'/g,"\\'")}');
           document.getElementById('autocompleteDropdown')
             .classList.add('hidden')">
        <i class="fa fa-search"
           style="color:#C3D4F0;font-size:0.75rem;margin-right:6px"></i>
        ${s}
      </div>`).join('');
    dd.classList.remove('hidden');
  } catch(e) {
    if (dd) dd.classList.add('hidden');
  }
}

// ═══════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════
function setupEventListeners() {
  const si = document.getElementById('searchInput');
  const df = document.getElementById('deptFilter');
  const af = document.getElementById('admYearFilter');

  if (si) {
    si.addEventListener('input', e => {
      state.query = e.target.value;
      state.page  = 1;
      clearTimeout(window._searchTimer);
      window._searchTimer = setTimeout(() => {
        search();
        handleAutocomplete(state.query);
      }, 350);
    });
    si.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const dd = document.getElementById('autocompleteDropdown');
        if (dd) dd.classList.add('hidden');
      }
    });
  }

  if (df) {
    df.onchange = e => {
      state.department_name = e.target.value;
      state.page = 1;
      search();
    };
  }

  if (af) {
    af.onchange = e => {
      state.admission_year = e.target.value;
      state.page = 1;
      search();
    };
  }

  // Close autocomplete on outside click
  document.addEventListener('click', e => {
    const dd = document.getElementById('autocompleteDropdown');
    const si = document.getElementById('searchInput');
    if (dd && si && !si.contains(e.target) && !dd.contains(e.target)) {
      dd.classList.add('hidden');
    }
  });
}

// ═══════════════════════════════
// UTILS
// ═══════════════════════════════
function showLoading(show) {
  const tbody = document.getElementById('tableBody');
  if (!show || !tbody) return;
  tbody.innerHTML = Array(5).fill(0).map(() => `
    <tr>
      ${Array(8).fill(0).map(() => `
        <td style="padding:14px">
          <div style="height:14px;background:linear-gradient(
            90deg,#E5E7EB 25%,#F3F4F6 50%,#E5E7EB 75%);
            background-size:200% 100%;border-radius:4px;
            animation:shimmer 1.5s infinite"></div>
        </td>`).join('')}
    </tr>`).join('');
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text || '').then(() => {
    showToast('Copied: ' + text, 'success');
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '<i class="fa fa-check"></i>';
      btn.style.background = '#D1FAE5';
      btn.style.color      = '#065F46';
      setTimeout(() => {
        btn.innerHTML = orig;
        btn.style.background = '';
        btn.style.color      = '';
      }, 1800);
    }
  }).catch(() => showToast('Copy failed', 'error'));
}

function showToast(msg, type='success') {
  const colors = {
    success: ['#003087','white'],
    error:   ['#EF4444','white'],
    info:    ['#F47920','white'],
  };
  const [bg, color] = colors[type] || colors.success;
  const icons = {
    success:'check-circle',
    error:'times-circle',
    info:'info-circle'
  };
  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:${bg};color:${color};
    padding:13px 18px;border-radius:10px;
    font-size:0.875rem;font-weight:600;
    box-shadow:0 8px 24px rgba(0,0,0,0.15);
    display:flex;align-items:center;gap:9px;
    max-width:340px;transition:opacity 0.4s;
    animation:fadeInUp 0.3s ease`;
  t.innerHTML = `<i class="fa fa-${icons[type]||'info-circle'}"></i> ${msg}`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; }, 3200);
  setTimeout(() => t.remove(), 3700);
}
