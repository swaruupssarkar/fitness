/* ─── Charts ─ Progress view with Chart.js ───────────────────── */
const Charts = (() => {
  let progressChart    = null;
  let bodyWeightChart  = null;
  let durationChart    = null;

  let chartOrder = ['progress', 'bodyweight', 'duration'];

  const CHART_CONFIG = {
    progress:   { title: 'Max Weight Over Time (kg)',        canvasId: 'chart-progress'   },
    bodyweight: { title: 'Body Weight Over Time (kg)',       canvasId: 'chart-bodyweight' },
    duration:   { title: 'Session Duration Over Time (min)', canvasId: 'chart-duration'  },
  };

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
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    if (!names.length) {
      el.innerHTML = `
        <div class="view-header">
          <h1>Progress</h1>
          <p class="subtitle">${dateStr}</p>
        </div>
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
      <div class="view-header">
        <h1>Progress</h1>
        <p class="subtitle">${dateStr}</p>
      </div>
      <div class="progress-controls">
        <label for="ex-select">Exercise</label>
        <div class="ex-select-row">
          <select id="ex-select" class="select">
            ${names.map(n => `<option value="${n}">${n}</option>`).join('')}
          </select>
          <div id="pr-badge" class="pr-badge hidden"></div>
        </div>
      </div>
      <div id="charts-container"></div>`;

    buildChartsContainer();
    drawAllCharts();
    bindChartDragDrop();

    document.getElementById('ex-select').addEventListener('change', () => {
      drawProgressChart(document.getElementById('ex-select').value);
    });
  }

  function buildChartsContainer() {
    const container = document.getElementById('charts-container');
    container.innerHTML = chartOrder.map(key => {
      const cfg = CHART_CONFIG[key];
      return `
        <div class="chart-card" data-chart="${key}">
          <h3><span class="drag-handle chart-drag" title="Drag to reorder">⠿</span>${cfg.title}</h3>
          <div class="chart-wrapper"><canvas id="${cfg.canvasId}"></canvas></div>
        </div>`;
    }).join('');
  }

  function drawAllCharts() {
    drawProgressChart(document.getElementById('ex-select')?.value || '');
    drawBodyWeightChart();
    drawDurationChart();
  }

  function reorderCharts(srcKey, tgtKey) {
    if (!srcKey || srcKey === tgtKey) return;
    const srcIdx = chartOrder.indexOf(srcKey);
    const tgtIdx = chartOrder.indexOf(tgtKey);
    if (srcIdx < 0 || tgtIdx < 0) return;
    chartOrder.splice(srcIdx, 1);
    chartOrder.splice(tgtIdx, 0, srcKey);
    [progressChart, bodyWeightChart, durationChart].forEach(c => { try { c?.destroy(); } catch {} });
    progressChart = bodyWeightChart = durationChart = null;
    buildChartsContainer();
    drawAllCharts();
    bindChartDragDrop();
  }

  function bindChartDragDrop() {
    const container = document.getElementById('charts-container');
    if (!container) return;
    let dragSrc = null;

    container.querySelectorAll('.chart-card').forEach(card => {
      const handle = card.querySelector('.chart-drag');

      // ── Mouse drag (desktop) ──
      handle.addEventListener('mousedown', () => { card.draggable = true; });
      card.addEventListener('dragend', () => {
        card.draggable = false;
        card.classList.remove('dragging');
        container.querySelectorAll('.chart-card').forEach(c => c.classList.remove('drag-over'));
      });
      card.addEventListener('dragstart', e => {
        if (!card.draggable) { e.preventDefault(); return; }
        dragSrc = card.dataset.chart;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => card.classList.add('dragging'), 0);
      });
      card.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        container.querySelectorAll('.chart-card').forEach(c => c.classList.remove('drag-over'));
        card.classList.add('drag-over');
      });
      card.addEventListener('drop', e => {
        e.preventDefault();
        reorderCharts(dragSrc, card.dataset.chart);
      });

      // ── Touch drag (mobile) ──
      let ghost = null, touchSrcKey = null;

      handle.addEventListener('touchstart', e => {
        e.preventDefault();
        touchSrcKey = card.dataset.chart;
        ghost = card.cloneNode(true);
        const r = card.getBoundingClientRect();
        ghost.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;opacity:0.75;pointer-events:none;z-index:9999;border-radius:12px;`;
        document.body.appendChild(ghost);
        card.style.opacity = '0.3';
      }, { passive: false });

      handle.addEventListener('touchmove', e => {
        e.preventDefault();
        if (!ghost) return;
        const t = e.touches[0];
        ghost.style.left = (t.clientX - ghost.offsetWidth / 2) + 'px';
        ghost.style.top  = (t.clientY - ghost.offsetHeight / 2) + 'px';
        container.querySelectorAll('.chart-card').forEach(c => c.classList.remove('drag-over'));
        const el = document.elementFromPoint(t.clientX, t.clientY)?.closest('.chart-card');
        if (el && el !== card) el.classList.add('drag-over');
      }, { passive: false });

      handle.addEventListener('touchend', e => {
        if (ghost) { ghost.remove(); ghost = null; }
        card.style.opacity = '';
        container.querySelectorAll('.chart-card').forEach(c => c.classList.remove('drag-over'));
        const t = e.changedTouches[0];
        const tgtCard = document.elementFromPoint(t.clientX, t.clientY)?.closest('.chart-card');
        if (tgtCard) reorderCharts(touchSrcKey, tgtCard.dataset.chart);
        touchSrcKey = null;
      });
    });
  }

  function drawProgressChart(name) {
    const history = Metrics.getExerciseHistory(name);
    const prs     = Metrics.getPRs();
    const pr      = prs[name] || 0;

    const badge = document.getElementById('pr-badge');
    if (pr > 0) {
      badge.textContent = `🏆 PR: ${pr} kg`;
      badge.classList.remove('hidden');
    } else {
      badge.textContent = '🏆 —';
      badge.classList.remove('hidden');
    }

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
