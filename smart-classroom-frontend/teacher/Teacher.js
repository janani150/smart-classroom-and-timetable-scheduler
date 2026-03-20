/* ═══════════════════════════════════════════════════
   Smart Classroom Teacher SPA — teacher.js
═══════════════════════════════════════════════════ */

const API = 'http://localhost:8000/api';

/* ── Utilities ── */
const $ = id => document.getElementById(id);

function toast(msg, type = 'success') {
  const icons = { success:'fa-check-circle', error:'fa-exclamation-circle', info:'fa-info-circle' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fas ${icons[type]}"></i><span>${msg}</span>`;
  $('toastStack').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 280); }, 3200);
}

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
}

function getSession() {
  try { return JSON.parse(sessionStorage.getItem('user') || '{}'); }
  catch { return {}; }
}

const DAYS  = ['Mon','Tue','Wed','Thu','Fri'];
const PERIOD_TIMES = {
  P1:'9:00–10:00', P2:'10:00–11:00', P3:'11:00–12:00',
  P4:'1:00–2:00',  P5:'2:00–3:00',  P6:'3:00–4:00',
};
const PERIODS = Object.keys(PERIOD_TIMES);

function todayKey() {
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
}

/* ════════════════════════════════════════
   APP CORE
════════════════════════════════════════ */
const App = {
  user: {},

  init() {
    this.user = getSession();
    const name  = this.user.name  || 'Teacher';
    const email = this.user.email || '';
    $('sidebarName').textContent  = name;
    $('sidebarEmail').textContent = email;
    $('userAvatar').textContent   = name[0]?.toUpperCase() || 'T';
    if (this.user.department) $('topbarDept').textContent = this.user.department;

    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => {
        this.navigate(el.dataset.view);
        if (window.innerWidth <= 768) this.toggleSidebar(false);
      });
    });

    this.navigate('dashboard');

    // Check for unread notifications and show bell dot
    if (this.user.email) {
      fetch(`${API}/notifications/teacher?email=${encodeURIComponent(this.user.email)}`)
        .then(r => r.json())
        .then(notifs => {
          const unread = notifs.filter(n => !n.read).length;
          const dot = $('notifDot');
          if (dot && unread > 0) {
            dot.style.display = '';
            dot.textContent = unread > 9 ? '9+' : unread;
          }
        }).catch(() => {});
    }
  },

  navigate(view) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
    const titles = { dashboard:'Dashboard', timetable:'My Timetable', attendance:'Attendance', classes:'Available Classes', slotchange:'Slot Change Requests', notifications:'Notifications', profile:'My Profile' };
    $('topbarTitle').textContent = titles[view] || view;

    const vc = $('viewContainer');
    vc.innerHTML = '<div class="page-loading"><div class="loader-ring"></div></div>';
    setTimeout(() => Views[view] ? Views[view](vc) : (vc.innerHTML = '<p>View not found</p>'), 60);
  },

  toggleSidebar(force) {
    const open = force !== undefined ? force : !$('sidebar').classList.contains('open');
    $('sidebar').classList.toggle('open', open);
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
  const user  = App.user;
  const name  = user.name || 'Teacher';
  const today = todayKey();

  vc.innerHTML = `
    <div class="profile-banner anim">
      <div class="pb-avatar">${name[0]?.toUpperCase() || 'T'}</div>
      <div>
        <div class="pb-name">Welcome, ${name}</div>
        <div class="pb-meta">
          ${user.department ? '<i class="fas fa-layer-group" style="opacity:.7"></i> ' + user.department : ''}
          ${user.email ? '&nbsp;·&nbsp; <i class="fas fa-envelope" style="opacity:.7"></i> ' + user.email : ''}
          ${user.qualifications ? '&nbsp;·&nbsp; ' + user.qualifications : ''}
        </div>
        ${user.subjects?.length ? `<div class="pb-subjects">${user.subjects.map(s => `<span class="pb-tag">${s}</span>`).join('')}</div>` : ''}
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card anim anim-d1">
        <div class="stat-icon si-indigo"><i class="fas fa-calendar-check"></i></div>
        <div><div class="stat-val" id="dToday">—</div><div class="stat-lbl">Classes Today</div></div>
      </div>
      <div class="stat-card anim anim-d1">
        <div class="stat-icon si-green"><i class="fas fa-users"></i></div>
        <div><div class="stat-val" id="dStudents">—</div><div class="stat-lbl">Total Students</div></div>
      </div>
      <div class="stat-card anim anim-d2">
        <div class="stat-icon si-amber"><i class="fas fa-book-open"></i></div>
        <div><div class="stat-val" id="dSubjects">—</div><div class="stat-lbl">Subjects</div></div>
      </div>
      <div class="stat-card anim anim-d2">
        <div class="stat-icon si-sky"><i class="fas fa-chalkboard"></i></div>
        <div><div class="stat-val" id="dClasses">—</div><div class="stat-lbl">My Classes</div></div>
      </div>
    </div>

    <div class="card anim anim-d2">
      <div class="card-title"><i class="fas fa-bolt"></i> Quick Actions</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="App.navigate('timetable')"><i class="fas fa-calendar-alt"></i> View Timetable</button>
        <button class="btn btn-ghost"   onclick="App.navigate('attendance')"><i class="fas fa-clipboard-check"></i> Mark Attendance</button>
        <button class="btn btn-ghost"   onclick="App.navigate('classes')"><i class="fas fa-book-open"></i> Available Classes</button>
      </div>
    </div>

    <div class="card anim anim-d3">
      <div class="card-title"><i class="fas fa-sun"></i> Today's Schedule (${today})</div>
      <div id="todaySlots"><p style="color:var(--muted);font-size:13px;">Loading…</p></div>
    </div>`;

  // Populate stats
  try {
    const [students, timetables] = await Promise.all([
      api('/students').catch(() => []),
      api('/timetables').catch(() => []),
    ]);
    $('dStudents').textContent = students.length;
    $('dSubjects').textContent = user.subjects?.length || '—';

    // Find timetables where this teacher appears
    const teacherName = user.name || '';
    let myClassIds = new Set();
    let todayCount = 0;

    timetables.forEach(tt => {
      const schedule = tt.schedule || {};
      let hasTeacher = false;
      Object.values(schedule).forEach(entry => {
        if (entry.faculty === teacherName) {
          hasTeacher = true;
          if (Object.keys(schedule).some(k => k.startsWith(today) && schedule[k]?.faculty === teacherName)) {
            todayCount++;
          }
        }
      });
      if (hasTeacher) myClassIds.add(tt.classId);
    });

    // deduplicate today count
    const todayKeys = new Set();
    timetables.forEach(tt => {
      const schedule = tt.schedule || {};
      PERIODS.forEach(p => {
        const entry = schedule[`${today}-${p}`];
        if (entry?.faculty === teacherName) todayKeys.add(`${tt.classId}-${today}-${p}`);
      });
    });

    $('dToday').textContent   = todayKeys.size;
    $('dClasses').textContent = myClassIds.size;

    // Today's schedule card
    const container = $('todaySlots');
    if (todayKeys.size === 0) {
      container.innerHTML = '<p style="color:var(--muted);font-size:13px;">No classes scheduled for today.</p>';
    } else {
      const nowH = new Date().getHours();
      const periodStartH = { P1:9, P2:10, P3:11, P4:13, P5:14, P6:15 };
      let rows = [];
      timetables.forEach(tt => {
        const schedule = tt.schedule || {};
        PERIODS.forEach(p => {
          const entry = schedule[`${today}-${p}`];
          if (entry?.faculty === teacherName) {
            const isNow = periodStartH[p] === nowH;
            rows.push({ classId:tt.classId, period:p, subject:entry.subject, isNow });
          }
        });
      });
      rows.sort((a,b) => PERIODS.indexOf(a.period) - PERIODS.indexOf(b.period));
      container.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px;">
        ${rows.map(r => `
          <div style="display:flex;align-items:center;gap:14px;padding:11px 14px;border-radius:9px;border:1px solid var(--border);background:${r.isNow?'var(--accent-light)':'var(--bg)'};">
            <div style="min-width:60px;text-align:center;">
              <div style="font-size:13px;font-weight:700;color:var(--accent)">${r.period}</div>
              <div style="font-size:10.5px;color:var(--muted)">${PERIOD_TIMES[r.period]}</div>
            </div>
            <div style="flex:1;">
              <div style="font-weight:600;font-size:13.5px;">${r.subject}</div>
              <div style="font-size:12px;color:var(--muted);">Class: ${r.classId}</div>
            </div>
            ${r.isNow ? `<span class="badge badge-indigo">Now</span>` : ''}
          </div>`).join('')}
      </div>`;
    }
  } catch(e) {
    $('todaySlots').innerHTML = '<p style="color:var(--muted);font-size:13px;">Could not load schedule.</p>';
  }
};

/* ─────────────────────────────
   TIMETABLE
───────────────────────────── */
Views.timetable = async (vc) => {
  const teacher = App.user.name || '';
  const today   = todayKey();

  vc.innerHTML = `
    <div class="page-hdr anim"><h1>My Timetable</h1><p>Your full teaching schedule — filtered to your classes.</p></div>
    <div class="card anim" style="padding:0;overflow:hidden;">
      <div id="ttWrap" style="overflow-x:auto;padding:0;">
        <p style="padding:24px;color:var(--muted);text-align:center;">Loading…</p>
      </div>
    </div>
    <p class="anim anim-d1" style="font-size:12px;color:var(--muted);margin-top:4px;">
      <i class="fas fa-circle" style="color:var(--accent);font-size:9px;"></i> Only slots where you are assigned are shown.
      Highlighted row = today.
    </p>`;

  try {
    const timetables = await api('/timetables');
    if (!timetables.length) throw new Error('No timetables found');

    // Build unified schedule across all classes for this teacher
    // schedule[day][period] = { subject, classId }
    const mySchedule = {};
    DAYS.forEach(d => { mySchedule[d] = {}; });

    timetables.forEach(tt => {
      const schedule = tt.schedule || {};
      PERIODS.forEach(p => {
        DAYS.forEach(d => {
          const entry = schedule[`${d}-${p}`];
          if (entry?.faculty === teacher) {
            mySchedule[d][p] = { subject: entry.subject, classId: tt.classId };
          }
        });
      });
    });

    const hasAny = Object.values(mySchedule).some(day => Object.keys(day).length > 0);
    if (!hasAny) {
      // Show which faculty names exist in timetables so admin can fix the mismatch
      const facultyNamesInTimetables = new Set();
      timetables.forEach(tt => {
        Object.values(tt.schedule || {}).forEach(e => {
          if (e.faculty) facultyNamesInTimetables.add(e.faculty);
        });
      });
      const hint = facultyNamesInTimetables.size
        ? `<p style="font-size:12px;color:var(--muted);margin-top:10px;">
             Your login name is <strong>"${teacher}"</strong>.<br>
             Faculty names in the timetable: <strong>${[...facultyNamesInTimetables].join(', ')}</strong>.<br>
             These must match exactly. Ask your admin to re-add subjects using your exact name, then regenerate.
           </p>`
        : `<p style="font-size:12px;color:var(--muted);margin-top:10px;">No timetables have been generated yet.</p>`;
      $('ttWrap').innerHTML = `
        <div style="padding:28px;text-align:center;">
          <i class="fas fa-calendar-times" style="font-size:36px;color:var(--muted);opacity:.4;margin-bottom:12px;display:block;"></i>
          <p style="color:var(--muted);font-weight:600;">No classes assigned to you yet.</p>
          ${hint}
        </div>`;
      return;
    }

    $('ttWrap').innerHTML = `
      <table class="tt">
        <thead>
          <tr>
            <th>Day</th>
            ${PERIODS.map(p => `<th>${p}<br><small style="font-weight:400;opacity:.75">${PERIOD_TIMES[p]}</small></th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${DAYS.map(day => `
            <tr class="${day === today ? 'tt-today' : ''}">
              <td class="tt-day">
                ${day}
                ${day === today ? '<br><span style="font-size:9px;background:var(--accent);color:#fff;border-radius:4px;padding:1px 5px;">TODAY</span>' : ''}
              </td>
              ${PERIODS.map(p => {
                const e = mySchedule[day][p];
                return e
                  ? `<td><div class="tt-class">${e.subject}</div><div class="tt-sub">${e.classId}</div></td>`
                  : `<td><span class="tt-free">—</span></td>`;
              }).join('')}
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch(e) {
    $('ttWrap').innerHTML = `<p style="padding:24px;color:var(--muted);text-align:center;">${e.message}</p>`;
  }
};

/* ─────────────────────────────
   ATTENDANCE
───────────────────────────── */
Views.attendance = async (vc) => {
  const teacher = App.user.name || '';
  const today   = todayKey();

  vc.innerHTML = `
    <div class="page-hdr anim"><h1>Attendance</h1><p>Mark attendance for your classes today.</p></div>
    <div class="card anim" style="padding:16px 22px;margin-bottom:18px;">
      <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
        <div class="fg" style="margin:0;min-width:200px;"><label>Select Class Period</label>
          <select id="attSelect"><option value="">Loading…</option></select>
        </div>
        <div class="fg" style="margin:0;"><label>Date</label>
          <input type="date" id="attDate" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <button class="btn btn-primary" onclick="Attendance.loadStudents()"><i class="fas fa-users"></i> Load Students</button>
      </div>
    </div>
    <div id="attCards"></div>`;

  await Attendance.init(teacher, today);
};

const Attendance = {
  students: [],
  presentSet: new Set(),

  async init(teacher, today) {
    const sel = $('attSelect');
    try {
      const timetables = await api('/timetables');
      const slots = [];
      timetables.forEach(tt => {
        const schedule = tt.schedule || {};
        PERIODS.forEach(p => {
          const entry = schedule[`${today}-${p}`];
          if (entry?.faculty === teacher) {
            slots.push({ key:`${tt.classId}|${today}-${p}`, classId:tt.classId, period:p, subject:entry.subject });
          }
        });
      });
      sel.innerHTML = '<option value="">Choose a class period</option>';
      slots.forEach(s => sel.innerHTML += `<option value="${s.key}">${s.classId} — ${s.subject} (${s.period} · ${PERIOD_TIMES[s.period]})</option>`);
      if (!slots.length) sel.innerHTML = '<option>No classes assigned today</option>';
    } catch { sel.innerHTML = '<option>Could not load</option>'; }
  },

  async loadStudents() {
    const val = $('attSelect').value;
    if (!val) return toast('Select a class period first', 'error');
    const classId = val.split('|')[0];
    const container = $('attCards');
    container.innerHTML = '<p style="color:var(--muted);font-size:13px;">Loading students…</p>';

    try {
      const students = await api('/students');
      this.students = students.filter(s => s.classId === classId || !classId);
      // If classId filter gives 0 show all (until students have classId field)
      if (!this.students.length) this.students = students;

      this.presentSet = new Set(this.students.map(s => s.student_id || s.email));
      this.render(classId, val.split('|')[1]);
    } catch(e) {
      container.innerHTML = `<p style="color:var(--muted);font-size:13px;">${e.message}</p>`;
    }
  },

  render(classId, slotKey) {
    const container = $('attCards');
    if (!this.students.length) {
      container.innerHTML = '<div class="card"><p style="color:var(--muted);text-align:center;padding:16px;">No students found for this class.</p></div>';
      return;
    }

    const saved = JSON.parse(sessionStorage.getItem('teacherAttLog') || '[]');
    const alreadySaved = saved.find(s => s.slotKey === slotKey && s.date === $('attDate').value);

    container.innerHTML = `
      <div class="att-class-card anim">
        <div class="acc-header">
          <div>
            <div class="acc-title">Class: ${classId} — ${slotKey}</div>
            <div class="acc-meta">${this.students.length} students</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-ghost btn-sm" onclick="Attendance.markAll(true)"><i class="fas fa-check-double"></i> All Present</button>
            <button class="btn btn-ghost btn-sm" onclick="Attendance.markAll(false)"><i class="fas fa-times"></i> All Absent</button>
          </div>
        </div>
        ${this.students.map(s => {
          const id = s.student_id || s.email;
          const checked = alreadySaved
            ? alreadySaved.present.includes(id)
            : this.presentSet.has(id);
          return `
            <div class="student-row" id="srow-${id.replace(/[@.]/g,'_')}">
              <div>
                <div class="student-name">${s.name}</div>
                <div class="student-roll">${s.student_id || s.email}</div>
              </div>
              <div class="toggle-wrap">
                <span class="toggle-lbl ${checked?'present':'absent'}" id="tlbl-${id.replace(/[@.]/g,'_')}">${checked?'Present':'Absent'}</span>
                <label class="switch">
                  <input type="checkbox" ${checked?'checked':''} onchange="Attendance.toggle('${id}', this.checked)">
                  <span class="slider"></span>
                </label>
              </div>
            </div>`;
        }).join('')}
        <div class="btn-row">
          <button class="btn btn-success" onclick="Attendance.save('${classId}','${slotKey}')"><i class="fas fa-save"></i> Save Attendance</button>
          <div id="attSummary" style="font-size:13px;color:var(--muted);line-height:1.4;padding-top:2px;"></div>
        </div>
      </div>`;

    this.updateSummary();
  },

  toggle(id, present) {
    if (present) this.presentSet.add(id);
    else this.presentSet.delete(id);
    const key = id.replace(/[@.]/g,'_');
    const lbl = $(`tlbl-${key}`);
    if (lbl) { lbl.textContent = present ? 'Present' : 'Absent'; lbl.className = `toggle-lbl ${present?'present':'absent'}`; }
    this.updateSummary();
  },

  markAll(present) {
    this.students.forEach(s => {
      const id = s.student_id || s.email;
      if (present) this.presentSet.add(id);
      else this.presentSet.delete(id);
      // Update UI
      const key = id.replace(/[@.]/g,'_');
      const row = $(`srow-${key}`);
      if (row) {
        const cb  = row.querySelector('input[type=checkbox]');
        const lbl = $(`tlbl-${key}`);
        if (cb) cb.checked = present;
        if (lbl) { lbl.textContent = present?'Present':'Absent'; lbl.className=`toggle-lbl ${present?'present':'absent'}`; }
      }
    });
    this.updateSummary();
  },

  updateSummary() {
    const el = $('attSummary');
    if (!el) return;
    const total   = this.students.length;
    const present = this.presentSet.size;
    const rate    = total ? Math.round(present/total*100) : 0;
    el.innerHTML = `Present: <strong>${present}/${total}</strong> &nbsp;·&nbsp; Attendance: <strong>${rate}%</strong>`;
  },

  save(classId, slotKey) {
    const date  = $('attDate').value;
    const log   = JSON.parse(sessionStorage.getItem('teacherAttLog') || '[]');
    const idx   = log.findIndex(s => s.slotKey === slotKey && s.date === date);
    const entry = { classId, slotKey, date, present:[...this.presentSet], total:this.students.length, ts:new Date().toLocaleString() };
    if (idx >= 0) log[idx] = entry; else log.unshift(entry);
    sessionStorage.setItem('teacherAttLog', JSON.stringify(log));
    toast(`Attendance saved — ${this.presentSet.size}/${this.students.length} present`);
    this.updateSummary();
  },
};

/* ─────────────────────────────
   AVAILABLE CLASSES
───────────────────────────── */
Views.classes = async (vc) => {
  vc.innerHTML = `
    <div class="page-hdr anim"><h1>Available Classes</h1><p>Browse all classes and timetable slots in the system.</p></div>
    <div class="card anim" style="padding:14px 20px;margin-bottom:18px;">
      <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
        <div class="fg" style="margin:0;min-width:180px;"><label>Filter by Department</label>
          <select id="filterDept"><option value="">All Departments</option></select>
        </div>
        <div class="fg" style="margin:0;min-width:160px;"><label>Filter by Year</label>
          <select id="filterYear"><option value="">All Years</option>${[1,2,3,4].map(y=>`<option value="${y}">Year ${y}</option>`).join('')}</select>
        </div>
        <button class="btn btn-primary" onclick="AvailClasses.filter()"><i class="fas fa-filter"></i> Filter</button>
      </div>
    </div>
    <div id="classGrid" class="avail-grid"></div>`;

  await AvailClasses.init();
};

const AvailClasses = {
  all: [],

  async init() {
    try {
      const [classes, depts, timetables] = await Promise.all([
        api('/classes'),
        api('/departments'),
        api('/timetables').catch(() => []),
      ]);

      this.all = classes.map(c => {
        const tt = timetables.find(t => t.classId === c.classId);
        return { ...c, hasTimetable: !!tt, isPublished: tt?.isPublished || false, schedule: tt?.schedule || {} };
      });

      // Populate dept filter
      const sel = $('filterDept');
      depts.forEach(d => sel.innerHTML += `<option value="${d.name}">${d.name}</option>`);

      this.render(this.all);
    } catch(e) {
      $('classGrid').innerHTML = `<p style="color:var(--muted);">${e.message}</p>`;
    }
  },

  filter() {
    const dept = $('filterDept').value;
    const year = $('filterYear').value;
    const filtered = this.all.filter(c =>
      (!dept || c.department === dept) &&
      (!year || c.year === parseInt(year))
    );
    this.render(filtered);
  },

  render(classes) {
    const container = $('classGrid');
    if (!classes.length) {
      container.innerHTML = '<p style="color:var(--muted);font-size:13px;">No classes match the filter.</p>';
      return;
    }

    container.innerHTML = classes.map((c, i) => {
      // Count subjects taught
      const subjectSet = new Set();
      Object.values(c.schedule).forEach(e => { if (e.subject) subjectSet.add(e.subject); });

      return `
        <div class="avail-card anim anim-d${Math.min(i%4, 3)}">
          <div class="avail-card-head">
            <div>
              <div class="avail-classid">${c.classId}</div>
              <div class="avail-dept">${c.department} — Year ${c.year} Sem ${c.semester}</div>
            </div>
            <span class="badge ${c.isPublished ? 'badge-green' : 'badge-amber'}">${c.isPublished ? 'Published' : 'Draft'}</span>
          </div>
          <div class="avail-slots">
            <div class="avail-slot"><i class="fas fa-users"></i> Strength: ${c.strength}</div>
            <div class="avail-slot"><i class="fas fa-calendar-alt"></i> Academic: ${c.academicYear}</div>
            <div class="avail-slot"><i class="fas fa-book"></i> Section: ${c.section}</div>
            ${subjectSet.size ? `<div class="avail-slot"><i class="fas fa-list"></i> ${subjectSet.size} subject(s) in timetable</div>` : ''}
          </div>
          ${c.hasTimetable
            ? `<button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;" onclick="AvailClasses.viewTimetable('${c.classId}')">
                <i class="fas fa-table"></i> View Timetable
               </button>`
            : `<button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;opacity:.5;" disabled>
                <i class="fas fa-times-circle"></i> No timetable yet
               </button>`}
        </div>`;
    }).join('');
  },

  async viewTimetable(classId) {
    try {
      const timetables = await api('/timetables');
      const tt = timetables.find(t => t.classId === classId);
      if (!tt) return toast('Timetable not found', 'error');

      const schedule = tt.schedule || {};
      const days     = tt.workingDaysSorted || DAYS;

      const table = `
        <table class="tt" style="font-size:12px;">
          <thead>
            <tr><th>Day</th>${PERIODS.map(p=>`<th>${p}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${days.map(d => `
              <tr>
                <td class="tt-day">${d}</td>
                ${PERIODS.map(p => {
                  const e = schedule[`${d}-${p}`];
                  return e
                    ? `<td><div class="tt-class">${e.subject}</div><div class="tt-sub">${e.faculty||''}</div></td>`
                    : `<td><span class="tt-free">—</span></td>`;
                }).join('')}
              </tr>`).join('')}
          </tbody>
        </table>`;

      // Show in an inline card below the grid
      const existing = $('ttPreview');
      if (existing) existing.remove();

      const preview = document.createElement('div');
      preview.id = 'ttPreview';
      preview.className = 'card anim';
      preview.style.marginTop = '16px';
      preview.innerHTML = `
        <div class="card-title" style="justify-content:space-between;">
          <span><i class="fas fa-table"></i> Timetable: ${classId}</span>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('ttPreview').remove()">✕ Close</button>
        </div>
        <div style="overflow-x:auto;">${table}</div>`;

      $('classGrid').parentElement.appendChild(preview);
      preview.scrollIntoView({ behavior:'smooth', block:'start' });
    } catch(e) { toast(e.message, 'error'); }
  },
};

/* ═══════════════════════════════════════
   SLOT CHANGE REQUESTS — Teacher
   Teacher swaps slots for their own classes.
   Shows timetable slots they are assigned to.
═══════════════════════════════════════ */
Views.slotchange = async (vc) => {
  const teacher = App.user.name || '';

  vc.innerHTML = `
    <div class="page-hdr anim"><h1>Slot Change Requests</h1><p>Swap your assigned slots across your classes.</p></div>

    <!-- New request form -->
    <div class="card anim" style="max-width:620px;">
      <div class="card-title"><i class="fas fa-exchange-alt"></i> New Slot Change</div>
      <div class="form-grid">
        <div class="fg"><label>Your Class</label>
          <select id="scClass"><option value="">Loading your classes…</option></select>
        </div>
        <div class="fg"><label>Date</label>
          <input type="date" id="scDate" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="fg"><label>Current Slot</label>
          <select id="scOld"><option value="">Select current slot</option></select>
        </div>
        <div class="fg"><label>Swap With Slot</label>
          <select id="scNew"><option value="">Select new slot</option></select>
        </div>
        <div class="fg full"><label>Reason</label>
          <textarea id="scReason" placeholder="Brief reason for the swap…" style="height:72px;"></textarea>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="TeacherSlotChange.submit()">
          <i class="fas fa-check"></i> Apply Change
        </button>
        <button class="btn btn-ghost" onclick="TeacherSlotChange.clear()">Clear</button>
      </div>
    </div>

    <!-- Change log -->
    <div class="page-hdr anim anim-d1" style="margin-top:8px;">
      <h1 style="font-size:15px;">Recent Changes This Session</h1>
    </div>
    <div id="scLog" class="anim anim-d2"></div>`;

  await TeacherSlotChange.init(teacher);
};

const TeacherSlotChange = {
  myClasses: [],   // { classId, schedule }
  log: [],

  async init(teacher) {
    const sel = $('scClass');
    try {
      const timetables = await api('/timetables');
      // Only show classes where this teacher has at least one slot
      this.myClasses = timetables
        .filter(tt => Object.values(tt.schedule || {}).some(e => e.faculty === teacher))
        .map(tt => ({ classId: tt.classId, schedule: tt.schedule, _id: tt._id, version: tt.version, assignedHours: tt.assignedHours, totalSlots: tt.totalSlots }));

      sel.innerHTML = '<option value="">Choose your class</option>';
      this.myClasses.forEach(c => sel.innerHTML += `<option value="${c.classId}">${c.classId}</option>`);
      if (!this.myClasses.length) sel.innerHTML = '<option>No classes assigned to you yet</option>';
    } catch {
      sel.innerHTML = '<option>Could not load</option>';
    }

    $('scClass').onchange = () => this.loadSlots();
    this.renderLog();
  },

  loadSlots() {
    const classId = $('scClass').value;
    const cls = this.myClasses.find(c => c.classId === classId);
    if (!cls) return;

    const schedule = cls.schedule || {};
    // All slots in the class timetable
    const allSlots = Object.keys(schedule).sort();
    // My slots (only where I'm the faculty)
    const mySlots  = allSlots.filter(k => schedule[k]?.faculty === App.user.name);

    const myOpts  = mySlots.map(k  => `<option value="${k}">${k} — ${schedule[k].subject}</option>`).join('');
    const allOpts = allSlots.map(k => `<option value="${k}">${k} — ${schedule[k].subject}</option>`).join('');

    $('scOld').innerHTML = '<option value="">Your slots to move</option>' + myOpts;
    $('scNew').innerHTML = '<option value="">Swap with this slot</option>' + allOpts;
  },

  clear() {
    ['scClass','scOld','scNew','scReason'].forEach(id => $(id).value = '');
    $('scOld').innerHTML = '<option value="">Select current slot</option>';
    $('scNew').innerHTML = '<option value="">Select new slot</option>';
    $('scDate').value = new Date().toISOString().split('T')[0];
  },

  async submit() {
    const classId = $('scClass').value;
    const oldSlot = $('scOld').value;
    const newSlot = $('scNew').value;
    const date    = $('scDate').value;
    const reason  = $('scReason').value.trim();

    if (!classId) return toast('Select your class', 'error');
    if (!oldSlot)  return toast('Select the slot to move', 'error');
    if (!newSlot)  return toast('Select the target slot', 'error');
    if (oldSlot === newSlot) return toast('Choose different slots', 'error');

    const cls = this.myClasses.find(c => c.classId === classId);
    if (!cls) return toast('Class not found', 'error');

    try {
      const schedule  = { ...cls.schedule };
      const oldEntry  = schedule[oldSlot];  // teacher's own entry
      const newEntry  = schedule[newSlot];  // entry at target slot (may belong to another teacher)

      if (!oldEntry) return toast(`Slot ${oldSlot} is empty`, 'error');

      // Who gets displaced?
      const displacedTeacher = newEntry?.faculty || null;
      const myName = App.user.name;

      // Perform the swap
      schedule[newSlot] = oldEntry;
      if (newEntry) schedule[oldSlot] = newEntry;
      else delete schedule[oldSlot];

      await api('/timetables/bulk-update', {
        method: 'PUT',
        body: [{
          id:            cls._id,
          schedule,
          assignedHours: cls.assignedHours,
          totalSlots:    cls.totalSlots,
          version:       cls.version,
        }],
      });

      // Update local cache
      cls.schedule = schedule;

      // Notify the displaced teacher if it's a different person
      if (displacedTeacher && displacedTeacher !== myName) {
        // Find displaced teacher's email
        try {
          const teachers = await api('/teachers');
          const displaced = teachers.find(t => t.name === displacedTeacher);
          if (displaced?.email) {
            await fetch(`${API}/notifications/teacher`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recipientEmail: displaced.email,
                type:  'warn',
                title: 'Your slot was moved',
                body:  `${myName} swapped your slot in ${classId}. ` +
                       `Your ${newSlot} (${newEntry.subject}) moved to ${oldSlot}. ` +
                       `Reason: ${reason || 'No reason given'}. Date: ${date}.`,
                swapMeta: {
                  classId,
                  oldSlot,      // swapper's original slot
                  newSlot,      // displaced teacher's original slot
                  swapperEmail: App.user.email,
                  swapperName:  myName,
                },
              }),
            });
          }
        } catch { /* notification failure should not block the swap */ }
      }

      this.log.unshift({ classId, date, oldSlot, newSlot, reason, displacedTeacher, ts: new Date().toLocaleTimeString() });
      this.renderLog();
      toast(`Slot change applied — ${oldSlot} ↔ ${newSlot}${displacedTeacher && displacedTeacher !== myName ? ` · ${displacedTeacher} notified` : ''}`);
      this.clear();
    } catch(e) { toast(e.message, 'error'); }
  },

  renderLog() {
    const container = $('scLog');
    if (!container) return;
    container.innerHTML = this.log.length
      ? this.log.map(c => `
          <div class="change-row anim">
            <span><span class="badge badge-blue">${c.classId}</span></span>
            <span style="font-size:13px;"><strong>${c.oldSlot}</strong> → <strong>${c.newSlot}</strong>
              ${c.reason ? `&nbsp;·&nbsp; ${c.reason}` : ''}
              ${c.displacedTeacher && c.displacedTeacher !== App.user.name ? `&nbsp;·&nbsp; <span style="color:var(--muted)">notified ${c.displacedTeacher}</span>` : ''}
              &nbsp;·&nbsp; ${c.date} ${c.ts}
            </span>
            <span class="badge badge-green">applied</span>
          </div>`).join('')
      : '<p style="color:var(--muted);font-size:13px;">No changes yet this session.</p>';
  },
};

/* ═══════════════════════════════════════
   PROFILE — Teacher
   Loads from API, falls back to session.
   Supports inline Edit → Save.
═══════════════════════════════════════ */
Views.profile = async (vc) => {
  const user = App.user;

  vc.innerHTML = `
    <div class="page-hdr anim"><h1>My Profile</h1><p>View and update your account details.</p></div>

    <!-- Hero banner -->
    <div class="prof-hero anim">
      <div class="prof-avatar" id="profAvatar">${(user.name||'T')[0].toUpperCase()}</div>
      <div class="prof-meta">
        <div class="prof-name"  id="profName">${user.name  || '—'}</div>
        <div class="prof-email" id="profEmail">${user.email || '—'}</div>
        <span class="prof-badge">Teacher</span>
      </div>
      <button class="prof-edit-btn" id="profEditBtn" onclick="TeacherProfile.toggleEdit()">
        <i class="fas fa-edit"></i> Edit Profile
      </button>
    </div>

    <!-- Read-only view -->
    <div class="card anim anim-d1" id="profViewCard">
      <div class="card-title"><i class="fas fa-id-card"></i> Account Details</div>
      <div id="profFieldGrid" class="prof-field-grid">
        <div class="prof-loading"><div class="loader-ring"></div></div>
      </div>
    </div>

    <!-- Edit form (hidden until Edit clicked) -->
    <div class="card anim anim-d1" id="profEditCard" style="display:none;">
      <div class="card-title"><i class="fas fa-pen"></i> Edit Details</div>
      <div class="form-grid">
        <div class="fg"><label>Full Name</label>
          <input id="efName" placeholder="Full name">
        </div>
        <div class="fg"><label>Department</label>
          <input id="efDept" placeholder="Department">
        </div>
        <div class="fg"><label>Qualifications</label>
          <input id="efQual" placeholder="e.g. M.Tech, PhD">
        </div>
        <div class="fg"><label>Role / Designation</label>
          <input id="efRole" placeholder="e.g. HOD, Lecturer">
        </div>
        <div class="fg full"><label>Subjects (comma-separated)</label>
          <input id="efSubjects" placeholder="e.g. Maths, Physics, Chemistry">
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="TeacherProfile.save()">
          <i class="fas fa-save"></i> Save Changes
        </button>
        <button class="btn btn-ghost" onclick="TeacherProfile.toggleEdit()">
          Cancel
        </button>
      </div>
    </div>`;

  await TeacherProfile.load();
};

const TeacherProfile = {
  data: {},
  editing: false,

  async load() {
    const user = App.user;
    try {
      const d = await api(`/profile/teacher?email=${encodeURIComponent(user.email)}`);
      this.data = d;
      this.renderFields(d);
      // Update hero with live data
      const n = $('profName');  if (n) n.textContent  = d.name  || user.name  || '—';
      const e = $('profEmail'); if (e) e.textContent  = d.email || user.email || '—';
      const a = $('profAvatar');if (a) a.textContent  = (d.name||user.name||'T')[0].toUpperCase();
    } catch {
      // Fallback: show whatever is in session
      this.data = {
        name:           user.name  || '',
        email:          user.email || '',
        department:     user.department     || '',
        qualifications: user.qualifications || '',
        role:           user.role           || '',
        subjects:       user.subjects       || [],
      };
      this.renderFields(this.data);
    }
  },

  renderFields(d) {
    const grid = $('profFieldGrid');
    if (!grid) return;

    const fields = [
      { icon:'fa-user',          label:'Full Name',      value: d.name                        || '—' },
      { icon:'fa-envelope',      label:'Email',           value: d.email                       || '—' },
      { icon:'fa-layer-group',   label:'Department',      value: d.department                  || '—' },
      { icon:'fa-graduation-cap',label:'Qualifications',  value: d.qualifications              || '—' },
      { icon:'fa-briefcase',     label:'Designation',     value: d.role                        || '—' },
      { icon:'fa-book',          label:'Subjects',        value: (d.subjects||[]).join(', ')   || '—' },
      { icon:'fa-calendar',      label:'Member Since',    value: d.created_at                  || '—' },
    ];

    grid.innerHTML = fields.map(f => `
      <div class="prof-field">
        <div class="pf-icon"><i class="fas ${f.icon}"></i></div>
        <div class="pf-body">
          <div class="pf-label">${f.label}</div>
          <div class="pf-value">${f.value}</div>
        </div>
      </div>`).join('');
  },

  toggleEdit() {
    this.editing = !this.editing;
    const viewCard = $('profViewCard');
    const editCard = $('profEditCard');
    const btn      = $('profEditBtn');

    if (this.editing) {
      // Populate edit form with current data
      $('efName').value     = this.data.name           || '';
      $('efDept').value     = this.data.department     || '';
      $('efQual').value     = this.data.qualifications || '';
      $('efRole').value     = this.data.role           || '';
      $('efSubjects').value = (this.data.subjects||[]).join(', ');

      viewCard.style.display = 'none';
      editCard.style.display = '';
      btn.innerHTML = '<i class="fas fa-times"></i> Cancel';
    } else {
      viewCard.style.display = '';
      editCard.style.display = 'none';
      btn.innerHTML = '<i class="fas fa-edit"></i> Edit Profile';
    }
  },

  async save() {
    const user     = App.user;
    const name     = $('efName').value.trim();
    const dept     = $('efDept').value.trim();
    const qual     = $('efQual').value.trim();
    const role     = $('efRole').value.trim();
    const subjects = $('efSubjects').value.split(',').map(s => s.trim()).filter(Boolean);

    if (!name) return toast('Name cannot be empty', 'error');

    // Find teacher's _id first, then PUT /teachers/{id}
    try {
      const teachers = await api('/teachers');
      const me = teachers.find(t => t.email === user.email);
      if (!me) throw new Error('Teacher record not found');

      await api(`/teachers/${me._id}`, {
        method: 'PUT',
        body: {
          name, email: user.email,
          department: dept, qualifications: qual,
          role, subjects,
        },
      });

      // Update local data + session
      this.data = { ...this.data, name, department:dept, qualifications:qual, role, subjects };
      const session = JSON.parse(sessionStorage.getItem('user') || '{}');
      sessionStorage.setItem('user', JSON.stringify({
        ...session, name, department:dept, qualifications:qual, subjects,
      }));
      App.user = { ...App.user, name, department:dept, qualifications:qual, subjects };

      // Update sidebar + hero
      $('sidebarName').textContent  = name;
      $('userAvatar').textContent   = name[0].toUpperCase();
      $('profName').textContent     = name;
      $('profAvatar').textContent   = name[0].toUpperCase();

      this.renderFields(this.data);
      this.editing = false;
      $('profViewCard').style.display = '';
      $('profEditCard').style.display = 'none';
      $('profEditBtn').innerHTML = '<i class="fas fa-edit"></i> Edit Profile';

      toast('Profile updated successfully!');
    } catch(e) {
      toast(e.message || 'Save failed', 'error');
    }
  },
};

/* ═══════════════════════════════════════
   NOTIFICATIONS — Teacher
   Shows slot change alerts from other teachers.
   Displaced teacher can Accept or Reject the swap.
═══════════════════════════════════════ */
Views.notifications = async (vc) => {
  const user = App.user;

  vc.innerHTML = `
    <div class="page-hdr anim" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div><h1>Notifications</h1><p>Alerts about slot changes and timetable updates.</p></div>
      <button class="btn btn-ghost btn-sm" onclick="TeacherNotifs.markAll()">
        <i class="fas fa-check-double"></i> Mark all read
      </button>
    </div>
    <div id="notifList" class="notif-list anim"></div>`;

  await TeacherNotifs.load(user.email);
};

const TeacherNotifs = {
  async load(email) {
    const container = $('notifList');
    if (!container) return;
    try {
      const res = await fetch(`${API}/notifications/teacher?email=${encodeURIComponent(email)}`);
      const notifs = await res.json();

      if (!notifs.length) {
        container.innerHTML = '<p style="color:var(--muted);font-size:13px;text-align:center;padding:28px;">No notifications yet.</p>';
        return;
      }

      const unreadCount = notifs.filter(n => !n.read).length;
      const dot = $('notifDot');
      if (dot) { dot.style.display = unreadCount ? '' : 'none'; dot.textContent = unreadCount > 9 ? '9+' : unreadCount; }

      container.innerHTML = notifs.map(n => {
        const isSlotSwap  = n.type === 'warn' && n.body && n.body.includes('swapped your slot');
        const iconMap     = { warn:'fa-exclamation-triangle', info:'fa-info-circle', success:'fa-check-circle', error:'fa-times-circle' };
        const colorMap    = { warn:'ni-warn', info:'ni-info', success:'ni-success', error:'ni-error' };
        const status      = n.status || 'pending';  // pending | accepted | rejected

        // Action buttons only for unread swap notifications that are still pending
        const actionBtns = (isSlotSwap && !n.read && status === 'pending') ? `
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button class="btn btn-success btn-sm" onclick="TeacherNotifs.respond('${n._id}', 'accepted')">
              <i class="fas fa-check"></i> Accept
            </button>
            <button class="btn btn-danger btn-sm" onclick="TeacherNotifs.respond('${n._id}', 'rejected')">
              <i class="fas fa-times"></i> Reject (Reverse Swap)
            </button>
          </div>` : '';

        // Status badge for already-responded notifications
        const statusBadge = (isSlotSwap && status !== 'pending') ? `
          <span class="badge ${status === 'accepted' ? 'badge-green' : 'badge-red'}" style="margin-top:8px;display:inline-block;">
            ${status === 'accepted' ? '✓ Accepted' : '✗ Rejected & Reversed'}
          </span>` : '';

        return `
          <div class="notif-item ${n.read && status !== 'pending' ? '' : 'unread'} anim" id="notif-${n._id}"
               style="flex-direction:column;align-items:flex-start;gap:8px;">
            <div style="display:flex;gap:12px;width:100%;align-items:flex-start;">
              <div class="notif-icon ${colorMap[n.type]||'ni-info'}">
                <i class="fas ${iconMap[n.type]||'fa-bell'}"></i>
              </div>
              <div class="notif-body" style="flex:1;">
                <h4>${n.title}${(!n.read && status === 'pending') ? '<span class="notif-unread-badge"></span>' : ''}</h4>
                <p>${n.body}</p>
                ${statusBadge}
              </div>
              <span class="notif-time" style="flex-shrink:0;">${new Date(n.createdAt).toLocaleString()}</span>
            </div>
            ${actionBtns}
          </div>`;
      }).join('');
    } catch {
      container.innerHTML = '<p style="color:var(--muted);font-size:13px;text-align:center;padding:20px;">Could not load notifications.</p>';
    }
  },

  async respond(notifId, decision) {
    const user = App.user;
    try {
      const res = await fetch(`${API}/notifications/teacher/${notifId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: decision, responderEmail: user.email }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Failed');

      if (decision === 'accepted') {
        toast('Swap accepted — your timetable has been updated.', 'success');
      } else {
        toast('Swap rejected — the original slot arrangement has been restored.', 'info');
      }

      await TeacherNotifs.load(user.email);
    } catch(e) { toast(e.message || 'Could not process response', 'error'); }
  },

  async markOne(id) {
    try {
      await fetch(`${API}/notifications/teacher/${id}/read`, { method: 'PATCH' });
      await TeacherNotifs.load(App.user.email);
    } catch { toast('Could not mark as read', 'error'); }
  },

  async markAll() {
    const user = App.user;
    try {
      await fetch(`${API}/notifications/teacher/read-all?email=${encodeURIComponent(user.email)}`, { method: 'PATCH' });
      toast('All marked as read');
      const dot = $('notifDot');
      if (dot) dot.style.display = 'none';
      await TeacherNotifs.load(user.email);
    } catch { toast('Could not mark all as read', 'error'); }
  },
};

/* ════════════════════════════════════════
   BOOT
════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => App.init());