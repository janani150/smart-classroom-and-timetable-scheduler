/* ═══════════════════════════════════════════════════
   Smart Classroom Student SPA — student.js
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

const DAY_ORDER  = { Mon:0, Tue:1, Wed:2, Thu:3, Fri:4, Sat:5 };
const DAYS       = ['Mon','Tue','Wed','Thu','Fri'];
const PERIOD_TIMES = { P1:'9:00-10:00', P2:'10:00-11:00', P3:'11:00-12:00', P4:'1:00-2:00', P5:'2:00-3:00', P6:'3:00-4:00' };
const PERIODS    = Object.keys(PERIOD_TIMES);

function todayKey() {
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
}

/* ── Fetch latest classId from DB (avoids needing re-login after admin assigns class) ── */
async function fetchLatestClassId(email) {
  try {
    const res = await fetch(`${API}/profile/student?email=${encodeURIComponent(email)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.classId) {
      // Update session so other views benefit
      const session = JSON.parse(sessionStorage.getItem('user') || '{}');
      sessionStorage.setItem('user', JSON.stringify({ ...session, classId: data.classId }));
      App.user.classId = data.classId;
      if ($('topbarClass')) $('topbarClass').textContent = data.classId;
    }
    return data.classId || null;
  } catch {
    return null;
  }
}

/* ════════════════════════════════════════
   APP CORE
════════════════════════════════════════ */
const App = {
  user: {},

  init() {
    this.user = getSession();

    const name  = this.user.name  || 'Student';
    const email = this.user.email || '';
    $('sidebarName').textContent  = name;
    $('sidebarEmail').textContent = email;
    $('userAvatar').textContent   = name[0]?.toUpperCase() || 'S';

    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => {
        this.navigate(el.dataset.view);
        if (window.innerWidth <= 768) this.toggleSidebar(false);
      });
    });

    this.navigate('dashboard');
  },

  navigate(view) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
    const titles = {
      dashboard:'Dashboard', timetable:'My Timetable', upcoming:'Upcoming Classes',
      notifications:'Notifications', profile:'My Profile'
    };
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

  getClassId() {
    return this.user.classId || sessionStorage.getItem('classId') || localStorage.getItem('classId') || '';
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
  const today = todayKey();
  const name  = user.name || 'Student';

  vc.innerHTML = `
    <div class="profile-card anim">
      <div class="profile-avatar">${name[0]?.toUpperCase() || 'S'}</div>
      <div>
        <div class="profile-name">Welcome back, ${name}!</div>
        <div class="profile-meta">
          ${user.department ? user.department + ' &nbsp;&middot;&nbsp; ' : ''}
          ${user.year ? 'Year ' + user.year : ''}
          ${user.section ? ' — Section ' + user.section : ''}
        </div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card anim anim-d1">
        <div class="stat-icon si-teal"><i class="fas fa-calendar-check"></i></div>
        <div><div class="stat-val" id="dToday">—</div><div class="stat-lbl">Classes Today</div></div>
      </div>
      <div class="stat-card anim anim-d1">
        <div class="stat-icon si-blue"><i class="fas fa-clock"></i></div>
        <div><div class="stat-val" id="dNext" style="font-size:14px">—</div><div class="stat-lbl">Next Class</div></div>
      </div>
      <div class="stat-card anim anim-d2">
        <div class="stat-icon si-amber"><i class="fas fa-exchange-alt"></i></div>
        <div><div class="stat-val" id="dSlots">0</div><div class="stat-lbl">Slot Requests</div></div>
      </div>
      <div class="stat-card anim anim-d2">
        <div class="stat-icon si-purple"><i class="fas fa-bell"></i></div>
        <div><div class="stat-val" id="dNotifs">0</div><div class="stat-lbl">Notifications</div></div>
      </div>
    </div>

    <div class="card anim anim-d2">
      <div class="card-title"><i class="fas fa-bolt"></i> Quick Actions</div>
      <div class="quick-actions">
        <button class="qa-btn qa-teal" onclick="App.navigate('timetable')"><i class="fas fa-calendar-alt"></i> View Timetable</button>
        <button class="qa-btn qa-ghost" onclick="App.navigate('upcoming')"><i class="fas fa-clock"></i> Upcoming Classes</button>
        <button class="qa-btn qa-ghost" onclick="App.navigate('slotchange')"><i class="fas fa-exchange-alt"></i> Request Slot Change</button>
        <button class="qa-btn qa-ghost" onclick="App.navigate('notifications')"><i class="fas fa-bell"></i> Notifications</button>
      </div>
    </div>

    <div class="card anim anim-d3">
      <div class="card-title"><i class="fas fa-sun"></i> Today (${today})</div>
      <div id="todaySlots"><p style="color:var(--muted);font-size:13px;">Loading today's schedule...</p></div>
    </div>`;

  // Get latest classId (fetches from DB in case admin just assigned)
  let classId = App.getClassId();
  const latestClassId = await fetchLatestClassId(user.email);
  if (latestClassId) classId = latestClassId;
  if (classId) $('topbarClass').textContent = classId;

  if (classId) {
    try {
      const res = await fetch(`${API}/student/timetable?classId=${encodeURIComponent(classId)}`);
      const data = await res.json();
      const schedule = data.schedule || {};

      const todayClasses = PERIODS.map(p => schedule[`${today}-${p}`]).filter(Boolean);
      $('dToday').textContent = todayClasses.length;

      const nowH = new Date().getHours();
      const periodStartH = { P1:9, P2:10, P3:11, P4:13, P5:14, P6:15 };
      const nextEntry = PERIODS.find(p => {
        const e = schedule[`${today}-${p}`];
        return e && (periodStartH[p] || 0) >= nowH;
      });
      if (nextEntry) {
        const e = schedule[`${today}-${nextEntry}`];
        $('dNext').textContent = e ? e.subject : '—';
      } else {
        $('dNext').textContent = 'Done for today';
        $('dNext').style.fontSize = '12px';
      }

      const container = $('todaySlots');
      if (todayClasses.length === 0) {
        container.innerHTML = '<p style="color:var(--muted);font-size:13px;">No classes scheduled today.</p>';
      } else {
        container.innerHTML = `<div class="class-list">${PERIODS.map(p => {
          const e = schedule[`${today}-${p}`];
          if (!e) return '';
          const isNow = (periodStartH[p] || 0) >= nowH && (periodStartH[p] || 0) < nowH + 1;
          return `<div class="class-card ${isNow ? 'now' : ''}">
            <div class="class-card-time">
              <div class="class-time-lbl">Period</div>
              <div class="class-time-val">${p}</div>
            </div>
            <div class="class-card-info">
              <h3>${e.subject}</h3>
              <p>${e.faculty || ''}</p>
            </div>
            <span class="class-period">${PERIOD_TIMES[p] || ''}</span>
          </div>`;
        }).join('')}</div>`;
      }
    } catch {
      $('todaySlots').innerHTML = '<p style="color:var(--muted);font-size:13px;">Could not load today\'s schedule.</p>';
    }
  } else {
    $('todaySlots').innerHTML = `
      <div style="text-align:center;padding:12px 0;">
        <i class="fas fa-unlink" style="font-size:28px;color:var(--muted);opacity:.35;display:block;margin-bottom:10px;"></i>
        <p style="font-size:13px;color:var(--muted);line-height:1.7;">
          No class linked yet. Ask your admin to assign you to a class.
        </p>
        <button class="qa-btn qa-ghost" style="margin-top:10px;" onclick="App.navigate('timetable')">
          <i class="fas fa-info-circle"></i> See details
        </button>
      </div>`;
  }

  const slotLog   = JSON.parse(sessionStorage.getItem('studentSlotLog')   || '[]');
  const notifList = JSON.parse(sessionStorage.getItem('studentNotifList') || '[]');
  $('dSlots').textContent  = slotLog.length;
  $('dNotifs').textContent = notifList.filter(n => n.unread).length;
  if (notifList.some(n => n.unread)) $('notifDot').style.display = '';
};

/* ─────────────────────────────
   TIMETABLE
───────────────────────────── */
Views.timetable = async (vc) => {
  const user  = App.user;
  const today = todayKey();

  vc.innerHTML = `
    <div class="page-hdr anim"><h1>My Timetable</h1><p>Full weekly schedule for your class.</p></div>
    <div class="card anim" style="padding:0;overflow:hidden;">
      <div id="ttWrap" style="overflow-x:auto;padding:0;">
        <p style="padding:24px;color:var(--muted);text-align:center;">Loading timetable...</p>
      </div>
    </div>
    <p class="anim anim-d1" style="font-size:12px;color:var(--muted);margin-top:4px;">
      <i class="fas fa-circle" style="color:var(--accent);font-size:9px;"></i> Highlighted row = today
    </p>`;

  // Always fetch latest classId from DB — no re-login needed after admin assigns
  let classId = App.getClassId();
  const latestClassId = await fetchLatestClassId(user.email);
  if (latestClassId) classId = latestClassId;

  // No classId
  if (!classId) {
    $('ttWrap').innerHTML = `
      <div style="padding:32px;text-align:center;">
        <i class="fas fa-unlink" style="font-size:38px;color:var(--muted);opacity:.35;display:block;margin-bottom:14px;"></i>
        <p style="font-weight:600;color:var(--text);margin-bottom:8px;">No class linked to your account</p>
        <p style="font-size:13px;color:var(--muted);line-height:1.7;">
          Your account <strong>${user.email || ''}</strong> has not been assigned to a class yet.<br>
          Ask your admin to go to <strong>Dashboard → Students</strong>, find your name and click <strong>Assign Class</strong>.
        </p>
        <div style="margin-top:16px;background:var(--accent-light);border-radius:10px;padding:12px 16px;display:inline-block;text-align:left;">
          <p style="font-size:12px;font-weight:700;color:var(--accent-dk);margin-bottom:4px;">Steps:</p>
          <ol style="font-size:12px;color:var(--accent-dk);padding-left:18px;line-height:1.9;">
            <li>Admin → Dashboard → click <strong>Students</strong></li>
            <li>Find your name → click <strong>Assign Class</strong></li>
            <li>Select your class → Save</li>
            <li>Click <strong>Refresh</strong> below</li>
          </ol>
        </div>
        <br>
        <button class="btn btn-primary" style="margin-top:14px;" onclick="App.navigate('timetable')">
          <i class="fas fa-sync"></i> Refresh
        </button>
      </div>`;
    return;
  }

  // Fetch timetable
  try {
    const res  = await fetch(`${API}/student/timetable?classId=${encodeURIComponent(classId)}`);
    const data = await res.json();

    if (!res.ok) {
      $('ttWrap').innerHTML = `
        <div style="padding:32px;text-align:center;">
          <i class="fas fa-clock" style="font-size:38px;color:var(--muted);opacity:.35;display:block;margin-bottom:14px;"></i>
          <p style="font-weight:600;color:var(--text);margin-bottom:8px;">Timetable not published yet</p>
          <p style="font-size:13px;color:var(--muted);line-height:1.7;">
            Your class is <strong>${classId}</strong>.<br>
            ${res.status === 404
              ? 'The admin has not published the timetable yet.<br>Ask them to go to <strong>Timetable Viewer → Publish</strong>.'
              : (data.detail || data.message || 'An error occurred.')}
          </p>
          <button class="btn btn-primary" style="margin-top:14px;" onclick="App.navigate('timetable')">
            <i class="fas fa-sync"></i> Refresh
          </button>
        </div>`;
      return;
    }

    const schedule = data.schedule || {};
    const days     = data.workingDaysSorted || DAYS;

    if (!Object.keys(schedule).length) {
      $('ttWrap').innerHTML = `
        <div style="padding:32px;text-align:center;">
          <i class="fas fa-calendar-times" style="font-size:38px;color:var(--muted);opacity:.35;display:block;margin-bottom:14px;"></i>
          <p style="font-weight:600;color:var(--text);margin-bottom:8px;">Timetable is empty</p>
          <p style="font-size:13px;color:var(--muted);">
            Class <strong>${classId}</strong> timetable has no subjects assigned.<br>
            Ask admin to add subjects and regenerate.
          </p>
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
          ${days.map(day => `
            <tr class="${day === today ? 'tt-today' : ''}">
              <td class="tt-day">${day}${day === today ? ' <span style="font-size:9px;background:var(--accent);color:#fff;border-radius:4px;padding:1px 5px;vertical-align:middle;">TODAY</span>' : ''}</td>
              ${PERIODS.map(p => {
                const e = schedule[`${day}-${p}`];
                return e
                  ? `<td><div class="tt-subject">${e.subject}</div><div class="tt-faculty">${e.faculty || ''}</div></td>`
                  : `<td><span class="tt-free">—</span></td>`;
              }).join('')}
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch(e) {
    $('ttWrap').innerHTML = `
      <div style="padding:28px;text-align:center;">
        <i class="fas fa-exclamation-triangle" style="font-size:32px;color:#f59e0b;display:block;margin-bottom:10px;"></i>
        <p style="color:var(--muted);font-size:13px;">${e.message || 'Could not load timetable. Check if the backend is running.'}</p>
        <button class="btn btn-primary" style="margin-top:12px;" onclick="App.navigate('timetable')">
          <i class="fas fa-sync"></i> Retry
        </button>
      </div>`;
  }
};

/* ─────────────────────────────
   UPCOMING CLASSES
───────────────────────────── */
Views.upcoming = async (vc) => {
  const user  = App.user;
  const today = todayKey();

  vc.innerHTML = `
    <div class="page-hdr anim"><h1>Upcoming Classes</h1><p>Your next sessions this week.</p></div>
    <div id="upcomingList"></div>`;

  let classId = App.getClassId();
  const latestClassId = await fetchLatestClassId(user.email);
  if (latestClassId) classId = latestClassId;

  if (!classId) {
    $('upcomingList').innerHTML = '<div class="card"><p style="color:var(--muted);">No class ID found. Ask admin to assign you to a class.</p></div>';
    return;
  }

  try {
    const res = await fetch(`${API}/student/timetable?classId=${encodeURIComponent(classId)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Timetable not published yet');

    const schedule = data.schedule || {};
    const days     = data.workingDaysSorted || DAYS;
    const nowH     = new Date().getHours();
    const periodStartH = { P1:9, P2:10, P3:11, P4:13, P5:14, P6:15 };
    const todayIdx = DAY_ORDER[today] ?? -1;

    const container = $('upcomingList');
    let html = '';
    let anyFound = false;

    days.forEach((day, di) => {
      const dayIdx  = DAY_ORDER[day] ?? di;
      const isToday = day === today;
      const entries = PERIODS.map(p => {
        const e = schedule[`${day}-${p}`];
        if (!e) return null;
        const startH = periodStartH[p] || 0;
        if (isToday && startH < nowH) return null;
        return { period: p, startH, ...e };
      }).filter(Boolean);

      if (!entries.length) return;
      if (dayIdx < todayIdx) return;

      anyFound = true;
      html += `<div class="day-label anim">${isToday ? 'Today' : day}</div>
        <div class="class-list">
          ${entries.map((e, idx) => {
            const isNow = isToday && e.startH === nowH;
            return `<div class="class-card ${isNow ? 'now' : ''} anim anim-d${Math.min(idx,3)}">
              <div class="class-card-time">
                <div class="class-time-lbl">${e.period}</div>
                <div class="class-time-val">${PERIOD_TIMES[e.period] || ''}</div>
              </div>
              <div class="class-card-info">
                <h3>${e.subject}</h3>
                <p>${e.faculty || 'Faculty TBA'}</p>
              </div>
              <span style="background:var(--accent-light);color:var(--accent-dk);padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;">
                ${isNow ? 'Now' : 'Upcoming'}
              </span>
            </div>`;
          }).join('')}
        </div>`;
    });

    container.innerHTML = anyFound ? html : '<div class="card"><p style="color:var(--muted);text-align:center;padding:20px;">No more classes this week!</p></div>';
  } catch(e) {
    $('upcomingList').innerHTML = `<div class="card"><p style="color:var(--muted);">${e.message}</p></div>`;
  }
};

/* ─────────────────────────────
   NOTIFICATIONS
───────────────────────────── */
Views.notifications = async (vc) => {
  vc.innerHTML = `
    <div class="page-hdr anim"><h1>Notifications</h1><p>Timetable updates and alerts.</p></div>
    <div style="display:flex;gap:10px;margin-bottom:14px;" class="anim">
      <button class="btn btn-primary btn-sm" onclick="Notifs.markAllRead()"><i class="fas fa-check-double"></i> Mark all read</button>
      <button class="btn btn-ghost btn-sm"   onclick="Notifs.clear()"><i class="fas fa-trash"></i> Clear all</button>
    </div>
    <div id="notifList" class="notif-list"></div>`;

  Notifs.render();
  $('notifDot').style.display = 'none';
};

const Notifs = {
  defaultNotifs() {
    return [
      { id:1, type:'info',    icon:'ni-info',    title:'Timetable published',        body:'Your class timetable has been published by the admin.', time:'Just now',   unread:true  },
      { id:2, type:'warn',    icon:'ni-warn',    title:'Slot change request pending', body:'Your request is awaiting admin approval.',              time:'5 min ago',  unread:true  },
      { id:3, type:'success', icon:'ni-success', title:'Timetable updated',           body:'A slot change was applied to your schedule.',           time:'1 hour ago', unread:false },
      { id:4, type:'info',    icon:'ni-info',    title:'New week schedule available', body:'Week schedule has been updated. Check your timetable.', time:'Yesterday',  unread:false },
    ];
  },
  getList() {
    const raw = sessionStorage.getItem('studentNotifList');
    return raw ? JSON.parse(raw) : this.defaultNotifs();
  },
  save(list) { sessionStorage.setItem('studentNotifList', JSON.stringify(list)); },
  markAllRead() {
    const list = this.getList().map(n => ({...n, unread:false}));
    this.save(list);
    $('notifDot').style.display = 'none';
    this.render();
    toast('All marked as read');
  },
  clear() {
    this.save([]);
    $('notifDot').style.display = 'none';
    this.render();
    toast('Cleared');
  },
  render() {
    const list      = this.getList();
    const container = $('notifList');
    if (!container) return;
    container.innerHTML = list.length
      ? list.map(n => `
          <div class="notif-item ${n.unread ? 'unread' : ''} anim">
            <div class="notif-icon ${n.icon}"><i class="fas ${n.type==='info'?'fa-info-circle':n.type==='success'?'fa-check-circle':n.type==='warn'?'fa-exclamation-triangle':'fa-bell'}"></i></div>
            <div class="notif-body">
              <h4>${n.title}${n.unread ? '<span class="notif-unread-badge"></span>' : ''}</h4>
              <p>${n.body}</p>
            </div>
            <span class="notif-time">${n.time}</span>
          </div>`).join('')
      : '<p style="color:var(--muted);font-size:13px;text-align:center;padding:20px;">No notifications.</p>';
  },
};

/* ─────────────────────────────
   PROFILE
───────────────────────────── */
Views.profile = async (vc) => {
  const user = App.user;

  vc.innerHTML = `
    <div class="page-hdr anim"><h1>My Profile</h1><p>View and update your account details.</p></div>
    <div class="prof-hero anim">
      <div class="prof-avatar" id="profAvatar">${(user.name||'S')[0].toUpperCase()}</div>
      <div class="prof-meta">
        <div class="prof-name"  id="profName">${user.name  || '—'}</div>
        <div class="prof-email" id="profEmail">${user.email || '—'}</div>
        <span class="prof-badge">Student</span>
      </div>
      <button class="prof-edit-btn" id="profEditBtn" onclick="StudentProfile.toggleEdit()">
        <i class="fas fa-edit"></i> Edit Profile
      </button>
    </div>
    <div class="card anim anim-d1" id="profViewCard">
      <div class="card-title"><i class="fas fa-id-card"></i> Account Details</div>
      <div id="profFieldGrid" class="prof-field-grid">
        <div class="prof-loading"><div class="loader-ring"></div></div>
      </div>
    </div>
    <div class="card anim anim-d1" id="profEditCard" style="display:none;">
      <div class="card-title"><i class="fas fa-pen"></i> Edit Details</div>
      <div class="form-grid">
        <div class="fg"><label>Full Name</label><input id="efName" placeholder="Your full name"></div>
        <div class="fg"><label>Department</label>
          <input id="efDept" disabled style="opacity:.6;cursor:not-allowed;" title="Contact admin to change">
        </div>
        <div class="fg"><label>Year</label>
          <select id="efYear">
            <option value="1">Year 1</option><option value="2">Year 2</option>
            <option value="3">Year 3</option><option value="4">Year 4</option>
          </select>
        </div>
        <div class="fg"><label>Section</label>
          <select id="efSection">
            <option value="A">Section A</option><option value="B">Section B</option>
            <option value="C">Section C</option><option value="D">Section D</option>
          </select>
        </div>
        <div class="fg"><label>Phone (optional)</label><input id="efPhone" placeholder="9876543210"></div>
      </div>
      <p style="font-size:12px;color:var(--muted);margin-top:8px;">
        <i class="fas fa-info-circle"></i> Department and Class ID can only be changed by your admin.
      </p>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="StudentProfile.save()"><i class="fas fa-save"></i> Save Changes</button>
        <button class="btn btn-ghost" onclick="StudentProfile.toggleEdit()">Cancel</button>
      </div>
    </div>`;

  await StudentProfile.load();
};

const StudentProfile = {
  data: {},
  editing: false,

  async load() {
    const user = App.user;
    try {
      const res = await fetch(`${API}/profile/student?email=${encodeURIComponent(user.email)}`);
      if (!res.ok) throw new Error('Could not load profile');
      const d = await res.json();
      this.data = d;

      // Update session with latest classId
      if (d.classId) {
        const session = JSON.parse(sessionStorage.getItem('user') || '{}');
        sessionStorage.setItem('user', JSON.stringify({ ...session, classId: d.classId }));
        App.user.classId = d.classId;
        if ($('topbarClass')) $('topbarClass').textContent = d.classId;
      }

      this.renderFields(d);
      const n = $('profName');  if (n) n.textContent = d.name  || user.name  || '—';
      const e = $('profEmail'); if (e) e.textContent = d.email || user.email || '—';
      const a = $('profAvatar');if (a) a.textContent = (d.name||user.name||'S')[0].toUpperCase();
    } catch {
      this.data = {
        name: user.name||'', email: user.email||'',
        department: user.department||'', year: user.year||'',
        section: user.section||'', classId: user.classId||'',
      };
      this.renderFields(this.data);
    }
  },

  renderFields(d) {
    const grid = $('profFieldGrid');
    if (!grid) return;
    const fields = [
      { icon:'fa-user',         label:'Full Name',   value: d.name                         || '—' },
      { icon:'fa-envelope',     label:'Email',        value: d.email                        || '—' },
      { icon:'fa-layer-group',  label:'Department',   value: d.department                   || '—' },
      { icon:'fa-calendar-alt', label:'Year',         value: d.year ? `Year ${d.year}`      : '—' },
      { icon:'fa-bookmark',     label:'Section',      value: d.section                      || '—' },
      { icon:'fa-id-badge',     label:'Class ID',     value: d.classId                      || 'Not assigned yet' },
      { icon:'fa-phone',        label:'Phone',        value: d.phone                        || '—' },
      { icon:'fa-calendar',     label:'Member Since', value: d.created_at                   || '—' },
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
    if (this.editing) {
      $('efName').value    = this.data.name       || '';
      $('efDept').value    = this.data.department || '';
      $('efYear').value    = this.data.year       || '1';
      $('efSection').value = this.data.section    || 'A';
      $('efPhone').value   = this.data.phone      || '';
      $('profViewCard').style.display = 'none';
      $('profEditCard').style.display = '';
      $('profEditBtn').innerHTML = '<i class="fas fa-times"></i> Cancel';
    } else {
      $('profViewCard').style.display = '';
      $('profEditCard').style.display = 'none';
      $('profEditBtn').innerHTML = '<i class="fas fa-edit"></i> Edit Profile';
    }
  },

  async save() {
    const user    = App.user;
    const name    = $('efName').value.trim();
    const year    = parseInt($('efYear').value);
    const section = $('efSection').value;
    const phone   = $('efPhone').value.trim();
    if (!name) return toast('Name cannot be empty', 'error');
    try {
      const students = await fetch(`${API}/students`).then(r => r.json());
      const me = students.find(s => s.email === user.email);
      if (me && me.student_id) {
        await fetch(`${API}/students/${me.student_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email: user.email, department: this.data.department||'', year, section, phone }),
        });
      }
      this.data = { ...this.data, name, year, section, phone };
      const session = JSON.parse(sessionStorage.getItem('user') || '{}');
      sessionStorage.setItem('user', JSON.stringify({ ...session, name, year, section }));
      App.user = { ...App.user, name, year, section };
      $('sidebarName').textContent = name;
      $('userAvatar').textContent  = name[0].toUpperCase();
      $('profName').textContent    = name;
      $('profAvatar').textContent  = name[0].toUpperCase();
      this.renderFields(this.data);
      this.editing = false;
      $('profViewCard').style.display = '';
      $('profEditCard').style.display = 'none';
      $('profEditBtn').innerHTML = '<i class="fas fa-edit"></i> Edit Profile';
      toast('Profile updated successfully!');
    } catch(e) { toast(e.message || 'Save failed', 'error'); }
  },
};

/* ════════════════════════════════════════
   BOOT
════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => App.init());