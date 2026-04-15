/* ─── Storage ─ LocalStorage cache + Firestore sync ─────────── */
const Storage = (() => {
  const KEYS = { PLANS: 'ft_plans', LOGS: 'ft_logs', SETTINGS: 'ft_settings' };

  /* ── LocalStorage helpers ────────────────────────────────────── */
  function get(key)         { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
  function set(key, value)  {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) {
      if (e.name === 'QuotaExceededError') console.warn('FitTrack: localStorage quota exceeded. Old data may not be saved.');
      else console.error('FitTrack: localStorage write failed', e);
    }
  }

  /* ── Firestore helpers ───────────────────────────────────────── */
  function uid() { return Auth.getUser()?.uid || null; }
  function db()  { return Auth.getDb(); }

  function fsDoc(path)  { return db().doc(path); }
  function fsCol(path)  { return db().collection(path); }
  function up(path)     { return `users/${uid()}/${path}`; }

  /* ── Plans ───────────────────────────────────────────────────── */
  function getPlans()     { return get(KEYS.PLANS) || []; }

  function savePlans(plans) {
    set(KEYS.PLANS, plans);
    const u = uid(); if (!u) return;
    const batch = db().batch();
    plans.forEach(p => batch.set(fsDoc(up(`plans/${p.id}`)), p));
    batch.commit().catch(console.error);
  }

  function getPlanById(id) { return getPlans().find(p => p.id === id) || null; }

  function upsertPlan(plan) {
    const plans = getPlans();
    const idx = plans.findIndex(p => p.id === plan.id);
    if (idx >= 0) plans[idx] = plan; else plans.push(plan);
    set(KEYS.PLANS, plans);
    const u = uid(); if (!u) return;
    fsDoc(up(`plans/${plan.id}`)).set(plan).catch(console.error);
  }

  function deletePlan(id) {
    set(KEYS.PLANS, getPlans().filter(p => p.id !== id));
    const u = uid(); if (!u) return;
    fsDoc(up(`plans/${id}`)).delete().catch(console.error);
  }

  /* ── Logs ────────────────────────────────────────────────────── */
  function getLogs() { return get(KEYS.LOGS) || []; }

  function addLog(log) {
    const logs = getLogs(); logs.push(log); set(KEYS.LOGS, logs);
    const u = uid(); if (!u) return;
    fsDoc(up(`logs/${log.id}`)).set(log).catch(console.error);
  }

  function deleteLog(id) {
    set(KEYS.LOGS, getLogs().filter(l => l.id !== id));
    const u = uid(); if (!u) return;
    fsDoc(up(`logs/${id}`)).delete().catch(console.error);
  }

  function updateLog(log) {
    const logs = getLogs();
    const idx = logs.findIndex(l => l.id === log.id);
    if (idx >= 0) {
      logs[idx] = log; set(KEYS.LOGS, logs);
      const u = uid(); if (!u) return;
      fsDoc(up(`logs/${log.id}`)).set(log).catch(console.error);
    }
  }

  /* ── Settings ────────────────────────────────────────────────── */
  function getSettings() { return get(KEYS.SETTINGS) || { activePlanId: null, weightUnit: 'kg' }; }

  function updateSettings(patch) {
    const s = { ...getSettings(), ...patch }; set(KEYS.SETTINGS, s);
    const u = uid(); if (!u) return;
    fsDoc(up('settings/main')).set(s).catch(console.error);
  }

  /* ── Init ─ called once after sign-in ────────────────────────── */
  async function init(user) {
    if (!user) return;
    const u = user.uid;
    const d = db();

    // Check Firestore state for this user
    const [plansSnap, logsSnap, settingsDoc] = await Promise.all([
      fsCol(`users/${u}/plans`).limit(1).get(),
      fsCol(`users/${u}/logs`).limit(1).get(),
      fsDoc(`users/${u}/settings/main`).get(),
    ]);

    const firestoreEmpty = plansSnap.empty && logsSnap.empty && !settingsDoc.exists;
    const localPlans    = get(KEYS.PLANS);
    const localLogs     = get(KEYS.LOGS);
    const localSettings = get(KEYS.SETTINGS);
    const hasLocal = (localPlans && localPlans.length > 0) ||
                     (localLogs  && localLogs.length  > 0) || !!localSettings;

    if (firestoreEmpty && hasLocal) {
      /* ── First sign-in: migrate localStorage → Firestore ── */
      if (localPlans && localPlans.length > 0) {
        const b = d.batch();
        localPlans.forEach(p => b.set(d.doc(`users/${u}/plans/${p.id}`), p));
        await b.commit();
      }
      if (localLogs && localLogs.length > 0) {
        for (let i = 0; i < localLogs.length; i += 499) {
          const b = d.batch();
          localLogs.slice(i, i + 499).forEach(l => b.set(d.doc(`users/${u}/logs/${l.id}`), l));
          await b.commit();
        }
      }
      if (localSettings) {
        await d.doc(`users/${u}/settings/main`).set(localSettings);
      }
    } else if (!firestoreEmpty) {
      /* ── Returning user on a new device: load Firestore → localStorage ── */
      const [allPlans, allLogs] = await Promise.all([
        d.collection(`users/${u}/plans`).get(),
        d.collection(`users/${u}/logs`).get(),
      ]);
      const settingsFull = await d.doc(`users/${u}/settings/main`).get();

      if (!allPlans.empty)   set(KEYS.PLANS, allPlans.docs.map(dc => dc.data()));
      if (!allLogs.empty) {
        const logs = allLogs.docs.map(dc => dc.data());
        logs.sort((a, b) => (a.date > b.date ? 1 : -1));
        set(KEYS.LOGS, logs);
      }
      if (settingsFull.exists) set(KEYS.SETTINGS, settingsFull.data());
    }

    /* ── Real-time listeners: keep localStorage in sync ── */
    d.collection(`users/${u}/plans`).onSnapshot(snap => {
      if (!snap.empty) set(KEYS.PLANS, snap.docs.map(dc => dc.data()));
    });
    d.collection(`users/${u}/logs`).onSnapshot(snap => {
      if (!snap.empty) {
        const logs = snap.docs.map(dc => dc.data());
        logs.sort((a, b) => (a.date > b.date ? 1 : -1));
        set(KEYS.LOGS, logs);
      }
    });
    d.doc(`users/${u}/settings/main`).onSnapshot(dc => {
      if (dc.exists) set(KEYS.SETTINGS, dc.data());
    });
  }

  return { getPlans, savePlans, getPlanById, upsertPlan, deletePlan,
           getLogs, addLog, deleteLog, updateLog, getSettings, updateSettings, init };
})();
