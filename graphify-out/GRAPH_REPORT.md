# Graph Report - /Users/swarupsarkar/Downloads/website tarot  (2026-04-18)

## Corpus Check
- Corpus is ~29,128 words - fits in a single context window. You may not need a graph.

## Summary
- 94 nodes · 147 edges · 16 communities detected
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Dashboard & Calendar|Dashboard & Calendar]]
- [[_COMMUNITY_Plans & Workout Builder|Plans & Workout Builder]]
- [[_COMMUNITY_Auth & App Init|Auth & App Init]]
- [[_COMMUNITY_Navigation & Logger UI|Navigation & Logger UI]]
- [[_COMMUNITY_Charts & Progress View|Charts & Progress View]]
- [[_COMMUNITY_Module Singletons (IIFE)|Module Singletons (IIFE)]]
- [[_COMMUNITY_History & Log Editing|History & Log Editing]]
- [[_COMMUNITY_Top-level App & Auth Modules|Top-level App & Auth Modules]]
- [[_COMMUNITY_Logger Module (file)|Logger Module (file)]]
- [[_COMMUNITY_Metrics Module (file)|Metrics Module (file)]]
- [[_COMMUNITY_Auth Module (file)|Auth Module (file)]]
- [[_COMMUNITY_Charts Module (file)|Charts Module (file)]]
- [[_COMMUNITY_Plans Module (file)|Plans Module (file)]]
- [[_COMMUNITY_Storage Module (file)|Storage Module (file)]]
- [[_COMMUNITY_Firebase Config|Firebase Config]]
- [[_COMMUNITY_Day Picker UI|Day Picker UI]]

## God Nodes (most connected - your core abstractions)
1. `getLogs` - 21 edges
2. `renderDashboard` - 13 edges
3. `App.init` - 9 edges
4. `bindPlanEvents` - 9 edges
5. `getActivePlan` - 8 edges
6. `saveLog` - 8 edges
7. `renderHistory` - 8 edges
8. `showView` - 8 edges
9. `esc()` - 7 edges
10. `Firestore Sync` - 7 edges

## Surprising Connections (you probably didn't know these)
- `buildExercisesHTML` --calls--> `esc()`  [EXTRACTED]
  js/logger.js → /Users/swarupsarkar/Downloads/website tarot/js/app.js
- `renderUserInfo` --references--> `FitTrack Logo`  [EXTRACTED]
  js/app.js → img/logo.png
- `renderPlans` --calls--> `esc()`  [EXTRACTED]
  js/app.js → /Users/swarupsarkar/Downloads/website tarot/js/app.js
- `renderHistory` --calls--> `esc()`  [EXTRACTED]
  js/app.js → /Users/swarupsarkar/Downloads/website tarot/js/app.js
- `renderDashboard` --calls--> `esc()`  [EXTRACTED]
  js/app.js → /Users/swarupsarkar/Downloads/website tarot/js/app.js

## Hyperedges (group relationships)
- **FitTrack Core Module System** — auth_Auth, storage_Storage, plans_Plans, metrics_Metrics, logger_Logger, charts_Charts, app_App [INFERRED 0.95]
- **Dual Persistence Layer (LocalStorage + Firestore)** — storage_Storage, storage_localStorage, storage_firestore, auth_getUser, auth_getDb [EXTRACTED 1.00]
- **Workout Logging Flow** — logger_render, logger_renderDayPicker, logger_renderLogger, logger_saveLog, storage_addLog, storage_updateLog, metrics_getPRs [EXTRACTED 1.00]
- **Dashboard Metrics Display** — app_renderDashboard, metrics_getMonthlyWorkoutCount, metrics_getMonthlyWeightChange, metrics_getWeekTopLift, metrics_getTotalWorkouts, metrics_getAvgSessionDuration [EXTRACTED 1.00]
- **Progress Charts Rendering Flow** — charts_render, charts_drawProgressChart, charts_drawBodyWeightChart, charts_drawDurationChart, metrics_getExerciseHistory, metrics_getBodyWeightHistory, metrics_getSessionDurationHistory [EXTRACTED 1.00]
- **Authentication and Session Boot Flow** — app_init, auth_signInWithGoogle, auth_handleRedirectResult, auth_onAuthReady, storage_init, app_renderUserInfo, app_renderGuestInfo, plans_ensureDefaults [EXTRACTED 1.00]

## Communities

### Community 0 - "Dashboard & Calendar"
Cohesion: 0.17
Nodes (17): buildCalendar, buildMonthCalendar, buildWeekCalendar, esc(), renderDashboard, getActivityGrid, getAvgSessionDuration, getBodyWeightHistory (+9 more)

### Community 1 - "Plans & Workout Builder"
Cohesion: 0.17
Nodes (17): bindDragDrop, bindPlanEvents, renderDayBuilder, renderPlans, Predefined Workout Plans, createCustomPlan, deleteCustomPlan, ensureDefaults (+9 more)

### Community 2 - "Auth & App Init"
Cohesion: 0.2
Nodes (11): App.init, initSidebar, renderGuestInfo, renderUserInfo, handleRedirectResult, onAuthReady, signInWithGoogle, signOut (+3 more)

### Community 3 - "Navigation & Logger UI"
Cohesion: 0.24
Nodes (11): navigate, toast, bindExerciseEvents, bindLogDragDrop, buildExercisesHTML, renderLogger, saveLog, addLog (+3 more)

### Community 4 - "Charts & Progress View"
Cohesion: 0.25
Nodes (11): bindChartDragDrop, buildChartsContainer, drawBodyWeightChart, drawDurationChart, drawProgressChart, Charts.render, reorderCharts, getAllExerciseNames (+3 more)

### Community 5 - "Module Singletons (IIFE)"
Cohesion: 0.25
Nodes (8): requireAuth, getDb, getUser, Charts Module, Logger Module, Metrics Module, Plans Module, Storage Module

### Community 6 - "History & Log Editing"
Cohesion: 0.39
Nodes (8): bindCalendarEvents, renderHistory, showView, editLog, openForDate, Logger.render, formatVolume, getActivePlan

### Community 7 - "Top-level App & Auth Modules"
Cohesion: 1.0
Nodes (2): App Module, Auth Module

### Community 8 - "Logger Module (file)"
Cohesion: 1.0
Nodes (0): 

### Community 9 - "Metrics Module (file)"
Cohesion: 1.0
Nodes (0): 

### Community 10 - "Auth Module (file)"
Cohesion: 1.0
Nodes (0): 

### Community 11 - "Charts Module (file)"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "Plans Module (file)"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "Storage Module (file)"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Firebase Config"
Cohesion: 1.0
Nodes (1): Firebase Config

### Community 15 - "Day Picker UI"
Cohesion: 1.0
Nodes (1): renderDayPicker

## Knowledge Gaps
- **23 isolated node(s):** `Auth Module`, `signInWithGoogle`, `handleRedirectResult`, `onAuthReady`, `getDb` (+18 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Top-level App & Auth Modules`** (2 nodes): `App Module`, `Auth Module`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Logger Module (file)`** (1 nodes): `logger.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Metrics Module (file)`** (1 nodes): `metrics.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Module (file)`** (1 nodes): `auth.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Charts Module (file)`** (1 nodes): `charts.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Plans Module (file)`** (1 nodes): `plans.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Storage Module (file)`** (1 nodes): `storage.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Firebase Config`** (1 nodes): `Firebase Config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Day Picker UI`** (1 nodes): `renderDayPicker`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.