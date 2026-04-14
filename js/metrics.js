/* ─── Metrics ─ Streak, volume, PRs ─────────────────────────── */
const Metrics = (() => {

  function today() { return new Date().toISOString().slice(0, 10); }

  function prevDay(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  function getStreak() {
    const logs = Storage.getLogs();
    if (!logs.length) return 0;
    const loggedDates = new Set(logs.map(l => l.date));
    let streak = 0;
    let cursor = today();
    while (loggedDates.has(cursor)) {
      streak++;
      cursor = prevDay(cursor);
    }
    return streak;
  }

  function mondayOf(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  }

  function logVolume(log) {
    return log.exercises.reduce((t, ex) =>
      t + ex.sets.reduce((s, set) => s + set.reps * set.weight, 0), 0);
  }

  function getWeeklyVolume() {
    const weekStart = mondayOf(today());
    return Storage.getLogs()
      .filter(l => l.date >= weekStart)
      .reduce((t, l) => t + logVolume(l), 0);
  }

  function getWeekTopLift() {
    const weekStart = mondayOf(today());
    let best = null;
    for (const log of Storage.getLogs().filter(l => l.date >= weekStart)) {
      for (const ex of log.exercises) {
        for (const set of ex.sets) {
          if (set.weight > 0 && (!best || set.weight > best.weight)) {
            best = { weight: set.weight, name: ex.name };
          }
        }
      }
    }
    return best;
  }

  function getTotalVolume() {
    return Storage.getLogs().reduce((t, l) => t + logVolume(l), 0);
  }

  function getTotalWorkouts() { return Storage.getLogs().length; }

  function getMonthlyWorkoutCount() {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return Storage.getLogs().filter(l => l.date.startsWith(prefix)).length;
  }

  function getActivityGrid(days = 14) {
    const loggedDates = new Set(Storage.getLogs().map(l => l.date));
    const grid = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      grid.push({ date: dateStr, logged: loggedDates.has(dateStr) });
    }
    return grid;
  }

  function getPRs() {
    const prs = {};
    for (const log of Storage.getLogs()) {
      for (const ex of log.exercises) {
        const max = Math.max(...ex.sets.map(s => s.weight || 0));
        if (!prs[ex.name] || max > prs[ex.name]) prs[ex.name] = max;
      }
    }
    return prs;
  }

  function getExerciseHistory(exerciseName) {
    const history = [];
    for (const log of Storage.getLogs()) {
      for (const ex of log.exercises) {
        if (ex.name === exerciseName) {
          const maxWeight = Math.max(...ex.sets.map(s => s.weight || 0));
          const volume = ex.sets.reduce((s, set) => s + set.reps * set.weight, 0);
          history.push({ date: log.date, maxWeight, volume });
        }
      }
    }
    return history.sort((a, b) => a.date.localeCompare(b.date));
  }

  function getWeeklyVolumeHistory(weeks = 8) {
    const weekMap = {};
    for (const log of Storage.getLogs()) {
      const wk = mondayOf(log.date);
      weekMap[wk] = (weekMap[wk] || 0) + logVolume(log);
    }
    const result = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const ref = new Date();
      ref.setDate(ref.getDate() - ((ref.getDay() + 6) % 7) - i * 7);
      const wk = ref.toISOString().slice(0, 10);
      const label = ref.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      result.push({ week: wk, label, volume: weekMap[wk] || 0 });
    }
    return result;
  }

  function getAvgSessionDuration() {
    const logs = Storage.getLogs().filter(l => l.durationMinutes > 0);
    if (!logs.length) return null;
    const avg = logs.reduce((s, l) => s + l.durationMinutes, 0) / logs.length;
    return Math.round(avg);
  }

  function getSessionDurationHistory() {
    return Storage.getLogs()
      .filter(l => l.durationMinutes > 0)
      .map(l => ({ date: l.date, duration: l.durationMinutes, dayName: l.dayName }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  function getBodyWeightHistory() {
    return Storage.getLogs()
      .filter(l => l.bodyWeight && l.bodyWeight > 0)
      .map(l => ({ date: l.date, weight: l.bodyWeight }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  function getAllExerciseNames() {
    const names = new Set();
    for (const log of Storage.getLogs()) for (const ex of log.exercises) names.add(ex.name);
    return [...names].sort();
  }

  function formatVolume(v) {
    if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
    if (v >= 1000)    return (v / 1000).toFixed(1) + 'K';
    return v.toLocaleString();
  }

  return {
    getStreak, getWeeklyVolume, getWeekTopLift, getTotalVolume, getTotalWorkouts,
    getMonthlyWorkoutCount,
    getActivityGrid, getPRs, getExerciseHistory, getWeeklyVolumeHistory,
    getAvgSessionDuration, getSessionDurationHistory,
    getBodyWeightHistory, getAllExerciseNames, formatVolume,
  };
})();
