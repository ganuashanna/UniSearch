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
  document.querySelectorAll('.section')
    .forEach(s => s.classList.remove('active'));
  const el = document.getElementById('section_' + id);
  if (el) el.classList.add('active');

  document.querySelectorAll('.sidebar-nav a')
    .forEach(l => l.classList.remove('active'));
  const activeLink = document.querySelector(
    `.sidebar-nav a[data-section="${id}"]`);
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
  if (iconEl)  iconEl.innerHTML =
    `<i class="fa ${icons[id] || 'fa-circle'}"></i>`;
}

// ═══════════════════════════════
// DASHBOARD STATS
// ═══════════════════════════════
async function loadDashboardStats() {
  try {
    const res  = await fetch('/api/stats', {
      headers: { 'Authorization': 'Bearer ' + adminState.token }
    });
    const data = await res.json();

    const total     = data.total             || 0;
    const active    = data.active            || 0;
    const depts     = data.total_departments || 0;
    const avgCgpa   = data.avg_cgpa          || '—';
    const graduated = data.graduated         || 0;
    const dropped   = data.dropped           || 0;

    setEl('statTotalStudents',  total);
    setEl('statActiveStudents', active);
    setEl('statDepartments',    depts);
    setEl('statAvgCGPA',        avgCgpa);
    setEl('statGraduated',      graduated);
    setEl('statDropped',        dropped);

    renderBatchDistribution(data.batch_breakdown || {});
  } catch(e) {
    console.error('Stats error:', e);
    showToast('Failed to load stats', 'error');
  }
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderBatchDistribution(batches) {
  const container = document.getElementById('batchChart');
  if (!container) return;

  if (!batches || Object.keys(batches).length === 0) {
    container.innerHTML =
      '<div style="text-align:center;color:#9CA3AF;' +
      'padding:24px;font-size:0.8rem">No batch data available</div>';
    return;
  }

  const max = Math.max(...Object.values(batches));
  container.innerHTML = Object.entries(batches)
    .sort(([a],[b]) => b - a)
    .map(([year, count]) => {
      const pct = Math.round((count / max) * 100);
      return `
        <div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;
            font-size:0.78rem;font-weight:700;margin-bottom:5px">
            <span style="color:#003087">${year} Batch</span>
            <span style="color:#9CA3AF">${count} students</span>
          </div>
          <div style="height:8px;background:#F0F4FF;
            border-radius:4px;overflow:hidden;
            border:1px solid #E5E7EB">
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
  zone.ondragover  = e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  };
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
  if (preview) preview.style.display = 'block';

  setEl('previewFileName', file.name);
  setEl('previewFileSize',
    (file.size / 1024).toFixed(1) + ' KB · ' +
    new Date().toLocaleTimeString()
  );

  // Show CSV preview table
  if (ext === 'csv') {
    const reader = new FileReader();
    reader.onload = e => showPreviewTable(e.target.result);
    reader.readAsText(file);
  } else {
    // XLSX — show ready message
    const wrap = document.getElementById('previewTableWrap');
    if (wrap) wrap.innerHTML = `
      <div style="padding:20px;text-align:center;color:#9CA3AF;
        font-size:0.85rem">
        <i class="fa fa-file-excel"
           style="color:#10B981;font-size:2rem;
           display:block;margin-bottom:8px"></i>
        Excel file ready to import.<br>
        Click <strong style="color:#003087">Import Now</strong>
        to upload.
      </div>`;
  }

  // Reset progress
  const prog = document.getElementById('importProgress');
  if (prog) prog.style.display = 'none';
  const fill = document.getElementById('progressFill');
  if (fill) fill.style.width = '0%';
}

function showPreviewTable(csvText) {
  const wrap = document.getElementById('previewTableWrap');
  if (!wrap) return;

  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(l => l.trim());

  if (lines.length < 2) {
    wrap.innerHTML =
      '<div style="padding:12px;color:#EF4444;font-size:0.82rem">' +
      'File appears empty or has no data rows.</div>';
    return;
  }

  const headers  = lines[0].split(',')
    .map(h => h.replace(/"/g,'').trim());
  const dataRows = lines.slice(1, 6); // first 5 rows preview
  const total    = lines.length - 1;

  wrap.innerHTML = `
    <div style="padding:10px 14px;background:#EBF2FF;
      border-bottom:1px solid #C3D4F0;
      font-size:0.75rem;color:#003087;font-weight:700;
      display:flex;justify-content:space-between;
      align-items:center">
      <span>
        <i class="fa fa-eye" style="margin-right:5px"></i>
        Preview: first ${Math.min(dataRows.length, 5)}
        of <strong>${total}</strong> rows
      </span>
      <span style="color:#10B981;font-weight:700">
        <i class="fa fa-check-circle"></i>
        File looks good!
      </span>
    </div>
    <div style="overflow-x:auto">
      <table class="preview-table">
        <thead>
          <tr>
            ${headers.map(h =>
              `<th style="background:#003087;color:white;
                padding:8px 10px;text-align:left;
                font-size:0.68rem;font-weight:700;
                text-transform:uppercase;letter-spacing:0.06em;
                white-space:nowrap">${h}</th>`
            ).join('')}
          </tr>
        </thead>
        <tbody>
          ${dataRows.map((row, i) => {
            const cols = splitCSVLine(row);
            return `<tr style="background:${i%2===0?'white':'#F8FAFF'}">
              ${cols.map(c =>
                `<td style="padding:7px 10px;font-size:0.78rem;
                  color:#374151;border-bottom:1px solid #F3F4F6;
                  white-space:nowrap;max-width:150px;
                  overflow:hidden;text-overflow:ellipsis">
                  ${c || '—'}
                </td>`
              ).join('')}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// Simple CSV line splitter (client-side)
function splitCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      result.push(cur.replace(/"/g,'').trim());
      cur = '';
    } else { cur += c; }
  }
  result.push(cur.replace(/"/g,'').trim());
  return result;
}

function cancelImport() {
  activeImportFile = null;
  const preview = document.getElementById('filePreview');
  if (preview) preview.style.display = 'none';
  const input = document.getElementById('fileInput');
  if (input) input.value = '';
  const wrap = document.getElementById('previewTableWrap');
  if (wrap) wrap.innerHTML = '';
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

  if (btn) {
    btn.disabled = true;
    btn.innerHTML =
      '<i class="fa fa-spinner fa-spin"></i> Uploading...';
  }
  if (prog) prog.style.display = 'block';
  if (fill) fill.style.width   = '15%';
  if (lbl)  lbl.textContent    = 'Sending file to server...';

  const fd = new FormData();
  fd.append('file', activeImportFile);

  try {
    if (fill) fill.style.width = '40%';
    if (lbl)  lbl.textContent  = 'Processing rows...';

    const res = await fetch('/api/upload', {
      method:  'POST',
      headers: { 'Authorization': 'Bearer ' + adminState.token },
      body:    fd
    });

    if (fill) fill.style.width = '80%';

    const text = await res.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: 'Invalid server response: ' + text.slice(0,120) };
    }

    if (res.ok && data.success) {
      if (fill) fill.style.width = '100%';
      if (lbl)  lbl.textContent  =
        `✅ Done! ${data.imported} of ${data.total} students imported.` +
        (data.errors?.length ? ` ${data.errors.length} row errors.` : '');

      showToast(
        `${data.imported} students imported successfully!`,
        'success'
      );

      if (data.errors?.length) {
        console.warn('Import row errors:', data.errors);
        showToast(
          `${data.errors.length} rows had errors — check console`,
          'info'
        );
      }

      setTimeout(() => {
        loadDashboardStats();
        cancelImport();
      }, 2500);

    } else {
      throw new Error(
        data.error || `Server error ${res.status}`
      );
    }
  } catch(e) {
    if (fill) fill.style.width = '0%';
    if (lbl)  lbl.textContent  = 'Import failed. Try again.';
    if (prog) prog.style.display = 'none';
    showToast('Import failed: ' + e.message, 'error');
    console.error('Import error details:', e);
  } finally {
    if (btn) {
      btn.disabled  = false;
      btn.innerHTML =
        '<i class="fa fa-play"></i> Import Now';
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
    'Ganesh Shinde,CS2021001,ganesh.shinde@bamu.ac.in,' +
    '+91-9876543210,Computer Science,2021,,3,6,active,' +
    'Male,A+,2003-05-15,"Cidco Colony Aurangabad",' +
    'ACC12345,Mahesh Shinde,+91-9988776655',

    'Priya Patil,MBA2023015,priya.patil@bamu.ac.in,' +
    '+91-9000011111,MBA,2023,,1,2,active,Female,B+,' +
    '2002-11-20,"Jalna Road Aurangabad",' +
    'ACC67890,Rahul Patil,+91-9123456789',

    'Rahul Jadhav,ME2019301,rahul.jadhav@bamu.ac.in,' +
    '+91-9111122222,Mechanical Engineering,2019,2023,4,8,' +
    'graduated,Male,O+,2001-08-10,"Beed Aurangabad",' +
    'ACC11111,Vijay Jadhav,+91-9234567890'
  ];

  const csv  = headers + '\n' + examples.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'UniSearch_BAMU_Import_Template.csv';
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
  input.addEventListener('input', e => {
    clearTimeout(timer);
    const q = e.target.value.trim();
    if (q.length < 2) { dd.style.display = 'none'; return; }
    timer = setTimeout(() => fetchSuggestions(q, dd), 300);
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) &&
        !dd.contains(e.target)) {
      dd.style.display = 'none';
    }
  });
}

async function fetchSuggestions(q, dd) {
  try {
    const res  = await fetch(
      '/api/search?q=' + encodeURIComponent(q) + '&limit=8'
    );
    const data = await res.json();
    const list = data.data || [];

    if (!list.length) { dd.style.display = 'none'; return; }

    dd.innerHTML = list.map(s => `
      <div class="ac-item"
           onclick="loadStudentForAcademic('${s.id}')">
        <div style="width:30px;height:30px;border-radius:50%;
          background:#003087;color:white;
          display:flex;align-items:center;justify-content:center;
          font-size:0.7rem;font-weight:800;flex-shrink:0">
          ${(s.full_name||'?')[0].toUpperCase()}
        </div>
        <div>
          <div style="font-weight:700;color:#003087;
            font-size:0.85rem">${s.full_name}</div>
          <div style="font-size:0.68rem;color:#9CA3AF">
            ${s.student_id} · ${s.department_name || ''}
          </div>
        </div>
      </div>`).join('');

    dd.style.display = 'block';
  } catch(e) {
    dd.style.display = 'none';
  }
}

async function loadStudentForAcademic(id) {
  const dd    = document.getElementById('adminAutocomplete');
  const input = document.getElementById('studentSearchInput');
  if (dd)    dd.style.display = 'none';
  if (input) input.value      = '';

  try {
    const res = await fetch('/api/student?id=' + id);
    const s   = await res.json();
    adminState.activeStudent = s;

    const area = document.getElementById('manageStudentArea');
    if (area) area.style.display = 'block';

    setEl('asName', s.full_name);
    setEl('asID',   s.student_id);

    const av = document.getElementById('asAvatar');
    if (av) {
      av.textContent = (s.full_name || '?')
        .split(' ').map(n => n[0]).join('')
        .substring(0,2).toUpperCase();
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
        <i class="fa fa-inbox"
           style="font-size:1.5rem;display:block;
           margin-bottom:8px;opacity:0.4"></i>
        No semester records found for this student.
      </div>`;
    return;
  }

  const colors = {
    pass:     ['#D1FAE5','#065F46'],
    fail:     ['#FEE2E2','#991B1B'],
    backlog:  ['#FEF3C7','#92400E'],
    pending:  ['#EBF2FF','#1E40AF'],
    promoted: ['#D1FAE5','#065F46'],
    detained: ['#FEE2E2','#991B1B'],
  };

  grid.innerHTML = sems.map(sem => {
    const [bg, tc] = colors[sem.result] || colors.pending;
    const border   = {
      pass:'#10B981', fail:'#EF4444',
      backlog:'#F59E0B', pending:'#6366F1'
    }[sem.result] || '#6366F1';

    return `
      <div style="background:white;
        border:1px solid #E5E7EB;
        border-left:4px solid ${border};
        border-radius:10px;padding:14px">
        <div style="display:flex;justify-content:space-between;
          align-items:center;margin-bottom:10px">
          <span style="font-size:0.7rem;font-weight:800;
            color:#9CA3AF;text-transform:uppercase">
            Sem ${sem.semester_number}
          </span>
          <span style="background:${bg};color:${tc};
            padding:2px 8px;border-radius:999px;
            font-size:0.62rem;font-weight:700;
            text-transform:uppercase">
            ${sem.result || 'pending'}
          </span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;
          gap:8px;margin-bottom:10px">
          <div>
            <div style="font-size:0.6rem;color:#9CA3AF;
              font-weight:700;text-transform:uppercase">
              SGPA
            </div>
            <div style="font-size:1.2rem;font-weight:800;
              color:#003087">
              ${sem.sgpa || '—'}
            </div>
          </div>
          <div>
            <div style="font-size:0.6rem;color:#9CA3AF;
              font-weight:700;text-transform:uppercase">
              CGPA
            </div>
            <div style="font-size:1.2rem;font-weight:800;
              color:#F47920">
              ${sem.cgpa || '—'}
            </div>
          </div>
        </div>
        <div style="font-size:0.65rem;color:#9CA3AF;
          border-top:1px solid #F3F4F6;padding-top:7px;
          display:flex;justify-content:space-between">
          <span>${sem.academic_year || ''}</span>
          <span>${sem.attendance_pct || '—'}% Att.</span>
        </div>
      </div>`;
  }).join('');
}

function openAddSemModal() {
  const modal = document.getElementById('semModal');
  if (modal) modal.style.display = 'flex';
}

function closeSemModal() {
  const modal = document.getElementById('semModal');
  if (modal) modal.style.display = 'none';
}

// Semester form
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('semForm');
  if (!form) return;

  form.onsubmit = async e => {
    e.preventDefault();
    if (!adminState.activeStudent) return;

    const fd = new FormData(e.target);
    const body = {
      action: 'upsert_semester',
      data: {
        student_id:      adminState.activeStudent.id,
        semester_number: parseInt(fd.get('semester_number')),
        academic_year:   fd.get('academic_year'),
        sgpa:            parseFloat(fd.get('sgpa')) || null,
        cgpa:            parseFloat(fd.get('cgpa')) || null,
        attendance_pct:  parseFloat(fd.get('attendance_pct')) || null,
        result:          fd.get('result') || 'pending',
        backlogs:        parseInt(fd.get('backlogs'))  || 0,
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
        showToast('Semester saved successfully!', 'success');
        closeSemModal();
        form.reset();
        loadStudentForAcademic(adminState.activeStudent.id);
      } else {
        const d = await res.json();
        throw new Error(d.error || 'Save failed');
      }
    } catch(e) {
      showToast('Error: ' + e.message, 'error');
    }
  };
});

// ═══════════════════════════════
// TOAST
// ═══════════════════════════════
function showToast(msg, type = 'success') {
  const colors = {
    success: ['#003087', 'white'],
    error:   ['#EF4444', 'white'],
    info:    ['#F47920', 'white'],
  };
  const icons = {
    success: 'check-circle',
    error:   'times-circle',
    info:    'info-circle'
  };
  const [bg, color] = colors[type] || colors.success;

  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:${bg};color:${color};
    padding:13px 18px;border-radius:10px;
    font-size:0.875rem;font-weight:600;
    box-shadow:0 8px 24px rgba(0,0,0,0.15);
    display:flex;align-items:center;gap:9px;
    max-width:360px;
    animation:fadeInUp 0.3s ease;
    transition:opacity 0.4s;`;
  t.innerHTML =
    `<i class="fa fa-${icons[type]||'info-circle'}"></i> ${msg}`;
  document.body.appendChild(t);

  setTimeout(() => { t.style.opacity = '0'; }, 3500);
  setTimeout(() => t.remove(), 4000);
}
