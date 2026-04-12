/* ─── Charts ─ Progress view with Chart.js ───────────────────── */
const Charts = (() => {
  let progressChart    = null;
  let volumeChart      = null;
  let bodyWeightChart  = null;
  let durationChart    = null;

  const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1d27',
        titleColor: '#e2e8f0',
        bodyColor: '#94a3b8',
        borderColor: '#2d3148',
        borderWidth: 1,
        padding: 10,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#94a3b8', font: { size: 11 } },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#94a3b8', font: { size: 11 } },
        beginAtZero: true,
      },
    },
  };

  function render() {
    const el = document.getElementById('view-progress');
    const names = Metrics.getAllExerciseNames();

    if (!names.length) {
      el.innerHTML = `
        <div class="view-header"><h1>Progress</h1></div>
        <div class="empty-state">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                 stroke-linecap="round" stroke-linejoin="round" width="36" height="36">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <p>Log some workouts to see your strength charts.</p>
          <a href="#log" class="btn btn-primary">Log First Workout</a>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div class="view-header"><h1>Progress</h1></div>
      <div class="progress-controls">
        <label for="ex-select">Exercise</label>
        <select id="ex-select" class="select">
          ${names.map(n => `<option value="${n}">${n}</option>`).join('')}
        </select>
        <div id="pr-badge" class="pr-badge hidden"></div>
      </div>
      <div class="chart-card">
        <h3>Max Weight Over Time (kg)</h3>
        <div class="chart-wrapper"><canvas id="chart-progress"></canvas></div>
      </div>
      <div class="chart-card">
        <h3>Weekly Total Volume (kg)</h3>
        <div class="chart-wrapper"><canvas id="chart-volume"></canvas></div>
      </div>
      <div class="chart-card">
        <h3>⚖️ Body Weight Over Time (kg)</h3>
        <div class="chart-wrapper"><canvas id="chart-bodyweight"></canvas></div>
      </div>
      <div class="chart-card">
        <h3>⏱ Session Duration Over Time (min)</h3>
        <div class="chart-wrapper"><canvas id="chart-duration"></canvas></div>
      </div>`;

    const select = document.getElementById('ex-select');
    drawProgressChart(select.value);
    drawVolumeChart();
    drawBodyWeightChart();
    drawDurationChart();

    select.addEventListener('change', () => drawProgressChart(select.value));
  }

  function drawProgressChart(name) {
    const history = Metrics.getExerciseHistory(name);
    const prs     = Metrics.getPRs();
    const pr      = prs[name] || 0;

    const badge = document.getElementById('pr-badge');
    if (pr > 0) { badge.textContent = `🏆 PR: ${pr} kg`; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');

    const labels = history.map(h =>
      new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const data = history.map(h => h.maxWeight);

    if (progressChart) progressChart.destroy();
    progressChart = new Chart(
      document.getElementById('chart-progress').getContext('2d'),
      {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Max Weight (kg)',
            data,
            borderColor: '#6c63ff',
            backgroundColor: 'rgba(108,99,255,0.12)',
            borderWidth: 2.5,
            pointBackgroundColor: '#6c63ff',
            pointRadius: 5,
            pointHoverRadius: 7,
            tension: 0.35,
            fill: true,
          }],
        },
        options: {
          ...CHART_DEFAULTS,
          plugins: {
            ...CHART_DEFAULTS.plugins,
            tooltip: {
              ...CHART_DEFAULTS.plugins.tooltip,
              callbacks: { label: ctx => ` ${ctx.parsed.y} kg` },
            },
          },
        },
      }
    );
  }

  function drawVolumeChart() {
    const weeks = Metrics.getWeeklyVolumeHistory(8);
    if (volumeChart) volumeChart.destroy();
    volumeChart = new Chart(
      document.getElementById('chart-volume').getContext('2d'),
      {
        type: 'bar',
        data: {
          labels: weeks.map(w => w.label),
          datasets: [{
            label: 'Volume (kg)',
            data: weeks.map(w => w.volume),
            backgroundColor: 'rgba(34,197,94,0.65)',
            borderColor: '#22c55e',
            borderWidth: 1,
            borderRadius: 5,
          }],
        },
        options: {
          ...CHART_DEFAULTS,
          plugins: {
            ...CHART_DEFAULTS.plugins,
            tooltip: {
              ...CHART_DEFAULTS.plugins.tooltip,
              callbacks: { label: ctx => ` ${ctx.parsed.y.toLocaleString()} kg` },
            },
          },
        },
      }
    );
  }

  function drawBodyWeightChart() {
    const history = Metrics.getBodyWeightHistory();
    if (bodyWeightChart) bodyWeightChart.destroy();
    const canvas = document.getElementById('chart-bodyweight');
    if (!canvas) return;
    const labels = history.map(h =>
      new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const data = history.map(h => h.weight);
    bodyWeightChart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Body Weight (kg)',
          data,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,0.1)',
          borderWidth: 2.5,
          pointBackgroundColor: '#f59e0b',
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.35,
          fill: true,
        }],
      },
      options: {
        ...CHART_DEFAULTS,
        plugins: {
          ...CHART_DEFAULTS.plugins,
          tooltip: {
            ...CHART_DEFAULTS.plugins.tooltip,
            callbacks: { label: ctx => ` ${ctx.parsed.y} kg` },
          },
        },
        scales: {
          ...CHART_DEFAULTS.scales,
          y: { ...CHART_DEFAULTS.scales.y, beginAtZero: false },
        },
      },
    });
  }

  function drawDurationChart() {
    const history = Metrics.getSessionDurationHistory();
    if (durationChart) durationChart.destroy();
    const canvas = document.getElementById('chart-duration');
    if (!canvas) return;
    const labels = history.map(h =>
      new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    durationChart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Duration (min)',
          data: history.map(h => h.duration),
          backgroundColor: 'rgba(99,179,237,0.65)',
          borderColor: '#63b3ed',
          borderWidth: 1,
          borderRadius: 5,
        }],
      },
      options: {
        ...CHART_DEFAULTS,
        plugins: {
          ...CHART_DEFAULTS.plugins,
          tooltip: {
            ...CHART_DEFAULTS.plugins.tooltip,
            callbacks: {
              label: ctx => {
                const m = ctx.parsed.y;
                return m >= 60 ? ` ${Math.floor(m/60)}h ${m%60}min` : ` ${m} min`;
              },
              title: (items) => {
                const idx = items[0].dataIndex;
                return `${labels[idx]} — ${history[idx].dayName}`;
              },
            },
          },
        },
        scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, beginAtZero: true } },
      },
    });
  }

  return { render };
})();
