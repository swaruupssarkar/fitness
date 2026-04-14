/* ─── Plans ─ Predefined plans + CRUD ───────────────────────── */
const Plans = (() => {

  const PREDEFINED = [
    {
      id: 'ppl',
      name: 'Push / Pull / Legs',
      isCustom: false,
      days: [
        { name: 'Push A', exercises: [
          { name: 'Bench Press',            defaultSets: 4, defaultReps: 8  },
          { name: 'Overhead Press',         defaultSets: 3, defaultReps: 8  },
          { name: 'Incline Dumbbell Press', defaultSets: 3, defaultReps: 10 },
          { name: 'Lateral Raises',         defaultSets: 3, defaultReps: 15 },
          { name: 'Tricep Pushdowns',       defaultSets: 3, defaultReps: 12 },
        ]},
        { name: 'Pull A', exercises: [
          { name: 'Deadlift',      defaultSets: 3, defaultReps: 5  },
          { name: 'Barbell Row',   defaultSets: 4, defaultReps: 8  },
          { name: 'Lat Pulldown',  defaultSets: 3, defaultReps: 10 },
          { name: 'Face Pulls',    defaultSets: 3, defaultReps: 15 },
          { name: 'Barbell Curl',  defaultSets: 3, defaultReps: 12 },
        ]},
        { name: 'Legs A', exercises: [
          { name: 'Squat',               defaultSets: 4, defaultReps: 6  },
          { name: 'Romanian Deadlift',   defaultSets: 3, defaultReps: 10 },
          { name: 'Leg Press',           defaultSets: 3, defaultReps: 12 },
          { name: 'Leg Curl',            defaultSets: 3, defaultReps: 12 },
          { name: 'Calf Raises',         defaultSets: 4, defaultReps: 15 },
        ]},
        { name: 'Push B', exercises: [
          { name: 'Overhead Press',         defaultSets: 4, defaultReps: 6  },
          { name: 'Dumbbell Bench Press',   defaultSets: 3, defaultReps: 10 },
          { name: 'Cable Fly',              defaultSets: 3, defaultReps: 12 },
          { name: 'Lateral Raises',         defaultSets: 4, defaultReps: 15 },
          { name: 'Skull Crushers',         defaultSets: 3, defaultReps: 12 },
        ]},
        { name: 'Pull B', exercises: [
          { name: 'Pull-Ups',          defaultSets: 4, defaultReps: 8  },
          { name: 'Seated Cable Row',  defaultSets: 4, defaultReps: 10 },
          { name: 'Dumbbell Row',      defaultSets: 3, defaultReps: 10 },
          { name: 'Rear Delt Fly',     defaultSets: 3, defaultReps: 15 },
          { name: 'Hammer Curl',       defaultSets: 3, defaultReps: 12 },
        ]},
        { name: 'Legs B', exercises: [
          { name: 'Front Squat',     defaultSets: 3, defaultReps: 8  },
          { name: 'Hack Squat',      defaultSets: 3, defaultReps: 10 },
          { name: 'Walking Lunges',  defaultSets: 3, defaultReps: 12 },
          { name: 'Leg Extension',   defaultSets: 3, defaultReps: 12 },
          { name: 'Seated Calf Raises', defaultSets: 4, defaultReps: 15 },
        ]},
      ]
    },
    {
      id: 'upper-lower',
      name: 'Upper / Lower',
      isCustom: false,
      days: [
        { name: 'Upper A', exercises: [
          { name: 'Bench Press',         defaultSets: 4, defaultReps: 6  },
          { name: 'Barbell Row',         defaultSets: 4, defaultReps: 6  },
          { name: 'Overhead Press',      defaultSets: 3, defaultReps: 8  },
          { name: 'Lat Pulldown',        defaultSets: 3, defaultReps: 10 },
          { name: 'Barbell Curl',        defaultSets: 2, defaultReps: 12 },
          { name: 'Tricep Dips',         defaultSets: 2, defaultReps: 12 },
        ]},
        { name: 'Lower A', exercises: [
          { name: 'Squat',             defaultSets: 4, defaultReps: 6  },
          { name: 'Romanian Deadlift', defaultSets: 3, defaultReps: 8  },
          { name: 'Leg Press',         defaultSets: 3, defaultReps: 10 },
          { name: 'Leg Curl',          defaultSets: 3, defaultReps: 12 },
          { name: 'Calf Raises',       defaultSets: 4, defaultReps: 15 },
        ]},
        { name: 'Upper B', exercises: [
          { name: 'Overhead Press',         defaultSets: 4, defaultReps: 6  },
          { name: 'Pull-Ups',               defaultSets: 4, defaultReps: 8  },
          { name: 'Incline Dumbbell Press', defaultSets: 3, defaultReps: 10 },
          { name: 'Seated Cable Row',       defaultSets: 3, defaultReps: 10 },
          { name: 'Lateral Raises',         defaultSets: 3, defaultReps: 15 },
          { name: 'Face Pulls',             defaultSets: 3, defaultReps: 15 },
        ]},
        { name: 'Lower B', exercises: [
          { name: 'Deadlift',        defaultSets: 4, defaultReps: 5  },
          { name: 'Front Squat',     defaultSets: 3, defaultReps: 8  },
          { name: 'Walking Lunges',  defaultSets: 3, defaultReps: 12 },
          { name: 'Leg Extension',   defaultSets: 3, defaultReps: 12 },
          { name: 'Seated Calf Raises', defaultSets: 4, defaultReps: 15 },
        ]},
      ]
    },
    {
      id: 'full-body',
      name: 'Full Body 3×',
      isCustom: false,
      days: [
        { name: 'Full Body A', exercises: [
          { name: 'Squat',          defaultSets: 3, defaultReps: 8  },
          { name: 'Bench Press',    defaultSets: 3, defaultReps: 8  },
          { name: 'Barbell Row',    defaultSets: 3, defaultReps: 8  },
          { name: 'Overhead Press', defaultSets: 2, defaultReps: 10 },
          { name: 'Romanian Deadlift', defaultSets: 2, defaultReps: 10 },
        ]},
        { name: 'Full Body B', exercises: [
          { name: 'Deadlift',               defaultSets: 3, defaultReps: 5  },
          { name: 'Incline Dumbbell Press', defaultSets: 3, defaultReps: 10 },
          { name: 'Pull-Ups',               defaultSets: 3, defaultReps: 8  },
          { name: 'Lateral Raises',         defaultSets: 3, defaultReps: 15 },
          { name: 'Leg Press',              defaultSets: 3, defaultReps: 10 },
        ]},
        { name: 'Full Body C', exercises: [
          { name: 'Front Squat',       defaultSets: 3, defaultReps: 8  },
          { name: 'Dumbbell Bench',    defaultSets: 3, defaultReps: 10 },
          { name: 'Seated Cable Row',  defaultSets: 3, defaultReps: 10 },
          { name: 'Face Pulls',        defaultSets: 3, defaultReps: 15 },
          { name: 'Walking Lunges',    defaultSets: 3, defaultReps: 12 },
        ]},
      ]
    },
    {
      id: 'arnold',
      name: 'Arnold Split',
      isCustom: false,
      days: [
        { name: 'Chest & Back A', exercises: [
          { name: 'Bench Press',            defaultSets: 4, defaultReps: 8  },
          { name: 'Wide-Grip Pull-Ups',     defaultSets: 4, defaultReps: 8  },
          { name: 'Incline Dumbbell Press', defaultSets: 3, defaultReps: 10 },
          { name: 'Barbell Row',            defaultSets: 3, defaultReps: 10 },
          { name: 'Cable Fly',              defaultSets: 3, defaultReps: 12 },
          { name: 'Lat Pulldown',           defaultSets: 3, defaultReps: 12 },
        ]},
        { name: 'Shoulders & Arms A', exercises: [
          { name: 'Overhead Press',  defaultSets: 4, defaultReps: 8  },
          { name: 'Lateral Raises',  defaultSets: 4, defaultReps: 15 },
          { name: 'Barbell Curl',    defaultSets: 3, defaultReps: 10 },
          { name: 'Skull Crushers',  defaultSets: 3, defaultReps: 10 },
          { name: 'Hammer Curl',     defaultSets: 3, defaultReps: 12 },
          { name: 'Tricep Pushdowns',defaultSets: 3, defaultReps: 12 },
        ]},
        { name: 'Legs A', exercises: [
          { name: 'Squat',             defaultSets: 4, defaultReps: 8  },
          { name: 'Romanian Deadlift', defaultSets: 3, defaultReps: 10 },
          { name: 'Leg Press',         defaultSets: 3, defaultReps: 12 },
          { name: 'Leg Curl',          defaultSets: 3, defaultReps: 12 },
          { name: 'Calf Raises',       defaultSets: 4, defaultReps: 20 },
        ]},
        { name: 'Chest & Back B', exercises: [
          { name: 'Incline Barbell Press', defaultSets: 4, defaultReps: 8  },
          { name: 'Dumbbell Row',          defaultSets: 4, defaultReps: 10 },
          { name: 'Dumbbell Bench Press',  defaultSets: 3, defaultReps: 10 },
          { name: 'Seated Cable Row',      defaultSets: 3, defaultReps: 10 },
          { name: 'Pec Deck',              defaultSets: 3, defaultReps: 12 },
        ]},
        { name: 'Shoulders & Arms B', exercises: [
          { name: 'Arnold Press',              defaultSets: 4, defaultReps: 10 },
          { name: 'Front Raises',              defaultSets: 3, defaultReps: 12 },
          { name: 'Preacher Curl',             defaultSets: 3, defaultReps: 10 },
          { name: 'Close-Grip Bench',          defaultSets: 3, defaultReps: 10 },
          { name: 'Cable Curl',                defaultSets: 3, defaultReps: 12 },
          { name: 'Overhead Tricep Extension', defaultSets: 3, defaultReps: 12 },
        ]},
        { name: 'Legs B', exercises: [
          { name: 'Front Squat',        defaultSets: 4, defaultReps: 8  },
          { name: 'Hack Squat',         defaultSets: 3, defaultReps: 10 },
          { name: 'Walking Lunges',     defaultSets: 3, defaultReps: 12 },
          { name: 'Leg Extension',      defaultSets: 3, defaultReps: 15 },
          { name: 'Seated Calf Raises', defaultSets: 4, defaultReps: 20 },
        ]},
      ]
    },
  ];

  function ensureDefaults() {
    if (Storage.getPlans().length === 0) {
      Storage.savePlans(PREDEFINED);
    }
    const settings = Storage.getSettings();
    if (!settings.activePlanId) {
      Storage.updateSettings({ activePlanId: 'ppl' });
    }
  }

  function getActivePlan() {
    const { activePlanId } = Storage.getSettings();
    return Storage.getPlanById(activePlanId) || Storage.getPlans()[0] || null;
  }

  function setActivePlan(id) {
    Storage.updateSettings({ activePlanId: id });
  }

  function createCustomPlan(name, days, startDate = null) {
    const plan = { id: crypto.randomUUID(), name, isCustom: true, days, startDate };
    Storage.upsertPlan(plan);
    return plan;
  }

  function updateCustomPlan(id, name, days) {
    const plan = Storage.getPlanById(id);
    if (plan && plan.isCustom) Storage.upsertPlan({ ...plan, name, days });
  }

  function deleteCustomPlan(id) {
    const plan = Storage.getPlanById(id);
    if (!plan || !plan.isCustom) return;
    Storage.deletePlan(id);
    if (Storage.getSettings().activePlanId === id) {
      const first = Storage.getPlans()[0];
      Storage.updateSettings({ activePlanId: first ? first.id : null });
    }
  }

  return { ensureDefaults, getActivePlan, setActivePlan, createCustomPlan, updateCustomPlan, deleteCustomPlan };
})();
