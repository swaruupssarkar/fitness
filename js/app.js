/* ─── App ─ Router, Dashboard, Plans, History, Toast ─────────── */
const App = (() => {

  /* ── Toast ──────────────────────────────────────────────────── */
  function toast(msg, type = 'success', ms = 2600) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
  }

  /* ── Navigate ───────────────────────────────────────────────── */
  function navigate(view) { location.hash = view; }

  /* ── Calendar state ─────────────────────────────────────────── */
  const today0    = new Date();
  const calState  = { year: today0.getFullYear(), month: today0.getMonth(), weekOffset: 0 };
  const CAL_MIN   = { year: 2026, month: 0 };
  const CAL_MAX   = { year: 2050, month: 11 };

  /* ── Calendar helpers ───────────────────────────────────────── */
  function _calPlanHelpers(plan) {
    const scheduleMap = {};
    if (plan) {
      for (const pd of plan.days) {
        if (pd.weekDay !== null && pd.weekDay !== undefined && pd.weekDay !== '') {
          scheduleMap[parseInt(pd.weekDay)] = pd.name;
        }
      }
    }
    const planDays  = plan ? plan.days : [];
    const daysCount = planDays.length;
    const planStart = (plan && plan.startDate) ? new Date(plan.startDate + 'T00:00:00') : null;
    return { scheduleMap, planDays, daysCount, planStart };
  }

  function _calPlannedName(cellDate, dow, session, helpers) {
    if (session) return null;
    const { scheduleMap, planDays, daysCount, planStart } = helpers;
    // If any days have explicit weekday assignments, always use DOW-based scheduling.
    // startDate sequential cycling only applies to plans with no weekday assignments (e.g. PPL).
    if (Object.keys(scheduleMap).length > 0) {
      const name = scheduleMap[dow];
      if (!name) return null; // unscheduled day = rest
      return name.toLowerCase().includes('rest') ? null : name;
    }
    // Sequential cycling (no weekday assignments, startDate drives the cycle)
    if (planStart && daysCount > 0) {
      const daysSinceStart = Math.floor((cellDate - planStart) / 86400000);
      if (daysSinceStart >= 0) {
        const pd = planDays[daysSinceStart % daysCount];
        return pd.name.toLowerCase().includes('rest') ? null : pd.name;
      }
      return null;
    }
    return null;
  }

  const EDIT_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  const DOW_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  /* ── Month calendar (desktop) ───────────────────────────────── */
  function buildMonthCalendar(plan, todayStr) {
    const { year, month } = calState;
    const monthName = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const canPrev = !(year === CAL_MIN.year && month === CAL_MIN.month);
    const canNext = !(year === CAL_MAX.year && month === CAL_MAX.month);

    const helpers    = _calPlanHelpers(plan);
    const firstDay   = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let cells = '';
    for (let i = 0; i < firstDay; i++) cells += `<div class="month-cell month-empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const mm       = String(month + 1).padStart(2, '0');
      const dd       = String(d).padStart(2, '0');
      const date     = `${year}-${mm}-${dd}`;
      const cellDate = new Date(year, month, d);
      const dow      = cellDate.getDay();
      const logs     = Storage.getLogs().filter(l => l.date === date);
      const session  = logs.length ? logs[0].dayName : null;
      const isToday  = date === todayStr;
      const plannedDayName = _calPlannedName(cellDate, dow, session, helpers);
      const missed   = !!plannedDayName && date < todayStr;
      const planned  = !!plannedDayName && date >= todayStr;
      cells += `
        <div class="month-cell${session ? ' cal-active' : ''}${missed ? ' cal-missed' : ''}${planned ? ' cal-planned' : ''}${isToday ? ' cal-today' : ''}">
          <span class="month-day-num${isToday ? ' today-num' : ''}">${d}</span>
          ${session  ? `<div class="month-session">${session}</div>` : ''}
          ${missed   ? `<div class="month-missed-label">${plannedDayName}</div>` : ''}
          ${planned  ? `<div class="month-planned">${plannedDayName}</div>` : ''}
          ${logs.length ? `<button class="cal-edit-btn" data-id="${logs[0].id}">${EDIT_SVG} Edit</button>` : ''}
        </div>`;
    }

    return `
      <div class="month-nav">
        <button class="btn-month-nav" id="btn-cal-prev" ${canPrev ? '' : 'disabled'}>‹</button>
        <span class="month-title">${monthName}</span>
        <button class="btn-month-nav" id="btn-cal-next" ${canNext ? '' : 'disabled'}>›</button>
      </div>
      <div class="month-dow-row">
        ${DOW_LABELS.map(d => `<div class="month-dow">${d}</div>`).join('')}
      </div>
      <div class="month-grid">${cells}</div>`;
  }

  /* ── Week calendar (mobile) ─────────────────────────────────── */
  function buildWeekCalendar(plan, todayStr) {
    const today    = new Date(todayStr + 'T00:00:00');
    const sundayOfToday = new Date(today);
    sundayOfToday.setDate(today.getDate() - today.getDay());

    const weekStart = new Date(sundayOfToday);
    weekStart.setDate(sundayOfToday.getDate() + calState.weekOffset * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const helpers = _calPlanHelpers(plan);

    const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const weekLabel = `${fmt(weekStart)} – ${fmt(weekEnd)}, ${weekEnd.getFullYear()}`;

    let rows = '';
    for (let i = 0; i < 7; i++) {
      const cellDate = new Date(weekStart);
      cellDate.setDate(weekStart.getDate() + i);
      const y    = cellDate.getFullYear();
      const m    = String(cellDate.getMonth() + 1).padStart(2, '0');
      const d    = String(cellDate.getDate()).padStart(2, '0');
      const date = `${y}-${m}-${d}`;
      const dow  = cellDate.getDay();
      const logs = Storage.getLogs().filter(l => l.date === date);
      const session = logs.length ? logs[0].dayName : null;
      const isToday = date === todayStr;
      const plannedDayName = _calPlannedName(cellDate, dow, session, helpers);
      const missed   = !!plannedDayName && date < todayStr;
      const planned  = !!plannedDayName && date >= todayStr;

      // Status badge
      let badge = '';
      if (session)       badge = `<span class="wday-badge wday-logged">${session}</span>`;
      else if (missed)   badge = `<span class="wday-badge wday-missed">${plannedDayName}</span>`;
      else if (planned)  badge = `<span class="wday-badge wday-planned">${plannedDayName}</span>`;
      else               badge = `<span class="wday-badge wday-rest">Rest</span>`;

      const isPast = date < todayStr;
      rows += `
        <div class="wday-row${isToday ? ' wday-today' : ''}${session ? ' wday-active' : ''}${missed ? ' wday-is-missed' : ''}${planned ? ' wday-is-planned' : ''}">
          <div class="wday-date-col">
            <span class="wday-dow">${DOW_LABELS[dow]}</span>
            <span class="wday-num${isToday ? ' today-num' : ''}">${cellDate.getDate()}</span>
          </div>
          <div class="wday-content">${badge}</div>
          <div class="wday-action">
            ${logs.length
              ? `<button class="wday-edit-btn cal-edit-btn" data-id="${logs[0].id}">${EDIT_SVG}&nbsp;Edit</button>`
              : isPast
                ? `<button class="wday-log-btn wday-log-past-btn" data-log-date="${date}">+ Log Past</button>`
                : (isToday || planned ? `<button class="wday-log-btn wday-log-past-btn" data-log-date="${date}">+ Log</button>` : '')}
          </div>
        </div>`;
    }

    return `
      <div class="month-nav">
        <button class="btn-month-nav" id="btn-cal-prev">‹</button>
        <span class="month-title">${weekLabel}</span>
        <button class="btn-month-nav" id="btn-cal-next">›</button>
      </div>
      <div class="wday-list">${rows}</div>`;
  }

  /* ── Calendar dispatcher ────────────────────────────────────── */
  function buildCalendar(plan, todayStr) {
    return window.innerWidth < 768
      ? buildWeekCalendar(plan, todayStr)
      : buildMonthCalendar(plan, todayStr);
  }

  function bindCalendarEvents() {
    document.querySelectorAll('.cal-edit-btn').forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      Logger.editLog(btn.dataset.id);
    }));
    document.querySelectorAll('.wday-log-past-btn').forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      Logger.openForDate(btn.dataset.logDate);
    }));
    const prev = document.getElementById('btn-cal-prev');
    const next = document.getElementById('btn-cal-next');
    const isMobile = window.innerWidth < 768;
    if (prev) prev.addEventListener('click', () => {
      if (isMobile) { calState.weekOffset--; }
      else {
        if (calState.month === 0) { calState.month = 11; calState.year--; }
        else calState.month--;
      }
      renderDashboard();
    });
    if (next) next.addEventListener('click', () => {
      if (isMobile) { calState.weekOffset++; }
      else {
        if (calState.month === 11) { calState.month = 0; calState.year++; }
        else calState.month++;
      }
      renderDashboard();
    });
  }

  /* ── Dashboard ──────────────────────────────────────────────── */
  function getGreeting() {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return 'Good Morning';
    if (h >= 12 && h < 17) return 'Good Afternoon';
    if (h >= 17 && h < 21) return 'Good Evening';
    return 'Good Night';
  }

  function renderDashboard() {
    const el       = document.getElementById('view-dashboard');
    const plan       = Plans.getActivePlan();
    const monthCount = Metrics.getMonthlyWorkoutCount();
    const topLift    = Metrics.getWeekTopLift();
    const total    = Metrics.getTotalWorkouts();
    const avgDur   = Metrics.getAvgSessionDuration();
    const todayStr   = new Date().toISOString().slice(0, 10);
    const doneToday  = Storage.getLogs().some(l => l.date === todayStr);
    const todayCellDate = new Date(todayStr + 'T00:00:00');
    const todayDow   = todayCellDate.getDay();
    const todayWorkout = plan ? _calPlannedName(todayCellDate, todayDow, doneToday ? 'done' : null, _calPlanHelpers(plan)) : null;
    const isRestDay  = plan && !doneToday && !todayWorkout && Object.keys(_calPlanHelpers(plan).scheduleMap).length > 0;

    el.innerHTML = `
      <div class="view-header">
        <h1 class="greeting-heading">${getGreeting()}, ${(Auth.getUser()?.displayName || 'there').split(' ')[0]} 👋</h1>
        <p class="subtitle">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
      </div>

      <div class="plan-badge">
        <span class="plan-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        </span>
        <strong>${plan ? plan.name : 'No plan set'}</strong>
        <a href="#plans" class="plan-switch-link">Switch</a>
      </div>

      <div class="metrics-grid">
        <div class="metric-card accent">
          <div class="metric-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>
          </div>
          <div class="metric-value">${monthCount}</div>
          <div class="metric-label">This Month</div>
        </div>
        <div class="metric-card">
          <div class="metric-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 5h2M16 5h2M4 5a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1"/><path d="M6 5V3M18 5V3M8 8v8M16 8v8M4 16a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1"/></svg>
          </div>
          <div class="metric-value">${topLift ? topLift.weight + ' kg' : '—'}</div>
          <div class="metric-label">${topLift ? topLift.name : 'Top Lift This Week'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div class="metric-value">${total}</div>
          <div class="metric-label">Total Workouts</div>
        </div>
        <div class="metric-card">
          <div class="metric-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="metric-value">${avgDur ? (avgDur >= 60 ? Math.floor(avgDur/60)+'h '+avgDur%60+'m' : avgDur+'m') : '—'}</div>
          <div class="metric-label">Avg Session</div>
        </div>
      </div>

      <div class="cta-section">
        ${doneToday
          ? `<p class="logged-today">✅ Workout logged today — keep it up!</p>
             <div class="cta-row">
               <a href="#log" class="btn btn-secondary">+ Log Another</a>
               <button class="btn btn-outline" id="btn-edit-log-toggle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit Log</button>
             </div>`
          : isRestDay
          ? `<div class="rest-day-banner">
               <span class="rest-day-icon">😴</span>
               <div>
                 <p class="rest-day-title">Rest Day</p>
                 <p class="rest-day-sub">Today is not scheduled in your plan — take it easy.</p>
               </div>
               <a href="#log" class="btn btn-outline btn-sm">Log Anyway</a>
             </div>`
          : `<div class="cta-row">
               <a href="#log" class="btn btn-primary btn-lg">${todayWorkout ? `Log ${todayWorkout} →` : `Log Today's Workout →`}</a>
               <button class="btn btn-outline" id="btn-edit-log-toggle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit Log</button>
             </div>`
        }
        <div class="edit-log-picker" id="edit-log-picker" style="display:none;">
          <input type="date" id="edit-log-date" class="input log-date-input"
                 value="${todayStr}" max="${todayStr}">
          <button class="btn btn-primary" id="btn-edit-log-load">Load</button>
          <button class="btn btn-ghost" id="btn-edit-log-cancel">Cancel</button>
        </div>
      </div>

      <div class="section">
        ${buildCalendar(plan, todayStr)}
      </div>`;

    bindCalendarEvents();

    const toggleBtn  = document.getElementById('btn-edit-log-toggle');
    const picker     = document.getElementById('edit-log-picker');
    const cancelBtn  = document.getElementById('btn-edit-log-cancel');
    const loadBtn    = document.getElementById('btn-edit-log-load');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
      });
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => { picker.style.display = 'none'; });
    }
    if (loadBtn) {
      loadBtn.addEventListener('click', () => {
        const dateVal = document.getElementById('edit-log-date').value;
        if (!dateVal) { toast('Please select a date.', 'error'); return; }
        const log = Storage.getLogs().find(l => l.date === dateVal);
        if (!log) { toast(`No workout logged on ${dateVal}.`, 'error'); return; }
        picker.style.display = 'none';
        Logger.editLog(log.id);
      });
    }
  }

  /* ── Plans ──────────────────────────────────────────────────── */
  function renderPlans() {
    const el        = document.getElementById('view-plans');
    const plans     = Storage.getPlans();
    const activeId  = Storage.getSettings().activePlanId;

    el.innerHTML = `
      <div class="view-header"><h1>Workout Plans</h1></div>

      <div class="plans-list">
        ${plans.map(p => `
          <div class="plan-card${p.id === activeId ? ' plan-active' : ''}">
            <div class="plan-card-header">
              <div>
                <h3>${p.name}</h3>
                <p class="plan-meta">${p.days.length} days · ${p.isCustom ? 'Custom' : 'Preset'}</p>
              </div>
              <div class="plan-card-actions">
                ${p.id === activeId
                  ? '<span class="badge-active">Active</span>'
                  : `<button class="btn btn-sm btn-outline" data-switch="${p.id}">Switch</button>`
                }
                <button class="btn btn-sm btn-ghost" data-edit="${p.id}">Edit</button>
                ${p.isCustom ? `<button class="btn btn-sm btn-danger" data-delete="${p.id}">Delete</button>` : ''}
              </div>
            </div>
            <div class="plan-days">
              ${p.days.map(d => `<span class="day-chip">${d.name}</span>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      <button class="btn btn-primary btn-block" id="btn-new-plan">+ Create Custom Plan</button>

      <div id="create-form" class="create-plan-form hidden">
        <h3>New Custom Plan</h3>
        <div class="form-group">
          <label>Plan Name</label>
          <input id="new-plan-name" class="input" type="text" placeholder="e.g. My Bro Split">
        </div>
        <div class="form-group">
          <label>Plan Start Date <span class="label-hint">(optional — cycles days sequentially from this date)</span></label>
          <input id="new-plan-startdate" class="input" type="date">
        </div>
        <div id="new-days-list"></div>
        <button class="btn btn-outline btn-sm" id="btn-add-day" style="margin-bottom:16px">+ Add Day</button>
        <div class="form-actions">
          <button class="btn btn-primary" id="btn-save-new">Save Plan</button>
          <button class="btn btn-ghost"   id="btn-cancel-new">Cancel</button>
        </div>
      </div>

      <div id="edit-modal" class="modal hidden">
        <div class="modal-content">
          <h3>Edit Plan</h3>
          <div class="form-group">
            <label>Plan Name</label>
            <input id="edit-plan-name" class="input" type="text">
          </div>
          <div class="form-group">
            <label>Plan Start Date <span class="label-hint">(optional — cycles days sequentially from this date)</span></label>
            <input id="edit-plan-startdate" class="input" type="date">
          </div>
          <div id="edit-days-list"></div>
          <button class="btn btn-outline btn-sm" id="btn-edit-add-day" style="margin-bottom:16px">+ Add Day</button>
          <div class="form-actions">
            <button class="btn btn-primary" id="btn-save-edit">Update Plan</button>
            <button class="btn btn-ghost"   id="btn-cancel-edit">Cancel</button>
          </div>
        </div>
      </div>`;

    bindPlanEvents(el);
  }

  function hasDuplicateWeekdays(days) {
    const seen = new Set();
    for (const d of days) {
      if (d.weekDay !== null && d.weekDay !== undefined && d.weekDay !== '') {
        if (seen.has(d.weekDay)) return true;
        seen.add(d.weekDay);
      }
    }
    return false;
  }

  function bindPlanEvents(el) {
    // Switch
    el.querySelectorAll('[data-switch]').forEach(btn => btn.addEventListener('click', () => {
      if (!requireAuth()) return;
      Plans.setActivePlan(btn.dataset.switch);
      toast('Plan switched!');
      renderPlans();
    }));

    // Delete
    el.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => {
      if (!requireAuth()) return;
      if (!confirm('Delete this plan?')) return;
      Plans.deleteCustomPlan(btn.dataset.delete);
      toast('Plan deleted');
      renderPlans();
    }));

    // Create new
    let newDays = [];
    const createForm = document.getElementById('create-form');

    document.getElementById('btn-new-plan').addEventListener('click', () => {
      newDays = [];
      renderDayBuilder(document.getElementById('new-days-list'), newDays);
      createForm.classList.toggle('hidden');
    });

    document.getElementById('btn-add-day').addEventListener('click', () => {
      newDays.push({ name: '', weekDay: null, exercises: [{ name: '', defaultSets: 3, defaultReps: 8 }] });
      renderDayBuilder(document.getElementById('new-days-list'), newDays);
    });

    document.getElementById('btn-save-new').addEventListener('click', () => {
      if (!requireAuth()) return;
      const name = document.getElementById('new-plan-name').value.trim();
      if (!name)         { toast('Enter a plan name', 'error'); return; }
      if (!newDays.length) { toast('Add at least one day', 'error'); return; }
      const validDays = newDays.filter(d => d.name.trim() && d.exercises.some(e => e.name.trim()));
      if (!validDays.length) { toast('Fill in day name and at least one exercise', 'error'); return; }
      if (hasDuplicateWeekdays(validDays)) { toast('Two days share the same weekday — each day must have a unique schedule.', 'error'); return; }
      const startDate = document.getElementById('new-plan-startdate').value || null;
      Plans.createCustomPlan(name, validDays.map(d => ({
        ...d,
        exercises: d.exercises.filter(e => e.name.trim()),
      })), startDate);
      toast('Plan created!');
      createForm.classList.add('hidden');
      renderPlans();
    });

    document.getElementById('btn-cancel-new').addEventListener('click', () => {
      createForm.classList.add('hidden');
    });

    // Edit
    let editId = null, editDays = [];
    el.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => {
      editId = btn.dataset.edit;
      const plan = Storage.getPlanById(editId);
      editDays = JSON.parse(JSON.stringify(plan.days));
      document.getElementById('edit-plan-name').value = plan.name;
      document.getElementById('edit-plan-startdate').value = plan.startDate || '';
      renderDayBuilder(document.getElementById('edit-days-list'), editDays);
      document.getElementById('edit-modal').classList.remove('hidden');
    }));

    document.getElementById('btn-edit-add-day').addEventListener('click', () => {
      editDays.push({ name: '', weekDay: null, exercises: [{ name: '', defaultSets: 3, defaultReps: 8 }] });
      renderDayBuilder(document.getElementById('edit-days-list'), editDays);
    });

    document.getElementById('btn-save-edit').addEventListener('click', () => {
      const name = document.getElementById('edit-plan-name').value.trim();
      if (!name) { toast('Enter a plan name', 'error'); return; }
      const validDays = editDays.filter(d => d.name.trim());
      if (hasDuplicateWeekdays(validDays)) { toast('Two days share the same weekday — each day must have a unique schedule.', 'error'); return; }
      const startDate = document.getElementById('edit-plan-startdate').value || null;
      const existing = Storage.getPlanById(editId);
      Storage.upsertPlan({ ...existing, name, days: validDays, isCustom: true, startDate });
      toast('Plan updated!');
      document.getElementById('edit-modal').classList.add('hidden');
      renderPlans();
    });

    document.getElementById('btn-cancel-edit').addEventListener('click', () => {
      document.getElementById('edit-modal').classList.add('hidden');
    });
  }

  const WEEK_DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  function weekDayOptions(selected) {
    return `<option value="">— Rest day —</option>` +
      WEEK_DAYS.map((d, i) =>
        `<option value="${i}" ${selected == i ? 'selected' : ''}>${d}</option>`
      ).join('');
  }

  function renderDayBuilder(container, days) {
    container.innerHTML = days.map((day, di) => `
      <div class="custom-day" data-di="${di}">
        <div class="custom-day-header">
          <span class="drag-handle day-drag" title="Drag to reorder day">⠿</span>
          <input type="text" class="input day-name-input" data-di="${di}"
                 placeholder="Day name (e.g. Chest & Bicep)" value="${day.name}">
          <button class="btn btn-sm btn-outline btn-dup-day" data-di="${di}" title="Duplicate day">⧉ Day</button>
          <button class="btn btn-sm btn-danger btn-rm-day" data-di="${di}">Remove</button>
        </div>
        <div class="day-schedule-row">
          <label class="schedule-label">Scheduled on</label>
          <select class="select day-weekday" data-di="${di}">
            ${weekDayOptions(day.weekDay)}
          </select>
          <span class="weekday-conflict hidden" data-di="${di}">⚠️ Already used</span>
        </div>
        <div class="custom-exercises">
          ${day.exercises.map((ex, ei) => `
            <div class="custom-exercise-row" data-di="${di}" data-ei="${ei}">
              <span class="drag-handle ex-drag" title="Drag to reorder exercise">⠿</span>
              <input type="text"   class="input ex-name"  data-di="${di}" data-ei="${ei}" placeholder="Exercise" value="${ex.name}">
              <input type="number" class="input ex-sets"  data-di="${di}" data-ei="${ei}" placeholder="Sets" value="${ex.defaultSets}" min="1" max="20">
              <input type="number" class="input ex-reps"  data-di="${di}" data-ei="${ei}" placeholder="Reps" value="${ex.defaultReps}" min="1" max="999">
              <button class="btn btn-sm btn-ghost btn-dup-ex" data-di="${di}" data-ei="${ei}" title="Duplicate exercise">⧉</button>
              <button class="btn btn-sm btn-ghost btn-rm-ex" data-di="${di}" data-ei="${ei}">×</button>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-sm btn-ghost btn-add-ex" data-di="${di}" style="margin-top:6px">+ Exercise</button>
      </div>
    `).join('');

    container.querySelectorAll('.day-name-input').forEach(i => i.addEventListener('input', () => { days[+i.dataset.di].name = i.value; }));

    function refreshConflicts() {
      // Count how many days use each weekday
      const counts = {};
      days.forEach(d => {
        if (d.weekDay !== null && d.weekDay !== undefined && d.weekDay !== '') {
          counts[d.weekDay] = (counts[d.weekDay] || 0) + 1;
        }
      });
      container.querySelectorAll('.day-weekday').forEach(s => {
        const di  = +s.dataset.di;
        const val = days[di].weekDay;
        const warn = container.querySelector(`.weekday-conflict[data-di="${di}"]`);
        const isDup = val !== null && val !== undefined && val !== '' && counts[val] > 1;
        s.classList.toggle('input-error', isDup);
        if (warn) warn.classList.toggle('hidden', !isDup);
      });
    }

    container.querySelectorAll('.day-weekday').forEach(s => s.addEventListener('change', () => {
      days[+s.dataset.di].weekDay = s.value === '' ? null : parseInt(s.value);
      refreshConflicts();
    }));
    refreshConflicts(); // run once on render to highlight existing conflicts
    container.querySelectorAll('.ex-name').forEach(i  => i.addEventListener('input', () => { days[+i.dataset.di].exercises[+i.dataset.ei].name = i.value; }));
    container.querySelectorAll('.ex-sets').forEach(i  => i.addEventListener('input', () => { days[+i.dataset.di].exercises[+i.dataset.ei].defaultSets = parseInt(i.value) || 3; }));
    container.querySelectorAll('.ex-reps').forEach(i  => i.addEventListener('input', () => { days[+i.dataset.di].exercises[+i.dataset.ei].defaultReps = parseInt(i.value) || 8; }));

    container.querySelectorAll('.btn-dup-day').forEach(btn => btn.addEventListener('click', () => {
      const di  = +btn.dataset.di;
      const copy = JSON.parse(JSON.stringify(days[di]));
      copy.name = copy.name ? copy.name + ' (copy)' : '';
      copy.weekDay = null;
      days.splice(di + 1, 0, copy);
      renderDayBuilder(container, days);
    }));
    container.querySelectorAll('.btn-rm-day').forEach(btn => btn.addEventListener('click', () => {
      days.splice(+btn.dataset.di, 1); renderDayBuilder(container, days);
    }));
    container.querySelectorAll('.btn-add-ex').forEach(btn => btn.addEventListener('click', () => {
      days[+btn.dataset.di].exercises.push({ name: '', defaultSets: 3, defaultReps: 8 });
      renderDayBuilder(container, days);
    }));
    container.querySelectorAll('.btn-dup-ex').forEach(btn => btn.addEventListener('click', () => {
      const di = +btn.dataset.di, ei = +btn.dataset.ei;
      const copy = { ...days[di].exercises[ei] };
      days[di].exercises.splice(ei + 1, 0, copy);
      renderDayBuilder(container, days);
    }));
    container.querySelectorAll('.btn-rm-ex').forEach(btn => btn.addEventListener('click', () => {
      const { di, ei } = btn.dataset;
      if (days[+di].exercises.length > 1) { days[+di].exercises.splice(+ei, 1); renderDayBuilder(container, days); }
    }));

    bindDragDrop(container, days);
  }

  /* ── Touch drag helper (mobile) ─────────────────────────────── */
  function addTouchDrag(handle, getItem, getItems, getKey, onDrop) {
    let ghost = null, startY = 0, srcKey = null;
    handle.addEventListener('touchstart', e => {
      const item = getItem(handle);
      srcKey = getKey(item);
      startY = e.touches[0].clientY;
      ghost = item.cloneNode(true);
      ghost.style.cssText = `position:fixed;left:0;right:0;opacity:0.6;z-index:9999;pointer-events:none;margin:0 16px;border-radius:12px;`;
      ghost.style.top = item.getBoundingClientRect().top + 'px';
      document.body.appendChild(ghost);
      item.classList.add('dragging');
      e.preventDefault();
    }, { passive: false });

    handle.addEventListener('touchmove', e => {
      if (!ghost) return;
      const dy = e.touches[0].clientY - startY;
      const rect = getItem(handle).getBoundingClientRect();
      ghost.style.top = (rect.top + dy) + 'px';
      // Highlight target
      const touchY = e.touches[0].clientY;
      getItems().forEach(el => {
        const r = el.getBoundingClientRect();
        el.classList.toggle('drag-over', touchY >= r.top && touchY <= r.bottom && getKey(el) !== srcKey);
      });
      e.preventDefault();
    }, { passive: false });

    handle.addEventListener('touchend', () => {
      if (!ghost) return;
      ghost.remove(); ghost = null;
      const item = getItem(handle);
      item.classList.remove('dragging');
      const target = getItems().find(el => el.classList.contains('drag-over'));
      getItems().forEach(el => el.classList.remove('drag-over'));
      if (target && getKey(target) !== srcKey) onDrop(srcKey, getKey(target));
      srcKey = null;
    });
  }

  function bindDragDrop(container, days) {
    let dragSrcDi = null, dragSrcEi = null;

    // ── Day-level drag/drop ──────────────────────────────────────
    container.querySelectorAll('.custom-day').forEach(dayEl => {
      const handle = dayEl.querySelector('.day-drag');

      handle.addEventListener('mousedown', () => { dayEl.draggable = true; });

      // Touch drag for mobile
      addTouchDrag(handle,
        () => handle.closest('.custom-day'),
        () => [...container.querySelectorAll('.custom-day')],
        el => el.dataset.di,
        (srcDi, tgtDi) => {
          const [moved] = days.splice(+srcDi, 1);
          days.splice(+tgtDi, 0, moved);
          renderDayBuilder(container, days);
        }
      );
      dayEl.addEventListener('dragend', () => {
        dayEl.draggable = false;
        dayEl.classList.remove('dragging');
        container.querySelectorAll('.custom-day').forEach(d => d.classList.remove('drag-over'));
      });

      dayEl.addEventListener('dragstart', e => {
        if (!dayEl.draggable) { e.preventDefault(); return; }
        dragSrcDi = +dayEl.dataset.di;
        dragSrcEi = null;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => dayEl.classList.add('dragging'), 0);
      });

      dayEl.addEventListener('dragover', e => {
        if (dragSrcEi !== null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        container.querySelectorAll('.custom-day').forEach(d => d.classList.remove('drag-over'));
        dayEl.classList.add('drag-over');
      });

      dayEl.addEventListener('drop', e => {
        e.preventDefault();
        if (dragSrcEi !== null) return;
        const tgtDi = +dayEl.dataset.di;
        if (dragSrcDi === null || dragSrcDi === tgtDi) return;
        const [moved] = days.splice(dragSrcDi, 1);
        days.splice(tgtDi, 0, moved);
        renderDayBuilder(container, days);
      });
    });

    // ── Exercise-level drag/drop ─────────────────────────────────
    container.querySelectorAll('.custom-exercise-row').forEach(rowEl => {
      const handle = rowEl.querySelector('.ex-drag');

      handle.addEventListener('mousedown', () => { rowEl.draggable = true; });

      // Touch drag for mobile
      addTouchDrag(handle,
        () => handle.closest('.custom-exercise-row'),
        () => [...container.querySelectorAll(`.custom-exercise-row[data-di="${rowEl.dataset.di}"]`)],
        el => el.dataset.ei,
        (srcEi, tgtEi) => {
          const di = +rowEl.dataset.di;
          const [moved] = days[di].exercises.splice(+srcEi, 1);
          days[di].exercises.splice(+tgtEi, 0, moved);
          renderDayBuilder(container, days);
        }
      );

      rowEl.addEventListener('dragend', () => {
        rowEl.draggable = false;
        rowEl.classList.remove('dragging');
        container.querySelectorAll('.custom-exercise-row').forEach(r => r.classList.remove('drag-over'));
      });

      rowEl.addEventListener('dragstart', e => {
        if (!rowEl.draggable) { e.preventDefault(); return; }
        dragSrcDi = +rowEl.dataset.di;
        dragSrcEi = +rowEl.dataset.ei;
        e.dataTransfer.effectAllowed = 'move';
        e.stopPropagation();
        setTimeout(() => rowEl.classList.add('dragging'), 0);
      });

      rowEl.addEventListener('dragover', e => {
        if (dragSrcEi === null) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        container.querySelectorAll('.custom-exercise-row').forEach(r => r.classList.remove('drag-over'));
        rowEl.classList.add('drag-over');
      });

      rowEl.addEventListener('drop', e => {
        e.preventDefault();
        e.stopPropagation();
        if (dragSrcEi === null) return;
        const tgtDi = +rowEl.dataset.di;
        const tgtEi = +rowEl.dataset.ei;
        if (dragSrcDi !== tgtDi || dragSrcEi === tgtEi) return;
        const [moved] = days[tgtDi].exercises.splice(dragSrcEi, 1);
        days[tgtDi].exercises.splice(tgtEi, 0, moved);
        renderDayBuilder(container, days);
      });
    });
  }

  /* ── History ────────────────────────────────────────────────── */
  function renderHistory(fromDate = '', toDate = '') {
    const el      = document.getElementById('view-history');
    const allLogs = Storage.getLogs().slice().reverse();
    const logs    = allLogs.filter(l =>
      (!fromDate || l.date >= fromDate) && (!toDate || l.date <= toDate)
    );
    const todayStr = new Date().toISOString().slice(0, 10);

    function buildList(list) {
      return list.map(log => {
            const vol  = log.exercises.reduce((t, ex) =>
              t + ex.sets.reduce((s, set) => s + set.reps * set.weight, 0), 0);
            const sets = log.exercises.reduce((t, ex) => t + ex.sets.length, 0);
            const dateStr = new Date(log.date + 'T00:00:00').toLocaleDateString('en-US',
              { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
            return `
              <div class="history-card">
                <div class="history-card-header">
                  <div>
                    <div class="history-date">${dateStr}</div>
                    <div class="history-day">${log.dayName}</div>
                  </div>
                  <div class="history-actions">
                    <button class="btn btn-sm btn-ghost btn-expand" data-id="${log.id}">▼</button>
                    <button class="btn btn-sm btn-outline btn-edit-log" data-id="${log.id}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>
                    <button class="btn btn-sm btn-danger btn-del-log" data-id="${log.id}">Delete</button>
                  </div>
                </div>
                <div class="history-stats">
                  <span>${log.exercises.length} exercises</span>
                  <span>${sets} sets</span>
                  <span>${Metrics.formatVolume(vol)} kg volume</span>
                </div>
                <div class="history-detail hidden" id="detail-${log.id}">
                  ${log.exercises.map(ex => `
                    <div class="history-exercise">
                      <strong>${ex.name}</strong>
                      <div class="history-sets">
                        ${ex.sets.map((s, i) =>
                          `<span class="set-chip">Set ${i+1}: ${s.reps} × ${s.weight} kg</span>`
                        ).join('')}
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>`;
      }).join('');
    }

    el.innerHTML = `
      <div class="view-header">
        <h1>History</h1>
        <p class="subtitle">${logs.length} of ${allLogs.length} workout${allLogs.length !== 1 ? 's' : ''}</p>
      </div>
      <div class="history-filter">
        <div class="history-filter-bar">
          <span class="history-filter-label">Filter by date</span>
          <div class="history-filter-inputs">
            <input type="date" id="hist-from" class="hist-date-input" value="${fromDate}" max="${todayStr}" title="From date">
            <span class="history-filter-arrow">→</span>
            <input type="date" id="hist-to" class="hist-date-input" value="${toDate}" max="${todayStr}" title="To date">
          </div>
          <button class="hist-clear-btn ${fromDate || toDate ? '' : 'hidden'}" id="hist-clear">Clear</button>
        </div>
      </div>
      ${logs.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                 stroke-linecap="round" stroke-linejoin="round" width="36" height="36">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <p>${allLogs.length ? 'No workouts in this date range.' : 'No workouts logged yet.'}</p>
          ${!allLogs.length ? `<a href="#log" class="btn btn-primary">Log First Workout</a>` : ''}
        </div>
      ` : `
        <div class="history-list">
          ${buildList(logs)}
        </div>
      `}`;

    // Filter events
    const histFrom = document.getElementById('hist-from');
    const histTo   = document.getElementById('hist-to');
    function applyFilter() { renderHistory(histFrom.value, histTo.value); }
    histFrom.addEventListener('change', applyFilter);
    histTo.addEventListener('change', applyFilter);
    document.getElementById('hist-clear').addEventListener('click', () => renderHistory());

    el.querySelectorAll('.btn-expand').forEach(btn => btn.addEventListener('click', () => {
      const detail = document.getElementById(`detail-${btn.dataset.id}`);
      const open   = !detail.classList.contains('hidden');
      detail.classList.toggle('hidden');
      btn.textContent = open ? '▼' : '▲';
    }));

    el.querySelectorAll('.btn-edit-log').forEach(btn => btn.addEventListener('click', () => {
      Logger.editLog(btn.dataset.id);
    }));

    el.querySelectorAll('.btn-del-log').forEach(btn => btn.addEventListener('click', () => {
      if (!confirm('Delete this workout log?')) return;
      Storage.deleteLog(btn.dataset.id);
      toast('Log deleted');
      renderHistory(histFrom?.value, histTo?.value);
    }));
  }


  /* ── Router ─────────────────────────────────────────────────── */
  const VIEWS = {
    dashboard: renderDashboard,
    log:       Logger.render,
    progress:  Charts.render,
    plans:     renderPlans,
    history:   renderHistory,
  };

  function showView(name, skipRender) {
    const view = VIEWS[name] ? name : 'dashboard';
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
    document.querySelectorAll('.nav-link').forEach(a =>
      a.classList.toggle('active', a.dataset.view === view));
    if (!skipRender) VIEWS[view]();
  }

  function initSidebar() {
    const sidebar  = document.getElementById('sidebar');
    const content  = document.getElementById('main-content');
    const toggle   = document.getElementById('sidebar-toggle');
    const PREF_KEY = 'ft_sidebar_collapsed';
    if (localStorage.getItem(PREF_KEY) === '1') {
      sidebar.classList.add('collapsed');
      content.style.marginLeft = 'var(--sidebar-collapsed-w)';
    }
    toggle.addEventListener('click', () => {
      const collapsed = sidebar.classList.toggle('collapsed');
      content.style.marginLeft = collapsed
        ? 'var(--sidebar-collapsed-w)'
        : 'var(--sidebar-w)';
      localStorage.setItem(PREF_KEY, collapsed ? '1' : '0');
    });
  }

  function widgetContainer() {
    // On mobile, inject into the top bar; on desktop, into #app
    const topbar = document.getElementById('mobile-topbar');
    if (topbar && window.innerWidth <= 768) return topbar;
    return document.getElementById('app');
  }

  function renderGuestInfo() {
    const existing = document.getElementById('profile-widget');
    if (existing) existing.remove();

    const widget = document.createElement('div');
    widget.id = 'profile-widget';
    widget.innerHTML = `
      <button class="guest-signin-btn" id="btn-guest-signin">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" width="15" height="15">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
          <polyline points="10 17 15 12 10 7"/>
          <line x1="15" y1="12" x2="3" y2="12"/>
        </svg>
        Sign In
      </button>`;
    widgetContainer().appendChild(widget);

    document.getElementById('btn-guest-signin').addEventListener('click', () => {
      showSignInModal();
    });
  }

  function showSignInModal() {
    const modal = document.getElementById('signin-modal');
    if (modal) modal.hidden = false;
  }

  function hideSignInModal() {
    const modal = document.getElementById('signin-modal');
    if (modal) modal.hidden = true;
  }

  function requireAuth() {
    if (Auth.getUser()) return true;
    showSignInModal();
    return false;
  }

  function renderUserInfo(user) {
    // Restore brand area to clean logo only
    const brand = document.getElementById('nav-brand-area');
    if (brand) {
      brand.innerHTML = `
        <div class="nav-brand">
          <img src="img/logo.png" class="nav-logo-img" alt="FitTrack">
        </div>`;
    }

    // Inject profile widget into top-right of main content
    const existing = document.getElementById('profile-widget');
    if (existing) existing.remove();

    const widget = document.createElement('div');
    widget.id = 'profile-widget';
    const name  = user.displayName || 'You';
    const email = user.email || '';
    const photo = user.photoURL || '';
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    widget.innerHTML = `
      <button class="profile-btn" id="profile-btn" aria-label="Profile">
        ${photo
          ? `<img src="${photo}" class="profile-avatar-img" alt="${name}">`
          : `<span class="profile-avatar-initials">${initials}</span>`}
      </button>
      <div class="profile-dropdown" id="profile-dropdown" hidden>
        <div class="profile-dropdown-header">
          ${photo
            ? `<img src="${photo}" class="profile-dd-img" alt="${name}">`
            : `<span class="profile-dd-initials">${initials}</span>`}
          <div class="profile-dd-info">
            <div class="profile-dd-name">${name}</div>
            <div class="profile-dd-email">${email}</div>
          </div>
        </div>
        <div class="profile-dropdown-divider"></div>
        <button class="profile-dd-signout" id="btn-signout">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" width="15" height="15">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>
      </div>`;

    widgetContainer().appendChild(widget);

    const btn      = document.getElementById('profile-btn');
    const dropdown = document.getElementById('profile-dropdown');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.hidden = !dropdown.hidden;
    });
    document.addEventListener('click', () => { dropdown.hidden = true; });
    document.getElementById('btn-signout').addEventListener('click', () => {
      if (confirm('Sign out?')) Auth.signOut();
    });
  }

  let _appBooted = false;

  async function init() {
    const loginScreen = document.getElementById('login-screen');
    const appEl       = document.getElementById('app');

    // Hide the dedicated login screen — we use the modal instead
    loginScreen.style.display = 'none';

    // Set up modal sign-in button
    const modalSigninBtn = document.getElementById('btn-modal-signin');
    if (modalSigninBtn) {
      modalSigninBtn.addEventListener('click', async () => {
        try {
          modalSigninBtn.textContent = 'Signing in…';
          await Auth.signInWithGoogle();
        } catch (err) {
          console.error(err);
          modalSigninBtn.innerHTML = `<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="G"> Continue with Google`;
          toast('Sign-in failed. Please try again.', 'error');
        }
      });
    }
    document.getElementById('btn-modal-close')?.addEventListener('click', hideSignInModal);
    document.getElementById('btn-modal-close-x')?.addEventListener('click', hideSignInModal);

    Auth.onAuthReady(async (user) => {
      hideSignInModal();
      appEl.style.display = 'flex';

      if (user) {
        renderUserInfo(user);
        await Storage.init(user);
      } else {
        renderGuestInfo();
      }

      if (!_appBooted) {
        _appBooted = true;
        Plans.ensureDefaults();
        initSidebar();
        window.addEventListener('hashchange', () => showView(location.hash.slice(1)));
        showView(location.hash.slice(1) || 'dashboard');

        // Re-render dashboard when crossing mobile/desktop breakpoint (week ↔ month calendar)
        let _lastMobile = window.innerWidth < 768;
        window.addEventListener('resize', () => {
          const nowMobile = window.innerWidth < 768;
          if (nowMobile !== _lastMobile) {
            _lastMobile = nowMobile;
            const view = location.hash.slice(1) || 'dashboard';
            if (view === 'dashboard') renderDashboard();
          }
        });
      }
    });
  }

  return { navigate, showView, toast, init, requireAuth };
})();

document.addEventListener('DOMContentLoaded', App.init);
