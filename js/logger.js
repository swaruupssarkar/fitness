/* ─── Logger ─ Log Workout view ─────────────────────────────── */
const Logger = (() => {
  let selectedDay  = null;
  let logExercises = [];
  let editLogId    = null;   // null = new log, string = editing existing

  function render() {
    editLogId = null;
    const el   = document.getElementById('view-log');
    const plan = Plans.getActivePlan();
    if (!plan) {
      el.innerHTML = `
        <div class="view-header"><h1>Log Workout</h1></div>
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p>No workout plan selected.</p>
          <a href="#plans" class="btn btn-primary">Choose a Plan</a>
        </div>`;
      return;
    }
    selectedDay  = null;
    logExercises = [];
    renderDayPicker(el, plan);
  }

  /* ── Edit an existing log ───────────────────────────────────── */
  function editLog(logId) {
    const log = Storage.getLogs().find(l => l.id === logId);
    if (!log) return;
    editLogId    = logId;
    selectedDay  = { name: log.dayName };
    logExercises = log.exercises.map(ex => ({
      name: ex.name,
      sets: ex.sets.map(s => ({ reps: s.reps, weight: s.weight })),
    }));
    const el = document.getElementById('view-log');
    renderLogger(el, null, log.date);
    App.showView('log', true);
  }

  /* ── Step 1: pick a day ─────────────────────────────────────── */
  function renderDayPicker(el, plan) {
    const todayDow = new Date().getDay(); // 0=Sun … 6=Sat
    el.innerHTML = `
      <div class="view-header">
        <h1>Log Workout</h1>
        <p class="subtitle">${plan.name}</p>
      </div>
      <span class="section-label">Choose Today's Session</span>
      <div class="day-grid">
        ${plan.days.map((day, i) => {
          const isToday = day.weekDay !== null && day.weekDay !== undefined && day.weekDay !== '' && parseInt(day.weekDay) === todayDow;
          return `
          <button class="day-card${isToday ? ' day-card-today' : ''}" data-idx="${i}">
            ${isToday ? '<span class="day-today-badge">Today</span>' : ''}
            <span class="day-name">${day.name}</span>
            <span class="day-exercises">${day.exercises.length} exercises</span>
          </button>`;
        }).join('')}
      </div>`;

    el.querySelectorAll('.day-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const day = plan.days[parseInt(btn.dataset.idx)];
        selectedDay  = day;
        logExercises = day.exercises.map(ex => ({
          name: ex.name,
          sets: Array.from({ length: ex.defaultSets }, () => ({ reps: ex.defaultReps, weight: 0 })),
        }));
        renderLogger(el, plan);
      });
    });
  }

  /* ── Step 2: log / edit sets ────────────────────────────────── */
  function renderLogger(el, plan, prefillDate) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const dateVal  = prefillDate || todayStr;
    const isEdit   = !!editLogId;

    el.innerHTML = `
      <div class="view-header">
        <button class="btn-back" id="btn-back">${isEdit ? '← Cancel' : '← Back'}</button>
        <h1>${isEdit ? 'Edit: ' : ''}${selectedDay.name}</h1>
        ${plan ? `<p class="subtitle">${plan.name}</p>` : ''}
      </div>
      <div class="log-date-row">
        <label class="log-date-label" for="log-date">📅 Workout Date</label>
        <input type="date" id="log-date" class="input log-date-input"
               value="${dateVal}" max="${todayStr}">
      </div>
      <div class="log-date-row">
        <label class="log-date-label" for="log-bodyweight">⚖️ Today's Body Weight (kg)</label>
        <input type="number" id="log-bodyweight" class="input log-date-input"
               value="${isEdit && Storage.getLogs().find(l=>l.id===editLogId)?.bodyWeight || ''}"
               min="20" max="300" step="0.1" placeholder="e.g. 75.5">
      </div>
      <div class="gym-time-row">
        <div class="gym-time-field">
          <label class="log-date-label" for="log-time-in">🏃 Gym In</label>
          <input type="time" id="log-time-in" class="input log-date-input"
                 value="${isEdit && Storage.getLogs().find(l=>l.id===editLogId)?.timeIn || ''}">
        </div>
        <div class="gym-time-field">
          <label class="log-date-label" for="log-time-out">🏁 Gym Out</label>
          <input type="time" id="log-time-out" class="input log-date-input"
                 value="${isEdit && Storage.getLogs().find(l=>l.id===editLogId)?.timeOut || ''}">
        </div>
        <div class="gym-time-duration" id="gym-duration-display">—</div>
      </div>
      <div id="exercise-list">${buildExercisesHTML()}</div>
      <div class="log-actions">
        <button class="btn btn-primary btn-lg" id="btn-save">
          ${isEdit ? 'Update Workout' : 'Save Workout'}
        </button>
        <button class="btn btn-outline btn-lg" id="btn-reset">Reset</button>
      </div>`;

    document.getElementById('btn-back').addEventListener('click', () => {
      if (isEdit) { editLogId = null; App.navigate('history'); }
      else renderDayPicker(el, plan);
    });
    document.getElementById('btn-save').addEventListener('click', saveLog);

    // Snapshot original state for reset
    const origExercises  = JSON.parse(JSON.stringify(logExercises));
    const origLog        = isEdit ? Storage.getLogs().find(l => l.id === editLogId) : null;
    const origDate       = dateVal;

    function updateDurationDisplay() {
      const inVal  = document.getElementById('log-time-in').value;
      const outVal = document.getElementById('log-time-out').value;
      const disp   = document.getElementById('gym-duration-display');
      if (inVal && outVal) {
        const [ih, im] = inVal.split(':').map(Number);
        const [oh, om] = outVal.split(':').map(Number);
        const mins = (oh * 60 + om) - (ih * 60 + im);
        if (mins > 0) { disp.textContent = `⏱ ${Math.floor(mins/60) ? Math.floor(mins/60)+'h ' : ''}${mins%60}min`; disp.style.color = 'var(--green)'; }
        else { disp.textContent = '—'; disp.style.color = ''; }
      } else { disp.textContent = '—'; disp.style.color = ''; }
    }
    document.getElementById('log-time-in').addEventListener('change', updateDurationDisplay);
    document.getElementById('log-time-out').addEventListener('change', updateDurationDisplay);
    updateDurationDisplay();

    document.getElementById('btn-reset').addEventListener('click', () => {
      if (!confirm('Reset and delete this log entry from storage?')) return;
      // Delete from storage if editing an existing log
      if (editLogId) {
        Storage.deleteLog(editLogId);
        editLogId = null;
        App.toast('Log deleted and form reset.', 'success');
        App.navigate('history');
        return;
      }
      // For new log: just clear all fields back to defaults
      logExercises = JSON.parse(JSON.stringify(origExercises));
      document.getElementById('log-date').value = origDate;
      document.getElementById('log-bodyweight').value = '';
      document.getElementById('log-time-in').value  = '';
      document.getElementById('log-time-out').value = '';
      document.getElementById('exercise-list').innerHTML = buildExercisesHTML();
      bindExerciseEvents();
      updateDurationDisplay();
      App.toast('Form reset.', 'success');
    });

    bindExerciseEvents();
  }

  function buildExercisesHTML() {
    return logExercises.map((ex, ei) => `
      <div class="exercise-card">
        <div class="exercise-header">
          <h3 class="exercise-name">${ex.name}</h3>
          <button class="btn-add-set" data-ei="${ei}">+ Set</button>
        </div>
        <div class="sets-table">
          <div class="sets-header"><span>Set</span><span>Reps</span><span>Weight (kg)</span><span></span><span></span></div>
          ${ex.sets.map((set, si) => `
            <div class="set-row">
              <span class="set-num">${si + 1}</span>
              <input type="number" class="set-input reps-input" data-ei="${ei}" data-si="${si}"
                     value="${set.reps}" min="1" max="999" inputmode="numeric">
              <input type="number" class="set-input weight-input" data-ei="${ei}" data-si="${si}"
                     value="${set.weight > 0 ? set.weight : ''}" min="0" max="9999"
                     placeholder="kg" inputmode="decimal">
              <button class="btn-dup-set" data-ei="${ei}" data-si="${si}" title="Duplicate set">⧉</button>
              <button class="btn-remove-set" data-ei="${ei}" data-si="${si}">×</button>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  function bindExerciseEvents() {
    const list = document.getElementById('exercise-list');
    if (!list) return;

    function rebind() { list.innerHTML = buildExercisesHTML(); bindExerciseEvents(); }

    list.querySelectorAll('.reps-input').forEach(inp => {
      inp.addEventListener('change', () => {
        logExercises[+inp.dataset.ei].sets[+inp.dataset.si].reps = parseInt(inp.value) || 0;
      });
    });
    list.querySelectorAll('.weight-input').forEach(inp => {
      inp.addEventListener('change', () => {
        logExercises[+inp.dataset.ei].sets[+inp.dataset.si].weight = parseFloat(inp.value) || 0;
      });
    });
    list.querySelectorAll('.btn-add-set').forEach(btn => {
      btn.addEventListener('click', () => {
        const ei = +btn.dataset.ei;
        const last = logExercises[ei].sets.at(-1);
        logExercises[ei].sets.push({ reps: last.reps, weight: last.weight });
        rebind();
      });
    });
    list.querySelectorAll('.btn-dup-set').forEach(btn => {
      btn.addEventListener('click', () => {
        const ei = +btn.dataset.ei, si = +btn.dataset.si;
        const set = logExercises[ei].sets[si];
        logExercises[ei].sets.splice(si + 1, 0, { reps: set.reps, weight: set.weight });
        rebind();
      });
    });
    list.querySelectorAll('.btn-remove-set').forEach(btn => {
      btn.addEventListener('click', () => {
        const ei = +btn.dataset.ei, si = +btn.dataset.si;
        if (logExercises[ei].sets.length > 1) { logExercises[ei].sets.splice(si, 1); rebind(); }
      });
    });
  }

  function saveLog() {
    if (!App.requireAuth()) return;
    // Flush unfocused inputs
    document.querySelectorAll('.reps-input').forEach(inp =>
      logExercises[+inp.dataset.ei].sets[+inp.dataset.si].reps = parseInt(inp.value) || 0);
    document.querySelectorAll('.weight-input').forEach(inp =>
      logExercises[+inp.dataset.ei].sets[+inp.dataset.si].weight = parseFloat(inp.value) || 0);

    const exercises = logExercises
      .map(ex => ({ ...ex, sets: ex.sets.filter(s => s.reps > 0) }))
      .filter(ex => ex.sets.length > 0);

    if (!exercises.length) { App.toast('No sets recorded yet!', 'error'); return; }

    const dateInput  = document.getElementById('log-date');
    const logDate    = (dateInput && dateInput.value) || new Date().toISOString().slice(0, 10);
    const bwInput    = document.getElementById('log-bodyweight');
    const bodyWeight = bwInput && bwInput.value ? parseFloat(bwInput.value) : null;
    const timeIn     = document.getElementById('log-time-in')?.value || null;
    const timeOut    = document.getElementById('log-time-out')?.value || null;
    let durationMinutes = null;
    if (timeIn && timeOut) {
      const [ih, im] = timeIn.split(':').map(Number);
      const [oh, om] = timeOut.split(':').map(Number);
      const d = (oh * 60 + om) - (ih * 60 + im);
      if (d > 0) durationMinutes = d;
    }
    const plan       = Plans.getActivePlan();

    if (editLogId) {
      // Update existing log
      const existing = Storage.getLogs().find(l => l.id === editLogId);
      Storage.updateLog({ ...existing, date: logDate, exercises, bodyWeight, timeIn, timeOut, durationMinutes });
      editLogId = null;
      App.toast('Workout updated! ✏️', 'success');
      setTimeout(() => App.navigate('history'), 800);
    } else {
      // New log
      const prevPRs = Metrics.getPRs();
      Storage.addLog({
        id: crypto.randomUUID(),
        date: logDate,
        planId: plan ? plan.id : null,
        dayName: selectedDay.name,
        bodyWeight,
        timeIn,
        timeOut,
        durationMinutes,
        exercises,
      });
      const prsHit = exercises.filter(ex => {
        const maxNow = Math.max(...ex.sets.map(s => s.weight));
        return maxNow > 0 && (!prevPRs[ex.name] || maxNow > prevPRs[ex.name]);
      });
      if (prsHit.length) App.toast(`🏆 New PR on ${prsHit.map(e => e.name).join(', ')}!`, 'success', 4000);
      else App.toast('Workout saved! Great work 💪', 'success');
      setTimeout(() => App.navigate('dashboard'), 800);
    }
  }

  return { render, editLog };
})();
