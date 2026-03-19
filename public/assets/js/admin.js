const adminState = {
  token: localStorage.getItem('uni_admin_token'),
  activeSection: 'overview',
  activeStudent: null
};

document.addEventListener('DOMContentLoaded', () => {
  if (!adminState.token) {
    window.location.href = '/admin';
    return;
  }
  loadDashboardStats();
  setupUploadZone();
  setupAcademicSearch();
  const hash = window.location.hash.replace('#','');
  if (hash) switchSection(hash);
});

function logout() {
  localStorage.removeItem('uni_admin_token');
  window.location.href = '/admin';
}

// ═══════════════════════════════
// NAVIGATION
// ═══════════════════════════════
function switchSection(id) {
  adminState.activeSection = id;
  document.querySelectorAll('.section-content')
    .forEach(s => s.classList.add('hidden'));
  const el = document.getElementById('section_' + id);
  if (el) el.classList.remove('hidden');

  document.querySelectorAll('.sidebar-link')
    .forEach(l => l.classList.remove('active'));
  const activeLink = document.querySelector(
    `.sidebar-link[data-section="${id}"]`);
  if (activeLink) activeLink.classList.add('active');

  const titles = {
    overview: 'System Overview',
    import:   'Bulk Student Import',
    academic: 'Academic Records'
  };
  const icons = {
    overview: 'fa-chart-line',
    import:   'fa-file-import',
    academic: 'fa-graduation-cap'
  };
  const titleEl = document.getElementById('sectionTitle');
  const iconEl  = document.getElementById('sectionTitleIcon');
  if (titleEl) titleEl.textContent = titles[id] || id;
  if (iconEl)  iconEl.innerHTML = `<i class="fa ${icons[id]||'fa-circle'}"></i>`;
}

// ═══════════════════════════════
// DASHBOARD STATS
// ═══════════════════════════════
async function loadDashboardStats() {
  try {
    const res  = await fetch('/api/stats');
    const data = await res.json();

    // Map API fields correctly
    const total     = data.total              || 0;
    const active    = data.active             || 0;
    const depts     = data.total_departments  || 0;
    const avgCgpa   = data.avg_cgpa           || '—';
    const graduated = data.graduated          || 0;
    const dropped   = data.dropped            || 0;

    setEl('statTotalStudents',  total);
    setEl('statActiveStudents', active);
    setEl('statDepartments',    depts);
    setEl('statAvgCGPA',        avgCgpa);
    setEl('statGraduated',      graduated);
    setEl('statDropped',        dropped);

    renderBatchDistribution(data.batch_breakdown || {});
    animateCountUp();
  } catch(e) {
    console.error('Stats error:', e);
    showToast('Failed to load stats: ' + e.message, 'error');
  }
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function animateCountUp() {
  document.querySelectorAll('[data-countup]').forEach(el => {
    const target = parseInt(el.textContent) || 0;
    let current  = 0;
    const step   = Math.ceil(target / 40);
    const timer  = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current;
      if (current >= target) clearInterval(timer);
    }, 30);
  });
}

function renderBatchDistribution(batches) {
  const container = document.getElementById('batchChart');
  if (!container) return;
  if (!batches || Object.keys(batches).length === 0) {
    container.innerHTML =
      '<div style="text-align:center;color:#9CA3AF;padding:24px;font-size:0.8rem">No batch data</div>';
    return;
  }
  const max = Math.max(...Object.values(batches));
  container.innerHTML = Object.entries(batches)
    .sort(([a],[b]) => b - a)
    .map(([year, count]) => {
      const pct = Math.round((count / max) * 100);
      return `
        <div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;
            font-size:0.75rem;font-weight:700;margin-bottom:4px">
            <span style="color:#003087">${year} Batch</span>
            <span style="color:#9CA3AF">${count} students</span>
          </div>
          <div style="height:8px;background:#F0F4FF;
            border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${pct}%;
              background:linear-gradient(90deg,#003087,#F47920);
              border-radius:4px;
              transition:width 0.8s ease"></div>
          </div>
        </div>`;
    }).join('');
}

// ═══════════════════════════════
// FILE UPLOAD / IMPORT
// ═══════════════════════════════
let activeImportFile = null;

function setupUploadZone() {
  const zone  = document.getElementById('dropZone');
  const input = document.getElementById('fileInput');
  if (!zone || !input) return;

  input.onchange = e => handleFileSelection(e.target.files[0]);
  zone.onclick   = () => input.click();
  zone.ondragover  = e => { e.preventDefault(); zone.classList.add('drag-over'); };
  zone.ondragleave = () => zone.classList.remove('drag-over');
  zone.ondrop = e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handleFileSelection(e.dataTransfer.files[0]);
  };
}

function handleFileSelection(file) {
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['csv','xlsx','xls'].includes(ext)) {
    showToast('Only CSV, XLSX, XLS files allowed', 'error');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('File too large (max 10MB)', 'error');
    return;
  }
  activeImportFile = file;

  const preview = document.getElementById('filePreview');
  if (preview) preview.classList.remove('hidden');
  setEl('previewFileName', file.name);
  setEl('previewFileSize', (file.size / 1024).toFixed(1) + ' KB');

  const prog = document.getElementById('importProgress');
  if (prog) prog.classList.add('hidden');
  const fill = document.getElementById('progressFill');
  if (fill) fill.style.width = '0%';
}

async function doImport() {
  if (!activeImportFile) {
    showToast('Please select a file first', 'error');
    return;
  }

  const btn  = document.getElementById('importBtn');
  const fill = document.getElementById('progressFill');
  const lbl  = document.getElementById('progressLabel');
  const prog = document.getElementById('importProgress');

  if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }
  if (prog) prog.classList.remove('hidden');
  if (fill) fill.style.width = '30%';

  const fd = new FormData();
  fd.append('file', activeImportFile);

  try {
    const res  = await fetch('/api/upload', {
      method:  'POST',
      headers: { 'Authorization': 'Bearer ' + adminState.token },
      body:    fd
    });
    const data = await res.json();
    if (res.ok && data.success) {
      if (fill) fill.style.width = '100%';
      if (lbl)  lbl.textContent =
        `Done! ${data.imported} students imported.`;
      showToast(`${data.imported} records imported!`, 'success');
      setTimeout(loadDashboardStats, 1500);
    } else {
      throw new Error(data.error || 'Import failed');
    }
  } catch(e) {
    showToast('Import error: ' + e.message, 'error');
    if (fill) fill.style.width = '0%';
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Import Students';
    }
  }
}

function downloadTemplate() {
  const headers = [
    'full_name','student_id','email','phone_number',
    'department_name','admission_year','graduation_year',
    'current_year','current_semester','enrollment_status',
    'gender','blood_group','date_of_birth','address',
    'account_number','guardian_name','guardian_phone'
  ].join(',');

  const examples = [
    'Ganesh Shinde,CS2021001,ganesh.s@bamu.ac.in,+91-9876543210,Computer Science,2021,,3,6,active,Male,A+,2003-05-15,"Cidco Colony Aurangabad",ACC12345,Mahesh Shinde,+91-9988776655',
    'Priya Patil,MBA2023015,priya.p@bamu.ac.in,+91-9000011111,MBA,2023,,1,2,active,Female,B+,2002-11-20,"Jalna Road Aurangabad",ACC67890,Rahul Patil,+91-9123456789',
    'Rahul Jadhav,ME2019301,rahul.j@bamu.ac.in,+91-9111122222,Mechanical Engineering,2019,2023,4,8,graduated,Male,O+,2001-08-10,"Beed Aurangabad",ACC11111,Vijay Jadhav,+91-9234567890'
  ];

  const csv     = headers + '\n' + examples.join('\n');
  const blob    = new Blob([csv], { type: 'text/csv' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = 'UniSearch_BAMU_Template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Template downloaded!', 'success');
}

// ═══════════════════════════════
// ACADEMIC RECORDS
// ═══════════════════════════════
function setupAcademicSearch() {
  const input = document.getElementById('studentSearchInput');
  const dd    = document.getElementById('adminAutocomplete');
  if (!input || !dd) return;

  let timer;
  input.oninput = e => {
    clearTimeout(timer);
    const q = e.target.value.trim();
    if (q.length < 2) { dd.classList.add('hidden'); return; }
    timer = setTimeout(() => fetchStudentSuggestions(q, dd), 300);
  };

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !dd.contains(e.target))
      dd.classList.add('hidden');
  });
}

async function fetchStudentSuggestions(q, dd) {
  try {
    const res  = await fetch(
      '/api/search?q=' + encodeURIComponent(q) + '&limit=8');
    const data = await res.json();
    const list = data.data || [];
    if (!list.length) { dd.classList.add('hidden'); return; }

    dd.innerHTML = list.map(s => `
      <div class="autocomplete-item"
           onclick="loadStudentForAcademic('${s.id}')"
           style="display:flex;align-items:center;gap:10px;
           padding:10px 14px;cursor:pointer">
        <div style="width:32px;height:32px;border-radius:50%;
          background:#003087;color:white;
          display:flex;align-items:center;justify-content:center;
          font-size:0.72rem;font-weight:700;flex-shrink:0">
          ${(s.full_name||'?')[0].toUpperCase()}
        </div>
        <div>
          <div style="font-weight:700;color:#003087;font-size:0.85rem">
            ${s.full_name}
          </div>
          <div style="font-size:0.7rem;color:#9CA3AF">
            ${s.student_id} · ${s.department_name||''}
          </div>
        </div>
      </div>`).join('');
    dd.classList.remove('hidden');
  } catch(e) {
    dd.classList.add('hidden');
  }
}

async function loadStudentForAcademic(id) {
  const dd    = document.getElementById('adminAutocomplete');
  const input = document.getElementById('studentSearchInput');
  if (dd)    dd.classList.add('hidden');
  if (input) input.value = '';

  try {
    const res = await fetch('/api/student?id=' + id);
    const s   = await res.json();
    adminState.activeStudent = s;

    const area = document.getElementById('manageStudentArea');
    if (area) area.classList.remove('hidden');

    setEl('asName', s.full_name);
    setEl('asID',   s.student_id);
    const av = document.getElementById('asAvatar');
    if (av) {
      av.textContent = (s.full_name||'?')
        .split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
    }
    renderAcademicSems(s.semesters || []);
  } catch(e) {
    showToast('Failed to load student: ' + e.message, 'error');
  }
}

function renderAcademicSems(sems) {
  const grid = document.getElementById('asSemsGrid');
  if (!grid) return;

  if (!sems || sems.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;
        padding:32px;color:#9CA3AF;font-size:0.85rem">
        No semester records found.
      </div>`;
    return;
  }

  const colors = {
    pass:    ['#D1FAE5','#065F46'],
    fail:    ['#FEE2E2','#991B1B'],
    backlog: ['#FEF3C7','#92400E'],
    pending: ['#EBF2FF','#1E40AF'],
  };

  grid.innerHTML = sems.map(sem => {
    const [bg, tc] = colors[sem.result] || colors.pending;
    return `
      <div style="background:white;border:1px solid #E5E7EB;
        border-radius:10px;padding:16px;
        border-left:4px solid ${tc}">
        <div style="display:flex;justify-content:space-between;
          margin-bottom:10px">
          <span style="font-size:0.72rem;font-weight:700;
            color:#9CA3AF;text-transform:uppercase">
            Semester ${sem.semester_number}
          </span>
          <span style="background:${bg};color:${tc};
            padding:2px 8px;border-radius:999px;
            font-size:0.65rem;font-weight:700;
            text-transform:uppercase">
            ${sem.result || 'pending'}
          </span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div>
            <div style="font-size:0.65rem;color:#9CA3AF;
              text-transform:uppercase;font-weight:700">SGPA</div>
            <div style="font-size:1.2rem;font-weight:800;color:#003087">
              ${sem.sgpa || '—'}
            </div>
          </div>
          <div>
            <div style="font-size:0.65rem;color:#9CA3AF;
              text-transform:uppercase;font-weight:700">CGPA</div>
            <div style="font-size:1.2rem;font-weight:800;color:#F47920">
              ${sem.cgpa || '—'}
            </div>
          </div>
        </div>
        <div style="font-size:0.7rem;color:#9CA3AF;
          display:flex;justify-content:space-between;
          border-top:1px solid #F3F4F6;padding-top:8px">
          <span>${sem.academic_year || ''}</span>
          <span>${sem.attendance_pct || '—'}% Att.</span>
        </div>
      </div>`;
  }).join('');
}

function openAddSemModal() {
  const modal = document.getElementById('semModal');
  if (modal) modal.classList.remove('hidden');
}

function closeSemModal() {
  const modal = document.getElementById('semModal');
  if (modal) modal.classList.add('hidden');
}

// Semester form submit
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('semForm');
  if (!form) return;
  form.onsubmit = async e => {
    e.preventDefault();
    if (!adminState.activeStudent) return;

    const fd   = new FormData(e.target);
    const body = {
      action: 'upsert_semester',
      data: {
        student_id:      adminState.activeStudent.id,
        semester_number: parseInt(fd.get('semester_number')),
        academic_year:   fd.get('academic_year'),
        sgpa:            parseFloat(fd.get('sgpa')),
        cgpa:            parseFloat(fd.get('cgpa')),
        attendance_pct:  parseFloat(fd.get('attendance_pct')),
        result:          fd.get('result'),
        backlogs:        parseInt(fd.get('backlogs')) || 0,
        remarks:         fd.get('remarks') || '',
      }
    };

    try {
      const res = await fetch('/api/upload', {
        method:  'POST',
        headers: {
          'Authorization':  'Bearer ' + adminState.token,
          'Content-Type':   'application/json'
        },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        showToast('Semester saved!', 'success');
        closeSemModal();
        loadStudentForAcademic(adminState.activeStudent.id);
      } else {
        throw new Error('Save failed');
      }
    } catch(e) {
      showToast(e.message, 'error');
    }
  };
});

// ═══════════════════════════════
// TOAST NOTIFICATION
// ═══════════════════════════════
function showToast(msg, type = 'success') {
  const colors = {
    success: ['#003087','white'],
    error:   ['#EF4444','white'],
    info:    ['#F47920','white'],
  };
  const [bg, color] = colors[type] || colors.success;
  const icons = { success:'check-circle', error:'times-circle', info:'info-circle' };

  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:${bg};color:${color};
    padding:14px 20px;border-radius:10px;
    font-size:0.875rem;font-weight:600;
    box-shadow:0 8px 24px rgba(0,0,0,0.2);
    display:flex;align-items:center;gap:10px;
    max-width:360px;animation:fadeInUp 0.3s ease;
    transition:opacity 0.4s;
  `;
  t.innerHTML = `<i class="fa fa-${icons[type]||'info-circle'}"></i> ${msg}`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; }, 3500);
  setTimeout(() => t.remove(), 4000);
}
