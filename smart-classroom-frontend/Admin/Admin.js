/* ═══════════════════════════════════════════════════
   Smart Classroom Admin SPA — admin.js
   Single-file SPA router + all view renderers
═══════════════════════════════════════════════════ */

const API = 'http://localhost:8000/api';

/* ════════════════════════════════════════
   UTILITIES
════════════════════════════════════════ */
const $ = id => document.getElementById(id);

function toast(msg, type = 'success', icon = '') {
  const stack = $('toastStack');
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fas ${icon || icons[type]}"></i><span>${msg}</span>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 280);
  }, 3200);
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
}

function confirm_del(msg) {
  return new Promise(resolve => {
    App.openModal('Confirm Delete',
      `<p style="font-size:14px;color:#374151;">${msg}</p>`,
      `<button class="btn btn-ghost" onclick="App.closeModal();App._confirmResolve(false)">Cancel</button>
       <button class="btn btn-danger" onclick="App.closeModal();App._confirmResolve(true)">Delete</button>`
    );
    App._confirmResolve = resolve;
  });
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleString() : '—';
}

/* ════════════════════════════════════════
   APP CORE
════════════════════════════════════════ */
const App = {
  currentView: null,
  sidebarOpen: false,
  _confirmResolve: null,

  init() {
    // Nav click handlers
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => {
        this.navigate(el.dataset.view);
        if (window.innerWidth <= 768) this.toggleSidebar(false);
      });
    });

    // Load session
    const user = this.getSession();
    if (user.name)  { $('sidebarName').textContent = user.name;  $('userAvatar').textContent = user.name[0].toUpperCase(); }
    if (user.email) $('sidebarEmail').textContent = user.email;

    // Default view
    this.navigate('dashboard');
  },

  navigate(view) {
    this.currentView = view;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
    const titles = {
      dashboard: 'Dashboard', college: 'College Details', subjects: 'Manage Subjects',
      rules: 'Timetable Rules', generate: 'Generate Timetable',
      viewer: 'Timetable Viewer', attendance: 'Attendance', slotchange: 'Slot Changes',
      profile: 'My Profile',
      students: 'Students', teachers: 'Teachers', depts: 'Departments', classes_list: 'Classes',
    };
    $('topbarTitle').textContent = titles[view] || view;
    const vc = $('viewContainer');
    vc.innerHTML = '<div class="page-loading"><div class="loader-ring"></div></div>';
    // Small delay to show loading state
    setTimeout(() => Views[view] ? Views[view](vc) : (vc.innerHTML = '<p>View not found</p>'), 60);
  },

  toggleSidebar(force) {
    const s = $('sidebar');
    this.sidebarOpen = force !== undefined ? force : !this.sidebarOpen;
    s.classList.toggle('open', this.sidebarOpen);
  },

  openModal(title, body, footer = '') {
    $('modalHeader').innerHTML = title;
    $('modalBody').innerHTML   = body;
    $('modalFooter').innerHTML = footer;
    $('modalOverlay').classList.add('open');
    // Prevent outer click from closing when clicking inside
    $('modalBox').onclick = e => e.stopPropagation();
  },

  closeModal() {
    $('modalOverlay').classList.remove('open');
  },

  getSession() {
    try { return JSON.parse(sessionStorage.getItem('user') || '{}'); }
    catch { return {}; }
  },

  logout() {
    sessionStorage.removeItem('user');
    window.location.href = '../login.html';
  },
};

/* ════════════════════════════════════════
   VIEWS
════════════════════════════════════════ */
const Views = {};

/* ─────────────────────────────
   DASHBOARD
───────────────────────────── */
Views.dashboard = async (vc) => {
  const statsMeta = [
    { label:'Students',    icon:'fa-user-graduate',     color:'blue',   view:'students'   },
    { label:'Teachers',    icon:'fa-chalkboard-teacher',color:'green',  view:'teachers'   },
    { label:'Departments', icon:'fa-layer-group',        color:'amber',  view:'depts'      },
    { label:'Classes',     icon:'fa-users',              color:'teal',   view:'classes_list'},
    { label:'Timetables',  icon:'fa-calendar-alt',       color:'purple', view:'viewer'     },
    { label:'Subjects',    icon:'fa-book',               color:'red',    view:'subjects'   },
  ];

  vc.innerHTML = `
    <div class="page-hdr anim"><h1>Dashboard</h1><p>System overview — live from the database.</p></div>
    <div class="stats-grid" id="statsGrid">
      ${statsMeta.map((s,i) => `
        <div class="stat-card stat-card-link anim anim-d${Math.min(i,3)}"
             onclick="App.navigate('${s.view}')" title="View ${s.label}">
          <div class="stat-icon ${s.color}">
            <i class="fas ${s.icon}"></i>
          </div>
          <div>
            <div class="stat-val" id="stat${i}">—</div>
            <div class="stat-lbl">${s.label}</div>
          </div>
          <i class="fas fa-chevron-right stat-arrow"></i>
        </div>`).join('')}
    </div>
    <div class="card anim anim-d2">
      <div class="card-title"><i class="fas fa-rocket"></i> Quick Actions</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="App.navigate('generate')"><i class="fas fa-magic"></i> Generate Timetable</button>
        <button class="btn btn-ghost"   onclick="App.navigate('college')"><i class="fas fa-building"></i> Edit College</button>
        <button class="btn btn-ghost"   onclick="App.navigate('subjects')"><i class="fas fa-book-open"></i> Manage Subjects</button>
        <button class="btn btn-ghost"   onclick="App.navigate('viewer')"><i class="fas fa-table"></i> View Timetables</button>
      </div>
    </div>`;

  try {
    const [students, teachers, depts, classes, timetables, subjects] = await Promise.all([
      api('/students'), api('/teachers'), api('/departments'),
      api('/classes'), api('/timetables'),
      fetch(`${API}/subjects`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]);
    [$('stat0'),$('stat1'),$('stat2'),$('stat3'),$('stat4'),$('stat5')].forEach((el, i) => {
      if (el) el.textContent = [students,teachers,depts,classes,timetables,subjects][i].length;
    });
  } catch(e) { toast('Could not load stats', 'error'); }
};

/* ─────────────────────────────
   COLLEGE DETAILS
───────────────────────────── */
Views.college = async (vc) => {
  vc.innerHTML = `
    <div class="page-hdr anim"><h1>College Details</h1><p>Manage college info, departments, teachers and classes.</p></div>

    <!-- College Info -->
    <div class="card anim">
      <div class="card-title"><i class="fas fa-building"></i> College Info</div>
      <div class="form-grid" id="collegeForm">
        <div class="fg"><label>College Name</label><input id="cName" disabled></div>
        <div class="fg"><label>Email</label><input id="cEmail" disabled></div>
        <div class="fg"><label>Phone</label><input id="cPhone" disabled></div>
        <div class="fg"><label>Address</label><input id="cAddress" disabled></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="cEditBtn" onclick="College.edit()"><i class="fas fa-edit"></i> Edit</button>
        <button class="btn btn-ghost"   id="cSaveBtn" style="display:none" onclick="College.save()"><i class="fas fa-save"></i> Save</button>
        <button class="btn btn-danger"  onclick="College.del()"><i class="fas fa-trash"></i> Delete</button>
      </div>
    </div>

    <!-- Departments -->
    <div class="card anim anim-d1">
      <div class="card-title"><i class="fas fa-layer-group"></i> Departments</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Actions</th></tr></thead><tbody id="deptBody"></tbody></table></div>
      <div style="display:flex;gap:10px;margin-top:14px;">
        <div class="fg" style="flex:1;margin:0;"><input id="deptInput" placeholder="New department name" onkeydown="if(event.key==='Enter')College.addDept()"></div>
        <button class="btn btn-primary" onclick="College.addDept()"><i class="fas fa-plus"></i> Add</button>
      </div>
    </div>

    <!-- Teachers -->
    <div class="card anim anim-d2">
      <div class="card-title"><i class="fas fa-chalkboard-teacher"></i> Teachers</div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Subjects</th><th>Role</th><th>Actions</th></tr></thead>
          <tbody id="teacherBody"></tbody>
        </table>
      </div>
      <div class="divider"></div>
      <div style="font-size:13px;font-weight:600;margin-bottom:10px;" id="tFormTitle">Add Teacher</div>
      <div class="form-grid">
        <div class="fg"><label>Name</label><input id="tName" placeholder="Full name"></div>
        <div class="fg"><label>Email</label><input id="tEmail" placeholder="Email address"></div>
        <div class="fg"><label>Department</label><input id="tDept" placeholder="Department"></div>
        <div class="fg"><label>Subjects (comma-separated)</label><input id="tSubjects" placeholder="Maths, Physics"></div>
        <div class="fg"><label>Qualifications</label><input id="tQual" placeholder="M.Tech, PhD…"></div>
        <div class="fg"><label>Role</label><input id="tRole" placeholder="HOD, Lecturer…"></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="College.submitTeacher()"><i class="fas fa-save"></i> <span id="tBtnLabel">Add Teacher</span></button>
        <button class="btn btn-ghost" id="tCancelBtn" style="display:none" onclick="College.cancelTeacher()">Cancel</button>
      </div>
    </div>

    <!-- Classes -->
    <div class="card anim anim-d3">
      <div class="card-title"><i class="fas fa-users"></i> Classes / Sections</div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th>Class ID</th><th>Dept</th><th>Acad Year</th><th>Year</th><th>Sem</th><th>Section</th><th>Strength</th><th>Actions</th></tr></thead>
          <tbody id="classBody"></tbody>
        </table>
      </div>
      <div class="divider"></div>
      <div style="font-size:13px;font-weight:600;margin-bottom:10px;" id="clFormTitle">Add Class</div>
      <div class="form-grid">
        <div class="fg"><label>Department</label><select id="clDept"><option value="">Select dept</option></select></div>
        <div class="fg"><label>Academic Year</label><input id="clAcYear" placeholder="2025-2026"></div>
        <div class="fg"><label>Year (1-4)</label><input id="clYear" type="number" min="1" max="4" placeholder="1"></div>
        <div class="fg"><label>Semester (1-8)</label><input id="clSem" type="number" min="1" max="8" placeholder="1"></div>
        <div class="fg"><label>Section</label><input id="clSection" placeholder="A"></div>
        <div class="fg"><label>Strength</label><input id="clStrength" type="number" min="1" placeholder="60"></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="College.submitClass()"><i class="fas fa-save"></i> <span id="clBtnLabel">Add Class</span></button>
        <button class="btn btn-ghost" id="clCancelBtn" style="display:none" onclick="College.cancelClass()">Cancel</button>
      </div>
    </div>`;

  await College.loadAll();
};

const College = {
  editingTeacherId: null,
  editingClassId: null,

  async loadAll() {
    await Promise.all([this.loadCollege(), this.loadDepts(), this.loadTeachers(), this.loadClasses()]);
  },

  async loadCollege() {
    try {
      const d = await api('/college');
      $('cName').value    = d.name    || '';
      $('cEmail').value   = d.email   || '';
      $('cPhone').value   = d.phone   || '';
      $('cAddress').value = d.address || '';
    } catch {}
  },

  edit() {
    ['cName','cEmail','cPhone','cAddress'].forEach(id => $(id).disabled = false);
    $('cEditBtn').style.display = 'none';
    $('cSaveBtn').style.display = '';
  },

  async save() {
    try {
      await api('/college', { method:'POST', body:{ name:$('cName').value, email:$('cEmail').value, phone:$('cPhone').value, address:$('cAddress').value }});
      ['cName','cEmail','cPhone','cAddress'].forEach(id => $(id).disabled = true);
      $('cEditBtn').style.display = '';
      $('cSaveBtn').style.display = 'none';
      toast('College saved');
    } catch(e) { toast(e.message, 'error'); }
  },

  async del() {
    const ok = await confirm_del('Delete all college details? This cannot be undone.');
    if (!ok) return;
    try { await api('/college', {method:'DELETE'}); toast('Deleted'); this.loadCollege(); }
    catch(e) { toast(e.message,'error'); }
  },

  async loadDepts() {
    try {
      const depts = await api('/departments');
      const tbody = $('deptBody');
      if (!tbody) return;
      tbody.innerHTML = depts.length
        ? depts.map(d => `<tr>
            <td>${d.name}</td>
            <td><button class="act-btn act-del" onclick="College.delDept('${d._id}')">Delete</button></td>
          </tr>`).join('')
        : `<tr><td colspan="2" class="tbl-empty">No departments yet</td></tr>`;
      // Refresh class dept dropdown
      const sel = $('clDept');
      if (sel) {
        sel.innerHTML = '<option value="">Select dept</option>';
        depts.forEach(d => sel.innerHTML += `<option value="${d.name}">${d.name}</option>`);
      }
    } catch {}
  },

  async addDept() {
    const name = $('deptInput').value.trim();
    if (!name) return toast('Enter a name', 'error');
    try { await api('/departments', {method:'POST', body:{name}}); $('deptInput').value=''; toast('Department added'); this.loadDepts(); }
    catch(e) { toast(e.message,'error'); }
  },

  async delDept(id) {
    const ok = await confirm_del('Delete this department?');
    if (!ok) return;
    try { await api(`/departments/${id}`, {method:'DELETE'}); toast('Deleted'); this.loadDepts(); }
    catch(e) { toast(e.message,'error'); }
  },

  async loadTeachers() {
    try {
      const data = await api('/teachers');
      const tbody = $('teacherBody');
      if (!tbody) return;
      tbody.innerHTML = data.length
        ? data.map(t => `<tr>
            <td>${t.name}</td><td style="font-size:12px;color:var(--muted)">${t.email}</td>
            <td>${t.department||''}</td><td>${(t.subjects||[]).join(', ')||'—'}</td><td>${t.role||'—'}</td>
            <td>
              <button class="act-btn act-edit" onclick='College.editTeacher(${JSON.stringify(t).replace(/'/g,"&#39;")})'>Edit</button>
              <button class="act-btn act-del"  onclick="College.delTeacher('${t._id}')">Delete</button>
            </td>
          </tr>`).join('')
        : `<tr><td colspan="6" class="tbl-empty">No teachers yet</td></tr>`;
    } catch {}
  },

  editTeacher(t) {
    this.editingTeacherId = t._id;
    $('tName').value     = t.name;
    $('tEmail').value    = t.email;
    $('tDept').value     = t.department || '';
    $('tSubjects').value = (t.subjects||[]).join(', ');
    $('tQual').value     = t.qualifications || '';
    $('tRole').value     = t.role || '';
    $('tBtnLabel').textContent = 'Update Teacher';
    $('tCancelBtn').style.display = '';
    $('tFormTitle').textContent = 'Edit Teacher';
    $('tName').scrollIntoView({behavior:'smooth', block:'center'});
  },

  cancelTeacher() {
    this.editingTeacherId = null;
    ['tName','tEmail','tDept','tSubjects','tQual','tRole'].forEach(id => $(id).value = '');
    $('tBtnLabel').textContent = 'Add Teacher';
    $('tCancelBtn').style.display = 'none';
    $('tFormTitle').textContent = 'Add Teacher';
  },

  async submitTeacher() {
    const body = {
      name: $('tName').value.trim(), email: $('tEmail').value.trim(),
      department: $('tDept').value.trim(),
      subjects: $('tSubjects').value.split(',').map(s=>s.trim()).filter(Boolean),
      qualifications: $('tQual').value.trim(), role: $('tRole').value.trim(),
    };
    if (!body.name || !body.email) return toast('Name and email are required','error');
    try {
      const url = this.editingTeacherId ? `/teachers/${this.editingTeacherId}` : '/teachers';
      await api(url, {method: this.editingTeacherId ? 'PUT':'POST', body});
      toast(this.editingTeacherId ? 'Teacher updated' : 'Teacher added');
      this.cancelTeacher(); this.loadTeachers();
    } catch(e) { toast(e.message,'error'); }
  },

  async delTeacher(id) {
    const ok = await confirm_del('Delete this teacher?');
    if (!ok) return;
    try { await api(`/teachers/${id}`, {method:'DELETE'}); toast('Deleted'); this.loadTeachers(); }
    catch(e) { toast(e.message,'error'); }
  },

  async loadClasses() {
    try {
      const data = await api('/classes');
      const tbody = $('classBody');
      if (!tbody) return;
      tbody.innerHTML = data.length
        ? data.map(c => `<tr>
            <td><span class="badge badge-blue">${c.classId}</span></td>
            <td>${c.department}</td><td>${c.academicYear}</td>
            <td>${c.year}</td><td>${c.semester}</td><td>${c.section}</td><td>${c.strength}</td>
            <td>
              <button class="act-btn act-edit" onclick='College.editClass(${JSON.stringify(c).replace(/'/g,"&#39;")})'>Edit</button>
              <button class="act-btn act-del"  onclick="College.delClass('${c.classId}')">Delete</button>
            </td>
          </tr>`).join('')
        : `<tr><td colspan="8" class="tbl-empty">No classes yet</td></tr>`;
    } catch {}
  },

  editClass(c) {
    this.editingClassId = c.classId;
    $('clDept').value     = c.department;
    $('clAcYear').value   = c.academicYear;
    $('clYear').value     = c.year;
    $('clSem').value      = c.semester;
    $('clSection').value  = c.section;
    $('clStrength').value = c.strength;
    $('clBtnLabel').textContent = 'Update Class';
    $('clCancelBtn').style.display = '';
    $('clFormTitle').textContent = 'Edit Class';
    $('clDept').scrollIntoView({behavior:'smooth', block:'center'});
  },

  cancelClass() {
    this.editingClassId = null;
    ['clDept','clAcYear','clYear','clSem','clSection','clStrength'].forEach(id => $(id).value='');
    $('clBtnLabel').textContent = 'Add Class';
    $('clCancelBtn').style.display = 'none';
    $('clFormTitle').textContent = 'Add Class';
  },

  async submitClass() {
    const body = {
      department: $('clDept').value, academicYear: $('clAcYear').value.trim(),
      year: parseInt($('clYear').value), semester: parseInt($('clSem').value),
      section: $('clSection').value.trim().toUpperCase(), strength: parseInt($('clStrength').value),
    };
    if (!body.department || !body.academicYear || !body.year || !body.semester || !body.section || !body.strength)
      return toast('All fields are required','error');
    try {
      const url = this.editingClassId ? `/classes/${this.editingClassId}` : '/classes';
      await api(url, {method: this.editingClassId ? 'PUT':'POST', body});
      toast(this.editingClassId ? 'Class updated' : 'Class added');
      this.cancelClass(); this.loadClasses();
    } catch(e) { toast(e.message,'error'); }
  },

  async delClass(id) {
    const ok = await confirm_del(`Delete class ${id}?`);
    if (!ok) return;
    try { await api(`/classes/${id}`, {method:'DELETE'}); toast('Deleted'); this.loadClasses(); }
    catch(e) { toast(e.message,'error'); }
  },
};

/* ─────────────────────────────
   SUBJECTS
───────────────────────────── */
Views.subjects = async (vc) => {
  vc.innerHTML = `
    <div class="page-hdr anim"><h1>Manage Subjects</h1><p>Add subjects and assign faculty per class.</p></div>
    <div class="card anim">
      <div class="card-title"><i class="fas fa-book-open"></i> Subject Form</div>
      <div class="form-grid">
        <div class="fg"><label>Class</label><select id="sjClass"><option value="">Loading…</option></select></div>
        <div class="fg"><label>Subject Name</label><input id="sjName" placeholder="e.g. Engineering Maths"></div>
        <div class="fg"><label>Faculty</label><input id="sjFaculty" placeholder="Dr. Ravi Kumar"></div>
        <div class="fg"><label>Hours / Week</label><input id="sjHours" type="number" min="1" max="10" placeholder="4"></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="Subjects.submit()"><i class="fas fa-save"></i> <span id="sjBtnLabel">Add Subject</span></button>
        <button class="btn btn-ghost" id="sjCancelBtn" style="display:none" onclick="Subjects.cancel()">Cancel</button>
      </div>
    </div>
    <div class="card anim anim-d1">
      <div class="card-title"><i class="fas fa-list"></i> Subjects for selected class</div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th>Subject</th><th>Faculty</th><th>Hours/Week</th><th>Actions</th></tr></thead>
          <tbody id="sjBody"><tr><td colspan="4" class="tbl-empty">Select a class above</td></tr></tbody>
        </table>
      </div>
    </div>`;

  await Subjects.init();
};

const Subjects = {
  editingId: null,
  cache: [],

  async init() {
    const sel = $('sjClass');
    try {
      const classes = await api('/classes');
      sel.innerHTML = '<option value="">Choose a class</option>';
      classes.forEach(c => sel.innerHTML += `<option value="${c.classId}">${c.classId}</option>`);
    } catch { sel.innerHTML = '<option value="">Could not load</option>'; }
    sel.onchange = () => this.load();
  },

  async load() {
    const classId = $('sjClass').value;
    const tbody = $('sjBody');
    if (!classId) { tbody.innerHTML = '<tr><td colspan="4" class="tbl-empty">Select a class above</td></tr>'; return; }
    try {
      const data = await fetch(`${API}/subjects/${encodeURIComponent(classId)}`).then(r => r.json());
      this.cache = data;
      tbody.innerHTML = data.length
        ? data.map(s => `<tr>
            <td><strong>${s.subject}</strong></td>
            <td>${s.faculty}</td>
            <td><span class="badge badge-blue">${s.hours_per_week}h</span></td>
            <td>
              <button class="act-btn act-edit" onclick="Subjects.edit('${s._id}')">Edit</button>
              <button class="act-btn act-del"  onclick="Subjects.del('${s._id}')">Delete</button>
            </td>
          </tr>`).join('')
        : '<tr><td colspan="4" class="tbl-empty">No subjects yet. Add one above.</td></tr>';
    } catch { toast('Could not load subjects','error'); }
  },

  edit(id) {
    const s = this.cache.find(x => x._id === id);
    if (!s) return;
    this.editingId = id;
    $('sjName').value    = s.subject;
    $('sjFaculty').value = s.faculty;
    $('sjHours').value   = s.hours_per_week;
    $('sjBtnLabel').textContent = 'Update Subject';
    $('sjCancelBtn').style.display = '';
    $('sjName').scrollIntoView({behavior:'smooth', block:'center'});
  },

  cancel() {
    this.editingId = null;
    $('sjName').value = ''; $('sjFaculty').value = ''; $('sjHours').value = '';
    $('sjBtnLabel').textContent = 'Add Subject';
    $('sjCancelBtn').style.display = 'none';
  },

  async submit() {
    const classId = $('sjClass').value;
    const body = { classId, subject: $('sjName').value.trim(), faculty: $('sjFaculty').value.trim(), hours_per_week: parseInt($('sjHours').value) };
    if (!classId || !body.subject || !body.faculty || !body.hours_per_week)
      return toast('All fields are required','error');
    try {
      const url = this.editingId ? `/subjects/${this.editingId}` : '/subjects';
      await api(url, {method: this.editingId ? 'PUT':'POST', body});
      toast(this.editingId ? 'Updated' : 'Subject added');
      this.cancel(); this.load();
    } catch(e) { toast(e.message,'error'); }
  },

  async del(id) {
    const ok = await confirm_del('Delete this subject?');
    if (!ok) return;
    try { await api(`/subjects/${id}`, {method:'DELETE'}); toast('Deleted'); this.load(); }
    catch(e) { toast(e.message,'error'); }
  },
};

/* ─────────────────────────────
   TIMETABLE RULES
───────────────────────────── */
Views.rules = async (vc) => {
  vc.innerHTML = `
    <div class="page-hdr anim"><h1>Timetable Rules</h1><p>Configure scheduling constraints per class.</p></div>
    <div class="card anim">
      <div class="card-title"><i class="fas fa-sliders-h"></i> Configure Rules</div>
      <div class="form-grid">
        <div class="fg"><label>Class</label><select id="rlClass"><option value="">Select class</option></select></div>
        <div class="fg"><label>Periods / Day</label><input id="rlPeriods" type="number" min="1" max="10" value="6"></div>
        <div class="fg"><label>Period Duration (min)</label><input id="rlDuration" type="number" value="60" min="30" max="120"></div>
        <div class="fg"><label>Max Same Subject / Day</label><input id="rlMaxSame" type="number" value="1" min="1" max="3"></div>
        <div class="fg"><label>Lunch Start</label><input id="rlLunchS" type="time" value="12:30"></div>
        <div class="fg"><label>Lunch End</label><input id="rlLunchE" type="time" value="13:30"></div>
      </div>
      <div class="form-group" style="margin-top:14px;">
        <div class="fg"><label>Working Days</label></div>
        <div class="check-group" id="rlDays">
          ${['Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `
            <label class="check-item"><input type="checkbox" value="${d}" ${d!=='Sat'?'checked':''}> ${d}</label>`).join('')}
        </div>
      </div>
      <div class="form-group" style="margin-top:14px;">
        <label class="check-item"><input type="checkbox" id="rlNoClash" checked> &nbsp;No Faculty Clash Allowed</label>
      </div>
      <div class="divider"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div class="fg" style="margin:0;"><label>Number of Subjects: <strong id="rlNumLbl">5</strong></label></div>
        <input type="range" id="rlNumSubj" min="1" max="20" value="5" style="width:160px;accent-color:var(--accent)" oninput="Rules.buildSubjectInputs(this.value)">
      </div>
      <div id="rlSubjInputs" class="subj-inputs"></div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="Rules.save()"><i class="fas fa-save"></i> Save Rules</button>
      </div>
    </div>
    <div id="rlList" style="margin-top:4px;"></div>`;

  await Rules.init();
};

const Rules = {
  subjRefs: [],

  async init() {
    const sel = $('rlClass');
    try {
      const classes = await api('/classes');
      sel.innerHTML = '<option value="">Select class</option>';
      classes.forEach(c => sel.innerHTML += `<option value="${c.classId}">${c.classId}</option>`);
    } catch {}
    sel.onchange = () => this.loadExisting();
    this.buildSubjectInputs(5);
    await this.loadAllRules();
  },

  buildSubjectInputs(n) {
    n = parseInt(n);
    $('rlNumLbl').textContent = n;
    const prev = this.subjRefs.map(i => i.value);
    const container = $('rlSubjInputs');
    container.innerHTML = '';
    this.subjRefs = [];
    for (let i = 0; i < n; i++) {
      const row = document.createElement('div');
      row.className = 'subj-row';
      const inp = document.createElement('input');
      inp.placeholder = `Subject ${i+1} name`;
      inp.value = prev[i] || '';
      row.appendChild(inp);
      container.appendChild(row);
      this.subjRefs.push(inp);
    }
  },

  async loadExisting() {
    const classId = $('rlClass').value;
    if (!classId) return;
    try {
      const r = await api(`/timetable-rules/${classId}`);
      if (!r.classId) return;
      $('rlPeriods').value  = r.periodsPerDay || 6;
      $('rlDuration').value = r.periodDuration || 60;
      $('rlMaxSame').value  = r.maxSameSubjectPerDay || 1;
      $('rlNoClash').checked = r.noFacultyClash !== false;
      if (r.lunchBreak) { $('rlLunchS').value = r.lunchBreak.start; $('rlLunchE').value = r.lunchBreak.end; }
      if (r.workingDays) {
        $('rlDays').querySelectorAll('input').forEach(cb => { cb.checked = r.workingDays.includes(cb.value); });
      }
      if (r.subjects?.length) {
        $('rlNumSubj').value = r.subjects.length;
        this.buildSubjectInputs(r.subjects.length);
        r.subjects.forEach((s,i) => { if (this.subjRefs[i]) this.subjRefs[i].value = s; });
      }
    } catch {}
  },

  async save() {
    const classId  = $('rlClass').value;
    const subjects = this.subjRefs.map(i => i.value.trim()).filter(Boolean);
    const numSubjects = parseInt($('rlNumSubj').value);
    if (!classId) return toast('Select a class','error');
    if (subjects.length !== numSubjects) return toast('Fill all subject names','error');
    const workingDays = [...$('rlDays').querySelectorAll('input:checked')].map(c => c.value);
    const body = {
      classId, numSubjects, subjects,
      periodsPerDay:        parseInt($('rlPeriods').value),
      periodDuration:       parseInt($('rlDuration').value),
      maxSameSubjectPerDay: parseInt($('rlMaxSame').value),
      noFacultyClash:       $('rlNoClash').checked,
      workingDays,
      lunchBreak: { start: $('rlLunchS').value, end: $('rlLunchE').value },
    };
    try { await api('/timetable-rules', {method:'POST', body}); toast('Rules saved'); this.loadAllRules(); }
    catch(e) { toast(e.message,'error'); }
  },

  async loadAllRules() {
    try {
      const rules = await api('/timetable-rules');
      const container = $('rlList');
      if (!container) return;
      container.innerHTML = rules.length
        ? rules.map(r => `
            <div class="rule-card anim">
              <div class="rule-card-info">
                <h4><span class="badge badge-blue">${r.classId}</span>&nbsp; ${r.periodsPerDay} periods/day &nbsp;·&nbsp; ${(r.workingDays||[]).join(', ')}</h4>
                <p>Subjects: ${(r.subjects||[]).join(', ') || '—'}</p>
              </div>
              <div class="rule-card-actions">
                <button class="btn btn-ghost btn-sm" onclick="Rules.loadForEdit('${r.classId}')"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn btn-danger btn-sm" onclick="Rules.del('${r.classId}')"><i class="fas fa-trash"></i></button>
              </div>
            </div>`).join('')
        : '<p style="color:var(--muted);font-size:13px;">No rules saved yet.</p>';
    } catch {}
  },

  async loadForEdit(classId) {
    $('rlClass').value = classId;
    await this.loadExisting();
    $('rlClass').scrollIntoView({behavior:'smooth', block:'center'});
  },

  async del(classId) {
    const ok = await confirm_del(`Delete rules for ${classId}?`);
    if (!ok) return;
    try { await api(`/timetable-rules/${classId}`, {method:'DELETE'}); toast('Deleted'); this.loadAllRules(); }
    catch(e) { toast(e.message,'error'); }
  },
};

/* ─────────────────────────────
   GENERATE TIMETABLE
───────────────────────────── */
Views.generate = async (vc) => {
  vc.innerHTML = `
    <div class="page-hdr anim"><h1>Generate Timetable</h1><p>Auto-schedule a clash-free timetable for a class.</p></div>
    <div class="card anim" style="max-width:500px;">
      <div class="card-title"><i class="fas fa-magic"></i> Select Class</div>
      <div class="fg"><label>Class (must have rules + subjects)</label><select id="genClass"><option value="">Loading…</option></select></div>
      <div class="btn-row">
        <button class="btn btn-primary" id="genBtn" onclick="Generate.run()"><i class="fas fa-play"></i> Generate</button>
        <button class="btn btn-success" id="genPubBtn" style="display:none" onclick="Generate.publish()"><i class="fas fa-paper-plane"></i> Publish</button>
        <button class="btn btn-ghost"   id="genReBtn"  style="display:none" onclick="Generate.run()"><i class="fas fa-sync"></i> Regenerate</button>
      </div>
    </div>
    <div id="genResult" style="display:none;">
      <div class="card anim">
        <div class="card-title"><i class="fas fa-table"></i> Generated Schedule</div>
        <div id="genMeta" style="font-size:12px;color:var(--muted);margin-bottom:12px;"></div>
        <div id="genTableWrap" style="overflow-x:auto;"></div>
      </div>
    </div>`;

  await Generate.init();
};

const Generate = {
  currentClassId: null,

  async init() {
    const sel = $('genClass');
    try {
      const classes = await api('/classes');
      sel.innerHTML = '<option value="">Choose a class</option>';
      for (const c of classes) {
        const ok = await fetch(`${API}/timetable-rules/${c.classId}`).then(r => r.ok).catch(()=>false);
        if (ok) sel.innerHTML += `<option value="${c.classId}">${c.classId}</option>`;
      }
      if (sel.options.length === 1) sel.innerHTML += '<option disabled>No classes with rules — set up rules first</option>';
    } catch { toast('Could not load classes','error'); }
  },

  async run() {
    const classId = $('genClass').value;
    if (!classId) return toast('Select a class','error');
    this.currentClassId = classId;
    const btn = $('genBtn');
    btn.disabled = true; btn.innerHTML = '<span class="loader-ring" style="width:16px;height:16px;border-width:2px;display:inline-block;"></span> Generating…';
    try {
      const data = await api('/timetable/generate', {method:'POST', body:{classId}});
      toast('Timetable generated!');
      this.render(data.timetable);
      $('genPubBtn').style.display = '';
      $('genReBtn').style.display = '';
    } catch(e) { toast(e.message,'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-play"></i> Generate'; }
  },

  render(tt) {
    const days     = tt.workingDaysSorted || ['Mon','Tue','Wed','Thu','Fri'];
    const schedule = tt.schedule || {};
    const periods  = [...new Set(Object.keys(schedule).map(k => k.split('-')[1]))]
      .sort((a,b) => parseInt(a.replace('P','')) - parseInt(b.replace('P','')));

    $('genMeta').innerHTML = `Class: <strong>${tt.classId}</strong> &nbsp;·&nbsp; v${tt.version} &nbsp;·&nbsp; ${tt.assignedHours} slots &nbsp;·&nbsp; ${fmtDate(tt.generatedAt)}`;

    $('genTableWrap').innerHTML = `
      <table class="tbl tt-table">
        <thead><tr><th>Period</th>${days.map(d=>`<th>${d}</th>`).join('')}</tr></thead>
        <tbody>
          ${periods.map(p => `<tr>
            <td><strong>${p}</strong></td>
            ${days.map(d => {
              const e = schedule[`${d}-${p}`];
              return e ? `<td><div class="tt-cell-sub">${e.subject}</div><div class="tt-cell-fac">${e.faculty}</div></td>`
                       : `<td style="color:var(--muted)">—</td>`;
            }).join('')}
          </tr>`).join('')}
        </tbody>
      </table>`;
    $('genResult').style.display = '';
  },

  async publish() {
    if (!this.currentClassId) return;
    try {
      const d = await api('/timetables/publish', {method:'POST', body:{classId: this.currentClassId}});
      toast(d.message || 'Published!');
    } catch(e) { toast(e.message,'error'); }
  },
};

/* ─────────────────────────────
   TIMETABLE VIEWER
───────────────────────────── */
Views.viewer = async (vc) => {
  vc.innerHTML = `
    <div class="page-hdr anim"><h1>Timetable Viewer</h1><p>View, inline-edit and publish all timetables.</p></div>
    <div id="ttCards"></div>
    <div id="ttBulkBar" style="display:none;position:sticky;bottom:0;background:var(--surface);padding:14px 20px;border-top:1px solid var(--border);border-radius:0 0 10px 10px;display:none;align-items:center;gap:12px;">
      <span id="ttChangeCount" style="font-size:13px;color:var(--muted);flex:1;"></span>
      <button class="btn btn-primary" onclick="Viewer.saveAll()"><i class="fas fa-save"></i> Save All Changes</button>
    </div>`;

  await Viewer.init();
};

const Viewer = {
  timetables: [],
  edited: {},
  editStates: {},

  async init() {
    try {
      const data = await api('/timetables');
      this.timetables = data || [];
      this.edited = {};
      this.renderAll();
    } catch(e) { toast('Failed to load timetables','error'); }
  },

  norm(raw) {
    const n = {};
    Object.entries(raw||{}).forEach(([k,v]) => {
      const [day,period] = k.split('-');
      if (!n[period]) n[period] = {};
      n[period][day] = `${v.subject||''}\n${v.faculty||''}`.trim();
    });
    return n;
  },

  denorm(n) {
    const raw = {};
    Object.entries(n).forEach(([period,days]) => {
      Object.entries(days).forEach(([day,text]) => {
        const [subject,faculty] = (text||'').split('\n');
        raw[`${day}-${period}`] = {subject:subject||'',faculty:faculty||''};
      });
    });
    return raw;
  },

  renderAll() {
    const container = $('ttCards');
    if (!this.timetables.length) {
      container.innerHTML = '<div class="card"><p style="text-align:center;color:var(--muted);padding:24px;">No timetables found. Generate one first.</p></div>';
      return;
    }
    this.timetables.forEach((tt,i) => { tt._norm = this.norm(tt.schedule); });
    container.innerHTML = '';
    this.timetables.forEach((tt,i) => container.appendChild(this.buildCard(tt,i)));
  },

  buildCard(tt,idx) {
    const days = tt.workingDaysSorted || ['Mon','Tue','Wed','Thu','Fri'];
    const PERIODS = ['P1','P2','P3','P4','P5','P6'];
    const pub = tt.isPublished
      ? `<span class="badge badge-green">Published</span>`
      : `<span class="badge badge-amber">Draft</span>`;

    const tableHTML = (editable) => `
      <table class="tbl tt-table">
        <thead><tr><th>Period</th>${days.map(d=>`<th>${d}</th>`).join('')}</tr></thead>
        <tbody>
          ${PERIODS.map(p => `<tr>
            <td><strong>${p}</strong></td>
            ${days.map(d => {
              const val = tt._norm?.[p]?.[d] || '';
              if (editable) {
                return `<td><textarea class="tt-edit-input" onchange="Viewer.cellChange(${idx},'${p}','${d}',this.value)">${val}</textarea></td>`;
              }
              const [sub,fac] = val.split('\n');
              return `<td>${sub ? `<div class="tt-cell-sub">${sub}</div><div class="tt-cell-fac">${fac||''}</div>` : `<span style="color:var(--muted)">—</span>`}</td>`;
            }).join('')}
          </tr>`).join('')}
        </tbody>
      </table>`;

    const div = document.createElement('div');
    div.className = 'card anim';
    div.id = `ttCard-${idx}`;
    const editing = !!this.editStates[idx];
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px;flex-wrap:wrap;">
        <div>
          <div style="font-size:15px;font-weight:600;">${tt.classId} &nbsp;${pub}</div>
          <div style="font-size:12px;color:var(--muted);">v${tt.version} &nbsp;·&nbsp; ${tt.assignedHours} slots &nbsp;·&nbsp; ${fmtDate(tt.generatedAt)}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" id="ttEditBtn-${idx}" onclick="Viewer.toggleEdit(${idx})">
            ${editing ? '<i class="fas fa-check"></i> Done' : '<i class="fas fa-edit"></i> Edit'}
          </button>
          <button class="btn btn-success btn-sm" onclick="Viewer.publish('${tt.classId}')"><i class="fas fa-paper-plane"></i> Publish</button>
        </div>
      </div>
      <div id="ttTable-${idx}" style="overflow-x:auto;">${tableHTML(editing)}</div>`;
    return div;
  },

  toggleEdit(idx) {
    this.editStates[idx] = !this.editStates[idx];
    const card = $(`ttCard-${idx}`);
    const tt = this.timetables[idx];
    const days = tt.workingDaysSorted || ['Mon','Tue','Wed','Thu','Fri'];
    const PERIODS = ['P1','P2','P3','P4','P5','P6'];
    const editing = this.editStates[idx];
    const pub = tt.isPublished ? `<span class="badge badge-green">Published</span>` : `<span class="badge badge-amber">Draft</span>`;

    $(`ttEditBtn-${idx}`).innerHTML = editing
      ? '<i class="fas fa-check"></i> Done'
      : '<i class="fas fa-edit"></i> Edit';

    $(`ttTable-${idx}`).innerHTML = `
      <table class="tbl tt-table">
        <thead><tr><th>Period</th>${days.map(d=>`<th>${d}</th>`).join('')}</tr></thead>
        <tbody>
          ${PERIODS.map(p => `<tr>
            <td><strong>${p}</strong></td>
            ${days.map(d => {
              const val = tt._norm?.[p]?.[d] || '';
              if (editing) return `<td><textarea class="tt-edit-input" onchange="Viewer.cellChange(${idx},'${p}','${d}',this.value)">${val}</textarea></td>`;
              const [sub,fac] = val.split('\n');
              return `<td>${sub ? `<div class="tt-cell-sub">${sub}</div><div class="tt-cell-fac">${fac||''}</div>` : `<span style="color:var(--muted)">—</span>`}</td>`;
            }).join('')}
          </tr>`).join('')}
        </tbody>
      </table>`;
  },

  cellChange(idx,period,day,value) {
    const tt = this.timetables[idx];
    if (!tt._norm[period]) tt._norm[period] = {};
    tt._norm[period][day] = value;
    tt.schedule = this.denorm(tt._norm);
    this.edited[tt._id] = true;
    this.updateBulkBar();
  },

  updateBulkBar() {
    const n = Object.keys(this.edited).length;
    const bar = $('ttBulkBar');
    bar.style.display = n ? 'flex' : 'none';
    $('ttChangeCount').textContent = `${n} timetable${n!==1?'s':''} with unsaved changes`;
  },

  async saveAll() {
    const payload = this.timetables
      .filter(tt => this.edited[tt._id])
      .map(tt => ({id:tt._id, schedule:tt.schedule, assignedHours:tt.assignedHours, totalSlots:tt.totalSlots, version:tt.version}));
    try {
      await api('/timetables/bulk-update', {method:'PUT', body:payload});
      toast('All changes saved');
      this.edited = {};
      this.updateBulkBar();
      this.init();
    } catch(e) { toast(e.message,'error'); }
  },

  async publish(classId) {
    try {
      const d = await api('/timetables/publish', {method:'POST', body:{classId}});
      toast(d.message || 'Published!');
      this.init();
    } catch(e) { toast(e.message,'error'); }
  },
};

/* ─────────────────────────────
   ATTENDANCE
───────────────────────────── */
Views.attendance = async (vc) => {
  vc.innerHTML = `
    <div class="page-hdr anim"><h1>Attendance</h1><p>Overview of class attendance across all sections.</p></div>
    <div class="card anim" style="padding:16px 22px;">
      <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
        <div class="fg" style="margin:0;min-width:180px;"><label>Class</label><select id="attClass"><option value="">All Classes</option></select></div>
        <div class="fg" style="margin:0;"><label>Date</label><input type="date" id="attDate"></div>
        <button class="btn btn-primary" onclick="Attendance.load()"><i class="fas fa-filter"></i> Filter</button>
      </div>
    </div>
    <div class="card anim anim-d1" style="padding:0;overflow:hidden;">
      <table class="tbl">
        <thead><tr><th>Class</th><th>Date</th><th>Present</th><th>Absent</th><th>Rate</th></tr></thead>
        <tbody id="attBody"><tr><td colspan="5" class="tbl-empty">Loading…</td></tr></tbody>
      </table>
    </div>
    <p style="font-size:12px;color:var(--muted);margin-top:6px;">Add an <code>/api/attendance</code> collection to your backend for live data. Sample data shown.</p>`;

  await Attendance.init();
};

const Attendance = {
  async init() {
    try {
      const classes = await api('/classes');
      const sel = $('attClass');
      classes.forEach(c => sel.innerHTML += `<option value="${c.classId}">${c.classId}</option>`);
    } catch {}
    this.load();
  },

  async load() {
    const tbody = $('attBody');
    try {
      const classId = $('attClass').value;
      const date    = $('attDate').value;
      let url = '/attendance';
      const p = [];
      if (classId) p.push(`classId=${encodeURIComponent(classId)}`);
      if (date)    p.push(`date=${date}`);
      if (p.length) url += '?' + p.join('&');
      const data = await api(url);
      tbody.innerHTML = data.length
        ? data.map(a => this.row(a)).join('')
        : '<tr><td colspan="5" class="tbl-empty">No records found</td></tr>';
    } catch {
      // Placeholder data
      const today = new Date().toISOString().split('T')[0];
      const sample = [{classId:'CSE-1-A',date:today,present:44,absent:6},{classId:'CSE-2-B',date:today,present:38,absent:12},{classId:'MECH-3-A',date:today,present:52,absent:3}];
      tbody.innerHTML = sample.map(a => this.row(a)).join('');
    }
  },

  row(a) {
    const total = (a.present||0) + (a.absent||0);
    const rate  = total ? Math.round(a.present/total*100) : 0;
    const cls   = rate>=80 ? 'rate-high' : rate>=60 ? 'rate-mid' : 'rate-low';
    return `<tr>
      <td><span class="badge badge-blue">${a.classId||'—'}</span></td>
      <td>${a.date||'—'}</td>
      <td>${a.present??'—'}</td><td>${a.absent??'—'}</td>
      <td><div class="rate-bar-wrap"><div class="rate-bar ${cls}" style="width:${rate}px;"></div><span>${rate}%</span></div></td>
    </tr>`;
  },
};

/* ─────────────────────────────
   SLOT CHANGES
───────────────────────────── */
Views.slotchange = async (vc) => {
  vc.innerHTML = `
    <div class="page-hdr anim"><h1>Slot Changes</h1><p>Swap timetable slots for a class.</p></div>
    <div class="card anim" style="max-width:600px;">
      <div class="card-title"><i class="fas fa-exchange-alt"></i> New Slot Change</div>
      <div class="form-grid">
        <div class="fg"><label>Class</label><select id="scClass"><option value="">Loading…</option></select></div>
        <div class="fg"><label>Date</label><input type="date" id="scDate"></div>
        <div class="fg"><label>Old Slot (e.g. Mon-P2)</label><input id="scOld" placeholder="Mon-P2"></div>
        <div class="fg"><label>New Slot (e.g. Wed-P4)</label><input id="scNew" placeholder="Wed-P4"></div>
        <div class="fg full"><label>Reason</label><textarea id="scReason" placeholder="Brief reason…"></textarea></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="SlotChange.submit()"><i class="fas fa-check"></i> Apply Change</button>
        <button class="btn btn-ghost" onclick="SlotChange.clear()">Clear</button>
      </div>
    </div>
    <div class="section-title anim anim-d1">Recent Changes</div>
    <div id="scLog" class="change-log anim anim-d2"></div>`;

  await SlotChange.init();
};

const SlotChange = {
  log: [],

  async init() {
    const sel = $('scClass');
    try {
      const classes = await api('/classes');
      sel.innerHTML = '<option value="">Choose a class</option>';
      classes.forEach(c => sel.innerHTML += `<option value="${c.classId}">${c.classId}</option>`);
    } catch { sel.innerHTML = '<option value="">Could not load</option>'; }
    this.renderLog();
  },

  clear() {
    ['scClass','scDate','scOld','scNew','scReason'].forEach(id => $(id).value='');
  },

  async submit() {
    const classId = $('scClass').value;
    const date    = $('scDate').value;
    const oldSlot = $('scOld').value.trim().toUpperCase();
    const newSlot = $('scNew').value.trim().toUpperCase();
    const reason  = $('scReason').value.trim();

    if (!classId || !oldSlot || !newSlot) return toast('Class, old slot and new slot are required','error');

    const slotRe = /^(MON|TUE|WED|THU|FRI|SAT)-P\d+$/i;
    if (!slotRe.test(oldSlot)||!slotRe.test(newSlot)) return toast('Slot format: Mon-P2 or Wed-P4','error');

    try {
      const timetables = await api('/timetables');
      const tt = timetables.find(t => t.classId === classId);
      if (!tt) throw new Error(`No timetable found for ${classId}`);

      const schedule = {...tt.schedule};
      const oldEntry = schedule[oldSlot];
      const newEntry = schedule[newSlot];
      if (!oldEntry) throw new Error(`Slot ${oldSlot} is empty — nothing to swap`);

      schedule[newSlot] = oldEntry;
      if (newEntry) schedule[oldSlot] = newEntry;
      else delete schedule[oldSlot];

      await api('/timetables/bulk-update', {method:'PUT', body:[{
        id: tt._id, schedule, assignedHours: tt.assignedHours, totalSlots: tt.totalSlots, version: tt.version,
      }]});

      this.log.unshift({classId, date, oldSlot, newSlot, reason, status:'pending', ts: new Date().toLocaleTimeString()});
      this.renderLog();
      toast('Slot change applied!');
      this.clear();
    } catch(e) { toast(e.message,'error'); }
  },

  updateStatus(idx, status) {
    this.log[idx].status = status;
    this.renderLog();
    toast(status === 'approved' ? 'Approved' : 'Rejected', status === 'approved' ? 'success' : 'error');
  },

  renderLog() {
    const container = $('scLog');
    if (!container) return;
    container.innerHTML = this.log.length
      ? this.log.map((c,i) => `
          <div class="change-row">
            <span class="cr-class"><span class="badge badge-blue">${c.classId}</span></span>
            <span class="cr-slots"><strong>${c.oldSlot}</strong> → <strong>${c.newSlot}</strong> &nbsp;·&nbsp; ${c.date||c.ts} ${c.reason ? `&nbsp;·&nbsp; ${c.reason}` : ''}</span>
            <span class="badge ${c.status==='approved'?'badge-green':c.status==='rejected'?'badge-red':'badge-amber'}">${c.status}</span>
            ${c.status==='pending' ? `
              <div class="cr-actions">
                <button class="act-btn act-pub" onclick="SlotChange.updateStatus(${i},'approved')">Approve</button>
                <button class="act-btn act-del" onclick="SlotChange.updateStatus(${i},'rejected')">Reject</button>
              </div>` : ''}
          </div>`).join('')
      : '<p style="color:var(--muted);font-size:13px;">No changes yet this session.</p>';
  },
};

/* ════════════════════════════════════════
   PROFILE VIEW — Admin
════════════════════════════════════════ */
Views.profile = async (vc) => {
  const user = App.getSession();

  vc.innerHTML = `
    <div class="page-hdr anim"><h1>My Profile</h1><p>Your account details.</p></div>

    <!-- Profile card -->
    <div class="profile-hero anim">
      <div class="ph-avatar" id="phAvatar">${(user.name||'A')[0].toUpperCase()}</div>
      <div class="ph-info">
        <div class="ph-name"  id="phName">${user.name  || '—'}</div>
        <div class="ph-email" id="phEmail">${user.email || '—'}</div>
        <div class="ph-role"><span class="badge badge-info">Admin</span></div>
      </div>
    </div>

    <!-- Details card -->
    <div class="card anim anim-d1" id="profileDetails">
      <div class="card-title"><i class="fas fa-id-card"></i> Account Details</div>
      <div class="profile-grid" id="profileGrid">
        <div class="profile-loading"><div class="loader-ring"></div></div>
      </div>
    </div>

    <!-- Change password -->
    <div class="card anim anim-d2">
      <div class="card-title"><i class="fas fa-lock"></i> Change Password</div>
      <div class="form-grid" style="max-width:480px;">
        <div class="form-group fg full">
          <label>Current Password</label>
          <div style="position:relative;">
            <input type="password" id="pwCurrent" placeholder="Enter current password">
          </div>
        </div>
        <div class="fg">
          <label>New Password</label>
          <input type="password" id="pwNew" placeholder="Min 6 characters">
        </div>
        <div class="fg">
          <label>Confirm New Password</label>
          <input type="password" id="pwConfirm" placeholder="Repeat new password">
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="ProfileAdmin.changePassword()">
          <i class="fas fa-save"></i> Update Password
        </button>
      </div>
    </div>`;

  await ProfileAdmin.load(user);
};

const ProfileAdmin = {
  async load(user) {
    try {
      const data = await api(`/profile/admin/${encodeURIComponent(user.email)}`);
      const grid = $('profileGrid');
      if (!grid) return;

      const fields = [
        { icon: 'fa-user',       label: 'Full Name',   value: data.name        || '—' },
        { icon: 'fa-envelope',   label: 'Email',        value: data.email       || '—' },
        { icon: 'fa-layer-group',label: 'Department',   value: data.department  || '—' },
        { icon: 'fa-calendar',   label: 'Member Since', value: data.created_at  || '—' },
        { icon: 'fa-shield-alt', label: 'Role',         value: 'Admin'                 },
      ];

      grid.innerHTML = fields.map(f => `
        <div class="profile-field">
          <div class="pf-icon"><i class="fas ${f.icon}"></i></div>
          <div class="pf-body">
            <div class="pf-label">${f.label}</div>
            <div class="pf-value">${f.value}</div>
          </div>
        </div>`).join('');
    } catch {
      const grid = $('profileGrid');
      if (grid) grid.innerHTML = '<p style="color:var(--muted);font-size:13px;">Could not load profile details.</p>';
    }
  },

  changePassword() {
    const current = $('pwCurrent').value;
    const nw      = $('pwNew').value;
    const confirm = $('pwConfirm').value;
    if (!current || !nw || !confirm) return toast('Fill all password fields', 'error');
    if (nw.length < 6)               return toast('New password must be at least 6 characters', 'error');
    if (nw !== confirm)              return toast('New passwords do not match', 'error');
    // Password change endpoint not yet implemented — show info toast
    toast('Password change requires a /change-password backend endpoint (not yet implemented)', 'info');
  },
};

/* ════════════════════════════════════════
   STUDENTS LIST VIEW
════════════════════════════════════════ */
Views.students = async (vc) => {
  vc.innerHTML = `
    <div class="page-hdr anim" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div>
        <h1>Students</h1>
        <p>All registered students in the system.</p>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="App.navigate('dashboard')">
        <i class="fas fa-arrow-left"></i> Back
      </button>
    </div>

    <!-- Search + filter bar -->
    <div class="card anim" style="padding:14px 18px;margin-bottom:16px;">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <div style="position:relative;flex:1;min-width:180px;">
          <i class="fas fa-search" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:13px;"></i>
          <input id="stuSearch" placeholder="Search by name, email or department…"
            style="width:100%;padding:8px 12px 8px 32px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;outline:none;font-family:inherit;"
            oninput="StudentList.filter()">
        </div>
        <select id="stuDeptFilter"
          style="padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;outline:none;font-family:inherit;background:#fff;"
          onchange="StudentList.filter()">
          <option value="">All Departments</option>
        </select>
        <select id="stuYearFilter"
          style="padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;outline:none;font-family:inherit;background:#fff;"
          onchange="StudentList.filter()">
          <option value="">All Years</option>
          <option value="1">Year 1</option>
          <option value="2">Year 2</option>
          <option value="3">Year 3</option>
          <option value="4">Year 4</option>
        </select>
        <span id="stuCount" style="font-size:13px;color:var(--muted);white-space:nowrap;"></span>
      </div>
    </div>

    <!-- Table -->
    <div class="card anim anim-d1" style="padding:0;overflow:hidden;">
      <table class="tbl" id="stuTable">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Email</th>
            <th>Department</th>
            <th>Year</th>
            <th>Section</th>
            <th>Class ID</th>
            <th>Assign</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody id="stuBody">
          <tr><td colspan="9" style="text-align:center;padding:28px;color:var(--muted);">Loading…</td></tr>
        </tbody>
      </table>
    </div>`;

  await StudentList.load();
};

const StudentList = {
  all: [],

  async load() {
    try {
      const [students, depts] = await Promise.all([api('/students'), api('/departments')]);
      this.all = students;

      // Populate dept filter
      const sel = $('stuDeptFilter');
      depts.forEach(d => sel.innerHTML += `<option value="${d.name}">${d.name}</option>`);

      this.render(students);
    } catch(e) {
      $('stuBody').innerHTML = `<tr><td colspan="9" style="text-align:center;padding:28px;color:var(--muted);">${e.message}</td></tr>`;
    }
  },

  filter() {
    const q    = ($('stuSearch').value || '').toLowerCase();
    const dept = $('stuDeptFilter').value;
    const year = $('stuYearFilter').value;

    const filtered = this.all.filter(s => {
      const matchQ    = !q    || [s.name,s.email,s.department].some(v => (v||'').toLowerCase().includes(q));
      const matchDept = !dept || s.department === dept;
      const matchYear = !year || String(s.year) === year;
      return matchQ && matchDept && matchYear;
    });
    this.render(filtered);
  },

  render(list) {
    const tbody = $('stuBody');
    const count = $('stuCount');
    if (count) count.textContent = `${list.length} student${list.length !== 1 ? 's' : ''}`;

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:28px;color:var(--muted);">No students found.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map((s, i) => `
      <tr>
        <td style="color:var(--muted);font-size:12px;">${i + 1}</td>
        <td>
          <div style="display:flex;align-items:center;gap:9px;">
            <div style="width:30px;height:30px;border-radius:50%;background:var(--accent-light);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">
              ${(s.name||'?')[0].toUpperCase()}
            </div>
            <span style="font-weight:600;">${s.name || '—'}</span>
          </div>
        </td>
        <td style="font-size:12px;color:var(--muted);">${s.email || '—'}</td>
        <td>${s.department || '—'}</td>
        <td>${s.year ? `Year ${s.year}` : '—'}</td>
        <td>${s.section || '—'}</td>
        <td id="cls-cell-${i}">
          ${s.classId
            ? `<span class="badge badge-green">${s.classId}</span>`
            : `<span style="color:var(--danger);font-size:12px;font-weight:600;">Not assigned</span>`}
        </td>
        <td>
          <button class="act-btn act-edit" onclick="StudentList.assignClass('${s.email}', ${i})">
            <i class="fas fa-link"></i> Assign Class
          </button>
        </td>
        <td style="font-size:12px;color:var(--muted);">${s.created_at || '—'}</td>
      </tr>`).join('');
  },

  async assignClass(email, rowIdx) {
    // Build class options from API
    const classes = await api('/classes').catch(() => []);
    if (!classes.length) return toast('No classes found. Create classes first.', 'error');

    const opts = classes.map(c => `<option value="${c.classId}">${c.classId}</option>`).join('');

    App.openModal(
      `Assign Class — ${email}`,
      `<div class="fg" style="margin-bottom:6px;">
        <label>Select Class</label>
        <select id="assignClassSel" style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:14px;outline:none;font-family:inherit;">
          <option value="">Choose a class…</option>${opts}
        </select>
       </div>
       <p style="font-size:12px;color:var(--muted);margin-top:8px;">
         The student must re-login after assignment to see their timetable.
       </p>`,
      `<button class="btn btn-ghost" onclick="App.closeModal()">Cancel</button>
       <button class="btn btn-primary" onclick="StudentList.confirmAssign('${email}', ${rowIdx})">
         <i class="fas fa-save"></i> Assign
       </button>`
    );
  },

  async confirmAssign(email, rowIdx) {
    const classId = $('assignClassSel')?.value;
    if (!classId) return toast('Select a class first', 'error');
    try {
      await fetch(`${API}/students/${encodeURIComponent(email)}/assign-class`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId }),
      }).then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.detail || 'Failed');
      });
      App.closeModal();
      toast(`${email} assigned to ${classId}`);
      // Update cell immediately without full reload
      const cell = $(`cls-cell-${rowIdx}`);
      if (cell) cell.innerHTML = `<span class="badge badge-green">${classId}</span>`;
      // Update local data
      const rec = this.all.find(s => s.email === email);
      if (rec) rec.classId = classId;
    } catch(e) { toast(e.message, 'error'); }
  },
};

/* ════════════════════════════════════════
   TEACHERS LIST VIEW
════════════════════════════════════════ */
Views.teachers = async (vc) => {
  vc.innerHTML = `
    <div class="page-hdr anim" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div><h1>Teachers</h1><p>All registered teachers in the system.</p></div>
      <button class="btn btn-ghost btn-sm" onclick="App.navigate('dashboard')">
        <i class="fas fa-arrow-left"></i> Back
      </button>
    </div>

    <div class="card anim" style="padding:14px 18px;margin-bottom:16px;">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <div style="position:relative;flex:1;min-width:180px;">
          <i class="fas fa-search" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:13px;"></i>
          <input id="tchSearch" placeholder="Search by name, email or department…"
            style="width:100%;padding:8px 12px 8px 32px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;outline:none;font-family:inherit;"
            oninput="TeacherList.filter()">
        </div>
        <select id="tchDeptFilter"
          style="padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;outline:none;font-family:inherit;background:#fff;"
          onchange="TeacherList.filter()">
          <option value="">All Departments</option>
        </select>
        <span id="tchCount" style="font-size:13px;color:var(--muted);white-space:nowrap;"></span>
      </div>
    </div>

    <div class="card anim anim-d1" style="padding:0;overflow:hidden;">
      <table class="tbl">
        <thead>
          <tr>
            <th>#</th><th>Name</th><th>Email</th><th>Department</th>
            <th>Subjects</th><th>Qualifications</th><th>Role</th><th>Joined</th>
          </tr>
        </thead>
        <tbody id="tchBody">
          <tr><td colspan="8" style="text-align:center;padding:28px;color:var(--muted);">Loading…</td></tr>
        </tbody>
      </table>
    </div>`;

  await TeacherList.load();
};

const TeacherList = {
  all: [],

  async load() {
    try {
      const [teachers, depts] = await Promise.all([api('/teachers'), api('/departments')]);
      this.all = teachers;

      const sel = $('tchDeptFilter');
      depts.forEach(d => sel.innerHTML += `<option value="${d.name}">${d.name}</option>`);

      this.render(teachers);
    } catch(e) {
      $('tchBody').innerHTML = `<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--muted);">${e.message}</td></tr>`;
    }
  },

  filter() {
    const q    = ($('tchSearch').value || '').toLowerCase();
    const dept = $('tchDeptFilter').value;
    const filtered = this.all.filter(t => {
      const matchQ    = !q    || [t.name,t.email,t.department].some(v => (v||'').toLowerCase().includes(q));
      const matchDept = !dept || t.department === dept;
      return matchQ && matchDept;
    });
    this.render(filtered);
  },

  render(list) {
    const tbody = $('tchBody');
    const count = $('tchCount');
    if (count) count.textContent = `${list.length} teacher${list.length !== 1 ? 's' : ''}`;

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--muted);">No teachers found.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map((t, i) => `
      <tr>
        <td style="color:var(--muted);font-size:12px;">${i + 1}</td>
        <td>
          <div style="display:flex;align-items:center;gap:9px;">
            <div style="width:30px;height:30px;border-radius:50%;background:#d1fae5;color:#059669;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">
              ${(t.name||'?')[0].toUpperCase()}
            </div>
            <span style="font-weight:600;">${t.name || '—'}</span>
          </div>
        </td>
        <td style="font-size:12px;color:var(--muted);">${t.email || '—'}</td>
        <td>${t.department || '—'}</td>
        <td style="font-size:12px;">${(t.subjects||[]).join(', ') || '—'}</td>
        <td style="font-size:12px;">${t.qualifications || '—'}</td>
        <td style="font-size:12px;">${t.role || '—'}</td>
        <td style="font-size:12px;color:var(--muted);">${t.created_at || '—'}</td>
      </tr>`).join('');
  },
};

/* ════════════════════════════════════════
   DEPARTMENTS LIST VIEW
════════════════════════════════════════ */
Views.depts = async (vc) => {
  vc.innerHTML = `
    <div class="page-hdr anim" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div><h1>Departments</h1><p>All departments in the college.</p></div>
      <button class="btn btn-ghost btn-sm" onclick="App.navigate('dashboard')">
        <i class="fas fa-arrow-left"></i> Back
      </button>
    </div>

    <div class="card anim anim-d1" style="padding:0;overflow:hidden;">
      <table class="tbl">
        <thead><tr><th>#</th><th>Department Name</th><th>Actions</th></tr></thead>
        <tbody id="deptListBody">
          <tr><td colspan="3" style="text-align:center;padding:28px;color:var(--muted);">Loading…</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Add new -->
    <div class="card anim anim-d2">
      <div class="card-title"><i class="fas fa-plus"></i> Add Department</div>
      <div style="display:flex;gap:10px;">
        <div class="fg" style="flex:1;margin:0;">
          <input id="deptListInput" placeholder="Department name" onkeydown="if(event.key==='Enter')DeptList.add()">
        </div>
        <button class="btn btn-primary" onclick="DeptList.add()"><i class="fas fa-plus"></i> Add</button>
      </div>
    </div>`;

  await DeptList.load();
};

const DeptList = {
  async load() {
    try {
      const depts = await api('/departments');
      const tbody = $('deptListBody');
      tbody.innerHTML = depts.length
        ? depts.map((d, i) => `
            <tr>
              <td style="color:var(--muted);font-size:12px;">${i + 1}</td>
              <td>
                <div style="display:flex;align-items:center;gap:9px;">
                  <div style="width:30px;height:30px;border-radius:8px;background:#fef3c7;color:#b45309;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;">
                    <i class="fas fa-layer-group"></i>
                  </div>
                  <span style="font-weight:600;">${d.name}</span>
                </div>
              </td>
              <td>
                <button class="act-btn act-del" onclick="DeptList.del('${d._id}','${d.name}')">
                  <i class="fas fa-trash"></i> Delete
                </button>
              </td>
            </tr>`).join('')
        : '<tr><td colspan="3" style="text-align:center;padding:28px;color:var(--muted);">No departments yet.</td></tr>';
    } catch(e) { toast(e.message, 'error'); }
  },

  async add() {
    const name = ($('deptListInput').value || '').trim();
    if (!name) return toast('Enter a department name', 'error');
    try {
      await api('/departments', { method:'POST', body:{ name } });
      $('deptListInput').value = '';
      toast('Department added');
      this.load();
    } catch(e) { toast(e.message, 'error'); }
  },

  async del(id, name) {
    const ok = await confirm_del(`Delete department "${name}"? This cannot be undone.`);
    if (!ok) return;
    try {
      await api(`/departments/${id}`, { method:'DELETE' });
      toast('Deleted');
      this.load();
    } catch(e) { toast(e.message, 'error'); }
  },
};

/* ════════════════════════════════════════
   CLASSES LIST VIEW
════════════════════════════════════════ */
Views.classes_list = async (vc) => {
  vc.innerHTML = `
    <div class="page-hdr anim" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div><h1>Classes</h1><p>All classes and sections.</p></div>
      <button class="btn btn-ghost btn-sm" onclick="App.navigate('dashboard')">
        <i class="fas fa-arrow-left"></i> Back
      </button>
    </div>

    <div class="card anim" style="padding:14px 18px;margin-bottom:16px;">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <div style="position:relative;flex:1;min-width:180px;">
          <i class="fas fa-search" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:13px;"></i>
          <input id="clsSearch" placeholder="Search by class ID or department…"
            style="width:100%;padding:8px 12px 8px 32px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;outline:none;font-family:inherit;"
            oninput="ClassesList.filter()">
        </div>
        <select id="clsYearFilter"
          style="padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;outline:none;font-family:inherit;background:#fff;"
          onchange="ClassesList.filter()">
          <option value="">All Years</option>
          <option value="1">Year 1</option><option value="2">Year 2</option>
          <option value="3">Year 3</option><option value="4">Year 4</option>
        </select>
        <span id="clsCount" style="font-size:13px;color:var(--muted);white-space:nowrap;"></span>
      </div>
    </div>

    <div class="card anim anim-d1" style="padding:0;overflow:hidden;">
      <table class="tbl">
        <thead>
          <tr>
            <th>#</th><th>Class ID</th><th>Department</th><th>Acad. Year</th>
            <th>Year</th><th>Semester</th><th>Section</th><th>Strength</th><th>Timetable</th>
          </tr>
        </thead>
        <tbody id="clsBody">
          <tr><td colspan="9" style="text-align:center;padding:28px;color:var(--muted);">Loading…</td></tr>
        </tbody>
      </table>
    </div>`;

  await ClassesList.load();
};

const ClassesList = {
  all: [],
  timetableMap: {},

  async load() {
    try {
      const [classes, timetables] = await Promise.all([api('/classes'), api('/timetables').catch(() => [])]);
      this.all = classes;
      timetables.forEach(t => { this.timetableMap[t.classId] = t; });
      this.render(classes);
    } catch(e) {
      $('clsBody').innerHTML = `<tr><td colspan="9" style="text-align:center;padding:28px;color:var(--muted);">${e.message}</td></tr>`;
    }
  },

  filter() {
    const q    = ($('clsSearch').value || '').toLowerCase();
    const year = $('clsYearFilter').value;
    const filtered = this.all.filter(c => {
      const matchQ    = !q    || [c.classId, c.department].some(v => (v||'').toLowerCase().includes(q));
      const matchYear = !year || String(c.year) === year;
      return matchQ && matchYear;
    });
    this.render(filtered);
  },

  render(list) {
    const tbody = $('clsBody');
    const count = $('clsCount');
    if (count) count.textContent = `${list.length} class${list.length !== 1 ? 'es' : ''}`;

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:28px;color:var(--muted);">No classes found.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map((c, i) => {
      const tt = this.timetableMap[c.classId];
      const ttBadge = tt
        ? tt.isPublished
          ? `<span class="badge badge-green">Published</span>`
          : `<span class="badge badge-amber">Draft</span>`
        : `<span style="color:var(--muted);font-size:12px;">None</span>`;
      return `
        <tr>
          <td style="color:var(--muted);font-size:12px;">${i + 1}</td>
          <td><span class="badge badge-blue">${c.classId}</span></td>
          <td>${c.department}</td>
          <td style="font-size:12px;">${c.academicYear}</td>
          <td>Year ${c.year}</td>
          <td>Sem ${c.semester}</td>
          <td>${c.section}</td>
          <td>${c.strength}</td>
          <td>${ttBadge}</td>
        </tr>`;
    }).join('');
  },
};

/* ════════════════════════════════════════
   BOOT
════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => App.init());